-- REVIEWED RUNBOOK CANDIDATE ONLY. NOT EXECUTED. No DROP/TRUNCATE/DELETE.
-- Run only after target verification and explicit deployment/rollback authorization.
-- Prevent new requests and grants while retaining all saves, receipts and backups.
begin;
revoke execute on function public.player_cloud_v1(text,jsonb) from public,anon,authenticated;
revoke execute on function player_cloud_private.dispatch(text,jsonb) from public,anon,authenticated;
alter table auth.users disable trigger newtone_player_registration_grant;
-- Waits for in-flight account-row locks, then invalidates their gameplay leases.
update player_cloud_private.accounts set active_session=null,lease_until=null,fence=fence+1;
commit;
-- Existing users created while the grant trigger is disabled are NOT auto-backfilled.
-- Re-enable only through a reviewed follow-up migration after local Auth tests.
