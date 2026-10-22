import { describe, it, expect } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { findMainlinePathToEntity, isWalkableMainlinePoint, canTravelAlongMainlineSegment, canActorReachPassageApproach } from '../src/center/runtime/mainlineNavigation'
import { mainlineEntityCollision, mainlineNpcLabelFootprint, mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'

const scene = mainlineScenes['commercial-street']
const room = scene.rooms.find(room => room.id === 'commercial-north-cafe-interior')!
const point = (x: number, y: number) => ({ x: room.bounds.x + x / 1920 * 100, y: room.bounds.y + y / 1080 * 100 })
const options = { screenMetrics: sceneDesignReferenceMetrics }

describe('isolated Cafe layout trial', () => {
  it('has six real two-character tables and twelve seats, retaining both story seat identities', () => {
    const entities = scene.objects.filter(entity => entity.roomId === room.id)
    expect(entities.filter(entity => entity.kind === 'table')).toHaveLength(6)
    expect(entities.filter(entity => entity.kind === 'seat')).toHaveLength(12)
    expect(entities.some(entity => entity.id === 'commercial-cafe-right-window-upper-group-chair-bottom')).toBe(true)
    for (const table of entities.filter(entity => entity.kind === 'table')) {
      const collision = mainlineEntityCollision(scene, table, {}, sceneDesignReferenceMetrics)!
      // The shared text footprint rounds world percentages to four decimals.
      expect(collision.width * 19.2).toBeCloseTo(32, 2)
      expect(collision.height * 10.8).toBeCloseTo(16, 2)
    }
  })
  it('keeps a positive fourteen-pixel table-chair gap out of routes for protagonists and NPCs', () => {
    const protagonistFootprint = mainlineProtagonistDotFootprint(scene.initialPlayerPosition, sceneDesignReferenceMetrics, scene.id)
    const npc = scene.npcs.find(candidate => candidate.id === 'cafe-floor-server')!
    for (const seat of scene.objects.filter(entity => entity.roomId === room.id && entity.seat)) {
      const table = scene.objects.find(entity => entity.id === seat.seat!.tableId)!
      const gap = Math.abs(seat.position.y - table.position.y) * 10.8 - 16
      expect(gap).toBeCloseTo(14, 5)
      const middle = { x: table.position.x, y: (seat.position.y + table.position.y) / 2 }
      const protagonistOptions = { ...options, actorId: 'protagonist', actorFootprint: protagonistFootprint }
      const npcFootprint = mainlineNpcLabelFootprint(scene, npc.id, middle, sceneDesignReferenceMetrics)
      const npcOptions = { ...options, actorId: npc.id }
      expect(isWalkableMainlinePoint(middle, scene, {}, protagonistOptions)).toBe(true)
      // The 11px protagonist marker can stand in the slit, but the relation
      // barrier still prevents using it as a passage. NPC sizing comes from
      // the actual rendered label and production navigation path.
      expect(isWalkableMainlinePoint(middle, scene, {}, npcOptions)).toBe(false)
      expect(npcFootprint.width).toBeGreaterThan(0)
      expect(npcFootprint.height).toBeGreaterThan(0)
      expect(canTravelAlongMainlineSegment({...middle,x:middle.x-2}, {...middle,x:middle.x+2}, scene, {}, protagonistOptions)).toBe(false)
      expect(canTravelAlongMainlineSegment({...middle,x:middle.x-2}, {...middle,x:middle.x+2}, scene, {}, npcOptions)).toBe(false)
    }
  })
  it('reaches all seats from their open outer side and leaves the middle clear', () => {
    const from = point(336,350)
    const actorFootprint = mainlineProtagonistDotFootprint(from,sceneDesignReferenceMetrics,scene.id)
    for (const seat of scene.objects.filter(entity => entity.roomId === room.id && entity.seat)) {
      expect(findMainlinePathToEntity(scene,seat.id,from,{}, {...options,actorFootprint}).path,seat.id).not.toBeNull()
    }
    for (const x of [252,280,336]) for (const y of [196,280,448,588]) expect(isWalkableMainlinePoint(point(x,y),scene,{}, {...options,actorFootprint})).toBe(true)
    const door=scene.passages.find(passage=>passage.id==='street-cafe-entry')!
    expect(canActorReachPassageApproach(scene,door,from,{}, {...options,actorFootprint})?.path).not.toBeNull()
  })
  it('keeps the real warehouse door locked and adds a separate open customer-side toilet without old decorative doors', () => {
    expect(scene.passages.find(passage=>passage.id==='commercial-north-cafe-interior-rear-door')!.access).toBe('locked')
    expect(scene.passages.find(passage=>passage.id==='cafe-trial-customer-toilet-door')!.access).toBe('open')
    expect(scene.objects.some(entity=>entity.id==='commercial-north-cafe-staff-opening')).toBe(false)
  })
})
