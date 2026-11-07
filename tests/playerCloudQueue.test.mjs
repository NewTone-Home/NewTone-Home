import {expect,test} from 'vitest';
import {memoryStorage} from '../src/save-session.mjs';
import {createPlayerCloudQueue} from '../src/services/playerCloudQueue.mjs';
const ownerId='11111111-1111-4111-8111-111111111111',operationId='22222222-2222-4222-8222-222222222222';
const request={version:1,ownerId,action:'write',parameters:{operationId,expectedRevision:'1',payloadRaw:'{}',sourceFingerprint:'abc'}};
const locks={request:async(_key,_options,fn)=>fn()};
const make=(storage,assertAccess=()=>true)=>createPlayerCloudQueue({storage,locks,assertAccess});
test('exact pending request survives reload, acknowledgement remains durable',async()=>{
 const storage=memoryStorage();await make(storage).persistPending(request);expect(make(storage).listPending(ownerId)[0].request).toEqual(request);
 await make(storage).clearPending(request,{ok:true,revision:'2'});expect(make(storage).listPending(ownerId)).toEqual([]);expect(make(storage).listAcknowledged(ownerId)[0].acknowledgement.revision).toBe('2');
 await make(storage).persistPending(request);expect(make(storage).listPending(ownerId)).toEqual([]);
});
test('mismatched operation body cannot overwrite pending or acknowledged request',async()=>{
 const storage=memoryStorage(),queue=make(storage);await queue.persistPending(request);
 await expect(queue.persistPending({...request,parameters:{...request.parameters,expectedRevision:'2'}})).rejects.toThrow('CLOUD_QUEUE_IDEMPOTENCY_MISMATCH');
 expect(queue.listPending(ownerId)[0].request.parameters.expectedRevision).toBe('1');
});
test('write-then-throw acknowledgement stays recoverable and does not remove source',async()=>{
 const base=memoryStorage();let armed=false;const storage={...base,setItem(k,v){base.setItem(k,v);if(armed){armed=false;throw Error('crash');}},get length(){return base.length;}};
 const queue=make(storage);await queue.persistPending(request);armed=true;await expect(queue.clearPending(request,{ok:true,revision:'2'})).rejects.toThrow('crash');
 expect(make(base).listAcknowledged(ownerId)[0].request).toEqual(request);
});
test('access guard and allowed fields prevent cross-account or token storage',async()=>{
 const queue=make(memoryStorage(),()=>false);await expect(queue.persistPending(request)).rejects.toThrow('CLOUD_QUEUE_ACCESS_DENIED');
 await expect(make(memoryStorage()).persistPending({...request,parameters:{...request.parameters,accessToken:'not allowed'}})).rejects.toThrow('INVALID_CLOUD_QUEUE_FIELDS');
});
test('definitive CAS rejection is retained but no longer blocks a new explicit resolution',async()=>{
 const storage=memoryStorage(),queue=make(storage);await queue.persistPending(request);
 await expect(queue.rejectPending(request,{ok:false,code:'OUTCOME_UNCERTAIN'})).rejects.toThrow('UNPROVEN_CLOUD_REJECTION');
 expect(queue.listPending(ownerId)).toHaveLength(1);
 await queue.rejectPending(request,{ok:false,code:'REVISION_CONFLICT'});expect(queue.listPending(ownerId)).toEqual([]);expect(storage.length).toBe(1);
});
test('write compaction requires a durable baseline and preserves hash-verified idempotent retry',async()=>{
 const storage=memoryStorage(),queue=make(storage);await queue.persistPending(request);
 await queue.compactAcknowledgedWrites(ownerId,()=>true);expect(queue.listPending(ownerId)[0].request.parameters.payloadRaw).toBe('{}');
 await queue.clearPending(request,{ok:true,revision:'2'});await queue.compactAcknowledgedWrites(ownerId,()=>false);
 expect(queue.listAcknowledged(ownerId)[0].request.parameters.payloadRaw).toBe('{}');
 expect((await queue.compactAcknowledgedWrites(ownerId,()=>true)).compacted).toBe(1);
 const compact=queue.listAcknowledged(ownerId)[0];expect(compact.request.parameters.payloadRaw).toBeUndefined();expect(compact.requestHash).toMatch(/^[0-9a-f]{64}$/);expect(compact.acknowledgement.revision).toBe('2');
 await queue.persistPending(request);await queue.clearPending(request,{ok:true,revision:'2'});
 await expect(queue.persistPending({...request,parameters:{...request.parameters,payloadRaw:'{"changed":true}'}})).rejects.toThrow('CLOUD_QUEUE_IDEMPOTENCY_MISMATCH');
});
test('adoption and explicit backup-bearing operation payloads are not checkpoint-compacted',async()=>{
 const queue=make(memoryStorage());const adopt={...request,action:'adopt'};await queue.persistPending(adopt);await queue.clearPending(adopt,{ok:true,revision:'1'});
 await queue.compactAcknowledgedWrites(ownerId,()=>true);expect(queue.listAcknowledged(ownerId)[0].request.parameters.payloadRaw).toBe('{}');
});
