import { describe,expect,it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics as metrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineNpcLabelFootprint,mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { isWalkableMainlinePoint,resolveMainlineNpcPosition,resolveMainlineServiceContact } from '../src/center/runtime/mainlineNavigation'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { createNpcMovementAdapter } from '../src/center/runtime/useNpcMovement'
import { createFreeRoamController,sharedCharacterMovementOptions } from '../src/center/runtime/useFreeRoamMovement'
import { mainlineSceneOccupiedSeatIds } from '../src/center/runtime/mainlineSeating'
import type { Point } from '../src/center/runtime/sceneGeometry'
const scene=mainlineScenes['commercial-street']
const trials=[
 {prefix:'milk-tea-trial',room:'commercial-south-s5-interior',equipment:[[1,'left'],[2,'left'],[3,'left'],[4,'left']],handoff:[248,432],customer:[112,336]},
 {prefix:'fruit-tea-trial',room:'commercial-north-n1-interior',equipment:[[4,'right'],[1,'right'],[2,'right'],[3,'right'],[5,'right']],handoff:[88,336],customer:[168,560]},
] as const
describe('real16px worker adapter through operation-side contacts, without a commerce AI',()=>{
 for(const trial of trials)it(trial.prefix,()=>{
  const room=scene.rooms.find(r=>r.id===trial.room)!,point=(x:number,y:number):Point=>({x:room.bounds.x+x/19.2,y:room.bounds.y+y/10.8}),id=`${trial.prefix}-worker`,runtime=createNavigationRuntime()
  for(const npc of scene.npcs){const p=resolveMainlineNpcPosition(scene,npc.id,{}, {screenMetrics:metrics}),box=mainlineNpcLabelFootprint(scene,npc.id,p,metrics);runtime.registerActor(npc.id,p,{width:box.width,height:box.height})}
  const customer=point(...trial.customer),dot=mainlineProtagonistDotFootprint(customer,metrics,scene.id);runtime.registerActor('protagonist',customer,{width:dot.width,height:dot.height})
  const initial=resolveMainlineNpcPosition(scene,id,{}, {screenMetrics:metrics}),box=mainlineNpcLabelFootprint(scene,id,initial,metrics),body={width:box.width,height:box.height},controller=createFreeRoamController(initial),adapter=createNpcMovementAdapter({npcId:id,initialPosition:initial,movement:controller,navigationRuntime:runtime,getFootprint:()=>body}),options={screenMetrics:metrics,navigationRuntime:runtime,actorId:id,actorFootprint:body,occupiedSeatIds:mainlineSceneOccupiedSeatIds(scene)}
  let now=0,completed=0
  const move=(target:Point)=>{
   let arrived=false
   expect(adapter.requestMove({dutyId:'layout-operation-evidence',target},scene,{},options,sharedCharacterMovementOptions(metrics),()=>{arrived=true})).toBe(true)
   for(let n=0;n<5000&&controller.isMoving();n++){now+=16;controller.tick(now);expect(isWalkableMainlinePoint(adapter.getPosition(),scene,{},options)).toBe(true)}
   expect(arrived).toBe(true);expect(adapter.getPosition()).toEqual(target);completed++
  }
  for(const [index,side] of trial.equipment){const entity=scene.objects.find(o=>o.id===`${trial.prefix}-equipment-${index}`)!,p=entity.position,approach={x:p.x+(side==='left'?-3:side==='right'?3:0),y:p.y+(side==='bottom'?3:0)},contact=resolveMainlineServiceContact(scene,entity.id,approach,adapter.getPosition(),{},options);expect(contact.path,`${entity.id} from ${adapter.getPosition().x},${adapter.getPosition().y} -> ${JSON.stringify(contact)}`).not.toBeNull();move(contact.target)}
  move(point(...trial.handoff));move(scene.passages.find(p=>p.id===`${trial.room}-rear-door`)!.thresholds[0]);move(initial)
  expect(completed).toBe(trial.equipment.length+3)
 },60_000)
})
