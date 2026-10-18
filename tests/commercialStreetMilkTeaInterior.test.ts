import { describe, expect, it } from 'vitest'
import { createInitialPlayerSave, recordPlayerSceneStatePatch, sanitizePlayerSave } from '../src/center/runtime/playerSave'
import { mainlineSceneGeometryUnits, mainlineStorefrontAnchor, mainlineStorefrontApproach, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { storefrontCharacterCells } from '../src/center/runtime/storefrontPresentation'
import { worldLayerForScene } from '../src/center/runtime/phoneState'
import {
  commercialStreetMilkTeaClerkContactId,
  commercialStreetMilkTeaCopy,
  commercialStreetMilkTeaInteriorId,
  commercialStreetMilkTeaPickupId,
  commercialStreetMilkTeaQrId,
  commercialStreetMilkTeaTutorialPatch,
  commercialStreetMilkTeaTutorialSeen,
} from '../src/center/runtime/commercialStreetMilkTeaInterior'
import { findMainlinePath, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { commercialStreetMilkTeaInteriorLayout, remapLegacyMilkTeaInteriorPosition } from '../src/center/runtime/commercialStreetMilkTeaInterior'

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

  it('keeps the 52-unit shop in a separate scene behind the existing storefront doorway', () => {
    const street = mainlineScenes['commercial-street']
    const storefront = street.storefronts.find((item) => item.id === 'commercial-south-slot-5')!
    const layout = commercialStreetMilkTeaInteriorLayout
    const interior = mainlineScenes[commercialStreetMilkTeaInteriorId]

    expect(layout.bounds.height).toBe(52)
    expect(storefront.portalId).toBe('street-milktea-entry')
    expect(storefront.characterSwitch).toBe(true)
    expect(mainlineStorefrontAnchor(street, storefront)).toEqual({ x: 111, y: 64 })
    const geometry = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, storefront))
    expect(storefrontCharacterCells(street, storefront, geometry)).toHaveLength(3)
    expect(street.passages.some((passage) => passage.id === 'street-milktea-entry')).toBe(true)
    expect(street.walkBounds.y + street.walkBounds.height).toBe(90)
    expect(isWalkableMainlinePoint({ x: 109, y: 58 }, street)).toBe(true)
    expect(isWalkableMainlinePoint(layout.interiorEntry, interior)).toBe(true)
    expect(worldLayerForScene(commercialStreetMilkTeaInteriorId)).toBe('inner')
    expect(worldLayerForScene(commercialStreetMilkTeaInteriorId)).toBe('inner')
  })

  it('keeps the L counter in the front, staff-only work space behind it, and kitchen and warehouse behind a full wall', () => {
    const interior = mainlineScenes[commercialStreetMilkTeaInteriorId]
    const clerkContact = interior.objects.find((entity) => entity.id === commercialStreetMilkTeaClerkContactId)!
    const qr = interior.objects.find((entity) => entity.id === commercialStreetMilkTeaQrId)!
    const pickupPoints = interior.objects.filter((entity) => entity.id.startsWith(commercialStreetMilkTeaPickupId))
    const layout = commercialStreetMilkTeaInteriorLayout

    expect(clerkContact.interactionBehavior).toBe('milk-tea-clerk')
    expect(qr.interactionBehavior).toBe('milk-tea-qr')
    expect(pickupPoints.length).toBeGreaterThan(0)
    expect(pickupPoints.every((entity) => entity.interactionBehavior === 'milk-tea-pickup')).toBe(true)
    expect(interior.continuousStructures.some((structure) => structure.id === 'milk-tea-counter-body')).toBe(true)
    expect(isWalkableMainlinePoint(layout.clerk, interior)).toBe(false)
    expect(isWalkableMainlinePoint({ x: 50, y: 36 }, interior)).toBe(true)
    expect(findMainlinePath(layout.interiorEntry, { x: 50, y: 36 }, interior)).not.toBeNull()
    expect(findMainlinePath(layout.interiorEntry, layout.clerk, interior)).toBeNull()
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
