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
