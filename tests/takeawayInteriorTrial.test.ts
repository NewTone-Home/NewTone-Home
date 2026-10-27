import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { canActorReachPassageApproach, findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'

const scene=mainlineScenes['commercial-street'], options={screenMetrics:sceneDesignReferenceMetrics}
const trials=[
 {room:'commercial-south-s5-interior',prefix:'milk-tea-trial',front:'commercial-south-slot-5-entry',old:'commercial-s5-milk-tea-',worker:[240,392],order:'commercial-s5-milk-tea-order-service-label'},
 {room:'commercial-north-n1-interior',prefix:'fruit-tea-trial',front:'commercial-north-slot-1-entry',old:'commercial-retail-n1-fruit-tea-',worker:[96,252],order:'fruit-tea-trial-order'},
] as const
describe('two distinct takeaway layout trials',()=>{
 for(const trial of trials){const room=scene.rooms.find(r=>r.id===trial.room)!,point=(x:number,y:number)=>({x:room.bounds.x+x/19.2,y:room.bounds.y+y/10.8})
  it(`${trial.prefix}: keeps the room and true doors, with no old internal partition, fake door or seats`,()=>{
   expect(room.bounds.width*19.2).toBeCloseTo(336,3);expect(room.bounds.height*10.8).toBeCloseTo(644,3)
   const objects=scene.objects.filter(o=>o.roomId===room.id)
   expect(objects.some(o=>o.kind==='seat'||o.kind==='table'||o.kind==='door')).toBe(false)
   expect(scene.continuousStructures.some(b=>b.id.startsWith(trial.old))).toBe(false)
   expect(scene.passages.find(p=>p.id===trial.front)?.access).toBe('open')
   expect(scene.passages.find(p=>p.id===`${trial.room}-rear-door`)?.access).toBe('locked')
  })
  it(`${trial.prefix}: reaches both customer stations and the real front door without entering work space`,()=>{
   const front=scene.passages.find(p=>p.id===trial.front)!
   const from=front.crossingTargets.find(p=>p.x>=room.bounds.x&&p.x<=room.bounds.x+room.bounds.width&&p.y>=room.bounds.y&&p.y<=room.bounds.y+room.bounds.height)!
   expect(from).toBeTruthy()
   expect(isWalkableMainlinePoint(from,scene,{},options)).toBe(true)
   for(const id of [trial.order]) {
    expect(findMainlinePathToEntity(scene,id,from,{},options).path,id).not.toBeNull()
    expect(scene.explorationText?.[id]?.[0]).toBeTruthy()
   }
   expect(canActorReachPassageApproach(scene,front,from,{},options)?.path).not.toBeNull()
   expect(isWalkableMainlinePoint(point(...trial.worker),scene,{},options)).toBe(false)
  })
  it(`${trial.prefix}: gives the worker actual free space and a path to the locked warehouse threshold`,()=>{
   const workerOptions={...options,actorId:`${trial.prefix}-worker`,actorFootprint:{width:16/19.2,height:16/10.8}}
   const from=point(...trial.worker)
   expect(isWalkableMainlinePoint(from,scene,{},workerOptions)).toBe(true)
   const rear=scene.passages.find(p=>p.id===`${trial.room}-rear-door`)!
   expect(findMainlinePath(from,rear.thresholds[0],scene,{},workerOptions)).not.toBeNull()
  })
 }
 it('fits each complete counter/workbench label inside its body and keeps all aliases on that shared body',()=>{
  for(const body of scene.continuousStructures.filter(b=>b.id.startsWith('milk-tea-trial-')||b.id.startsWith('fruit-tea-trial-'))){
   const cells=scene.objects.filter(o=>o.interactionStructureId===body.id)
   expect(cells.length).toBeGreaterThan(0)
   const surface=body.counterSurface!
   const glyphCount=Array.from(surface.label??'柜台').length
   const labelWidth=surface.orientation==='vertical'?16:glyphCount*16
   const labelHeight=surface.orientation==='vertical'?glyphCount*16:16
   expect(body.width*19.2).toBeGreaterThanOrEqual(labelWidth)
   expect(body.height*10.8).toBeGreaterThanOrEqual(labelHeight)
   for(const alias of cells){
    expect(alias.counterSurfaceId).toBe(surface.groupId)
    expect(alias.position.x).toBeGreaterThanOrEqual(body.x)
    expect(alias.position.x).toBeLessThanOrEqual(body.x+body.width)
    expect(alias.position.y).toBeGreaterThanOrEqual(body.y)
    expect(alias.position.y).toBeLessThanOrEqual(body.y+body.height)
   }
  }
 })
})
