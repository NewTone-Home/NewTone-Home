import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../docs/player-account-cloud-candidate.sql',import.meta.url),'utf8');
test('SQL candidate registration grant is issued only on a new nonanonymous Auth insert',()=>{
 expect(sql).toMatch(/create trigger newtone_player_registration_grant\s+after insert on auth\.users for each row/);
 expect(sql).toMatch(/if new\.is_anonymous is false then\s+insert into player_cloud_private\.registration_grants\(user_id\) values\(new\.id\)/);
 expect(sql).not.toMatch(/insert into player_cloud_private\.registration_grants[^;]*select[\s\S]*?from auth\.users/i);
 expect(sql).not.toMatch(/after update on auth\.users/i);
});
test('registration issuer is isolated from browser RPC and cannot grant by user metadata',()=>{
 expect(sql).toContain('create role newtone_player_registration_issuer nologin noinherit');
 expect(sql).toContain('grant insert (user_id) on player_cloud_private.registration_grants to newtone_player_registration_issuer');
 expect(sql).toContain('revoke all on function player_cloud_private.issue_registration_grant() from public,anon,authenticated,newtone_player_cloud_executor');
 expect(sql).not.toMatch(/grant[^;]*(?:insert|all)[^;]*on player_cloud_private\.registration_grants to newtone_player_cloud_executor/i);
 expect(sql).not.toMatch(/user_metadata|raw_user_meta_data/);
});
test('eligibility display and atomic adoption both require the unconsumed grant',()=>{
 expect(sql).toContain("'autoAdoptionEligible',not a.adoption_claimed and result='[]'::jsonb and exists(select 1 from player_cloud_private.registration_grants where user_id=u and consumed_at is null)");
 expect(sql).toContain('update player_cloud_private.registration_grants set consumed_at=stamp,consumed_operation_id=oid where user_id=u and consumed_at is null');
 expect(sql).toMatch(/consumed_at is null;\s+if not found then return jsonb_build_object\('ok',false,'code','EXPLICIT_ADOPTION_REQUIRED'\)/);
 expect(sql.indexOf('consumed_at=stamp')).toBeLessThan(sql.indexOf('insert into player_cloud_private.slots(user_id'));
 expect(sql).toContain('grant update (consumed_at,consumed_operation_id) on player_cloud_private.registration_grants to newtone_player_cloud_executor');
});
test('SQL conflict and historical restore pin current revision/hash and preserve both branches',()=>{
 expect(sql).toContain("if p_action in ('resolve','restore') then");
 expect(sql).toContain("(p_args->>'expectedCloudFingerprint') is distinct from encode(sha256(convert_to(s.payload_raw,'UTF8')),'hex')");
 expect(sql).toContain("'cloud-conflict-snapshot',s.payload,s.payload_raw,stamp");
 expect(sql).toContain("'local-conflict-snapshot',body,p_args->>'payloadRaw',stamp");
 expect(sql).toContain("'chosenPayloadRaw',s.payload_raw,'chosenFingerprint'");
 expect(sql).toContain("where user_id=u and slot_id=slot and operation_id::text||':'||kind=p_args->>'backupId'");
});
test('SQL preserves raw payload/hash authority and makes backup reads owner/slot scoped',()=>{
 expect(sql).toContain('check(payload_raw::jsonb=payload)');
 expect(sql).toContain("if p_action='list_backups' then");expect(sql).toContain("if p_action='read_backup' then");
 expect(sql).toContain("from player_cloud_private.backups where user_id=u and slot_id=(p_args->>'slotId')::uuid");
 expect(sql).not.toMatch(/grant[^;]*delete[^;]*player_cloud_private/i);
});
test('server operation history hashes requests instead of duplicating every checkpoint payload',()=>{
 expect(sql).toContain("request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$')");expect(sql).not.toContain('request jsonb not null');
 expect(sql).toContain("reqhash:=encode(sha256(convert_to(req::text,'UTF8')),'hex')");expect(sql).toContain('if op.request_hash<>reqhash then');expect(sql).toContain('player_cloud_private.operations values(u,oid,reqhash,result)');
});

test('PG17 hosted candidate gates its migration identity and records creator grants before temporary access',()=>{
 expect(sql).toContain("current_setting('server_version_num')::integer not between 170000 and 179999");
 expect(sql).toContain("rolname=current_user and rolcreaterole and not rolsuper");
 expect(sql).toContain("set local createrole_self_grant = '';");
 expect(sql.indexOf('$migration_preflight$;')).toBeLessThan(sql.indexOf('create role newtone_player_cloud_executor'));
 for(const [role,tag] of [['newtone_player_cloud_executor','executor'],['newtone_player_registration_issuer','issuer']]){
  expect(sql).toContain(`set_config('newtone_migration.${tag}_bootstrap_grantor',membership.grantor::text,true)`);
  expect(sql).toContain(`grant ${role} to current_user with admin false, inherit false, set true granted by current_user;`);
  expect(sql).toContain(`revoke ${role} from current_user granted by current_user restrict;`);
  expect(sql.indexOf(`revoke ${role} from current_user`)).toBeLessThan(sql.indexOf('do $verify_migration_security$'));
 }
});
test('definer ACLs and trigger installation finish before ownership transfer',()=>{
 const issuerOwner=sql.indexOf('alter function player_cloud_private.issue_registration_grant() owner to newtone_player_registration_issuer;');
 const executorOwner=sql.indexOf('alter function player_cloud_private.dispatch(text,jsonb) owner to newtone_player_cloud_executor;');
 expect(sql.indexOf('revoke all on function player_cloud_private.issue_registration_grant()')).toBeLessThan(issuerOwner);
 expect(sql.indexOf('create trigger newtone_player_registration_grant')).toBeLessThan(issuerOwner);
 expect(sql.indexOf('revoke all on function player_cloud_private.dispatch(text,jsonb)')).toBeLessThan(executorOwner);
 expect(sql.indexOf('grant execute on function player_cloud_private.dispatch(text,jsonb) to authenticated;')).toBeLessThan(executorOwner);
 expect(sql.slice(issuerOwner)).not.toContain('revoke all on function player_cloud_private.issue_registration_grant()');
 expect(sql.slice(executorOwner)).not.toContain('grant execute on function player_cloud_private.dispatch(text,jsonb)');
});
test('final role assertion permits only captured ADMIN-only creator links, with no client or parent memberships',()=>{
 expect(sql).toContain('select * into strict membership from pg_catalog.pg_auth_members where roleid=target::regrole');
 expect(sql).toContain("membership.grantor<>current_setting('newtone_migration.'||tag||'_bootstrap_grantor')::oid");
 expect(sql).toContain('or not membership.admin_option or membership.inherit_option or membership.set_option');
 expect(sql).toContain('from pg_catalog.pg_auth_members where member=target::regrole');
 expect(sql).toContain("array['anon','authenticated','service_role']");
 expect(sql).toContain("pg_catalog.pg_has_role(client,target,'MEMBER')");
 expect(sql).toContain("pg_catalog.pg_has_role(current_user,target,'SET')");
 expect(sql).toContain('rolcanlogin or rolinherit or rolbypassrls or rolsuper or rolcreaterole or rolcreatedb or rolreplication');
 expect(sql).not.toMatch(/grant newtone_player_(?:cloud_executor|registration_issuer) to (?:authenticated|anon|service_role)/i);
});
test('legacy null creation timestamps cannot mask a valid newest Auth session',()=>{
 expect(sql).toContain('if born is null then');
 expect(sql).toContain('from auth.sessions where user_id=u and created_at is not null order by created_at desc,id desc limit 1');
});

test('disable candidate revokes private dispatcher as its actual owner and removes temporary SET access',()=>{
 const disable=readFileSync(new URL('../docs/player-account-cloud-disable-candidate.sql',import.meta.url),'utf8');
 const assume=disable.indexOf('set local role newtone_player_cloud_executor;');
 const revoke=disable.indexOf('revoke execute on function player_cloud_private.dispatch(text,jsonb)');
 const restore=disable.indexOf('set local role postgres;');
 const cleanup=disable.indexOf('revoke newtone_player_cloud_executor from current_user granted by current_user restrict;');
 expect(disable).toContain('grant newtone_player_cloud_executor to current_user with admin false, inherit false, set true granted by current_user;');
 expect(assume).toBeGreaterThan(-1);expect(assume).toBeLessThan(revoke);expect(revoke).toBeLessThan(restore);expect(restore).toBeLessThan(cleanup);
 expect(disable).toContain('DISABLE_TEMPORARY_ROLE_ACCESS_NOT_REVOKED');expect(disable).toContain('PLAYER_CLOUD_DISABLE_PRIVILEGES_REMAIN_FOR_%');
 expect(disable).not.toMatch(/^\s*(?:drop|truncate|delete)\b/im);
});

test('hosted disable leaves Auth table ownership alone and stops only the issuer-owned handler',()=>{
 const disable=readFileSync(new URL('../docs/player-account-cloud-disable-candidate.sql',import.meta.url),'utf8');
 expect(disable).not.toMatch(/^\s*alter table auth\.users/im);
 expect(disable).not.toMatch(/grant\s+supabase_auth_admin\s+to/i);
 expect(disable).toContain('set local role newtone_player_registration_issuer;');
 expect(disable).toContain('create or replace function player_cloud_private.issue_registration_grant()');
 expect(disable).toContain("returns trigger language plpgsql security definer set search_path=''");
 expect(disable).toContain('as $$ begin return new; end; $$;');
 expect(disable).toContain("and btrim(prosrc)='begin return new; end;'");
 expect(disable).toContain('revoke create on schema player_cloud_private from newtone_player_registration_issuer;');
 expect(disable).toContain('revoke newtone_player_registration_issuer from current_user granted by current_user restrict;');
});

const authFix=readFileSync(new URL('../docs/player-account-auth-context-fix.sql',import.meta.url),'utf8');
test('Auth forward repair keeps broker narrow and dispatch independently owned',()=>{
 expect(authFix).toContain('create function player_cloud_private.auth_context()');
 expect(authFix).toContain("language plpgsql volatile security definer set search_path=''");
 expect(authFix).toContain('where s.id=sid and s.user_id=u');
 expect(authFix).toContain('where s.user_id=u and s.created_at is not null');
 expect(authFix).toContain('from public,anon,authenticated,service_role');
 expect(authFix).toContain('grant execute on function player_cloud_private.auth_context() to newtone_player_cloud_executor');
 expect(authFix).not.toMatch(/grant\s+(?:supabase_auth_admin|authenticated)\s+to/i);
 expect(authFix).not.toMatch(/user_metadata|raw_user_meta_data/);
 const dispatch=authFix.slice(authFix.indexOf('create or replace function player_cloud_private.dispatch('),authFix.indexOf('set local role postgres;'));
 expect(dispatch).not.toMatch(/\bauth\./);
 expect(dispatch.indexOf('for update;')).toBeLessThan(dispatch.indexOf('select c.latest_session_id into latest'));
 expect(authFix).toContain('returns uuid language sql stable security invoker');
 expect(authFix).toContain('revoke newtone_player_cloud_executor from current_user granted by current_user restrict');
 expect(authFix).toContain('revoke select (id,user_id,created_at) on auth.sessions');
});

test('local migration filenames match applied staging versions without SQL changes',()=>{
 expect(readFileSync(new URL('../supabase/migrations/20261107103235_player_account_slots_and_recovery.sql',import.meta.url),'utf8')).toBe(sql);
 expect(readFileSync(new URL('../supabase/migrations/20261107104024_player_account_private_auth_context.sql',import.meta.url),'utf8')).toBe(authFix);
});
