import {readFileSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import {mainlineScenes} from '../src/center/runtime/mainlineScenes'
import {createMainlineSceneGeometrySnapshot} from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import {mainlineProtagonistDotFootprint,mainlineLabelFootprint} from '../src/center/runtime/sceneLayout'
import {edgeContactPoint} from '../src/center/runtime/navigationCore'
import {navigationBarrierIntersectsActor,navigationBarrierBlocksTravel} from '../src/center/runtime/scenePathfinding'
import {mainlineEntityInteractionCandidates,resolveMainlineEntityInteraction,isMainlineInteractionPositionLegal,resolveMainlineInteractionCandidates,findMainlinePath,isWalkableMainlinePoint} from '../src/center/runtime/mainlineNavigation'
import {commercialCafeFloorServiceTarget,commercialCafeFloorServiceDwellMs} from '../src/center/runtime/commercialCafeBehavior'
import {resolveCommercialCafeFloorServiceIntent,commercialCafeStoryTableId} from '../src/center/runtime/commercialCafeStory'
import {isMainlineExternalExitTriggered} from '../src/center/runtime/mainlineExternalExit'
import {mainlineRideAtPickup} from '../src/center/runtime/mainlineRide'
describe('interaction stance, service edge and external exit semantics',()=>{
 it('rejects an actor body intersecting a relation even when its center path stays on one side',()=>{
  const barrier={id:'relation',start:{x:0,y:0},end:{x:0,y:3}},body={width:1,height:1},position={x:.2,y:2}
  expect(navigationBarrierBlocksTravel({x:1,y:2},position,barrier,body)).toBe(false)
  expect(navigationBarrierIntersectsActor(position,body,barrier)).toBe(true)
  expect(navigationBarrierIntersectsActor({x:.6,y:2},body,barrier)).toBe(false)
  expect(navigationBarrierIntersectsActor({x:0,y:3.4},body,barrier)).toBe(true)
  expect(navigationBarrierIntersectsActor({x:0,y:3.6},body,barrier)).toBe(false)
 })
 it.each([{width:1280,height:720},{width:1280,height:1080}])('keeps ordinary incense interaction off all relation lines %j',metrics=>{
  const scene=mainlineScenes['jijia-ancestral-interior'],from={x:55.2,y:35},dot=mainlineProtagonistDotFootprint(from,metrics),options={screenMetrics:metrics,actorFootprint:{width:dot.width,height:dot.height},actorId:'protagonist'}
  const candidates=mainlineEntityInteractionCandidates(scene,'jijia-incense-burner',from,{},options.actorFootprint,options)
  if(metrics.height===1080){
    expect(isWalkableMainlinePoint(candidates[0],scene,{},options)).toBe(true)
    expect(isMainlineInteractionPositionLegal(candidates[0],scene,{},options)).toBe(false)
    expect(resolveMainlineInteractionCandidates(scene,candidates[0],[candidates[0]],2,{},options).inRange).toBe(false)
  }
  for(const origin of [{x:55.2,y:35},{x:70,y:50.2},{x:55.2,y:65},{x:40,y:50.2},{x:40,y:35},{x:70,y:35},{x:40,y:65},{x:70,y:65}]){
    const result=resolveMainlineEntityInteraction(scene,'jijia-incense-burner',origin,{},options)
    expect(result.path).not.toBeNull()
    expect(isMainlineInteractionPositionLegal(result.target,scene,{},options)).toBe(true)
  }
 })
 it('derives every service destination at the real table edge on its authored side',()=>{
  const scene=mainlineScenes['commercial-cafe'],metrics={width:1280,height:720},snapshot=createMainlineSceneGeometrySnapshot(scene,scene.initialPlayerPosition,{},metrics),body=mainlineLabelFootprint('店员',scene.initialPlayerPosition,metrics,{lineHeight:1}),options={screenMetrics:metrics,geometrySnapshot:snapshot,actorId:'cafe-floor-server'}
  let from=scene.initialPlayerPosition
  const tables=scene.objects.filter(o=>o.kind==='table'&&o.id!==commercialCafeStoryTableId)
  for(let i=0;i<tables.length;i++){
    const table=tables[i],intent=resolveCommercialCafeFloorServiceIntent(scene,i)!,geometry=snapshot.objects.get(table.id)!,expected=edgeContactPoint(geometry.position,geometry.collision!,table.approach!,body),target=commercialCafeFloorServiceTarget(scene,from,intent,{},options)!
    expect(target).toEqual(expected)
    expect(target).not.toEqual(table.approach)
    expect(isMainlineInteractionPositionLegal(target,scene,{},options)).toBe(true)
    expect(findMainlinePath(from,target,scene,{},options)).not.toBeNull()
    from=target
  }
  expect(commercialCafeFloorServiceDwellMs(()=>0)).toBe(1000)
  expect(commercialCafeFloorServiceDwellMs(()=>.5)).toBeGreaterThanOrEqual(2000)
  expect(commercialCafeFloorServiceDwellMs(()=>1)).toBe(5000)
 })
 it.each(['commercial-street','yonghe-mining-perimeter','zhongshuyuan-office'] as const)('uses the exact original external trigger region for %s',id=>{
  const scene=mainlineScenes[id],order={sourceSceneId:id,targetSceneId:'commercial-street' as const,driverArrivesAt:0}
  for(const exit of scene.externalExits){
    const tangent=exit.triggerSpan?exit.triggerSpan.start+.5:42,inside=exit.axis==='x'?{x:exit.threshold+exit.direction*2,y:tangent}:{x:tangent,y:exit.threshold+exit.direction*2},outside=exit.axis==='x'?{...inside,x:exit.threshold-exit.direction}:{...inside,y:exit.threshold-exit.direction}
    expect(isMainlineExternalExitTriggered(inside,exit,scene)).toBe(true)
    expect(mainlineRideAtPickup(order,id,inside)).toBe(true)
    expect(mainlineRideAtPickup(order,id,outside)).toBe(false)
    if(exit.triggerSpan){const offSpan=exit.axis==='x'?{...inside,y:exit.triggerSpan.end+1}:{...inside,x:exit.triggerSpan.end+1};expect(mainlineRideAtPickup(order,id,offSpan)).toBe(false)}
  }
 })
 it('boards the actual Street exit away from the former 18px circle',()=>{
  expect(mainlineRideAtPickup({sourceSceneId:'commercial-street',targetSceneId:'zhongshuyuan-office',driverArrivesAt:0},'commercial-street',{x:10,y:46})).toBe(true)
 })
 it('rechecks the latest exit position on driver arrival and on reading completion without another movement',()=>{
  const source=readFileSync(new URL('../src/center/CenterExperience.jsx',import.meta.url),'utf8')
  const reading=source.slice(source.indexOf('const handleSceneReadingStateChange'),source.indexOf('const handleSceneReadingStateChange')+500)
  expect(reading).toContain('sceneReadingActiveRef.current = reading')
  expect(reading).toContain('if (!reading)')
  expect(reading).toContain('const current = latestWorldPositionRef.current')
  expect(reading).toContain('rideBoardingRef.current(current.sceneId, current.position, current.context)')
  const timer=source.slice(source.indexOf('const arrived = () =>'),source.indexOf('const arrived = () =>')+650)
  expect(timer).toContain('const current = latestWorldPositionRef.current')
  expect(timer).toContain('rideBoardingRef.current(current.sceneId, current.position, current.context)')
  expect(source).toContain('!sceneReadingActiveRef.current && rideOrder && Date.now() >= rideOrder.driverArrivesAt && mainlineRideAtPickup(rideOrder, sceneId, position)')
 })

})