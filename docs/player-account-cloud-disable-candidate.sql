-- CANDIDATE ONLY. NOT EXECUTED. PG17 non-superuser postgres path.
-- No DROP/TRUNCATE/DELETE and no ALTER auth.users: preserve old data/Auth ownership.
-- Stop registration grants by replacing ONLY our issuer-owned handler with a NOOP.
begin;
set local createrole_self_grant = '';
do $disable_preflight$
declare membership pg_catalog.pg_auth_members%rowtype; target text; tag text;
begin
 if current_setting('server_version_num')::integer not between 170000 and 179999
    or current_user<>'postgres'
    or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolcreaterole and not rolsuper) then
  raise exception 'PLAYER_CLOUD_DISABLE_REQUIRES_REVIEWED_PG17_POSTGRES';
 end if;
 foreach target in array array['newtone_player_cloud_executor','newtone_player_registration_issuer'] loop
  tag:=case target when 'newtone_player_cloud_executor' then 'executor' else 'issuer' end;
  select * into strict membership from pg_catalog.pg_auth_members where roleid=target::regrole;
  if membership.member<>current_user::regrole or membership.grantor=current_user::regrole
     or not membership.admin_option or membership.inherit_option or membership.set_option then
   raise exception 'UNEXPECTED_DISABLE_CREATOR_MEMBERSHIP_FOR_%',target;
  end if;
  perform pg_catalog.set_config('newtone_migration.disable_'||tag||'_bootstrap_grantor',membership.grantor::text,true);
 end loop;
end;
$disable_preflight$;
revoke execute on function public.player_cloud_v1(text,jsonb) from public,anon,authenticated,service_role;
grant newtone_player_cloud_executor to current_user with admin false, inherit false, set true granted by current_user;
grant newtone_player_registration_issuer to current_user with admin false, inherit false, set true granted by current_user;
set local role newtone_player_cloud_executor;
revoke execute on function player_cloud_private.dispatch(text,jsonb) from public,anon,authenticated,service_role;
set local role postgres;
-- CREATE OR REPLACE needs schema CREATE. No membership in supabase_auth_admin.
grant create on schema player_cloud_private to newtone_player_registration_issuer;
set local role newtone_player_registration_issuer;
create or replace function player_cloud_private.issue_registration_grant()
returns trigger language plpgsql security definer set search_path=''
as $$ begin return new; end; $$;
set local role postgres;
revoke create on schema player_cloud_private from newtone_player_registration_issuer;
revoke newtone_player_registration_issuer from current_user granted by current_user restrict;
revoke newtone_player_cloud_executor from current_user granted by current_user restrict;
-- Wait for in-flight account-row locks, then invalidate their gameplay leases.
update player_cloud_private.accounts set active_session=null,lease_until=null,fence=fence+1;
do $verify_disable_security$
declare membership pg_catalog.pg_auth_members%rowtype; target text; tag text; client text;
begin
 foreach target in array array['newtone_player_cloud_executor','newtone_player_registration_issuer'] loop
  tag:=case target when 'newtone_player_cloud_executor' then 'executor' else 'issuer' end;
  select * into strict membership from pg_catalog.pg_auth_members where roleid=target::regrole;
  if membership.member<>current_user::regrole
     or membership.grantor<>current_setting('newtone_migration.disable_'||tag||'_bootstrap_grantor')::oid
     or not membership.admin_option or membership.inherit_option or membership.set_option then
   raise exception 'UNEXPECTED_FINAL_DISABLE_MEMBERSHIP_FOR_%',target;
  end if;
  if exists(select 1 from pg_catalog.pg_auth_members where member=target::regrole)
     or pg_catalog.pg_has_role(current_user,target,'SET') or pg_catalog.pg_has_role(current_user,target,'USAGE')
     or pg_catalog.has_schema_privilege(target,'player_cloud_private','CREATE') then
   raise exception 'DISABLE_TEMPORARY_ROLE_ACCESS_NOT_REVOKED';
  end if;
  foreach client in array array['anon','authenticated','service_role'] loop
   if pg_catalog.pg_has_role(client,target,'MEMBER')
      or pg_catalog.has_function_privilege(client,'public.player_cloud_v1(text,jsonb)','EXECUTE')
      or pg_catalog.has_function_privilege(client,'player_cloud_private.dispatch(text,jsonb)','EXECUTE') then
    raise exception 'PLAYER_CLOUD_DISABLE_PRIVILEGES_REMAIN_FOR_%',client;
   end if;
  end loop;
 end loop;
 if not exists(select 1 from pg_catalog.pg_proc
    where oid='player_cloud_private.issue_registration_grant()'::regprocedure
      and proowner='newtone_player_registration_issuer'::regrole and prosecdef
      and btrim(prosrc)='begin return new; end;') then
  raise exception 'REGISTRATION_HANDLER_NOT_AUDITED_NOOP';
 end if;
 if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass
    and tgname='newtone_player_registration_grant' and tgenabled in ('O','A')
    and tgfoid='player_cloud_private.issue_registration_grant()'::regprocedure) then
  raise exception 'REGISTRATION_TRIGGER_BINDING_CHANGED';
 end if;
 if exists(select 1 from player_cloud_private.accounts where active_session is not null or lease_until is not null) then
  raise exception 'PLAYER_CLOUD_SESSIONS_NOT_FENCED';
 end if;
end;
$verify_disable_security$;
select granted.rolname as granted_role, member.rolname as member_role,
       grantor.rolname as grantor_role,m.admin_option,m.inherit_option,m.set_option
from pg_catalog.pg_auth_members m
join pg_catalog.pg_roles granted on granted.oid=m.roleid
join pg_catalog.pg_roles member on member.oid=m.member
join pg_catalog.pg_roles grantor on grantor.oid=m.grantor
where granted.rolname in ('newtone_player_cloud_executor','newtone_player_registration_issuer');
commit;
-- Trigger stays enabled but its audited NOOP no longer issues grants or blocks signup.
-- Users created in this window are NOT backfilled. Restore the real handler only
-- through a reviewed forward migration; preserve all operation receipts/fences.
