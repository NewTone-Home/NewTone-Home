import {it,expect} from 'vitest'
import {mainlineRideWalkingEtaMs,mainlineRideOrderFromState,mainlineRideOrderPatch} from '../src/center/runtime/mainlineRide'
import {mainlineScenes} from '../src/center/runtime/mainlineScenes'
import {mainlineInteractionTarget} from '../src/center/runtime/mainlineNavigation'
it('estimates a seated Café departure from the same legal stand-up contact without moving the player',()=>{
 const scene=mainlineScenes['commercial-cafe']
 const seats=scene.objects.filter(o=>o.kind==='seat')
 expect(seats.length).toBeGreaterThan(0)
 for(const seat of seats){const screenMetrics={width:390,height:844},position={...seat.position}
  const walkingStart=mainlineInteractionTarget(scene,seat.id,position,{},undefined,{screenMetrics,actorId:'protagonist'})
  expect(mainlineRideWalkingEtaMs(scene.id,position,{layout:{},screenMetrics,walkingStart})).toBeGreaterThan(0)
  expect(position).toEqual(seat.position)
 }
})
it('persists order-specific vehicle and arrival estimate, clears them, and accepts old orders',()=>{
 const order={sourceSceneId:'commercial-street' as const,targetSceneId:'zhongshuyuan-office' as const,driverArrivesAt:9000,requestedAt:1000,vehicle:'舒适型' as const,arrivalLabel:'12:12'}
 expect(mainlineRideOrderFromState({'commercial-street':JSON.parse(JSON.stringify(mainlineRideOrderPatch(order)))})).toEqual(order)
 expect(mainlineRideOrderFromState({'commercial-street':mainlineRideOrderPatch(null)})).toBeNull()
 expect(mainlineRideOrderFromState({'commercial-street':{rideDestination:'zhongshuyuan-office',rideDriverArrivesAt:9000}})).toEqual({sourceSceneId:'commercial-street',targetSceneId:'zhongshuyuan-office',driverArrivesAt:9000})
})
