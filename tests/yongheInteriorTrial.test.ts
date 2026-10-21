import { describe, it, expect } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { findMainlinePathToEntity, canActorReachPassageApproach, isWalkableMainlinePoint, canTravelAlongMainlineSegment, findMainlinePath } from '../src/center/runtime/mainlineNavigation'

for(const sceneId of ['yonghe-mining-perimeter','yonghe-eatery'] as const){
 const scene=mainlineScenes[sceneId],room=scene.rooms.find(r=>r.id==='mining-shop-2-interior')!,point=(x:number,y:number)=>({x:room.bounds.x+x/19.2,y:room.bounds.y+y/10.8}),options={screenMetrics:sceneDesignReferenceMetrics}
 describe(`${sceneId} trial restaurant`,()=>{
  it('maps entry-relative directions to a real upper-wall menu, four tables and a left kitchen',()=>{
   expect(scene.objects.find(o=>o.id==='yonghe-menu')?.position).toEqual(point(616,0))
   expect(scene.objects.filter(o=>o.roomId===room.id&&o.kind==='table')).toHaveLength(4)
   expect(scene.objects.filter(o=>o.roomId===room.id&&o.seat)).toHaveLength(8)
   expect(scene.objects.find(o=>o.id==='yonghe-stove')?.position).toEqual(point(84,224))
   expect(scene.passages.find(p=>p.id==='yonghe-back-door')?.access).toBe('locked')
   const rear=scene.objects.find(o=>o.id==='yonghe-back-door')!
   expect(rear.position.y).toBeCloseTo(point(0,252).y,5)
   // The previous centre has no door geometry or passage navigation identity.
   const old=point(0,168)
   const atOld=scene.geometry.filter(u=>u.x<=old.x&&u.x+u.width>=old.x&&u.y<=old.y&&u.y+u.height>=old.y)
   expect(atOld.some(u=>u.navigation.passageId==='yonghe-back-door')).toBe(false)
   expect(atOld.flatMap(u=>u.visual.cells).some(cell=>cell.glyph==='墙'&&Math.abs(cell.x-old.x)<.001&&Math.abs(cell.y-old.y)<.001)).toBe(true)
   expect(isWalkableMainlinePoint(old,scene,{},options)).toBe(false)
  })
  it('reaches each seat and menu from the customer aisle, while table-chair six-pixel gaps remain blocked',()=>{
   const from=point(364,154)
   for(const entity of scene.objects.filter(o=>o.seat&&o.id.startsWith('yonghe-'))){
    expect(findMainlinePathToEntity(scene,entity.id,from,{},options).path,entity.id).not.toBeNull()
    const table=scene.objects.find(o=>o.id===entity.seat!.tableId)!,middle={x:table.position.x,y:(entity.position.y+table.position.y)/2}
    expect(Math.abs(entity.position.y-table.position.y)*10.8-16).toBeCloseTo(6,4)
    for(const width of [11,16])expect(canTravelAlongMainlineSegment({...middle,x:middle.x-2},{...middle,x:middle.x+2},scene,{}, {...options,actorFootprint:{width:width/19.2,height:width/10.8}})).toBe(false)
   }
   expect(findMainlinePathToEntity(scene,'yonghe-menu',from,{},options).path).not.toBeNull()
   expect(canActorReachPassageApproach(scene,scene.passages.find(p=>p.id==='yonghe-street-entry')!,from,{},options)?.path).not.toBeNull()
  })
  it('keeps outdoor groups wholly beside this frontage and leaves the true door normal clear',()=>{
   for(const group of scene.furnitureGroups.filter(g=>g.id.startsWith('yonghe-outdoor-'))){
    for(const id of group.entityIds){const object=scene.objects.find(o=>o.id===id)!
     expect(object.position.y-8/10.8).toBeGreaterThan(room.bounds.y)
     expect(object.position.y+8/10.8).toBeLessThan(room.bounds.y+room.bounds.height)
     expect((object.position.x-room.bounds.x)*19.2).toBeLessThan(700+84-16)
    }
   }
   expect(isWalkableMainlinePoint(point(742,168),scene,{},options)).toBe(true)
   expect(isWalkableMainlinePoint(point(784,168),scene,{},options)).toBe(true)
  })
  it('allows only staff behind the actual counter, closes the upper end and leaves the lower opening usable',()=>{
   const staff={...options,actorId:'yonghe-trial-worker',actorFootprint:{width:16/19.2,height:16/10.8}},from=point(168,154)
   expect(isWalkableMainlinePoint(from,scene,{},options)).toBe(false)
   expect(isWalkableMainlinePoint(from,scene,{},staff)).toBe(true)
   expect(findMainlinePath(from,point(280,154),scene,{},staff)).not.toBeNull()
   expect(findMainlinePath(from,scene.passages.find(p=>p.id==='yonghe-back-door')!.thresholds[0],scene,{},staff)).not.toBeNull()
   // Physical tests bypass the role restriction, so permissions cannot hide an upper gap.
   for(const width of [11,16]) expect(canTravelAlongMainlineSegment(point(196,14),point(252,14),scene,{}, {...staff,actorFootprint:{width:width/19.2,height:width/10.8}})).toBe(false)
  })
 })
}
