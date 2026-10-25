import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics as metrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineLabelFootprint, mainlineNpcLabelFootprint, mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { createNpcMovementAdapter } from '../src/center/runtime/useNpcMovement'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'
import { resolveMainlineNpcPosition, findMainlinePath, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { commercialCafeFloorServiceTarget } from '../src/center/runtime/commercialCafeBehavior'
import { resolveCommercialCafeFloorServiceIntent } from '../src/center/runtime/commercialCafeStory'
import { mainlineSceneOccupiedSeatIds } from '../src/center/runtime/mainlineSeating'
const scene=mainlineScenes['commercial-street'],id='cafe-floor-server',player={x:135.9583333333333,y:.9998074074}
function setup(){
 const runtime=createNavigationRuntime(),positions=new Map()
 for(const npc of scene.npcs){const point=resolveMainlineNpcPosition(scene,npc.id,{}, {screenMetrics:metrics});positions.set(npc.id,point);const body=mainlineNpcLabelFootprint(scene,npc.id,point,metrics);runtime.registerActor(npc.id,point,{width:body.width,height:body.height})}
 const f=mainlineProtagonistDotFootprint(player,metrics,scene.id);runtime.registerActor('protagonist',player,{width:f.width,height:f.height})
 const from=positions.get(id)!,options={screenMetrics:metrics,navigationRuntime:runtime,npcRuntimePositions:positions,occupiedSeatIds:mainlineSceneOccupiedSeatIds(scene),geometrySnapshot:createMainlineSceneGeometrySnapshot(scene,player,{},metrics),actorId:'protagonist',actorFootprint:{width:f.width,height:f.height}}
 const intent=resolveCommercialCafeFloorServiceIntent(scene)!,target=commercialCafeFloorServiceTarget(scene,from,intent,{},options)!
 return {runtime,from,options,intent,target}
}
describe('Cafe rendered-label body at contact and movement registration',()=>{
 it('moves the restored two-character employee label to its service contact without entering table/chair collision',()=>{
  const {runtime,from,options,intent,target}=setup(),body=mainlineNpcLabelFootprint(scene,id,from,metrics),controller=createFreeRoamController(from)
  expect(scene.npcs.find(npc=>npc.id===id)?.label).toBe('店员')
  expect(body.width*19.2).toBeCloseTo(32,2)
  const adapter=createNpcMovementAdapter({npcId:id,initialPosition:from,movement:controller,navigationRuntime:runtime,getFootprint:()=>({width:body.width,height:body.height})})
  let arrived=false
  expect(adapter.requestMove({...intent,target},scene,{},options,{maxSpeed:1},()=>{arrived=true})).toBe(true)
  const actual={...options,actorId:id,actorFootprint:{width:body.width,height:body.height}}
  for(let now=100;now<=30000&&controller.isMoving();now+=100){controller.tick(now);expect(isWalkableMainlinePoint(adapter.getPosition(),scene,{},actual)).toBe(true)}
  expect(arrived).toBe(true);expect(adapter.getPosition()).toEqual(target);expect(adapter.getSnapshot().phase).toBe('idle')
  expect(runtime.getActor(id)?.footprint).toEqual({width:body.width,height:body.height})
 })
 it('uses each Cafe NPC’s actual visible role label as its 32px movement body',()=>{
  const legacy={...scene,npcs:scene.npcs.map(npc=>npc.id===id?{...npc,label:'店员'}:npc)}
  expect(mainlineNpcLabelFootprint(legacy,id,player,metrics).width*19.2).toBeCloseTo(32,2)
  for(const npcId of ['lao-zhou','cafe-coffee-owner',id])expect(mainlineNpcLabelFootprint(scene,npcId,player,metrics).width*19.2).toBeCloseTo(32,2)
  expect(scene.npcs.find(npc=>npc.id==='lao-zhou')?.label).toBe('老周')
  expect(scene.npcs.find(npc=>npc.id==='cafe-coffee-owner')?.label).toBe('店员')
 })
})
