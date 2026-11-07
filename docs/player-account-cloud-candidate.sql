-- CANDIDATE ONLY. NOT APPLIED OR POSTGRES-VALIDATED. See player-account-cloud-contract.md.
-- Hosted PG17 draft: independent review and target verification required before execution.
begin;
-- Hosted migration path: PostgreSQL 17, postgres CREATEROLE but NOT SUPERUSER.
-- No credentials are created. Automatic bootstrap ADMIN-only memberships are
-- retained; our separate temporary SET-only memberships must not survive COMMIT.
do $migration_preflight$
begin
 if current_setting('server_version_num')::integer not between 170000 and 179999 then
  raise exception 'PLAYER_CLOUD_MIGRATION_REQUIRES_REVIEWED_PG17';
 end if;
 if current_user <> 'postgres' or not exists (
  select 1 from pg_catalog.pg_roles where rolname=current_user and rolcreaterole and not rolsuper
 ) then raise exception 'PLAYER_CLOUD_MIGRATION_REQUIRES_NONSUPERUSER_POSTGRES_CREATEROLE'; end if;
end;
$migration_preflight$;
set local createrole_self_grant = '';
create schema player_cloud_private;
revoke all on schema player_cloud_private from public, anon, authenticated;
create role newtone_player_cloud_executor nologin noinherit;
-- Capture the immutable bootstrap-issued creator grant before our own grant.
do $capture_executor_creator_grant$
declare membership pg_catalog.pg_auth_members%rowtype;
begin
 select * into strict membership from pg_catalog.pg_auth_members
  where roleid='newtone_player_cloud_executor'::regrole;
 if membership.member <> current_user::regrole or membership.grantor=current_user::regrole
    or not membership.admin_option or membership.inherit_option or membership.set_option then
  raise exception 'UNEXPECTED_executor_CREATOR_MEMBERSHIP';
 end if;
 perform pg_catalog.set_config('newtone_migration.executor_bootstrap_grantor',membership.grantor::text,true);
end;
$capture_executor_creator_grant$;
grant newtone_player_cloud_executor to current_user with admin false, inherit false, set true granted by current_user;
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
 revision bigint not null check(revision>=1), payload jsonb not null, payload_raw text not null,
 check(payload_raw::jsonb=payload),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(user_id,slot_no), unique(user_id,slot_id)
);
create table player_cloud_private.operations (
 user_id uuid not null references auth.users(id) on delete cascade, operation_id uuid not null,
 request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'), result jsonb not null, primary key(user_id,operation_id)
);
create table player_cloud_private.adoptions (
 user_id uuid not null, generation_id text not null, slot_id uuid not null,
 operation_id uuid not null, primary key(user_id,generation_id),
 foreign key(user_id,slot_id) references player_cloud_private.slots(user_id,slot_id)
);
create table player_cloud_private.backups (
 user_id uuid not null, operation_id uuid not null, slot_id uuid not null,
 kind text not null check(kind in ('cloud-before-replace','local-not-chosen','cloud-conflict-snapshot','local-conflict-snapshot')),
 payload jsonb not null, payload_raw text not null, created_at timestamptz not null default clock_timestamp(),
 check(payload_raw::jsonb=payload),
 primary key(user_id,operation_id,kind),
 foreign key(user_id,slot_id) references player_cloud_private.slots(user_id,slot_id)
);
-- Registration eligibility is issued only by this NEW auth.users INSERT trigger.
-- Deliberately NO backfill, timestamp inference, login grant, or anonymous-upgrade grant.
create role newtone_player_registration_issuer nologin noinherit;
-- Capture the immutable bootstrap-issued creator grant before our own grant.
do $capture_issuer_creator_grant$
declare membership pg_catalog.pg_auth_members%rowtype;
begin
 select * into strict membership from pg_catalog.pg_auth_members
  where roleid='newtone_player_registration_issuer'::regrole;
 if membership.member <> current_user::regrole or membership.grantor=current_user::regrole
    or not membership.admin_option or membership.inherit_option or membership.set_option then
  raise exception 'UNEXPECTED_issuer_CREATOR_MEMBERSHIP';
 end if;
 perform pg_catalog.set_config('newtone_migration.issuer_bootstrap_grantor',membership.grantor::text,true);
end;
$capture_issuer_creator_grant$;
grant newtone_player_registration_issuer to current_user with admin false, inherit false, set true granted by current_user;
grant usage on schema player_cloud_private to newtone_player_registration_issuer;
create table player_cloud_private.registration_grants (
 user_id uuid primary key references auth.users(id) on delete cascade,
 issued_at timestamptz not null default clock_timestamp(),
 consumed_at timestamptz, consumed_operation_id uuid,
 check ((consumed_at is null) = (consumed_operation_id is null))
);
alter table player_cloud_private.registration_grants enable row level security;
-- Issuer can only insert. No client membership, Auth reads, UPDATE or RPC access.
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
revoke all on function player_cloud_private.issue_registration_grant() from public,anon,authenticated,newtone_player_cloud_executor;
-- postgres still owns this function here, so CREATE TRIGGER has its required EXECUTE.
-- Transfer ownership only after all function ACLs and this trigger are finalized.
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
 op player_cloud_private.operations%rowtype; adopted player_cloud_private.adoptions%rowtype; saved player_cloud_private.backups%rowtype;
 oid uuid; slot uuid; number smallint; body jsonb; req jsonb; reqhash text; result jsonb;
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
 select id into latest from auth.sessions where user_id=u and created_at is not null order by created_at desc,id desc limit 1;
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
  return jsonb_build_object('ok',true,'slotId',s.slot_id,'revision',s.revision::text,'payload',s.payload,'payloadRaw',s.payload_raw,'sourceFingerprint',encode(sha256(convert_to(s.payload_raw,'UTF8')),'hex'),'updatedAt',s.updated_at);
 end if;
 if p_action='list_backups' then
  select coalesce(jsonb_agg(jsonb_build_object('backupId',operation_id::text||':'||kind,'summary',jsonb_build_object('kind',kind,'createdAt',created_at,'sourceFingerprint',encode(sha256(convert_to(payload_raw,'UTF8')),'hex'))) order by created_at desc,operation_id,kind),'[]'::jsonb)
  into result from player_cloud_private.backups where user_id=u and slot_id=(p_args->>'slotId')::uuid;
  return jsonb_build_object('ok',true,'slotId',p_args->>'slotId','backups',result);
 end if;
 if p_action='read_backup' then
  select * into saved from player_cloud_private.backups where user_id=u and slot_id=(p_args->>'slotId')::uuid and operation_id::text||':'||kind=p_args->>'backupId';
  if not found then raise exception 'BACKUP_NOT_FOUND'; end if;
  return jsonb_build_object('ok',true,'slotId',saved.slot_id,'backupId',p_args->>'backupId','payload',saved.payload,'payloadRaw',saved.payload_raw,'sourceFingerprint',encode(sha256(convert_to(saved.payload_raw,'UTF8')),'hex'));
 end if;
 if p_action='receipt' then
  select o.result into result from player_cloud_private.operations o where o.user_id=u and o.operation_id=(p_args->>'operationId')::uuid;
  return jsonb_build_object('ok',true,'receipt',result);
 end if;
 if p_action not in ('create','adopt','write','resolve','restore','release') then raise exception 'UNSUPPORTED_ACTION'; end if;
 oid := (p_args->>'operationId')::uuid;
 if oid is null then raise exception 'OPERATION_ID_REQUIRED'; end if;
 req := jsonb_build_object('action',p_action,'args',p_args-'fence'-'operationId');
 reqhash:=encode(sha256(convert_to(req::text,'UTF8')),'hex');
 select * into op from player_cloud_private.operations where user_id=u and operation_id=oid;
 if found then
  if op.request_hash<>reqhash then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
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
   insert into player_cloud_private.slots(user_id,slot_no,slot_id,revision,payload,payload_raw) values(u,number,slot,1,body,p_args->>'payloadRaw') returning * into s;
   update player_cloud_private.accounts set adoption_claimed=true where user_id=u;
   if p_action='adopt' then insert into player_cloud_private.adoptions values(u,body->'generation'->>'id',slot,oid); end if;
  else
   select * into s from player_cloud_private.slots where user_id=u and slot_id=slot for update;
   if not found then raise exception 'SLOT_NOT_FOUND'; end if;
   expected:=(p_args->>'expectedRevision')::bigint;
   if expected is distinct from s.revision then return jsonb_build_object('ok',false,'code','REVISION_CONFLICT','revision',s.revision::text); end if;
   if p_action in ('resolve','restore') then
    if (p_args->>'expectedCloudFingerprint') is distinct from encode(sha256(convert_to(s.payload_raw,'UTF8')),'hex') then
     return jsonb_build_object('ok',false,'code','REVISION_CONFLICT','revision',s.revision::text);
    end if;
    if p_action='resolve' and ((p_args->>'choice') is null or (p_args->>'choice') not in ('local','cloud')) then raise exception 'INVALID_CHOICE'; end if;
    if p_action='restore' then
     select * into saved from player_cloud_private.backups where user_id=u and slot_id=slot and operation_id::text||':'||kind=p_args->>'backupId';
     if not found then raise exception 'BACKUP_NOT_FOUND'; end if;
    end if;
    -- Preserve BOTH exact branches in the same transaction before any selection.
    insert into player_cloud_private.backups values(u,oid,slot,'cloud-conflict-snapshot',s.payload,s.payload_raw,stamp);
    insert into player_cloud_private.backups values(u,oid,slot,'local-conflict-snapshot',body,p_args->>'payloadRaw',stamp);
   end if;
   if p_action='restore' then
    update player_cloud_private.slots set payload=saved.payload,payload_raw=saved.payload_raw,revision=revision+1,updated_at=stamp where user_id=u and slot_id=slot returning * into s;
   elsif p_action='write' or p_args->>'choice'='local' then
    update player_cloud_private.slots set payload=body,payload_raw=p_args->>'payloadRaw',revision=revision+1,updated_at=stamp where user_id=u and slot_id=slot returning * into s;
   end if;
  end if;
  result:=jsonb_build_object('ok',true,'slotId',s.slot_id,'slotNo',s.slot_no,'revision',s.revision::text,'ownerId',u,'operationId',oid,'sourceFingerprint',p_args->>'sourceFingerprint');
  if p_action in ('resolve','restore') then
   result:=result||jsonb_build_object('choice',case when p_action='restore' then 'backup' else p_args->>'choice' end,'backupId',p_args->>'backupId','chosenPayloadRaw',s.payload_raw,'chosenFingerprint',encode(sha256(convert_to(s.payload_raw,'UTF8')),'hex'),'backupKinds',jsonb_build_array('cloud-conflict-snapshot','local-conflict-snapshot'));
  end if;
 end if;
 insert into player_cloud_private.operations values(u,oid,reqhash,result);
 return result;
end;
$$;
-- Finalize function ACLs while postgres still owns the function.
revoke all on function player_cloud_private.dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function player_cloud_private.dispatch(text,jsonb) to authenticated;
create function public.player_cloud_v1(p_action text,p_args jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select player_cloud_private.dispatch(p_action,p_args);
$$;
revoke all on function public.player_cloud_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.player_cloud_v1(text,jsonb) to authenticated;
-- No function GRANT/REVOKE is issued by postgres after its ownership transfer.
-- SET capability and target-schema CREATE are both required by ALTER OWNER.
grant create on schema player_cloud_private to newtone_player_registration_issuer;
alter function player_cloud_private.issue_registration_grant() owner to newtone_player_registration_issuer;
revoke create on schema player_cloud_private from newtone_player_registration_issuer;
grant create on schema player_cloud_private to newtone_player_cloud_executor;
alter function player_cloud_private.dispatch(text,jsonb) owner to newtone_player_cloud_executor;
revoke create on schema player_cloud_private from newtone_player_cloud_executor;
-- Remove only grants made by this migration role; never impersonate the bootstrap grantor.
revoke newtone_player_registration_issuer from current_user granted by current_user restrict;
revoke newtone_player_cloud_executor from current_user granted by current_user restrict;

do $verify_migration_security$
declare target text; tag text; membership pg_catalog.pg_auth_members%rowtype; client text;
begin
 foreach target in array array['newtone_player_cloud_executor','newtone_player_registration_issuer'] loop
  tag:=case target when 'newtone_player_cloud_executor' then 'executor' else 'issuer' end;
  -- STRICT requires exactly one member: the original bootstrap ADMIN-only grant.
  select * into strict membership from pg_catalog.pg_auth_members where roleid=target::regrole;
  if membership.member<>current_user::regrole
     or membership.grantor<>current_setting('newtone_migration.'||tag||'_bootstrap_grantor')::oid
     or not membership.admin_option or membership.inherit_option or membership.set_option then
   raise exception 'UNEXPECTED_FINAL_MEMBERSHIP_FOR_%',target;
  end if;
  if exists(select 1 from pg_catalog.pg_auth_members where member=target::regrole) then
   raise exception 'UNEXPECTED_PARENT_ROLE_FOR_%',target;
  end if;
  if pg_catalog.pg_has_role(current_user,target,'SET') or pg_catalog.pg_has_role(current_user,target,'USAGE') then
   raise exception 'TEMPORARY_ROLE_ACCESS_NOT_REVOKED_FOR_%',target;
  end if;
  if pg_catalog.has_schema_privilege(target,'player_cloud_private','CREATE') then
   raise exception 'TEMPORARY_SCHEMA_CREATE_NOT_REVOKED_FOR_%',target;
  end if;
  foreach client in array array['anon','authenticated','service_role'] loop
   if pg_catalog.pg_has_role(client,target,'MEMBER')
      or pg_catalog.pg_has_role(client,target,'SET') or pg_catalog.pg_has_role(client,target,'USAGE') then
    raise exception 'CLIENT_ROLE_MEMBERSHIP_FOR_%',target;
   end if;
  end loop;
  if exists(select 1 from pg_catalog.pg_roles where oid=target::regrole
     and (rolcanlogin or rolinherit or rolbypassrls or rolsuper or rolcreaterole or rolcreatedb or rolreplication)) then
   raise exception 'UNEXPECTED_ROLE_ATTRIBUTES_FOR_%',target;
  end if;
 end loop;
 if not exists(select 1 from pg_catalog.pg_proc where oid='player_cloud_private.dispatch(text,jsonb)'::regprocedure
   and proowner='newtone_player_cloud_executor'::regrole and prosecdef)
 or not exists(select 1 from pg_catalog.pg_proc where oid='player_cloud_private.issue_registration_grant()'::regprocedure
   and proowner='newtone_player_registration_issuer'::regrole and prosecdef) then
  raise exception 'PLAYER_CLOUD_DEFINER_OWNER_MISMATCH';
 end if;
end;
$verify_migration_security$;
-- Non-sensitive deployment audit output; preserve with the migration result.
select granted.rolname as granted_role, member.rolname as member_role,
       grantor.rolname as grantor_role,m.admin_option,m.inherit_option,m.set_option
from pg_catalog.pg_auth_members m
join pg_catalog.pg_roles granted on granted.oid=m.roleid
join pg_catalog.pg_roles member on member.oid=m.member
join pg_catalog.pg_roles grantor on grantor.oid=m.grantor
where granted.rolname in ('newtone_player_cloud_executor','newtone_player_registration_issuer')
order by granted.rolname;
commit;
