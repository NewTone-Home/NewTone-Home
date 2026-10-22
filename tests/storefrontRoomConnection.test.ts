import { describe, expect, it } from 'vitest'
import { mainlineScenes, mainlineStorefrontApproach, type MainlineSceneDefinition } from '../src/center/runtime/mainlineScenes'
import { activeStorefrontInteriorOwner, activeStorefrontPresentationOwner } from '../src/center/runtime/storefrontPresentation'
import { storefrontRoomConnection } from '../src/center/runtime/storefrontRoomConnection'
import { classifyMainlineWorldCommand, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const street = mainlineScenes['commercial-street']
// Reuse verified shell geometry under a different scene and arbitrary room
// names. This tests the shared interface without importing another worktree's
// in-progress map/layout. No '-interior' or public-lane name conventions.
const names = new Map(street.rooms.map((room, index) => [room.id, `room-${index}`]))
const connected: MainlineSceneDefinition = {
  ...street, id: 'yonghe-mining-perimeter',
  rooms: street.rooms.map(room => ({ ...room, id: names.get(room.id)! })),
  passages: street.passages.map(passage => ({ ...passage,
    fromRoomId: passage.fromRoomId ? names.get(passage.fromRoomId) : undefined,
    toRoomId: passage.toRoomId ? names.get(passage.toRoomId) : undefined,
  })),
}

describe('data-driven same-world storefront rooms', () => {
  it('keeps each owning facade revealed deep inside any connected shop', () => {
    for (const storefront of connected.storefronts) {
      const connection = storefrontRoomConnection(connected, storefront)!
      expect(connection).not.toBeNull()
      const bounds = connection.interiorRoom.bounds
      const deep = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      expect(activeStorefrontInteriorOwner(connected, deep)).toBe(storefront.id)
      expect(activeStorefrontPresentationOwner(connected, deep)).toBeNull()
      expect(activeStorefrontPresentationOwner(connected, mainlineStorefrontApproach(connected, storefront))).toBe(storefront.id)
    }
  })
  it('uses connected room data to distinguish street walking from shop entry', () => {
    const storefront = connected.storefronts.find(slot => storefrontRoomConnection(connected, slot)?.publicRoom.kind === 'corridor')!
    const connection = storefrontRoomConnection(connected, storefront)!
    const approach = mainlineStorefrontApproach(connected, storefront)
    const options = { screenMetrics: sceneDesignReferenceMetrics }
    const alongStreet = { x: approach.x + 2, y: 50 }
    expect(classifyMainlineWorldCommand(connected, { x: approach.x, y: 50 }, alongStreet, {}, options).kind).toBe('ordinary')
    // Widened fruit counter now occupies the geometric room center. Use the
    // actual public interior landing, not a fabricated start inside a solid.
    const inside = connection.passage.crossingTargets[0]
    expect(isWalkableMainlinePoint(inside, connected, {}, options)).toBe(true)
    expect(classifyMainlineWorldCommand(connected, approach, inside, {}, options)).toMatchObject({ kind: 'passage', passage: { id: connection.passage.id } })
    expect(classifyMainlineWorldCommand(connected, inside, approach, {}, options)).toMatchObject({ kind: 'passage', passage: { id: connection.passage.id } })
  })
  it('does not invent an indoor room for legacy cross-scene portals', () => {
    const legacy: MainlineSceneDefinition = { ...connected,
      passages: connected.passages.map(passage => ({ ...passage, targetSceneId: 'commercial-cafe' })),
    }
    const storefront = legacy.storefronts[0]!
    expect(storefrontRoomConnection(legacy, storefront)).toBeNull()
    expect(activeStorefrontInteriorOwner(legacy, legacy.initialPlayerPosition)).toBeNull()
  })
})
