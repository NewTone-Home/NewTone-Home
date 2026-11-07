import {expect,test} from 'vitest';
import {webcrypto} from 'node:crypto';
import {memoryStorage} from '../src/save-session.mjs';
import {createInitialPlayerSave} from '../src/center/runtime/playerSave.ts';
import {createPlayerAccountBackend} from '../src/services/playerAccountBackend.mjs';
import {fingerprintPlayerCloudPayload} from '../src/services/playerCloudService.mjs';
import {accountSlotPrefix} from '../src/services/accountSaveStorage.mjs';
import {AUTHORITY} from '../src/services/saveEpoch.mjs';
const ownerId='11111111-1111-4111-8111-111111111111',slotId='22222222-2222-4222-8222-222222222222',operationId='33333333-3333-4333-8333-333333333333';
const locks={request:async(_name,_options,fn)=>fn({})};
async function payload(){return fingerprintPlayerCloudPayload({format:'newtone-player-state',formatVersion:1,saveEpoch:'persistent-era-1',localProtocolVersion:2,generation:{id:'gen',sequence:1},localRevision:0,values:{'newtone-player-save-v1':JSON.stringify(createInitialPlayerSave())},recoveryHolds:[]},webcrypto.subtle);}
function rig(){
 let serial=10,identity={ownerId,sessionEpoch:1},drop=false,before=false;const calls=[],rows=new Map(),receipts=new Map(),storage=memoryStorage();
 const rpc=async(_name,{p_action:a,p_args:p})=>{
  calls.push({a,p});
  if(['activate','resume','renew'].includes(a))return {data:{ok:true,fence:'1',serverNow:'2026-11-07T00:00:00Z',leaseUntil:'2026-11-07T00:01:30Z'}};
  if(a==='list')return {data:{ok:true,ownerId,slots:[...rows.values()].map(({payload:_payload,...r})=>r),autoAdoptionEligible:rows.size===0}};
  if(a==='read')return {data:{ok:true,...rows.get(p.slotId)}};
  if(a==='receipt')return {data:{ok:true,receipt:receipts.get(p.operationId)??null}};
  if(receipts.has(p.operationId))return {data:receipts.get(p.operationId)};
  if(a==='create'||a==='adopt'){
   if(before){before=false;throw Error('not sent');}
   const row={slotId:p.slotId,slotNo:p.slotNo??1,revision:'1',payload:JSON.parse(p.payloadRaw)};rows.set(row.slotId,row);
   const receipt={ok:true,ownerId,slotId:row.slotId,slotNo:row.slotNo,revision:'1',operationId:p.operationId,sourceFingerprint:p.sourceFingerprint};receipts.set(p.operationId,receipt);
   if(drop){drop=false;throw Error('response lost');}return {data:receipt};
  }
    if(a==='write'){
   const old=rows.get(p.slotId);if(old.revision!==p.expectedRevision)return {data:{ok:false,code:'REVISION_CONFLICT',revision:old.revision}};
   const row={...old,revision:String(Number(old.revision)+1),payload:JSON.parse(p.payloadRaw)};rows.set(p.slotId,row);
   const receipt={ok:true,ownerId,slotId:p.slotId,operationId:p.operationId,revision:row.revision,sourceFingerprint:p.sourceFingerprint};receipts.set(p.operationId,receipt);
   if(drop){drop=false;throw Error('response lost');}return {data:receipt};
  }
  if(a==='release')return {data:{ok:true,released:true}};
  throw Error('unexpected RPC '+a);
 };
 const backend=createPlayerAccountBackend({rpc,storage,locks,getIdentity:()=>identity,uuid:()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(++serial).padStart(12,'0')}`,now:()=>0,subtle:webcrypto.subtle});
 return {backend,calls,rows,receipts,storage,dropNext:()=>{drop=true;},failBefore:()=>{before=true;},changeIdentity:()=>{identity={ownerId,sessionEpoch:2};}};
}
test('restored uses resume, login uses activate and no Auth operation',async()=>{
 const r=rig();expect((await r.backend.openSession({origin:'restored'})).ok).toBe(true);expect(r.calls[0].a).toBe('resume');
 await r.backend.openSession({origin:'login'});expect(r.calls.at(-1).a).toBe('activate');r.changeIdentity();expect(r.backend.isActive).toBe(false);
});
test('creates server slot then safely imports complete local slot; matching entry ready',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});const encoded=await payload();
 const result=await r.backend.createSlot({slotId,operationId,...encoded});expect(result.ok).toBe(true);expect(result.local.status).toBe('installed');
 expect((await r.backend.ensureLocalSlot(slotId)).status).toBe('ready');expect(r.rows.size).toBe(1);
});
test('local changed progress returns explicit conflict without overwriting',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});await r.backend.createSlot({slotId,operationId,...await payload()});
 const key=accountSlotPrefix(ownerId,slotId)+'data:'+encodeURIComponent(AUTHORITY);const a=JSON.parse(r.storage.getItem(key));a.revision++;const player=JSON.parse(a.values['newtone-player-save-v1']);player.walletBalance=700;a.values['newtone-player-save-v1']=JSON.stringify(player);r.storage.setItem(key,JSON.stringify(a));const before=r.storage.getItem(key);r.rows.get(slotId).revision='2';
 expect((await r.backend.ensureLocalSlot(slotId)).code).toBe('LOCAL_CLOUD_CONFLICT');expect(r.storage.getItem(key)).toBe(before);
});
test('lost create response keeps same operation on retry, never duplicates slot',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});r.dropNext();const input={slotId,operationId,...await payload()};
 expect((await r.backend.createSlot(input)).code).toBe('OUTCOME_UNCERTAIN');
 const other={...input,slotId:'44444444-4444-4444-8444-444444444444',operationId:'55555555-5555-4555-8555-555555555555'};
 expect((await r.backend.createSlot(other)).code).toBe('PENDING_CLOUD_OPERATION');
 expect((await r.backend.createSlot(input)).ok).toBe(true);expect(r.rows.size).toBe(1);
 expect(r.calls.filter(c=>c.a==='create').map(c=>c.p.operationId)).toEqual([operationId,operationId]);
});
test('adoption verifies binding and baseline rereads authoritative receipt',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});const encoded=await payload();
 const result=await r.backend.adoptGuest({slotId,operationId,portableRaw:encoded.payloadRaw,sourceFingerprint:encoded.sourceFingerprint});expect(result.ok).toBe(true);
 expect((await r.backend.markAdoptedSlot(result,encoded.sourceFingerprint)).ok).toBe(true);
 expect((await r.backend.markAdoptedSlot({...result,revision:'99'},encoded.sourceFingerprint)).code).toBe('INVALID_ADOPTION_RECEIPT');
});
test('resume reconciles committed pending receipt without replaying mutation',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});r.dropNext();await r.backend.createSlot({slotId,operationId,...await payload()});r.backend.stop();
 const result=await r.backend.openSession({origin:'restored'});expect(result.pendingOperations).toEqual([]);expect(r.calls.filter(c=>c.a==='create')).toHaveLength(1);
});

test('unchanged cloud baseline permits CAS of local progress and persists new baseline',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});await r.backend.createSlot({slotId,operationId,...await payload()});
 const key=accountSlotPrefix(ownerId,slotId)+'data:'+encodeURIComponent(AUTHORITY);const a=JSON.parse(r.storage.getItem(key));a.revision++;const p=JSON.parse(a.values['newtone-player-save-v1']);p.walletBalance=650;a.values['newtone-player-save-v1']=JSON.stringify(p);r.storage.setItem(key,JSON.stringify(a));
 expect((await r.backend.syncSlot(slotId)).status).toBe('synced');expect(r.rows.get(slotId).revision).toBe('2');expect(JSON.parse(r.rows.get(slotId).payload.values['newtone-player-save-v1']).walletBalance).toBe(650);
 expect((await r.backend.syncSlot(slotId)).status).toBe('ready');expect(r.calls.filter(c=>c.a==='write')).toHaveLength(1);
});
test('local bookkeeping revision alone does not create divergence or unnecessary upload',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});await r.backend.createSlot({slotId,operationId,...await payload()});
 const key=accountSlotPrefix(ownerId,slotId)+'data:'+encodeURIComponent(AUTHORITY);const a=JSON.parse(r.storage.getItem(key));a.revision++;r.storage.setItem(key,JSON.stringify(a));
 expect((await r.backend.ensureLocalSlot(slotId)).status).toBe('ready');expect(r.calls.filter(c=>c.a==='write')).toHaveLength(0);
});
test('lost CAS response reconciles receipt before further sync, increments once',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});await r.backend.createSlot({slotId,operationId,...await payload()});
 const key=accountSlotPrefix(ownerId,slotId)+'data:'+encodeURIComponent(AUTHORITY);const a=JSON.parse(r.storage.getItem(key));a.revision++;const p=JSON.parse(a.values['newtone-player-save-v1']);p.walletBalance=600;a.values['newtone-player-save-v1']=JSON.stringify(p);r.storage.setItem(key,JSON.stringify(a));
 r.dropNext();expect((await r.backend.syncSlot(slotId)).code).toBe('OUTCOME_UNCERTAIN');expect(r.rows.get(slotId).revision).toBe('2');
 expect((await r.backend.syncSlot(slotId)).status).toBe('ready');expect(r.calls.filter(c=>c.a==='write')).toHaveLength(1);
});
test('active captured snapshot sync never rewrites newer local journal',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});await r.backend.createSlot({slotId,operationId,...await payload()});
 const key=accountSlotPrefix(ownerId,slotId)+'data:'+encodeURIComponent(AUTHORITY),a=JSON.parse(r.storage.getItem(key));
 const snapshot=structuredClone(r.rows.get(slotId).payload),player=JSON.parse(snapshot.values['newtone-player-save-v1']);player.walletBalance=550;snapshot.values['newtone-player-save-v1']=JSON.stringify(player);snapshot.localRevision=1;
 a.revision=2;player.walletBalance=500;a.values['newtone-player-save-v1']=JSON.stringify(player);r.storage.setItem(key,JSON.stringify(a));const current=r.storage.getItem(key);
 expect((await r.backend.syncSnapshot(slotId,await fingerprintPlayerCloudPayload(snapshot,webcrypto.subtle))).status).toBe('synced');expect(r.storage.getItem(key)).toBe(current);
 expect(JSON.parse(r.rows.get(slotId).payload.values['newtone-player-save-v1']).walletBalance).toBe(550);
 expect((await r.backend.syncSlot(slotId)).status).toBe('synced');expect(JSON.parse(r.rows.get(slotId).payload.values['newtone-player-save-v1']).walletBalance).toBe(500);
});


test('pending create never reached server recovers exact stored operation after resume',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});r.failBefore();const encoded=await payload();
 expect((await r.backend.createSlot({slotId,operationId,...encoded})).code).toBe('OUTCOME_UNCERTAIN');expect(r.rows.size).toBe(0);
 r.backend.stop();expect((await r.backend.openSession({origin:'restored'})).pendingOperations).toEqual([operationId]);
 const recovered=await r.backend.recoverPendingCreate();expect(recovered.recovered).toBe(true);expect(recovered.slotId).toBe(slotId);
 const requests=r.calls.filter(c=>c.a==='create').map(c=>c.p);expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
 expect((await r.backend.recoverPendingCreate()).recovered).toBe(false);
});
test('create recovery does not block typed adoption retry when adoption request never reached server',async()=>{
 const r=rig();await r.backend.openSession({origin:'login'});r.failBefore();const encoded=await payload();
 const adoption={slotId,operationId,portableRaw:encoded.payloadRaw,sourceFingerprint:encoded.sourceFingerprint};
 expect((await r.backend.adoptGuest(adoption)).code).toBe('OUTCOME_UNCERTAIN');
 r.backend.stop();await r.backend.openSession({origin:'restored'});
 expect(await r.backend.recoverPendingCreate()).toEqual({ok:true,recovered:false,pendingOther:true});
 expect((await r.backend.adoptGuest(adoption)).ok).toBe(true);
 const requests=r.calls.filter(c=>c.a==='adopt').map(c=>c.p);expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
 expect(r.calls.filter(c=>c.a==='create')).toHaveLength(0);
});
