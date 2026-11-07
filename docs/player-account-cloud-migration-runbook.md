# Player cloud migration and safe rollback runbook

## Status and authorization

This is a concrete validation/release plan, not an executed migration. `player-account-cloud-candidate.sql` remains outside `supabase/migrations`. Neither that file nor the disable script has been executed against PostgreSQL. No remote Auth calls, SMTP changes, provider credentials, staging writes or deployments are authorized by this document.

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
select parent.rolname, member.rolname
from pg_auth_members m join pg_roles parent on parent.oid=m.roleid
join pg_roles member on member.oid=m.member
where parent.rolname in ('newtone_player_cloud_executor','newtone_player_registration_issuer');
```

Expected: both roles NOLOGIN, NOINHERIT, NOBYPASSRLS and nonsuperuser; all player tables have RLS enabled; function executor does not own the tables; private definer functions use empty search_path; wrapper is invoker; issuer trigger enabled only after successful install; anon_rpc false, player_rpc true, player_grant_issuer false, direct table grants false, executor_can_issue false. Role-membership query must return no members. Check Data API exposed schemas separately: player_cloud_private must NOT be exposed. Auth column grants must not accidentally include credentials/refresh tokens. Existing content-admin allowlist and permissions must be unchanged.

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
3. Generate the migration using the installed CLI's documented migration workflow (discover via --help; do not invent filename conventions). Keep candidate source and generated migration diff aligned. Do not silently add this file to supabase/migrations during design work.
4. Take a verified backup and record deployment identifiers before any authorized staging rollout. Recheck actual target reference and request specific permission to change staging. No configuration or deployment step in this runbook grants that permission.
5. Stage schema first with the reviewed account frontend disabled/unpublished (`VITE_PLAYER_ACCOUNTS_ENABLED=false` and `VITE_PLAYER_CLOUD_CONFIGURED=false`). Run the real staging smoke suite with approved test accounts only, including signup, takeover and recovery. Then enable the reviewed frontend. Production requires a separate verified rollout decision.

## 5. Non-destructive rollback/incident stop

`docs/player-account-cloud-disable-candidate.sql` is the concrete emergency-stop candidate. It revokes the public and private player RPC EXECUTE grants, disables only the named registration-grant trigger, and fences all active gameplay sessions. It never drops a table, role, policy, backup, receipt, account or Auth user. It too requires target verification and appropriate deployment authorization before use.

Order:

1. Stop admitting new gameplay sessions by rebuilding the reviewed frontend with `VITE_PLAYER_ACCOUNTS_ENABLED=false` and `VITE_PLAYER_CLOUD_CONFIGURED=false`. These are Vite build-time flags: changing deployment environment values without rebuilding is insufficient, and rebuilding does not terminate already-open old tabs. Any fallback release MUST include the claim-aware default guest service from `baa6b78` or a reviewed compatible successor. NEVER roll back to the pre-account raw-localStorage frontend such as baseline staging `998d6bd` after any adoption: it could reopen retained, already-claimed guest data. Preserve browser account storage/queues; never silently remount an account save as a guest save. Server RPC disable/fencing remains authoritative for old tabs.
2. Confirm target/project and operator privileges. Execute the disable script only on the authorized target with ON_ERROR_STOP. Existing in-flight save calls may finish before the row-locking fence update; inspect operation receipts rather than assuming cancellation. Once the update commits, all former fences are invalid.
3. Verify wrapper/private dispatch EXECUTE is false for authenticated/anon; named trigger is disabled; accounts have no active_session and lease_until, and fence advanced. Confirm existing slot/backup/operation row counts have not decreased. Do not log save bodies or credentials.
4. Check ordinary Auth signup works with the grant trigger disabled. Users created during this incident window receive no automatic registration grant. Do not backfill them automatically later; require an explicit reviewed recovery/adoption flow.
5. Restore service only with a corrected follow-up migration after the full local test suite. Verify the frontend understands claimed guest ledgers, prepared/committed import and replacement ledgers, acknowledged/compacted queues, and both current/historical backup formats. An incomplete replacement or claimed guest must remain blocked under rollback; an older app that cannot enforce those guards is not a safe fallback. Re-enable the named trigger and regrant only the intended authenticated RPC entries through that reviewed migration. Do not enable all triggers, grant all schema objects, lower RLS or restore stale browser leases.
6. Database backup restoration is a separate, consequential recovery decision; do not automatically rewind live user saves. Keep dual conflict backups and operation receipts for reconciliation. Disable-first is safer than DROP ... CASCADE.

If the initial migration transaction fails before COMMIT, PostgreSQL rollback is the first recovery mechanism; verify object inventory and Auth signup rather than running the disable script against objects that do not exist. The candidate is intentionally all-or-nothing.

### Read-only version and schema preflight gate

Before even local candidate execution, record the result of the following. Stop if compatible_version is false, Auth columns differ, installer lacks role/trigger ownership privileges, or any proposed object already exists. Supabase PostgreSQL 15 and 17 are proposed acceptance-test targets only, NOT a compatibility guarantee or a statement that either version passed this candidate. No PostgreSQL execution validation has occurred in this task. Do not assume any major release is compatible without testing it. Exact tested minor versions must go into the release report.

```sql
select current_setting('server_version_num')::integer as version_num,
       (current_setting('server_version_num')::integer between 150000 and 159999
        or current_setting('server_version_num')::integer between 170000 and 179999) as compatible_version;
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

Expected Auth types: users.id UUID, users.is_anonymous boolean; sessions.id/user_id UUID, sessions.created_at timestamp with time zone. is_anonymous must be explicitly false for grant issuance; null fails closed. ROLE ownership transfer and GRANT permissions must also be tested by the real migration role, not inferred from rolcreaterole alone. Hosted Supabase installer permissions may differ from local superuser permissions; if ALTER FUNCTION OWNER or Auth trigger creation is denied, stop and revise the reviewed migration-role procedure. Do not retain temporary executor/issuer role membership as a workaround.

There are no cron jobs in this candidate. Emergency stop therefore has no cron disable step; do not disable unrelated project schedules. The entire candidate is create-from-scratch because every earlier phase remains unapplied. Once applied anywhere, subsequent schema changes require a new explicit forward migration, never rerunning this CREATE-from-scratch script over live objects.
