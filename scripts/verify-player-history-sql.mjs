// Local in-memory PostgreSQL only. Requires a separately installed pinned PGlite module.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
if(!process.env.PGLITE_MODULE)throw Error('Set PGLITE_MODULE to the local verifier module; never supply a database URL')
process.on('uncaughtException',error=>{console.error(JSON.stringify({status:'failed',message:error.message,code:error.code,detail:error.detail,position:error.position,where:error.where}));process.exit(1)})
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;
create table public.analytics_events(
id bigint generated always as identity primary key,client_event_id uuid unique,visitor_id uuid,session_id uuid,sequence integer,event_name text,
step_id text,scene_id text,object_id text,object_kind text,outcome text,dwell_ms bigint,position_x numeric,position_y numeric,occurred_at timestamptz,event_data jsonb not null default '{}',
constraint analytics_events_event_name_check check(event_name in ('landing_entry','center_object_interacted','session_checkpoint','session_end','center_scene_entered','center_scene_exited','center_position_sample','language_selected','commercial_storefront_interacted','milk_tea_order_confirmed','milk_tea_order_ready','milk_tea_order_picked_up','cafe_story_stage_reached')));
alter table public.analytics_events enable row level security;
create policy owner_select on public.analytics_events for select to authenticated using(current_setting('app.is_owner',true)='true');
create policy public_insert on public.analytics_events for insert to anon with check(true);
grant insert on public.analytics_events to anon;grant usage on sequence public.analytics_events_id_seq to anon;`)
const base=['20261106014425_analytics_release_v030.sql','20261106015021_analytics_release_owner_read_permissions.sql','20261106021835_analytics_unified_location_rollup.sql','20261106022440_analytics_interaction_room_scope.sql','20261106024037_analytics_raw_interaction_records.sql','20261106025158_analytics_player_timeline.sql']
for(const file of base)await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
const visitor='00000000-0000-4000-8000-000000000001',session='00000000-0000-4000-8000-000000000002'
let counter=10
async function insert(name,data,at='2026-11-06T01:00:00Z',outcome=null,step=null,scene=null){counter++;return db.query(`insert into public.analytics_events(client_event_id,visitor_id,session_id,sequence,event_name,event_data,occurred_at,outcome,step_id,scene_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[`00000000-0000-4000-8000-${String(counter).padStart(12,'0')}`,visitor,session,counter,name,JSON.stringify(data),at,outcome,step,scene])}
await insert('center_object_interacted',{release:'0.3.0',environment:'production',contentId:'old-known',endedAt:123})
const before=await db.query('select event_data from public.analytics_events order by id')
await db.exec(readFileSync(new URL('../docs/sql/player-history-v2-review.sql',import.meta.url),'utf8'))
assert.deepEqual((await db.query('select event_data from public.analytics_events order by id')).rows,before.rows)
const baseAt=Date.parse('2026-11-06T01:00:00Z')
const common={release:'0.3.0',environment:'production',webVisitId:'visit-1',documentId:'doc-1',historyProtocol:2,internalTest:false,buildSha:'a'.repeat(40),gameTimeMs:100}
await insert('web_visit_state',{...common,status:'foreground',reason:'opened',foregroundMs:0,startedAt:1000,lastKnownAt:1000,endConfirmed:false})
await insert('web_visit_state',{...common,status:'background',reason:'visibility',foregroundMs:3000,startedAt:1000,lastKnownAt:4000,endConfirmed:false},'2026-11-06T01:00:03Z')
await insert('center_entry_completed',{...common,intent:'create'},'2026-11-06T01:00:01Z')
await insert('interaction_started',{...common,interactionId:'one',contentId:'counter',startedAt:baseAt},'2026-11-06T01:00:02Z')
await insert('center_object_interacted',{...common,interactionId:'one',lastShown:{lineId:'line-2',sentenceIndex:1},lastConfirmed:{lineId:'line-1',sentenceIndex:0},endedAt:4000},'2026-11-06T01:00:03Z','story-completed')
await insert('foreground_no_operation',{...common,intervalId:'idle-1',startedAt:baseAt,endedAt:baseAt+1000,durationMs:1000,possibleAfk:false},'2026-11-06T01:00:04Z')
await insert('session_checkpoint',{...common,roomId:'cafe',sceneForegroundMs:2000,sceneEngagedMs:2000},'2026-11-05T23:59:59Z',null,'room-visit','commercial-street')
await insert('session_checkpoint',{...common,roomId:'cafe',sceneForegroundMs:5000,sceneEngagedMs:5000},'2026-11-06T01:00:05Z',null,'room-visit','commercial-street')
const rejected=[]
async function reject(label,name,payload){
 assert.equal((await db.query('select analytics_validation.payload($1::jsonb,$2::text) as valid',[JSON.stringify(payload),name])).rows[0].valid,false,'validator itself: '+label)
 await assert.rejects(insert(name,payload),error=>{assert.equal(error.code,'23514',label);assert.ok(['analytics_events_history_v2_check','analytics_events_v030_payload_check'].includes(error.constraint),label+': '+error.constraint);return true});rejected.push(label)
}
const validIdle={...common,intervalId:'idle-valid',startedAt:baseAt,endedAt:baseAt+30000,durationMs:30000,possibleAfk:false}
const bad=[
 ['missing protocol', 'center_entry_completed', {release:'0.3.0',environment:'production',intent:'create',lastShown:{lineId:'line',sentenceIndex:0}}],
 ['unbound status','session_checkpoint',{release:'0.3.0',environment:'production',status:'foreground'}],
 ['unbound nested snapshot','session_checkpoint',{release:'0.3.0',environment:'production',currentNoOperation:{secret:'value'}}],
 ['string protocol','session_checkpoint',{...common,historyProtocol:'2'}],
 ['null protocol','session_checkpoint',{...common,historyProtocol:null}],
 ['unknown protocol','session_checkpoint',{...common,historyProtocol:3}],
 ['object identifier','session_checkpoint',{...common,webVisitId:{secret:'value'}}],
 ['oversized identifier','session_checkpoint',{...common,documentId:'x'.repeat(129)}],
 ['invalid identifier','session_checkpoint',{...common,interactionId:'free text with spaces'}],
 ['object build','session_checkpoint',{...common,buildSha:{value:'a'.repeat(40)}}],
 ['wrong SHA length','session_checkpoint',{...common,buildSha:'abc'}],
 ['negative clock','session_checkpoint',{...common,gameTimeMs:-1}],
 ['object clock','session_checkpoint',{...common,gameTimeMs:{secret:'value'}}],
 ['infinite size timestamp','session_checkpoint',{...common,lastKnownAt:1e30}],
 ['string timestamp','session_checkpoint',{...common,startedAt:'2026-11-06'}],
 ['bad boolean','session_checkpoint',{...common,internalTest:'true'}],
 ['unknown status','session_checkpoint',{...common,status:'closed'}],
 ['nested progress text','center_object_interacted',{...common,lastShown:{lineId:'line',sentenceIndex:0,text:'private'}}],
 ['nested progress object ID','center_object_interacted',{...common,lastShown:{lineId:{secret:'value'},sentenceIndex:0}}],
 ['negative index','center_object_interacted',{...common,lastShown:{lineId:'line',sentenceIndex:-1}}],
 ['fractional index','center_object_interacted',{...common,lastShown:{lineId:'line',sentenceIndex:0.5}}],
 ['string index','center_object_interacted',{...common,lastShown:{lineId:'line',sentenceIndex:'0'}}],
 ['null index','center_object_interacted',{...common,lastShown:{lineId:'line',sentenceIndex:null}}],
 ['excessive page index','center_object_interacted',{...common,lastShown:{lineId:'line',sentenceIndex:0,pageIndex:1000001}}],
 ['nested progress time object','center_object_interacted',{...common,lastConfirmed:{lineId:'line',sentenceIndex:0,at:{secret:'value'}}}],
 ['active array type','session_checkpoint',{...common,activeInteractions:{secret:'value'}}],
 ['active array count','session_checkpoint',{...common,activeInteractions:Array.from({length:9},()=>({interactionId:'one',objectId:'npc'}))}],
 ['active arbitrary value','session_checkpoint',{...common,activeInteractions:[{interactionId:'one',objectId:'npc',payload:{secret:'value'}}]}],
 ['active nested invalid index','session_checkpoint',{...common,activeInteractions:[{interactionId:'one',objectId:'npc',lastShown:{lineId:'line',sentenceIndex:-1}}]}],
 ['idle snapshot arbitrary value','web_visit_state',{...common,status:'foreground',reason:'checkpoint',foregroundMs:0,startedAt:baseAt,lastKnownAt:baseAt,endConfirmed:false,currentNoOperation:{intervalId:'idle',startedAt:baseAt,durationMs:10,possibleAfk:false,payload:{secret:'value'}}}],
 ['idle snapshot invalid clock','session_checkpoint',{...common,currentNoOperation:{intervalId:'idle',startedAt:baseAt,gameTimeStartedMs:{secret:'value'},durationMs:10,possibleAfk:false}}],
 ['false close','web_visit_state',{...common,status:'foreground',reason:'opened',foregroundMs:0,startedAt:baseAt,lastKnownAt:baseAt,endConfirmed:true}],
 ['missing lifecycle required','interaction_started',{...common,interactionId:'one'}],
 ['wrong 30 second threshold','foreground_no_operation',{...validIdle,possibleAfk:true}],
 ['duration mismatch','foreground_no_operation',{...validIdle,durationMs:1}],
 ['reverse interval','foreground_no_operation',{...validIdle,endedAt:baseAt-1}],
 ['unknown root value','session_checkpoint',{...common,payload:{secret:'value'}}],
]
for(const [label,name,payload] of bad)await reject(label,name,payload)
const eventContract=JSON.parse(readFileSync(new URL('./history-event-enums.json',import.meta.url),'utf8'))
const clientSource=readFileSync(new URL('../src/services/analytics.js',import.meta.url),'utf8')
const validWeb={...common,status:'foreground',reason:'checkpoint',foregroundMs:0,startedAt:baseAt,lastKnownAt:baseAt,endConfirmed:false}
await reject('web_visit_state private intent','web_visit_state',{...validWeb,intent:'private user text'})
await reject('web_visit_state valid but misplaced intent','web_visit_state',{...validWeb,intent:'create'})
let enumAcceptances=0
for(const [key,values] of Object.entries(eventContract.enums)){
 const declaration=clientSource.split('const '+key+' = cleanChoice(value.'+key+', ')[1].split(')')[0]
 assert.deepEqual(JSON.parse(declaration.replaceAll("'",'"')),values,'client enum contract: '+key)
 for(const event of eventContract.events[key]){
  let base={}
  if(event.startsWith('center_entry_'))base={intent:'create'}
  if(event==='commercial_storefront_interacted')base={slotId:'commercial-south-slot-5',storeType:eventContract.enums.storeType[0]}
  if(event==='milk_tea_order_confirmed')base={drink:eventContract.enums.drink[0],sugar:eventContract.enums.sugar[0],ice:eventContract.enums.ice[0],orderNumber:1,queueAheadAtOrder:0}
  if(event.startsWith('shop_'))base={shopId:eventContract.enums.shopId[0]}
  for(const value of values){
   await insert(event,{release:'0.3.0',environment:'production',...base,[key]:value})
   await insert(event,{...common,...base,[key]:value});enumAcceptances+=2
  }
  await reject('private enum: '+event+'/'+key,event,{...common,...base,[key]:'private-user-text'})
  await reject('legacy private enum: '+event+'/'+key,event,{release:'0.3.0',environment:'production',...base,[key]:'private-user-text'})
 }
 await reject('misplaced enum: web_visit_state/'+key,'web_visit_state',{...validWeb,[key]:values[0]})
}
await reject('legacy cross-event field','landing_entry',{release:'0.3.0',environment:'production',drink:eventContract.enums.drink[0]})
await insert('session_checkpoint',{...common,activeInteractions:[{interactionId:'one',objectId:'npc',objectKind:'npc',lastShown:{lineId:'line',sentenceIndex:0,pageIndex:1,at:baseAt,gameTimeMs:null}}]})
await insert('web_visit_state',{...common,status:'foreground',reason:'checkpoint',foregroundMs:3000,startedAt:1000,lastKnownAt:baseAt,endConfirmed:false,currentNoOperation:{intervalId:'snapshot',startedAt:baseAt-10,gameTimeStartedMs:null,buildSha:null,internalTest:false,durationMs:10,possibleAfk:false}})
// An actually captured browser payload must also satisfy the validator, not just hand-built fixtures.
let capturedPayloadsValidated=0
const captures=process.env.HISTORY_CAPTURES?JSON.parse(process.env.HISTORY_CAPTURES):process.env.HISTORY_CAPTURE?[process.env.HISTORY_CAPTURE]:[]
for(const capture of captures){
 const rows=JSON.parse(readFileSync(capture,'utf8'))
 for(const row of rows){assert.equal((await db.query('select analytics_validation.payload($1::jsonb,$2::text) as valid',[JSON.stringify(row.event_data),row.event_name])).rows[0].valid,true,row.event_name+': '+JSON.stringify(row.event_data));capturedPayloadsValidated++}
}
const query=`select public.owner_player_history_v2('0.3.0','production','2026-11-06','2026-11-07',null,null,null,$1,$2) as data`
await db.exec(`set role authenticated;set app.is_owner='true'`)
const data=(await db.query(query,['','external'])).rows[0].data
assert.equal(data.locations[0].foreground_ms,3000);assert.equal(data.players.length,1);assert.equal(data.daily[0].foreground_ms,3000);assert.equal(data.daily[0].no_operation_ms,1000);assert.equal(data.daily[0].story_completions,1)
assert.equal((await db.query(query,['ffffffff','all'])).rows[0].data.players.length,0)
await db.exec('reset role')
const interval=async(id,start,end,extra={})=>insert('foreground_no_operation',{...common,documentId:'recovery-document',intervalId:id,startedAt:Date.parse(start),endedAt:Date.parse(end),durationMs:Date.parse(end)-Date.parse(start),possibleAfk:Date.parse(end)-Date.parse(start)>30000,...extra},end)
await interval('midnight','2026-11-06T23:59:50Z','2026-11-07T00:00:20Z')
await interval('recovery','2026-11-07T00:00:00Z','2026-11-07T00:00:10Z',{partial:true})
await interval('recovery','2026-11-07T00:00:00Z','2026-11-07T00:00:25Z',{partial:false})
await interval('after-recovery-gap','2026-11-07T00:01:00Z','2026-11-07T00:01:05Z',{partial:true})
await db.exec(`set role authenticated;set app.is_owner='true'`)
await db.exec("set time zone 'America/New_York'")
async function totals(from,to){return (await db.query(`select public.owner_player_history_v2('0.3.0','production',$1::timestamptz,$2::timestamptz,null,null,null,'','external') as data`,[from,to])).rows[0].data.daily.map(day=>({day:day.day.slice(0,10),ms:day.no_operation_ms}))}
assert.deepEqual(await totals('2026-11-06T00:00:00Z','2026-11-07T00:00:00Z'),[{day:'2026-11-06',ms:11000}])
assert.deepEqual(await totals('2026-11-07T00:00:00Z','2026-11-08T00:00:00Z'),[{day:'2026-11-07',ms:50000}])
assert.deepEqual(await totals('2026-11-06T23:59:55Z','2026-11-07T00:00:05Z'),[{day:'2026-11-06',ms:5000},{day:'2026-11-07',ms:10000}])
assert.deepEqual(await totals('2026-11-07T00:00:05Z','2026-11-07T00:00:15Z'),[{day:'2026-11-07',ms:20000}])
assert.deepEqual(await totals('2026-11-07T00:00:25Z','2026-11-07T00:01:00Z'),[{day:'2026-11-07',ms:0}])
assert.equal((await db.query(`select public.owner_player_history_v2('0.3.0','production','2026-11-07T00:00:00Z','2026-11-08T00:00:00Z',null,null,null,'','external') as data`)).rows[0].data.daily[0].players,1)
await db.exec(`set app.is_owner='false'`)
assert.equal((await db.query(query,['','all'])).rows[0].data.items.length,0)
await db.exec('reset role;set role anon')
await assert.rejects(db.query(query,['','all']))
await insert('session_checkpoint',{...common,activeInteractions:[]})
await reject('anon insert cannot bypass validator','session_checkpoint',{...common,lastShown:{lineId:'line',sentenceIndex:0,pageIndex:{secret:'value'}}})
console.log(JSON.stringify({status:'passed',engine:'local in-memory PGlite',checks:['six existing migrations + draft','old raw row unchanged','new payloads accepted','wrong AFK threshold / false closed / free text rejected','real foreground and no-op totals','story completion','player prefix search','non-owner RLS empty','anon RPC denied'],rows:data.items.length,enumAcceptances,capturedPayloadsValidated,rejectedCases:rejected,intervalChecks:['midnight split','window clipping at both ends','completion reported after window','partial recovery deduplication','unknown recovery gap excluded','half-open boundaries']}))
await db.close()
