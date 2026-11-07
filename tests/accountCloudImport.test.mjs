import { createAccountSaveSlots } from '../src/services/accountSaveSlots.mjs';
import { expect,test } from 'vitest';
import { webcrypto } from 'node:crypto';
import { memoryStorage } from '../src/save-session.mjs';
import { createInitialPlayerSave } from '../src/center/runtime/playerSave.ts';
import { createAccountCloudImportService } from '../src/services/accountCloudImportService.mjs';
import { assertCloudImportVisible,cloudImportRecordKey } from '../src/services/accountCloudImportRecord.mjs';
import { accountSlotPrefix,accountSlotRecordKey,createAccountSaveStorage } from '../src/services/accountSaveStorage.mjs';
import { fingerprintPlayerCloudPayload } from '../src/services/playerCloudService.mjs';
import { AUTHORITY,GUARD,WRITER_LOCK } from '../src/services/saveEpoch.mjs';
import { createSaveEntryService } from '../src/services/saveEntryService.mjs';
const ownerId='11111111-1111-4111-8111-111111111111',slotId='22222222-2222-4222-8222-222222222222',operationId='33333333-3333-4333-8333-333333333333';
const locks={request:async(name,options,fn)=>{expect(name).toBe(WRITER_LOCK);expect(options.ifAvailable).toBe(true);return fn({name});}};
async function input(){return {ownerId,slotId,operationId,cloudRevision:'9',...await fingerprintPlayerCloudPayload({format:'newtone-player-state',formatVersion:1,saveEpoch:'persistent-era-1',localProtocolVersion:2,generation:{id:'cloud-gen',sequence:1},localRevision:7,values:{'newtone-player-save-v1':JSON.stringify(createInitialPlayerSave()),'newtone-progress-v4':'{"language":"zh"}'},recoveryHolds:[]},webcrypto.subtle)};}
function service(storage,extra={}){return createAccountCloudImportService({storage,locks,assertAccess:()=>true,verifyCloudSnapshot:async()=>true,now:()=>5,subtle:webcrypto.subtle,...extra});}
test('imports complete state into absent slot, visible only after committed ledger',async()=>{
 const storage=memoryStorage(),request=await input();expect((await service(storage).install(request)).status).toBe('installed');
 const metadata=JSON.parse(storage.getItem(accountSlotRecordKey(ownerId,slotId)));expect(()=>assertCloudImportVisible(storage,metadata)).not.toThrow();
 const view=createAccountSaveStorage({storage,ownerId,slotId,assertAccess:()=>true});const authority=JSON.parse(view.getItem(AUTHORITY));
 expect(authority.revision).toBe(7);expect(authority.values['newtone-progress-v4']).toBe('{"language":"zh"}');expect(authority.sources).toEqual({});
 const inspect=await createSaveEntryService({storage:view,locks}).inspectSave();expect(inspect.classification).toBe('generation-current');
});
test.each([1,2,3,4,5])('persist-then-throw at write %s remains recoverable with exact request',async(failAt)=>{
 const base=memoryStorage();let writes=0,armed=true;const storage={getItem:k=>base.getItem(k),setItem(k,v){base.setItem(k,v);if(armed&&++writes===failAt){armed=false;throw Error('crash');}},key:i=>base.key(i),get length(){return base.length;}};
 const request=await input();await expect(service(storage).install(request)).rejects.toThrow('crash');
 const meta=base.getItem(accountSlotRecordKey(ownerId,slotId));if(meta&&failAt<5)expect(()=>assertCloudImportVisible(base,JSON.parse(meta))).toThrow('CLOUD_IMPORT_RECOVERY_REQUIRED');
 const result=await service(storage).install(request);expect(['installed','existing']).toContain(result.status);
 expect(JSON.parse(base.getItem(cloudImportRecordKey(ownerId,slotId,operationId))).phase).toBe('committed');
});
test('completed replay never overwrites progressed game, different request rejected',async()=>{
 const storage=memoryStorage(),request=await input();await service(storage).install(request);
 const key=accountSlotPrefix(ownerId,slotId)+'data:'+encodeURIComponent(AUTHORITY);const a=JSON.parse(storage.getItem(key));a.revision++;storage.setItem(key,JSON.stringify(a));
 expect((await service(storage).install(request)).status).toBe('existing');expect(JSON.parse(storage.getItem(key)).revision).toBe(8);
 await expect(service(storage).install({...request,cloudRevision:'10'})).rejects.toThrow('CLOUD_IMPORT_REQUEST_MISMATCH');
});
test('refuses existing target, unverified cloud and malformed PlayerSave',async()=>{
 const storage=memoryStorage(),request=await input();storage.setItem(accountSlotRecordKey(ownerId,slotId),'{}');
 await expect(service(storage).install(request)).rejects.toThrow('CLOUD_IMPORT_TARGET_NOT_EMPTY');
 await expect(service(memoryStorage(),{verifyCloudSnapshot:async()=>false}).install(request)).rejects.toThrow('CLOUD_SNAPSHOT_NOT_VERIFIED');
 const bad=JSON.parse(request.payloadRaw);bad.values['newtone-player-save-v1']='{}';
 await expect(service(memoryStorage()).install({...request,...await fingerprintPlayerCloudPayload(bad,webcrypto.subtle)})).rejects.toThrow();
});
test('denies lock contention and changed partial target without overwriting',async()=>{
 const request=await input();await expect(service(memoryStorage(),{locks:{request:(_n,_o,f)=>f(null)}}).install(request)).rejects.toThrow('ANOTHER_SESSION_ACTIVE');
 const base=memoryStorage();let n=0;const wrapped={...base,setItem(k,v){base.setItem(k,v);if(++n===3)throw Error('crash');},get length(){return base.length;}};
 await expect(service(wrapped).install(request)).rejects.toThrow('crash');const key=accountSlotPrefix(ownerId,slotId)+'data:'+encodeURIComponent(GUARD);base.setItem(key,'changed');
 await expect(service(base).install(request)).rejects.toThrow('CLOUD_IMPORT_TARGET_CHANGED');expect(base.getItem(key)).toBe('changed');
});

test('prepared cloud import reserves local quota before metadata and blocks ordinary creation',async()=>{
 const base=memoryStorage();let failed=false;const storage={...base,setItem(k,v){base.setItem(k,v);if(!failed){failed=true;throw Error('crash');}},get length(){return base.length;}};
 const request=await input();await expect(service(storage).install(request)).rejects.toThrow('crash');
 const slots=createAccountSaveSlots({storage:base,locks,assertAccess:()=>true,canCreateSlot:()=>true});
 expect(slots.listSlots(ownerId)).toHaveLength(1);expect((await slots.createSlot({ownerId,slotId})).reasonCodes).toContain('CLOUD_IMPORT_RECOVERY_REQUIRED');
 await service(base).install(request);expect((await slots.createSlot({ownerId,slotId})).status).toBe('existing');
});
