import { describe, expect, it, vi } from 'vitest'
import * as pathfinding from '../src/center/runtime/scenePathfinding'
import { findMainlinePath, canTravelAlongMainlineSegment } from '../src/center/runtime/mainlineNavigation'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

// Original open-interior slab rule: independent oracle for the optimized query.
function crosses(a: {x:number;y:number}, b: {x:number;y:number}, box: {x:number;y:number;width:number;height:number}) {
  let entry=0, exit=1
  for (const [s,e,min,max] of [[a.x,b.x,box.x,box.x+box.width],[a.y,b.y,box.y,box.y+box.height]]) {
    const d=e!-s!
    if (Math.abs(d)<=.0001) { if (s!<=min!+.0001 || s!>=max!-.0001) return false; continue }
    const p=(min!-s!)/d,q=(max!-s!)/d
    entry=Math.max(entry,Math.min(p,q));exit=Math.min(exit,Math.max(p,q))
    if(entry>=exit-.0001)return false
  }
  return entry<1-.0001&&exit>.0001&&entry<exit-.0001
}
describe('navigation query reuse and obstacle broad phase',()=>{
  it('preserves the slab result for seeded segments, tangency and axis-aligned travel',()=>{
    const obstacles=Array.from({length:24},(_,i)=>({x:8+(i%6)*14,y:10+Math.floor(i/6)*21,width:4,height:7}))
    const mesh=pathfinding.createPolygonNavigationMesh({bounds:{x:0,y:0,width:100,height:100},obstacles})
    let seed=42; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*100}
    const cases=Array.from({length:180},()=>[{x:random(),y:random()},{x:random(),y:random()}])
    cases.push([{x:0,y:10},{x:100,y:10}],[{x:8,y:0},{x:8,y:100}],[{x:0,y:13},{x:100,y:13}])
    for(const [a,b] of cases){
      if(obstacles.some(box=>[a!,b!].some(p=>p.x>=box.x&&p.x<=box.x+box.width&&p.y>=box.y&&p.y<=box.y+box.height)))continue
      const direct=!obstacles.some(box=>crosses(a!,b!,box))
      const route=mesh.findPath(a!,b!)
      expect(route?.length===2).toBe(direct)
      if(route)for(let i=1;i<route.length;i++)expect(obstacles.some(box=>crosses(route[i-1]!,route[i]!,box))).toBe(false)
    }
  })
  it('reuses physical geometry for player and NPC and checks moved blockers on every query',()=>{
    const source=mainlineScenes['commercial-street']
    const scene={...source} // isolated cache owner
    const runtime=createNavigationRuntime()
    const options={screenMetrics:sceneDesignReferenceMetrics,actorFootprint:{width:.6,height:.6},navigationRuntime:runtime,actorId:'protagonist'}
    const from={x:140.234,y:-24.01},to={x:122.831,y:38}
    const passage=scene.passages.find(p=>p.id==='street-cafe-entry')!
    const open={...options,openPassageIds:new Set([passage.id])}
    const spy=vi.spyOn(pathfinding,'createPolygonNavigationMesh')
    try{
      runtime.registerActor('blocker',{x:100,y:50},{width:1,height:1})
      const first=findMainlinePath(from,to,scene,{},open);expect(first).not.toBeNull()
      const count=spy.mock.calls.length;expect(count).toBeGreaterThan(0)
      expect(findMainlinePath(from,to,scene,{}, {...open,actorId:'another-npc'})).not.toBeNull()
      expect(spy.mock.calls.length).toBe(count)
      const middle=first![Math.floor(first!.length/2)]!
      runtime.updateActor('blocker',middle)
      const next=findMainlinePath(from,to,scene,{},open)
      if(next) for(let i=1;i<next.length;i++)expect(canTravelAlongMainlineSegment(next[i-1]!,next[i]!,scene,{},open)).toBe(true)
      runtime.removeActor('blocker')
      expect(findMainlinePath(from,to,scene,{},open)).toEqual(first)
      findMainlinePath(from,to,scene,{}, {...open,actorFootprint:{width:.8,height:.8}})
      expect(spy.mock.calls.length).toBeGreaterThan(count)
      const beforeClose=spy.mock.calls.length
      findMainlinePath(from,to,scene,{},options)
      expect(spy.mock.calls.length).toBeGreaterThan(beforeClose)
    }finally{spy.mockRestore()}
  })
})
