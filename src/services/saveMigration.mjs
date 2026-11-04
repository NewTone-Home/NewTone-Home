import { createInitialPlayerSave, sanitizePlayerSave } from '../center/runtime/playerSave.ts';
import { mainlineSceneWorldLayers } from '../center/runtime/phoneState.ts';
import { commercialCafeStoryStateFromSceneState, commercialCafeStoryStatePatch, commercialCafeNarrativeDialogue } from '../center/runtime/commercialCafeStory.ts';
import { ruoyuCafeMeetingLines } from '../center/runtime/ruoyuCafeMeeting.ts';

const ANCIENT = ['newtone.mainline.carried-phone.v1','newtone.mainline.carried-phone.v2','newtone.mainline.scene-positions.v2'];
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = x => typeof x === 'number' && Number.isFinite(x);
const point = x => obj(x) && finite(x.x) && finite(x.y) && Object.keys(x).every(k => ['x','y'].includes(k));
const primitive = x => x === null || ['string','boolean'].includes(typeof x) || finite(x);
const stable = x => JSON.stringify(sort(x));
function sort(x) { return Array.isArray(x) ? x.map(sort) : obj(x) ? Object.fromEntries(Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => [k,sort(x[k])])) : x; }
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
// Exact writer/reader contracts at 9c349a34 and e3055f9f, before playerSave.
export function convertAncient(sources){
  const phoneRaw=sources[ANCIENT[1]]??sources[ANCIENT[0]];
  let phone=null;
  if(phoneRaw!==null&&phoneRaw!==undefined){
    if(['inner','surface'].includes(phoneRaw))phone={device:phoneRaw};
    else{
      phone=parse(phoneRaw,'ancient phone');
      ensure(['inner','surface'].includes(phone.device)&&Object.keys(phone).every(k=>['device','sceneId'].includes(k)),'unsupported ancient phone shape');
      if(Object.hasOwn(phone,'sceneId'))ensure(Object.hasOwn(mainlineSceneWorldLayers,phone.sceneId),'unknown ancient phone scene');
    }
  }
  const positionsRaw=sources[ANCIENT[2]];
  const positions=positionsRaw===null||positionsRaw===undefined?{}:parse(positionsRaw,'ancient positions');
  ensure(Object.entries(positions).every(([id,p])=>Object.hasOwn(mainlineSceneWorldLayers,id)&&point(p)),'invalid ancient positions');
  // v2 sceneId records the last route; bare v1 records do not. For those use
  // the historical reload contract (ancestral home), never infer last scene.
  const sceneId=phone?.sceneId??'jijia-ancestral-home';
  const layer=mainlineSceneWorldLayers[sceneId];
  const device=sceneId!=='zhongshuyuan-office'&&layer==='inner'?'inner':sceneId!=='zhongshuyuan-office'&&layer==='surface'?'surface':phone?.device??'surface';
  const initial=createInitialPlayerSave(sceneId);
  const legacy={_version:1,currentSceneId:sceneId,currentPosition:positions[sceneId]??null,scenePositions:positions,phoneDevice:device,storyClock:initial.storyClock,sceneState:{},phoneNotifications:[],phoneNotes:initial.phoneNotes,phoneContactNotes:{},phoneCallHistory:[],updatedAt:0};
  return convert(JSON.stringify(legacy));
}
function parse(raw, label) { try { const value = JSON.parse(raw); ensure(obj(value), label + ': expected object'); return value; } catch (e) { throw new Error(label + ': ' + e.message); } }
function validateCore(x, version) {
  ensure(obj(x) && x._version === version, 'unsupported player save version');
  for (const key of ['currentSceneId','currentPosition','scenePositions','phoneDevice','storyClock','sceneState','phoneNotifications','phoneNotes','phoneContactNotes','phoneCallHistory','updatedAt']) ensure(Object.hasOwn(x,key), 'missing player field: '+key);
  ensure(Object.hasOwn(mainlineSceneWorldLayers,x.currentSceneId), 'unknown current scene');
  ensure(x.currentPosition === null || point(x.currentPosition), 'invalid current position');
  ensure(obj(x.scenePositions) && Object.entries(x.scenePositions).every(([id,p]) => Object.hasOwn(mainlineSceneWorldLayers,id) && point(p)), 'invalid scene positions');
  ensure(['inner','surface'].includes(x.phoneDevice), 'invalid phone');
  ensure(obj(x.storyClock) && x.storyClock.dayId === 'story-day-001' && ['opening','commercial-street','cafe','yonghe'].includes(x.storyClock.stage), 'invalid story clock');
  ensure(Object.keys(x.storyClock).every(k=>['dayId','stage','year','month','day','weekday','hour','minute','weatherCycle'].includes(k)), 'unknown story clock field');
  for(const [k,max] of [['hour',23],['minute',59],['weekday',6]]) if(Object.hasOwn(x.storyClock,k)) ensure(Number.isInteger(x.storyClock[k])&&x.storyClock[k]>=0&&x.storyClock[k]<=max,'invalid story clock '+k);
  if(Object.hasOwn(x.storyClock,'weatherCycle')) ensure(['sunny','rainy'].includes(x.storyClock.weatherCycle),'invalid weather');
  if(['year','month','day'].some(k=>Object.hasOwn(x.storyClock,k))) {
    const {year,month,day}=x.storyClock;
    ensure(Number.isInteger(year)&&year>=1&&year<=9999&&Number.isInteger(month)&&month>=1&&month<=12&&Number.isInteger(day)&&day>=1&&day<=31,'invalid story date');
    const date=new Date(0);date.setUTCFullYear(year,month-1,day);
    ensure(date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day,'invalid story date');
  }
  ensure(finite(x.updatedAt) && x.updatedAt >= 0, 'invalid timestamp');
  ensure(obj(x.sceneState) && Object.entries(x.sceneState).every(([id,state]) => Object.hasOwn(mainlineSceneWorldLayers,id) && obj(state) && Object.values(state).every(primitive)), 'invalid scene state');
  ensure(Array.isArray(x.phoneNotifications) && Array.isArray(x.phoneNotes) && Array.isArray(x.phoneCallHistory) && obj(x.phoneContactNotes), 'invalid phone collections');
  validateDialogueState(x.sceneState);
}
function validateDialogueState(scenes) {
  for (const state of Object.values(scenes)) {
    const checks = {
      commercialCafeStoryStatus: ['available','ready-to-leave','complete'],
      commercialCafeNarrativePhase: ['not-started','dialogue','coffee-delivery','coffee-returning','complete'],
      commercialCafeCoffeeStatus: ['none','ordered','preparing','ready','delivered'],
      commercialCafeLaoZhouDeparture: ['seated','departed','walking-out'],
      commercialCafeRuoyuMeetingStatus: ['in-progress','complete'],
      commercialCafeStoryStage: ['entered','coffee-ordered','met-lao-zhou','coffee-delivered','intel-received','ready-to-leave','complete',null],
    };
    for (const [key,values] of Object.entries(checks)) if(Object.hasOwn(state,key)) ensure(values.includes(state[key]), 'unknown dialogue state: '+key);
    for (const [key,length] of [['commercialCafeNarrativeCursor',commercialCafeNarrativeDialogue.lines.length],['commercialCafeRuoyuMeetingCursor',ruoyuCafeMeetingLines.length]])
      if(Object.hasOwn(state,key)) ensure(Number.isInteger(state[key]) && state[key]>=0 && state[key]<=length, 'invalid dialogue cursor: '+key);
    if(state.commercialCafeLaoZhouDeparture==='walking-out') ensure(state.commercialCafeStoryStatus==='complete' && finite(state.commercialCafeCompletedAt), 'walking-out without explicit completed story');
    if (['coffee-delivery','coffee-returning'].includes(state.commercialCafeNarrativePhase)) ensure(state.commercialCafeNarrativeCursor===1, 'delivery cursor conflict');
    if (state.commercialCafeNarrativePhase==='coffee-returning') ensure(state.commercialCafeCoffeeStatus==='delivered', 'returning without delivered coffee');
    if (['complete','ready-to-leave'].includes(state.commercialCafeStoryStatus)) ensure(state.commercialCafeNarrativePhase===undefined || state.commercialCafeNarrativePhase==='complete', 'completed story phase conflict');
    if (['complete','ready-to-leave'].includes(state.commercialCafeStoryStatus) && Object.hasOwn(state,'commercialCafeNarrativeCursor')) ensure(state.commercialCafeNarrativeCursor===commercialCafeNarrativeDialogue.lines.length,'completed story cursor conflict');
    if (state.commercialCafeStoryStatus==='available') ensure(state.commercialCafeNarrativePhase!=='complete'&&!['complete','ready-to-leave'].includes(state.commercialCafeStoryStage),'available/completed story conflict');
    if(state.commercialCafeNarrativePhase==='not-started'&&Object.hasOwn(state,'commercialCafeNarrativeCursor')) ensure(state.commercialCafeNarrativeCursor===0,'unstarted cursor conflict');
    if (state.commercialCafeRuoyuMeetingStatus==='complete') ensure(state.commercialCafeRuoyuMeetingCursor===ruoyuCafeMeetingLines.length, 'completed Ruoyu cursor conflict');
  }
}
export function validateNew(x) {
  validateCore(x,2);
  const initial=createInitialPlayerSave();
  for(const key of ['worldGridVersion','commercialDepthVersion','miningLayoutVersion']) ensure(x[key]===initial[key],'unsupported layout version: '+key);
  for (const key of Object.keys(initial)) ensure(Object.hasOwn(x,key), 'missing new player field: '+key);
  const optional=['commercialDepthBackup','miningPositionRooms','miningPositionBackup','freshSeatOnly','migrationSchema'];
  ensure(Object.keys(x).every(k => Object.hasOwn(initial,k) || optional.includes(k)), 'unknown new player field');
  ensure(x.migrationSchema===undefined || x.migrationSchema==='isolated-prototype-1', 'unknown migration schema');
  const {migrationSchema,...payload}=x;
  ensure(stable(payload)===stable(sanitizePlayerSave(payload,payload.currentSceneId)), 'noncanonical or incomplete new player save');
  return x;
}
// Presentation-only restart; business receipts, orders, hand and completed flags stay intact.
export function rewindUnfinished(save) {
  const out=structuredClone(save);
  for (const state of Object.values(out.sceneState)) {
    if(Object.keys(state).some(k => k.startsWith('commercialCafe') && !k.startsWith('commercialCafeRuoyu'))) {
      let story=commercialCafeStoryStateFromSceneState(state);
      if(state.commercialCafeNarrativePhase===undefined && typeof state.commercialCafeStoryStage==='string' && story.status==='available' && story.narrativeCursor>0) story={...story,narrativePhase:'dialogue'};
      if(story.laoZhouDeparture==='seated' && state.commercialCafeLaoZhouDeparture==='walking-out') story={...story,laoZhouDeparture:'departed'};
      if(story.status==='available') {
        if(story.narrativePhase==='dialogue') story={...story,narrativeCursor: story.narrativeCursor>=2 ? 2 : 0};
        // Delivery dialogue is one line (cursor 1). Returning is a physical route,
        // never rewind it into another delivery or repeat its business event.
        if(story.narrativePhase==='coffee-delivery') story={...story,narrativeCursor:1};
      }
      Object.assign(state,commercialCafeStoryStatePatch(story));
    }
    if(state.commercialCafeRuoyuMeetingStatus==='in-progress') state.commercialCafeRuoyuMeetingCursor=0;
  }
  return out;
}
export function convert(raw) {
  const old=parse(raw,'legacy player'); validateCore(old,1);
  const allowed=new Set([...Object.keys(createInitialPlayerSave()),'commercialDepthBackup','miningPositionRooms','miningPositionBackup','freshSeatOnly']);
  ensure(Object.keys(old).every(k=>allowed.has(k)), 'unknown legacy player fields');
  // Phone cleaners must not silently drop existing records.
  const next=sanitizePlayerSave(old,old.currentSceneId);
  for(const k of ['phoneNotifications','phoneNotes','phoneContactNotes','phoneCallHistory']) ensure(stable(old[k])===stable(next[k]),'unsupported legacy phone data: '+k);
  for(const k of ['shopOrders','shopOrderHistory','heldConsumable','shopOrderPaymentReceipts','monthlySalaryReceipts','cafeStoryDeliveries','gameTimeMs','laoZhouCafeSeatId'])
    if(Object.hasOwn(old,k)) ensure(stable(old[k])===stable(next[k]),'unsupported legacy extension: '+k);
  if(Object.hasOwn(old,'walletBalance')) ensure(Number.isSafeInteger(old.walletBalance)&&old.walletBalance>=0,'invalid legacy wallet');
  next.walletBalance=Object.hasOwn(old,'walletBalance') ? old.walletBalance : 800;
  return validateNew(rewindUnfinished(next));
}
