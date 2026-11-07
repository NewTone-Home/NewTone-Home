-- Forward-only hosted PG17 Auth boundary repair. Local candidate; not executed.
-- Requires the previously installed player cloud schema. Does not modify Auth data.
begin;
do $preflight$
declare m pg_catalog.pg_auth_members%rowtype;
begin
 if current_user<>'postgres' or current_setting('server_version_num')::integer not between 170000 and 179999 then raise exception 'REQUIRES_REVIEWED_PG17_POSTGRES'; end if;
 if not exists(select 1 from pg_catalog.pg_proc where oid='player_cloud_private.dispatch(text,jsonb)'::regprocedure and proowner='newtone_player_cloud_executor'::regrole and prosecdef) then raise exception 'DISPATCH_OWNER_MISMATCH'; end if;
 select * into strict m from pg_catalog.pg_auth_members where roleid='newtone_player_cloud_executor'::regrole;
 if m.member<>current_user::regrole or m.grantor=current_user::regrole or not m.admin_option or m.inherit_option or m.set_option then raise exception 'UNEXPECTED_EXECUTOR_MEMBERSHIP'; end if;
 perform pg_catalog.set_config('newtone_auth_fix.bootstrap_grantor',m.grantor::text,true);
end;
$preflight$;

-- Same UID precedence as auth.uid(); only trusted Data API request settings.
create function player_cloud_private.request_user_id()
returns uuid language sql stable security invoker set search_path='' as $$
 select coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),''),
  (nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid;
$$;
revoke all on function player_cloud_private.request_user_id() from public,anon,authenticated,service_role;
grant execute on function player_cloud_private.request_user_id() to newtone_player_cloud_executor;

-- Narrow broker only: never accepts an arbitrary UID/session or reads player saves.
-- VOLATILE preserves a fresh Auth read when called again after the account row lock.
create function player_cloud_private.auth_context()
returns table(user_id uuid,session_id uuid,created_at timestamptz,latest_session_id uuid)
language plpgsql volatile security definer set search_path='' as $$
declare u uuid:=auth.uid(); sid uuid; born timestamptz; latest uuid;
begin
 if u is null or not exists(select 1 from auth.users a where a.id=u and a.is_anonymous=false) then
  raise exception 'AUTH_REQUIRED' using errcode='42501';
 end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 select s.created_at into born from auth.sessions s where s.id=sid and s.user_id=u;
 if born is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select s.id into latest from auth.sessions s where s.user_id=u and s.created_at is not null order by s.created_at desc,s.id desc limit 1;
 return query select u,sid,born,latest;
end;
$$;
revoke all on function player_cloud_private.auth_context() from public,anon,authenticated,service_role;
grant execute on function player_cloud_private.auth_context() to newtone_player_cloud_executor;

alter policy registration_self_read on player_cloud_private.registration_grants using(user_id=player_cloud_private.request_user_id());
alter policy registration_self_consume on player_cloud_private.registration_grants using(user_id=player_cloud_private.request_user_id()) with check(user_id=player_cloud_private.request_user_id());
alter policy owned on player_cloud_private.accounts using(user_id=player_cloud_private.request_user_id()) with check(user_id=player_cloud_private.request_user_id());
alter policy owned on player_cloud_private.slots using(user_id=player_cloud_private.request_user_id()) with check(user_id=player_cloud_private.request_user_id());
alter policy owned on player_cloud_private.operations using(user_id=player_cloud_private.request_user_id()) with check(user_id=player_cloud_private.request_user_id());
alter policy owned on player_cloud_private.adoptions using(user_id=player_cloud_private.request_user_id()) with check(user_id=player_cloud_private.request_user_id());
alter policy owned on player_cloud_private.backups using(user_id=player_cloud_private.request_user_id()) with check(user_id=player_cloud_private.request_user_id());

-- These old direct column grants cannot pass managed schema/RLS boundaries.
revoke select (id,user_id,created_at) on auth.sessions from newtone_player_cloud_executor;
revoke select (id,is_anonymous) on auth.users from newtone_player_cloud_executor;
grant newtone_player_cloud_executor to current_user with admin false, inherit false, set true granted by current_user;
grant create on schema player_cloud_private to newtone_player_cloud_executor;
set local role newtone_player_cloud_executor;
create or replace function player_cloud_private.dispatch(p_action text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid; sid uuid; born timestamptz; latest uuid;
 a player_cloud_private.accounts%rowtype; s player_cloud_private.slots%rowtype;
 op player_cloud_private.operations%rowtype; adopted player_cloud_private.adoptions%rowtype; saved player_cloud_private.backups%rowtype;
 oid uuid; slot uuid; number smallint; body jsonb; req jsonb; reqhash text; result jsonb;
 expected bigint; stamp timestamptz; k text; v jsonb;
begin
 select c.user_id,c.session_id,c.created_at into u,sid,born from player_cloud_private.auth_context() c;
 if p_args is null or jsonb_typeof(p_args)<>'object' then raise exception 'INVALID_ARGUMENTS'; end if;
 insert into player_cloud_private.accounts(user_id) values(u) on conflict do nothing;
 select * into a from player_cloud_private.accounts where user_id=u for update;
 -- Refresh does not change this server creation order. No client timestamps accepted.
 select c.latest_session_id into latest from player_cloud_private.auth_context() c;
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

set local role postgres;
revoke create on schema player_cloud_private from newtone_player_cloud_executor;
revoke newtone_player_cloud_executor from current_user granted by current_user restrict;
do $verify$
declare m pg_catalog.pg_auth_members%rowtype; client text;
begin
 select * into strict m from pg_catalog.pg_auth_members where roleid='newtone_player_cloud_executor'::regrole;
 if m.member<>current_user::regrole or m.grantor<>current_setting('newtone_auth_fix.bootstrap_grantor')::oid or not m.admin_option or m.inherit_option or m.set_option then raise exception 'UNEXPECTED_FINAL_EXECUTOR_MEMBERSHIP'; end if;
 if exists(select 1 from pg_catalog.pg_auth_members where member='newtone_player_cloud_executor'::regrole)
 or pg_catalog.pg_has_role(current_user,'newtone_player_cloud_executor','SET')
 or pg_catalog.pg_has_role(current_user,'newtone_player_cloud_executor','USAGE')
 or pg_catalog.has_schema_privilege('newtone_player_cloud_executor','player_cloud_private','CREATE') then raise exception 'TEMPORARY_PRIVILEGES_REMAIN'; end if;
 foreach client in array array['anon','authenticated','service_role'] loop
  if pg_catalog.has_function_privilege(client,'player_cloud_private.auth_context()','EXECUTE')
  or pg_catalog.has_function_privilege(client,'player_cloud_private.request_user_id()','EXECUTE')
  or pg_catalog.pg_has_role(client,'newtone_player_cloud_executor','MEMBER') then raise exception 'CLIENT_BROKER_ACCESS'; end if;
 end loop;
 if not exists(select 1 from pg_catalog.pg_proc where oid='player_cloud_private.auth_context()'::regprocedure and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'])
 or not exists(select 1 from pg_catalog.pg_proc where oid='player_cloud_private.request_user_id()'::regprocedure and not prosecdef)
 or not exists(select 1 from pg_catalog.pg_proc where oid='player_cloud_private.dispatch(text,jsonb)'::regprocedure and proowner='newtone_player_cloud_executor'::regrole and prosecdef) then raise exception 'FUNCTION_SECURITY_MISMATCH'; end if;
 if not pg_catalog.has_function_privilege('newtone_player_cloud_executor','player_cloud_private.auth_context()','EXECUTE') then raise exception 'BROKER_NOT_EXECUTABLE'; end if;
end;
$verify$;
commit;
