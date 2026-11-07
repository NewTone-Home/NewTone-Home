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
