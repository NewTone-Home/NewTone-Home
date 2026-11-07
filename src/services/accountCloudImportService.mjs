import { createAccountSaveSlots } from './accountSaveSlots.mjs';
import { accountSlotPrefix, accountSlotRecordKey, assertAccountAccess } from './accountSaveStorage.mjs';
import { cloudImportRecordKey, readCloudImportRecord } from './accountCloudImportRecord.mjs';
import { validateSaveEntryAuthority } from './saveEntryService.mjs';
import { AUTHORITY, GUARD, SAVE_EPOCH, WRITER_LOCK } from './saveEpoch.mjs';
import { createPlayerCloudPayloadFromAuthority, fingerprintPlayerCloudPayload, serializePlayerCloudPayload } from './playerCloudService.mjs';
const assert=(ok,code)=>{if(!ok)throw Error(code);};
function authorityFromPortable(p,operationId,fingerprint) {
 assert(p?.format==='newtone-player-state'&&p.formatVersion===1&&p.localProtocolVersion===2&&p.saveEpoch===SAVE_EPOCH,'UNSUPPORTED_CLOUD_FORMAT');
 const candidate={saveEpoch:SAVE_EPOCH,protocolVersion:2,revision:p.localRevision,generation:p.generation,
  origin:{kind:'new',sourceFormatId:'service-epoch-1',sourceSetHash:fingerprint,parentGenerationId:null},
  placement:{ruleId:'new-epoch-start-v1',result:'new-exempt'},sources:{},archive:{policy:'pre-epoch-test-data-not-imported',originalSources:'sources'},
  values:p.values,recoveryHolds:p.recoveryHolds,
  operationReceipt:{operationId,requestHash:fingerprint,baseSnapshotHash:fingerprint,resultingGenerationId:p.generation?.id,resultingRevision:p.localRevision}};
 validateSaveEntryAuthority(candidate);
 // Exact round trip rejects extra envelope/generation fields and strips no state silently.
 assert(serializePlayerCloudPayload(createPlayerCloudPayloadFromAuthority(candidate))===serializePlayerCloudPayload(p),'INVALID_CLOUD_ENVELOPE');
 return candidate;
}
/** Only installs previously absent slots. Replacing a playable slot requires a different explicit transaction. */
export function createAccountCloudImportService({storage,locks,assertAccess,verifyCloudSnapshot,now=Date.now,subtle=globalThis.crypto?.subtle}={}) {
 assert(storage&&typeof storage.setItem==='function','CLOUD_IMPORT_STORAGE_REQUIRED');
 async function install(input) {
  const {ownerId,slotId,operationId,cloudRevision,payloadRaw,sourceFingerprint}=input;
  const scope={ownerId,slotId},recordKey=cloudImportRecordKey(ownerId,slotId,operationId);
  assert(typeof cloudRevision==='string'&&/^[1-9][0-9]*$/.test(cloudRevision),'INVALID_CLOUD_REVISION');
  assert(typeof payloadRaw==='string','INVALID_CLOUD_PAYLOAD');
  const parsed=JSON.parse(payloadRaw),fingerprinted=await fingerprintPlayerCloudPayload(parsed,subtle);
  assert(fingerprinted.payloadRaw===payloadRaw&&fingerprinted.sourceFingerprint===sourceFingerprint,'CLOUD_IMPORT_FINGERPRINT_MISMATCH');
  const target=authorityFromPortable(parsed,operationId,sourceFingerprint);
  const targetAuthorityRaw=JSON.stringify(target),targetGuardRaw=JSON.stringify({saveEpoch:SAVE_EPOCH,firstOperationId:operationId,phase:'committed'});
  assertAccountAccess(assertAccess,scope);
  assert(typeof verifyCloudSnapshot==='function','CLOUD_SNAPSHOT_VERIFIER_REQUIRED');
  assert(await verifyCloudSnapshot({ownerId,slotId,cloudRevision,payloadRaw,sourceFingerprint})===true,'CLOUD_SNAPSHOT_NOT_VERIFIED');
  assertAccountAccess(assertAccess,scope);
  const manager=locks??globalThis.navigator?.locks;
  assert(manager&&typeof manager.request==='function','LOCKING_UNAVAILABLE');
  return manager.request(WRITER_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
   assert(lock,'ANOTHER_SESSION_ACTIVE');assertAccountAccess(assertAccess,scope);
   const prefix=accountSlotPrefix(ownerId,slotId),metaKey=accountSlotRecordKey(ownerId,slotId);
   const authorityKey=prefix+'data:'+encodeURIComponent(AUTHORITY),guardKey=prefix+'data:'+encodeURIComponent(GUARD);
   let prior=readCloudImportRecord(storage,ownerId,slotId,operationId);
   if(prior){
    assert(prior.record.cloudRevision===cloudRevision&&prior.record.payloadRaw===payloadRaw&&prior.record.sourceFingerprint===sourceFingerprint&&prior.record.targetAuthorityRaw===targetAuthorityRaw&&prior.record.targetGuardRaw===targetGuardRaw,'CLOUD_IMPORT_REQUEST_MISMATCH');
    if(prior.record.phase==='committed'){
     assert(storage.getItem(metaKey)===prior.record.targetMetadataRaw,'CLOUD_IMPORT_TARGET_CHANGED');
     assert(storage.getItem(authorityKey)!==null&&storage.getItem(guardKey)!==null,'CLOUD_IMPORT_COMMITTED_TARGET_MISSING');
     validateSaveEntryAuthority(JSON.parse(storage.getItem(authorityKey)));
     // Runtime may have progressed after commit: never rewrite or compare authority to old snapshot.
     return {status:'existing',ownerId,slotId,operationId,cloudRevision,sourceFingerprint};
    }
   }else{
    for(let i=0;i<storage.length;i++)assert(!storage.key(i)?.startsWith(prefix),'CLOUD_IMPORT_TARGET_NOT_EMPTY');
    const reservations=createAccountSaveSlots({storage,locks:manager,assertAccess}).listSlots(ownerId);
    assert(!reservations.some(slot=>slot.slotId===slotId),'CLOUD_IMPORT_TARGET_NOT_EMPTY');
    assert(reservations.length<3,'LOCAL_SLOT_LIMIT');
    for(let i=0;i<storage.length;i++)assert(!storage.key(i)?.startsWith(prefix),'CLOUD_IMPORT_TARGET_NOT_EMPTY');
    const createdAt=now();assert(Number.isSafeInteger(createdAt)&&createdAt>=0,'INVALID_IMPORT_TIMESTAMP');
    const metadata={schemaVersion:1,ownerId,slotId,createdAt,cloudImportOperationId:operationId};
    const record={schemaVersion:1,ownerId,slotId,operationId,phase:'prepared',cloudRevision,payloadRaw,sourceFingerprint,targetAuthorityRaw,targetGuardRaw,targetMetadataRaw:JSON.stringify(metadata),createdAt};
    const raw=JSON.stringify(record);storage.setItem(recordKey,raw);assert(storage.getItem(recordKey)===raw,'CLOUD_IMPORT_WRITE_UNCERTAIN');
    prior={raw,record};
   }
   const expected=new Map([[metaKey,prior.record.targetMetadataRaw],[guardKey,targetGuardRaw],[authorityKey,targetAuthorityRaw]]);
   function check(){
    assertAccountAccess(assertAccess,scope);assert(storage.getItem(recordKey)===prior.raw,'CLOUD_IMPORT_RECORD_CHANGED');
    for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix))assert(expected.has(key),'CLOUD_IMPORT_TARGET_CHANGED');}
    for(const [key,value] of expected){const actual=storage.getItem(key);assert(actual===null||actual===value,'CLOUD_IMPORT_TARGET_CHANGED');}
   }
   // Every write may persist and then throw. Recovery only fills missing exact values.
   for(const [key,value] of expected){check();if(storage.getItem(key)===null)storage.setItem(key,value);assert(storage.getItem(key)===value,'CLOUD_IMPORT_WRITE_UNCERTAIN');}
   check();
   const committed=JSON.stringify({...prior.record,phase:'committed'});storage.setItem(recordKey,committed);assert(storage.getItem(recordKey)===committed,'CLOUD_IMPORT_WRITE_UNCERTAIN');assertAccountAccess(assertAccess,scope);
   return {status:'installed',ownerId,slotId,operationId,cloudRevision,sourceFingerprint};
  });
 }
 return Object.freeze({install});
}
