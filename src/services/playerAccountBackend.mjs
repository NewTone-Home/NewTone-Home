import { readCloudImportRecord } from './accountCloudImportRecord.mjs';
import { validateNew } from './saveMigration.mjs';
import { createPlayerCloudService, createPlayerCloudPayloadFromAuthority, fingerprintPlayerCloudPayload, serializePlayerCloudPayload } from './playerCloudService.mjs';
import { createPlayerCloudQueue } from './playerCloudQueue.mjs';
import { createAccountCloudImportService } from './accountCloudImportService.mjs';
import { createAccountSaveSlots } from './accountSaveSlots.mjs';
import { createSaveEntryService } from './saveEntryService.mjs';
import { WRITER_LOCK, AUTHORITY, GUARD } from './saveEpoch.mjs';
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const fail=error=>({ok:false,code:error instanceof Error?error.message:String(error)});
export const PLAYER_CLOUD_BASELINE_PREFIX='newtone-cloud-baseline:v1:';
/** Composition boundary only. No Auth side effects and no implicit local/cloud conflict resolution. */
export function createPlayerAccountBackend({rpc,storage,locks,getIdentity,uuid=()=>crypto.randomUUID(),now=Date.now,subtle=globalThis.crypto?.subtle}={}) {
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
 const queue=createPlayerCloudQueue({storage,locks,assertAccess:access});
 const cloud=createPlayerCloudService({rpc,getScope:scope,persistPending:queue.persistPending,clearPending:queue.clearPending,now});
 const slots=createAccountSaveSlots({storage,locks,assertAccess:access});
 async function safe(fn){try{return await fn();}catch(error){return fail(error);}}
 function baseline(slotId){
  const ownerId=activeOwner(),raw=storage.getItem(PLAYER_CLOUD_BASELINE_PREFIX+ownerId+':'+slotId);if(raw===null)return null;
  const record=JSON.parse(raw);assert(record.version===1&&record.ownerId===ownerId&&record.slotId===slotId&&/^[1-9][0-9]*$/.test(record.cloudRevision)&&/^[0-9a-f]{64}$/.test(record.sourceFingerprint),'INVALID_CLOUD_BASELINE');return record;
 }
 function saveBaseline(slotId,cloudRevision,sourceFingerprint,operationId){
  const ownerId=activeOwner(),previous=baseline(slotId);assert(/^[1-9][0-9]*$/.test(cloudRevision)&&/^[0-9a-f]{64}$/.test(sourceFingerprint),'INVALID_CLOUD_BASELINE');
  if(previous&&BigInt(previous.cloudRevision)>BigInt(cloudRevision))return;
  if(previous&&previous.cloudRevision===cloudRevision)assert(previous.sourceFingerprint===sourceFingerprint,'CLOUD_BASELINE_MISMATCH');
  const key=PLAYER_CLOUD_BASELINE_PREFIX+ownerId+':'+slotId,raw=JSON.stringify({version:1,ownerId,slotId,cloudRevision,sourceFingerprint,operationId});
  storage.setItem(key,raw);assert(storage.getItem(key)===raw,'CLOUD_BASELINE_WRITE_UNCERTAIN');assert(access({ownerId}),'ACCOUNT_ACCESS_DENIED');
 }
 function acknowledgeBaseline(request,receipt){
  if(request.action==='release')return;
  assert(receipt.ownerId===request.ownerId&&receipt.operationId===request.parameters.operationId&&receipt.slotId===request.parameters.slotId&&receipt.sourceFingerprint===request.parameters.sourceFingerprint,'INVALID_CLOUD_RECEIPT');
  saveBaseline(receipt.slotId,receipt.revision,receipt.sourceFingerprint,receipt.operationId);
 }
 async function reconcileReceipts(){
  const ownerId=activeOwner(),expectedScope=scope();
  for(const record of queue.listPending(ownerId)){
   const result=await cloud.getReceipt(record.request.parameters.operationId);if(!result.ok)return result;checkScope(expectedScope);
   if(result.receipt){
    const receipt=result.receipt;assert(receipt.ok===true,'INVALID_CLOUD_RECEIPT');
    if(record.request.action!=='release')assert(receipt.ownerId===ownerId&&receipt.operationId===record.request.parameters.operationId,'INVALID_CLOUD_RECEIPT');
    acknowledgeBaseline(record.request,receipt);
    await queue.clearPending(record.request,receipt);
   }
  }
  for(const record of queue.listAcknowledged(ownerId))acknowledgeBaseline(record.request,record.acknowledgement);
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
 async function adoptGuest({slotId,operationId,portableRaw,sourceFingerprint}){return safe(()=>cloud.execute(requestFor('adopt',{slotId,operationId,payloadRaw:portableRaw,sourceFingerprint})));}
 async function canonicalCloud(slotId){
  const read=await cloud.readSlot(slotId);if(!read.ok)return read;
  assert(read.slotId===slotId&&typeof read.revision==='string'&&/^[1-9][0-9]*$/.test(read.revision),'INVALID_CLOUD_SLOT');
  const encoded=await fingerprintPlayerCloudPayload(read.payload,subtle);activeOwner();return {...read,...encoded};
 }
 async function ensureLocalSlot(slotId){return safe(async()=>{
    const ownerId=activeOwner(),expectedScope=scope(),guard=({ownerId:owner})=>scope()===expectedScope&&access({ownerId:owner});
  const recovery=await reconcileReceipts();if(!recovery.ok)return recovery;checkScope(expectedScope);
  for(const record of queue.listPending(ownerId)){
   if(record.request.action!=='write'||record.request.parameters.slotId!==slotId)return {ok:false,code:'PENDING_CLOUD_OPERATION'};
   const retried=await cloud.execute(record.request);if(!retried.ok)return retried;checkScope(expectedScope);acknowledgeBaseline(record.request,retried);
  }
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
      const receipt=await cloud.execute(request);if(!receipt.ok)return receipt;checkScope(expectedScope);acknowledgeBaseline(request,receipt);
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
  const receipt=await cloud.execute(request);if(!receipt.ok)return receipt;checkScope(expectedScope);
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
  if(record.phase==='pending'){receipt=await cloud.execute(request);if(!receipt.ok)return receipt;checkScope(expectedScope);}
  acknowledgeBaseline(request,receipt);
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
   const result=await cloud.execute(original);if(result.ok){checkScope(expectedScope);acknowledgeBaseline(original,result);}return result;
  }
  const read=await canonicalCloud(slotId);if(!read.ok)return read;checkScope(expectedScope);
  const equalContent=serializePlayerCloudPayload({...payload,localRevision:0})===serializePlayerCloudPayload({...read.payload,localRevision:0});
  if(equalContent){saveBaseline(slotId,read.revision,read.sourceFingerprint,uuid());return {ok:true,status:'unchanged',slotId,cloudRevision:read.revision,sourceFingerprint:read.sourceFingerprint};}
  const base=baseline(slotId);
  if(!base||base.cloudRevision!==read.revision)return {ok:false,code:'LOCAL_CLOUD_CONFLICT',slotId,cloudRevision:read.revision,localFingerprint:sourceFingerprint,cloudFingerprint:read.sourceFingerprint};
  const request=requestFor('write',{slotId,operationId:uuid(),expectedRevision:read.revision,payloadRaw,sourceFingerprint});
  const result=await cloud.execute(request);if(!result.ok)return result;checkScope(expectedScope);acknowledgeBaseline(request,result);
  return {ok:true,status:'synced',slotId,cloudRevision:result.revision,sourceFingerprint:result.sourceFingerprint};
 });}
 async function release(){return safe(async()=>{
  assert(queue.listPending(activeOwner()).length===0,'PENDING_CLOUD_OPERATION');return cloud.execute(requestFor('release',{operationId:uuid()}));
 });}
 return Object.freeze({openSession,listSlots:()=>safe(()=>cloud.listSlots()),adoptGuest,ensureLocalSlot,syncSlot:ensureLocalSlot,createSlot,recoverPendingCreate,
  getReceipt:operationId=>safe(()=>cloud.getReceipt(operationId)),markAdoptedSlot,syncSnapshot,release,
  renew:()=>safe(()=>cloud.renew()),stop:()=>cloud.stop(),get isActive(){return cloud.isActive;}});
}
