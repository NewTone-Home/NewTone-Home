import {describe,it,expect} from 'vitest'
import {createPolygonNavigationMesh} from '../src/center/runtime/scenePathfinding'

describe('route-only mesh topology deferral',()=>{
 const cases=[
  {bounds:{x:0,y:0,width:100,height:100},obstacles:[{x:40,y:0,width:10,height:70}]},
  {bounds:{x:0,y:0,width:100,height:100},obstacles:[{x:40,y:0,width:10,height:100}]},
  {bounds:{x:0,y:0,width:100,height:100},obstacles:[{x:40,y:20,width:10,height:60}],actorFootprint:{width:2,height:3},obstacleInset:{x:1,y:1.5},barriers:[{id:'relation',start:{x:55,y:30},end:{x:70,y:30}}]},
 ]
 it.each(cases)('keeps route, nearest point and reachable projection identical: %o',options=>{
  const eager=createPolygonNavigationMesh(options),deferred=createPolygonNavigationMesh({...options,deferTopology:true})
  for(const target of [{x:90,y:50},{x:45,y:50},{x:90,y:95},{x:40,y:20}]){
   const start={x:10,y:50}
   expect(deferred.findPath(start,target)).toEqual(eager.findPath(start,target))
   expect(deferred.nearestPoint(target)).toEqual(eager.nearestPoint(target))
   expect(deferred.resolvePath(start,target)).toEqual(eager.resolvePath(start,target))
   expect(deferred.findPath(start,target)).toEqual(eager.findPath(start,target))
  }
 })
})
