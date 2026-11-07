/** Durable exact-request journal. Ack and request share one atomic storage record; no blind deletion. */
export const PLAYER_CLOUD_QUEUE_PREFIX='newtone-player-cloud-queue:v1:';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item);
export function createPlayerCloudQueue({storage,locks,assertAccess,subtle=globalThis.crypto?.subtle}={}) {
 assert(storage&&typeof storage.setItem==='function','CLOUD_QUEUE_STORAGE_REQUIRED');
 async function requestDigest(raw){assert(subtle?.digest,'CRYPTO_REQUIRED');return [...new Uint8Array(await subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
 function check(ownerId){assert(typeof assertAccess==='function'&&assertAccess({ownerId})===true,'CLOUD_QUEUE_ACCESS_DENIED');}
 function keyFor(request){
  assert(request?.version===1&&uuid.test(request.ownerId??'')&&uuid.test(request.parameters?.operationId??'')&&['create','adopt','write','resolve','restore','release'].includes(request.action),'INVALID_CLOUD_QUEUE_REQUEST');
  assert(Object.keys(request).every(k=>['version','ownerId','action','parameters'].includes(k))&&Object.keys(request.parameters).every(k=>['operationId','slotId','slotNo','payloadRaw','sourceFingerprint','expectedRevision','expectedCloudFingerprint','choice','backupId'].includes(k)),'INVALID_CLOUD_QUEUE_FIELDS');
  return PLAYER_CLOUD_QUEUE_PREFIX+request.ownerId+':'+request.parameters.operationId;
 }
 function read(key){const raw=storage.getItem(key);if(raw===null)return null;let record;try{record=JSON.parse(raw);}catch{throw Error('INVALID_CLOUD_QUEUE_RECORD');}
  assert(record?.version===1&&['pending','acknowledged','rejected'].includes(record.phase)&&keyFor(record.request)===key,'INVALID_CLOUD_QUEUE_RECORD');
  if(record.compacted)assert(record.phase==='acknowledged'&&record.request.action==='write'&&/^[0-9a-f]{64}$/.test(record.requestHash)&&!Object.hasOwn(record.request.parameters,'payloadRaw'),'INVALID_COMPACTED_QUEUE_RECORD');
  return {raw,record};}
 async function transact(request,acknowledgement){
  const key=keyFor(request),requestRaw=canonical(request);check(request.ownerId);
  const requestHash=await requestDigest(requestRaw);check(request.ownerId);
  const manager=locks??globalThis.navigator?.locks;assert(manager&&typeof manager.request==='function','LOCKING_UNAVAILABLE');
  return manager.request(key,{mode:'exclusive'},()=>{
   check(request.ownerId);const existing=read(key);if(existing)assert(existing.record.compacted?existing.record.requestHash===requestHash:canonical(existing.record.request)===requestRaw,'CLOUD_QUEUE_IDEMPOTENCY_MISMATCH');
   if(acknowledgement===undefined){if(existing)return;}
   else{assert(existing,'CLOUD_QUEUE_PENDING_MISSING');assert(acknowledgement?.ok===true,'INVALID_CLOUD_QUEUE_ACK');if(existing.record.phase==='acknowledged')return;}
   const record={version:1,phase:acknowledgement===undefined?'pending':'acknowledged',request:JSON.parse(requestRaw),acknowledgement:acknowledgement??null};
   const raw=JSON.stringify(record);check(request.ownerId);storage.setItem(key,raw);assert(storage.getItem(key)===raw,'CLOUD_QUEUE_WRITE_UNCERTAIN');check(request.ownerId);
  });
 }
 async function rejectPending(request,result){
  assert(result?.ok===false&&result.code==='REVISION_CONFLICT','UNPROVEN_CLOUD_REJECTION');
  const key=keyFor(request);check(request.ownerId);const manager=locks??globalThis.navigator?.locks;assert(manager?.request,'LOCKING_UNAVAILABLE');
  return manager.request(key,{mode:'exclusive'},()=>{
   check(request.ownerId);const existing=read(key);assert(existing&&canonical(existing.record.request)===canonical(request),'CLOUD_QUEUE_IDEMPOTENCY_MISMATCH');
   assert(existing.record.phase!=='acknowledged','CLOUD_QUEUE_ALREADY_ACKNOWLEDGED');
   const raw=JSON.stringify({...existing.record,phase:'rejected',rejection:result});storage.setItem(key,raw);assert(storage.getItem(key)===raw,'CLOUD_QUEUE_WRITE_UNCERTAIN');check(request.ownerId);
  });
 }
 async function compactAcknowledgedWrites(ownerId,hasDurableBaseline){
  check(ownerId);assert(typeof hasDurableBaseline==='function','BASELINE_VERIFIER_REQUIRED');
  const manager=locks??globalThis.navigator?.locks;assert(manager?.request,'LOCKING_UNAVAILABLE');let count=0;
  for(const candidate of list(ownerId,'acknowledged')){
   if(candidate.request.action!=='write'||candidate.compacted)continue;
   const key=keyFor(candidate.request),requestHash=await requestDigest(canonical(candidate.request));check(ownerId);
   await manager.request(key,{mode:'exclusive'},()=>{
    check(ownerId);const current=read(key);assert(current,'CLOUD_QUEUE_RECORD_MISSING');
    if(current.record.compacted||current.record.phase!=='acknowledged')return;
    assert(canonical(current.record.request)===canonical(candidate.request),'CLOUD_QUEUE_IDEMPOTENCY_MISMATCH');
    if(hasDurableBaseline(current.record)!==true)return;
    const parameters={...current.record.request.parameters};delete parameters.payloadRaw;
    const compacted={...current.record,request:{...current.record.request,parameters},requestHash,compacted:true};
    const raw=JSON.stringify(compacted);storage.setItem(key,raw);assert(storage.getItem(key)===raw,'CLOUD_QUEUE_WRITE_UNCERTAIN');check(ownerId);count++;
   });
  }
  return {compacted:count};
 }
 function list(ownerId,phase){assert(uuid.test(ownerId??''),'INVALID_CLOUD_QUEUE_OWNER');check(ownerId);const prefix=PLAYER_CLOUD_QUEUE_PREFIX+ownerId+':';const records=[];
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix)){const record=read(key).record;if(!phase||record.phase===phase)records.push(record);}}
  check(ownerId);return records;
 }
 return Object.freeze({compactAcknowledgedWrites,rejectPending,persistPending:request=>transact(request),clearPending:(request,receipt)=>transact(request,receipt),listPending:ownerId=>list(ownerId,'pending'),listAcknowledged:ownerId=>list(ownerId,'acknowledged')});
}
