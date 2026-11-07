-- CANDIDATE ONLY. NOT APPLIED OR POSTGRES-VALIDATED. See player-account-cloud-contract.md.
-- Isolated local Supabase review/test required before generating a migration.
begin;
create schema player_cloud_private;
revoke all on schema player_cloud_private from public, anon, authenticated;
create role newtone_player_cloud_executor nologin noinherit;
grant usage on schema player_cloud_private, auth to newtone_player_cloud_executor;
grant usage on schema player_cloud_private to authenticated;
grant select (id,user_id,created_at) on auth.sessions to newtone_player_cloud_executor;
grant select (id,is_anonymous) on auth.users to newtone_player_cloud_executor;
create table player_cloud_private.accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active_session uuid, high_session uuid, high_created timestamptz, adoption_claimed boolean not null default false,
 fence bigint not null default 0 check(fence>=0), lease_until timestamptz
);
create table player_cloud_private.slots (
 user_id uuid not null references auth.users(id) on delete cascade,
 slot_no smallint not null check(slot_no between 1 and 3), slot_id uuid not null unique,
 revision bigint not null check(revision>=1), payload jsonb not null,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(user_id,slot_no), unique(user_id,slot_id)
);
create table player_cloud_private.operations (
 user_id uuid not null references auth.users(id) on delete cascade, operation_id uuid not null,
 request jsonb not null, result jsonb not null, primary key(user_id,operation_id)
);
create table player_cloud_private.adoptions (
 user_id uuid not null, generation_id text not null, slot_id uuid not null,
 operation_id uuid not null, primary key(user_id,generation_id),
 foreign key(user_id,slot_id) references player_cloud_private.slots(user_id,slot_id)
);
create table player_cloud_private.backups (
 user_id uuid not null, operation_id uuid not null, slot_id uuid not null,
 kind text not null check(kind in ('cloud-before-replace','local-not-chosen')),
 payload jsonb not null, created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,operation_id,kind),
 foreign key(user_id,slot_id) references player_cloud_private.slots(user_id,slot_id)
);
-- Registration eligibility is issued only by this NEW auth.users INSERT trigger.
-- Deliberately NO backfill, timestamp inference, login grant, or anonymous-upgrade grant.
create role newtone_player_registration_issuer nologin noinherit;
grant usage on schema player_cloud_private to newtone_player_registration_issuer;
create table player_cloud_private.registration_grants (
 user_id uuid primary key references auth.users(id) on delete cascade,
 issued_at timestamptz not null default clock_timestamp(),
 consumed_at timestamptz, consumed_operation_id uuid,
 check ((consumed_at is null) = (consumed_operation_id is null))
);
alter table player_cloud_private.registration_grants enable row level security;
-- Issuer can only insert. It has no membership grants, Auth reads, UPDATE, or RPC access.
create policy registration_issue on player_cloud_private.registration_grants
 for insert to newtone_player_registration_issuer with check (true);
create policy registration_self_read on player_cloud_private.registration_grants
 for select to newtone_player_cloud_executor using (user_id=auth.uid());
create policy registration_self_consume on player_cloud_private.registration_grants
 for update to newtone_player_cloud_executor using (user_id=auth.uid()) with check (user_id=auth.uid());
revoke all on player_cloud_private.registration_grants from public,anon,authenticated;
grant insert (user_id) on player_cloud_private.registration_grants to newtone_player_registration_issuer;
grant select on player_cloud_private.registration_grants to newtone_player_cloud_executor;
grant update (consumed_at,consumed_operation_id) on player_cloud_private.registration_grants to newtone_player_cloud_executor;
create function player_cloud_private.issue_registration_grant()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.is_anonymous is false then
  insert into player_cloud_private.registration_grants(user_id) values(new.id);
 end if;
 return new;
end;
$$;
grant create on schema player_cloud_private to newtone_player_registration_issuer;
alter function player_cloud_private.issue_registration_grant() owner to newtone_player_registration_issuer;
revoke create on schema player_cloud_private from newtone_player_registration_issuer;
revoke all on function player_cloud_private.issue_registration_grant() from public,anon,authenticated,newtone_player_cloud_executor;
-- Must be installed/tested by the migration owner, never by the player RPC executor.
-- A permission/trigger failure can reject signup: exercise this in isolated Supabase first.
create trigger newtone_player_registration_grant
 after insert on auth.users for each row
 execute function player_cloud_private.issue_registration_grant();

-- RLS also applies to the dedicated function executor; it owns neither tables nor Auth.
alter table player_cloud_private.accounts enable row level security;
alter table player_cloud_private.slots enable row level security;
alter table player_cloud_private.operations enable row level security;
alter table player_cloud_private.adoptions enable row level security;
alter table player_cloud_private.backups enable row level security;
create policy owned on player_cloud_private.accounts to newtone_player_cloud_executor using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy owned on player_cloud_private.slots to newtone_player_cloud_executor using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy owned on player_cloud_private.operations to newtone_player_cloud_executor using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy owned on player_cloud_private.adoptions to newtone_player_cloud_executor using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy owned on player_cloud_private.backups to newtone_player_cloud_executor using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on all tables in schema player_cloud_private from public,anon,authenticated;
grant select,insert,update on player_cloud_private.accounts,player_cloud_private.slots to newtone_player_cloud_executor;
grant select,insert on player_cloud_private.operations,player_cloud_private.adoptions,player_cloud_private.backups to newtone_player_cloud_executor;

create function player_cloud_private.dispatch(p_action text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid := auth.uid(); sid uuid; born timestamptz; latest uuid;
 a player_cloud_private.accounts%rowtype; s player_cloud_private.slots%rowtype;
 op player_cloud_private.operations%rowtype; adopted player_cloud_private.adoptions%rowtype;
 oid uuid; slot uuid; number smallint; body jsonb; req jsonb; result jsonb;
 expected bigint; stamp timestamptz; k text; v jsonb;
begin
 if u is null or not exists(select 1 from auth.users where id=u and is_anonymous=false) then
  raise exception 'AUTH_REQUIRED' using errcode='42501';
 end if;
 sid := nullif(auth.jwt()->>'session_id','')::uuid;
 select created_at into born from auth.sessions where id=sid and user_id=u;
 if born is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_args is null or jsonb_typeof(p_args)<>'object' then raise exception 'INVALID_ARGUMENTS'; end if;
 insert into player_cloud_private.accounts(user_id) values(u) on conflict do nothing;
 select * into a from player_cloud_private.accounts where user_id=u for update;
 -- Refresh does not change this server creation order. No client timestamps accepted.
 select id into latest from auth.sessions where user_id=u order by created_at desc,id desc limit 1;
 if latest is distinct from sid then raise exception 'SESSION_REPLACED' using errcode='42501'; end if;
 stamp := clock_timestamp();
 if p_action='activate' then
  if a.high_created is not null and (born,sid)<(a.high_created,a.high_session) then
   raise exception 'SESSION_REPLACED' using errcode='42501';
  end if;
  if a.high_created is not null and (born,sid)=(a.high_created,a.high_session) then
   if a.active_session is distinct from sid then raise exception 'SESSION_REPLACED' using errcode='42501'; end if;
  else
   update player_cloud_private.accounts set active_session=sid,high_session=sid,high_created=born,fence=fence+1 where user_id=u;
  end if;
  update player_cloud_private.accounts set lease_until=stamp+interval '90 seconds' where user_id=u returning * into a;
  return jsonb_build_object('ok',true,'fence',a.fence::text,'serverNow',stamp,'leaseUntil',a.lease_until);
 end if;
 if p_action='resume' then
  if a.active_session is distinct from sid then raise exception 'SESSION_REPLACED' using errcode='42501'; end if;
  update player_cloud_private.accounts set lease_until=stamp+interval '90 seconds' where user_id=u returning * into a;
  return jsonb_build_object('ok',true,'fence',a.fence::text,'serverNow',stamp,'leaseUntil',a.lease_until);
 end if;
 if a.active_session is distinct from sid or (p_args->>'fence') is distinct from a.fence::text then
  raise exception 'SESSION_REPLACED' using errcode='42501';
 end if;
 if p_action='renew' then
  update player_cloud_private.accounts set lease_until=stamp+interval '90 seconds' where user_id=u returning * into a;
  return jsonb_build_object('ok',true,'fence',a.fence::text,'serverNow',stamp,'leaseUntil',a.lease_until);
 end if;
 if a.lease_until is null or a.lease_until<=stamp then raise exception 'SESSION_EXPIRED' using errcode='42501'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('slotId',slot_id,'slotNo',slot_no,'revision',revision::text,'updatedAt',updated_at) order by slot_no),'[]'::jsonb)
  into result from player_cloud_private.slots where user_id=u;
  return jsonb_build_object('ok',true,'ownerId',u,'slots',result,'autoAdoptionEligible',not a.adoption_claimed and result='[]'::jsonb and exists(select 1 from player_cloud_private.registration_grants where user_id=u and consumed_at is null));
 end if;
 if p_action='read' then
  select * into s from player_cloud_private.slots where user_id=u and slot_id=(p_args->>'slotId')::uuid;
  if not found then raise exception 'SLOT_NOT_FOUND'; end if;
  return jsonb_build_object('ok',true,'slotId',s.slot_id,'revision',s.revision::text,'payload',s.payload,'updatedAt',s.updated_at);
 end if;
 if p_action='receipt' then
  select o.result into result from player_cloud_private.operations o where o.user_id=u and o.operation_id=(p_args->>'operationId')::uuid;
  return jsonb_build_object('ok',true,'receipt',result);
 end if;
 if p_action not in ('create','adopt','write','resolve','release') then raise exception 'UNSUPPORTED_ACTION'; end if;
 oid := (p_args->>'operationId')::uuid;
 if oid is null then raise exception 'OPERATION_ID_REQUIRED'; end if;
 req := jsonb_build_object('action',p_action,'args',p_args-'fence'-'operationId');
 select * into op from player_cloud_private.operations where user_id=u and operation_id=oid;
 if found then
  if op.request<>req then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
  return op.result || jsonb_build_object('replayed',true);
 end if;
 if p_action='release' then
  update player_cloud_private.accounts set active_session=null,lease_until=null,fence=fence+1 where user_id=u;
  result:=jsonb_build_object('ok',true,'released',true);
 else
  if jsonb_typeof(p_args->'payloadRaw') is distinct from 'string' or octet_length(convert_to(p_args->>'payloadRaw','UTF8'))>2097152 then raise exception 'INVALID_PAYLOAD'; end if;
  if (p_args->>'sourceFingerprint') is distinct from encode(sha256(convert_to(p_args->>'payloadRaw','UTF8')),'hex') then raise exception 'INVALID_SOURCE_FINGERPRINT'; end if;
  body:=(p_args->>'payloadRaw')::jsonb;
  -- Structural gate only. Semantic PlayerSave/Reader validator is a release gate.
  if body is null or jsonb_typeof(body)<>'object' or octet_length(convert_to(body::text,'UTF8'))>2097152
   or (body->>'format') is distinct from 'newtone-player-state'
   or (body->>'formatVersion') is distinct from '1'
   or (body->>'saveEpoch') is distinct from 'persistent-era-1'
   or (body->>'localProtocolVersion') is distinct from '2'
   or jsonb_typeof(body->'values') is distinct from 'object'
   or jsonb_typeof(body->'generation') is distinct from 'object'
   or coalesce(length(body->'generation'->>'id'),0)=0
   or jsonb_typeof(body->'recoveryHolds') is distinct from 'array'
   or jsonb_typeof(body->'values'->'newtone-player-save-v1') is distinct from 'string'
  then raise exception 'INVALID_PAYLOAD'; end if;
  if exists(select 1 from jsonb_object_keys(body) key where key not in ('format','formatVersion','saveEpoch','localProtocolVersion','generation','localRevision','values','recoveryHolds')) then raise exception 'INVALID_PAYLOAD_FIELDS'; end if;
  for k,v in select * from jsonb_each(body->'values') loop
   if jsonb_typeof(v)<>'string' or not (
    k='newtone-player-save-v1' or k='newtone-reader-publication-v1'
    or k ~ '^newtone-(progress-v[1-4]|narrative-progress-v[12]|reader-exit-tutorial-v1|landing-intro-v1|choice-wheel-hint-seen|scene-motion-enabled)$'
    or k like 'newtone:center:scene-layout:%') then raise exception 'INVALID_PAYLOAD_KEY'; end if;
  end loop;
  if p_action='adopt' then
   select * into adopted from player_cloud_private.adoptions where user_id=u and generation_id=body->'generation'->>'id';
   if found then return jsonb_build_object('ok',false,'code','ADOPTION_ALREADY_COMMITTED','slotId',adopted.slot_id,'operationId',adopted.operation_id); end if;
   if a.adoption_claimed or exists(select 1 from player_cloud_private.slots where user_id=u) then return jsonb_build_object('ok',false,'code','EXPLICIT_ADOPTION_REQUIRED'); end if;
   update player_cloud_private.registration_grants set consumed_at=stamp,consumed_operation_id=oid where user_id=u and consumed_at is null;
   if not found then return jsonb_build_object('ok',false,'code','EXPLICIT_ADOPTION_REQUIRED'); end if;
   select n::smallint into number from generate_series(1,3) n where not exists(select 1 from player_cloud_private.slots where user_id=u and slot_no=n) order by n limit 1;
   if number is null then raise exception 'SLOT_LIMIT'; end if;
  else number:=(p_args->>'slotNo')::smallint; end if;
  slot:=(p_args->>'slotId')::uuid;
  if slot is null then raise exception 'SLOT_ID_REQUIRED'; end if;
  if p_action in ('create','adopt') then
   if number is null or number not between 1 and 3 then raise exception 'SLOT_LIMIT'; end if;
   insert into player_cloud_private.slots(user_id,slot_no,slot_id,revision,payload) values(u,number,slot,1,body) returning * into s;
   update player_cloud_private.accounts set adoption_claimed=true where user_id=u;
   if p_action='adopt' then insert into player_cloud_private.adoptions values(u,body->'generation'->>'id',slot,oid); end if;
  else
   select * into s from player_cloud_private.slots where user_id=u and slot_id=slot for update;
   if not found then raise exception 'SLOT_NOT_FOUND'; end if;
   expected:=(p_args->>'expectedRevision')::bigint;
   if expected is distinct from s.revision then return jsonb_build_object('ok',false,'code','REVISION_CONFLICT','revision',s.revision::text); end if;
   if p_action='resolve' then
    if p_args->>'choice'='local' then
     insert into player_cloud_private.backups values(u,oid,slot,'cloud-before-replace',s.payload,stamp);
    elsif p_args->>'choice'='cloud' then
     insert into player_cloud_private.backups values(u,oid,slot,'local-not-chosen',body,stamp);
    else raise exception 'INVALID_CHOICE'; end if;
   end if;
   if p_action='write' or p_args->>'choice'='local' then
    update player_cloud_private.slots set payload=body,revision=revision+1,updated_at=stamp where user_id=u and slot_id=slot returning * into s;
   end if;
  end if;
  result:=jsonb_build_object('ok',true,'slotId',s.slot_id,'slotNo',s.slot_no,'revision',s.revision::text,'ownerId',u,'operationId',oid,'sourceFingerprint',p_args->>'sourceFingerprint');
 end if;
 insert into player_cloud_private.operations values(u,oid,req,result);
 return result;
end;
$$;
-- Transfer execution to least-privilege role, not postgres/service_role.
grant create on schema player_cloud_private to newtone_player_cloud_executor;
alter function player_cloud_private.dispatch(text,jsonb) owner to newtone_player_cloud_executor;
revoke create on schema player_cloud_private from newtone_player_cloud_executor;
revoke all on function player_cloud_private.dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function player_cloud_private.dispatch(text,jsonb) to authenticated;
create function public.player_cloud_v1(p_action text,p_args jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select player_cloud_private.dispatch(p_action,p_args);
$$;
revoke all on function public.player_cloud_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.player_cloud_v1(text,jsonb) to authenticated;
commit;
