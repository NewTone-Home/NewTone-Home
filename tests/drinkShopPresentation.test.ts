import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityCollision } from '../src/center/runtime/sceneLayout'
import { findMainlinePathToEntity, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
const scene=mainlineScenes['commercial-street'],options={screenMetrics:sceneDesignReferenceMetrics,actorId:'protagonist'}
const shops=[['commercial-north-cafe-interior','cafe-trial-counter-',0,224,['commercial-cafe-menu','commercial-cafe-blackboard']],['commercial-south-s5-interior','milk-tea-trial-',336,176,['commercial-s5-milk-tea-menu-service-label']],['commercial-north-n1-interior','fruit-tea-trial-',0,160,['fruit-tea-trial-menu']]] as const

describe('shop vertical machines, shared counter frames and same-side wall menus',()=>{
 for(const [roomId,prefix,wallX,contactX,menus] of shops){
  const room=scene.rooms.find(r=>r.id===roomId)!,front=scene.passages.find(p=>p.toRoomId===roomId&&p.routeThrough)!
  it(`${roomId}: gives every counter character one shared frame per real run without repeating orders`,()=>{
   const bodies=scene.continuousStructures.filter(b=>b.id.startsWith(prefix)),cells=scene.objects.filter(o=>bodies.some(b=>b.id===o.interactionStructureId))
   expect(cells.length).toBeGreaterThan(30)
   for(const cell of cells){expect(cell.interactive).toBe(true);expect(cell.focusFrame).toBe('interactive');expect(cell.focusFrameGroup).toBe(cell.interactionStructureId);expect(isWalkableMainlinePoint(cell.position,scene,{},options)).toBe(false)}
   expect(new Set(cells.map(c=>c.focusFrameGroup)).size).toBe(bodies.length)
   expect(cells.filter(c=>c.interactionBehavior==='cafe-order').map(c=>c.id)).toEqual(roomId.includes('cafe')?['commercial-cafe-counter']:[])
  })
  it(`${roomId}: embeds menus on the employee wall but reads from a legal public contact`,()=>{
   for(const id of menus){const e=scene.objects.find(o=>o.id===id)!;expect(e.surface).toBe('wall');expect((e.position.x-room.bounds.x)*19.2).toBeCloseTo(wallX,5);expect((e.interactionContactAnchor!.x-room.bounds.x)*19.2).toBeCloseTo(contactX,5);expect(isWalkableMainlinePoint(e.interactionContactAnchor!,scene,{},options)).toBe(true);expect(findMainlinePathToEntity(scene,id,front.crossingTargets[0],{},options).path).not.toBeNull();expect(isWalkableMainlinePoint(e.position,scene,{},options)).toBe(false)}
  })
 }
 it('uses vertical16px actual character footprints and existing interactive frames for every machine',()=>{
  const devices=scene.objects.filter(o=>o.id.includes('-trial-equipment-')||['cafe-trial-coffee-machine','cafe-trial-prep-table','cafe-trial-wash','cafe-trial-cold'].includes(o.id))
  expect(devices).toHaveLength(13)
  for(const e of devices){expect(e.textLayout).toBe('vertical');expect(e.focusFrame).toBe('interactive');expect(e.interactive).toBe(true);const body=mainlineEntityCollision(scene,e,{},sceneDesignReferenceMetrics)!;expect(body.width*19.2).toBeCloseTo(16,2);expect(body.height*10.8).toBeCloseTo(Array.from(e.label).length*16,2);expect(e.collision!.width*19.2).toBeCloseTo(16,5);expect(e.collision!.height*10.8).toBeCloseTo(Array.from(e.label).length*16,5)}
 })
})
