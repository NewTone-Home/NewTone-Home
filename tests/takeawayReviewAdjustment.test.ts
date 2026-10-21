import { describe,expect,it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityCollision } from '../src/center/runtime/sceneLayout'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
const scene=mainlineScenes['commercial-street']
describe('minimal takeaway review changes',()=>{
 it('shortens only the milk-tea return and brings the same pickup marker to the service end',()=>{
  const body=scene.continuousStructures.find(b=>b.id==='milk-tea-trial-rear-return-body')!
  expect(body.width*19.2).toBeCloseTo(32,5)
  const room=scene.rooms.find(r=>r.id==='commercial-south-s5-interior')!,pickup=scene.objects.find(o=>o.id==='commercial-s5-milk-tea-pickup-service-label')!
  expect((pickup.position.y-room.bounds.y)*10.8).toBeCloseTo(528,5)
  expect(scene.accessRegions.some(r=>r.id==='milk-tea-trial-staff-1')).toBe(false)
  expect(scene.passages.find(p=>p.id==='commercial-south-s5-interior-rear-door')!.access).toBe('locked')
 })
 it('brings cutting and packing to56px apart while leaving real body clearance to the service counter',()=>{
  const cut=scene.objects.find(o=>o.id==='fruit-tea-trial-equipment-2')!,pack=scene.objects.find(o=>o.id==='fruit-tea-trial-equipment-3')!
  expect(Math.abs(pack.position.y-cut.position.y)*10.8).toBeCloseTo(56,5)
  const packBody=mainlineEntityCollision(scene,pack,{},sceneDesignReferenceMetrics)!,counter=scene.continuousStructures.find(b=>b.id==='fruit-tea-trial-service-counter-body')!
  const gap=(counter.y-packBody.y-packBody.height)*10.8
  expect(gap).toBeGreaterThan(16);expect(gap).toBeLessThan(40)
 })
 it('keeps every corner glyph unique,16px adjacent, and counter bodies touching without positive-area overlap',()=>{
  for(const prefix of ['milk-tea-trial','fruit-tea-trial']){
   const bodies=scene.continuousStructures.filter(b=>b.id.startsWith(prefix)),cells=bodies.flatMap(b=>scene.objects.filter(o=>o.id.startsWith(b.id.slice(0,-5)+'-')))
   expect(new Set(cells.map(o=>o.position.x.toFixed(5)+':'+o.position.y.toFixed(5))).size).toBe(cells.length)
   const [a,b]=bodies,overlapX=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),overlapY=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)
   expect(Math.min(overlapX,overlapY)).toBeLessThan(.000001)
   expect(cells.some(c=>cells.some(other=>other!==c&&Math.abs(Math.hypot((c.position.x-other.position.x)*19.2,(c.position.y-other.position.y)*10.8)-16)<.001))).toBe(true)
  }
 })
})
