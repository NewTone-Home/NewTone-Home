import { describe, expect, it } from 'vitest'
import { commercialStreetShopBounds, commercialStreetShopEntry, commercialStreetShopPortalId, commercialStreetShops } from '../src/center/runtime/commercialStreetWorldLayout'
import { isMainlineStorefrontNear, isMainlineStorefrontPresentationInRange, mainlineSceneGeometryUnits, mainlineScenePassageCollision, mainlineScenes, mainlineStorefrontAnchor, mainlineStorefrontApproach, mainlineStorefrontDepartureRadius, projectedSceneGeometry } from '../src/center/runtime/mainlineScenes'
import {
  nextStorefrontPresentationPhase,
  storefrontRollDirection,
  storefrontLingerDurationMs,
  storefrontRestoreDelayMs,
  storefrontLabelRollDurationMs,
  storefrontPresentationLabelSlots,
  storefrontCharacterProgress,
  activeStorefrontPresentationOwner,
  storefrontPresentationHandoffSource,
  storefrontPresentationShouldReveal,
  storefrontCharacterCells,
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
  it('builds fourteen locked storefront doors across sixteen standard modules', () => {
    expect(street.storefronts).toHaveLength(14)
    expect(commercialStreetShops).toHaveLength(14)
    expect(commercialStreetShops.reduce((sum, shop) => sum + shop.moduleCount, 0)).toBe(16)
    expect(street.storefronts.map((storefront) => storefront.id)).toEqual([
      'commercial-north-slot-1', 'commercial-north-slot-2', 'commercial-north-slot-3',
      'commercial-north-slot-4', 'commercial-north-slot-5', 'commercial-north-slot-6',
      'commercial-cafe-slot', 'commercial-south-slot-1', 'commercial-south-slot-2',
      'commercial-south-slot-4', 'commercial-south-slot-5', 'commercial-south-slot-6',
      'commercial-south-slot-7', 'commercial-south-slot-8',
    ])
    expect(street.portals).toHaveLength(14)
    expect(street.portals.filter((portal) => commercialStreetShops.some((shop) => commercialStreetShopPortalId(shop) === portal.id))).toHaveLength(14)
    expect(street.portals.some((portal) => portal.id === 'commercial-street-lakefront-entry')).toBe(false)
    for (const shop of commercialStreetShops) {
      const passage = street.passages.find((candidate) => candidate.id === commercialStreetShopPortalId(shop))!
      const entry = commercialStreetShopEntry(shop)
      const bounds = commercialStreetShopBounds(shop)
      const storefrontId = shop.kind === 'cafe' ? 'commercial-cafe-slot' : shop.storefrontIds[0]
      const storefront = street.storefronts.find((candidate) => candidate.id === storefrontId)!
      expect(storefront.portalId).toBe(passage.id)
      expect(storefront.characterSwitch).toBe(true)
      expect(passage, shop.id).toBeDefined()
      expect(passage.access, shop.id).toBe('locked')
      expect(passage.lockedText).toBe('本期暂未开放。')
      if (shop.kind === 'cafe') {
        expect(passage.targetSceneId).toBeUndefined()
        expect(passage.routeThrough).toBe(true)
        expect(passage.fromRoomId).toBe('commercial-street-east')
        expect(passage.toRoomId).toBe('commercial-cafe-interior')
      } else {
        expect(passage.fromRoomId).toBeDefined()
        expect(passage.toRoomId).toBeDefined()
      }
      expect(Math.abs(passage.thresholds[0]!.x - entry.doorX), shop.id).toBeLessThan(1.5)
      expect(Math.abs(passage.crossingTargets[0]!.x - entry.doorX), shop.id).toBeLessThan(1.5)
      expect(passage.thresholds[0]!.y).toBe(entry.streetApproach.y)
      expect(passage.crossingTargets[0]!.y).toBe(entry.crossingTarget.y)
      if (shop.row === 'north') {
        expect(passage.thresholds[0]!.y).toBeGreaterThan(entry.storefrontY)
        expect(passage.crossingTargets[0]!.y).toBeLessThan(entry.storefrontY)
      } else {
        expect(passage.thresholds[0]!.y).toBeLessThan(entry.storefrontY)
        expect(passage.crossingTargets[0]!.y).toBeGreaterThan(entry.storefrontY)
      }
      if (shop.kind === 'cafe') {
        expect(passage.entryPosition?.y).toBeGreaterThan(bounds.y + 5)
        expect(passage.entryPosition?.y).toBeLessThan(bounds.y + bounds.height - 5)
        expect(passage.targetSceneId).toBeUndefined()
        expect(passage.toRoomId).toBe('commercial-cafe-interior')
      } else {
        expect(passage.fromRoomId).toBeDefined()
        expect(passage.toRoomId).toBeDefined()
      }
    }
    expect(cafe).toMatchObject({ id: 'commercial-cafe-slot', portalId: 'street-cafe-entry', characterSwitch: true })
    expect(street.passages.find((passage) => passage.id === 'street-cafe-entry')).toMatchObject({
      entityId: 'street-cafe-entry',
      routeThrough: true,
      fromRoomId: 'commercial-street-east',
      toRoomId: 'commercial-cafe-interior',
    })
    const milkTeaPassage = street.passages.find((passage) => passage.id === 'street-milktea-entry')!
    expect(milkTeaPassage.fromRoomId).toBeDefined()
    expect(milkTeaPassage.toRoomId).toBeDefined()
    expect(milkTeaPassage.targetSceneId).toBeUndefined()
    expect(milkTeaPassage.entryPosition).toEqual({ x: 111, y: 69 })
  })

  it('projects one window per character without adding world entities', () => {
    expect(storefrontPresentationLabelSlots(cafe.label)).toEqual(['咖', '啡', '馆'])
    expect(storefrontLabelRollDurationMs).toBe(700)
    const baseline = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, undefined, new Map())
    expect(baseline.some((unit) => unit.storefrontId === cafe.id && unit.variant === 'baseline')).toBe(true)
  })

  it('keeps all fourteen near projections anchored to complete real door cells', () => {
    for (const metrics of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      for (const shop of commercialStreetShops) {
        const storefrontId = shop.kind === 'cafe' ? 'commercial-cafe-slot' : shop.storefrontIds[0]!
        const storefront = street.storefronts.find(candidate => candidate.id === storefrontId)!
        const cells = storefrontCharacterCells(street, storefront, projectedSceneGeometry(street, metrics))
        expect(cells.length, `${shop.id} at ${metrics.width}px`).toBeGreaterThan(0)
        if (metrics.width > 390) {
          expect(cells.map(cell => cell.role), shop.id).toEqual(['glass', 'glass', 'wall', 'door', 'wall', 'glass', 'glass'])
        }
        expect(cells.filter(cell => cell.role === 'door'), shop.id).toHaveLength(1)
        expect(cells.find(cell => cell.role === 'door')?.entityId, shop.id).toBe(commercialStreetShopPortalId(shop))
        if (metrics.width > 390) expect(cells.map(cell => cell.baselineGlyph).join(''), shop.id).toContain(shop.label.zh)
        expect(cells.map(cell => cell.id).filter(Boolean).length, shop.id).toBe(cells.length)
      }
    }
  })

  it('uses the real three authored visual positions and door identity across responsive viewports', () => {
    expect(cafe.characterSwitch).toBe(true)
    const yonghePortal = Object.values(mainlineScenes).flatMap(scene => scene.storefronts).find(storefront => storefront.portalId === 'yonghe-street-entry')
    expect(yonghePortal).toBeDefined()
    expect(yonghePortal?.characterSwitch).not.toBe(true)
    for (const metrics of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const projected = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, cafe), metrics, new Map([[cafe.id, 'revealed']]))
      const passageAnchor = projected.find(unit => unit.navigation.passageId === cafe.portalId)
      expect(passageAnchor).toBeDefined()
      expect(passageAnchor?.navigation.passageId).toBe(cafe.portalId)
      expect(projected.some(unit => unit.storefrontId === cafe.id && unit.visual.cells.some(cell => cell.storefrontRole === 'sign'))).toBe(true)
      const baselineUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[cafe.id, 'baseline']]))
      const revealedUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[cafe.id, 'revealed']]))
      const physical = (units: typeof baselineUnits) => units.filter(unit => unit.navigation.blocked).map(({ id, x, y, width, height, navigation }) => ({ id, x, y, width, height, navigation }))
      expect(physical(revealedUnits)).toEqual(physical(baselineUnits))
      expect(projected.some(unit => unit.navigation.passageId === cafe.portalId)).toBe(true)
    }
  })

  it('uses one reversible normalized progress rather than per-cell timers', () => {
    expect(storefrontCharacterProgress(0, 1, 0, 700)).toBe(0)
    expect(storefrontCharacterProgress(0, 1, 350, 700)).toBe(.5)
    expect(storefrontCharacterProgress(0, 1, 700, 700)).toBe(1)
    expect(storefrontCharacterProgress(.5, 0, 175, 350)).toBe(.25)
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

  it('keeps ordinary storefront glass on both sides of each sign when the projected cells allow it', () => {
    for (const metrics of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      const projected = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics)
      const rowStorefronts = street.storefronts.filter((storefront) => storefront.edge === 'top' || storefront.edge === 'bottom')
      for (const storefront of rowStorefronts) {
        const cells = projected
          .filter((unit) => unit.storefrontId === storefront.id && unit.variant === 'baseline')
          .flatMap((unit) => unit.visual.cells)
          .sort((first, second) => (first.cellStart ?? first.x) - (second.cellStart ?? second.x))
        const signIndexes = cells.flatMap((cell, index) => cell.storefrontRole === 'sign' ? [index] : [])
        if (signIndexes.length < Array.from(storefront.label).length || cells.length < signIndexes.length + 2) continue

        const firstSign = signIndexes[0]
        const lastSign = signIndexes.at(-1)!
        expect(cells[0].storefrontRole, `${storefront.id} leading glass`).toBe('glass')
        expect(cells.at(-1)?.storefrontRole, `${storefront.id} trailing glass`).toBe('glass')
        expect(cells.slice(firstSign, lastSign + 1).map((cell) => cell.glyph).join('')).toBe(storefront.label)
        expect(cells.slice(firstSign, lastSign + 1).every((cell) => cell.storefrontRole === 'sign')).toBe(true)
      }
    }
  })

  it('enters revealing and then revealed only for the portal storefront approach', () => {
    expect(storefrontPresentationShouldReveal(street, cafe, mainlineStorefrontApproach(street, cafe))).toBe(true)
    expect(nextStorefrontPresentationPhase('baseline', 'approach')).toBe('retracting')
    expect(nextStorefrontPresentationPhase('retracting', 'frame-retracted')).toBe('revealing')
    expect(nextStorefrontPresentationPhase('retracting', 'leave')).toBe('baseline')
    expect(nextStorefrontPresentationPhase('revealing', 'leave')).toBe('revealing')
    expect(nextStorefrontPresentationPhase('revealing', 'reveal-motion-complete')).toBe('revealed')
    const nonPortal = { ...street.storefronts.find((storefront) => storefront.id !== cafe.id)!, portalId: undefined }
    expect(storefrontPresentationShouldReveal(street, nonPortal, mainlineStorefrontApproach(street, nonPortal))).toBe(false)
  })

  it('bounds Café reveal departure outside its south facing entrance', () => {
    const departureRadius = mainlineStorefrontDepartureRadius(street, cafe)
    const approach = mainlineStorefrontApproach(street, cafe)
    expect(departureRadius).toBeDefined()
    const glassBoundary = { x: approach.x, y: approach.y + departureRadius! }
    const beyondBoundary = { x: approach.x, y: approach.y + departureRadius! + .02 }
    const inwardDoor = mainlineStorefrontAnchor(street, cafe)

    expect(departureRadius).toBe(6)
    expect(isMainlineStorefrontPresentationInRange(street, cafe, glassBoundary)).toBe(true)
    expect(isMainlineStorefrontPresentationInRange(street, cafe, beyondBoundary)).toBe(false)
    expect(isMainlineStorefrontPresentationInRange(street, cafe, approach)).toBe(true)
    expect(isMainlineStorefrontPresentationInRange(street, cafe, inwardDoor)).toBe(true)

    const ordinary = street.storefronts.find((storefront) => storefront.id === 'commercial-north-slot-2')!
    expect(mainlineStorefrontDepartureRadius(street, ordinary)).toBeUndefined()
    const ordinaryPortal = { ...ordinary, id: 'ordinary-portal', portalId: 'ordinary-entry' }
    expect(isMainlineStorefrontPresentationInRange(street, ordinaryPortal, mainlineStorefrontApproach(street, ordinary))).toBe(true)
    expect(isMainlineStorefrontNear(street, ordinaryPortal, mainlineStorefrontAnchor(street, ordinary))).toBe(true)
  })

  it('assigns one entrance owner to the nearest eligible storefront and releases ownership on exit', () => {
    const firstApproach = mainlineStorefrontApproach(street, cafe)
    const distantStorefront = street.storefronts
      .filter((storefront) => storefront.id !== cafe.id)
      .map((storefront) => ({ storefront, approach: mainlineStorefrontApproach(street, storefront) }))
      .sort((first, second) => Math.hypot(second.approach.x - firstApproach.x, second.approach.y - firstApproach.y)
        - Math.hypot(first.approach.x - firstApproach.x, first.approach.y - firstApproach.y))[0].storefront
    const secondApproach = mainlineStorefrontApproach(street, distantStorefront)
    const first = { ...cafe, id: 'cafe-a', approach: firstApproach }
    const second = { ...cafe, id: 'cafe-b', approach: secondApproach }
    const pairedScene = { ...street, storefronts: [first, second] }

    expect(activeStorefrontPresentationOwner(pairedScene, firstApproach)).toBe('cafe-a')
    expect(activeStorefrontPresentationOwner(pairedScene, secondApproach)).toBe('cafe-b')
    expect(activeStorefrontPresentationOwner(pairedScene, street.initialPlayerPosition)).toBeNull()
  })

  it('restores the outgoing entrance immediately on an A-to-B handoff', () => {
    expect(nextStorefrontPresentationPhase('revealed', 'handoff')).toBe('restoring')
    expect(nextStorefrontPresentationPhase('lingering', 'handoff')).toBe('restoring')
    expect(nextStorefrontPresentationPhase('revealing', 'handoff')).toBe('restoring')
    expect(nextStorefrontPresentationPhase('retracting', 'handoff')).toBe('baseline')
    expect(nextStorefrontPresentationPhase('baseline', 'handoff')).toBe('baseline')
    expect(storefrontPresentationHandoffSource(new Map([['cafe-a', 'lingering'], ['cafe-b', 'baseline']]), 'cafe-b')).toBe('cafe-a')
    expect(storefrontPresentationHandoffSource(new Map([['cafe-a', 'baseline']]), 'cafe-b')).toBeNull()
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
    expect(passage.targetSceneId).toBeUndefined()
    expect(passage.routeThrough).toBe(true)
    expect(passage.toRoomId).toBe('commercial-cafe-interior')
    expect(nextStorefrontPresentationPhase('revealing', 'reveal-motion-complete')).toBe('revealed')
  })
})
