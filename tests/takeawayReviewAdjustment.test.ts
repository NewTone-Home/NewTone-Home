import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { findMainlinePathToEntity, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const scene = mainlineScenes['commercial-street']

describe('simplified takeaway shop work areas', () => {
  it('keeps the milk-tea return at the entry end and retains the pickup and locked rear door', () => {
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-south-s5-interior')!
    const front = scene.passages.find(passage => passage.toRoomId === room.id && passage.routeThrough)!
    const body = scene.continuousStructures.find(candidate => candidate.id === 'milk-tea-trial-front-return-body')!
    const localY = (body.y - room.bounds.y) * 10.8
    const entryY = (front.crossingTargets[0]!.y - room.bounds.y) * 10.8
    const rear = scene.passages.find(passage => passage.id === `${room.id}-rear-door`)!
    const pickup = scene.objects.find(object => object.id === 'commercial-s5-milk-tea-pickup-service-label')!
    expect(Math.abs(localY - entryY)).toBeLessThan(room.bounds.height * 10.8 / 2)
    expect(body.width * 19.2).toBeGreaterThan(100)
    expect(pickup).toBeDefined()
    expect(findMainlinePathToEntity(scene, pickup.id, front.crossingTargets[0]!, {}, { screenMetrics: sceneDesignReferenceMetrics }).path).not.toBeNull()
    expect(rear.access).toBe('locked')
  })

  it('keeps legacy fruit-tea equipment identities on one clear, vertical employee worktop', () => {
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-n1-interior')!
    const aliases = [1, 2, 3, 4, 5].map(index => scene.objects.find(object => object.id === `fruit-tea-trial-equipment-${index}`)!)
    const worktop = scene.continuousStructures.find(body => body.id === 'fruit-tea-trial-worktop-body')!
    expect(aliases.every(alias => alias.interactive)).toBe(true)
    expect(new Set(aliases.map(alias => alias.interactionStructureId))).toEqual(new Set([worktop.id]))
    expect(new Set(aliases.map(alias => `${alias.position.x}:${alias.position.y}`)).size).toBe(1)
    expect(worktop.counterSurface?.role).toBe('worktop')
    expect(worktop.width * 19.2).toBe(24)
    expect(worktop.height * 10.8).toBeGreaterThan(16)
    expect(worktop.x).toBeGreaterThan(room.bounds.x)
    expect(worktop.x + worktop.width).toBeLessThan(room.bounds.x + room.bounds.width)
    expect(scene.npcPlacements.find(placement => placement.npcId === 'fruit-tea-trial-worker')?.position).toEqual(resolveMainlineNpcPosition(scene, 'fruit-tea-trial-worker'))
  })
})
