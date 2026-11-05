import {test,expect,afterEach,vi} from 'vitest';
import historicalInputs from './fixtures/historical-save-epoch-inputs.json';
import {createHash} from 'node:crypto';
import {createSaveEntryService,SAVE_EPOCH,AUTHORITY,PENDING,PLAYER,ACKNOWLEDGED,GUARD,BACKUP_PREFIX} from '../src/services/saveEntryService.mjs';
import {memoryStorage,installGameStorage,JOURNAL} from '../src/save-session.mjs';
import {createRuntimeSaveLifecycle} from '../src/center/runtime/runtimeSaveLifecycle.mjs';
import {createGameTimeSaveCheckpoint,createPositionSaveCoordinator,recordPlayerScenePosition,attachPositionSaveLifecycle} from '../src/center/runtime/playerSave.ts';
import {createInitialPlayerSave,savePlayerSave,sanitizePlayerSave} from '../src/center/runtime/playerSave.ts';
import {commercialCafeStoryStatePatch,initialCommercialCafeStoryState} from '../src/center/runtime/commercialCafeStory.ts';
import {createEntryController} from '../src/services/entryController.mjs';
const handles=[];afterEach(async()=>{for(const h of handles.splice(0))await h.close();installGameStorage(null);vi.unstubAllGlobals();});
const hash=text=>Promise.resolve(createHash('sha256').update(text).digest('hex'));
function lockManager(){let occupied=false;return {request:async(_key,_options,callback)=>{if(occupied)return callback(null);occupied=true;try{return await callback({name:'test-lock'});}finally{occupied=false;}}};}
let rigId=0;
function rig(raw=memoryStorage(),locks=lockManager()){let calls=0;const id=++rigId;const service=createSaveEntryService({storage:raw,locks,digest:hash,uuid:()=>`test-${id}-${++calls}`});return {raw,service,locks,uuidCalls:()=>calls};}
function save(scene='jijia-ancestral-home',phone='surface',version=2){return {...createInitialPlayerSave(scene),_version:version,phoneDevice:phone,walletBalance:650,updatedAt:55,sceneState:{'jijia-ancestral-home':{'interactionExplored:ancestor':true},'commercial-cafe':commercialCafeStoryStatePatch(initialCommercialCafeStoryState())},shopOrderHistory:[]};}
const snapshot=raw=>Object.fromEntries(Array.from({length:raw.length},(_,i)=>[raw.key(i),raw.getItem(raw.key(i))]));
async function choose(r,intent,overwriteConfirmed=false){const inspection=await r.service.inspectSave();const p=await r.service.prepareEntry({intent,snapshotToken:inspection.snapshotToken,overwriteConfirmed});expect(p.status).toBe('prepared');const result=await r.service.commitEntry({ticket:p.ticket});expect(result.status).toBe('committed');handles.push(result.sessionHandle);return result;}
async function acknowledge(r,c){expect((await r.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:c.sessionHandle})).status).toBe('acknowledged');}
function freshAssertions(c){
 const p=JSON.parse(c.snapshot.values[PLAYER]);expect(c.snapshot.saveEpoch).toBe(SAVE_EPOCH);expect(c.snapshot.placement.result).toBe('new-exempt');
 expect(p).toMatchObject({walletBalance:800,currentSceneId:'commercial-street',phoneDevice:'inner',storyClock:{year:2025,month:4,day:12,hour:10,minute:0},gameTimeMs:36_000_000,shopOrders:{},shopOrderHistory:[],shopOrderPaymentReceipts:{},monthlySalaryReceipts:{},cafeStoryDeliveries:{},heldConsumable:null,phoneContactNotes:{},phoneCallHistory:[],phoneNotifications:[]});
 expect(Object.keys(p.sceneState)).toEqual(['commercial-street']);expect(p.sceneState['commercial-street']).toMatchObject({laoZhouOpeningPromptStatus:'pending',laoZhouConversationTriggered:false});
 return p;
}
// Shape labels are synthetic representative inputs, not claims that a historical writer ran here.
const initial=createInitialPlayerSave('commercial-street');
const families=[
 ['C01', {_version:1,currentSceneId:'commercial-street',currentPosition:null,scenePositions:{},phoneDevice:'surface',sceneState:{},updatedAt:0}],
 ['C02', {_version:1,currentSceneId:'commercial-street',currentPosition:null,scenePositions:{},phoneDevice:'surface',sceneState:{},phoneNotifications:[],updatedAt:0}],
 ...['C03','C04','C05'].map((id,index)=>[id,{...save('commercial-cafe','inner',1),storyClock:index===0?{dayId:'story-day-001',stage:'cafe'}:{dayId:'story-day-001',stage:'cafe',month:4,day:12,hour:12,minute:0}}]),
 ...['C06','C07','C08','C09','C10','C11','C12','C13','C14'].map((id,index)=>[id,{...save(),worldGridVersion:1,miningLayoutVersion:index<4?2:3,storyClock:{dayId:'story-day-001',stage:'cafe',month:4,day:12}}]),
 ['C15',Object.fromEntries(Object.entries(save()).filter(([k])=>k!=='shopOrderHistory'))],['C16',save()],['damaged JSON','{bad-old-json'],['unknown schema in retired key',{_version:999,gameFacts:'do not import'}],
];
test.each(families)('%s old raw is archived exactly and starts genuinely fresh',async(_label,value)=>{
 const original=typeof value==='string'?value:JSON.stringify(value,null,2),r=rig(memoryStorage({[PLAYER]:original,'unrelated':'leave me'})),before=snapshot(r.raw);
 const i=await r.service.inspectSave();expect(i).toMatchObject({classification:'legacy-reset-required',allowedActions:['restart','back']});expect(snapshot(r.raw)).toEqual(before);expect(r.uuidCalls()).toBe(0);
 expect((await r.service.prepareEntry({intent:'continue',snapshotToken:i.snapshotToken})).status).toBe('blocked');expect(snapshot(r.raw)).toEqual(before);
 const c=await choose(r,'restart');freshAssertions(c);expect(c.snapshot.sources[PLAYER]).toBe(original);expect(r.raw.getItem(PLAYER)).toBe(original);expect(r.raw.getItem('unrelated')).toBe('leave me');
 const backup=JSON.parse(r.raw.getItem(BACKUP_PREFIX+c.ticket.operationId));expect(backup.sourceRaw[PLAYER]).toBe(original);expect(JSON.parse(r.raw.getItem(GUARD)).phase).toBe('committed');
});
test.each([
 {'newtone-save-entry-authority-v2':'{broken authority','newtone-save-entry-pending-v2':'{old pending','newtone-save-entry-acknowledged-v2':'old ack','newtone-save-entry-backup-v2:prior':'prior bytes'},
 {'newtone-isolated-save-journal-v1':'{old journal','newtone-save-migration-v1-raw':'old original','newtone-save-migration-v1-done':'journal-v1'},
 {'newtone.mainline.carried-phone.v1':'surface','newtone.mainline.scene-positions.v1':'{old point'},
 {'newtone-progress-v4':'{Reader only','newtone-narrative-progress-v1':'{old event'},
 {[PLAYER]:JSON.stringify(save()),'newtone-progress-v4':'{mixed bad Reader'},
])('old credentials/partial/Reader/mixed profile cannot replay old pending %#',async(old)=>{
 const r=rig(memoryStorage(old));expect((await r.service.getRecoveryState()).status).toBe('no-pending-operation');const c=await choose(r,'restart');freshAssertions(c);for(const [k,v] of Object.entries(old)){expect(r.raw.getItem(k)).toBe(v);expect(c.snapshot.sources[k]).toBe(v);}
});
test('only opening/returning/cancelling the notice has no writes or random initialization',async()=>{
 const r=rig(memoryStorage({[PLAYER]:'old raw'})),controller=createEntryController(r.service),before=snapshot(r.raw);await controller.start();expect(controller.getState().phase).toBe('legacy-ready');expect(controller.back()).toBe(true);expect(snapshot(r.raw)).toEqual(before);expect(r.uuidCalls()).toBe(0);await controller.recheck();expect(controller.getState().phase).toBe('legacy-ready');expect(snapshot(r.raw)).toEqual(before);
});
test('controller synchronously rejects duplicate restart input and acknowledges only one generation',async()=>{
 const r=rig(memoryStorage({[PLAYER]:'old raw'})),controller=createEntryController(r.service);await controller.start();const first=controller.submit('restart');expect(await controller.submit('restart')).toBe(false);await first;const c=controller.getState().committed;expect(c.status).toBe('committed');handles.push(c.sessionHandle);freshAssertions(c);expect(await controller.acknowledgeEntered()).toBe(true);expect(Object.keys(snapshot(r.raw)).filter(k=>k.startsWith(BACKUP_PREFIX))).toHaveLength(1);
});
test('empty create and replay grant exactly once; facade shares the new namespace',async()=>{
 const r=rig(),c=await choose(r,'create'),p=freshAssertions(c);expect(JOURNAL).toBe(AUTHORITY);savePlayerSave({...p,walletBalance:790},c.sessionHandle.storage);const before=r.raw.getItem(AUTHORITY),again=await r.service.commitEntry({ticket:c.ticket});expect(again.status).toBe('committed');handles.push(again.sessionHandle);expect(r.raw.getItem(AUTHORITY)).toBe(before);expect(JSON.parse(again.snapshot.values[PLAYER]).walletBalance).toBe(790);
});
test('current new-game cancellation is zero writes; replacement requires explicit confirmation',async()=>{
 const r=rig(),c=await choose(r,'create');await acknowledge(r,c);await c.sessionHandle.close();const controller=createEntryController(r.service);await controller.start();expect(controller.getState().phase).toBe('choice-ready');const before=snapshot(r.raw),calls=r.uuidCalls();expect(controller.requestReplace()).toBe(true);expect(controller.cancelReplace()).toBe(true);expect(snapshot(r.raw)).toEqual(before);expect(r.uuidCalls()).toBe(calls);
 const i=await r.service.inspectSave();expect((await r.service.prepareEntry({intent:'replace',snapshotToken:i.snapshotToken})).status).toBe('blocked');expect(snapshot(r.raw)).toEqual(before);const next=await choose(r,'replace',true);freshAssertions(next);expect(next.snapshot.generation.id).not.toBe(c.snapshot.generation.id);expect(JSON.parse(r.raw.getItem(BACKUP_PREFIX+next.ticket.operationId)).authorityRaw).toBe(before[AUTHORITY]);
});
test('ordinary refresh/update and later surface return preserve current facts and balance',async()=>{
 const r=rig(memoryStorage({[PLAYER]:JSON.stringify(save())})),c=await choose(r,'restart'),p=JSON.parse(c.snapshot.values[PLAYER]);
 const progressed=sanitizePlayerSave({...p,walletBalance:650,currentSceneId:'zhongshuyuan-office',phoneDevice:'surface',sceneState:{...p.sceneState,'jijia-ancestral-home':{'interactionExplored:ancestor':true}}},'zhongshuyuan-office');
 savePlayerSave(progressed,c.sessionHandle.storage);await acknowledge(r,c);await c.sessionHandle.close();const next=rig(r.raw,r.locks);expect((await next.service.getRecoveryState()).status).toBe('no-pending-operation');const again=await choose(next,'continue');expect(again.snapshot.generation).toEqual(c.snapshot.generation);expect(JSON.parse(again.snapshot.values[PLAYER])).toMatchObject({walletBalance:650,currentSceneId:'zhongshuyuan-office',phoneDevice:'surface',sceneState:{'jijia-ancestral-home':{'interactionExplored:ancestor':true}}});
});
test('preferences and independent guidance survive without importing Reader/story/layout or claiming audio',async()=>{
 const reader=JSON.stringify({_version:4,language:'en',themePosition:1,motionMode:'reduced',readerCompleted:true,committedLocation:{old:'page'}}),oldAuthority=JSON.stringify({values:{'newtone-progress-v4':reader,'newtone-landing-intro-v1':'true'}}),raw=memoryStorage({'newtone-save-entry-authority-v2':oldAuthority,'newtone:center:scene-layout:test:v3':'{old layout'}),r=rig(raw);
 const i=await r.service.inspectSave();expect(i.preview).toMatchObject({preferences:{language:'en',themePosition:1,motionMode:'reduced'},landingIntro:{status:'learned'}});const c=await choose(r,'restart');const prefs=JSON.parse(c.snapshot.values['newtone-progress-v4']);expect(prefs).toMatchObject({language:'en',themePosition:1,motionMode:'reduced',readerCompleted:false,readerStarted:false});expect(c.snapshot.values['newtone-landing-intro-v1']).toBe('true');expect(c.snapshot.values['newtone:center:scene-layout:test:v3']).toBeUndefined();expect(raw.getItem('newtone-save-entry-authority-v2')).toBe(oldAuthority);
});
test.each([AUTHORITY,GUARD,PENDING,ACKNOWLEDGED,BACKUP_PREFIX+'orphan'])('new namespace bad/orphan %s is protected rather than reset',async key=>{
 const r=rig(memoryStorage({[key]:'{broken',[PLAYER]:'old raw'})),before=snapshot(r.raw),i=await r.service.inspectSave();expect(i.allowedActions).toEqual(['back','reinspect']);expect((await r.service.getRecoveryState()).status).toBe('blocked');expect((await r.service.prepareEntry({intent:'restart',snapshotToken:i.snapshotToken})).status).toBe('blocked');expect(snapshot(r.raw)).toEqual(before);
});
test.each(['newtone-persistence:era-2:authority','newtone-persistence:era-1:unknown','newtone-player-save-future','newtone.mainline.future'])('uncertain namespace %s is not inferred old',async key=>{const r=rig(memoryStorage({[key]:'unknown'})),i=await r.service.inspectSave();expect(i.allowedActions).toEqual(['back','reinspect']);expect(r.raw.getItem(PENDING)).toBeNull();expect(r.raw.getItem(key)).toBe('unknown');});
test('damaged current player and missing guard cannot fall back to preserved old source',async()=>{
 const r=rig(memoryStorage({[PLAYER]:'old raw'})),c=await choose(r,'restart');await c.sessionHandle.close();const a=JSON.parse(r.raw.getItem(AUTHORITY));a.values[PLAYER]=JSON.stringify({_version:2,walletBalance:650});r.raw.setItem(AUTHORITY,JSON.stringify(a));const before=snapshot(r.raw);expect((await r.service.inspectSave()).allowedActions).toEqual(['back','reinspect']);expect(snapshot(r.raw)).toEqual(before);r.raw.removeItem(GUARD);expect((await r.service.inspectSave()).allowedActions).toEqual(['back','reinspect']);
});
test('changed legacy source before prepare or commit is stale, never overwritten',async()=>{
 const r=rig(memoryStorage({[PLAYER]:'old raw'})),i=await r.service.inspectSave();r.raw.setItem(PLAYER,'changed');expect((await r.service.prepareEntry({intent:'restart',snapshotToken:i.snapshotToken})).status).toBe('stale');const current=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'restart',snapshotToken:current.snapshotToken});r.raw.setItem(PLAYER,'changed again');expect((await r.service.commitEntry({ticket:p.ticket})).status).toBe('stale');expect(r.raw.getItem(AUTHORITY)).toBeNull();expect(r.raw.getItem(PLAYER)).toBe('changed again');
});
test('retired source churn/cutover after commit never freezes or grows new authority',async()=>{
 const r=rig(memoryStorage({[PLAYER]:'old raw','newtone-progress-v4':'initial Reader'})),c=await choose(r,'restart'),baseline=r.raw.getItem(AUTHORITY);for(let i=0;i<4;i++){r.raw.setItem(PLAYER,'late old save '+i);r.raw.setItem('newtone-progress-v4',String(i).repeat(100000));c.sessionHandle.check();expect(r.raw.getItem(AUTHORITY)).toBe(baseline);}r.raw.removeItem(PLAYER);r.raw.removeItem('newtone-progress-v4');c.sessionHandle.check();savePlayerSave({...JSON.parse(c.snapshot.values[PLAYER]),walletBalance:750},c.sessionHandle.storage);expect(JSON.parse(JSON.parse(r.raw.getItem(AUTHORITY)).values[PLAYER]).walletBalance).toBe(750);expect(c.snapshot.sources[PLAYER]).toBe('old raw');
});
test.each([PENDING,BACKUP_PREFIX,GUARD])('quota at %s never deletes old raw or publishes a game',async stage=>{
 const r=rig(memoryStorage({[PLAYER]:'old bytes'})),set=r.raw.setItem.bind(r.raw);r.raw.setItem=(k,v)=>{if(k===stage||k.startsWith(stage)&&stage===BACKUP_PREFIX)throw Error('quota');set(k,v);};const i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'restart',snapshotToken:i.snapshotToken});if(stage===PENDING)expect(p.status).toBe('outcome-uncertain');else{expect(p.status).toBe('prepared');expect((await r.service.commitEntry({ticket:p.ticket})).status).toBe('not-committed');}expect(r.raw.getItem(PLAYER)).toBe('old bytes');expect(r.raw.getItem(AUTHORITY)).toBeNull();
});
test('backup failure resumes the same ticket without randomizing or regranting',async()=>{
 const r=rig(),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken}),set=r.raw.setItem.bind(r.raw);let deny=true;r.raw.setItem=(k,v)=>{if(deny&&k.startsWith(BACKUP_PREFIX))throw Error('quota');set(k,v);};expect((await r.service.commitEntry({ticket:p.ticket})).status).toBe('not-committed');const calls=r.uuidCalls();deny=false;const recovery=await rig(r.raw,r.locks).service.getRecoveryState();expect(recovery.ticket).toEqual(p.ticket);const c=await r.service.commitEntry({ticket:p.ticket});expect(c.status).toBe('committed');handles.push(c.sessionHandle);freshAssertions(c);expect(r.uuidCalls()).toBe(calls);
});
test.each([AUTHORITY,GUARD])('write-landed response loss at %s recovers one operation',async stage=>{
 const r=rig(),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken}),set=r.raw.setItem.bind(r.raw);let once=true;r.raw.setItem=(k,v)=>{set(k,v);if(k===stage&&once){once=false;throw Error('response lost');}};const result=await r.service.commitEntry({ticket:p.ticket});expect(result.status).not.toBe('committed');const next=rig(r.raw,r.locks),recovery=await next.service.getRecoveryState();expect(recovery.ticket).toEqual(p.ticket);const resolved=await next.service.resolveOperation({ticket:p.ticket});const c=resolved.status==='not-committed'?await next.service.commitEntry({ticket:p.ticket}):resolved;expect(c.status).toBe('committed');handles.push(c.sessionHandle);expect(c.ticket).toEqual(p.ticket);freshAssertions(c);
});
test('published save lost before ACK cannot replay initial pending or reissue 800',async()=>{const r=rig(),c=await choose(r,'create');savePlayerSave({...JSON.parse(c.snapshot.values[PLAYER]),walletBalance:700},c.sessionHandle.storage);await c.sessionHandle.close();r.raw.removeItem(AUTHORITY);const before=snapshot(r.raw);expect((await r.service.getRecoveryState()).status).toBe('blocked');expect((await r.service.commitEntry({ticket:c.ticket})).status).not.toBe('committed');expect(snapshot(r.raw)).toEqual(before);});
test('normal ACK refresh shows choices and retains evidence',async()=>{const r=rig(),c=await choose(r,'create');expect((await r.service.getRecoveryState()).phase).toBe('committed');await acknowledge(r,c);await c.sessionHandle.close();const next=rig(r.raw,r.locks);expect((await next.service.getRecoveryState()).status).toBe('no-pending-operation');expect((await next.service.inspectSave()).allowedActions).toEqual(['continue','request-replace']);expect(r.raw.getItem(PENDING)).not.toBeNull();});
test('another tab cannot resolve by receipt while first owns lease',async()=>{const r=rig(),c=await choose(r,'create'),next=rig(r.raw,r.locks);expect((await next.service.resolveOperation({ticket:c.ticket})).status).toBe('busy');await c.sessionHandle.close();const recovered=await next.service.resolveOperation({ticket:c.ticket});expect(recovered.status).toBe('committed');handles.push(recovered.sessionHandle);expect(recovered.snapshot.generation).toEqual(c.snapshot.generation);});
test('ACK write then throw closes old handle, preserves money and never rewrites authority on resolution',async()=>{
 const r=rig(),c=await choose(r,'create');savePlayerSave({...JSON.parse(c.snapshot.values[PLAYER]),walletBalance:750},c.sessionHandle.storage);const before=r.raw.getItem(AUTHORITY),set=r.raw.setItem.bind(r.raw);let once=true,writes=0;r.raw.setItem=(k,v)=>{if(k===AUTHORITY)writes++;set(k,v);if(k===ACKNOWLEDGED&&once){once=false;throw Error('lost ack');}};expect((await r.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:c.sessionHandle})).status).toBe('outcome-uncertain');expect(c.sessionHandle.isOpen).toBe(false);const next=rig(r.raw,r.locks),again=await next.service.resolveOperation({ticket:c.ticket});expect(again.status).toBe('committed');handles.push(again.sessionHandle);expect(JSON.parse(again.snapshot.values[PLAYER]).walletBalance).toBe(750);expect(r.raw.getItem(AUTHORITY)).toBe(before);expect(writes).toBe(0);
});
test('tampered pending candidate is refused before authority write',async()=>{const r=rig(),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken}),record=JSON.parse(r.raw.getItem(PENDING)),candidate=JSON.parse(record.candidateRaw);candidate.values[PLAYER]=JSON.stringify({...JSON.parse(candidate.values[PLAYER]),walletBalance:9999});record.candidateRaw=JSON.stringify(candidate);r.raw.setItem(PENDING,JSON.stringify(record));expect((await r.service.commitEntry({ticket:p.ticket})).status).not.toBe('committed');expect(r.raw.getItem(AUTHORITY)).toBeNull();});
test('storage failure and rejected locking never fall back to a writable fresh game',async()=>{
 const unreadable=rig({get length(){throw Error('storage denied');},getItem(){throw Error('storage denied');}});expect((await unreadable.service.inspectSave()).status).toBe('unavailable');
 const r=rig(memoryStorage(),{request:()=>Promise.reject(Error('locks rejected'))}),i=await r.service.inspectSave();expect((await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken})).status).toBe('blocked');expect(r.raw.getItem(AUTHORITY)).toBeNull();
});

test('ack failure clears mounted monitor and listeners before returning',async()=>{
  const timers=new Set(),events=new Set(),docEvents=new Set();vi.stubGlobal('window',{setInterval:()=>{timers.add(1);return 1},clearInterval:id=>timers.delete(id),addEventListener:type=>events.add(type),removeEventListener:type=>events.delete(type),document:{addEventListener:type=>docEvents.add(type),removeEventListener:type=>docEvents.delete(type)}});
  const r=rig(),c=await choose(r,'create'),set=r.raw.setItem.bind(r.raw);expect(timers.size).toBe(1);r.raw.setItem=(k,v)=>{if(k===ACKNOWLEDGED)throw Error('quota');set(k,v)};
  expect((await r.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:c.sessionHandle})).status).toBe('outcome-uncertain');expect(timers.size).toBe(0);expect(events.size).toBe(0);expect(docEvents.size).toBe(0);expect(()=>c.sessionHandle.check()).toThrow();
});

// A native request may finish after its callback's promise is resolved. The old
// synchronous-ish mock never held the lock through this handoff window.
function delayedReleaseLocks(){
  let occupied=false,nextDelay=null;
  return {
    delayNextRelease(){
      let entered,finish;
      const started=new Promise(resolve=>{entered=resolve;});
      const gate=new Promise(resolve=>{finish=resolve;});
      nextDelay={entered,gate};
      return {started,finish};
    },
    async request(_key,_options,callback){
      if(occupied)return callback(null);
      occupied=true;
      try{return await callback({name:'native-shaped-lock'});}
      finally{const delay=nextDelay;nextDelay=null;if(delay){delay.entered();await delay.gate;}occupied=false;}
    },
  };
}
test('prepared recovery waits for native request release before same-ticket commit',async()=>{
  const locks=delayedReleaseLocks(),r=rig(memoryStorage(),locks),inspection=await r.service.inspectSave();
  const prepared=await r.service.prepareEntry({intent:'create',snapshotToken:inspection.snapshotToken});
  expect(prepared.status).toBe('prepared');
  const originalPending=r.raw.getItem(PENDING),gate=locks.delayNextRelease();
  let returned=false;
  const resolving=r.service.resolveOperation({ticket:prepared.ticket}).then(result=>{returned=true;return result;});
  await gate.started;
  await Promise.resolve();
  const premature=returned;
  // This is genuinely still another owner's lock, not permission to bypass it.
  const other=rig(r.raw,locks),blocked=await other.service.resolveOperation({ticket:prepared.ticket});
  gate.finish();
  const resolved=await resolving;
  expect(premature).toBe(false);
  expect(blocked).toMatchObject({status:'busy',reasonCodes:['ANOTHER_SESSION_ACTIVE']});
  expect(resolved).toMatchObject({status:'not-committed',resumeAllowed:true,ticket:prepared.ticket});
  const committed=await r.service.commitEntry({ticket:resolved.ticket});
  expect(committed.status).toBe('committed');handles.push(committed.sessionHandle);
  expect(committed.receipt.operationId).toBe(prepared.ticket.operationId);
  expect(r.raw.getItem(PENDING)).toBe(originalPending);
  expect(JSON.parse(committed.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(800);
  const updated=JSON.parse(committed.sessionHandle.storage.getItem(PLAYER));
  savePlayerSave({...updated,walletBalance:750},committed.sessionHandle.storage);
  await committed.sessionHandle.close();
  const recovered=await other.service.resolveOperation({ticket:prepared.ticket});
  expect(recovered.status).toBe('committed');handles.push(recovered.sessionHandle);
  expect(recovered.snapshot.generation).toEqual(committed.snapshot.generation);
  expect(JSON.parse(recovered.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(750);
});
test('prepare write landed but threw: release completes before uncertain result permits recovery',async()=>{
  const locks=delayedReleaseLocks(),r=rig(memoryStorage(),locks),inspection=await r.service.inspectSave();
  const set=r.raw.setItem.bind(r.raw);let inject=true;
  r.raw.setItem=(key,value)=>{set(key,value);if(key===PENDING&&inject){inject=false;throw Error('prepare response lost');}};
  const gate=locks.delayNextRelease();let returned=false;
  const preparing=r.service.prepareEntry({intent:'create',snapshotToken:inspection.snapshotToken}).then(result=>{returned=true;return result;});
  await gate.started;await Promise.resolve();const premature=returned;
  gate.finish();const uncertain=await preparing;
  expect(premature).toBe(false);
  expect(uncertain).toMatchObject({status:'outcome-uncertain',reasonCodes:['prepare response lost']});
  expect(r.raw.getItem(AUTHORITY)).toBeNull();
  const next=rig(r.raw,locks),pending=await next.service.getRecoveryState();
  expect(pending.ticket).toEqual(uncertain.ticket);
  const resolved=await next.service.resolveOperation({ticket:pending.ticket});
  expect(resolved).toMatchObject({status:'not-committed',resumeAllowed:true});
  const committed=await next.service.commitEntry({ticket:resolved.ticket});
  expect(committed.status).toBe('committed');handles.push(committed.sessionHandle);
  expect(JSON.parse(committed.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(800);
  expect(Array.from({length:r.raw.length},(_,i)=>r.raw.key(i)).filter(key=>key.startsWith(BACKUP_PREFIX))).toHaveLength(1);
});
function boundRuntime(committed){
  let saved=JSON.parse(committed.sessionHandle.storage.getItem(PLAYER)),publications=0;
  const lifecycle=createRuntimeSaveLifecycle(committed.sessionHandle.storage,committed.sessionHandle);
  const disconnect=lifecycle.connect();
  const publish=next=>{publications++;saved=next;};
  const coordinator=createPositionSaveCoordinator({getSave:()=>saved,setSave:publish,getCurrentSceneId:()=>saved.currentSceneId,recordPosition:recordPlayerScenePosition,canPersist:lifecycle.canPersist,persist:next=>savePlayerSave(next,committed.sessionHandle.storage)});
  const checkpoint=createGameTimeSaveCheckpoint({getSave:()=>saved,setSave:publish,getGameTimeMs:()=>saved.gameTimeMs+60_000,canPersist:lifecycle.canPersist,persist:next=>savePlayerSave(next,committed.sessionHandle.storage)});
  const clear=lifecycle.onStop(()=>coordinator.clear());
  return {lifecycle,coordinator,checkpoint,read:()=>saved,publications:()=>publications,dispose:()=>{clear();disconnect();}};
}
test('valid runtime unmount flushes position and clock once, using the captured storage',async()=>{
  const r=rig(),committed=await choose(r,'create'),runtime=boundRuntime(committed);
  const revision=JSON.parse(r.raw.getItem(AUTHORITY)).revision;
  runtime.coordinator.queue('commercial-street',{x:42,y:37});
  // Ambient lookup is gone during a transition; this runtime still owns its lease.
  installGameStorage(null);
  const win=new EventTarget(),doc=new EventTarget();doc.visibilityState='visible';
  const detach=attachPositionSaveLifecycle(id=>runtime.coordinator.flush(id),()=>runtime.read().currentSceneId,win,doc,runtime.checkpoint,runtime.lifecycle.canPersist);
  detach();detach();
  expect(JSON.parse(r.raw.getItem(AUTHORITY)).revision).toBe(revision+2);
  expect(JSON.parse(committed.sessionHandle.storage.getItem(PLAYER))).toMatchObject({currentPosition:{x:42,y:37},walletBalance:800,gameTimeMs:runtime.read().gameTimeMs});
  expect(runtime.publications()).toBe(2);
  runtime.dispose();
});
test('bootstrap guard conflict cancels runtime work; stopped unmount never checkpoints or flushes',async()=>{
  const original=JSON.stringify(save()),r=rig(memoryStorage({[PLAYER]:original})),committed=await choose(r,'restart'),runtime=boundRuntime(committed);
  let cancelled=0,lateBusiness=0;
  runtime.lifecycle.onStop(()=>{cancelled++;});
  runtime.coordinator.queue('commercial-street',{x:42,y:37});
  const win=new EventTarget(),doc=new EventTarget();doc.visibilityState='hidden';
  const detach=attachPositionSaveLifecycle(id=>runtime.coordinator.flush(id),()=>runtime.read().currentSceneId,win,doc,runtime.checkpoint,runtime.lifecycle.canPersist);
  const authority=r.raw.getItem(AUTHORITY);
  r.raw.setItem(GUARD,'changed guard');
  expect(()=>committed.sessionHandle.check()).toThrow('legacy-or-bootstrap-slot-changed');
  expect(runtime.lifecycle.stopReason).toBe('legacy-or-bootstrap-slot-changed');
  expect(cancelled).toBe(1);
  expect(()=>{detach();detach();win.dispatchEvent(new Event('pagehide'));runtime.checkpoint();runtime.coordinator.flush('commercial-street');runtime.lifecycle.run(()=>{lateBusiness++;});}).not.toThrow();
  expect(r.raw.getItem(AUTHORITY)).toBe(authority);
  expect(r.raw.getItem(PLAYER)).toBe(original);
  expect(runtime.publications()).toBe(0);expect(lateBusiness).toBe(0);
  expect(()=>committed.sessionHandle.storage.setItem(PLAYER,original)).toThrow('save-session-stopped');
  await committed.sessionHandle.close();await committed.sessionHandle.close();
  expect(cancelled).toBe(1);runtime.dispose();
});
test('first failed business commit retains its reason, money and receipts; cleanup cannot publish it',async()=>{
  const r=rig(),committed=await choose(r,'create'),runtime=boundRuntime(committed),before=r.raw.getItem(AUTHORITY);
  const set=r.raw.setItem.bind(r.raw);let faults=0;
  r.raw.setItem=(key,value)=>{if(key===AUTHORITY){faults++;throw Error('synthetic purchase write failure');}return set(key,value);};
  expect(()=>runtime.coordinator.commit(current=>({...current,walletBalance:current.walletBalance-50}))).toThrow('storage-write-failed');
  expect(committed.sessionHandle.stopReason).toBe('storage-write-failed');
  expect(runtime.lifecycle.stopReason).toBe('storage-write-failed');
  expect(()=>{runtime.checkpoint();runtime.coordinator.flush('commercial-street');}).not.toThrow();
  expect(faults).toBe(1);expect(runtime.publications()).toBe(0);
  expect(r.raw.getItem(AUTHORITY)).toBe(before);
  const preserved=JSON.parse(JSON.parse(before).values[PLAYER]);
  expect(preserved.walletBalance).toBe(800);expect(preserved.shopOrderPaymentReceipts).toEqual({});
  await committed.sessionHandle.close();await committed.sessionHandle.close();
  runtime.dispose();
});
test('revoked runtime never adopts a replacement global session or writes its generation',async()=>{
  const r=rig(),first=await choose(r,'create'),runtime=boundRuntime(first);
  runtime.coordinator.queue('commercial-street',{x:42,y:37});
  await first.sessionHandle.close();
  const next=await choose(r,'replace',true),authority=r.raw.getItem(AUTHORITY);
  expect(next.sessionHandle.generation).not.toBe(first.sessionHandle.generation);
  expect(()=>{runtime.checkpoint();runtime.coordinator.queue('commercial-street',{x:1,y:2});runtime.coordinator.flush('commercial-street');}).not.toThrow();
  expect(r.raw.getItem(AUTHORITY)).toBe(authority);expect(runtime.publications()).toBe(0);
  expect(()=>runtime.lifecycle.assertActive()).toThrow('session-closed');
  runtime.dispose();
});
test('lifecycle does not hide an unrelated storage check failure',()=>{
  const failure=Error('unexpected validator failure');
  const lifecycle=createRuntimeSaveLifecycle({check(){throw failure;}});
  expect(()=>lifecycle.canPersist()).toThrow(failure);
});

test('ACK failure revokes bound cleanup before returning, and another service recovers the same save',async()=>{
  const locks=delayedReleaseLocks(),r=rig(memoryStorage({[PLAYER]:JSON.stringify(save())}),locks);
  const committed=await choose(r,'restart'),runtime=boundRuntime(committed),before=r.raw.getItem(AUTHORITY);
  runtime.coordinator.queue('commercial-street',{x:42,y:37});
  const set=r.raw.setItem.bind(r.raw);
  r.raw.setItem=(key,value)=>{if(key===ACKNOWLEDGED)throw Error('ack storage failure');return set(key,value);};
  const result=await r.service.acknowledgeEntry({ticket:committed.ticket,sessionHandle:committed.sessionHandle});
  expect(result).toMatchObject({status:'outcome-uncertain',ticket:committed.ticket});
  expect(committed.sessionHandle.isOpen).toBe(false);
  expect(()=>{runtime.checkpoint();runtime.coordinator.flush('commercial-street');}).not.toThrow();
  expect(r.raw.getItem(AUTHORITY)).toBe(before);expect(runtime.publications()).toBe(0);
  const next=rig(r.raw,locks),recovered=await next.service.resolveOperation({ticket:committed.ticket});
  expect(recovered.status).toBe('committed');handles.push(recovered.sessionHandle);
  expect(recovered.sessionHandle).not.toBe(committed.sessionHandle);
  expect(recovered.snapshot.generation).toEqual(committed.snapshot.generation);
  expect(JSON.parse(recovered.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(800);
  expect(()=>committed.sessionHandle.check()).toThrow('save-session-stopped');
  runtime.dispose();
});

function reactDebugProperties(value, properties = []) {
  if (!value || typeof value !== 'object') return properties;
  // Same own-enumerable value access as React DEV addObjectToProperties.
  for (const key in value) if (Object.prototype.hasOwnProperty.call(value,key)) {
    const child=value[key];
    properties.push([key,typeof child]);
    if(child && typeof child==='object')reactDebugProperties(child,properties);
  }
  return properties;
}
test('real facade debug enumeration and descriptors never read protected data, including after revocation',async()=>{
  const r=rig(memoryStorage({[PLAYER]:JSON.stringify(save())})),committed=await choose(r,'restart'),facade=committed.sessionHandle.storage;
  const expectedLength=Object.keys(committed.snapshot.values).length;
  expect(facade.length).toBe(expectedLength);
  const originalRead=r.raw.getItem.bind(r.raw);
  const before=Object.fromEntries(Array.from({length:r.raw.length},(_,i)=>[r.raw.key(i),originalRead(r.raw.key(i))]));
  const read=vi.spyOn(r.raw,'getItem'),write=vi.spyOn(r.raw,'setItem');
  expect(()=>reactDebugProperties({sessionHandle:committed.sessionHandle})).not.toThrow();
  expect(read).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();
  await committed.sessionHandle.close();
  read.mockClear();write.mockClear();
  let descriptors;
  expect(()=>{descriptors=Object.getOwnPropertyDescriptors(facade);reactDebugProperties({sessionHandle:committed.sessionHandle});Object.entries(facade);Object.assign({},facade);JSON.stringify({sessionHandle:committed.sessionHandle});}).not.toThrow();
  expect(descriptors.length.enumerable).toBe(false);
  expect(typeof descriptors.length.get).toBe('function');
  expect(Object.keys(facade)).not.toContain('length');
  expect(facade.isOpen).toBe(false);expect(facade.stopReason).toBe('session-closed');
  expect(read).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();
  read.mockRestore();write.mockRestore();
  expect(Object.fromEntries(Array.from({length:r.raw.length},(_,i)=>[r.raw.key(i),r.raw.getItem(r.raw.key(i))]))).toEqual(before);
});
test('revoked real facade still rejects explicit data reads, writes and commits without changing old raw or authority',async()=>{
  const oldRaw=JSON.stringify(save()),r=rig(memoryStorage({[PLAYER]:oldRaw})),committed=await choose(r,'restart'),facade=committed.sessionHandle.storage;
  const snapshot=()=>Object.fromEntries(Array.from({length:r.raw.length},(_,i)=>[r.raw.key(i),r.raw.getItem(r.raw.key(i))]));
  const before=snapshot();
  await committed.sessionHandle.close();
  const callback=vi.fn();
  for(const access of [()=>facade.length,()=>facade.getItem(PLAYER),()=>facade.getItem('missing'),()=>facade.key(0),()=>facade.key(999),()=>facade.setItem(PLAYER,oldRaw),()=>facade.removeItem('newtone-choice-wheel-hint-seen'),()=>facade.transaction(callback),()=>facade.afterCommit('late',callback),()=>facade.setValidator(callback),()=>facade.check()])expect(access).toThrow('save-session-stopped');
  expect(()=>facade.clear()).toThrow('save-reset-requires-explicit-recovery');
  expect(()=>Object.getOwnPropertyDescriptor(facade,'length').get.call(facade)).toThrow('save-session-stopped');
  expect(callback).not.toHaveBeenCalled();
  expect(facade.stopReason).toBe('session-closed');
  expect(r.raw.getItem(PLAYER)).toBe(oldRaw);
  expect(snapshot()).toEqual(before);
});

test.each(historicalInputs)('exact archived writer $id raw restarts/ACK/refreshes without importing any facts',async sample=>{
 expect(createHash('sha256').update(sample.raw).digest('hex')).toBe(sample.sha256);
 const r=rig(memoryStorage({[PLAYER]:sample.raw})),c=await choose(r,'restart');freshAssertions(c);expect(c.snapshot.sources[PLAYER]).toBe(sample.raw);
 savePlayerSave({...JSON.parse(c.snapshot.values[PLAYER]),walletBalance:650},c.sessionHandle.storage);await acknowledge(r,c);await c.sessionHandle.close();
 const next=rig(r.raw,r.locks);expect((await next.service.getRecoveryState()).status).toBe('no-pending-operation');const again=await choose(next,'continue');expect(again.snapshot.generation).toEqual(c.snapshot.generation);expect(JSON.parse(again.snapshot.values[PLAYER]).walletBalance).toBe(650);expect(r.raw.getItem(PLAYER)).toBe(sample.raw);
});

test('old source changed during guard write is detected before authority commit',async()=>{
 const r=rig(memoryStorage({[PLAYER]:'old raw'})),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'restart',snapshotToken:i.snapshotToken}),set=r.raw.setItem.bind(r.raw);
 r.raw.setItem=(k,v)=>{set(k,v);if(k===GUARD)set(PLAYER,'last old write');};
 expect((await r.service.commitEntry({ticket:p.ticket})).status).toBe('stale');expect(r.raw.getItem(AUTHORITY)).toBeNull();expect(JSON.parse(r.raw.getItem(BACKUP_PREFIX+p.ticket.operationId)).sourceRaw[PLAYER]).toBe('old raw');expect(r.raw.getItem(PLAYER)).toBe('last old write');
});
test('committed witness failure opens no runtime and resolves the authority instead of recreating it',async()=>{
 const r=rig(),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken}),set=r.raw.setItem.bind(r.raw);let deny=true;
 r.raw.setItem=(k,v)=>{if(k===GUARD&&JSON.parse(v).phase==='committed'&&deny)throw Error('witness quota');set(k,v);};
 expect((await r.service.commitEntry({ticket:p.ticket})).status).toBe('outcome-uncertain');const authority=r.raw.getItem(AUTHORITY);expect(authority).not.toBeNull();deny=false;
 const next=rig(r.raw,r.locks),resolved=await next.service.resolveOperation({ticket:p.ticket});expect(resolved.status).toBe('committed');handles.push(resolved.sessionHandle);expect(r.raw.getItem(AUTHORITY)).toBe(authority);freshAssertions(resolved);
});
test('a later display version value cannot change the storage epoch or reset progress',async()=>{
 const r=rig(),c=await choose(r,'create');savePlayerSave({...JSON.parse(c.snapshot.values[PLAYER]),walletBalance:612},c.sessionHandle.storage);await acknowledge(r,c);await c.sessionHandle.close();r.raw.setItem('display-version','0.3.1');
 const later=rig(r.raw,r.locks),continued=await choose(later,'continue');expect(continued.snapshot.saveEpoch).toBe(SAVE_EPOCH);expect(continued.snapshot.generation).toEqual(c.snapshot.generation);expect(JSON.parse(continued.snapshot.values[PLAYER]).walletBalance).toBe(612);
});
