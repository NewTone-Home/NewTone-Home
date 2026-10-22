import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { canTravelAlongMainlineSegment, findMainlinePath, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { currentCafeOptions, cafePoint } from './helpers/currentCafe'

const scene=mainlineScenes['commercial-street']
const options=(actorId:string)=>({...currentCafeOptions,actorId,actorFootprint:{width:16/19.2,height:16/10.8}})
describe('visible counter terminals and the single Cafe employee exit',()=>{
 for(const [roomId,prefix,x,frontY,endY,wallX,worker] of [
  ['commercial-south-s5-interior','milk-tea-trial',224,112,684,336,'milk-tea-trial-worker'],
  ['commercial-north-n1-interior','fruit-tea-trial',112,560,16,0,'fruit-tea-trial-worker'],
 ] as const) it(`${prefix}: both terminals meet real walls and even staff cannot cross the counter`,()=>{
  const room=scene.rooms.find(r=>r.id===roomId)!,point=(x:number,y:number)=>({x:room.bounds.x+x/19.2,y:room.bounds.y+y/10.8})
  const bodies=scene.continuousStructures.filter(b=>b.id.startsWith(prefix)),cells=scene.objects.filter(o=>bodies.some(b=>o.interactionStructureId===b.id))
  expect(bodies).toHaveLength(2)
  expect(cells.filter(c=>Math.abs((c.position.x-room.bounds.x)*19.2-x)<.001).map(c=>(c.position.y-room.bounds.y)*10.8)).toContainEqual(expect.closeTo(endY,5))
  const arm=bodies.find(b=>b.width>b.height)!
  const outerEdge=wallX===0?arm.x:arm.x+arm.width
  expect((outerEdge-room.bounds.x)*19.2).toBeCloseTo(wallX===0?8:328,5)
  const long=bodies.find(b=>b.height>b.width)!
  expect(((endY===16?long.y:long.y+long.height)-room.bounds.y)*10.8).toBeCloseTo(endY===16?8:692,5)
  for(const y of [128,224,336,432,544]) expect(canTravelAlongMainlineSegment(point(x-32,y),point(x+32,y),scene,{},options(worker))).toBe(false)
  const publicPoint=point(x+(wallX===0?48:-48),336),staff=resolveMainlineNpcPosition(scene,worker)
  expect(findMainlinePath(publicPoint,staff,scene,{},options(worker))).toBeNull()
  const rear=scene.passages.find(p=>p.id===roomId+'-rear-door')!
  expect(rear.access).toBe('locked')
  expect(findMainlinePath(staff,rear.thresholds[0],scene,{},options(worker))).not.toBeNull()
  expect(frontY===112?arm.y<room.bounds.y+200/10.8:arm.y>room.bounds.y+480/10.8).toBe(true)
 })
 it('Cafe joins both walls, aligns the local front terminal and leaves one32px employee opening',()=>{
  const room=scene.rooms.find(r=>r.id==='commercial-north-cafe-interior')!
  const bodies=scene.continuousStructures.filter(b=>b.id.startsWith('cafe-trial-counter-'))
  expect(bodies).toHaveLength(3)
  const upper=bodies.find(b=>b.id==='cafe-trial-counter-upper-body')!,long=bodies.find(b=>b.id==='cafe-trial-counter-long-body')!,front=bodies.find(b=>b.id==='cafe-trial-counter-front-body')!
  expect((upper.y-room.bounds.y)*10.8).toBeCloseTo(8,5)
  expect((front.x-room.bounds.x)*19.2).toBeCloseTo(8,5)
  expect((front.y-room.bounds.y)*10.8+8).toBeCloseTo(476,5)
  expect((long.y-upper.y-upper.height)*10.8).toBeCloseTo(32,5)
  const staff=options('cafe-coffee-owner'),a=cafePoint(164,56),b=cafePoint(228,56)
  expect(canTravelAlongMainlineSegment(a,b,scene,{},staff)).toBe(true)
  expect(findMainlinePath(a,b,scene,{},staff)).not.toBeNull()
  expect(canTravelAlongMainlineSegment(a,b,scene,{},currentCafeOptions)).toBe(false)
  for(const y of [16,32,112,336,464]) expect(canTravelAlongMainlineSegment(cafePoint(164,y),cafePoint(228,y),scene,{},staff)).toBe(false)
  expect(canTravelAlongMainlineSegment(cafePoint(96,448),cafePoint(96,504),scene,{},staff)).toBe(false)
 })
})
