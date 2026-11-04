import {test,expect,afterEach,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createSaveEntryService,AUTHORITY,PENDING,PLAYER,ACKNOWLEDGED} from '../src/services/saveEntryService.mjs';
import {memoryStorage,installGameStorage} from '../src/save-session.mjs';
import {createRuntimeSaveLifecycle} from '../src/center/runtime/runtimeSaveLifecycle.mjs';
import {createGameTimeSaveCheckpoint,createPositionSaveCoordinator,recordPlayerScenePosition,attachPositionSaveLifecycle} from '../src/center/runtime/playerSave.ts';
import {createInitialPlayerSave,savePlayerSave,sanitizePlayerSave} from '../src/center/runtime/playerSave.ts';
import {mainlineScenes} from '../src/center/runtime/mainlineScenes.ts';
import {commercialCafeStoryStatePatch,initialCommercialCafeStoryState,commercialCafeNarrativeDialogue} from '../src/center/runtime/commercialCafeStory.ts';
import {classifyLaoZhouConversation,laoZhouArrivalShouldDeliver,openingGuidancePatch} from '../src/center/runtime/openingGuidance.ts';
const handles=[];afterEach(()=>{for(const h of handles.splice(0))h.close();vi.unstubAllGlobals();});
const hash=text=>Promise.resolve(createHash('sha256').update(text).digest('hex'));
function lockManager(){let occupied=false;return {request:async(_key,_options,callback)=>{if(occupied)return callback(null);occupied=true;try{return await callback({name:'test-lock'});}finally{occupied=false;}}};}
function rig(raw=memoryStorage(),locks=lockManager()) {let calls=0;const service=createSaveEntryService({storage:raw,locks,digest:hash,uuid:()=>`test-id-${++calls}`});return {raw,service,locks,uuidCalls:()=>calls};}
function save(scene='jijia-ancestral-home',phone='surface',version=2){return {...createInitialPlayerSave(scene),_version:version,phoneDevice:phone,walletBalance:650,updatedAt:55,sceneState:{'jijia-ancestral-home':{'interactionExplored:ancestor':true},'commercial-cafe':commercialCafeStoryStatePatch(initialCommercialCafeStoryState())},shopOrderHistory:[]};}
async function choose(r,intent,overwriteConfirmed=false){const inspection=await r.service.inspectSave();const p=await r.service.prepareEntry({intent,snapshotToken:inspection.snapshotToken,overwriteConfirmed});expect(p.status).toBe('prepared');const result=await r.service.commitEntry({ticket:p.ticket});expect(result.status).toBe('committed');handles.push(result.sessionHandle);return result;}
test('inspect and cancelled selection have zero writes/random initial generation',async()=>{const raw=memoryStorage({[PLAYER]:JSON.stringify(save()),'newtone-progress-v4':'{bad-reader'}),r=rig(raw),before=Object.fromEntries(Array.from({length:raw.length},(_,i)=>[raw.key(i),raw.getItem(raw.key(i))]));await r.service.inspectSave();await r.service.inspectSave();expect(r.uuidCalls()).toBe(0);expect(Object.fromEntries(Array.from({length:raw.length},(_,i)=>[raw.key(i),raw.getItem(raw.key(i))]))).toEqual(before);});
test('empty create is new-exempt with guaranteed pending opening; ticket replay cannot grant again',async()=>{const r=rig(),c=await choose(r,'create');expect(c.snapshot.placement.result).toBe('new-exempt');const s=JSON.parse(c.sessionHandle.storage.getItem(PLAYER));expect(s.walletBalance).toBe(800);expect(s.sceneState['commercial-street'].laoZhouOpeningPromptStatus).toBe('pending');savePlayerSave({...s,walletBalance:790},c.sessionHandle.storage);const again=await r.service.commitEntry({ticket:c.ticket});expect(again.status).toBe('committed');handles.push(again.sessionHandle);expect(JSON.parse(again.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(790);});
test('replace requires confirmation; cancellation preserves complete old snapshot',async()=>{const r=rig(memoryStorage({[PLAYER]:JSON.stringify(save())})),i=await r.service.inspectSave(),before=r.raw.getItem(PLAYER);expect((await r.service.prepareEntry({intent:'replace',snapshotToken:i.snapshotToken})).status).toBe('blocked');expect(r.raw.getItem(PLAYER)).toBe(before);expect(r.raw.getItem(AUTHORITY)).toBeNull();const c=await choose(r,'replace',true);expect(JSON.parse(c.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(800);expect(r.raw.getItem(PLAYER)).toBe(before);});
test.each(['jijia-ancestral-home','jijia-ancestral-interior','zhongshuyuan-passage','zhongshuyuan-office'])('historical %s with surface is placed exactly once and retains Center facts',async scene=>{const original=save(scene,'surface',1),r=rig(memoryStorage({[PLAYER]:JSON.stringify(original)})),c=await choose(r,'continue'),next=JSON.parse(c.sessionHandle.storage.getItem(PLAYER));expect(next.currentSceneId).toBe('commercial-street');expect(next.currentPosition).toEqual(mainlineScenes['commercial-street'].initialPlayerPosition);expect(next.phoneDevice).toBe('inner');expect(next.walletBalance).toBe(650);expect(next.sceneState['jijia-ancestral-home']['interactionExplored:ancestor']).toBe(true);expect(next.phoneNotes).toEqual(original.phoneNotes);expect(next.shopOrderHistory).toEqual(original.shopOrderHistory);savePlayerSave({...next,currentSceneId:scene,currentPosition:null,phoneDevice:'surface'},c.sessionHandle.storage);const again=await choose(r,'continue');expect(JSON.parse(again.sessionHandle.storage.getItem(PLAYER)).currentSceneId).toBe(scene);expect(again.snapshot.generation.id).toBe(c.snapshot.generation.id);});
test.each(['jijia-ancestral-home','jijia-ancestral-interior','zhongshuyuan-passage','zhongshuyuan-office'])('historical %s with inner is not moved',async scene=>{const r=rig(memoryStorage({[PLAYER]:JSON.stringify(save(scene,'inner'))})),c=await choose(r,'continue');expect(JSON.parse(c.sessionHandle.storage.getItem(PLAYER)).currentSceneId).toBe(scene);expect(c.snapshot.placement.result).toBe('not-applicable');});
test.each(['commercial-street','yonghe-mining-perimeter','yonghe-eatery','commercial-cafe'])('other %s does not receive four-place migration',async scene=>{const r=rig(memoryStorage({[PLAYER]:JSON.stringify(save(scene,'surface',1))})),c=await choose(r,'continue');expect(c.snapshot.placement.result).toBe('not-applicable');if(scene==='commercial-street')expect(JSON.parse(c.sessionHandle.storage.getItem(PLAYER)).phoneDevice).toBe('inner');});
test('old Reader corruption/version does not gate Center or mutate raw; valid UI preference and Landing retained',async()=>{const oldReader='{"_version":999,"language":"en","themePosition":1,"readerCompleted":true}',r=rig(memoryStorage({[PLAYER]:JSON.stringify(save()),'newtone-progress-v4':oldReader,'newtone-narrative-progress-v2':'{bad-event','newtone-landing-intro-v1':'true'})),c=await choose(r,'continue');expect(r.raw.getItem('newtone-progress-v4')).toBe(oldReader);expect(c.snapshot.sources['newtone-narrative-progress-v2']).toBe('{bad-event');expect(JSON.parse(c.sessionHandle.storage.getItem('newtone-progress-v4')).language).toBe('en');expect(JSON.parse(c.sessionHandle.storage.getItem('newtone-progress-v4')).readerCompleted).toBe(false);expect(c.sessionHandle.storage.getItem('newtone-landing-intro-v1')).toBe('true');const before=c.sessionHandle.storage.getItem(PLAYER);r.raw.setItem('newtone-progress-v4','noise'.repeat(100000));c.sessionHandle.check();expect(c.sessionHandle.storage.getItem(PLAYER)).toBe(before);});
test.each([['{bad','corrupt'],[JSON.stringify({_version:2,walletBalance:650,sceneState:{}}),'corrupt'],[JSON.stringify({...save(),_version:99}),'unknown']])('unknown or corrupt main is not admitted %#',async(raw,classification)=>{const r=rig(memoryStorage({[PLAYER]:raw})),i=await r.service.inspectSave();expect(i.classification).toBe(classification);expect(i.allowedActions).toEqual(['back','reinspect']);expect(r.raw.getItem(PLAYER)).toBe(raw);expect(r.raw.getItem(PENDING)).toBeNull();});
test('changed source between inspect and prepare returns stale with no overwrite',async()=>{const r=rig(memoryStorage({[PLAYER]:JSON.stringify(save())})),i=await r.service.inspectSave();r.raw.setItem(PLAYER,JSON.stringify({...save(),walletBalance:4}));expect((await r.service.prepareEntry({intent:'continue',snapshotToken:i.snapshotToken})).status).toBe('stale');expect(r.raw.getItem(AUTHORITY)).toBeNull();});
test('another service holding lifetime lock cannot resolve by receipt alone',async()=>{const raw=memoryStorage(),locks=lockManager(),a=rig(raw,locks),c=await choose(a,'create'),b=rig(raw,locks);expect((await b.service.resolveOperation({ticket:c.ticket})).status).toBe('busy');c.sessionHandle.close();await Promise.resolve();const recovered=await b.service.resolveOperation({ticket:c.ticket});expect(recovered.status).toBe('committed');expect(recovered.snapshot).toBeTruthy();expect(recovered.receipt.operationId).toBe(c.ticket.operationId);expect(recovered.sessionHandle).not.toBe(c.sessionHandle);handles.push(recovered.sessionHandle);expect(()=>c.sessionHandle.check()).toThrow();});
test('prepare persists ticket for lost response/refresh recovery; no blind reinitialization',async()=>{const r=rig(),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken}),recovery=await r.service.getRecoveryState();expect(recovery.ticket).toEqual(p.ticket);expect(await r.service.resolveOperation({ticket:p.ticket})).toMatchObject({status:'not-committed',resumeAllowed:true,ticket:p.ticket});const c=await r.service.commitEntry({ticket:recovery.ticket});expect(c.status).toBe('committed');handles.push(c.sessionHandle);expect(c.receipt.requestHash).toBe(p.ticket.requestHash);});
test('backup failure does not publish success; retry same ticket preserves same generation and initial money',async()=>{const r=rig(),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken}),set=r.raw.setItem.bind(r.raw);let denied=true;r.raw.setItem=(k,v)=>{if(denied&&k.startsWith('newtone-save-entry-backup-'))throw Error('quota');set(k,v)};expect((await r.service.commitEntry({ticket:p.ticket})).status).toBe('not-committed');expect(r.raw.getItem(AUTHORITY)).toBeNull();denied=false;const c=await r.service.commitEntry({ticket:p.ticket});expect(c.status).toBe('committed');handles.push(c.sessionHandle);expect(JSON.parse(c.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(800);});
test('write succeeds then throws: resolve returns verified snapshot and fresh handle, without rollback',async()=>{const r=rig(),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken}),set=r.raw.setItem.bind(r.raw);let once=true;r.raw.setItem=(k,v)=>{set(k,v);if(k===AUTHORITY&&once){once=false;throw Error('uncertain transport')}};const result=await r.service.commitEntry({ticket:p.ticket});expect(result.status).toBe('outcome-uncertain');const stored=r.raw.getItem(AUTHORITY),resolved=await r.service.resolveOperation({ticket:p.ticket});expect(resolved.status).toBe('committed');handles.push(resolved.sessionHandle);expect(r.raw.getItem(AUTHORITY)).toBe(stored);expect(resolved.snapshot.generation.id).toBe(JSON.parse(stored).generation.id);});
test('old handle revoked during prepare, before authority commit; failed operation cannot revive it',async()=>{const r=rig(),c=await choose(r,'create'),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'replace',snapshotToken:i.snapshotToken,overwriteConfirmed:true});expect(p.status).toBe('prepared');expect(()=>c.sessionHandle.storage.setItem('newtone-choice-wheel-hint-seen','1')).toThrow();});
test('regular source conflict and required commit quota failure stop writes',async()=>{const original=JSON.stringify(save()),r=rig(memoryStorage({[PLAYER]:original})),c=await choose(r,'continue'),before=r.raw.getItem(AUTHORITY);r.raw.setItem(PLAYER,'changed');expect(()=>c.sessionHandle.check()).toThrow();expect(r.raw.getItem(AUTHORITY)).toBe(before);});
test('pending candidate corruption is detected before authority write',async()=>{const r=rig(),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken}),record=JSON.parse(r.raw.getItem(PENDING)),candidate=JSON.parse(record.candidateRaw);candidate.values[PLAYER]=JSON.stringify({...JSON.parse(candidate.values[PLAYER]),walletBalance:9999});record.candidateRaw=JSON.stringify(candidate);r.raw.setItem(PENDING,JSON.stringify(record));expect((await r.service.commitEntry({ticket:p.ticket})).status).not.toBe('committed');expect(r.raw.getItem(AUTHORITY)).toBeNull();});
test('Lao Zhou dialogue start at zero is positive; missing/short-dialogue history unknown; explicit initial state negative',()=>{expect(classifyLaoZhouConversation({'commercial-street':{commercialCafeNarrativePhase:'dialogue',commercialCafeNarrativeCursor:0}}).state).toBe('triggered');expect(classifyLaoZhouConversation({'commercial-cafe':{commercialCafeStoryStage:'met-lao-zhou'}}).state).toBe('triggered');expect(classifyLaoZhouConversation({}).state).toBe('unknown');expect(classifyLaoZhouConversation({'commercial-cafe':commercialCafeStoryStatePatch(initialCommercialCafeStoryState())}).state).toBe('unknown');expect(classifyLaoZhouConversation({'commercial-street':{laoZhouTriggerEvidenceVersion:1,laoZhouConversationTriggered:false}}).state).toBe('not-triggered');});
test.each(['triggered','not-triggered','unknown'])('legacy opening %s has distinct persisted outcome without changing story',async state=>{const p=save();p.sceneState['commercial-cafe']=state==='triggered'?{...commercialCafeStoryStatePatch(initialCommercialCafeStoryState()),commercialCafeNarrativePhase:'dialogue'}:state==='unknown'?commercialCafeStoryStatePatch(initialCommercialCafeStoryState()):{...commercialCafeStoryStatePatch(initialCommercialCafeStoryState()),laoZhouTriggerEvidenceVersion:1,laoZhouConversationTriggered:false};const beforeStory=structuredClone(p.sceneState),r=rig(memoryStorage({[PLAYER]:JSON.stringify(p)})),c=await choose(r,'continue'),next=JSON.parse(c.sessionHandle.storage.getItem(PLAYER));expect(next.sceneState['commercial-cafe']).toEqual(beforeStory['commercial-cafe']);expect(next.sceneState['jijia-ancestral-home']).toEqual(beforeStory['jijia-ancestral-home']);expect(next.sceneState['commercial-street'].laoZhouOpeningPromptStatus).toBe(state==='triggered'?'suppressed':state==='unknown'?'unknown':'pending');expect(next.walletBalance).toBe(650);});
test('spatial placement keeps pending delivery and holds old seat, never fabricates completion',async()=>{const p=save();p.sceneState['commercial-street']={commercialCafeTableDeliverySeatId:'retained-seat'};const r=rig(memoryStorage({[PLAYER]:JSON.stringify(p)})),c=await choose(r,'continue'),next=JSON.parse(c.sessionHandle.storage.getItem(PLAYER));expect(next.sceneState['commercial-street'].commercialCafeTableDeliverySeatId).toBe('retained-seat');expect(next.sceneState['commercial-street'].saveEntrySpatialHold).toBe(true);expect(c.snapshot.recoveryHolds).toEqual([{domain:'cafe',release:'verified-return-to-cafe-space'}]);});

test('ancient v2 explicit scene uses actual raw phone/scene for the placement condition',async()=>{const raw=memoryStorage({'newtone.mainline.carried-phone.v2':JSON.stringify({device:'surface',sceneId:'zhongshuyuan-office'}),'newtone.mainline.scene-positions.v2':'{}'}),r=rig(raw),c=await choose(r,'continue');expect(c.snapshot.placement.result).toBe('applied');expect(JSON.parse(c.sessionHandle.storage.getItem(PLAYER)).phoneDevice).toBe('inner');expect(raw.getItem('newtone.mainline.carried-phone.v2')).toBe('{"device":"surface","sceneId":"zhongshuyuan-office"}');});
test('ancient v1 phone without a reliable current scene remains unknown rather than guessed eligible',async()=>{const r=rig(memoryStorage({'newtone.mainline.carried-phone.v1':'surface'}));expect((await r.service.inspectSave()).classification).toBe('unknown');expect(r.raw.getItem(AUTHORITY)).toBeNull();});

test('rich Center history, phone, pending handoff, completed story and receipts survive exact migration',async()=>{
  let p=save();p.sceneState['commercial-cafe']=commercialCafeStoryStatePatch({...initialCommercialCafeStoryState(),status:'complete',narrativePhase:'complete',narrativeCursor:commercialCafeNarrativeDialogue.lines.length,coffeeStatus:'delivered',completedAt:42,laoZhouDeparture:'departed'});
  p.phoneContactNotes={ruoyu:'keep-contact'};p.phoneCallHistory=[{id:'call-one',contactId:'ruoyu',startedAt:10,endedAt:20,durationMs:10,result:'cancelled'}];
  p.shopOrderHistory=[{id:'history-one',shopId:'commercial-south-slot-5',productId:'original-milk-tea',pricePaid:3,placedAtGameTimeMs:10,pickedUpAtGameTimeMs:20}];
  const order={id:'pending-cafe-order',shopId:'commercial-cafe-slot',productId:'americano',status:'queued',placedAtGameTimeMs:1,readyAtGameTimeMs:2};
  p.cafeStoryDeliveries={'delivery-one':{eventId:'delivery-one',order,deliveredAtGameTimeMs:3,presentation:'pending'}};
  p.shopOrders={'commercial-south-slot-5':{id:'milk-order',shopId:'commercial-south-slot-5',productId:'original-milk-tea',status:'queued',placedAtGameTimeMs:1,readyAtGameTimeMs:10,pricePaid:3,paymentReceiptId:'receipt-one'}};
  p.shopOrderPaymentReceipts={'receipt-one':{idempotencyKey:'receipt-one',orderId:'milk-order',shopId:'commercial-south-slot-5',productId:'original-milk-tea',amount:3}};
  p=sanitizePlayerSave(p,p.currentSceneId);const raw=JSON.stringify(p),r=rig(memoryStorage({[PLAYER]:raw})),c=await choose(r,'continue'),next=JSON.parse(c.sessionHandle.storage.getItem(PLAYER));
  for(const k of ['walletBalance','shopOrderHistory','shopOrders','shopOrderPaymentReceipts','monthlySalaryReceipts','heldConsumable','phoneNotes','phoneContactNotes','phoneCallHistory','phoneNotifications','cafeStoryDeliveries'])expect(next[k]).toEqual(p[k]);
  expect(next.shopOrderHistory).toHaveLength(1);expect(next.sceneState['commercial-cafe']).toEqual(p.sceneState['commercial-cafe']);expect(r.raw.getItem(PLAYER)).toBe(raw);expect(next.cafeStoryDeliveries['delivery-one'].presentation).toBe('pending');
});
test('ordinary gameplay quota failure cannot publish a successful debit',async()=>{const r=rig(),c=await choose(r,'create'),before=r.raw.getItem(AUTHORITY),set=r.raw.setItem.bind(r.raw);r.raw.setItem=(k,v)=>{if(k===AUTHORITY)throw Error('quota');set(k,v)};let success=false;expect(()=>{savePlayerSave({...JSON.parse(c.sessionHandle.storage.getItem(PLAYER)),walletBalance:799},c.sessionHandle.storage);success=true;}).toThrow();expect(success).toBe(false);expect(r.raw.getItem(AUTHORITY)).toBe(before);});
test('unavailable or rejected locks never fall back to an unprotected game save',async()=>{const raw=memoryStorage(),r=rig(raw,{request:()=>Promise.reject(Error('locks rejected'))}),i=await r.service.inspectSave();expect((await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken})).status).toBe('blocked');expect(raw.getItem(AUTHORITY)).toBeNull();});
test('unreadable storage is unavailable, never empty',async()=>{const r=rig({get length(){throw Error('storage denied')},getItem(){throw Error('storage denied')}});const i=await r.service.inspectSave();expect(i.status).toBe('unavailable');expect(i.classification).toBeNull();});

test('successful ready acknowledgement preserves receipt but normal refresh presents choice',async()=>{const r=rig(),c=await choose(r,'create'),before=r.raw.getItem(AUTHORITY);expect((await r.service.getRecoveryState()).status).toBe('operation-found');expect((await r.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:c.sessionHandle})).status).toBe('acknowledged');expect(r.raw.getItem(AUTHORITY)).toBe(before);expect(r.raw.getItem(PENDING)).not.toBeNull();expect((await r.service.getRecoveryState()).status).toBe('no-pending-operation');const inspection=await r.service.inspectSave();expect(inspection.classification).toBe('generation-current');expect(inspection.allowedActions).toEqual(['continue','request-replace']);});
test('committed before ready is recoverable; acknowledgement requires valid owned handle',async()=>{const r=rig(),c=await choose(r,'create');expect((await r.service.getRecoveryState()).phase).toBe('committed');expect((await r.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:{}})).status).not.toBe('acknowledged');expect(r.raw.getItem(ACKNOWLEDGED)).toBeNull();});
test('ack failure revokes the old writer and allows a second tab to recover the same committed progress',async()=>{
  const raw=memoryStorage(),locks=lockManager(),r=rig(raw,locks),c=await choose(r,'create'),set=raw.setItem.bind(raw);let fail=true;
  const beforeAuthority=raw.getItem(AUTHORITY),beforePending=raw.getItem(PENDING);
  raw.setItem=(k,v)=>{if(k===ACKNOWLEDGED&&fail)throw Error('quota');set(k,v)};
  expect((await r.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:c.sessionHandle})).status).toBe('outcome-uncertain');
  expect(()=>c.sessionHandle.storage.setItem('newtone-choice-wheel-hint-seen','1')).toThrow();
  expect(raw.getItem(AUTHORITY)).toBe(beforeAuthority);expect(raw.getItem(PENDING)).toBe(beforePending);
  expect((await r.service.getRecoveryState()).phase).toBe('committed');fail=false;
  const second=rig(raw,locks),recovered=await second.service.resolveOperation({ticket:c.ticket});expect(recovered.status).toBe('committed');handles.push(recovered.sessionHandle);
  expect(recovered.sessionHandle).not.toBe(c.sessionHandle);expect((await second.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:recovered.sessionHandle})).status).toBe('acknowledged');
  expect((await second.service.getRecoveryState()).status).toBe('no-pending-operation');expect(JSON.parse(recovered.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(800);
});
test('ack write then exception closes runtime but retains its successful ack and never replays the authority write',async()=>{
  const raw=memoryStorage(),locks=lockManager(),r=rig(raw,locks),c=await choose(r,'create');
  savePlayerSave({...JSON.parse(c.sessionHandle.storage.getItem(PLAYER)),walletBalance:750},c.sessionHandle.storage);
  const before=raw.getItem(AUTHORITY),pending=raw.getItem(PENDING),set=raw.setItem.bind(raw);let once=true,authorityWrites=0;
  raw.setItem=(k,v)=>{if(k===AUTHORITY)authorityWrites++;set(k,v);if(k===ACKNOWLEDGED&&once){once=false;throw Error('uncertain')}};
  expect((await r.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:c.sessionHandle})).status).toBe('outcome-uncertain');expect(()=>c.sessionHandle.check()).toThrow();
  expect((await r.service.getRecoveryState()).status).toBe('no-pending-operation');
  const second=rig(raw,locks),recovered=await second.service.resolveOperation({ticket:c.ticket});expect(recovered.status).toBe('committed');handles.push(recovered.sessionHandle);
  expect((await second.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:recovered.sessionHandle})).status).toBe('acknowledged');
  expect(raw.getItem(AUTHORITY)).toBe(before);expect(raw.getItem(PENDING)).toBe(pending);expect(authorityWrites).toBe(0);expect(JSON.parse(recovered.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(750);
});

test('registered bddf v2 lacks only the later order-history field, without guessing other missing fields',async()=>{const p=save();delete p.shopOrderHistory;const r=rig(memoryStorage({[PLAYER]:JSON.stringify(p)})),c=await choose(r,'continue');expect(c.snapshot.origin.sourceFormatId).toBe('bddf-player-v2-before-order-history');expect(JSON.parse(c.sessionHandle.storage.getItem(PLAYER)).shopOrderHistory).toEqual([]);const missing=save();delete missing.shopOrders;const x=rig(memoryStorage({[PLAYER]:JSON.stringify(missing)}));expect((await x.service.inspectSave()).allowedActions).toEqual(['back','reinspect']);});

test('pure startup preview preserves legal preferences and learned Landing before a session exists',async()=>{const value=JSON.stringify({_version:999,language:'en',themePosition:1,standardTheme:'dark',motionMode:'reduced',readingMode:'standard',hasInitializedLanguage:true,hasInitializedReadingMode:true}),r=rig(memoryStorage({[PLAYER]:JSON.stringify(save()),'newtone-progress-v4':value,'newtone-landing-intro-v1':'true'}));const i=await r.service.inspectSave();expect(i.preview.preferences).toEqual({language:'en',themePosition:1,standardTheme:'dark',motionMode:'reduced',readingMode:'standard',hasInitializedLanguage:true,hasInitializedReadingMode:true});expect(i.preview.landingIntro).toEqual({status:'learned',learned:true,source:'physical'});expect(i.preview.preferenceEvidence.preservedFields).toContain('language');expect(r.raw.getItem(PENDING)).toBeNull();expect(r.uuidCalls()).toBe(0);});
test('broken Reader falls back only UI fields with explicit default evidence; unknown Landing is not guessed unlearned',async()=>{const r=rig(memoryStorage({[PLAYER]:JSON.stringify(save()),'newtone-progress-v4':'{bad','newtone-landing-intro-v1':'unknown-guide'})),i=await r.service.inspectSave();expect(i.classification).toBe('historical-supported');expect(i.preview.preferences.language).toBe('zh');expect(i.preview.preferenceEvidence.preservedFields).toEqual([]);expect(i.preview.preferenceEvidence.defaultedFields).toContain('language');expect(i.preview.landingIntro).toEqual({status:'unknown',learned:null,source:'invalid'});expect(r.raw.getItem('newtone-landing-intro-v1')).toBe('unknown-guide');expect(r.raw.getItem(AUTHORITY)).toBeNull();});

test('corrupt pending backup target can never overwrite a physical old slot',async()=>{const original=JSON.stringify(save()),r=rig(memoryStorage({[PLAYER]:original})),i=await r.service.inspectSave(),p=await r.service.prepareEntry({intent:'continue',snapshotToken:i.snapshotToken}),record=JSON.parse(r.raw.getItem(PENDING));record.backupKey=PLAYER;r.raw.setItem(PENDING,JSON.stringify(record));expect((await r.service.commitEntry({ticket:p.ticket})).status).not.toBe('committed');expect(r.raw.getItem(PLAYER)).toBe(original);expect(r.raw.getItem(AUTHORITY)).toBeNull();});

test('prepare write then exception returns its service-generated ticket for safe recovery',async()=>{const r=rig(),i=await r.service.inspectSave(),set=r.raw.setItem.bind(r.raw);let once=true;r.raw.setItem=(k,v)=>{set(k,v);if(k===PENDING&&once){once=false;throw Error('lost response')}};const p=await r.service.prepareEntry({intent:'create',snapshotToken:i.snapshotToken});expect(p.status).toBe('outcome-uncertain');expect(p.ticket).toBeTruthy();expect((await r.service.getRecoveryState()).ticket).toEqual(p.ticket);expect(await r.service.resolveOperation({ticket:p.ticket})).toMatchObject({status:'not-committed',resumeAllowed:true});});

test('retired Reader noise is not copied into pending evidence on repeated normal continues',async()=>{const r=rig(memoryStorage({[PLAYER]:JSON.stringify(save()),'newtone-progress-v4':'original-reader'}));let c=await choose(r,'continue');c=await choose(r,'continue');const baseline=r.raw.getItem(PENDING).length,firstAuthority=r.raw.getItem(AUTHORITY).length;for(let i=0;i<8;i++){r.raw.setItem('newtone-progress-v4',String(i)+'x'.repeat(200000));c=await choose(r,'continue');}expect(r.raw.getItem(PENDING).length).toBeLessThan(baseline+300);expect(r.raw.getItem(AUTHORITY).length).toBeLessThan(firstAuthority+300);const keys=Array.from({length:r.raw.length},(_,i)=>r.raw.key(i));expect(keys.filter(k=>k.startsWith('newtone-save-entry-backup-v2:'))).toHaveLength(1);expect(c.snapshot.sources['newtone-progress-v4']).toBe('original-reader');});

test('lost authority after acknowledged gameplay cannot replay initial ticket or grant 800 again',async()=>{const r=rig(),c=await choose(r,'create');await r.service.acknowledgeEntry({ticket:c.ticket,sessionHandle:c.sessionHandle});savePlayerSave({...JSON.parse(c.sessionHandle.storage.getItem(PLAYER)),walletBalance:700},c.sessionHandle.storage);c.sessionHandle.close();r.raw.removeItem(AUTHORITY);expect((await r.service.inspectSave()).classification).toBe('conflict');expect((await r.service.getRecoveryState()).status).toBe('blocked');expect((await r.service.commitEntry({ticket:c.ticket})).status).not.toBe('committed');expect(r.raw.getItem(AUTHORITY)).toBeNull();});
test('old migration credentials without its journal block conversion of an apparently valid old source',async()=>{const raw=JSON.stringify(save('jijia-ancestral-home','surface',1)),r=rig(memoryStorage({[PLAYER]:raw,'newtone-save-migration-v1-done':'journal-v1','newtone-save-migration-v1-raw':raw}));expect((await r.service.inspectSave()).classification).toBe('conflict');expect(r.raw.getItem(PLAYER)).toBe(raw);expect(r.raw.getItem(AUTHORITY)).toBeNull();});

test.each([['dialogue',0,0],['dialogue',1,0],['dialogue',5,2],['coffee-delivery',1,1],['coffee-returning',1,1]])('unfinished %s cursor %s resumes at %s without inventing a completed segment',async(phase,cursor,restarted)=>{const p=save('zhongshuyuan-office','surface',1);p.sceneState['commercial-cafe']=commercialCafeStoryStatePatch({...initialCommercialCafeStoryState(),narrativePhase:phase,narrativeCursor:cursor,coffeeStatus:phase==='coffee-returning'?'delivered':'ordered'});const r=rig(memoryStorage({[PLAYER]:JSON.stringify(p)})),c=await choose(r,'continue'),next=JSON.parse(c.sessionHandle.storage.getItem(PLAYER));expect(next.sceneState['commercial-cafe'].commercialCafeNarrativePhase).toBe(phase);expect(next.sceneState['commercial-cafe'].commercialCafeNarrativeCursor).toBe(restarted);expect(next.sceneState['commercial-cafe'].commercialCafeStoryStatus).toBe('available');expect(next.walletBalance).toBe(650);expect(next.sceneState['commercial-street'].saveEntrySpatialHold).toBe(true);});

test('legal absent Cafe record is unknown but safely continues without inventing story facts',async()=>{const p=save();delete p.sceneState['commercial-cafe'];const original=JSON.stringify(p),r=rig(memoryStorage({[PLAYER]:original})),i=await r.service.inspectSave();expect(i.classification).toBe('historical-supported');expect(i.warnings).toEqual(['LAO_ZHOU_TRIGGER_UNKNOWN']);const c=await choose(r,'continue'),next=JSON.parse(c.sessionHandle.storage.getItem(PLAYER));expect(next.sceneState['commercial-street'].laoZhouOpeningPromptStatus).toBe('unknown');expect(Object.hasOwn(next.sceneState,'commercial-cafe')).toBe(false);expect(next.sceneState['jijia-ancestral-home']).toEqual(p.sceneState['jijia-ancestral-home']);expect(next.walletBalance).toBe(650);expect(r.raw.getItem(PLAYER)).toBe(original);});
test('noncanonical empty Cafe residue in v2 stays rejected without rewriting the original',async()=>{const p=save();p.sceneState['commercial-cafe']={};const original=JSON.stringify(p),r=rig(memoryStorage({[PLAYER]:original})),i=await r.service.inspectSave();expect(i.classification).toBe('corrupt');expect(i.allowedActions).toEqual(['back','reinspect']);const result=await r.service.prepareEntry({intent:'continue',snapshotToken:i.snapshotToken});expect(result.status).toBe('blocked');expect(result.reasonCodes.join(' ')).toContain('noncanonical');expect(r.raw.getItem(PLAYER)).toBe(original);expect(r.raw.getItem(AUTHORITY)).toBeNull();expect(r.raw.getItem(PENDING)).toBeNull();});
test('warnings survive historical/current inspect, prepare, committed and same-ticket resolution, then clear for replacement',async()=>{
  const raw=memoryStorage({[PLAYER]:JSON.stringify(save())}),r=rig(raw),i=await r.service.inspectSave(),expected=['LAO_ZHOU_TRIGGER_UNKNOWN'];expect(i.warnings).toEqual(expected);
  const p=await r.service.prepareEntry({intent:'continue',snapshotToken:i.snapshotToken});expect(p.warnings).toEqual(expected);
  expect((await r.service.getRecoveryState()).warnings).toEqual(expected);expect(await r.service.resolveOperation({ticket:p.ticket})).toMatchObject({status:'not-committed',resumeAllowed:true,warnings:expected});
  const c=await r.service.commitEntry({ticket:p.ticket});expect(c.status).toBe('committed');handles.push(c.sessionHandle);expect(c.warnings).toEqual(expected);expect((await r.service.inspectSave()).warnings).toEqual(expected);
  const resolved=await r.service.resolveOperation({ticket:p.ticket});expect(resolved.status).toBe('committed');handles.push(resolved.sessionHandle);expect(resolved.warnings).toEqual(expected);
  const current=await r.service.inspectSave(),fresh=await r.service.prepareEntry({intent:'replace',snapshotToken:current.snapshotToken,overwriteConfirmed:true});expect(fresh.status).toBe('prepared');expect(fresh.warnings).toEqual([]);
  const replaced=await r.service.commitEntry({ticket:fresh.ticket});expect(replaced.status).toBe('committed');handles.push(replaced.sessionHandle);expect(replaced.warnings).toEqual([]);expect((await r.service.inspectSave()).warnings).toEqual([]);
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
  expect(Array.from({length:r.raw.length},(_,i)=>r.raw.key(i)).filter(key=>key.startsWith('newtone-save-entry-backup-v2:'))).toHaveLength(1);
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
test('source conflict cancels runtime work; stopped unmount never checkpoints or flushes',async()=>{
  const original=JSON.stringify(save()),r=rig(memoryStorage({[PLAYER]:original})),committed=await choose(r,'continue'),runtime=boundRuntime(committed);
  let cancelled=0,lateBusiness=0;
  runtime.lifecycle.onStop(()=>{cancelled++;});
  runtime.coordinator.queue('commercial-street',{x:42,y:37});
  const win=new EventTarget(),doc=new EventTarget();doc.visibilityState='hidden';
  const detach=attachPositionSaveLifecycle(id=>runtime.coordinator.flush(id),()=>runtime.read().currentSceneId,win,doc,runtime.checkpoint,runtime.lifecycle.canPersist);
  const authority=r.raw.getItem(AUTHORITY);
  r.raw.setItem(PLAYER,original+' ');
  expect(()=>committed.sessionHandle.check()).toThrow('legacy-or-bootstrap-slot-changed');
  expect(runtime.lifecycle.stopReason).toBe('legacy-or-bootstrap-slot-changed');
  expect(cancelled).toBe(1);
  expect(()=>{detach();detach();win.dispatchEvent(new Event('pagehide'));runtime.checkpoint();runtime.coordinator.flush('commercial-street');runtime.lifecycle.run(()=>{lateBusiness++;});}).not.toThrow();
  expect(r.raw.getItem(AUTHORITY)).toBe(authority);
  expect(r.raw.getItem(PLAYER)).toBe(original+' ');
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
  const committed=await choose(r,'continue'),runtime=boundRuntime(committed),before=r.raw.getItem(AUTHORITY);
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
  expect(JSON.parse(recovered.sessionHandle.storage.getItem(PLAYER)).walletBalance).toBe(650);
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
  const r=rig(memoryStorage({[PLAYER]:JSON.stringify(save())})),committed=await choose(r,'continue'),facade=committed.sessionHandle.storage;
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
  const oldRaw=JSON.stringify(save()),r=rig(memoryStorage({[PLAYER]:oldRaw})),committed=await choose(r,'continue'),facade=committed.sessionHandle.storage;
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
