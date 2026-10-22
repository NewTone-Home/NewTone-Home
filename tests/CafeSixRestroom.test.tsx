import { describe,expect,it } from 'vitest'
import { cafeStoryTableId } from '../src/center/runtime/continuousCafe'
import { mainlineScenes,validateMainlineSceneGeometry } from '../src/center/runtime/mainlineScenes'
import { mainlineNpcLabelFootprint } from '../src/center/runtime/sceneLayout'
import { findMainlinePath,findMainlinePathToEntity,isWalkableMainlinePoint,canTravelAlongMainlineSegment,resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { storefrontRoomConnection } from '../src/center/runtime/storefrontRoomConnection'
import { activeStorefrontPresentationOwner,activeStorefrontInteriorOwner } from '../src/center/runtime/storefrontPresentation'
import { createInitialPlayerSave,sanitizePlayerSave } from '../src/center/runtime/playerSave'
const scene=mainlineScenes['commercial-street'],room=scene.rooms.find(r=>r.id==='commercial-north-cafe-interior')!,point=(x:number,y:number)=>({x:room.bounds.x+x/19.2,y:room.bounds.y+y/10.8}),options={screenMetrics:sceneDesignReferenceMetrics,actorId:'protagonist',actorFootprint:{width:11/19.2,height:11/10.8}}

describe('wall wrap, six Cafe tables and the real single restroom',()=>{
 it('extends only the stroke across one wall cell and retains real body endpoints',()=>{
  for(const [id,side,physical,visual] of [['cafe-trial-counter-front-body','x',8,-14],['cafe-trial-counter-upper-body','y',8,-14],['milk-tea-trial-front-return-body','right',328,350],['milk-tea-trial-long-counter-body','bottom',692,714],['fruit-tea-trial-front-return-body','x',8,-14],['fruit-tea-trial-long-counter-body','y',8,-14]] as const){const body=scene.continuousStructures.find(b=>b.id===id)!,r=scene.rooms.find(r=>r.id===body.counterSurface!.roomId)!,outline=body.counterSurface!.outlineBounds!;const coordinate=(b:typeof outline)=>side==='right'?(b.x+b.width-r.bounds.x)*19.2:side==='bottom'?(b.y+b.height-r.bounds.y)*10.8:side==='x'?(b.x-r.bounds.x)*19.2:(b.y-r.bounds.y)*10.8;expect(coordinate(body)).toBeCloseTo(physical,5);expect(coordinate(outline)).toBeCloseTo(visual,5)}
 })
 it('has six original-size tables/twelve seats, with14px gaps that neither actor may cross',()=>{
  const tables=scene.objects.filter(o=>o.roomId===room.id&&o.kind==='table'),seats=scene.objects.filter(o=>o.roomId===room.id&&o.kind==='seat');expect(tables).toHaveLength(6);expect(seats).toHaveLength(12)
  for(const seat of seats){const table=tables.find(t=>t.id===seat.seat!.tableId)!;expect(Math.abs(seat.position.y-table.position.y)*10.8-16).toBeCloseTo(14,5);expect(seat.shape!.width*19.2).toBeCloseTo(32,5);const gapY=(seat.position.y+table.position.y)/2;for(const width of [11,16])expect(canTravelAlongMainlineSegment({x:table.position.x-40/19.2,y:gapY},{x:table.position.x+40/19.2,y:gapY},scene,{}, {...options,actorFootprint:{width:width/19.2,height:width/10.8}})).toBe(false);expect(findMainlinePathToEntity(scene,seat.id,point(336,560),{},options).path).not.toBeNull()}
  const story=tables.find(t=>t.id===cafeStoryTableId)!;expect((story.position.x-room.bounds.x)*19.2).toBeCloseTo(448,5);expect((story.position.y-room.bounds.y)*10.8).toBeCloseTo(448,5)
 })
 it('keeps two small corner plants outside doors and chair pullouts',()=>{
  const plants=scene.objects.filter(o=>o.id.startsWith('cafe-trial-corner-plant-'));expect(plants).toHaveLength(2);for(const p of plants){expect(p.interactionBehavior).toBeUndefined();expect(p.collision!.width*19.2).toBeCloseTo(32,5);expect(p.collision!.height*10.8).toBeCloseTo(16,5)}
 })
 it('connects Cafe and a168px square room through one open same-world door',()=>{
  const restroom=scene.rooms.find(r=>r.id==='cafe-single-restroom-interior')!,door=scene.passages.find(p=>p.id==='cafe-trial-customer-toilet-door')!;expect(restroom.bounds.width*19.2).toBeCloseTo(168,5);expect(restroom.bounds.height*10.8).toBeCloseTo(168,5);expect(door).toMatchObject({access:'open',routeThrough:true,fromRoomId:room.id,toRoomId:restroom.id});expect(door.targetSceneId).toBeUndefined();expect(validateMainlineSceneGeometry(scene)).toEqual([]);expect(scene.objects.filter(o=>o.roomId===restroom.id).map(o=>o.label)).toEqual(['便器','洗手盆']);expect(scene.passages.find(p=>p.id===room.id+'-rear-door')!.access).toBe('locked')
 })
 it('uses a nested approach room for the sign and keeps interior ownership',()=>{
  const sign=scene.storefronts.find(s=>s.id==='cafe-restroom-sign')!,connection=storefrontRoomConnection(scene,sign)!;expect(connection.publicRoom.id).toBe(room.id);expect(activeStorefrontPresentationOwner(scene,point(560,42))).toBe(sign.id);expect(activeStorefrontPresentationOwner(scene,point(336,350))).toBeNull();expect(activeStorefrontInteriorOwner(scene,point(560,-84))).toBe(sign.id)
 })
 it('allows repeated enter/return paths and saves the real interior position without a new scene ID',()=>{
  const inside=point(560,-84),outside=point(560,84);for(const [from,to] of [[outside,inside],[inside,outside],[outside,inside]]){const opened={...options,openPassageIds:new Set(['cafe-trial-customer-toilet-door'])};const path=findMainlinePath(from,to,scene,{},opened);expect(path).not.toBeNull();for(let i=1;i<path!.length;i++)expect(canTravelAlongMainlineSegment(path![i-1],path![i],scene,{},opened)).toBe(true)}
  const source={...createInitialPlayerSave('commercial-street'),currentPosition:inside,scenePositions:{'commercial-street':inside}},save=sanitizePlayerSave(source,'commercial-street');expect(save.currentSceneId).toBe('commercial-street');expect(save.currentPosition).toEqual(inside);expect(sanitizePlayerSave(save,'commercial-street').currentPosition).toEqual(inside);expect(isWalkableMainlinePoint(inside,scene,{},options)).toBe(true)
 })
})
