import {test,expect,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {createSaveEntryService,AUTHORITY,PENDING,ACKNOWLEDGED,GUARD,PLAYER,BACKUP_PREFIX,RETIRED_PREFIX} from '../src/services/saveEntryService.mjs';
import {memoryStorage,installGameStorage} from '../src/save-session.mjs';
import {createEntryController} from '../src/services/entryController.mjs';
import {savePlayerSave} from '../src/center/runtime/playerSave.ts';
const handles=[];afterEach(async()=>{for(const h of handles.splice(0))await h.close();installGameStorage(null);});
const digest=text=>Promise.resolve(createHash('sha256').update(text).digest('hex'));
function lockManager(){let held=false;return {async request(_name,_options,callback){if(held)return callback(null);held=true;try{return await callback({});}finally{held=false;}}};}
let sequence=0;
function rig(raw=memoryStorage({[PLAYER]:'old original'}),locks=lockManager()){
 const owner=++sequence;let calls=0;return {raw,locks,calls:()=>calls,service:createSaveEntryService({storage:raw,locks,digest,uuid:()=>`retirement-${owner}-${++calls}`})};
}
const snapshot=raw=>Object.fromEntries(Array.from({length:raw.length},(_,i)=>[raw.key(i),raw.getItem(raw.key(i))]));
const retiredKeys=raw=>Object.keys(snapshot(raw)).filter(k=>k.startsWith(RETIRED_PREFIX));
async function prepared(r){const i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'restart',snapshotToken:i.snapshotToken});expect(p.status).toBe('prepared');return p;}
async function committed(r){const p=await prepared(r),c=await r.service.commitEntry({ticket:p.ticket});expect(c.status).toBe('committed');handles.push(c.sessionHandle);return c;}

test.each(['pending','backup','prepared-guard'])('stale during %s retires exact evidence, refreshes and requires a second explicit start',async stage=>{
 const r=rig(),set=r.raw.setItem.bind(r.raw);let inject=true;
 r.raw.setItem=(k,v)=>{set(k,v);if(inject&&((stage==='pending'&&k===PENDING)||(stage==='backup'&&k.startsWith(BACKUP_PREFIX))||(stage==='prepared-guard'&&k===GUARD&&JSON.parse(v).phase==='prepared'))){inject=false;set(PLAYER,'latest old progress');}};
 const controller=createEntryController(r.service);await controller.start();expect(controller.getState().phase).toBe('legacy-ready');await controller.submit('restart');expect(controller.getState().phase).toBe('failed');expect(r.raw.getItem(AUTHORITY)).toBeNull();
 const pendingRaw=r.raw.getItem(PENDING),ticket=JSON.parse(pendingRaw).ticket,guardRaw=r.raw.getItem(GUARD),backupRaw=r.raw.getItem(BACKUP_PREFIX+ticket.operationId),calls=r.calls();
 await controller.recheck();expect(controller.getState().phase).toBe('legacy-ready');expect(r.calls()).toBe(calls);expect(r.raw.getItem(AUTHORITY)).toBeNull();expect(retiredKeys(r.raw)).toHaveLength(1);
 const record=JSON.parse(r.raw.getItem(retiredKeys(r.raw)[0]));expect(record.pendingRaw).toBe(pendingRaw);expect(record.guardRaw).toBe(guardRaw);expect(record.backupRaw).toBe(backupRaw);expect(r.raw.getItem(PENDING)).toBe(pendingRaw);expect(r.raw.getItem(GUARD)).toBe(guardRaw);expect(r.raw.getItem(PLAYER)).toBe('latest old progress');
 expect((await r.service.commitEntry({ticket})).status).not.toBe('committed');expect((await r.service.getRecoveryState()).status).toBe('no-pending-operation');
 r.raw.setItem(PLAYER,'old original');expect((await r.service.resolveOperation({ticket})).status).toBe('superseded');expect(r.calls()).toBe(calls);r.raw.setItem(PLAYER,'latest old progress');
 const refreshed=rig(r.raw,r.locks),next=createEntryController(refreshed.service);await next.start();expect(next.getState().phase).toBe('legacy-ready');expect(refreshed.calls()).toBe(0);expect(next.back()).toBe(true);expect(refreshed.calls()).toBe(0);await next.recheck();expect(next.getState().phase).toBe('legacy-ready');
 await next.submit('restart');expect(next.getState().phase).toBe('entering');const c=next.getState().committed;handles.push(c.sessionHandle);expect(c.ticket.operationId).not.toBe(ticket.operationId);expect(c.snapshot.sources[PLAYER]).toBe('latest old progress');expect(JSON.parse(c.snapshot.values[PLAYER]).walletBalance).toBe(800);expect(JSON.parse(r.raw.getItem(retiredKeys(r.raw)[0]))).toEqual(record);
 savePlayerSave({...JSON.parse(c.snapshot.values[PLAYER]),walletBalance:650},c.sessionHandle.storage);expect(await next.acknowledgeEntered()).toBe(true);await c.sessionHandle.close();
 const again=rig(r.raw,r.locks);expect((await again.service.getRecoveryState()).status).toBe('no-pending-operation');expect((await again.service.inspectSave()).classification).toBe('generation-current');expect(JSON.parse(JSON.parse(r.raw.getItem(AUTHORITY)).values[PLAYER]).walletBalance).toBe(650);
});

test('retirement write failure keeps all evidence; later retry retires once without allocating another game',async()=>{
 const r=rig(),p=await prepared(r);r.raw.setItem(PLAYER,'changed');const set=r.raw.setItem.bind(r.raw);let deny=true;r.raw.setItem=(k,v)=>{if(k.startsWith(RETIRED_PREFIX)&&deny)throw Error('quota');set(k,v);};const before=snapshot(r.raw),calls=r.calls();
 expect((await r.service.resolveOperation({ticket:p.ticket})).status).toBe('unresolved');expect(snapshot(r.raw)).toEqual(before);expect(r.calls()).toBe(calls);deny=false;
 expect((await r.service.resolveOperation({ticket:p.ticket}))).toMatchObject({status:'superseded',resumeAllowed:false,reasonCodes:['UNCOMMITTED_OPERATION_RETIRED']});expect((await r.service.inspectSave()).classification).toBe('legacy-reset-required');expect(r.calls()).toBe(calls);const stored=snapshot(r.raw);expect((await r.service.resolveOperation({ticket:p.ticket})).status).toBe('superseded');expect(snapshot(r.raw)).toEqual(stored);
});

test('retirement write landed then threw: refresh recognizes the one durable retirement without auto-starting',async()=>{
 const r=rig(),p=await prepared(r);r.raw.setItem(PLAYER,'changed');const set=r.raw.setItem.bind(r.raw);let once=true;r.raw.setItem=(k,v)=>{set(k,v);if(k.startsWith(RETIRED_PREFIX)&&once){once=false;throw Error('lost retirement response');}};
 expect((await r.service.resolveOperation({ticket:p.ticket})).status).toBe('unresolved');const before=snapshot(r.raw);const next=rig(r.raw,r.locks),controller=createEntryController(next.service);await controller.start();expect(controller.getState().phase).toBe('legacy-ready');expect(snapshot(r.raw)).toEqual(before);expect(next.calls()).toBe(0);expect(retiredKeys(r.raw)).toHaveLength(1);
});

test('unchanged prepared source stays recoverable under its original ticket rather than being retired',async()=>{
 const r=rig(),p=await prepared(r),before=snapshot(r.raw);expect(await r.service.resolveOperation({ticket:p.ticket})).toMatchObject({status:'not-committed',resumeAllowed:true,ticket:p.ticket});expect(retiredKeys(r.raw)).toHaveLength(0);expect(snapshot(r.raw)).toEqual(before);const c=await r.service.commitEntry({ticket:p.ticket});expect(c.status).toBe('committed');handles.push(c.sessionHandle);expect(c.ticket).toEqual(p.ticket);
});

test('other tab holding the lease cannot retire by reading a ticket',async()=>{
 const r=rig(),p=await prepared(r);r.raw.setItem(PLAYER,'changed');const other=rig(r.raw,r.locks),before=snapshot(r.raw);expect((await other.service.resolveOperation({ticket:p.ticket})).status).toBe('busy');expect(snapshot(r.raw)).toEqual(before);expect(retiredKeys(r.raw)).toHaveLength(0);expect((await r.service.resolveOperation({ticket:p.ticket})).status).toBe('superseded');
});

test('committed authority wins over old source changes and recovers actual balance',async()=>{
 const r=rig(),c=await committed(r);savePlayerSave({...JSON.parse(c.snapshot.values[PLAYER]),walletBalance:650},c.sessionHandle.storage);await c.sessionHandle.close();r.raw.setItem(PLAYER,'late old source');const before=r.raw.getItem(AUTHORITY),next=rig(r.raw,r.locks),result=await next.service.resolveOperation({ticket:c.ticket});expect(result.status).toBe('committed');handles.push(result.sessionHandle);expect(JSON.parse(result.snapshot.values[PLAYER]).walletBalance).toBe(650);expect(r.raw.getItem(AUTHORITY)).toBe(before);expect(retiredKeys(r.raw)).toHaveLength(0);
});

test('committed guard with missing authority never becomes a retired operation or a fresh 800',async()=>{
 const r=rig(),c=await committed(r);await c.sessionHandle.close();r.raw.removeItem(AUTHORITY);r.raw.setItem(PLAYER,'changed');const before=snapshot(r.raw);expect((await r.service.resolveOperation({ticket:c.ticket})).status).toBe('unresolved');expect((await r.service.getRecoveryState()).status).toBe('blocked');expect(snapshot(r.raw)).toEqual(before);expect(retiredKeys(r.raw)).toHaveLength(0);
});

test('authority write succeeded but response was lost: prepared guard must resolve commit, never retire',async()=>{
 const r=rig(),p=await prepared(r),set=r.raw.setItem.bind(r.raw);let once=true;r.raw.setItem=(k,v)=>{set(k,v);if(k===AUTHORITY&&once){once=false;throw Error('lost main response');}};expect((await r.service.commitEntry({ticket:p.ticket})).status).toBe('outcome-uncertain');r.raw.setItem(PLAYER,'changed after real main write');expect(JSON.parse(r.raw.getItem(GUARD)).phase).toBe('prepared');const authority=r.raw.getItem(AUTHORITY),next=rig(r.raw,r.locks),c=await next.service.resolveOperation({ticket:p.ticket});expect(c.status).toBe('committed');handles.push(c.sessionHandle);expect(r.raw.getItem(AUTHORITY)).toBe(authority);expect(retiredKeys(r.raw)).toHaveLength(0);
});

test('unreadable authority or tampered pending never proves non-commit',async()=>{
 const r=rig(),p=await prepared(r);r.raw.setItem(PLAYER,'changed');const get=r.raw.getItem.bind(r.raw);r.raw.getItem=k=>{if(k===AUTHORITY)throw Error('storage unavailable');return get(k);};expect((await r.service.resolveOperation({ticket:p.ticket})).status).toBe('unresolved');r.raw.getItem=get;expect(retiredKeys(r.raw)).toHaveLength(0);
 const record=JSON.parse(r.raw.getItem(PENDING));record.candidateSHA256='incorrect';r.raw.setItem(PENDING,JSON.stringify(record));const before=snapshot(r.raw);expect((await r.service.resolveOperation({ticket:p.ticket})).status).toBe('unresolved');expect(snapshot(r.raw)).toEqual(before);expect(retiredKeys(r.raw)).toHaveLength(0);
});

test('real orphan prepared guard/backup and invalid retirement integrity remain protected',async()=>{
 const r=rig(),p=await prepared(r),set=r.raw.setItem.bind(r.raw);r.raw.setItem=(k,v)=>{set(k,v);if(k===GUARD&&JSON.parse(v).phase==='prepared')set(PLAYER,'changed');};expect((await r.service.commitEntry({ticket:p.ticket})).status).toBe('stale');r.raw.setItem=set;
 const pendingRaw=r.raw.getItem(PENDING);r.raw.removeItem(PENDING);expect((await r.service.getRecoveryState()).status).toBe('blocked');expect((await r.service.inspectSave()).allowedActions).toEqual(['back','reinspect']);r.raw.setItem(PENDING,pendingRaw);
 expect((await r.service.resolveOperation({ticket:p.ticket})).status).toBe('superseded');const key=retiredKeys(r.raw)[0],record=JSON.parse(r.raw.getItem(key));record.recordHash='bad';r.raw.setItem(key,JSON.stringify(record));const before=snapshot(r.raw);expect((await r.service.getRecoveryState()).status).toBe('blocked');expect((await r.service.inspectSave()).allowedActions).toEqual(['back','reinspect']);expect(snapshot(r.raw)).toEqual(before);
});

test('a stale current-generation replacement cannot use initial-bootstrap retirement',async()=>{
 const r=rig(),c=await committed(r),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'replace',snapshotToken:i.snapshotToken,overwriteConfirmed:true});expect(p.status).toBe('prepared');const a=JSON.parse(r.raw.getItem(AUTHORITY)),player=JSON.parse(a.values[PLAYER]);a.values[PLAYER]=JSON.stringify({...player,walletBalance:650});r.raw.setItem(AUTHORITY,JSON.stringify(a));const before=snapshot(r.raw);
 expect((await r.service.resolveOperation({ticket:p.ticket})).status).toBe('unresolved');expect(snapshot(r.raw)).toEqual(before);expect(retiredKeys(r.raw)).toHaveLength(0);expect(c.sessionHandle.isOpen).toBe(false);
});

test('invalid isolated pending is blocked before stale-token classification and UI recheck never starts a game',async()=>{
 const r=rig(memoryStorage({[PLAYER]:'old original',[PENDING]:'{broken pending'})),before=snapshot(r.raw);
 const i=await r.service.inspectSave();expect(i.allowedActions).toEqual(['back','reinspect']);expect(i.snapshotToken).toBeNull();
 const result=await r.service.prepareEntry({intent:'restart',snapshotToken:i.snapshotToken});expect(result).toMatchObject({status:'blocked',reasonCodes:['INVALID_JSON']});expect(snapshot(r.raw)).toEqual(before);expect(r.calls()).toBe(0);
 let prepares=0,commits=0,writes=0;const set=r.raw.setItem.bind(r.raw),remove=r.raw.removeItem.bind(r.raw);r.raw.setItem=(...args)=>{writes++;return set(...args);};r.raw.removeItem=(...args)=>{writes++;return remove(...args);};const observed={...r.service,prepareEntry(...args){prepares++;return r.service.prepareEntry(...args);},commitEntry(...args){commits++;return r.service.commitEntry(...args);}};
 const controller=createEntryController(observed);await controller.start();expect(controller.getState().phase).toBe('failed');expect(await controller.submit('restart')).toBe(false);await controller.recheck();expect(controller.getState().phase).toBe('failed');expect(prepares).toBe(0);expect(commits).toBe(0);expect(writes).toBe(0);expect(r.calls()).toBe(0);expect(snapshot(r.raw)).toEqual(before);expect(retiredKeys(r.raw)).toHaveLength(0);
});
