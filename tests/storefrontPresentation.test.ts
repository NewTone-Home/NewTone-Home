import { describe, expect, it } from 'vitest'
import { isMainlineStorefrontNear, isMainlineStorefrontPresentationInRange, mainlineSceneGeometryUnits, mainlineScenePassageCollision, mainlineScenes, mainlineStorefrontAnchor, mainlineStorefrontApproach, mainlineStorefrontDepartureRadius } from '../src/center/runtime/mainlineScenes'
import {
  nextStorefrontPresentationPhase,
  storefrontRollDirection,
  storefrontLingerDurationMs,
  storefrontRestoreDelayMs,
  storefrontLabelRollDurationMs,
  storefrontPresentationLabelSlots,
  storefrontCharacterCells,
  storefrontCharacterProgress,
  activeStorefrontPresentationOwner,
  storefrontPresentationHandoffSource,
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
  it('keeps the approved 14-shop continuous street inventory and locks every storefront door', () => {
    expect(street.storefronts.map(({ id, label, start, end }) => ({ id, label, start, end }))).toEqual([
      { id: 'commercial-north-slot-1', label: '水果茶店', start: 14, end: 32 },
      { id: 'commercial-north-slot-2', label: '书店', start: 36, end: 54 },
      { id: 'commercial-north-slot-3', label: '美妆店', start: 58, end: 76 },
      { id: 'commercial-north-slot-4', label: '眼镜店', start: 80, end: 98 },
      { id: 'commercial-north-slot-5', label: '玩具店', start: 102, end: 120 },
      { id: 'commercial-north-slot-6', label: '香氛店', start: 124, end: 142 },
      { id: 'commercial-cafe-slot', label: '咖啡馆', start: 146, end: 186 },
      { id: 'commercial-south-slot-1', label: '鞋店', start: 14, end: 32 },
      { id: 'commercial-south-slot-2', label: '永和小馆', start: 36, end: 76 },
      { id: 'commercial-south-slot-4', label: '服装店', start: 80, end: 98 },
      { id: 'commercial-south-slot-5', label: '奶茶店', start: 102, end: 120 },
      { id: 'commercial-south-slot-6', label: '甜品店', start: 124, end: 142 },
      { id: 'commercial-south-slot-7', label: '珠宝店', start: 146, end: 164 },
      { id: 'commercial-south-slot-8', label: '服装店', start: 168, end: 186 },
    ])
    expect(street.storefronts).toHaveLength(14)
    expect(street.storefronts.every((storefront) => storefront.portalId && storefront.characterSwitch)).toBe(true)
    expect(street.passages).toHaveLength(14)
    expect(street.passages.every((passage) => passage.access === 'locked' && !passage.targetSceneId)).toBe(true)
    expect(street.passages.find((passage) => passage.id === 'street-cafe-entry')?.targetSceneId).toBeUndefined()
  })

  it('projects one window per character without adding world entities', () => {
    expect(storefrontPresentationLabelSlots(cafe.label)).toEqual(['咖', '啡', '馆'])
    expect(storefrontLabelRollDurationMs).toBe(700)
    const baseline = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, undefined, new Map())
    expect(baseline.some((unit) => unit.storefrontId === cafe.id && unit.variant === 'baseline')).toBe(true)
  })

  it('uses the real three authored visual positions and door identity across responsive viewports', () => {
    expect(cafe.characterSwitch).toBe(true)
    const yonghePortal = Object.values(mainlineScenes).flatMap(scene => scene.storefronts).find(storefront => storefront.portalId === 'yonghe-street-entry')
    expect(yonghePortal).toBeDefined()
    expect(yonghePortal?.characterSwitch).not.toBe(true)
    for (const metrics of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const projected = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, cafe), metrics, new Map([[cafe.id, 'revealed']]))
      const cells = storefrontCharacterCells(street, cafe, projected)
      expect(cells.map(cell => [cell.baselineGlyph, cell.glyph])).toEqual([['咖', '墙'], ['啡', '门'], ['馆', '墙']])
      expect(cells).toHaveLength(3)
      expect(cells[1].entityId).toBe(cafe.portalId)
      const source = projected.flatMap(unit => unit.visual.cells.map(cell => ({ unit, cell })))
        .filter(({ unit, cell }) => unit.sourceWallId === cafe.wallId && unit.edge === cafe.edge && (cell.kind === 'wall' || cell.kind === 'door'))
      const along = ({ cell }: typeof source[number]) => cafe.edge === 'left' || cafe.edge === 'right' ? cell.y : cell.x
      const sourceDoor = source.find(({ unit, cell }) => cell.kind === 'door' && (cell.entityId === cafe.portalId || unit.entityId === cafe.portalId))
      const passageAnchor = projected.find(unit => unit.storefrontId === cafe.id && unit.navigation.passageId === cafe.portalId)!
      const doorPosition = sourceDoor?.cell ?? { x: passageAnchor.x + passageAnchor.width / 2, y: passageAnchor.y + passageAnchor.height / 2 }
      const doorTangent = cafe.edge === 'left' || cafe.edge === 'right' ? doorPosition.y : doorPosition.x
      const wallBefore = source.filter(({ cell }) => cell.kind === 'wall' && along({ unit: passageAnchor, cell }) < doorTangent)
        .sort((first, second) => along(second) - along(first))[0]
      const wallAfter = source.filter(({ cell }) => cell.kind === 'wall' && along({ unit: passageAnchor, cell }) > doorTangent)
        .sort((first, second) => along(first) - along(second))[0]
      expect(cells.map(({ id, x, y }) => [id, x, y])).toEqual([
        [wallBefore.cell.id, wallBefore.cell.x, wallBefore.cell.y],
        [sourceDoor?.cell.id ?? `${cafe.id}-base-cell-1`, doorPosition.x, doorPosition.y],
        [wallAfter.cell.id, wallAfter.cell.x, wallAfter.cell.y],
      ])
      expect(new Set(cells.map(cell => `${cell.x},${cell.y}`)).size).toBe(3)
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

  it('enters revealing and then revealed at every storefront approach', () => {
    expect(storefrontPresentationShouldReveal(street, cafe, mainlineStorefrontApproach(street, cafe))).toBe(true)
    expect(nextStorefrontPresentationPhase('baseline', 'approach')).toBe('retracting')
    expect(nextStorefrontPresentationPhase('retracting', 'frame-retracted')).toBe('revealing')
    expect(nextStorefrontPresentationPhase('retracting', 'leave')).toBe('baseline')
    expect(nextStorefrontPresentationPhase('revealing', 'leave')).toBe('revealing')
    expect(nextStorefrontPresentationPhase('revealing', 'reveal-motion-complete')).toBe('revealed')
    for (const storefront of street.storefronts) {
      expect(storefrontPresentationShouldReveal(street, storefront, mainlineStorefrontApproach(street, storefront))).toBe(true)
    }
  })

  it('keeps each locked portal reveal inside its authored approach radius', () => {
    for (const storefront of street.storefronts) {
      const approach = mainlineStorefrontApproach(street, storefront)
      expect(isMainlineStorefrontPresentationInRange(street, storefront, approach)).toBe(true)
      expect(isMainlineStorefrontPresentationInRange(street, storefront, { x: approach.x + 20, y: approach.y })).toBe(false)
    }
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
    expect(passage.access).toBe('locked')
    expect(passage.targetSceneId).toBeUndefined()
    expect(nextStorefrontPresentationPhase('revealing', 'reveal-motion-complete')).toBe('revealed')
  })
})
