import { createInitialPlayerSave } from '../center/runtime/playerSave.ts';
import { selectLaoZhouCafeSeat } from '../center/runtime/commercialCafeSeatSelection.ts';
import { validateNew, rewindUnfinished } from './saveMigration.mjs';
import { createJournalStorage, installGameStorage, clearGameStorage } from '../save-session.mjs';
import { openingGuidancePatch } from '../center/runtime/openingGuidance';
import { createPlayerGuestRepository } from './playerGuestStorage.mjs';
import { createPlayerStoryCheckpointObserver } from './playerStoryCheckpoints.mjs';

import { SAVE_EPOCH, AUTHORITY, PENDING, ACKNOWLEDGED, GUARD, BACKUP_PREFIX, RETIRED_PREFIX, WRITER_LOCK } from './saveEpoch.mjs';
export { SAVE_EPOCH, AUTHORITY, PENDING, ACKNOWLEDGED, GUARD, BACKUP_PREFIX, RETIRED_PREFIX };
export const PLAYER='newtone-player-save-v1';
const LOCK=WRITER_LOCK;
const PREF_FIELDS={language:v=>['zh','en'].includes(v),hasInitializedLanguage:v=>typeof v==='boolean',hasInitializedReadingMode:v=>typeof v==='boolean',readingMode:v=>v==='standard',themePosition:v=>Number.isFinite(v)&&v>=0&&v<=1,standardTheme:v=>['soft','light','dark'].includes(v),motionMode:v=>['full','reduced'].includes(v)};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>JSON.stringify(sort(v));
function sort(v){return Array.isArray(v)?v.map(sort):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
function requireThat(ok,reason){if(!ok)throw Error(reason);}
function parse(raw){let value;try{value=JSON.parse(raw);}catch{throw Error('INVALID_JSON');}requireThat(object(value),'INVALID_INVARIANT');return value;}
const readerKey=k=>/^newtone-(?:isolated-)?(?:progress-|narrative-progress-|reader-exit-tutorial-|reader-publication-)/.test(k);
// Retired data is immutable evidence, not an active runtime dependency.
const legacyExact=new Set([PLAYER,'newtone-player-save-release2','newtone-isolated-save-journal-v1','newtone-save-migration-v1-raw','newtone-save-migration-v1-done','newtone-public-release-cutover-v1','newtone.mainline.carried-phone.v1','newtone.mainline.carried-phone.v2','newtone.mainline.scene-positions.v1','newtone.mainline.scene-positions.v2','newtone-save-entry-authority-v2','newtone-save-entry-pending-v2','newtone-save-entry-acknowledged-v2','newtone-landing-intro-v1','newtone-isolated-landing-intro-v1','newtone-choice-wheel-hint-seen','newtone-scene-motion-enabled']);
const legacyKey=k=>legacyExact.has(k)||readerKey(k)||k.startsWith('newtone-save-entry-backup-v2:')||k.startsWith('newtone:center:scene-layout:')||k.startsWith('newtone-layout-');
const newKey=k=>[AUTHORITY,PENDING,ACKNOWLEDGED,GUARD].includes(k)||k.startsWith(BACKUP_PREFIX)||k.startsWith(RETIRED_PREFIX);
function physicalKeys(raw){return Array.from({length:raw.length},(_,i)=>raw.key(i)).filter(k=>k!==null).sort();}
function assertKnownNamespace(raw){for(const k of physicalKeys(raw))requireThat(!(k.startsWith('newtone-persistence:')&&!newKey(k))&&!(k.startsWith('newtone-player-save-')&&!legacyKey(k))&&!(k.startsWith('newtone.mainline.')&&!legacyKey(k)),'UNKNOWN_SAVE_NAMESPACE');}
function retirements(raw){
  return physicalKeys(raw).filter(k=>k.startsWith(RETIRED_PREFIX)).map(key=>{
    const record=parse(raw.getItem(key));
    requireThat(record.schema===1&&record.saveEpoch===SAVE_EPOCH&&object(record.ticket)&&['operationId','requestHash','baseSnapshotHash'].every(k=>typeof record.ticket[k]==='string'&&record.ticket[k].length>0)&&key===RETIRED_PREFIX+record.ticket.operationId&&typeof record.recordHash==='string'&&typeof record.pendingRaw==='string'&&(record.guardRaw===null||typeof record.guardRaw==='string')&&(record.backupRaw===null||typeof record.backupRaw==='string')&&record.backupKey===BACKUP_PREFIX+record.ticket.operationId&&record.reason==='source-changed-before-first-commit','INVALID_RETIREMENT');
    const prior=parse(record.pendingRaw);
    requireThat(prior.schema===2&&prior.saveEpoch===SAVE_EPOCH&&typeof prior.candidateRaw==='string'&&typeof prior.candidateSHA256==='string'&&prior.backupRequired===true&&['create','restart'].includes(prior.intent)&&prior.backup?.authorityRaw===null&&ticketEqual(prior.ticket,record.ticket)&&prior.backupKey===record.backupKey,'INVALID_RETIREMENT');
    if(record.guardRaw!==null){const g=parse(record.guardRaw);requireThat(g.saveEpoch===SAVE_EPOCH&&g.phase==='prepared'&&g.firstOperationId===record.ticket.operationId,'INVALID_RETIREMENT');}
    if(record.backupRaw!==null)requireThat(record.backupRaw===JSON.stringify(prior.backup),'INVALID_RETIREMENT');
    return record;
  });
}
function readGuard(raw){
  const text=raw.getItem(GUARD);if(text===null)return null;
  const g=parse(text);requireThat(g.saveEpoch===SAVE_EPOCH&&typeof g.firstOperationId==='string'&&g.firstOperationId.length>0&&['prepared','committed'].includes(g.phase)&&Object.keys(g).every(k=>['saveEpoch','firstOperationId','phase'].includes(k)),'INVALID_EPOCH_GUARD');
  // A committed witness is never retired. Exact prepared evidence remains in its record.
  if(g.phase==='prepared'&&retirements(raw).some(r=>r.guardRaw===text))return null;
  return g;
}
function activePendingRaw(raw){const text=raw.getItem(PENDING);return text!==null&&retirements(raw).some(r=>r.pendingRaw===text)?null:text;}
function hasActiveBackup(raw){const records=retirements(raw);return physicalKeys(raw).some(k=>k.startsWith(BACKUP_PREFIX)&&!records.some(r=>r.backupKey===k&&r.backupRaw===raw.getItem(k)));}


export function isServiceLogicalKey(k){return k===PLAYER||/^newtone-(?:progress-v[1-4]|narrative-progress-v[12]|reader-exit-tutorial-v1|landing-intro-v1|choice-wheel-hint-seen|scene-motion-enabled)$/.test(k)||k==='newtone-reader-publication-v1'||k.startsWith('newtone:center:scene-layout:');}
function validateValues(values){requireThat(object(values)&&Object.keys(values).every(isServiceLogicalKey),'UNSUPPORTED_FORMAT');requireThat(Object.values(values).every(v=>typeof v==='string'),'INVALID_INVARIANT');validateNew(parse(values[PLAYER]));}
function validateAuthority(j){
  requireThat(j.protocolVersion===2&&j.saveEpoch===SAVE_EPOCH,'UNSUPPORTED_SAVE_EPOCH');
  requireThat(Number.isSafeInteger(j.revision)&&j.revision>=0&&object(j.generation)&&typeof j.generation.id==='string'&&j.generation.id.length>0&&Number.isSafeInteger(j.generation.sequence)&&j.generation.sequence>=1,'INVALID_INVARIANT');
  requireThat(object(j.origin)&&j.origin.kind==='new'&&['service-epoch-1','retired-test-data'].includes(j.origin.sourceFormatId)&&(j.origin.parentGenerationId===null||typeof j.origin.parentGenerationId==='string')&&typeof j.origin.sourceSetHash==='string'&&object(j.placement)&&j.placement.ruleId==='new-epoch-start-v1'&&j.placement.result==='new-exempt','INVALID_INVARIANT');
  requireThat(object(j.sources)&&object(j.archive)&&object(j.operationReceipt)&&typeof j.operationReceipt.operationId==='string'&&typeof j.operationReceipt.requestHash==='string','INVALID_INVARIANT');
  requireThat(j.operationReceipt.resultingGenerationId===j.generation.id&&Number.isSafeInteger(j.operationReceipt.resultingRevision)&&j.operationReceipt.resultingRevision<=j.revision,'INVALID_OPERATION_RECEIPT');
  requireThat(Array.isArray(j.recoveryHolds)&&j.recoveryHolds.every(h=>object(h)&&h.domain==='cafe'&&h.release==='verified-return-to-cafe-space'),'INVALID_INVARIANT');
  requireThat(Object.values(j.sources).every(v=>v===null||typeof v==='string'),'INVALID_INVARIANT');
  requireThat(Object.keys(j).every(k=>['saveEpoch','protocolVersion','revision','generation','origin','placement','operationReceipt','sources','archive','values','recoveryHolds'].includes(k)),'UNSUPPORTED_FORMAT');validateValues(j.values);return j;
}
export function validateSaveEntryAuthority(value){return validateAuthority(value);}
function sources(raw){assertKnownNamespace(raw);return Object.fromEntries(physicalKeys(raw).filter(legacyKey).map(k=>[k,raw.getItem(k)]));}
function preferences(s){const prefs={};for(const family of ['newtone-isolated-progress-v','newtone-progress-v'])for(const v of [4,3,2,1]){try{const x=JSON.parse(s[family+v]??'null');if(!object(x))continue;for(const [k,valid] of Object.entries(PREF_FIELDS))if(!Object.hasOwn(prefs,k)&&valid(x[k]))prefs[k]=x[k];}catch{}}return prefs;}
function startupPreview(i){
  const data=i.authority?.values??preferenceInputs(i.physical);
  const found=preferences(data),defaults={language:'zh',readingMode:'standard',themePosition:0.5,standardTheme:'soft',motionMode:'full',hasInitializedLanguage:false,hasInitializedReadingMode:false};
  const effective={...defaults,...found},derived=[];
  if(!Object.hasOwn(found,'themePosition')&&Object.hasOwn(found,'standardTheme')){effective.themePosition={light:0,soft:0.5,dark:1}[found.standardTheme];derived.push('themePosition');}
  let value=data['newtone-landing-intro-v1'];if((value===null||value===undefined)&&i.authority){const original=preferenceInputs(i.authority.sources)['newtone-landing-intro-v1'];if(original!==null&&original!==undefined&&!['true','false'].includes(original))value=original;}
  const landingIntro=value===null||value===undefined?{status:'not-learned',learned:false,source:'absent'}:value==='true'||value==='false'?{status:value==='true'?'learned':'not-learned',learned:value==='true',source:i.authority?'journal':'physical'}:{status:'unknown',learned:null,source:'invalid'};
  return {preferences:effective,preferenceEvidence:{preservedFields:Object.keys(found),defaultedFields:Object.keys(defaults).filter(k=>!Object.hasOwn(found,k)&&!derived.includes(k)),derivedFields:derived},landingIntro};
}
function preferenceInputs(s){
  // Read only known preference/independent guidance values from old envelopes.
  // Never import their player/Reader state or replay old pending operations.
  const result={};
  for(const key of ['newtone-isolated-save-journal-v1','newtone-save-entry-authority-v2']){
    try{const old=JSON.parse(s[key]??'null');if(object(old?.values))for(const [k,v] of Object.entries(old.values)){
      if(typeof v!=='string')continue;
      if(/^newtone-(?:isolated-)?progress-v[1-4]$/.test(k))result[k]=v;
      if(k==='newtone-isolated-landing-intro-v1'||k==='newtone-landing-intro-v1')result['newtone-landing-intro-v1']=v;
    }}catch{}
  }
  return {...s,...result};
}
function initialAux(s){
  const data=preferenceInputs(s),prefs=preferences(data),values={'newtone-progress-v4':JSON.stringify({_version:4,currentView:'landing',committedLocation:{phaseId:'M1',pageId:'',beatIndex:0},furthestLocation:{phaseId:'M1',pageId:'',beatIndex:0},readerStarted:false,readerCompleted:false,resumeRequested:false,readerExitGestureLearned:false,chapterTrialEnded:false,readerScrollOffset:0,...prefs})};
  if(['true','false'].includes(data['newtone-landing-intro-v1']))values['newtone-landing-intro-v1']=data['newtone-landing-intro-v1'];
  return values;
}
const guidanceWarnings=()=>[];
const inspectionWarnings=()=>[];
function ticketEqual(a,b){return a&&b&&a.operationId===b.operationId&&a.requestHash===b.requestHash&&a.baseSnapshotHash===b.baseSnapshotHash;}
export function createSaveEntryService({storage,locks,onStoryCheckpoint,uuid=()=>crypto.randomUUID(),digest=async text=>{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}}={}){
  let activeLease=null,activeHandle=null,preparing=false,releasing=Promise.resolve(),disposed=false,defaultGuestStorage=null;
  // Feature flags or unavailable account configuration must never reopen a
  // retained guest that a previous account session has already claimed.
  const raw=()=>{requireThat(!disposed,'SAVE_SERVICE_DISPOSED');if(storage)return storage;return defaultGuestStorage??=createPlayerGuestRepository({storage:globalThis.localStorage,locks}).openCurrent();};
  const failure=(status,e)=>({status,reasonCodes:[e instanceof Error?e.message:String(e)]});
  async function acquire(){
    // Resolving the lock callback is not the native request completion barrier.
    await releasing;
    requireThat(!disposed,'SAVE_SERVICE_DISPOSED');
    if(activeLease)return activeLease;
    const manager=locks??globalThis.navigator?.locks;if(!manager?.request)throw Error('LOCKING_UNAVAILABLE');
    return new Promise((resolve,reject)=>{let settled=false;const finished=Promise.resolve().then(()=>manager.request(LOCK,{mode:'exclusive',ifAvailable:true},lock=>{
      if(!lock){settled=true;resolve(null);return;}
      if(disposed){settled=true;reject(Error('SAVE_SERVICE_DISPOSED'));return;}
      return new Promise(release=>{const lease={release(){if(activeLease===lease)activeLease=null;releasing=finished;release();return finished;}};activeLease=lease;settled=true;resolve(lease);});
    })).then(()=>undefined,error=>{if(!settled)reject(error);});});
  }
  const release=()=>{stop('lease-released');return activeLease?.release()??releasing;};
  function stop(reason){const h=activeHandle;activeHandle=null;if(h){h.revoke(reason);clearGameStorage(h.storage);}}
  async function inspectInternal(){
    const r=raw();assertKnownNamespace(r);
    for(const record of retirements(r)){const {recordHash,...payload}=record;requireThat(await digest(canonical(payload))===recordHash,'INVALID_RETIREMENT_INTEGRITY');}
    const authorityRaw=r.getItem(AUTHORITY),guard=readGuard(r);let authority=null,physical={};
    if(authorityRaw!==null){
      authority=validateAuthority(parse(authorityRaw));requireThat(guard!==null,'EPOCH_GUARD_MISSING');
    }else{
      const hasBackup=hasActiveBackup(r);
      requireThat(r.getItem(ACKNOWLEDGED)===null,'RECOVERY_EVIDENCE_WITHOUT_SAVE');
      requireThat(guard?.phase!=='committed','COMMITTED_SAVE_MISSING');
      requireThat(!(guard||hasBackup)||activePendingRaw(r)!==null,'RECOVERY_EVIDENCE_WITHOUT_SAVE');
      physical=sources(r);
    }
    const baseSnapshotHash=await digest(canonical({saveEpoch:SAVE_EPOCH,authorityRaw,guard:authority?guard:null,legacy:authority?null:physical}));
    return {physical,authorityRaw,authority,guard,baseSnapshotHash};
  }
  function pending(){const text=activePendingRaw(raw());if(text===null)return null;const p=parse(text);requireThat(p.schema===2&&p.saveEpoch===SAVE_EPOCH&&['create','restart','continue','replace'].includes(p.intent)&&object(p.ticket)&&typeof p.ticket.operationId==='string'&&typeof p.ticket.requestHash==='string'&&typeof p.ticket.baseSnapshotHash==='string'&&typeof p.candidateRaw==='string'&&object(p.backup),'INVALID_PENDING_OPERATION');requireThat(p.backupRequired===(p.backup.authorityRaw===null||p.intent==='replace'),'INVALID_PENDING_BACKUP');requireThat(p.backupKey===BACKUP_PREFIX+p.ticket.operationId&&p.backup.operationId===p.ticket.operationId&&object(p.backup.sourceRaw)&&(p.backup.authorityRaw===null||typeof p.backup.authorityRaw==='string'),'INVALID_PENDING_BACKUP');const guard=readGuard(raw());if(raw().getItem(AUTHORITY)===null&&guard)requireThat(guard.firstOperationId===p.ticket.operationId,'PENDING_GUARD_CONFLICT');const c=validateAuthority(parse(p.candidateRaw));requireThat(canonical(c.sources)===canonical(p.backup.sourceRaw),'INVALID_PENDING_BACKUP');return p;}
  async function inspectSave(){try{
    const i=await inspectInternal(),p=pending();
    if(p&&i.authority?.operationReceipt.operationId!==p.ticket.operationId)return {status:'ready',classification:'conflict',allowedActions:['back','reinspect'],reasonCodes:['PENDING_OPERATION'],snapshotToken:null};
    const classification=i.authority?'generation-current':Object.keys(i.physical).length?'legacy-reset-required':'empty';
    return {status:'ready',classification,allowedActions:classification==='empty'?['create']:classification==='legacy-reset-required'?['restart','back']:['continue','request-replace'],reasonCodes:[],preview:startupPreview(i),warnings:inspectionWarnings(i),preferences:startupPreview(i).preferences,snapshotToken:i.baseSnapshotHash};
  }catch(e){const reason=e.message;const classification=/CONFLICT|PENDING|RECOVERY_EVIDENCE|COMMITTED_SAVE_MISSING|GUARD_MISSING/.test(reason)?'conflict':/UNSUPPORTED|INSUFFICIENT|UNKNOWN_SAVE_NAMESPACE|unknown.*field|unknown.*version/i.test(reason)?'unknown':/JSON|INVARIANT|missing|invalid|unsupported|unknown|noncanonical/i.test(reason)?'corrupt':null;return {status:classification?'ready':'unavailable',classification,allowedActions:['back','reinspect'],reasonCodes:[reason],snapshotToken:null,preview:(()=>{try{return startupPreview({physical:sources(raw())});}catch{return startupPreview({physical:{}});}})()};}}
  async function prepareEntry({intent,snapshotToken,overwriteConfirmed=false}){
    if(preparing)return failure('busy','OPERATION_ACTIVE');preparing=true;let ticketForRecovery=null,prepareWriteAttempted=false,warningsForRecovery=[];
    try{
      requireThat(['create','restart','continue','replace'].includes(intent),'INVALID_INTENT');const lease=await acquire();if(!lease)return failure('busy','ANOTHER_SESSION_ACTIVE');
      const i=await inspectInternal();
      // An unreadable/active pending record is a protected operation, not a stale UI token.
      const prior=pending();requireThat(!prior||i.authority?.operationReceipt.operationId===prior.ticket.operationId,'PENDING_OPERATION');
      requireThat(snapshotToken===i.baseSnapshotHash,'SNAPSHOT_STALE');
      requireThat(intent!=='create'||(!i.authority&&Object.keys(i.physical).length===0),'RESTART_NOTICE_REQUIRED');requireThat(intent!=='restart'||(!i.authority&&Object.keys(i.physical).length>0),'NO_LEGACY_SAVE');requireThat(intent!=='continue'||i.authority,'NO_CURRENT_SAVE');requireThat(intent!=='replace'||(i.authority&&overwriteConfirmed===true),'OVERWRITE_CONFIRMATION_REQUIRED');
      // Only the service revokes handles. No old cleanup callback may write.
      stop('entry-operation-preparing');
      requireThat((await inspectInternal()).baseSnapshotHash===i.baseSnapshotHash,'SNAPSHOT_STALE');
      const newGame=intent!=='continue',generation=newGame?{id:uuid(),sequence:(i.authority?.generation.sequence??0)+1}:i.authority?.generation??{id:uuid(),sequence:1};
      let values=newGame?initialAux(i.authority?i.authority.values:i.physical):{...i.authority.values},player,placement,origin;
      if(newGame){
        player={...createInitialPlayerSave(),laoZhouCafeSeatId:selectLaoZhouCafeSeat(),updatedAt:Date.now()};
        player=openingGuidancePatch(player,{state:'not-triggered',evidence:['new-generation']},true);
        placement={ruleId:'new-epoch-start-v1',result:'new-exempt'};
        origin={kind:'new',sourceFormatId:intent==='restart'?'retired-test-data':'service-epoch-1',sourceSetHash:i.baseSnapshotHash,parentGenerationId:i.authority?.generation.id??null};
      }else{
        player=rewindUnfinished(validateNew(parse(values[PLAYER])));placement=i.authority.placement;origin=i.authority.origin;
      }
      values[PLAYER]=JSON.stringify(validateNew(player));warningsForRecovery=guidanceWarnings(player);
      const operationId=uuid(),requestHash=await digest(canonical({saveEpoch:SAVE_EPOCH,intent,baseSnapshotHash:i.baseSnapshotHash,generation,values,placement,origin})),ticket={operationId,requestHash,baseSnapshotHash:i.baseSnapshotHash};
      const candidate={saveEpoch:SAVE_EPOCH,recoveryHolds:player.sceneState['commercial-street']?.saveEntrySpatialHold===true?[{domain:'cafe',release:'verified-return-to-cafe-space'}]:[],protocolVersion:2,revision:(i.authority?.revision??-1)+1,generation,origin,placement,sources:i.authority?.sources??i.physical,archive:i.authority?.archive??{policy:'pre-epoch-test-data-not-imported',originalSources:'sources'},values,operationReceipt:{...ticket,resultingGenerationId:generation.id,resultingRevision:(i.authority?.revision??-1)+1}};
      validateAuthority(candidate);
      const record={schema:2,saveEpoch:SAVE_EPOCH,ticket,intent,backupRequired:!i.authority||intent==='replace',candidateSHA256:await digest(JSON.stringify(candidate)),candidateRaw:JSON.stringify(candidate),backup:{operationId,authorityRaw:i.authorityRaw,sourceRaw:i.authority?.sources??i.physical},backupKey:BACKUP_PREFIX+operationId};
      ticketForRecovery=ticket;prepareWriteAttempted=true;raw().setItem(PENDING,JSON.stringify(record));requireThat(raw().getItem(PENDING)===JSON.stringify(record),'PREPARE_OUTCOME_UNCERTAIN');
      return {status:'prepared',ticket,warnings:warningsForRecovery};
    }catch(e){await release();return {...failure(prepareWriteAttempted?'outcome-uncertain':/STALE/.test(e.message)?'stale':'blocked',e),...(ticketForRecovery?{ticket:ticketForRecovery,warnings:warningsForRecovery}:{})};}finally{preparing=false;}
  }
  function openHandle(j){
    stop('session-replaced');const listeners=new Set();let stopped=false,stopReason=null,cleanup=()=>{},storyObserver=null;
    const r=raw(),baseline=r.getItem(GUARD);requireThat(baseline!==null,'EPOCH_GUARD_MISSING');
    const handle={generation:j.generation.id,storage:null,get isOpen(){return !stopped;},get stopReason(){return stopReason;},check(){handle.storage.check();},onStop(fn){if(stopped){fn(stopReason);return()=>{};}listeners.add(fn);return()=>listeners.delete(fn);},revoke(reason){if(stopped)return;stopped=true;stopReason=reason;try{cleanup();}catch{}try{handle.storage?.stop(reason);}catch{}for(const fn of listeners){try{fn(reason);}catch{}}},close(){handle.revoke('session-closed');if(activeHandle===handle){activeHandle=null;clearGameStorage(handle.storage);return release();}return releasing;}};
    storyObserver=typeof onStoryCheckpoint==='function'?createPlayerStoryCheckpointObserver({initialValues:j.values,isActive:()=>activeHandle===handle&&handle.isOpen&&!disposed,onCheckpoint:events=>onStoryCheckpoint({sessionHandle:handle,events})}):null;
    handle.onStop(()=>storyObserver?.dispose());
    handle.storage=createJournalStorage(r,j,baseline,store=>store.getItem(GUARD),reason=>{handle.revoke(reason);if(activeHandle===handle){activeHandle=null;clearGameStorage(handle.storage);release();}},values=>storyObserver?.committed(values));
    handle.storage.setValidator(validateValues);installGameStorage(handle.storage);activeHandle=handle;
    if(globalThis.window){const target=globalThis.window;const check=()=>{try{handle.check();}catch{}};const timer=target.setInterval(check,250);target.addEventListener('storage',check);target.document?.addEventListener('visibilitychange',check);cleanup=()=>{target.clearInterval(timer);target.removeEventListener('storage',check);target.document?.removeEventListener('visibilitychange',check);};}
    return handle;
  }
  async function committed(p){await inspectInternal();const j=validateAuthority(parse(raw().getItem(AUTHORITY)));requireThat(ticketEqual(j.operationReceipt,p.ticket),'OPERATION_SUPERSEDED');const guard=readGuard(raw());requireThat(guard!==null,'EPOCH_GUARD_MISSING');if(guard.phase!=='committed'){const witness=JSON.stringify({...guard,phase:'committed'});raw().setItem(GUARD,witness);requireThat(raw().getItem(GUARD)===witness,'EPOCH_GUARD_WRITE_FAILED');}const i=await inspectInternal();requireThat(i.authorityRaw===JSON.stringify(j),'AUTHORITY_CONFLICT');const sessionHandle=openHandle(j);const warnings=guidanceWarnings(parse(j.values[PLAYER]));return {status:'committed',ticket:p.ticket,receipt:j.operationReceipt,snapshot:structuredClone(j),sessionHandle,warnings};}
  async function verifyPending(p){requireThat(await digest(p.candidateRaw)===p.candidateSHA256,'INVALID_PENDING_INTEGRITY');const c=parse(p.candidateRaw);requireThat(await digest(canonical({saveEpoch:SAVE_EPOCH,intent:p.intent,baseSnapshotHash:p.ticket.baseSnapshotHash,generation:c.generation,values:c.values,placement:c.placement,origin:c.origin}))===p.ticket.requestHash,'INVALID_OPERATION_TICKET');}
  async function commitEntry({ticket}){
    if(preparing)return failure('busy','OPERATION_ACTIVE');preparing=true;let attempted=false;
    try{const lease=await acquire();if(!lease)return failure('busy','ANOTHER_SESSION_ACTIVE');await inspectInternal();const p=pending();requireThat(p&&ticketEqual(p.ticket,ticket),'INVALID_OPERATION_TICKET');
      await verifyPending(p);const current=raw().getItem(AUTHORITY);if(current!==null&&ticketEqual(parse(current).operationReceipt,ticket))return await committed(p);
      const i=await inspectInternal();requireThat(i.baseSnapshotHash===ticket.baseSnapshotHash,'SNAPSHOT_STALE');stop('entry-operation-committing');
      if(p.backupRequired){const previousBackup=raw().getItem(p.backupKey);requireThat(previousBackup===null||previousBackup===JSON.stringify(p.backup),'BACKUP_CONFLICT');
        raw().setItem(p.backupKey,JSON.stringify(p.backup));requireThat(raw().getItem(p.backupKey)===JSON.stringify(p.backup),'BACKUP_FAILED');}
      const final=await inspectInternal();requireThat(final.baseSnapshotHash===ticket.baseSnapshotHash,'SNAPSHOT_STALE');
      if(!final.guard){const guard=JSON.stringify({saveEpoch:SAVE_EPOCH,firstOperationId:ticket.operationId,phase:'prepared'});raw().setItem(GUARD,guard);requireThat(raw().getItem(GUARD)===guard,'EPOCH_GUARD_WRITE_FAILED');}
      requireThat((await inspectInternal()).baseSnapshotHash===ticket.baseSnapshotHash,'SNAPSHOT_STALE');
      attempted=true;raw().setItem(AUTHORITY,p.candidateRaw);requireThat(raw().getItem(AUTHORITY)===p.candidateRaw,'COMMIT_OUTCOME_UNCERTAIN');return await committed(p);
    }catch(e){await release();return {...failure(attempted?'outcome-uncertain':/STALE/.test(e.message)?'stale':'not-committed',e),ticket};}finally{preparing=false;}
  }
  async function acknowledgeEntry({ticket,sessionHandle}){
    const ownedAtStart=Boolean(sessionHandle&&activeHandle===sessionHandle);let attempted=false;try{
      requireThat(activeLease&&activeHandle===sessionHandle,'SESSION_NOT_OWNED');sessionHandle.check();
      const j=validateAuthority(parse(raw().getItem(AUTHORITY)));requireThat(ticketEqual(j.operationReceipt,ticket)&&j.generation.id===sessionHandle.generation,'OPERATION_SUPERSEDED');
      const acknowledgement={schema:2,saveEpoch:SAVE_EPOCH,...ticket,generationId:j.generation.id};
      const existing=raw().getItem(ACKNOWLEDGED);
      if(existing!==null&&canonical(parse(existing))===canonical(acknowledgement))return {status:'acknowledged',ticket};
      attempted=true;raw().setItem(ACKNOWLEDGED,JSON.stringify(acknowledgement));
      requireThat(raw().getItem(ACKNOWLEDGED)===JSON.stringify(acknowledgement),'ACK_OUTCOME_UNCERTAIN');sessionHandle.check();
      return {status:'acknowledged',ticket};
    }catch(e){
      // UI is about to abandon this runtime. Revoke before returning; retain all
      // durable operation/ack evidence, including a write that actually landed.
      if(ownedAtStart){try{await sessionHandle.close();}catch{await release();}}
      return {...failure(attempted?'outcome-uncertain':'blocked',e),ticket};
    }
  }
  async function getRecoveryState(){try{
    await inspectInternal();const p=pending();if(!p)return {status:'no-pending-operation'};
    const a=raw().getItem(AUTHORITY),committed=a!==null&&ticketEqual(parse(a).operationReceipt,p.ticket);
    const ack=raw().getItem(ACKNOWLEDGED);requireThat(a!==null||ack===null,'RECOVERY_EVIDENCE_WITHOUT_SAVE');
    if(committed&&ack!==null){const value=parse(ack);requireThat(value.schema===2&&value.saveEpoch===SAVE_EPOCH,'INVALID_ACKNOWLEDGEMENT');if(ticketEqual(value,p.ticket)&&value.generationId===parse(a).generation.id)return {status:'no-pending-operation'};}
    return {status:'operation-found',ticket:p.ticket,phase:committed?'committed':'prepared',warnings:guidanceWarnings(parse((committed?parse(a):parse(p.candidateRaw)).values[PLAYER]))};
  }catch(e){return failure('blocked',e);}}

  async function retireUncommitted(p){
    requireThat(activeLease,'SESSION_NOT_OWNED');
    const ownedLease=activeLease;
    const r=raw();
    requireThat(['create','restart'].includes(p.intent)&&p.backup.authorityRaw===null,'RETIREMENT_NOT_PROVEN');
    requireThat(r.getItem(AUTHORITY)===null&&r.getItem(ACKNOWLEDGED)===null,'RETIREMENT_NOT_PROVEN');
    requireThat(r.getItem(PENDING)===JSON.stringify(p),'PENDING_OPERATION_CHANGED');
    const guardRaw=r.getItem(GUARD),guard=readGuard(r);
    requireThat(guard===null||(guard.phase==='prepared'&&guard.firstOperationId===p.ticket.operationId),'RETIREMENT_NOT_PROVEN');
    // An older already-retired prepared guard belongs to its own record, not this ticket.
    const ownedGuard=guard===null?null:guardRaw;
    const backupRaw=r.getItem(p.backupKey);
    requireThat(backupRaw===null||backupRaw===JSON.stringify(p.backup),'BACKUP_CONFLICT');
    const payload={schema:1,saveEpoch:SAVE_EPOCH,ticket:p.ticket,pendingRaw:JSON.stringify(p),guardRaw:ownedGuard,backupKey:p.backupKey,backupRaw,reason:'source-changed-before-first-commit'};
    const record=JSON.stringify({...payload,recordHash:await digest(canonical(payload))});
    requireThat(!disposed&&activeLease===ownedLease,'SESSION_NOT_OWNED');
    // Recheck after asynchronous hashing. No handle was ever published for a prepared guard.
    requireThat(r.getItem(AUTHORITY)===null&&r.getItem(ACKNOWLEDGED)===null&&r.getItem(PENDING)===payload.pendingRaw&&r.getItem(GUARD)===guardRaw&&r.getItem(p.backupKey)===backupRaw,'RETIREMENT_NOT_PROVEN');
    const key=RETIRED_PREFIX+p.ticket.operationId,previous=r.getItem(key);
    requireThat(previous===null||previous===record,'RETIREMENT_CONFLICT');
    r.setItem(key,record);requireThat(r.getItem(key)===record,'RETIREMENT_OUTCOME_UNCERTAIN');
    // No credential/raw/backup deletion: logical retirement is one durable write.
  }
  async function resolveOperation({ticket}){
    if(preparing)return failure('busy','OPERATION_ACTIVE');preparing=true;
    try{const lease=await acquire();if(!lease)return failure('busy','ANOTHER_SESSION_ACTIVE');await inspectInternal();const p=pending();if(!p||!ticketEqual(p.ticket,ticket)){await release();return {status:'superseded',ticket};}
      await verifyPending(p);const a=raw().getItem(AUTHORITY);if(a!==null&&ticketEqual(parse(a).operationReceipt,ticket))return await committed(p);
      const i=await inspectInternal();const same=i.baseSnapshotHash===ticket.baseSnapshotHash;if(!same){await retireUncommitted(p);await release();return {status:'superseded',ticket,resumeAllowed:false,reasonCodes:['UNCOMMITTED_OPERATION_RETIRED'],warnings:[]};}await release();return {status:'not-committed',ticket,resumeAllowed:true,warnings:guidanceWarnings(parse(parse(p.candidateRaw).values[PLAYER]))};
    }catch(e){await release();return {...failure('unresolved',e),ticket};}finally{preparing=false;}
  }
  // Read-only transfer boundary. The caller owns WRITER_LOCK for the complete
  // transfer; this method neither acquires a second lease nor rewinds gameplay.
  async function exportCurrentSave(){try{
    requireThat(!activeHandle&&!activeLease,'SOURCE_RUNTIME_STILL_ACTIVE');
    const i=await inspectInternal();requireThat(i.authority&&i.guard?.phase==='committed','NO_COMMITTED_CURRENT_SAVE');
    const recovery=await getRecoveryState();requireThat(recovery.status==='no-pending-operation','SOURCE_ENTRY_RECOVERY_REQUIRED');
    const again=await inspectInternal();requireThat(again.baseSnapshotHash===i.baseSnapshotHash&&again.authorityRaw===i.authorityRaw,'SOURCE_CHANGED_DURING_EXPORT');
    return {status:'exported',authorityRaw:i.authorityRaw,guardRaw:raw().getItem(GUARD),snapshot:structuredClone(i.authority),snapshotToken:i.baseSnapshotHash};
  }catch(e){return failure('blocked',e);}}
  async function dispose(){disposed=true;await release();}
  function exportActiveSave(){try{
    const handle=activeHandle,lease=activeLease;requireThat(handle&&lease,'SOURCE_RUNTIME_NOT_ACTIVE');handle.check();
    const authorityRaw=raw().getItem(AUTHORITY),authority=validateAuthority(parse(authorityRaw)),guardRaw=raw().getItem(GUARD),guard=readGuard(raw());handle.check();
    requireThat(!disposed&&activeHandle===handle&&activeLease===lease&&raw().getItem(AUTHORITY)===authorityRaw&&raw().getItem(GUARD)===guardRaw,'SOURCE_CHANGED_DURING_EXPORT');
    requireThat(guard?.phase==='committed','NO_COMMITTED_CURRENT_SAVE');
    return {status:'exported',snapshot:structuredClone(authority),authorityRaw,guardRaw};
  }catch(e){return failure('blocked',e);}}
  return {inspectSave,prepareEntry,commitEntry,getRecoveryState,resolveOperation,acknowledgeEntry,exportCurrentSave,exportActiveSave,dispose};
}
let browserService;
export function getSaveEntryService(){return browserService??=createSaveEntryService();}
