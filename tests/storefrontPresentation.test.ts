import { describe, expect, it } from 'vitest'
import { mainlineSceneGeometryUnits, mainlineScenePassageCollision, mainlineScenes, mainlineStorefrontApproach } from '../src/center/runtime/mainlineScenes'
import {
  nextStorefrontPresentationPhase,
  storefrontRollDirection,
  storefrontLingerDurationMs,
  storefrontRestoreDelayMs,
  storefrontLabelRollDurationMs,
  storefrontPresentationLabelSlots,
  storefrontPresentationShouldReveal,
} from '../src/center/runtime/storefrontPresentation'

const street = mainlineScenes['commercial-street']
const cafe = street.storefronts.find((storefront) => storefront.id === 'commercial-cafe-slot')!

describe('commercial street storefront presentation', () => {
  it('counts the restore grace from actual departure, including unfinished reveal motion', () => {
    expect(storefrontRestoreDelayMs(100, 100)).toBe(3000)
    expect(storefrontRestoreDelayMs(100, 800)).toBe(2300)
    expect(storefrontRestoreDelayMs(100, 3100)).toBe(0)
    expect(storefrontRestoreDelayMs(100, 4100)).toBe(0)
  })
  it('keeps the approved 16-slot commercial street inventory while Café remains the only portal storefront', () => {
    const ordinaryStorefronts = street.storefronts.filter((storefront) => storefront.id !== 'commercial-cafe-slot')

    expect(ordinaryStorefronts.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'commercial-north-slot-1', label: '果茶店' },
      { id: 'commercial-north-slot-2', label: '服装店' },
      { id: 'commercial-north-slot-3', label: '花店' },
      { id: 'commercial-north-slot-4', label: '眼镜店' },
      { id: 'commercial-north-slot-5', label: '美妆店' },
      { id: 'commercial-north-slot-6', label: '服装店' },
      { id: 'commercial-north-slot-7', label: '书店' },
      { id: 'commercial-north-slot-8', label: '甜品店' },
      { id: 'commercial-south-slot-1', label: '鞋店' },
      { id: 'commercial-south-slot-2', label: '潮玩店' },
      { id: 'commercial-south-slot-3', label: '香氛店' },
      { id: 'commercial-south-slot-4', label: '服装店' },
      { id: 'commercial-south-slot-5', label: '奶茶店' },
      { id: 'commercial-south-slot-6', label: '周边店' },
      { id: 'commercial-south-slot-7', label: '首饰店' },
      { id: 'commercial-south-slot-8', label: '服装店' },
    ])
    expect(ordinaryStorefronts).toHaveLength(16)
    expect(ordinaryStorefronts.filter((storefront) => storefront.label === '服装店').map((storefront) => storefront.id)).toEqual([
      'commercial-north-slot-2',
      'commercial-north-slot-6',
      'commercial-south-slot-4',
      'commercial-south-slot-8',
    ])
    expect(ordinaryStorefronts.every((storefront) => storefront.portalId === undefined)).toBe(true)
    expect(ordinaryStorefronts.find((storefront) => storefront.label === '奶茶店')?.id).toBe('commercial-south-slot-5')
    expect(ordinaryStorefronts.find((storefront) => storefront.label === '果茶店')?.id).toBe('commercial-north-slot-1')
    expect(ordinaryStorefronts.find((storefront) => storefront.label === '甜品店')?.id).toBe('commercial-north-slot-8')
    expect(cafe).toMatchObject({ id: 'commercial-cafe-slot', label: '咖啡馆', portalId: 'street-cafe-entry' })
    expect(street.passages.find((passage) => passage.id === 'street-cafe-entry')).toMatchObject({
      entityId: 'street-cafe-entry',
      targetSceneId: 'commercial-cafe',
    })
  })

  it('keeps the Café label as one complete rolling slot by default', () => {
    expect(storefrontPresentationLabelSlots(cafe.label)).toEqual(['咖啡馆'])
    expect(storefrontLabelRollDurationMs).toBe(700)
    const baseline = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, undefined, new Map())
    expect(baseline.some((unit) => unit.storefrontId === cafe.id && unit.variant === 'baseline')).toBe(true)
  })

  it('rolls a whole group inward independently of typography and preserves the grace period', () => {
    expect(storefrontRollDirection('left')).toEqual({ x: -1, y: 0 })
    expect(storefrontRollDirection('right')).toEqual({ x: 1, y: 0 })
    expect(storefrontRollDirection('top')).toEqual({ x: 0, y: -1 })
    expect(storefrontRollDirection('bottom')).toEqual({ x: 0, y: 1 })
    expect(storefrontLingerDurationMs).toBe(3000)
  })

  it('keeps the complete storefront sign visible alongside the near wall and door projection', () => {
    const nearUnits = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, cafe))
      .filter((unit) => unit.storefrontId === cafe.id)
    const roles = nearUnits.flatMap((unit) => unit.visual.cells.map((cell) => cell.storefrontRole))

    expect(nearUnits.some((unit) => unit.variant === 'baseline' && unit.visual.cells.some((cell) => cell.storefrontRole === 'sign'))).toBe(true)
    expect(roles).toContain('sign')
  })

  it('preserves a sign owner when narrow projection provides fewer cells than label characters', () => {
    const clothing = street.storefronts.find((storefront) => storefront.id === 'commercial-north-slot-2')!
    const projected = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, clothing), { width: 390, height: 844 })
    const cells = projected.filter((unit) => unit.storefrontId === clothing.id).flatMap((unit) => unit.visual.cells)

    expect(cells.some((cell) => cell.storefrontRole === 'sign')).toBe(true)
  })

  it('enters revealing and then revealed only for the portal storefront approach', () => {
    expect(storefrontPresentationShouldReveal(street, cafe, mainlineStorefrontApproach(street, cafe))).toBe(true)
    expect(nextStorefrontPresentationPhase('baseline', 'approach')).toBe('retracting')
    expect(nextStorefrontPresentationPhase('retracting', 'frame-retracted')).toBe('revealing')
    expect(nextStorefrontPresentationPhase('retracting', 'leave')).toBe('baseline')
    expect(nextStorefrontPresentationPhase('revealing', 'leave')).toBe('revealing')
    expect(nextStorefrontPresentationPhase('revealing', 'reveal-motion-complete')).toBe('revealed')
    const nonPortal = street.storefronts.find((storefront) => !storefront.portalId)!
    expect(storefrontPresentationShouldReveal(street, nonPortal, mainlineStorefrontApproach(street, nonPortal))).toBe(false)
  })

  it('keeps real passage collision unchanged while the visual cover reveals', () => {
    const baselineCollision = mainlineScenePassageCollision(street, 'street-cafe-entry')
    const revealedUnits = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, cafe), undefined, new Map([[cafe.id, 'revealed']]))
    const revealedDoor = revealedUnits.find((unit) => unit.storefrontId === cafe.id && unit.entityId === 'street-cafe-entry')
    expect(revealedDoor?.navigation.passageId).toBe('street-cafe-entry')
    expect(mainlineScenePassageCollision(street, 'street-cafe-entry')).toEqual(baselineCollision)
  })

  it('holds reveal through grace, cancels restoration on re-entry, then restores after sustained leave', () => {
    expect(nextStorefrontPresentationPhase('revealed', 'approach')).toBe('revealed')
    expect(nextStorefrontPresentationPhase('revealed', 'leave')).toBe('lingering')
    expect(nextStorefrontPresentationPhase('lingering', 'approach')).toBe('revealed')
    expect(nextStorefrontPresentationPhase('lingering', 'linger-animation-complete')).toBe('restoring')
    expect(nextStorefrontPresentationPhase('restoring', 'restore-motion-complete')).toBe('baseline')
  })

  it('does not make the presentation part of traversal completion', () => {
    const passage = street.passages.find((candidate) => candidate.id === 'street-cafe-entry')!
    expect(passage.targetSceneId).toBe('commercial-cafe')
    expect(nextStorefrontPresentationPhase('revealing', 'reveal-motion-complete')).toBe('revealed')
  })
})
