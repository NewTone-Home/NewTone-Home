import { describe,expect,it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityCollision } from '../src/center/runtime/sceneLayout'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
const scene=mainlineScenes['commercial-street']
describe('minimal takeaway review changes',()=>{
 it('puts the milk-tea return at the street end and retains the pickup identity',()=>{
  const body=scene.continuousStructures.find(b=>b.id==='milk-tea-trial-front-return-body')!
  expect(body.width*19.2).toBeCloseTo(96,5)
  const room=scene.rooms.find(r=>r.id==='commercial-south-s5-interior')!,pickup=scene.objects.find(o=>o.id==='commercial-s5-milk-tea-pickup-service-label')!
  expect((pickup.position.y-room.bounds.y)*10.8).toBeCloseTo(432,5)
  expect(scene.accessRegions.some(r=>r.id==='milk-tea-trial-staff-1')).toBe(false)
  expect(scene.passages.find(p=>p.id==='commercial-south-s5-interior-rear-door')!.access).toBe('locked')
 })
 it('puts cutting and packing84px apart on the same employee line with48px body clearance for vertical devices',()=>{
  const cut=scene.objects.find(o=>o.id==='fruit-tea-trial-equipment-2')!,pack=scene.objects.find(o=>o.id==='fruit-tea-trial-equipment-3')!
  expect(Math.abs(pack.position.y-cut.position.y)*10.8).toBeCloseTo(84,5)
  const packBody=mainlineEntityCollision(scene,pack,{},sceneDesignReferenceMetrics)!,counter=scene.continuousStructures.find(b=>b.id==='fruit-tea-trial-long-counter-body')!
  const gap=(counter.x-packBody.x-packBody.width)*19.2
  expect(pack.position.x).toBe(cut.position.x)
  const room=scene.rooms.find(r=>r.id==='commercial-north-n1-interior')!
  expect((pack.position.x-room.bounds.x)*19.2).toBeCloseTo(48,5)
  expect((counter.x-room.bounds.x)*19.2).toBeCloseTo(104,5)
  expect(pack.textLayout).toBe('vertical')
  const expectedWidth=Number((16/19.2).toFixed(4))
  expect(packBody.width).toBe(expectedWidth)
  expect(packBody.height).toBe(Number((48/10.8).toFixed(4)))
  // Text footprint coordinates are quantized to four world-percent decimals.
  // Preserve that exact production representation, rather than relaxing the gap assertion.
  const expectedPackLeft=Number((room.bounds.x+48/19.2-expectedWidth/2).toFixed(4))
  expect(packBody.x).toBe(expectedPackLeft)
  const expectedGap=(room.bounds.x+104/19.2-expectedPackLeft-expectedWidth)*19.2
  expect(gap).toBeCloseTo(expectedGap,8)
 })
 it('keeps every corner glyph unique,16px adjacent, and counter bodies touching without positive-area overlap',()=>{
  for(const prefix of ['milk-tea-trial','fruit-tea-trial']){
   const bodies=scene.continuousStructures.filter(b=>b.id.startsWith(prefix)),cells=bodies.flatMap(b=>scene.objects.filter(o=>o.interactionStructureId===b.id))
   expect(new Set(cells.map(o=>o.position.x.toFixed(5)+':'+o.position.y.toFixed(5))).size).toBe(cells.length)
   const [a,b]=bodies,overlapX=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),overlapY=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)
   expect(Math.min(overlapX,overlapY)).toBeCloseTo(0,8)
   for(const body of bodies){
    const run=cells.filter(c=>c.interactionStructureId===body.id)
    expect(run.length).toBeGreaterThan(1)
    for(let i=0;i<run.length;i+=2){expect(run.slice(i,i+2).map(c=>c.label).join('')).toBe('柜台');expect(Math.hypot((run[i+1].position.x-run[i].position.x)*19.2,(run[i+1].position.y-run[i].position.y)*10.8)).toBeCloseTo(16,5)}
   }
  }
 })
})
