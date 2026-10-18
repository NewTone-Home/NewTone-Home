import { describe, expect, it } from 'vitest'
import { createInitialPlayerSave, recordPlayerSceneStatePatch, sanitizePlayerSave } from '../src/center/runtime/playerSave'
import { mainlineSceneGeometryUnits, mainlineStorefrontAnchor, mainlineStorefrontApproach, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { worldLayerForScene } from '../src/center/runtime/phoneState'
import {
  commercialStreetMilkTeaClerkContactId,
  commercialStreetMilkTeaCopy,
  commercialStreetMilkTeaInteriorId,
  commercialStreetMilkTeaShopSceneId,
  commercialStreetMilkTeaPickupId,
  commercialStreetMilkTeaQrId,
  commercialStreetMilkTeaTutorialPatch,
  commercialStreetMilkTeaTutorialSeen,
} from '../src/center/runtime/commercialStreetMilkTeaInterior'
import { findMainlinePath, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { commercialStreetMilkTeaInteriorLayout, commercialStreetMilkTeaContinuousLayout, remapLegacyMilkTeaInteriorPosition } from '../src/center/runtime/commercialStreetMilkTeaInterior'
import { commercialStreetShopBounds, commercialStreetShopEntry, commercialStreetShopPortalId, commercialStreetShops } from '../src/center/runtime/commercialStreetWorldLayout'

describe('commercial street milk tea interior', () => {
  it('uses a safe default for legacy saves and persists the first-visit tutorial flag', () => {
    const legacySave = createInitialPlayerSave('commercial-street')
    expect(commercialStreetMilkTeaTutorialSeen(legacySave.sceneState['commercial-street'])).toBe(false)

    const updatedSave = recordPlayerSceneStatePatch(legacySave, 'commercial-street', commercialStreetMilkTeaTutorialPatch())
    const restored = sanitizePlayerSave(JSON.parse(JSON.stringify(updatedSave)), 'commercial-street')
    expect(commercialStreetMilkTeaTutorialSeen(restored.sceneState['commercial-street'])).toBe(true)
    expect(commercialStreetMilkTeaTutorialSeen(restored.sceneState[commercialStreetMilkTeaInteriorId])).toBe(false)
  })

  it('provides complete Chinese and English copy for the interior and phone ordering flow', () => {
    expect(commercialStreetMilkTeaCopy('zh').tutorial).toContain('二维码')
    expect(commercialStreetMilkTeaCopy('en').tutorial).toContain('QR code')
    expect(commercialStreetMilkTeaCopy('en').phonePlaceOrder).toBe('Place Order')
    expect(commercialStreetMilkTeaCopy('en').phoneReady).toContain('pickup')
  })

  it('routes the storefront into a shared display region and preserves legacy scene aliases', () => {
    const street = mainlineScenes['commercial-street']
    const storefront = street.storefronts.find((item) => item.id === 'commercial-south-slot-5')!
    const shop = commercialStreetShops.find((candidate) => candidate.kind === 'milk-tea')!
    const bounds = commercialStreetShopBounds(shop)
    const entry = commercialStreetShopEntry(shop)
    const passage = street.passages.find((candidate) => candidate.id === commercialStreetShopPortalId(shop))!

    expect(bounds.height).toBe(52)
    expect(storefront.portalId).toBe('street-milktea-entry')
    expect(storefront.characterSwitch).toBe(true)
    expect(passage.targetSceneId).toBeUndefined()
    expect(passage.entryPosition).toEqual(commercialStreetMilkTeaContinuousLayout.streetEntry)
    expect(passage.fromRoomId).toBeTruthy()
    expect(passage.toRoomId).toBeTruthy()
    expect(mainlineStorefrontAnchor(street, storefront).y).toBe(64)
    const geometry = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, storefront))
    expect(geometry.some((unit) => unit.navigation.passageId === passage.id)).toBe(true)
    expect(passage.thresholds[0]!.y).toBe(entry.streetApproach.y)
    expect(passage.crossingTargets[0]!.y).toBe(entry.crossingTarget.y)
    expect(Math.abs(passage.thresholds[0]!.x - entry.doorX)).toBeLessThan(1.5)
    expect(Math.abs(passage.crossingTargets[0]!.x - entry.doorX)).toBeLessThan(1.5)
    expect(street.walkBounds.y + street.walkBounds.height).toBe(116)
    expect(isWalkableMainlinePoint(passage.thresholds[0], street)).toBe(true)
    expect(mainlineScenes[commercialStreetMilkTeaShopSceneId]).toBeDefined()
    expect(mainlineScenes[commercialStreetMilkTeaInteriorId]).toBeDefined()
    expect(isWalkableMainlinePoint(commercialStreetMilkTeaInteriorLayout.interiorEntry, mainlineScenes[commercialStreetMilkTeaInteriorId])).toBe(true)
    expect(worldLayerForScene(commercialStreetMilkTeaInteriorId)).toBe('inner')
    expect(worldLayerForScene(commercialStreetMilkTeaShopSceneId)).toBe('inner')
  })

  it('keeps the L counter in the front, staff-only work space behind it, and kitchen and warehouse behind a full wall', () => {
    const interior = mainlineScenes['commercial-street']
    const clerkContact = interior.objects.find((entity) => entity.id === commercialStreetMilkTeaClerkContactId)!
    const qr = interior.objects.find((entity) => entity.id === commercialStreetMilkTeaQrId)!
    const pickupPoints = interior.objects.filter((entity) => entity.id.startsWith(commercialStreetMilkTeaPickupId))
    const layout = commercialStreetMilkTeaContinuousLayout

    expect(clerkContact.interactionBehavior).toBe('milk-tea-clerk')
    expect(qr.interactionBehavior).toBe('milk-tea-qr')
    expect(pickupPoints.length).toBeGreaterThan(0)
    expect(pickupPoints.every((entity) => entity.interactionBehavior === 'milk-tea-pickup')).toBe(true)
    expect(commercialStreetMilkTeaInteriorLayout.tables.every((table) => Math.hypot(commercialStreetMilkTeaInteriorLayout.qr.x - table.anchor.x, commercialStreetMilkTeaInteriorLayout.qr.y - table.anchor.y) >= 8)).toBe(true)
    expect(interior.continuousStructures.some((structure) => structure.id.startsWith('milk-tea-continuous-counter-'))).toBe(true)
    const street = mainlineScenes['commercial-street']
    const shopRoom = mainlineScenes[commercialStreetMilkTeaShopSceneId]
    expect(street.npcs.some((npc) => npc.id === 'milk-tea-clerk')).toBe(true)
    expect(street.objects.some((entity) => entity.id.startsWith('commercial-milktea-') || entity.id === commercialStreetMilkTeaQrId)).toBe(true)
    expect(interior.furnitureGroups.map((group) => group.id)).toEqual(expect.arrayContaining([
      'milk-tea-continuous-table',
      'commercial-cafe-right-window-upper-group',
      'commercial-cafe-right-inner-middle-group',
      'commercial-cafe-right-window-lower-group',
    ]))
    expect(interior.continuousStructures.some((structure) => structure.id.startsWith('milk-tea-continuous-counter-'))).toBe(true)
    expect(isWalkableMainlinePoint(layout.clerk, interior)).toBe(false)
    expect(findMainlinePath(layout.streetEntry, layout.clerkApproach, interior)).not.toBeNull()
    expect(findMainlinePath(layout.streetEntry, layout.clerk, interior)).toBeNull()
    expect(isWalkableMainlinePoint(commercialStreetMilkTeaContinuousLayout.streetEntry, interior)).toBe(true)
    expect(findMainlinePath(commercialStreetMilkTeaContinuousLayout.streetEntry, commercialStreetMilkTeaContinuousLayout.clerkApproach, interior)).not.toBeNull()
  })

  it('migrates old saved shop visits to a safe public aisle while preserving orders and old save data', () => {
    const legacyPosition = { x: 47, y: 79 }
    const legacySave = {
      ...createInitialPlayerSave(commercialStreetMilkTeaInteriorId),
      currentPosition: legacyPosition,
      scenePositions: { [commercialStreetMilkTeaInteriorId]: legacyPosition, 'commercial-street': { x: 44, y: 50 } },
      sceneState: {
        [commercialStreetMilkTeaInteriorId]: { legacyTutorialFlag: true },
        'commercial-street': { commercialStreetMilkTeaLastOrderNumber: 12 },
      },
    }
    const migrated = sanitizePlayerSave(legacySave, 'commercial-street')
    const expectedPosition = remapLegacyMilkTeaInteriorPosition(legacyPosition)

    expect(migrated.currentSceneId).toBe('commercial-street')
    expect(migrated.currentPosition).toEqual(expectedPosition)
    expect(migrated.scenePositions[commercialStreetMilkTeaInteriorId]).toEqual(legacyPosition)
    expect(migrated.scenePositions['commercial-street']).toEqual(expectedPosition)
    expect(migrated.sceneState['commercial-street']).toEqual({ legacyTutorialFlag: true, commercialStreetMilkTeaLastOrderNumber: 12 })
    expect(isWalkableMainlinePoint(expectedPosition, mainlineScenes['commercial-street'])).toBe(true)
  })
})
