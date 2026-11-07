import { test, expect, afterEach } from 'vitest';
import { memoryStorage, installGameStorage } from '../src/save-session.mjs';
import { createAccountSaveSlots } from '../src/services/accountSaveSlots.mjs';
import { createAccountCloudReplaceService } from '../src/services/accountCloudReplaceService.mjs';
import { cloudReplaceRecordKey } from '../src/services/accountCloudReplaceRecord.mjs';
import { createSaveEntryService } from '../src/services/saveEntryService.mjs';
import { createPlayerCloudPayloadFromAuthority, fingerprintPlayerCloudPayload } from '../src/services/playerCloudService.mjs';
import { AUTHORITY, GUARD, PENDING, ACKNOWLEDGED, WRITER_LOCK } from '../src/services/saveEpoch.mjs';
const OWNER='11111111-1111-4111-8111-111111111111', SLOT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OP='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const handles=[];afterEach(async()=>{for(const handle of handles.splice(0))await handle.close();installGameStorage(null);});
const dump=view=>Object.fromEntries(Array.from({length:view.length},(_,index)=>{const key=view.key(index);return [key,view.getItem(key)];}));
function lockManager(){let held=false;return {async request(key,_options,work){expect(key).toBe(WRITER_LOCK);if(held)return work(null);held=true;try{return await work({});}finally{held=false;}}};}
async function enter(view,locks){const service=createSaveEntryService({storage:view,locks});const inspect=await service.inspectSave(),prepared=await service.prepareEntry({intent:inspect.classification==='empty'?'create':'continue',snapshotToken:inspect.snapshotToken});expect(prepared.status).toBe('prepared');const committed=await service.commitEntry({ticket:prepared.ticket});expect(committed.status).toBe('committed');handles.push(committed.sessionHandle);await service.acknowledgeEntry({ticket:committed.ticket,sessionHandle:committed.sessionHandle});return committed;}
async function rig(){
 const storage=memoryStorage(),locks=lockManager();let allow=true,verified=true,count=0,failure=null;
 const assertAccess=()=>allow,repository=createAccountSaveSlots({storage,locks,assertAccess,canCreateSlot:()=>true});
 await repository.createSlot({ownerId:OWNER,slotId:SLOT});const view=repository.openStorage({ownerId:OWNER,slotId:SLOT}),current=await enter(view,locks);await current.sessionHandle.close();
 const before=dump(view),target=JSON.parse(before[AUTHORITY]),player=JSON.parse(target.values['newtone-player-save-v1']);player.walletBalance=401;target.values['newtone-player-save-v1']=JSON.stringify(player);target.revision+=5;
 const encoded=await fingerprintPlayerCloudPayload(createPlayerCloudPayloadFromAuthority(target));
 const input={ownerId:OWNER,slotId:SLOT,operationId:OP,expectedAuthorityRaw:before[AUTHORITY],expectedGuardRaw:before[GUARD],cloudRevision:'7',...encoded};
 const replace=createAccountCloudReplaceService({storage,locks,assertAccess,verifyResolution:async()=>verified,now:()=>123});
 for(const method of ['setItem','removeItem']){const original=storage[method];storage[method]=(...args)=>{count++;if(failure?.at===count&&failure.before)throw Error('injected');original(...args);if(failure?.at===count&&!failure.before)throw Error('injected');};}
 return {storage,locks,repository,view,before,input,replace,fail(at,before=false){count=0;failure={at,before};},clear(){count=0;failure=null;},deny(){allow=false;},denyReceipt(){verified=false;}};
}
test('explicit replacement retains complete original control evidence and installs chosen gameplay',async()=>{
 const r=await rig();expect((await r.replace.replace(r.input)).status).toBe('replaced');
 const record=JSON.parse(r.storage.getItem(cloudReplaceRecordKey(OWNER,SLOT,OP)));expect(record.phase).toBe('committed');expect(record.before).toEqual(r.before);
 const view=r.repository.openStorage({ownerId:OWNER,slotId:SLOT});expect(view.getItem(PENDING)).toBeNull();expect(view.getItem(ACKNOWLEDGED)).toBeNull();
 const current=await enter(view,r.locks);expect(JSON.parse(current.sessionHandle.storage.getItem('newtone-player-save-v1')).walletBalance).toBe(401);
 const backups=await r.replace.listBackups({ownerId:OWNER,slotId:SLOT});expect(backups).toHaveLength(1);expect(JSON.parse(JSON.parse(backups[0].payloadRaw).values['newtone-player-save-v1']).walletBalance).toBe(800);
});
test.each([1,2,3,4,5,6])('write/remove-then-throw at step %s is resumed from the same immutable backup',async at=>{
 const r=await rig();r.fail(at);expect((await r.replace.replace(r.input)).status).toBe('outcome-uncertain');r.clear();
 expect(['replaced','existing']).toContain((await r.replace.replace(r.input)).status);expect(JSON.parse(r.storage.getItem(cloudReplaceRecordKey(OWNER,SLOT,OP))).before).toEqual(r.before);
});
test.each([1,2,3,4,5,6])('failure before durable step %s preserves a recoverable operation',async at=>{
 const r=await rig();r.fail(at,true);expect((await r.replace.replace(r.input)).status).toBe('outcome-uncertain');r.clear();expect((await r.replace.replace(r.input)).status).toBe('replaced');
});
test('prepared replacement blocks old and new account storage views',async()=>{
 const r=await rig();r.fail(2,true);await r.replace.replace(r.input);r.clear();expect(()=>r.view.getItem(AUTHORITY)).toThrow('CLOUD_REPLACE_RECOVERY_REQUIRED');expect(()=>r.repository.openStorage({ownerId:OWNER,slotId:SLOT})).toThrow('CLOUD_REPLACE_RECOVERY_REQUIRED');
});
test('completed replacement retry never rewinds subsequent gameplay',async()=>{
 const r=await rig();await r.replace.replace(r.input);const current=await enter(r.repository.openStorage({ownerId:OWNER,slotId:SLOT}),r.locks);
 const p=JSON.parse(current.sessionHandle.storage.getItem('newtone-player-save-v1'));p.walletBalance=399;current.sessionHandle.storage.setItem('newtone-player-save-v1',JSON.stringify(p));await current.sessionHandle.close();
 const before=dump(r.storage);expect((await r.replace.replace(r.input)).status).toBe('existing');expect(dump(r.storage)).toEqual(before);
});
test('changed original authority rejects a stale conflict choice before any writes',async()=>{
 const r=await rig();const current=await enter(r.view,r.locks);await current.sessionHandle.close();const before=dump(r.storage);
 expect((await r.replace.replace(r.input)).reasonCodes).toContain('CLOUD_REPLACE_BASE_CHANGED');expect(dump(r.storage)).toEqual(before);
});
test('changed target bytes during partial recovery are never repaired by overwrite',async()=>{
 const r=await rig();r.fail(2,true);await r.replace.replace(r.input);r.clear();const key=[...Object.keys(dump(r.storage))].find(k=>k.endsWith(encodeURIComponent(AUTHORITY)));r.storage.setItem(key,'other bytes');const before=dump(r.storage);
 expect((await r.replace.replace(r.input)).reasonCodes).toContain('CLOUD_REPLACE_TARGET_CHANGED');expect(dump(r.storage)).toEqual(before);
});
test('unverified receipt and signed-out access reject replacement without writes',async()=>{
 for(const method of ['deny','denyReceipt']){const r=await rig(),before=dump(r.storage);r[method]();expect((await r.replace.replace(r.input)).status).toBe('blocked');expect(dump(r.storage)).toEqual(before);}
});
test('a pending replacement cannot be retargeted using another operation',async()=>{
 const r=await rig();r.fail(2,true);await r.replace.replace(r.input);r.clear();const before=dump(r.storage);expect((await r.replace.replace({...r.input,operationId:SLOT})).reasonCodes).toContain('OTHER_REPLACEMENT_PENDING');expect(dump(r.storage)).toEqual(before);
});
