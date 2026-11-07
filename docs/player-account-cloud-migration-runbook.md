Current staging status (2026-11-07): both migrations have been applied and their local filenames aligned to the actual remote versions. See [staging rollout record](player-account-staging-rollout.md). Historical preparation/unexecuted statements below describe the earlier review stage, not current staging. Production is unchanged; frontend and real-login testing remain pending.

# Player cloud migration and safe rollback runbook

## Status and authorization

This is the validation/release plan; the two staging migrations listed in the rollout record are now applied. `player-account-cloud-candidate.sql` now has an identical local copy at `supabase/migrations/20261107103235_player_account_slots_and_recovery.sql`, using the CLI-generated filename supplied by the parent. That migration and its Auth-context forward fix have been executed on staging; the disable script remains unexecuted. No remote Auth calls, SMTP changes, provider credentials, staging writes or deployments are authorized by this document.

Staging reference from project context: `ksrvlkcpaiowhcvzimkc`. Production: `bxowbscoffhmavrccxnm`. Treat them as labels to verify against the selected connection, never as permission to execute. No local psql/Docker/Supabase executable was discovered during this work. Static SQL tests only inspect source structure and cannot prove SQL syntax, role permissions or concurrency behavior.

## 1. Prepare an isolated test database

1. Use a disposable LOCAL Supabase stack, including its real auth schema and roles. Do not use a plain standalone PostgreSQL database with invented Auth tables as the final validation environment. No real user data or credentials should be copied into it.
2. Discover the installed CLI with `supabase --help` and the relevant subcommand `--help` before starting or generating migrations. The Supabase changelog index read on 2026-11-07 includes the 2026-11-04 notice "Supabase CLI v3 is local by default and confirms hosted changes" (https://supabase.com/changelog.md; notice: https://supabase.com/changelog/supabase-cli-v3). This is a documented product change, not a claim about the CLI installed here. Do not reuse remembered hosted flags. Pin the CLI version in the test record. Record PostgreSQL version, Supabase Auth version and supabase-js version.
3. Verify connection host is loopback and port is the confirmed local stack port. Inspect current_database(), current_user, version(), inet_server_addr() and auth.users existence. No production DSN belongs in the test shell. Keep credentials in approved local credential handling, not source files, logs or this document.
4. Apply existing repository migrations locally so owner/admin regressions can be tested. Confirm the proposed schema, executor role, issuer role, public RPC function and Auth trigger names do not already exist. The candidate deliberately does not use IF NOT EXISTS: a partial/conflicting install must fail visibly, not silently reuse a privileged object.
5. Before applying the candidate, create two LOCAL test identities through local Supabase Auth: one permanent user and one anonymous user. Their existence before install is necessary to prove no automatic backfill. Do not send actual email: use local captured-mail/test Auth facilities only.
6. Once psql is installed, the concrete execution form is `psql -X --set=ON_ERROR_STOP=1 --host=127.0.0.1 --port=$env:NEWTONE_LOCAL_DB_PORT --username=postgres --dbname=postgres --file=docs/player-account-cloud-candidate.sql` in PowerShell. Confirm that variable is the verified local port before execution. The SQL already contains BEGIN/COMMIT; do not wrap it in another transaction option. This command is a runbook example and was not run here.
7. A failure must roll back the entire candidate transaction. Inspect object inventory afterward. Do not manually skip a failed GRANT or weaken RLS to make the install pass. Diagnose required installer privileges in the disposable local stack first.

## 2. Required SQL inventory and permission checks

Run these read-only queries locally after candidate installation; capture redacted results in the verification report:

```sql
select current_database(), current_user, version(), inet_server_addr();
select encode(sha256(convert_to('newtone-test','UTF8')),'hex');
select rolname, rolcanlogin, rolinherit, rolbypassrls, rolsuper
from pg_roles where rolname in ('newtone_player_cloud_executor','newtone_player_registration_issuer');
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='player_cloud_private' and c.relkind='r';
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='player_cloud_private';
select n.nspname,p.proname,r.rolname as function_owner,p.prosecdef,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
join pg_roles r on r.oid=p.proowner
where n.nspname='player_cloud_private' or (n.nspname='public' and p.proname='player_cloud_v1');
select tgname,tgenabled from pg_trigger
where tgrelid='auth.users'::regclass and tgname='newtone_player_registration_grant';
select has_function_privilege('anon','public.player_cloud_v1(text,jsonb)','EXECUTE') as anon_rpc,
       has_function_privilege('authenticated','public.player_cloud_v1(text,jsonb)','EXECUTE') as player_rpc,
       has_function_privilege('authenticated','player_cloud_private.issue_registration_grant()','EXECUTE') as player_grant_issuer,
       has_table_privilege('authenticated','player_cloud_private.slots','SELECT') as direct_player_read,
       has_table_privilege('authenticated','player_cloud_private.slots','INSERT') as direct_player_insert,
       has_column_privilege('newtone_player_cloud_executor','player_cloud_private.registration_grants','user_id','INSERT') as executor_can_issue;
select parent.rolname, member.rolname, grantor.rolname as grantor_role, m.admin_option, m.inherit_option, m.set_option
from pg_auth_members m join pg_roles parent on parent.oid=m.roleid
join pg_roles member on member.oid=m.member
join pg_roles grantor on grantor.oid=m.grantor
where parent.rolname in ('newtone_player_cloud_executor','newtone_player_registration_issuer');
```

Expected: both roles NOLOGIN, NOINHERIT, NOBYPASSRLS and nonsuperuser; all player tables have RLS enabled; function executor does not own the tables; private definer functions use empty search_path; wrapper is invoker; issuer trigger enabled only after successful install; anon_rpc false, player_rpc true, player_grant_issuer false, direct table grants false, executor_can_issue false. Role-membership query must return exactly one original bootstrap-issued creator link per new role: member postgres, ADMIN true, SET false, INHERIT false. No additional direct/indirect client memberships or parent-role grants may remain. See the hosted PG17 amendment below; a zero-row expectation is incorrect for a non-superuser CREATEROLE installer. Check Data API exposed schemas separately: player_cloud_private must NOT be exposed. Auth column grants must not accidentally include credentials/refresh tokens. Existing content-admin allowlist and permissions must be unchanged.

## 3. Local Auth and transaction tests (release-blocking)

Use real local Auth sessions, not only fabricated client JWT objects. For pure RLS SQL fixtures, use transaction-local role and JWT claim settings, and roll back fixtures. Do not let synthetic claims escape the disposable test database.

- Registration: old permanent/anonymous users receive zero grants after install. A newly inserted permanent user receives one grant; a new anonymous user receives none. Updating metadata, refreshing tokens and converting an anonymous user do not issue a grant. New Google identity vs linking an existing identity must follow the actual Auth row behavior. Verify actual OTP signup field values, not an assumption that is_anonymous is always populated before INSERT.
- Trigger failures: revoke issuer INSERT in a disposable transaction or use a failing test trigger, attempt local signup, verify Auth/database rollback and useful diagnostics, then restore through rollback. This proves why a faulty production trigger can break signup. Never relax the issuer policy to a browser-callable grant endpoint.
- Ownership: anon, anonymous Auth user, missing/deleted session, different owner and old fence cannot read or mutate slots/backups/receipts. Direct PostgREST access to private tables/schema fails. Player accounts cannot elevate content-admin or membership privileges.
- Three slots: parallel create calls with 20 different IDs yield at most slots 1,2,3. Reusing an operation with different payload is rejected. Retrying identical create after lost response creates one slot only. Concurrent attempts for the same slot number fail without overriding.
- New-registration adoption: grant + empty account + unclaimed flag are all necessary. Old empty users get EXPLICIT_ADOPTION_REQUIRED. Duplicate operation/generation consumes one grant and makes one slot. Inject failure after grant consumption but before slot/receipt commit and verify grant remains unconsumed after rollback. A new account that creates an ordinary slot cannot later use automatic adoption to overwrite it.
- Sessions: A saves; B performs a fresh login and activate; every later A write/renew/resume fails. B's repeated activation or resume keeps its fence. Refresh cannot regain A. B release retains the durable login high-water mark; A does not resurrect even if B's auth.sessions row disappears. Old delayed logout cannot revoke B. Verify a pending A save holding the account lock linearizes before B takeover, never after it.
- CAS/idempotency: two writes at expected revision N produce one revision N+1 and one conflict. Drop response after commit; retry preserves revision. Definite CAS rejection can leave durable client rejection evidence, while a transport timeout must remain pending.
- Conflict choice: inspect pins local raw authority/guard and cloud revision/hash. Changed local data blocks before cloud mutation. Changed cloud hash/revision rejects selection. Both current branches are backed up atomically before either choice. Cloud choice leaves cloud revision unchanged; local choice increments once. Receipt sourceFingerprint identifies input local snapshot; chosenFingerprint/chosenPayloadRaw identify the selected branch. Never confuse them in baseline/restore logic.
- Backups: list/read/restore scope by caller UID AND slot. An unlisted/client-invented backup cannot be substituted in the backend; SQL still independently requires an owned existing backup row. Restoring a server backup CAS-checks current head, backs up current cloud and local branches, increments cloud revision once, and returns the exact chosen payload. There are no delete or retention mutations.
- Fault recovery: lost resolve/restore response; crash before local replacement ledger, after each local replacement write, and after committed replacement but before conflict-token completion. Recovery must reuse original operation/choice and cannot make a second backup pair or overwrite progressed local state. A new token is required after definite CAS rejection. Pending explicit resolution must block ordinary synchronization from overwriting the selected branch.

Run application tests plus actual two-client browser tests against local Supabase. Mock-RPC tests are necessary but not a replacement for these assertions. Record each failure, fix in the candidate, reset only the disposable local environment, and rerun the entire permission/registration suite.

## 4. Prepare a real migration only after validation

1. Run database advisors locally and inspect definer functions, RLS and grants. Review server payload validation, Auth trigger behavior, storage/backup limits, retry retention and rate limiting. Full Reader semantic compatibility and local encryption/privacy remain independent release gates.
2. Have a separate reviewer inspect SQL and the passing local integration log. The new Auth trigger is a signup-critical dependency and deserves explicit approval.
3. Generate the migration using the installed CLI's documented migration workflow (discover via --help; do not invent filename conventions). Keep candidate source and generated migration diff aligned. The parent has now explicitly requested the local copy under its CLI-generated migration filename; both files must remain byte-identical. This does not claim execution or validation.
4. Take a verified backup and record deployment identifiers before any authorized staging rollout. Recheck actual target reference and request specific permission to change staging. No configuration or deployment step in this runbook grants that permission.
5. Stage schema first with the reviewed account frontend disabled/unpublished (`VITE_PLAYER_ACCOUNTS_ENABLED=false` and `VITE_PLAYER_CLOUD_CONFIGURED=false`). Run the real staging smoke suite with approved test accounts only, including signup, takeover and recovery. Then enable the reviewed frontend. Production requires a separate verified rollout decision.

## 5. Non-destructive rollback/incident stop

`docs/player-account-cloud-disable-candidate.sql` is the concrete emergency-stop candidate. It revokes the public and private player RPC EXECUTE grants, replaces only its own registration-grant function with an audited RETURN NEW no-op, leaving the Auth trigger enabled, and fences all active gameplay sessions. It never drops a table, role, policy, backup, receipt, account or Auth user. It too requires target verification and appropriate deployment authorization before use.

Order:

1. Stop admitting new gameplay sessions by rebuilding the reviewed frontend with `VITE_PLAYER_ACCOUNTS_ENABLED=false` and `VITE_PLAYER_CLOUD_CONFIGURED=false`. These are Vite build-time flags: changing deployment environment values without rebuilding is insufficient, and rebuilding does not terminate already-open old tabs. Any fallback release MUST include the claim-aware default guest service from `baa6b78` or a reviewed compatible successor. NEVER roll back to the pre-account raw-localStorage frontend such as baseline staging `998d6bd` after any adoption: it could reopen retained, already-claimed guest data. Preserve browser account storage/queues; never silently remount an account save as a guest save. Server RPC disable/fencing remains authoritative for old tabs.
2. Confirm target/project and operator privileges. Execute the disable script only on the authorized target with ON_ERROR_STOP. Existing in-flight save calls may finish before the row-locking fence update; inspect operation receipts rather than assuming cancellation. Once the update commits, all former fences are invalid.
3. Verify wrapper/private dispatch EXECUTE is false for authenticated/anon; named trigger still points to the issuer-owned SECURITY DEFINER handler and that handler is the audited RETURN NEW no-op; accounts have no active_session and lease_until, and fence advanced. Confirm existing slot/backup/operation row counts have not decreased. Do not log save bodies or credentials.
4. Check ordinary Auth signup works with the grant handler in no-op mode. Users created during this incident window receive no automatic registration grant. Do not backfill them automatically later; require an explicit reviewed recovery/adoption flow.
5. Restore service only with a corrected follow-up migration after the full local test suite. Verify the frontend understands claimed guest ledgers, prepared/committed import and replacement ledgers, acknowledged/compacted queues, and both current/historical backup formats. An incomplete replacement or claimed guest must remain blocked under rollback; an older app that cannot enforce those guards is not a safe fallback. Restore the original grant-handler body (the trigger remained enabled) and regrant only the intended authenticated RPC entries through that reviewed migration. Do not enable all triggers, grant all schema objects, lower RLS or restore stale browser leases.
6. Database backup restoration is a separate, consequential recovery decision; do not automatically rewind live user saves. Keep dual conflict backups and operation receipts for reconciliation. Disable-first is safer than DROP ... CASCADE.

If the initial migration transaction fails before COMMIT, PostgreSQL rollback is the first recovery mechanism; verify object inventory and Auth signup rather than running the disable script against objects that do not exist. The candidate is intentionally all-or-nothing.

### Read-only version and schema preflight gate

Before even local candidate execution, record the result of the following. Stop if compatible_version is false, Auth columns differ, installer lacks role/trigger ownership privileges, or any proposed object already exists. This revision targets hosted PostgreSQL 17 only, including the observed staging 17.11 non-superuser postgres/CREATEROLE path. It is a candidate target, NOT a compatibility guarantee or a claim of SQL validation. PostgreSQL 15 is not supported by this revision: membership SET/INHERIT options and creator-grant semantics are part of the PG17-specific procedure. No PostgreSQL execution validation has occurred in this worker. Exact tested minor versions must go into the release report.

```sql
select current_setting('server_version_num')::integer as version_num,
       (current_setting('server_version_num')::integer between 170000 and 179999) as compatible_version;
select table_schema,table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='auth' and
 ((table_name='users' and column_name in ('id','is_anonymous'))
  or (table_name='sessions' and column_name in ('id','user_id','created_at')))
order by table_name,column_name;
select current_user,r.rolsuper,r.rolcreaterole,
       has_schema_privilege(current_user,'auth','USAGE') as auth_schema_usage,
       has_table_privilege(current_user,'auth.users','TRIGGER') as can_install_auth_trigger
from pg_roles r where r.rolname=current_user;
select nspname from pg_namespace where nspname='player_cloud_private';
select rolname from pg_roles where rolname in ('newtone_player_cloud_executor','newtone_player_registration_issuer');
select to_regprocedure('public.player_cloud_v1(text,jsonb)') as existing_rpc;
select tgname from pg_trigger where tgrelid='auth.users'::regclass and tgname='newtone_player_registration_grant';
```

Expected Auth types: users.id UUID, users.is_anonymous boolean; sessions.id/user_id UUID, sessions.created_at timestamp with time zone. is_anonymous must be explicitly false for grant issuance; null fails closed. ROLE ownership transfer and GRANT permissions must also be tested by the real migration role, not inferred from rolcreaterole alone. Hosted Supabase installer permissions may differ from local superuser permissions; if ALTER FUNCTION OWNER or Auth trigger creation is denied, stop and revise the reviewed migration-role procedure. Do not retain the self-issued temporary SET memberships. The separate bootstrap-issued ADMIN-only creator memberships are expected and audited, not confused with temporary execution access.

There are no cron jobs in this candidate. Emergency stop therefore has no cron disable step; do not disable unrelated project schedules. The entire candidate is create-from-scratch because every earlier phase was unapplied when this amendment was prepared. Verify migration history immediately before any authorized execution. Once applied anywhere, subsequent schema changes require a new explicit forward migration, never rerunning this CREATE-from-scratch script over live objects.

## Hosted PG17 non-superuser ownership amendment (candidate, not executed)

The parent verified staging MCP current_user=postgres with rolsuper=false, rolcreaterole=true, rolbypassrls=true on PG17.11, with neither proposed role already existing. The user approved this staging role/database setup; production is excluded. This worker only edits local candidate artifacts. No SQL, project tests/builds, push or remote changes were executed for this amendment. Earlier test counts do not validate this amendment; new static assertions were written but deliberately not run under the current execution restriction.

Official PostgreSQL 17 sources verified for this revision:

- https://www.postgresql.org/docs/17/role-attributes.html#ROLE-CREATION states a non-superuser CREATEROLE creator receives a grant from the bootstrap superuser equivalent to `WITH ADMIN TRUE, SET FALSE, INHERIT FALSE`. It explicitly states that automatic grant cannot be removed or changed by the CREATEROLE user. ADMIN-only does not grant runtime inheritance or SET ROLE.
- https://www.postgresql.org/docs/17/sql-grant.html documents the independent ADMIN/INHERIT/SET membership options, explicit GRANTED BY, and that ownership transfer requires the ability to SET ROLE to the new owner. A self-grant with ADMIN FALSE does not erase another grantor's ADMIN TRUE grant.
- https://www.postgresql.org/docs/17/sql-alterfunction.html requires both SET ROLE capability to the target owner and CREATE on the containing schema for ALTER FUNCTION OWNER.
- https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-CREATEROLE-SELF-GRANT explains createrole_self_grant. The migration sets it to an empty string transaction-locally so automatic optional SET/INHERIT self-grants cannot vary with the installer session settings.
- https://www.postgresql.org/docs/17/sql-revoke.html documents grantor-scoped role revocation. Only self-issued temporary grants are removed; the candidate never attempts GRANTED BY the bootstrap role.

Minimal transaction ordering:

1. Fail closed unless PG17 and current_user postgres is a non-superuser with CREATEROLE. Set LOCAL createrole_self_grant=''. Role names must not already exist; no old roles or Auth users are altered.
2. Create each NOLOGIN/NOINHERIT role. Immediately assert exactly one creator membership exists, with member=current_user, ADMIN true, SET/INHERIT false and grantor distinct from current_user. Capture that original grantor OID in a transaction-local setting. This avoids guessing the bootstrap role's name or hard-coding an OID.
3. Explicitly self-grant each role `WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER`. This is a separate current-user-issued row; it does not replace the captured bootstrap grant.
4. Define functions while postgres owns them. Revoke default PUBLIC/anon/client EXECUTE and make the narrow dispatcher grant before ownership transfer. Create the Auth INSERT trigger while postgres still owns its trigger function and therefore has the EXECUTE privilege required for trigger creation. Do not rely on non-inherited target-owner privileges after the transfer.
5. Grant temporary schema CREATE to each target role, ALTER FUNCTION OWNER, and revoke schema CREATE. Both SECURITY DEFINER functions end owned by the intended restricted roles, never postgres.
6. Revoke each temporary role link with `GRANTED BY CURRENT_USER RESTRICT`. Do not revoke a different grantor's link or use CASCADE. Assert each role now has exactly the original bootstrap ADMIN-only creator link and no parent-role memberships. Explicitly assert no SET/USAGE for postgres, no MEMBER/SET/USAGE for anon/authenticated/service_role, no schema CREATE, and no elevated role attributes. Assert the final definer owners. Any unexpected state aborts the whole transaction.
7. Return the two grantor/member/option rows as non-sensitive deployment audit output before COMMIT. Retain that output with the migration report. This is not a new credential, public/client grant, or alteration of the existing authenticated administrator account/allowlist.

The former requirement of zero memberships was stronger than PG17 permits this non-superuser installer to establish. The reviewed target is no temporary SET/INHERIT or client access, with explicit audit of only the system-created ADMIN-only relation. The existing database administrator can already administer newly created roles and owns the new tables; this relation is not player authorization. Existing auth.users and content admin records must be compared read-only before/after deployment, without changing them.

The latest-session query now excludes other rows whose created_at is null, matching the existing rejection of the caller's own null timestamp. Otherwise DESC's default NULLS FIRST could let a legacy invalid session mask the newest valid login indefinitely.

The disable candidate handles the post-transfer ownership boundary without assuming ownership of auth.users. The parent confirmed auth.users/auth.sessions owner is supabase_auth_admin, postgres has neither USAGE nor SET on that owner, but it does have the required column grant options and CREATE TRIGGER privilege. The stop script therefore does NOT ALTER the Auth table or grant supabase_auth_admin membership. It temporarily SETs to executor to revoke private dispatch EXECUTE, restores postgres, temporarily grants issuer schema CREATE and SETs to issuer to CREATE OR REPLACE its own trigger function as SECURITY DEFINER with empty search_path and only `BEGIN RETURN NEW; END`. It restores postgres, removes schema CREATE and both self-issued SET memberships, and fences sessions. The trigger remains enabled, but its audited no-op stops registration grants without blocking Auth insertion. Final assertions check the exact no-op body/owner, unchanged trigger binding, endpoint ACLs, ADMIN-only creator relations and revoked execution access. Signup during no-op mode is not automatically backfilled later. Re-enable via a reviewed forward migration restoring the function body, not ALTER auth.users. Neither script was executed in this worker.


For this staging-only attempt, the user chose direct staging login/integration after reviewing the internal-role risk. The parent will execute only after independent review and target checks; this worker does not execute the migration. The full local/transaction/browser matrix above remains an uncompleted validation and production-release checklist, not a claim that those tests ran or a reason to fabricate passing status. Existing Auth administrator and old-data digests are retained by the parent and must be compared after migration. No destructive staging fixtures are authorized by the migration request.

## Forward Auth boundary repair (staging integration finding)

The initial migration was applied to staging as remote version `20261107103235`.
Its original local SQL is retained unchanged. The no-JWT RPC smoke failed before
identity validation because the dedicated executor cannot use managed `auth`.
Parent verified Auth users/sessions also have RLS enabled with no policies, so
column SELECT grants alone would not suffice even with schema USAGE.

`docs/player-account-auth-context-fix.sql` is the reviewed source of the applied staging forward
candidate. It uses the official supported narrow private broker pattern:
https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema-9e32e7

- `request_user_id()` is an invoker JWT-settings helper matching auth.uid UID precedence.
- `auth_context()` is a no-argument, postgres-owned definer with empty search_path.
  It reads only the current JWT user's nonanonymous status, matching session ID /
  creation time, and that same user's latest non-null-created session ID. It does
  not accept an arbitrary user ID or expose email, credentials, or other users.
- Both helper EXECUTEs are revoked from all client roles and PUBLIC; only the
  existing executor receives EXECUTE. The private schema is not an API schema.
- The dispatcher remains executor-owned and player-table RLS remains effective.
  It calls the broker again AFTER locking the account before checking latest login.
- Direct executor Auth column grants are removed; no Auth data/policies/ownership,
  trigger, client role memberships, or credentials are changed.
- Temporary executor SET and schema CREATE are revoked inside the transaction.
  Bootstrap ADMIN-only membership is checked against the original grantor.

Before execution: independently review the forward SQL; confirm its baseline
matches deployed dispatcher and the two new helper names are absent. The local filename was aligned to the actual remote version `20261107104024_player_account_private_auth_context.sql`;
its local migration copy is byte-identical to the forward candidate. After execution, repeat no-JWT authenticated RPC: expect AUTH_REQUIRED,
not permission denied for schema auth. Verify helper ACLs/owners, executor RLS,
no temporary membership/CREATE, and unchanged old-user/data fingerprints.
Authenticated two-user and displaced-session tests remain necessary; no-JWT
smoke alone does not prove them. No project tests/build were run for this fix.

Emergency stop remains the existing disable candidate: revoking dispatcher
EXECUTE blocks the path to this broker. Retain both helpers/data during stop;
neither helper is directly callable by client roles. Do not restore the broken
Auth reads as a rollback and do not grant Auth-admin or authenticated membership.
