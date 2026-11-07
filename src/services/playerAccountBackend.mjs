import { createAccountCloudReplaceService } from './accountCloudReplaceService.mjs';
import { readCloudImportRecord } from './accountCloudImportRecord.mjs';
import { validateNew } from './saveMigration.mjs';
import { createPlayerCloudService, createPlayerCloudPayloadFromAuthority, fingerprintPlayerCloudPayload, serializePlayerCloudPayload } from './playerCloudService.mjs';
import { createPlayerCloudQueue } from './playerCloudQueue.mjs';
import { createAccountCloudImportService, authorityFromPortable } from './accountCloudImportService.mjs';
import { createAccountSaveSlots } from './accountSaveSlots.mjs';
import { createSaveEntryService } from './saveEntryService.mjs';
import { WRITER_LOCK, AUTHORITY, GUARD } from './saveEpoch.mjs';
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const fail=error=>({ok:false,code:['QuotaExceededError','NS_ERROR_DOM_QUOTA_REACHED'].includes(error?.name)?'LOCAL_STORAGE_FULL':error instanceof Error?error.message:String(error)});
export const PLAYER_CLOUD_BASELINE_PREFIX='newtone-cloud-baseline:v1:';
export const PLAYER_CONFLICT_PREFIX='newtone-player-conflict:v1:';
/** Composition boundary only. No Auth side effects and no implicit local/cloud conflict resolution. */
export function createPlayerAccountBackend({rpc,storage,locks,getIdentity,uuid=()=>crypto.randomUUID(),now=Date.now,subtle=globalThis.crypto?.subtle,replaceLocal}={}) {
 let identityScope=null;
 function scope(){
  const identity=getIdentity();if(!identity?.ownerId)return null;
  if(!identityScope||identityScope.ownerId!==identity.ownerId||identityScope.sessionEpoch!==identity.sessionEpoch)
   identityScope={ownerId:identity.ownerId,sessionEpoch:identity.sessionEpoch,sessionId:uuid()};
  return identityScope;
 }
 const activeOwner=()=>{const current=scope();assert(current&&cloud.isActive,'CLOUD_SESSION_NOT_ACTIVE');return current.ownerId;};
 const access=({ownerId})=>scope()?.ownerId===ownerId&&cloud.isActive;
 const checkScope=expected=>assert(scope()===expected&&cloud.isActive,'STALE_BACKEND_OPERATION');
 const queue=createPlayerCloudQueue({storage,locks,assertAccess:access,subtle});
 const cloud=createPlayerCloudService({rpc,getScope:scope,persistPending:queue.persistPending,clearPending:queue.clearPending,now});
 const slots=createAccountSaveSlots({storage,locks,assertAccess:access});
 async function executeMutation(request){const result=await cloud.execute(request);if(result?.ok===false&&result.code==='REVISION_CONFLICT')await queue.rejectPending(request,result);return result;}
 async function safe(fn){try{return await fn();}catch(error){return fail(error);}}
 function baseline(slotId){
  const ownerId=activeOwner(),raw=storage.getItem(PLAYER_CLOUD_BASELINE_PREFIX+ownerId+':'+slotId);if(raw===null)return null;
  const record=JSON.parse(raw);assert(record.version===1&&record.ownerId===ownerId&&record.slotId===slotId&&/^[1-9][0-9]*$/.test(record.cloudRevision)&&/^[0-9a-f]{64}$/.test(record.sourceFingerprint),'INVALID_CLOUD_BASELINE');return record;
 }
 function saveBaseline(slotId,cloudRevision,sourceFingerprint,operationId){
  const ownerId=activeOwner(),previous=baseline(slotId);assert(/^[1-9][0-9]*$/.test(cloudRevision)&&/^[0-9a-f]{64}$/.test(sourceFingerprint),'INVALID_CLOUD_BASELINE');
  if(previous&&BigInt(previous.cloudRevision)>BigInt(cloudRevision))return;
  if(previous&&previous.cloudRevision===cloudRevision){assert(previous.sourceFingerprint===sourceFingerprint,'CLOUD_BASELINE_MISMATCH');return;}
  const key=PLAYER_CLOUD_BASELINE_PREFIX+ownerId+':'+slotId,raw=JSON.stringify({version:1,ownerId,slotId,cloudRevision,sourceFingerprint,operationId});
  storage.setItem(key,raw);assert(storage.getItem(key)===raw,'CLOUD_BASELINE_WRITE_UNCERTAIN');assert(access({ownerId}),'ACCOUNT_ACCESS_DENIED');
 }
 async function acknowledgeBaseline(request,receipt){
  if(request.action==='release')return;
  assert(receipt.ownerId===request.ownerId&&receipt.operationId===request.parameters.operationId&&receipt.slotId===request.parameters.slotId&&receipt.sourceFingerprint===request.parameters.sourceFingerprint,'INVALID_CLOUD_RECEIPT');
  saveBaseline(receipt.slotId,receipt.revision,['resolve','restore'].includes(request.action)?receipt.chosenFingerprint:receipt.sourceFingerprint,receipt.operationId);
  if(request.action==='write')await queue.compactAcknowledgedWrites(request.ownerId,record=>{
   const base=baseline(record.request.parameters.slotId),ack=record.acknowledgement;
   return !!base&&ack?.ok===true&&ack.ownerId===request.ownerId&&ack.slotId===record.request.parameters.slotId&&ack.operationId===record.request.parameters.operationId&&ack.sourceFingerprint===record.request.parameters.sourceFingerprint&&/^[1-9][0-9]*$/.test(ack.revision)&&BigInt(base.cloudRevision)>=BigInt(ack.revision)&&(base.cloudRevision!==ack.revision||base.sourceFingerprint===ack.sourceFingerprint);
  });
 }
 async function reconcileReceipts(){
  const ownerId=activeOwner(),expectedScope=scope();
  for(const record of queue.listPending(ownerId)){
   const result=await cloud.getReceipt(record.request.parameters.operationId);if(!result.ok)return result;checkScope(expectedScope);
   if(result.receipt){
    const receipt=result.receipt;assert(receipt.ok===true,'INVALID_CLOUD_RECEIPT');
    if(record.request.action!=='release')assert(receipt.ownerId===ownerId&&receipt.operationId===record.request.parameters.operationId,'INVALID_CLOUD_RECEIPT');
    await acknowledgeBaseline(record.request,receipt);
    await queue.clearPending(record.request,receipt);
   }
  }
  for(const record of queue.listAcknowledged(ownerId))await acknowledgeBaseline(record.request,record.acknowledgement);
  return {ok:true,pendingOperations:queue.listPending(ownerId).map(x=>x.request.parameters.operationId)};
 }
 async function openSession({origin}={}){return safe(async()=>{
  assert(origin==='login'||origin==='restored','INVALID_SESSION_ORIGIN');
  const result=await (origin==='login'?cloud.activateAfterExplicitLogin():cloud.resumeExistingSession());
  if(!result.ok)return result;const recovery=await reconcileReceipts();return recovery.ok?{...result,pendingOperations:recovery.pendingOperations}:recovery;
 });}
 function priorRequest(operationId){const ownerId=activeOwner();return [...queue.listPending(ownerId),...queue.listAcknowledged(ownerId)].find(x=>x.request.parameters.operationId===operationId)?.request;}
 function requestFor(action,parameters){
  const prior=priorRequest(parameters.operationId);
  if(prior){assert(prior.action===action&&Object.entries(parameters).every(([key,value])=>prior.parameters[key]===value),'CLOUD_OPERATION_REQUEST_MISMATCH');return prior;}
  assert(queue.listPending(activeOwner()).length===0,'PENDING_CLOUD_OPERATION');
  return cloud.prepare(action,parameters);
 }
 async function adoptGuest({slotId,operationId,portableRaw,sourceFingerprint}){return safe(()=>executeMutation(requestFor('adopt',{slotId,operationId,payloadRaw:portableRaw,sourceFingerprint})));}
 async function canonicalCloud(slotId){
  const read=await cloud.readSlot(slotId);if(!read.ok)return read;
  assert(read.slotId===slotId&&typeof read.revision==='string'&&/^[1-9][0-9]*$/.test(read.revision),'INVALID_CLOUD_SLOT');
  const encoded=await fingerprintPlayerCloudPayload(read.payload,subtle);activeOwner();
  if(read.payloadRaw!==undefined)assert(read.payloadRaw===encoded.payloadRaw&&read.sourceFingerprint===encoded.sourceFingerprint,'INVALID_CLOUD_CANONICAL_PAYLOAD');
  return {...read,...encoded};
 }
 async function ensureLocalSlot(slotId){return safe(async()=>{
    const ownerId=activeOwner(),expectedScope=scope(),guard=({ownerId:owner})=>scope()===expectedScope&&access({ownerId:owner});
  const recovery=await reconcileReceipts();if(!recovery.ok)return recovery;checkScope(expectedScope);
  for(const record of queue.listPending(ownerId)){
   if(record.request.action!=='write'||record.request.parameters.slotId!==slotId)return {ok:false,code:'PENDING_CLOUD_OPERATION'};
   const retried=await executeMutation(record.request);if(!retried.ok)return retried;checkScope(expectedScope);await acknowledgeBaseline(record.request,retried);
  }
  const pendingDecision=findPendingResolution(ownerId,slotId);if(pendingDecision)return {ok:false,code:'CONFLICT_RESOLUTION_PENDING',token:pendingDecision.record.token,choice:pendingDecision.record.choice};
  const read=await canonicalCloud(slotId);if(!read.ok)return read;checkScope(expectedScope);
  const listed=slots.listSlots(ownerId),existing=listed.find(x=>x.slotId===slotId);
  let operationId=existing?.cloudImportOperationId??uuid();
  if(existing){
   let view;
   try{view=createAccountSaveSlots({storage,locks,assertAccess:guard}).openStorage({ownerId,slotId});}
   catch(error){if(error.message!=='CLOUD_IMPORT_RECOVERY_REQUIRED'&&!(existing.cloudImportOperationId&&error.message==='ACCOUNT_SLOT_MISSING'))throw error;}
   if(view){
    const manager=locks??globalThis.navigator?.locks;assert(manager?.request,'LOCKING_UNAVAILABLE');
    return manager.request(WRITER_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
     assert(lock,'ANOTHER_SESSION_ACTIVE');checkScope(expectedScope);
     const exported=await createSaveEntryService({storage:view,locks}).exportCurrentSave();
     assert(exported.status==='exported',exported.reasonCodes?.[0]??'LOCAL_SAVE_NOT_EXPORTABLE');
     const localPayload=createPlayerCloudPayloadFromAuthority(exported.snapshot);
     const local=await fingerprintPlayerCloudPayload(localPayload,subtle);
     checkScope(expectedScope);
     assert(view.getItem(AUTHORITY)===exported.authorityRaw&&view.getItem(GUARD)===exported.guardRaw,'LOCAL_SAVE_CHANGED_DURING_SYNC');
     assert(access({ownerId}),'ACCOUNT_ACCESS_DENIED');
          const equalContent=serializePlayerCloudPayload({...localPayload,localRevision:0})===serializePlayerCloudPayload({...read.payload,localRevision:0});
     if(!equalContent){
      const base=baseline(slotId);
      if(!base||base.cloudRevision!==read.revision)return {ok:false,code:'LOCAL_CLOUD_CONFLICT',slotId,cloudRevision:read.revision,localFingerprint:local.sourceFingerprint,cloudFingerprint:read.sourceFingerprint};
      const request=requestFor('write',{slotId,operationId:uuid(),expectedRevision:read.revision,...local});
      const receipt=await executeMutation(request);if(!receipt.ok)return receipt;checkScope(expectedScope);await acknowledgeBaseline(request,receipt);
      return {ok:true,status:'synced',slotId,cloudRevision:receipt.revision,sourceFingerprint:receipt.sourceFingerprint};
     }
     saveBaseline(slotId,read.revision,read.sourceFingerprint,operationId);
     return {ok:true,status:'ready',slotId,cloudRevision:read.revision,sourceFingerprint:read.sourceFingerprint};
    });
   }
  }
  // A reservation may precede metadata; listSlots supplies its stable import UUID.
  const importer=createAccountCloudImportService({storage,locks,assertAccess:guard,now,subtle,verifyCloudSnapshot:async candidate=>{
   if(!guard(candidate))return false;const latest=await canonicalCloud(candidate.slotId);
   return latest.ok&&latest.revision===candidate.cloudRevision&&latest.payloadRaw===candidate.payloadRaw&&latest.sourceFingerprint===candidate.sourceFingerprint&&guard(candidate);
  }});
  const installed=await importer.install({ownerId,slotId,operationId,cloudRevision:read.revision,payloadRaw:read.payloadRaw,sourceFingerprint:read.sourceFingerprint});
  saveBaseline(slotId,read.revision,read.sourceFingerprint,operationId);
  return {ok:true,...installed};
 });}
 async function createSlot({slotId,operationId,payloadRaw,sourceFingerprint}){return safe(async()=>{
  const expectedScope=scope(),prior=priorRequest(operationId);let request;
  if(prior)request=requestFor('create',{slotId,operationId,payloadRaw,sourceFingerprint});
  else{
   assert(queue.listPending(activeOwner()).length===0,'PENDING_CLOUD_OPERATION');const listed=await cloud.listSlots();if(!listed.ok)return listed;checkScope(expectedScope);
   const slotNo=[1,2,3].find(n=>!listed.slots.some(s=>s.slotNo===n));if(!slotNo)return {ok:false,code:'SLOT_LIMIT'};
   request=requestFor('create',{slotId,operationId,slotNo,payloadRaw,sourceFingerprint});
  }
  const receipt=await executeMutation(request);if(!receipt.ok)return receipt;checkScope(expectedScope);
  assert(receipt.ownerId===activeOwner()&&receipt.slotId===slotId&&receipt.operationId===operationId&&receipt.sourceFingerprint===sourceFingerprint,'INVALID_CLOUD_RECEIPT');
  const local=await ensureLocalSlot(slotId);return local.ok?{...receipt,local}:{ok:false,code:local.code,cloudCommitted:true,receipt,local};
 });}
 async function recoverPendingCreate(){return safe(async()=>{
  const ownerId=activeOwner(),expectedScope=scope(),recovery=await reconcileReceipts();if(!recovery.ok)return recovery;checkScope(expectedScope);
  const pending=queue.listPending(ownerId);
  const otherPending=pending.some(record=>record.request.action!=='create');
  if(otherPending){
   if(pending.some(record=>record.request.action==='create'))return {ok:false,code:'PENDING_CLOUD_OPERATION'};
   return {ok:true,recovered:false,pendingOther:true};
  }
  let record=pending.find(item=>item.request.action==='create');
  if(!record){
   const existing=slots.listSlots(ownerId);
      record=queue.listAcknowledged(ownerId).find(item=>{
    if(item.request.action!=='create')return false;
    const slot=existing.find(slot=>slot.slotId===item.request.parameters.slotId);
    return !slot||(slot.cloudImportOperationId&&readCloudImportRecord(storage,ownerId,slot.slotId,slot.cloudImportOperationId)?.record.phase!=='committed');
   });
  }
  if(!record)return {ok:true,recovered:false};
  const request=record.request;let receipt=record.acknowledgement;
  if(record.phase==='pending'){receipt=await executeMutation(request);if(!receipt.ok)return receipt;checkScope(expectedScope);}
  await acknowledgeBaseline(request,receipt);
  const local=await ensureLocalSlot(request.parameters.slotId);if(!local.ok)return {...local,cloudCommitted:true,receipt};
  return {ok:true,recovered:true,slotId:request.parameters.slotId,receipt,local};
 });}
 async function markAdoptedSlot(receipt,sourceFingerprint){return safe(async()=>{
  const ownerId=activeOwner(),expectedScope=scope();assert(receipt?.ownerId===ownerId&&receipt.sourceFingerprint===sourceFingerprint,'INVALID_ADOPTION_RECEIPT');
  const verified=await cloud.getReceipt(receipt.operationId);if(!verified.ok)return verified;checkScope(expectedScope);
  assert(verified.receipt?.ok===true&&['ownerId','slotId','operationId','sourceFingerprint','revision'].every(key=>verified.receipt[key]===receipt[key]),'INVALID_ADOPTION_RECEIPT');
  saveBaseline(receipt.slotId,receipt.revision,sourceFingerprint,receipt.operationId);
  return {ok:true};
 });}
 async function syncSnapshot(slotId,{payloadRaw,sourceFingerprint}){return safe(async()=>{
  const ownerId=activeOwner(),expectedScope=scope(),payload=JSON.parse(payloadRaw);
  const pendingDecision=findPendingResolution(ownerId,slotId);if(pendingDecision)return {ok:false,code:'CONFLICT_RESOLUTION_PENDING',token:pendingDecision.record.token,choice:pendingDecision.record.choice};
  assert(payload.format==='newtone-player-state'&&payload.formatVersion===1,'UNSUPPORTED_CLOUD_FORMAT');
  const normalized=createPlayerCloudPayloadFromAuthority({saveEpoch:payload.saveEpoch,protocolVersion:payload.localProtocolVersion,revision:payload.localRevision,generation:payload.generation,values:payload.values,recoveryHolds:payload.recoveryHolds});
  const verified=await fingerprintPlayerCloudPayload(normalized,subtle);checkScope(expectedScope);
  assert(verified.payloadRaw===payloadRaw&&verified.sourceFingerprint===sourceFingerprint,'INVALID_SNAPSHOT_FINGERPRINT');
  validateNew(JSON.parse(payload.values['newtone-player-save-v1']));
  const recovery=await reconcileReceipts();if(!recovery.ok)return recovery;checkScope(expectedScope);
  const pending=queue.listPending(ownerId);
  if(pending.length){
   const original=pending[0].request;
   if(pending.length!==1||original.action!=='write'||original.parameters.slotId!==slotId||original.parameters.payloadRaw!==payloadRaw||original.parameters.sourceFingerprint!==sourceFingerprint)return {ok:false,code:'PENDING_CLOUD_OPERATION'};
   const result=await executeMutation(original);if(result.ok){checkScope(expectedScope);await acknowledgeBaseline(original,result);}return result;
  }
  const read=await canonicalCloud(slotId);if(!read.ok)return read;checkScope(expectedScope);
  const equalContent=serializePlayerCloudPayload({...payload,localRevision:0})===serializePlayerCloudPayload({...read.payload,localRevision:0});
  if(equalContent){saveBaseline(slotId,read.revision,read.sourceFingerprint,uuid());return {ok:true,status:'unchanged',slotId,cloudRevision:read.revision,sourceFingerprint:read.sourceFingerprint};}
  const base=baseline(slotId);
  if(!base||base.cloudRevision!==read.revision)return {ok:false,code:'LOCAL_CLOUD_CONFLICT',slotId,cloudRevision:read.revision,localFingerprint:sourceFingerprint,cloudFingerprint:read.sourceFingerprint};
  const request=requestFor('write',{slotId,operationId:uuid(),expectedRevision:read.revision,payloadRaw,sourceFingerprint});
  const result=await executeMutation(request);if(!result.ok)return result;checkScope(expectedScope);await acknowledgeBaseline(request,result);
  return {ok:true,status:'synced',slotId,cloudRevision:result.revision,sourceFingerprint:result.sourceFingerprint};
 });}
 function conflictKey(ownerId,token){assert(/^[0-9a-f-]{36}$/.test(token??''),'INVALID_CONFLICT_TOKEN');return PLAYER_CONFLICT_PREFIX+ownerId+':'+token;}
 function readConflict(ownerId,token){
  const key=conflictKey(ownerId,token),raw=storage.getItem(key);assert(raw!==null,'CONFLICT_TOKEN_NOT_FOUND');
  const record=JSON.parse(raw);assert(record.version===1&&record.ownerId===ownerId&&record.token===token&&['inspected','resolving','resolved','superseded'].includes(record.phase),'INVALID_CONFLICT_RECORD');
  return {key,raw,record};
 }
 function findPendingResolution(ownerId,slotId){
  const prefix=PLAYER_CONFLICT_PREFIX+ownerId+':';
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix)){const entry=readConflict(ownerId,key.slice(prefix.length));if(entry.record.slotId===slotId&&entry.record.phase==='resolving')return entry;}}
  return null;
 }
 function persistConflict(entry,record){
  assert(storage.getItem(entry.key)===entry.raw,'CONFLICT_RECORD_CHANGED');
  const raw=JSON.stringify(record);storage.setItem(entry.key,raw);assert(storage.getItem(entry.key)===raw,'CONFLICT_WRITE_UNCERTAIN');return {key:entry.key,raw,record};
 }
 function conflictSummary(payloadRaw){
  const p=JSON.parse(payloadRaw),player=JSON.parse(p.values['newtone-player-save-v1']);
  return {generationId:p.generation.id,localRevision:p.localRevision,currentSceneId:player.currentSceneId,storyClock:player.storyClock,gameTimeMs:player.gameTimeMs,updatedAt:player.updatedAt};
 }
 function publicConflict(record){
  const conflict={slotId:record.slotId,token:record.token,pendingChoice:record.choice??null,
   local:{payloadRaw:record.localRaw,sourceFingerprint:record.localFingerprint,summary:conflictSummary(record.localRaw)},
   cloud:{payloadRaw:record.cloudRaw,sourceFingerprint:record.cloudFingerprint,revision:record.cloudRevision,summary:conflictSummary(record.cloudRaw)}};
  return {ok:true,...conflict,conflict};
 }
 async function inspectConflict(slotId){return safe(async()=>{
  const ownerId=activeOwner(),expectedScope=scope(),pending=findPendingResolution(ownerId,slotId);if(pending)return publicConflict(pending.record);
  const manager=locks??globalThis.navigator?.locks;assert(manager?.request,'LOCKING_UNAVAILABLE');
  return manager.request(WRITER_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
   assert(lock,'ANOTHER_SESSION_ACTIVE');checkScope(expectedScope);
   const guard=({ownerId:owner})=>scope()===expectedScope&&access({ownerId:owner});
   const view=createAccountSaveSlots({storage,locks,assertAccess:guard}).openStorage({ownerId,slotId});
   const exported=await createSaveEntryService({storage:view,locks}).exportCurrentSave();assert(exported.status==='exported',exported.reasonCodes?.[0]??'LOCAL_SAVE_NOT_EXPORTABLE');
   const local=await fingerprintPlayerCloudPayload(createPlayerCloudPayloadFromAuthority(exported.snapshot),subtle);
   const remote=await canonicalCloud(slotId);if(!remote.ok)return remote;checkScope(expectedScope);
   const token=uuid();authorityFromPortable(remote.payload,token,remote.sourceFingerprint);
   assert(view.getItem(AUTHORITY)===exported.authorityRaw&&view.getItem(GUARD)===exported.guardRaw,'LOCAL_SAVE_CHANGED_DURING_INSPECTION');
   const record={version:1,ownerId,slotId,token,phase:'inspected',expectedAuthorityRaw:exported.authorityRaw,expectedGuardRaw:exported.guardRaw,localRaw:local.payloadRaw,localFingerprint:local.sourceFingerprint,cloudRaw:remote.payloadRaw,cloudFingerprint:remote.sourceFingerprint,cloudRevision:remote.revision};
   const key=conflictKey(ownerId,token);assert(storage.getItem(key)===null,'CONFLICT_TOKEN_COLLISION');persistConflict({key,raw:null},record);
   return publicConflict(record);
  });
 });}
 async function listBackups(slotId){return safe(async()=>{
  const expectedScope=scope(),listed=await cloud.listBackups(slotId);if(!listed.ok)return listed;checkScope(expectedScope);
  assert(listed.slotId===slotId&&Array.isArray(listed.backups),'INVALID_BACKUP_LIST');
  const inspected=await inspectConflict(slotId);if(!inspected.ok)return inspected;checkScope(expectedScope);
  const entry=readConflict(activeOwner(),inspected.token);assert(entry.record.phase==='inspected','CONFLICT_RESOLUTION_PENDING');
  persistConflict(entry,{...entry.record,backupIds:listed.backups.map(b=>b.backupId)});
  return {ok:true,slotId,token:inspected.token,backups:listed.backups};
 });}
 async function validateResolutionReceipt(record,receipt){
  assert(receipt?.ok===true&&receipt.ownerId===record.ownerId&&receipt.slotId===record.slotId&&receipt.operationId===record.request.parameters.operationId&&receipt.sourceFingerprint===record.localFingerprint&&receipt.choice===record.choice,'INVALID_RESOLUTION_RECEIPT');
  if(record.choice==='backup')assert(receipt.backupId===record.backupId,'INVALID_RESOLUTION_RECEIPT');
  assert(receipt.chosenPayloadRaw===record.chosenExpectedRaw&&receipt.chosenFingerprint===record.chosenExpectedFingerprint,'INVALID_RESOLUTION_CHOICE');
  assert(Array.isArray(receipt.backupKinds)&&['cloud-conflict-snapshot','local-conflict-snapshot'].every(k=>receipt.backupKinds.includes(k)),'RESOLUTION_BACKUPS_MISSING');
  const parsed=JSON.parse(receipt.chosenPayloadRaw),hash=await fingerprintPlayerCloudPayload(parsed,subtle);
  assert(hash.payloadRaw===receipt.chosenPayloadRaw&&hash.sourceFingerprint===receipt.chosenFingerprint,'INVALID_RESOLUTION_FINGERPRINT');
  authorityFromPortable(parsed,receipt.operationId,receipt.chosenFingerprint);
  return receipt;
 }
 async function performResolution({slotId,token,choice,backupId}){return safe(async()=>{
  const ownerId=activeOwner(),expectedScope=scope();assert(['local','cloud','backup'].includes(choice),'INVALID_CONFLICT_CHOICE');
  let entry=readConflict(ownerId,token);assert(entry.record.slotId===slotId,'CONFLICT_TOKEN_SCOPE_MISMATCH');
  if(entry.record.choice!==undefined)assert(entry.record.choice===choice&&entry.record.backupId===backupId,'CONFLICT_CHOICE_ALREADY_COMMITTED');
  if(entry.record.phase==='superseded')return {ok:false,code:'CONFLICT_SNAPSHOT_SUPERSEDED',slotId,token};
  if(entry.record.phase==='resolved')return {ok:true,status:'resolved',slotId,token,receipt:entry.record.receipt};
  const manager=locks??globalThis.navigator?.locks;assert(manager?.request,'LOCKING_UNAVAILABLE');
  const prepared=await manager.request(WRITER_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
   assert(lock,'ANOTHER_SESSION_ACTIVE');checkScope(expectedScope);entry=readConflict(ownerId,token);
   if(entry.record.request){
    const known=await cloud.getReceipt(entry.record.request.parameters.operationId);if(!known.ok)return known;checkScope(expectedScope);
    if(known.receipt){await validateResolutionReceipt(entry.record,known.receipt);checkScope(expectedScope);return {ok:true,entry,receipt:known.receipt};}
   }
   const guard=({ownerId:owner})=>scope()===expectedScope&&access({ownerId:owner});
   const view=createAccountSaveSlots({storage,locks,assertAccess:guard}).openStorage({ownerId,slotId});
   assert(view.getItem(AUTHORITY)===entry.record.expectedAuthorityRaw&&view.getItem(GUARD)===entry.record.expectedGuardRaw,'LOCAL_SAVE_CHANGED_SINCE_INSPECTION');
   if(!entry.record.request){
    let chosenExpectedRaw=choice==='local'?entry.record.localRaw:entry.record.cloudRaw;
    let chosenExpectedFingerprint=choice==='local'?entry.record.localFingerprint:entry.record.cloudFingerprint;
    if(choice==='backup'){
     assert(entry.record.backupIds?.includes(backupId),'BACKUP_NOT_LISTED_FOR_TOKEN');
     const historical=await cloud.readBackup(slotId,backupId);if(!historical.ok)return historical;checkScope(expectedScope);
     assert(historical.slotId===slotId&&historical.backupId===backupId,'INVALID_BACKUP_RECEIPT');
     const encoded=await fingerprintPlayerCloudPayload(historical.payload,subtle);checkScope(expectedScope);
     assert(encoded.payloadRaw===historical.payloadRaw&&encoded.sourceFingerprint===historical.sourceFingerprint,'INVALID_BACKUP_FINGERPRINT');
     authorityFromPortable(historical.payload,token,encoded.sourceFingerprint);chosenExpectedRaw=encoded.payloadRaw;chosenExpectedFingerprint=encoded.sourceFingerprint;
    }
    const operationId=uuid(),parameters={slotId,operationId,expectedRevision:entry.record.cloudRevision,expectedCloudFingerprint:entry.record.cloudFingerprint,payloadRaw:entry.record.localRaw,sourceFingerprint:entry.record.localFingerprint,...(choice==='backup'?{backupId}:{choice})};
    // Explicit conflict intent supersedes no unresolved operation: first recover that original request.
    const request=requestFor(choice==='backup'?'restore':'resolve',parameters);
    entry=persistConflict(entry,{...entry.record,phase:'resolving',choice,...(backupId===undefined?{}:{backupId}),chosenExpectedRaw,chosenExpectedFingerprint,request});
   }
   const receipt=await executeMutation(entry.record.request);if(!receipt.ok){if(receipt.code==='REVISION_CONFLICT')entry=persistConflict(entry,{...entry.record,phase:'superseded'});return {...receipt,token,choice};}checkScope(expectedScope);
   await validateResolutionReceipt(entry.record,receipt);checkScope(expectedScope);return {ok:true,entry,receipt};
  });
  if(!prepared.ok)return prepared;checkScope(expectedScope);entry=prepared.entry;
  const receipt=prepared.receipt,params={ownerId,slotId,operationId:receipt.operationId,expectedAuthorityRaw:entry.record.expectedAuthorityRaw,expectedGuardRaw:entry.record.expectedGuardRaw,payloadRaw:receipt.chosenPayloadRaw,sourceFingerprint:receipt.chosenFingerprint,cloudRevision:receipt.revision};
  const assertAccess=({ownerId:owner})=>scope()===expectedScope&&access({ownerId:owner});
  const verifyResolution=async candidate=>{
   checkScope(expectedScope);assert(Object.keys(params).every(key=>candidate[key]===params[key]),'RESOLUTION_REPLACEMENT_BINDING_MISMATCH');
   const verified=await cloud.getReceipt(receipt.operationId);if(!verified.ok)return false;checkScope(expectedScope);await validateResolutionReceipt(entry.record,verified.receipt);checkScope(expectedScope);return true;
  };
  const replaced=replaceLocal?await replaceLocal(params,{assertAccess,verifyResolution}):await createAccountCloudReplaceService({storage,locks,assertAccess,verifyResolution,now,subtle}).replace(params);
  checkScope(expectedScope);if(!['replaced','existing'].includes(replaced?.status))return {ok:false,code:replaced?.reasonCodes?.[0]??'LOCAL_REPLACEMENT_INCOMPLETE',cloudCommitted:true,token,choice,receipt,local:replaced};
  saveBaseline(slotId,receipt.revision,receipt.chosenFingerprint,receipt.operationId);
  persistConflict(entry,{...entry.record,phase:'resolved',receipt});
  return {ok:true,status:'resolved',slotId,token,receipt,local:replaced};
 });}
 async function recoverPendingResolution(){return safe(async()=>{
  const ownerId=activeOwner(),prefix=PLAYER_CONFLICT_PREFIX+ownerId+':';let pending=null;
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix)){const entry=readConflict(ownerId,key.slice(prefix.length));if(entry.record.phase==='resolving'){pending=entry.record;break;}}}
  if(!pending)return {ok:true,recovered:false};
  const result=await performResolution({slotId:pending.slotId,token:pending.token,choice:pending.choice,backupId:pending.backupId});
  return result.ok?{...result,recovered:true}:result;
 });}
 const resolveConflict=async({slotId,token,choice})=>({slotId,token,...await performResolution({slotId,token,choice})});
 const restoreBackup=async({slotId,token,backupId})=>({slotId,token,...await performResolution({slotId,token,choice:'backup',backupId})});
 async function release(){return safe(async()=>{
  assert(queue.listPending(activeOwner()).length===0,'PENDING_CLOUD_OPERATION');return executeMutation(requestFor('release',{operationId:uuid()}));
 });}
 return Object.freeze({openSession,listSlots:()=>safe(()=>cloud.listSlots()),adoptGuest,ensureLocalSlot,syncSlot:ensureLocalSlot,createSlot,recoverPendingCreate,
  getReceipt:operationId=>safe(()=>cloud.getReceipt(operationId)),markAdoptedSlot,syncSnapshot,inspectConflict,resolveConflict,listBackups,restoreBackup,recoverPendingResolution,release,
  renew:()=>safe(()=>cloud.renew()),stop:()=>cloud.stop(),get isActive(){return cloud.isActive;}});
}
