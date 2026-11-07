-- STAGING ONLY. Review before execution. No email, password, JWT or refresh token.
-- Every synthetic row and role/claims change lives in a rolled-back subtransaction.
-- Real assertion errors escape; ONLY the exact successful-test sentinel is caught.
-- One query/transaction: DO followed by final SELECT; no persistent test objects.
do $contract_test$
declare
 v_u1 uuid:=gen_random_uuid(); v_u2 uuid:=gen_random_uuid(); v_ua uuid:=gen_random_uuid();
 v_s1 uuid:=gen_random_uuid(); v_s2 uuid:=gen_random_uuid(); v_snew uuid:=gen_random_uuid();
 v_slots uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 v_users uuid[]; v_sessions uuid[]; v_allids uuid[];
 v_stamp timestamptz:=clock_timestamp(); v_fence text; v_fence2 text;
 v_raw text; v_raw2 text; v_fp text; v_args jsonb; v_writeargs jsonb; v_r jsonb; v_receipt jsonb;
 v_i integer; v_blocked boolean; v_passed boolean:=false;
 v_original_claims text:=nullif(current_setting('request.jwt.claims',true),'');
 v_original_sub text:=nullif(current_setting('request.jwt.claim.sub',true),'');
begin
 if current_user<>'postgres' then raise exception 'TEST_REQUIRES_POSTGRES'; end if;
 v_users:=array[v_u1,v_u2,v_ua]; v_sessions:=array[v_s1,v_s2,v_snew]; v_allids:=v_users||v_sessions||v_slots;
 if (select count(distinct id) from unnest(v_allids) id)<>cardinality(v_allids) then raise exception 'RANDOM_ID_COLLISION'; end if;
 -- Fail closed; never update/delete any pre-existing principal or slot.
 if exists(select 1 from auth.users where id=any(v_allids))
 or exists(select 1 from auth.sessions where id=any(v_allids) or user_id=any(v_users))
 or exists(select 1 from public.profiles where id=any(v_users))
 or exists(select 1 from public.world_state where user_id=any(v_users))
 or exists(select 1 from public.reader_state where user_id=any(v_users))
 or exists(select 1 from player_cloud_private.accounts where user_id=any(v_users))
 or exists(select 1 from player_cloud_private.slots where slot_id=any(v_slots) or user_id=any(v_users))
 or exists(select 1 from player_cloud_private.registration_grants where user_id=any(v_users)) then raise exception 'RANDOM_ID_ALREADY_EXISTS'; end if;
 begin
  insert into auth.users(id,is_anonymous,created_at,updated_at)
  values(v_u1,false,v_stamp,v_stamp),(v_u2,false,v_stamp,v_stamp),(v_ua,true,v_stamp,v_stamp);
  if (select count(*) from player_cloud_private.registration_grants where user_id=any(v_users))<>2
   or exists(select 1 from player_cloud_private.registration_grants where user_id=v_ua) then raise exception 'ASSERT_INSERT_ONLY_REGISTRATION_GRANT'; end if;
  update auth.users set is_anonymous=false where id=v_ua;
  if exists(select 1 from player_cloud_private.registration_grants where user_id=v_ua) then raise exception 'ASSERT_UPDATE_MUST_NOT_GRANT'; end if;
  insert into auth.sessions(id,user_id,created_at,updated_at) values(v_s1,v_u1,v_stamp,v_stamp),(v_s2,v_u2,v_stamp,v_stamp);
  -- Deliberately structural SQL fixture, not a claim of full PlayerSave validation.
  v_raw:=jsonb_build_object('format','newtone-player-state','formatVersion',1,'saveEpoch','persistent-era-1',
   'localProtocolVersion',2,'generation',jsonb_build_object('id',gen_random_uuid()::text),'localRevision',1,
   'values',jsonb_build_object('newtone-player-save-v1','{}'),'recoveryHolds','[]'::jsonb)::text;
  v_fp:=encode(sha256(convert_to(v_raw,'UTF8')),'hex');
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_u1,'session_id',v_s1,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  v_r:=public.player_cloud_v1('activate','{}'::jsonb); v_fence:=v_r->>'fence';
  if v_r->>'ok' is distinct from 'true' or v_fence is null then raise exception 'ASSERT_ACTIVATE'; end if;
  v_r:=public.player_cloud_v1('list',jsonb_build_object('fence',v_fence));
  if v_r->>'autoAdoptionEligible' is distinct from 'true' or v_r->'slots' is distinct from '[]'::jsonb then raise exception 'ASSERT_NEW_ACCOUNT_ELIGIBILITY'; end if;
  v_args:=jsonb_build_object('fence',v_fence,'operationId',gen_random_uuid(),'slotId',v_slots[1],'payloadRaw',v_raw,'sourceFingerprint',v_fp);
  v_receipt:=public.player_cloud_v1('adopt',v_args);
  if v_receipt->>'ok' is distinct from 'true' or v_receipt->>'revision' is distinct from '1' or v_receipt->>'slotNo' is distinct from '1' then raise exception 'ASSERT_ADOPT'; end if;
  v_r:=public.player_cloud_v1('adopt',v_args);
  if v_r->>'replayed' is distinct from 'true' or v_r-'replayed' is distinct from v_receipt then raise exception 'ASSERT_ADOPT_REPLAY'; end if;
  execute 'set local role postgres';
  if not exists(select 1 from player_cloud_private.registration_grants where user_id=v_u1 and consumed_operation_id=(v_args->>'operationId')::uuid and consumed_at is not null) then raise exception 'ASSERT_GRANT_CONSUMED'; end if;
  execute 'set local role authenticated';
  for v_i in 2..3 loop
   v_r:=public.player_cloud_v1('create',jsonb_build_object('fence',v_fence,'operationId',gen_random_uuid(),'slotId',v_slots[v_i],'slotNo',v_i,'payloadRaw',v_raw,'sourceFingerprint',v_fp));
   if v_r->>'ok' is distinct from 'true' then raise exception 'ASSERT_CREATE_SLOT'; end if;
  end loop;
  v_blocked:=false;
  begin
   perform public.player_cloud_v1('create',jsonb_build_object('fence',v_fence,'operationId',gen_random_uuid(),'slotId',v_slots[4],'slotNo',4,'payloadRaw',v_raw,'sourceFingerprint',v_fp));
  exception when raise_exception then
   if sqlerrm<>'SLOT_LIMIT' then raise; end if; v_blocked:=true;
  end;
  if not v_blocked then raise exception 'ASSERT_FOURTH_SLOT_REJECTED'; end if;
  v_r:=public.player_cloud_v1('list',jsonb_build_object('fence',v_fence));
  if jsonb_array_length(v_r->'slots') is distinct from 3 or v_r->>'autoAdoptionEligible' is distinct from 'false' then raise exception 'ASSERT_THREE_SLOTS'; end if;
  v_raw2:=jsonb_set(v_raw::jsonb,'{localRevision}','2'::jsonb)::text;
  v_writeargs:=jsonb_build_object('fence',v_fence,'operationId',gen_random_uuid(),'slotId',v_slots[1],'expectedRevision','1','payloadRaw',v_raw2,'sourceFingerprint',encode(sha256(convert_to(v_raw2,'UTF8')),'hex'));
  v_receipt:=public.player_cloud_v1('write',v_writeargs);
  if v_receipt->>'ok' is distinct from 'true' or v_receipt->>'revision' is distinct from '2' then raise exception 'ASSERT_CAS_WRITE'; end if;
  v_r:=public.player_cloud_v1('write',v_writeargs);
  if v_r->>'replayed' is distinct from 'true' or v_r-'replayed' is distinct from v_receipt then raise exception 'ASSERT_WRITE_REPLAY'; end if;
  v_r:=public.player_cloud_v1('receipt',jsonb_build_object('fence',v_fence,'operationId',v_writeargs->>'operationId'));
  if v_r->'receipt' is distinct from v_receipt then raise exception 'ASSERT_RECEIPT'; end if;
  v_blocked:=false;
  begin
   perform public.player_cloud_v1('write',v_writeargs||jsonb_build_object('expectedRevision','2'));
  exception when raise_exception then
   if sqlerrm<>'IDEMPOTENCY_MISMATCH' then raise; end if; v_blocked:=true;
  end;
  if not v_blocked then raise exception 'ASSERT_IMMUTABLE_OPERATION'; end if;
  v_r:=public.player_cloud_v1('write',v_writeargs||jsonb_build_object('operationId',gen_random_uuid()));
  if v_r->>'ok' is distinct from 'false' or v_r->>'code' is distinct from 'REVISION_CONFLICT' then raise exception 'ASSERT_STALE_CAS'; end if;
  v_r:=public.player_cloud_v1('read',jsonb_build_object('fence',v_fence,'slotId',v_slots[1]));
  if v_r->>'revision' is distinct from '2' or v_r->>'payloadRaw' is distinct from v_raw2 then raise exception 'ASSERT_NO_STALE_OVERWRITE'; end if;

  -- Owner B cannot observe owner A through the real RPC/role chain.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_u2,'session_id',v_s2,'role','authenticated')::text,true);
  v_r:=public.player_cloud_v1('activate','{}'::jsonb); v_fence2:=v_r->>'fence';
  v_r:=public.player_cloud_v1('list',jsonb_build_object('fence',v_fence2));
  if v_r->'slots' is distinct from '[]'::jsonb then raise exception 'ASSERT_OWNER_LIST'; end if;
  v_blocked:=false;
  begin
   perform public.player_cloud_v1('read',jsonb_build_object('fence',v_fence2,'slotId',v_slots[1]));
  exception when raise_exception then
   if sqlerrm<>'SLOT_NOT_FOUND' then raise; end if; v_blocked:=true;
  end;
  if not v_blocked then raise exception 'ASSERT_CROSS_OWNER_READ'; end if;
  v_r:=public.player_cloud_v1('receipt',jsonb_build_object('fence',v_fence2,'operationId',v_writeargs->>'operationId'));
  if v_r->'receipt' is distinct from 'null'::jsonb then raise exception 'ASSERT_CROSS_OWNER_RECEIPT'; end if;

  -- A genuinely newer synthetic Auth session replaces A's original session.
  execute 'set local role postgres';
  insert into auth.sessions(id,user_id,created_at,updated_at) values(v_snew,v_u1,v_stamp+interval '1 second',v_stamp+interval '1 second');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_u1,'session_id',v_snew,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  v_r:=public.player_cloud_v1('activate','{}'::jsonb);
  if v_r->>'fence' is null or (v_r->>'fence')::bigint<=v_fence::bigint then raise exception 'ASSERT_NEW_SESSION_FENCE'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_u1,'session_id',v_s1,'role','authenticated')::text,true);
  for v_i in 1..3 loop
   v_blocked:=false;
   begin
    perform public.player_cloud_v1(case v_i when 1 then 'renew' when 2 then 'resume' else 'activate' end,jsonb_build_object('fence',v_fence));
   exception when insufficient_privilege then
    if sqlerrm<>'SESSION_REPLACED' then raise; end if; v_blocked:=true;
   end;
   if not v_blocked then raise exception 'ASSERT_OLD_SESSION_CANNOT_RECLAIM'; end if;
  end loop;
  v_passed:=true;
  raise exception using errcode='NT001',message='NEWTONE_SYNTHETIC_TEST_SUCCESS_ROLLBACK';
 exception when sqlstate 'NT001' then
  if sqlerrm<>'NEWTONE_SYNTHETIC_TEST_SUCCESS_ROLLBACK' or not v_passed then raise; end if;
 end;
 -- All role/claims changes above were in the rolled-back child transaction.
 if current_user<>'postgres' or nullif(current_setting('request.jwt.claims',true),'') is distinct from v_original_claims
 or nullif(current_setting('request.jwt.claim.sub',true),'') is distinct from v_original_sub then raise exception 'ASSERT_CONTEXT_NOT_RESTORED'; end if;
 if exists(select 1 from auth.users where id=any(v_users))
 or exists(select 1 from auth.sessions where id=any(v_sessions) or user_id=any(v_users))
 or exists(select 1 from public.profiles where id=any(v_users))
 or exists(select 1 from public.world_state where user_id=any(v_users))
 or exists(select 1 from public.reader_state where user_id=any(v_users))
 or exists(select 1 from player_cloud_private.accounts where user_id=any(v_users))
 or exists(select 1 from player_cloud_private.slots where user_id=any(v_users) or slot_id=any(v_slots))
 or exists(select 1 from player_cloud_private.operations where user_id=any(v_users))
 or exists(select 1 from player_cloud_private.adoptions where user_id=any(v_users))
 or exists(select 1 from player_cloud_private.backups where user_id=any(v_users))
 or exists(select 1 from player_cloud_private.registration_grants where user_id=any(v_users)) then raise exception 'ASSERT_SYNTHETIC_RESIDUE'; end if;
 if not v_passed then raise exception 'ASSERT_TEST_DID_NOT_COMPLETE'; end if;
 perform set_config('newtone_contract_test.result',jsonb_build_object('ok',true,'syntheticRowsRolledBack',true,'zeroResidue',true,
  'checks',jsonb_build_array('insert-only registration','guest adoption and receipt','three-slot quota','CAS write/replay/conflict','cross-owner RPC isolation','old-session fencing'),
  'realLoginTested',false,'emailsSent',false,'tokensIssued',false)::text,true);
end;
$contract_test$;
select current_setting('newtone_contract_test.result')::jsonb as synthetic_contract_test_result;



