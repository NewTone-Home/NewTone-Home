import { createInitialPlayerSave } from '../center/runtime/playerSave.ts';
import { selectLaoZhouCafeSeat } from '../center/runtime/commercialCafeSeatSelection.ts';
import { mainlineScenes } from '../center/runtime/mainlineScenes.ts';
import { validateNew, convert, convertAncient, rewindUnfinished } from './saveMigration.mjs';
import { memoryStorage, createJournalStorage, installGameStorage } from '../save-session.mjs';
import { classifyLaoZhouConversation, openingGuidancePatch } from '../center/runtime/openingGuidance';

export const AUTHORITY='newtone-save-entry-authority-v2';
export const PENDING='newtone-save-entry-pending-v2';
export const ACKNOWLEDGED='newtone-save-entry-acknowledged-v2';
export const PLAYER='newtone-player-save-v1';
const OLD_JOURNAL='newtone-isolated-save-journal-v1';
const LOCK='newtone-save-entry-writer-v2';
const BACKUP_PREFIX='newtone-save-entry-backup-v2:';
const FOUR=new Set(['jijia-ancestral-home','jijia-ancestral-interior','zhongshuyuan-passage','zhongshuyuan-office']);
const PREF_FIELDS={language:v=>['zh','en'].includes(v),hasInitializedLanguage:v=>typeof v==='boolean',hasInitializedReadingMode:v=>typeof v==='boolean',readingMode:v=>v==='standard',themePosition:v=>Number.isFinite(v)&&v>=0&&v<=1,standardTheme:v=>['soft','light','dark'].includes(v),motionMode:v=>['full','reduced'].includes(v)};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>JSON.stringify(sort(v));
function sort(v){return Array.isArray(v)?v.map(sort):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
function requireThat(ok,reason){if(!ok)throw Error(reason);}
function parse(raw){let value;try{value=JSON.parse(raw);}catch{throw Error('INVALID_JSON');}requireThat(object(value),'INVALID_INVARIANT');return value;}
const readerKey=k=>/^newtone-(?:isolated-)?(?:progress-|narrative-progress-|reader-exit-tutorial-|reader-publication-)/.test(k);
const protectedSources=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!readerKey(k)).sort(([a],[b])=>a.localeCompare(b)));
export function isServiceLogicalKey(k){return k===PLAYER||/^newtone-(?:progress-v[1-4]|narrative-progress-v[12]|reader-exit-tutorial-v1|landing-intro-v1|choice-wheel-hint-seen|scene-motion-enabled)$/.test(k)||k==='newtone-reader-publication-v1'||k.startsWith('newtone:center:scene-layout:');}
function validateValues(values){requireThat(object(values)&&Object.keys(values).every(isServiceLogicalKey),'UNSUPPORTED_FORMAT');requireThat(Object.values(values).every(v=>typeof v==='string'),'INVALID_INVARIANT');validateNew(parse(values[PLAYER]));}
function validateAuthority(j){
  requireThat(j.protocolVersion===2,'UNSUPPORTED_FORMAT');
  requireThat(Number.isSafeInteger(j.revision)&&j.revision>=0&&object(j.generation)&&typeof j.generation.id==='string'&&j.generation.id.length>0&&Number.isSafeInteger(j.generation.sequence)&&j.generation.sequence>=1,'INVALID_INVARIANT');
  requireThat(object(j.origin)&&['new','historical'].includes(j.origin.kind)&&typeof j.origin.sourceSetHash==='string'&&object(j.placement)&&j.placement.ruleId==='legacy-four-scenes-v1'&&['new-exempt','applied','not-applicable'].includes(j.placement.result),'INVALID_INVARIANT');
  requireThat(object(j.sources)&&object(j.archive)&&object(j.operationReceipt)&&typeof j.operationReceipt.operationId==='string'&&typeof j.operationReceipt.requestHash==='string','INVALID_INVARIANT');
  requireThat(Array.isArray(j.recoveryHolds)&&j.recoveryHolds.every(h=>object(h)&&h.domain==='cafe'&&h.release==='verified-return-to-cafe-space'),'INVALID_INVARIANT');
  requireThat(Object.values(j.sources).every(v=>v===null||typeof v==='string'),'INVALID_INVARIANT');
  requireThat(j.placement.result!=='applied'||(j.origin.kind==='historical'&&FOUR.has(j.placement.evaluatedSourceScene)&&j.placement.evaluatedSourcePhone==='surface'),'INVALID_INVARIANT');
  requireThat(j.placement.result!=='new-exempt'||j.origin.kind==='new','INVALID_INVARIANT');
  requireThat(Object.keys(j).every(k=>['protocolVersion','revision','generation','origin','placement','operationReceipt','sources','archive','values','recoveryHolds'].includes(k)),'UNSUPPORTED_FORMAT');validateValues(j.values);return j;
}
function sources(raw){
  const keys=new Set([PLAYER,'newtone-player-save-release2',OLD_JOURNAL,'newtone-save-migration-v1-raw','newtone-save-migration-v1-done','newtone-public-release-cutover-v1','newtone.mainline.carried-phone.v1','newtone.mainline.carried-phone.v2','newtone.mainline.scene-positions.v1','newtone.mainline.scene-positions.v2','newtone-landing-intro-v1','newtone-choice-wheel-hint-seen','newtone-scene-motion-enabled']);
  for(let i=0;i<raw.length;i++){const k=raw.key(i);if(k&&(readerKey(k)||/^newtone-(?:isolated-)?landing-intro-/.test(k)||/^newtone-player-save-/.test(k)||k.startsWith('newtone.mainline.')||k.startsWith('newtone:center:scene-layout:')||k.startsWith('newtone-layout-')))keys.add(k);}
  return Object.fromEntries([...keys].sort().map(k=>[k,raw.getItem(k)]));
}
function preferences(s){const prefs={};for(const family of ['newtone-isolated-progress-v','newtone-progress-v'])for(const v of [4,3,2,1]){try{const x=JSON.parse(s[family+v]??'null');if(!object(x))continue;for(const [k,valid] of Object.entries(PREF_FIELDS))if(!Object.hasOwn(prefs,k)&&valid(x[k]))prefs[k]=x[k];}catch{}}return prefs;}
function startupPreview(i){
  const data=i.authority?.values??{...i.physical,...(i.old?.priorArchive?.values??{}),...(i.old?.auxiliary??{})};
  const found=preferences(data),defaults={language:'zh',readingMode:'standard',themePosition:0.5,standardTheme:'soft',motionMode:'full',hasInitializedLanguage:false,hasInitializedReadingMode:false};
  const effective={...defaults,...found},derived=[];
  if(!Object.hasOwn(found,'themePosition')&&Object.hasOwn(found,'standardTheme')){effective.themePosition={light:0,soft:0.5,dark:1}[found.standardTheme];derived.push('themePosition');}
  let value=data['newtone-landing-intro-v1'];if((value===null||value===undefined)&&i.authority){const original=i.authority.sources['newtone-landing-intro-v1'];if(original!==null&&original!==undefined&&!['true','false'].includes(original))value=original;}
  const landingIntro=value===null||value===undefined?{status:'not-learned',learned:false,source:'absent'}:value==='true'||value==='false'?{status:value==='true'?'learned':'not-learned',learned:value==='true',source:i.authority?'journal':'physical'}:{status:'unknown',learned:null,source:'invalid'};
  return {preferences:effective,preferenceEvidence:{preservedFields:Object.keys(found),defaultedFields:Object.keys(defaults).filter(k=>!Object.hasOwn(found,k)&&!derived.includes(k)),derivedFields:derived},landingIntro};
}
function initialAux(s){
  const prefs=preferences(s),values={'newtone-progress-v4':JSON.stringify({_version:4,currentView:'landing',committedLocation:{phaseId:'M1',pageId:'',beatIndex:0},furthestLocation:{phaseId:'M1',pageId:'',beatIndex:0},readerStarted:false,readerCompleted:false,resumeRequested:false,readerExitGestureLearned:false,chapterTrialEnded:false,readerScrollOffset:0,...prefs})};
  for(const k of ['newtone-landing-intro-v1','newtone-choice-wheel-hint-seen','newtone-scene-motion-enabled'])if(s[k]!==null&&s[k]!==undefined){if(k==='newtone-landing-intro-v1'){if(['true','false'].includes(s[k]))values[k]=s[k];}else{requireThat(['true','false','1','0'].includes(s[k]),'INVALID_INVARIANT');values[k]=s[k];}}
  for(const [k,v] of Object.entries(s))if(v!==null&&k.startsWith('newtone:center:scene-layout:')){const x=parse(v);requireThat(x.version===3&&typeof x.sceneId==='string'&&k===`newtone:center:scene-layout:${x.sceneId}:v3`&&object(x.items)&&Object.values(x.items).every(p=>object(p)&&Number.isFinite(p.x)&&Number.isFinite(p.y)),'UNSUPPORTED_FORMAT');values[k]=v;}
  return values;
}
function knownPlayer(raw){const p=parse(raw);if(p._version===1)return {source:p,save:convert(raw),format:'website-player-v1'};if(p._version===2){const withoutHistory=!Object.hasOwn(p,'shopOrderHistory');const candidate=withoutHistory?{...p,shopOrderHistory:[]}:p;return {source:p,save:rewindUnfinished(validateNew(candidate)),format:withoutHistory?'bddf-player-v2-before-order-history':'candidate-player-v2'};}throw Error('UNSUPPORTED_FORMAT');}
function historical(s){
  const unknown=Object.entries(s).some(([k,v])=>v!==null&&!readerKey(k)&&((k.startsWith('newtone-player-save-')&&![PLAYER,'newtone-player-save-release2'].includes(k))||k.startsWith('newtone-layout-')));
  requireThat(!unknown,'UNSUPPORTED_FORMAT');
  if(s[OLD_JOURNAL]!==null){
    const j=parse(s[OLD_JOURNAL]);requireThat(j.schema===1&&Number.isSafeInteger(j.revision)&&j.revision>=0&&object(j.values)&&object(j.sources),'INVALID_INVARIANT');requireThat(Object.keys(j).every(k=>['schema','revision','sources','values','readerDisposition'].includes(k)),'UNSUPPORTED_FORMAT');
    const result=knownPlayer(j.values['newtone-player-save-release2']);
    // Known prototype lineage must still match all indispensable physical inputs.
    for(const [k,v] of Object.entries(j.sources))if(!readerKey(k))requireThat((s[k]??null)===v,'SOURCE_CONFLICT');
    const auxiliary={};for(const [k,v] of Object.entries(j.values)){if(k==='newtone-player-save-release2'||readerKey(k))continue;const target=k.replace('newtone-isolated-landing-intro-','newtone-landing-intro-');requireThat(isServiceLogicalKey(target)&&typeof v==='string','UNSUPPORTED_FORMAT');auxiliary[target]=v;}
    return {...result,format:'prototype-schema1/'+result.format,priorArchive:j,auxiliary};
  }
  if(s[PLAYER]!==null&&s['newtone-player-save-release2']!==null)requireThat(s[PLAYER]===s['newtone-player-save-release2'],'SOURCE_CONFLICT');
  const raw=s[PLAYER]??s['newtone-player-save-release2'];
  if(raw!==null)return knownPlayer(raw);
  if(s['newtone.mainline.carried-phone.v2']!==null){const phone=parse(s['newtone.mainline.carried-phone.v2']);requireThat(typeof phone.sceneId==='string','INSUFFICIENT_LEGACY_EVIDENCE');return {source:{currentSceneId:phone.sceneId,phoneDevice:phone.device,sceneState:{}},save:convertAncient(s),format:'ancient-phone-v2-with-explicit-scene'};}
  if(Object.entries(protectedSources(s)).some(([k,v])=>v!==null&&(k.startsWith('newtone.mainline.')||k.startsWith('newtone-save-migration-'))))throw Error('INSUFFICIENT_LEGACY_EVIDENCE');
  return null;
}
function guidanceWarnings(player){return player?.sceneState?.['commercial-street']?.laoZhouOpeningPromptStatus==='unknown'?['LAO_ZHOU_TRIGGER_UNKNOWN']:[];}
function inspectionWarnings(i){return i.authority?guidanceWarnings(parse(i.authority.values[PLAYER])):i.old&&classifyLaoZhouConversation(i.old.source.sceneState).state==='unknown'?['LAO_ZHOU_TRIGGER_UNKNOWN']:[];}
function ticketEqual(a,b){return a&&b&&a.operationId===b.operationId&&a.requestHash===b.requestHash&&a.baseSnapshotHash===b.baseSnapshotHash;}
export function createSaveEntryService({storage,locks,uuid=()=>crypto.randomUUID(),digest=async text=>{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}}={}){
  let activeLease=null,activeHandle=null,preparing=false;
  const raw=()=>storage??globalThis.localStorage;
  const failure=(status,e)=>({status,reasonCodes:[e instanceof Error?e.message:String(e)]});
  async function acquire(){
    if(activeLease)return activeLease;
    const manager=locks??globalThis.navigator?.locks;if(!manager?.request)throw Error('LOCKING_UNAVAILABLE');
    return new Promise((resolve,reject)=>{let settled=false;Promise.resolve().then(()=>manager.request(LOCK,{mode:'exclusive',ifAvailable:true},lock=>{
      if(!lock){settled=true;resolve(null);return;}
      return new Promise(release=>{const lease={release(){if(activeLease===lease)activeLease=null;release();}};activeLease=lease;settled=true;resolve(lease);});
    })).catch(error=>{if(!settled)reject(error);});});
  }
  const release=()=>{stop('lease-released');installGameStorage(null);activeLease?.release();};
  function stop(reason){const h=activeHandle;activeHandle=null;if(h)h.revoke(reason);}
  async function inspectInternal(){
    const r=raw(),physical=sources(r),authorityRaw=r.getItem(AUTHORITY);let authority=null,old=null;
    if(authorityRaw!==null){authority=validateAuthority(parse(authorityRaw));requireThat(canonical(protectedSources(physical))===canonical(protectedSources(authority.sources)),'SOURCE_CONFLICT');}
    else {
      requireThat(r.getItem(ACKNOWLEDGED)===null,'RECOVERY_EVIDENCE_WITHOUT_SAVE');
      const hasBackup=Array.from({length:r.length},(_,n)=>r.key(n)).some(k=>k?.startsWith(BACKUP_PREFIX));
      requireThat(!hasBackup||r.getItem(PENDING)!==null,'RECOVERY_EVIDENCE_WITHOUT_SAVE');
      requireThat(physical[OLD_JOURNAL]!==null||(physical['newtone-save-migration-v1-raw']===null&&physical['newtone-save-migration-v1-done']===null),'RECOVERY_EVIDENCE_WITHOUT_SAVE');
      old=historical(physical);
    }
    const baseSnapshotHash=await digest(canonical({authorityRaw,protectedSources:protectedSources(physical)}));
    return {physical,authorityRaw,authority,old,baseSnapshotHash};
  }
  function pending(){const text=raw().getItem(PENDING);if(text===null)return null;const p=parse(text);requireThat(p.schema===2&&object(p.ticket)&&typeof p.ticket.operationId==='string'&&typeof p.ticket.requestHash==='string'&&typeof p.ticket.baseSnapshotHash==='string'&&typeof p.candidateRaw==='string'&&object(p.backup),'INVALID_PENDING_OPERATION');requireThat(p.backupRequired===(p.backup.authorityRaw===null||p.intent==='replace'),'INVALID_PENDING_BACKUP');requireThat(p.backupKey===BACKUP_PREFIX+p.ticket.operationId&&p.backup.operationId===p.ticket.operationId&&object(p.backup.sourceRaw)&&(p.backup.authorityRaw===null||typeof p.backup.authorityRaw==='string'),'INVALID_PENDING_BACKUP');validateAuthority(parse(p.candidateRaw));return p;}
  async function inspectSave(){try{
    const i=await inspectInternal(),p=pending();
    if(p&&i.authority?.operationReceipt.operationId!==p.ticket.operationId)return {status:'ready',classification:'conflict',allowedActions:['back','reinspect'],reasonCodes:['PENDING_OPERATION'],snapshotToken:null};
    const classification=i.authority?'generation-current':i.old?'historical-supported':'empty';
    return {status:'ready',classification,allowedActions:classification==='empty'?['create']:['continue','request-replace'],reasonCodes:[],preview:startupPreview(i),warnings:inspectionWarnings(i),preferences:startupPreview(i).preferences,snapshotToken:i.baseSnapshotHash};
  }catch(e){const reason=e.message;const classification=/CONFLICT|PENDING|RECOVERY_EVIDENCE/.test(reason)?'conflict':/UNSUPPORTED|INSUFFICIENT|unknown.*field|unknown.*version/i.test(reason)?'unknown':/JSON|INVARIANT|missing|invalid|unsupported|unknown|noncanonical/i.test(reason)?'corrupt':null;return {status:classification?'ready':'unavailable',classification,allowedActions:['back','reinspect'],reasonCodes:[reason],snapshotToken:null,preview:(()=>{try{return startupPreview({physical:sources(raw())});}catch{return startupPreview({physical:{}});}})()};}}
  async function prepareEntry({intent,snapshotToken,overwriteConfirmed=false}){
    if(preparing)return failure('busy','OPERATION_ACTIVE');preparing=true;let ticketForRecovery=null,prepareWriteAttempted=false,warningsForRecovery=[];
    try{
      requireThat(['create','continue','replace'].includes(intent),'INVALID_INTENT');const lease=await acquire();if(!lease)return failure('busy','ANOTHER_SESSION_ACTIVE');
      const i=await inspectInternal();requireThat(snapshotToken===i.baseSnapshotHash,'SNAPSHOT_STALE');
      const prior=pending();requireThat(!prior||i.authority?.operationReceipt.operationId===prior.ticket.operationId,'PENDING_OPERATION');
      requireThat(intent!=='create'||(!i.authority&&!i.old),'OVERWRITE_CONFIRMATION_REQUIRED');requireThat(intent!=='continue'||i.authority||i.old,'NO_SAVE');requireThat(intent!=='replace'||overwriteConfirmed===true,'OVERWRITE_CONFIRMATION_REQUIRED');
      // Only the service revokes handles. No old cleanup callback may write.
      stop('entry-operation-preparing');
      requireThat((await inspectInternal()).baseSnapshotHash===i.baseSnapshotHash,'SNAPSHOT_STALE');
      const newGame=intent!=='continue',generation=newGame?{id:uuid(),sequence:(i.authority?.generation.sequence??0)+1}:i.authority?.generation??{id:uuid(),sequence:1};
      let values=i.authority?{...i.authority.values}:{...initialAux({...i.physical,...(i.old?.priorArchive?.values??{})}),...(i.old?.auxiliary??{})},player,placement,origin;
      if(newGame){player={...createInitialPlayerSave(),laoZhouCafeSeatId:selectLaoZhouCafeSeat(),updatedAt:Date.now()};placement={ruleId:'legacy-four-scenes-v1',result:'new-exempt'};origin={kind:'new',sourceFormatId:'service-v2',sourceSetHash:i.baseSnapshotHash,parentGenerationId:i.authority?.generation.id??null};delete values['newtone-choice-wheel-hint-seen'];}
      else if(i.authority){player=rewindUnfinished(validateNew(parse(values[PLAYER])));placement=i.authority.placement;origin=i.authority.origin;}
      else{
        player=structuredClone(i.old.save);const original=i.old.source;
        const move=FOUR.has(original.currentSceneId)&&original.phoneDevice==='surface';
        if(move){const spawn={...mainlineScenes['commercial-street'].initialPlayerPosition};player={...player,currentSceneId:'commercial-street',currentPosition:spawn,scenePositions:{...player.scenePositions,'commercial-street':spawn},phoneDevice:'inner'};if(Object.values(player.cafeStoryDeliveries).some(d=>d.presentation==='pending')||Object.values(player.sceneState).some(st=>['dialogue','coffee-delivery','coffee-returning'].includes(st.commercialCafeNarrativePhase)||typeof st.commercialCafeTableDeliverySeatId==='string')){player.sceneState={...player.sceneState,'commercial-street':{...player.sceneState['commercial-street'],saveEntrySpatialHold:true,saveEntryPreviousSeatId:player.sceneState['commercial-street']?.commercialCafeTableDeliverySeatId??player.sceneState['commercial-cafe']?.commercialCafeTableDeliverySeatId??null}};}}
        placement={ruleId:'legacy-four-scenes-v1',result:move?'applied':'not-applicable',evaluatedSourceScene:original.currentSceneId,evaluatedSourcePhone:original.phoneDevice};origin={kind:'historical',sourceFormatId:i.old.format,sourceSetHash:i.baseSnapshotHash,parentGenerationId:null};
      }
      // Preserve original trigger evidence before conversion/defaults can obscure it.
      const evidence=newGame?{state:'not-triggered',evidence:['new-generation']}:i.authority?null:classifyLaoZhouConversation(i.old.source.sceneState);
      if(evidence)player=openingGuidancePatch(player,evidence,newGame);
      values[PLAYER]=JSON.stringify(validateNew(player));warningsForRecovery=guidanceWarnings(player);
      const operationId=uuid(),requestHash=await digest(canonical({intent,baseSnapshotHash:i.baseSnapshotHash,generation,values,placement,origin})),ticket={operationId,requestHash,baseSnapshotHash:i.baseSnapshotHash};
      const candidate={recoveryHolds:player.sceneState['commercial-street']?.saveEntrySpatialHold===true?[{domain:'cafe',release:'verified-return-to-cafe-space'}]:[],protocolVersion:2,revision:(i.authority?.revision??-1)+1,generation,origin,placement,sources:i.authority?.sources??i.physical,archive:i.authority?.archive??{readerPolicy:'not-imported',originalSources:'sources',prototype:i.old?.priorArchive??null},values,operationReceipt:{...ticket,resultingGenerationId:generation.id,resultingRevision:(i.authority?.revision??-1)+1}};
      validateAuthority(candidate);
      const record={schema:2,ticket,intent,backupRequired:!i.authority||intent==='replace',candidateSHA256:await digest(JSON.stringify(candidate)),candidateRaw:JSON.stringify(candidate),backup:{operationId,authorityRaw:i.authorityRaw,sourceRaw:i.authority?.sources??i.physical},backupKey:BACKUP_PREFIX+operationId};
      ticketForRecovery=ticket;prepareWriteAttempted=true;raw().setItem(PENDING,JSON.stringify(record));requireThat(raw().getItem(PENDING)===JSON.stringify(record),'PREPARE_OUTCOME_UNCERTAIN');
      return {status:'prepared',ticket,warnings:warningsForRecovery};
    }catch(e){release();return {...failure(prepareWriteAttempted?'outcome-uncertain':/STALE/.test(e.message)?'stale':'blocked',e),...(ticketForRecovery?{ticket:ticketForRecovery,warnings:warningsForRecovery}:{})};}finally{preparing=false;}
  }
  function openHandle(j){
    stop('session-replaced');const listeners=new Set();let stopped=false,cleanup=()=>{};
    const r=raw(),baseline=canonical(protectedSources(j.sources));
    const handle={generation:j.generation.id,storage:null,check(){handle.storage.check();},onStop(fn){if(stopped){fn('save-session-stopped');return()=>{};}listeners.add(fn);return()=>listeners.delete(fn);},revoke(reason){if(stopped)return;stopped=true;try{cleanup();}catch{}try{handle.storage?.stop(reason);}catch{}for(const fn of listeners){try{fn(reason);}catch{}}},close(){handle.revoke('session-closed');if(activeHandle===handle){activeHandle=null;installGameStorage(null);release();}}};
    handle.storage=createJournalStorage(r,j,baseline,store=>canonical(protectedSources(sources(store))),reason=>{handle.revoke(reason);if(activeHandle===handle){activeHandle=null;installGameStorage(null);release();}});
    handle.storage.setValidator(validateValues);installGameStorage(handle.storage);activeHandle=handle;
    if(globalThis.window){const target=globalThis.window;const check=()=>{try{handle.check();}catch{}};const timer=target.setInterval(check,250);target.addEventListener('storage',check);target.document?.addEventListener('visibilitychange',check);cleanup=()=>{target.clearInterval(timer);target.removeEventListener('storage',check);target.document?.removeEventListener('visibilitychange',check);};}
    return handle;
  }
  async function committed(p){const j=validateAuthority(parse(raw().getItem(AUTHORITY)));requireThat(ticketEqual(j.operationReceipt,p.ticket),'OPERATION_SUPERSEDED');const i=await inspectInternal();requireThat(i.authorityRaw===JSON.stringify(j),'AUTHORITY_CONFLICT');const sessionHandle=openHandle(j);const warnings=guidanceWarnings(parse(j.values[PLAYER]));return {status:'committed',ticket:p.ticket,receipt:j.operationReceipt,snapshot:structuredClone(j),sessionHandle,warnings};}
  async function verifyPending(p){requireThat(await digest(p.candidateRaw)===p.candidateSHA256,'INVALID_PENDING_INTEGRITY');const c=parse(p.candidateRaw);requireThat(await digest(canonical({intent:p.intent,baseSnapshotHash:p.ticket.baseSnapshotHash,generation:c.generation,values:c.values,placement:c.placement,origin:c.origin}))===p.ticket.requestHash,'INVALID_OPERATION_TICKET');}
  async function commitEntry({ticket}){
    if(preparing)return failure('busy','OPERATION_ACTIVE');preparing=true;let attempted=false;
    try{const lease=await acquire();if(!lease)return failure('busy','ANOTHER_SESSION_ACTIVE');const p=pending();requireThat(p&&ticketEqual(p.ticket,ticket),'INVALID_OPERATION_TICKET');
      await verifyPending(p);const current=raw().getItem(AUTHORITY);if(current!==null&&ticketEqual(parse(current).operationReceipt,ticket))return await committed(p);
      const i=await inspectInternal();requireThat(i.baseSnapshotHash===ticket.baseSnapshotHash,'SNAPSHOT_STALE');stop('entry-operation-committing');
      if(p.backupRequired){const previousBackup=raw().getItem(p.backupKey);requireThat(previousBackup===null||previousBackup===JSON.stringify(p.backup),'BACKUP_CONFLICT');
        raw().setItem(p.backupKey,JSON.stringify(p.backup));requireThat(raw().getItem(p.backupKey)===JSON.stringify(p.backup),'BACKUP_FAILED');}
      const final=await inspectInternal();requireThat(final.baseSnapshotHash===ticket.baseSnapshotHash,'SNAPSHOT_STALE');
      attempted=true;raw().setItem(AUTHORITY,p.candidateRaw);requireThat(raw().getItem(AUTHORITY)===p.candidateRaw,'COMMIT_OUTCOME_UNCERTAIN');return await committed(p);
    }catch(e){release();return {...failure(attempted?'outcome-uncertain':/STALE/.test(e.message)?'stale':'not-committed',e),ticket};}finally{preparing=false;}
  }
  async function acknowledgeEntry({ticket,sessionHandle}){
    const ownedAtStart=Boolean(sessionHandle&&activeHandle===sessionHandle);let attempted=false;try{
      requireThat(activeLease&&activeHandle===sessionHandle,'SESSION_NOT_OWNED');sessionHandle.check();
      const j=validateAuthority(parse(raw().getItem(AUTHORITY)));requireThat(ticketEqual(j.operationReceipt,ticket)&&j.generation.id===sessionHandle.generation,'OPERATION_SUPERSEDED');
      const acknowledgement={schema:2,...ticket,generationId:j.generation.id};
      const existing=raw().getItem(ACKNOWLEDGED);
      if(existing!==null&&canonical(parse(existing))===canonical(acknowledgement))return {status:'acknowledged',ticket};
      attempted=true;raw().setItem(ACKNOWLEDGED,JSON.stringify(acknowledgement));
      requireThat(raw().getItem(ACKNOWLEDGED)===JSON.stringify(acknowledgement),'ACK_OUTCOME_UNCERTAIN');sessionHandle.check();
      return {status:'acknowledged',ticket};
    }catch(e){
      // UI is about to abandon this runtime. Revoke before returning; retain all
      // durable operation/ack evidence, including a write that actually landed.
      if(ownedAtStart){try{sessionHandle.close();}catch{release();}}
      return {...failure(attempted?'outcome-uncertain':'blocked',e),ticket};
    }
  }
  async function getRecoveryState(){try{
    const p=pending();if(!p)return {status:'no-pending-operation'};
    const a=raw().getItem(AUTHORITY),committed=a!==null&&ticketEqual(parse(a).operationReceipt,p.ticket);
    const ack=raw().getItem(ACKNOWLEDGED);requireThat(a!==null||ack===null,'RECOVERY_EVIDENCE_WITHOUT_SAVE');
    if(committed&&ack!==null){const value=parse(ack);requireThat(value.schema===2,'INVALID_ACKNOWLEDGEMENT');if(ticketEqual(value,p.ticket)&&value.generationId===parse(a).generation.id)return {status:'no-pending-operation'};}
    return {status:'operation-found',ticket:p.ticket,phase:committed?'committed':'prepared',warnings:guidanceWarnings(parse((committed?parse(a):parse(p.candidateRaw)).values[PLAYER]))};
  }catch(e){return failure('blocked',e);}}

  async function resolveOperation({ticket}){
    if(preparing)return failure('busy','OPERATION_ACTIVE');preparing=true;
    try{const lease=await acquire();if(!lease)return failure('busy','ANOTHER_SESSION_ACTIVE');const p=pending();if(!p||!ticketEqual(p.ticket,ticket)){release();return {status:'superseded',ticket};}
      await verifyPending(p);const a=raw().getItem(AUTHORITY);if(a!==null&&ticketEqual(parse(a).operationReceipt,ticket))return await committed(p);
      const i=await inspectInternal();release();const same=i.baseSnapshotHash===ticket.baseSnapshotHash;return {status:same?'not-committed':'superseded',ticket,resumeAllowed:same,warnings:same?guidanceWarnings(parse(parse(p.candidateRaw).values[PLAYER])):[]};
    }catch(e){release();return {...failure('unresolved',e),ticket};}finally{preparing=false;}
  }
  return {inspectSave,prepareEntry,commitEntry,getRecoveryState,resolveOperation,acknowledgeEntry};
}
let browserService;
export function getSaveEntryService(){return browserService??=createSaveEntryService();}
