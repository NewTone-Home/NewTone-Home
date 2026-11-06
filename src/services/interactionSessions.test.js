import { describe,it,expect } from 'vitest'
import { createInteractionSessions } from './interactionSessions'
const storage=()=>{const d=new Map();return{getItem:k=>d.get(k)??null,setItem:(k,v)=>d.set(k,v)}}
function fixture(store=storage()){let time=1000,fg=0,seq=0;const rows=[];const ledger=createInteractionSessions({foreground:()=>fg,location:()=>({sceneId:'commercial-street',roomId:'cafe'}),identity:()=>({releaseContext:{release:'0.3.0',environment:'staging'}}),emit:r=>{rows.push(r);return true},storage:store,now:()=>time,id:()=>`test-${++seq}`});return{ledger,rows,store,tick:(wall,front)=>{time+=wall;fg+=front}}}
describe('one final interaction record',()=>{
 it('merges text, choices and reply, excludes background, and ignores duplicate cleanup',()=>{
  const f=fixture(),meta={objectId:'counter',objectKind:'npc',contentId:'welcome'}
  f.ledger.begin('display','conversation:1',meta);f.tick(2000,2000)
  f.ledger.begin('display','conversation:1',{...meta,contentId:'choice'});f.tick(60000,0)
  f.ledger.begin('display','conversation:1',meta);f.tick(3000,3000)
  f.ledger.annotate('display','order-submitted');f.ledger.finish('display');f.ledger.finish('display')
  expect(f.rows).toHaveLength(1);expect(f.rows[0]).toMatchObject({durationMs:5000,result:'order-submitted',contentId:'welcome',startedAt:1000,endedAt:66000})
 })
 it('records instant duration as null and marks cancellation separately',()=>{
  const f=fixture();f.ledger.instant({objectId:'drink'},'consumed');expect(f.rows[0].durationMs).toBeNull()
  f.ledger.begin('display','x',{objectId:'counter'});f.tick(500,500);f.ledger.annotate('display','cancelled');f.ledger.finish('display');expect(f.rows[1]).toMatchObject({durationMs:500,result:'cancelled'})
 })
 it('recovers an unfinished lower bound once with the same ID and fixed creation context',()=>{
  const f=fixture();f.ledger.begin('display','x',{objectId:'lao-zhou'});f.tick(15000,10000);f.ledger.checkpoint()
  const recovered=fixture(f.store);expect(recovered.rows).toHaveLength(1);expect(recovered.rows[0]).toMatchObject({id:'test-1',durationMs:10000,partial:true,result:'interrupted',releaseContext:{release:'0.3.0',environment:'staging'}})
  expect(fixture(f.store).rows).toEqual([])
 })
 it('does not finish a new-room interaction while closing the old visit',()=>{
  const f=fixture();f.ledger.begin('display','x',{objectId:'counter',sceneId:'other',roomId:'room'});f.ledger.endLocation('commercial-street','cafe');expect(f.rows).toEqual([])
  f.ledger.endAll();expect(f.rows).toHaveLength(1)
 })
})
