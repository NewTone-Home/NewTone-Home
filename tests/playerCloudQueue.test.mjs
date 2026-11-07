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
