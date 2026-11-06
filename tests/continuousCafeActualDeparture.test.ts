import {describe,it,expect} from 'vitest'
import {mainlineScenes} from '../src/center/runtime/mainlineScenes'
import {mainlineNpcVisualSeatId,mainlineSceneOccupiedSeatIds,mainlineSeatedActorVisualPosition} from '../src/center/runtime/mainlineSeating'
import {mainlineNpcStagedSeatId} from '../src/center/runtime/mainlineNpcStaging'
import {canActorReachPassageApproach,canTravelAlongMainlineSegment,isWalkableMainlinePoint,findMainlinePath} from '../src/center/runtime/mainlineNavigation'
import {sceneDesignReferenceMetrics} from '../src/center/runtime/sceneBoundaryGrid'
import {mainlineProtagonistDotFootprint} from '../src/center/runtime/sceneLayout'
const scene=mainlineScenes['commercial-street'],door=scene.passages.find(p=>p.id==='street-cafe-entry')!,options={screenMetrics:sceneDesignReferenceMetrics}
describe('continuous Cafe resident and real window boundary',()=>{
 it('keeps Lao Zhou as an independent resident NPC with the chair only as pose and occupancy anchor',()=>{
  const id=mainlineNpcStagedSeatId(scene,'lao-zhou')!,seat=scene.objects.find(o=>o.id===id)!.position,runtime={x:seat.x-5,y:seat.y+3}
  expect(mainlineNpcVisualSeatId(scene,'lao-zhou',{phase:'idle',dutyId:'lao-zhou.seated'})).toBe(id)
  expect(scene.npcs.find(npc=>npc.id==='lao-zhou')).toMatchObject({ id:'lao-zhou', roleId:'lao-zhou', interactionTargetEntityId:'commercial-cafe-right-window-upper-group-table' })
  expect(scene.npcBehaviors.find(behavior=>behavior.npcId==='lao-zhou')).toMatchObject({ dutyId:'lao-zhou.seated', targetKind:'seat', targetId:id })
  expect(mainlineSeatedActorVisualPosition(runtime,id,seat)).toEqual(seat)
  expect(mainlineSceneOccupiedSeatIds(scene).has(id)).toBe(true)
  expect(mainlineSceneOccupiedSeatIds(scene,null,new Set()).has(id)).toBe(true)
  expect(mainlineSceneOccupiedSeatIds(scene,null,new Set(['lao-zhou'])).has(id)).toBe(false)
 })
 it('keeps the actual window wall solid in open and closed door phases',()=>{
  for(const open of [false,true])for(const x of [142.993,141.107,139.211,137.327,135.434,133.548,131.662,129.768,127.88]){
   expect(isWalkableMainlinePoint({x,y:33.5},scene,{}, {...options,openPassageIds:open?new Set([door.id]):new Set()}),`x=${x}, open=${open}`).toBe(false)
  }
 })
 it('routes the customer from the far window side to the true door while staying wholly inside the front boundary',()=>{
  const from={x:148,y:27},route=canActorReachPassageApproach(scene,door,from,{},options)!
  expect(route).not.toBeNull()
  const dot=mainlineProtagonistDotFootprint(from,sceneDesignReferenceMetrics,scene.id)
  for(let i=0;i<route.path.length;i++){expect(route.path[i].y+dot.height/2).toBeLessThanOrEqual(door.doorway.y+.03);if(i)expect(canTravelAlongMainlineSegment(route.path[i-1],route.path[i],scene,{},options)).toBe(true)}
  expect(findMainlinePath(route.target,door.crossingTargets[1],scene,{}, {...options,openPassageIds:new Set([door.id])})).not.toBeNull()
 })
})
