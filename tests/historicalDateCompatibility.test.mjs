import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { convert, validateNew } from '../src/services/saveMigration.mjs';
import { createSaveEntryService, AUTHORITY, PLAYER, BACKUP_PREFIX } from '../src/services/saveEntryService.mjs';
import { memoryStorage } from '../src/save-session.mjs';
import { createInitialPlayerSave, savePlayerSave, sanitizePlayerSave } from '../src/center/runtime/playerSave.ts';

// Exact public a5860fc writer shape: schema v1, paired month/day, no year.
// Do not add year to this fixture: exercising that absence is the regression.
const stages=[['opening','jijia-ancestral-home',10,0],['commercial-street','commercial-street',11,0],['cafe','commercial-cafe',12,0],['yonghe','yonghe-mining-perimeter',12,30]];
function websiteSave(stage='commercial-street') {
  const [,scene,hour,minute]=stages.find(row=>row[0]===stage);
  return {_version:1,currentSceneId:scene,currentPosition:null,scenePositions:{},phoneDevice:'inner',
    storyClock:{dayId:'story-day-001',stage,month:4,day:12,weekday:6,hour,minute,weatherCycle:'sunny'},
    sceneState:{'jijia-ancestral-home':{'interactionExplored:ancestor':true}},
    phoneNotifications:[],phoneNotes:[],phoneContactNotes:{},phoneCallHistory:[],updatedAt:55};
}
const digest=text=>Promise.resolve(createHash('sha256').update(text).digest('hex'));
function lockManager(){let occupied=false;return {async request(_key,_options,callback){if(occupied)return callback(null);occupied=true;try{return await callback({name:'date-test-lock'});}finally{occupied=false;}}};}
function serviceFor(raw,locks=lockManager()){let id=0;return createSaveEntryService({storage:raw,locks,digest,uuid:()=>`historical-date-${++id}`});}
const handles=[];
afterEach(async()=>{for(const handle of handles.splice(0))await handle.close();});
function snapshot(raw){return Object.fromEntries(Array.from({length:raw.length},(_,i)=>[raw.key(i),raw.getItem(raw.key(i))]));}

test.each(stages)('actual public v1 %s clock without year converts using its fixed anchor', (stage,_scene,hour,minute)=>{
  const source=websiteSave(stage),raw=JSON.stringify(source),before=structuredClone(source);
  expect(Object.hasOwn(source.storyClock,'year')).toBe(false);
  const migrated=convert(raw);
  expect(migrated.storyClock).toMatchObject({year:2025,month:4,day:12,stage,hour,minute});
  expect(migrated.gameTimeMs).toBe((hour*60+minute)*60_000);
  expect(migrated.sceneState['jijia-ancestral-home']['interactionExplored:ancestor']).toBe(true);
  for(const key of ['phoneNotifications','phoneNotes','phoneContactNotes','phoneCallHistory'])expect(migrated[key]).toEqual(source[key]);
  expect(source).toEqual(before);expect(JSON.stringify(source)).toBe(raw);
  expect(validateNew(migrated)).toBe(migrated);
});

test('registered v1 extensions retain valid simulation time, money and non-date facts',()=>{
  const source={...createInitialPlayerSave('commercial-street'),_version:1,walletBalance:650,gameTimeMs:55_321_000,
    sceneState:{'jijia-ancestral-home':{'interactionExplored:ancestor':true}}};
  delete source.storyClock.year;
  const raw=JSON.stringify(source),next=convert(raw);
  expect(next.gameTimeMs).toBe(source.gameTimeMs);
  expect(next.storyClock).toMatchObject({year:2025,month:4,day:12,hour:15,minute:22});
  for(const key of ['walletBalance','shopOrders','shopOrderHistory','heldConsumable','shopOrderPaymentReceipts','monthlySalaryReceipts','cafeStoryDeliveries','phoneNotifications','phoneNotes','phoneContactNotes','phoneCallHistory','sceneState'])expect(next[key]).toEqual(source[key]);
  expect(JSON.stringify(source)).toBe(raw);
});

test('yearless public v1 now restarts once through prepare/commit/ACK, preserving original raw',async()=>{
  const source={...websiteSave(),walletBalance:650};
  const oldRaw=JSON.stringify(source,null,2),raw=memoryStorage({[PLAYER]:oldRaw,'newtone-progress-v4':'{retired Reader'}),locks=lockManager(),service=serviceFor(raw,locks);
  const before=snapshot(raw),inspection=await service.inspectSave();
  expect(inspection).toMatchObject({classification:'legacy-reset-required',allowedActions:['restart','back']});
  expect(snapshot(raw)).toEqual(before);
  const prepared=await service.prepareEntry({intent:'restart',snapshotToken:inspection.snapshotToken});
  expect(prepared.status).toBe('prepared');
  const committed=await service.commitEntry({ticket:prepared.ticket});
  expect(committed.status).toBe('committed');handles.push(committed.sessionHandle);
  expect(committed.snapshot.origin.sourceFormatId).toBe('retired-test-data');
  const next=JSON.parse(committed.snapshot.values[PLAYER]);
  expect(next.storyClock).toMatchObject({year:2025,month:4,day:12});expect(next.walletBalance).toBe(800);
  expect(committed.snapshot.sources[PLAYER]).toBe(oldRaw);
  const backups=Object.keys(snapshot(raw)).filter(key=>key.startsWith(BACKUP_PREFIX));
  expect(backups).toHaveLength(1);expect(JSON.parse(raw.getItem(backups[0])).sourceRaw[PLAYER]).toBe(oldRaw);
  savePlayerSave({...next,walletBalance:640},committed.sessionHandle.storage);
  expect((await service.acknowledgeEntry({ticket:committed.ticket,sessionHandle:committed.sessionHandle})).status).toBe('acknowledged');
  expect((await service.getRecoveryState()).status).toBe('no-pending-operation');
  await committed.sessionHandle.close();
  const reopened=serviceFor(raw,locks),again=await reopened.inspectSave();
  expect(again.classification).toBe('generation-current');
  const p=await reopened.prepareEntry({intent:'continue',snapshotToken:again.snapshotToken});
  expect(p.status).toBe('prepared');const c=await reopened.commitEntry({ticket:p.ticket});
  expect(c.status).toBe('committed');handles.push(c.sessionHandle);
  expect(c.snapshot.generation).toEqual(committed.snapshot.generation);
  expect(JSON.parse(c.snapshot.values[PLAYER]).walletBalance).toBe(640);
  expect(Object.keys(snapshot(raw)).filter(key=>key.startsWith(BACKUP_PREFIX))).toEqual(backups);
  expect(raw.getItem(PLAYER)).toBe(oldRaw);expect(raw.getItem('newtone-progress-v4')).toBe('{retired Reader');
});

const invalidDates=[
 ['month only',{day:undefined}],['day only',{month:undefined}],['zero month',{month:0}],['month 13',{month:13}],
 ['zero day',{day:0}],['April 31',{day:31}],['unanchored February 28',{month:2,day:28}],['yearless leap day',{month:2,day:29}],
 ['null year',{year:null}],['string year',{year:'2025'}],['zero year',{year:0}],['fractional year',{year:2025.5}],
 ['year above limit',{year:10000}],['boolean year',{year:false}],['array year',{year:[]}],['object year',{year:{value:2025}}],
 ['string month',{month:'4'}],['fractional day',{day:12.5}],['conflicting weekday',{weekday:5}],
];
test.each(invalidDates)('unsafe v1 date %s remains rejected by converter but is only archived by the restart service',async(_name,patch)=>{
  const source=websiteSave();Object.assign(source.storyClock,patch);
  const oldRaw=JSON.stringify(source),raw=memoryStorage({[PLAYER]:oldRaw}),service=serviceFor(raw),before=snapshot(raw);
  expect(()=>convert(oldRaw)).toThrow();
  const inspection=await service.inspectSave();
  expect(inspection.allowedActions).toEqual(['restart','back']);
  expect(inspection.classification).toBe('legacy-reset-required');
  expect(raw.getItem(AUTHORITY)).toBeNull();expect(snapshot(raw)).toEqual(before);
});

test.each([[2028,2,29],[2025,4,30],[2025,12,31]])('explicit valid date %i-%i-%i is preserved, never replaced by the missing-year anchor',(year,month,day)=>{
  const source=websiteSave();Object.assign(source.storyClock,{year,month,day});
  expect(convert(JSON.stringify(source)).storyClock).toMatchObject({year,month,day});
});
test('explicit non-leap February 29 still rejects',()=>{
  const source=websiteSave();Object.assign(source.storyClock,{year:2025,month:2,day:29});
  expect(()=>convert(JSON.stringify(source))).toThrow('invalid story date');
});
test('pre-month/day v1 still uses its already registered day-001 baseline',()=>{
  const source=websiteSave();source.storyClock={dayId:'story-day-001',stage:'commercial-street'};
  expect(convert(JSON.stringify(source)).storyClock).toMatchObject({year:2025,month:4,day:12});
});
test.each([2,3,undefined])('missing year never promotes schema %s through converter; retired source is not imported',async version=>{
  const source={...createInitialPlayerSave('commercial-street'),_version:version};delete source.storyClock.year;
  const text=JSON.stringify(source),raw=memoryStorage({[PLAYER]:text}),service=serviceFor(raw),before=snapshot(raw);
  expect(()=>convert(text)).toThrow('unsupported player save version');
  const i=await service.inspectSave();expect(i.allowedActions).toEqual(['restart','back']);
  expect(snapshot(raw)).toEqual(before);expect(raw.getItem(AUTHORITY)).toBeNull();
});
test('unknown v1 fields stay rejected by converter; old slot only offers explicit restart',async()=>{
  const source={...websiteSave(),futureDateSchema:1},text=JSON.stringify(source),raw=memoryStorage({[PLAYER]:text});
  expect(()=>convert(text)).toThrow('unknown legacy player fields');
  expect((await serviceFor(raw).inspectSave()).allowedActions).toEqual(['restart','back']);
  expect(raw.getItem(PLAYER)).toBe(text);expect(raw.getItem(AUTHORITY)).toBeNull();
});
test('canonical v2 leap dates remain strict and unchanged; missing year never uses the v1 bridge',()=>{
  const source=createInitialPlayerSave('commercial-street');
  const explicit=sanitizePlayerSave({...source,storyClock:{...source.storyClock,year:2028,month:2,day:29}},source.currentSceneId);
  expect(validateNew(explicit)).toBe(explicit);
  const missing=structuredClone(explicit);delete missing.storyClock.year;
  expect(()=>validateNew(missing)).toThrow('invalid story date');
});
test('an existing authority with a missing year cannot fall back to the still-present public v1 raw',async()=>{
  const oldRaw=JSON.stringify(websiteSave()),raw=memoryStorage({[PLAYER]:oldRaw}),locks=lockManager(),service=serviceFor(raw,locks);
  const i=await service.inspectSave(),p=await service.prepareEntry({intent:'restart',snapshotToken:i.snapshotToken}),c=await service.commitEntry({ticket:p.ticket});
  expect(c.status).toBe('committed');handles.push(c.sessionHandle);await c.sessionHandle.close();
  const broken=JSON.parse(raw.getItem(AUTHORITY)),player=JSON.parse(broken.values[PLAYER]);delete player.storyClock.year;broken.values[PLAYER]=JSON.stringify(player);raw.setItem(AUTHORITY,JSON.stringify(broken));
  const before=snapshot(raw),result=await serviceFor(raw,locks).inspectSave();
  expect(result.allowedActions).toEqual(['back','reinspect']);expect(snapshot(raw)).toEqual(before);expect(raw.getItem(PLAYER)).toBe(oldRaw);
});

test('converter does not repair malformed simulation time; restart does not import it',async()=>{
  const source={...websiteSave(),gameTimeMs:'55321000'},text=JSON.stringify(source),raw=memoryStorage({[PLAYER]:text});
  expect(()=>convert(text)).toThrow('unsupported legacy extension: gameTimeMs');
  expect((await serviceFor(raw).inspectSave()).allowedActions).toEqual(['restart','back']);
  expect(raw.getItem(PLAYER)).toBe(text);expect(raw.getItem(AUTHORITY)).toBeNull();
});
