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
constraint analytics_events_event_name_check check(event_name in ('landing_entry','center_object_interacted','session_checkpoint','session_end','center_scene_entered','center_scene_exited','center_position_sample')));
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
const common={release:'0.3.0',environment:'production',webVisitId:'visit-1',documentId:'doc-1',historyProtocol:2,internalTest:false,buildSha:'a'.repeat(40),gameTimeMs:100}
await insert('web_visit_state',{...common,status:'foreground',reason:'opened',foregroundMs:0,startedAt:1000,lastKnownAt:1000,endConfirmed:false})
await insert('web_visit_state',{...common,status:'background',reason:'visibility',foregroundMs:3000,lastKnownAt:4000,endConfirmed:false},'2026-11-06T01:00:03Z')
await insert('center_entry_completed',{...common,intent:'create'},'2026-11-06T01:00:01Z')
await insert('interaction_started',{...common,interactionId:'one',contentId:'counter'},'2026-11-06T01:00:02Z')
await insert('center_object_interacted',{...common,interactionId:'one',lastShown:{lineId:'line-2',sentenceIndex:1},lastConfirmed:{lineId:'line-1',sentenceIndex:0},endedAt:4000},'2026-11-06T01:00:03Z','story-completed')
await insert('foreground_no_operation',{...common,intervalId:'idle-1',startedAt:1000,endedAt:2000,durationMs:1000,possibleAfk:false},'2026-11-06T01:00:04Z')
await insert('session_checkpoint',{...common,roomId:'cafe',sceneForegroundMs:2000,sceneEngagedMs:2000},'2026-11-05T23:59:59Z',null,'room-visit','commercial-street')
await insert('session_checkpoint',{...common,roomId:'cafe',sceneForegroundMs:5000,sceneEngagedMs:5000},'2026-11-06T01:00:05Z',null,'room-visit','commercial-street')
for(const [name,payload] of [['foreground_no_operation',{...common,durationMs:30000,possibleAfk:true}],['web_visit_state',{...common,endConfirmed:true}],['center_object_interacted',{...common,lastShown:{lineId:'safe',text:'private'}}]])await assert.rejects(insert(name,payload))
const query=`select public.owner_player_history_v2('0.3.0','production','2026-11-06','2026-11-07',null,null,null,$1,$2) as data`
await db.exec(`set role authenticated;set app.is_owner='true'`)
const data=(await db.query(query,['','external'])).rows[0].data
assert.equal(data.locations[0].foreground_ms,3000);assert.equal(data.players.length,1);assert.equal(data.daily[0].foreground_ms,3000);assert.equal(data.daily[0].no_operation_ms,1000);assert.equal(data.daily[0].story_completions,1)
assert.equal((await db.query(query,['ffffffff','all'])).rows[0].data.players.length,0)
await db.exec(`set app.is_owner='false'`)
assert.equal((await db.query(query,['','all'])).rows[0].data.items.length,0)
await db.exec('reset role;set role anon')
await assert.rejects(db.query(query,['','all']))
console.log(JSON.stringify({status:'passed',engine:'local in-memory PGlite',checks:['six existing migrations + draft','old raw row unchanged','new payloads accepted','wrong AFK threshold / false closed / free text rejected','real foreground and no-op totals','story completion','player prefix search','non-owner RLS empty','anon RPC denied'],rows:data.items.length}))
await db.close()
