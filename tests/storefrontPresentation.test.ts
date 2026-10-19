import { describe, expect, it } from 'vitest'
import { isMainlineStorefrontNear, isMainlineStorefrontPresentationInRange, mainlineCanonicalSceneGeometryUnits, mainlineSceneGeometryUnits, mainlineScenePassageCollision, mainlineScenes, mainlineStorefrontAnchor, mainlineStorefrontApproach, mainlineStorefrontDepartureRadius } from '../src/center/runtime/mainlineScenes'
import {
  nextStorefrontPresentationPhase,
  storefrontRollDirection,
  storefrontLingerDurationMs,
  storefrontRestoreDelayMs,
  storefrontLabelRollDurationMs,
  storefrontPresentationLabelSlots,
  storefrontCharacterCells,
  storefrontCellVisualState,
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
      { id: 'commercial-north-slot-1', label: '果茶店', start: 14, end: 32 },
      { id: 'commercial-north-slot-2', label: '书店', start: 36, end: 54 },
      { id: 'commercial-north-slot-3', label: '美妆店', start: 58, end: 76 },
      { id: 'commercial-north-slot-4', label: '眼镜店', start: 80, end: 98 },
      { id: 'commercial-north-slot-5', label: '玩具店', start: 102, end: 120 },
      { id: 'commercial-north-slot-6', label: '香氛店', start: 124, end: 142 },
      { id: 'commercial-cafe-slot', label: '咖啡馆', start: 146, end: 186 },
      { id: 'commercial-south-slot-1', label: '鞋店', start: 14, end: 32 },
      { id: 'commercial-south-slot-2', label: '简餐', start: 36, end: 76 },
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

  it('keeps the cafe sign, biased entry and right-side glass on stable authored slots', () => {
    expect(cafe.characterSwitch).toBe(true)
    const yonghePortal = Object.values(mainlineScenes).flatMap(scene => scene.storefronts).find(storefront => storefront.portalId === 'yonghe-street-entry')
    expect(yonghePortal).toBeDefined()
    expect(yonghePortal?.characterSwitch).not.toBe(true)
    for (const metrics of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const projected = mainlineCanonicalSceneGeometryUnits(street, metrics)
      const baselineUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[cafe.id, 'baseline']]))
      const nearUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[cafe.id, 'revealed']]))
      const baseline = baselineUnits.filter(unit => unit.storefrontId === cafe.id && unit.variant === 'baseline')
        .flatMap(unit => unit.visual.cells).filter(cell => cell.kind === 'storefront')
      const near = nearUnits.filter(unit => unit.storefrontId === cafe.id && unit.variant === 'near')
        .flatMap(unit => unit.visual.cells).filter(cell => cell.kind === 'storefront')
      const animatedCells = storefrontCharacterCells(street, cafe, projected)
      expect(animatedCells.map(cell => cell.baselineGlyph).join('')).toBe(cafe.label)
      expect(animatedCells).toHaveLength(Array.from(cafe.label).length)
      expect(animatedCells.filter(cell => cell.role === 'door')).toHaveLength(1)
      expect(baseline.map(cell => [cell.x, cell.y])).toEqual(near.map(cell => [cell.x, cell.y]))
      expect(baseline.filter(cell => cell.storefrontRole === 'sign').map(cell => cell.glyph).join('')).toBe(cafe.label)
      expect(near.filter(cell => cell.storefrontRole === 'sign')).toHaveLength(0)
      expect(near.slice(0, 4).map(cell => cell.storefrontRole)).toEqual(['wall', 'door', 'wall', 'wall'])
      expect(near.filter(cell => cell.storefrontRole === 'glass')).toHaveLength(12)
      expect(near[1]?.entityId).toBe(cafe.portalId)
      expect(near[1]?.access).toBe('locked')
      expect(near[1]?.lockedText).toBe(street.passages.find(passage => passage.portalId === cafe.portalId)?.lockedText)
      expect(new Set(near.filter(cell => cell.storefrontRole === 'glass').map(cell => cell.x)).size).toBe(12)
      const revealedUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[cafe.id, 'revealed']]))
      const physical = (units: typeof baselineUnits) => units.filter(unit => unit.navigation.blocked).map(({ id, x, y, width, height, navigation }) => ({ id, x, y, width, height, navigation }))
      expect(physical(revealedUnits)).toEqual(physical(baselineUnits))
      expect(projected.some(unit => unit.navigation.passageId === cafe.portalId)).toBe(true)
    }
  })

  it('projects every label length onto one unique compiled door', () => {
    const fourCharacter = { ...cafe, id: cafe.id, label: '春日茶饮' }
    for (const storefront of street.storefronts) {
      let projected = mainlineCanonicalSceneGeometryUnits(street, { width: 1280, height: 720 })
      if (storefront === fourCharacter) {
        const signUnitIndex = projected.findIndex(unit => unit.storefrontId === storefront.id && unit.variant === 'baseline'
          && unit.visual.cells.some(cell => cell.storefrontRole === 'sign'))
        const signUnit = projected[signUnitIndex]!
        const firstSign = signUnit.visual.cells.find(cell => cell.storefrontRole === 'sign')!
        const center = (firstSign.cellStart! + firstSign.cellEnd!) / 2
        const addedSign = { ...firstSign, id: `${firstSign.id}-fourth-test-slot`, x: center, cellStart: center - .1, cellEnd: center + .1 }
        projected = projected.map((unit, index) => index === signUnitIndex
          ? { ...unit, visual: { ...unit.visual, cells: [...unit.visual.cells, addedSign] } }
          : unit)
      }
      const cells = storefrontCharacterCells(street, storefront, projected)
      if (storefront.composition?.fixedCellCount) {
        expect(cells.map(cell => cell.baselineGlyph).join('')).toBe(storefront.label)
        expect(cells).toHaveLength(Array.from(storefront.label).length)
        expect(cells.filter(cell => cell.role === 'door')).toHaveLength(1)
        expect(cells.filter(cell => cell.entityId === storefront.portalId)).toHaveLength(1)
        const signs = projected.filter(unit => unit.storefrontId === storefront.id && unit.variant === 'baseline')
          .flatMap(unit => unit.visual.cells).filter(cell => cell.storefrontRole === 'sign')
        expect(signs.map(cell => cell.glyph).join('')).toBe(storefront.label)
      }
      expect(cells.map(cell => cell.baselineGlyph).join('')).toBe(storefront.label)
      expect(cells).toHaveLength(Array.from(storefront.label).length)
      expect(cells.filter(cell => cell.role === 'door')).toHaveLength(1)
      expect(cells.filter(cell => cell.entityId === storefront.portalId)).toHaveLength(1)
      const realDoor = projected.flatMap(unit => unit.visual.cells.map(cell => ({ unit, cell })))
        .find(({ unit, cell }) => unit.storefrontId === storefront.id && (
          storefront.composition?.fixedCellCount
            ? unit.variant === 'near' && cell.storefrontRole === 'door' && cell.entityId === storefront.portalId
            : cell.kind === 'door' && cell.entityId === storefront.portalId
        ))
      expect(realDoor, storefront.id).toBeDefined()
      const doorCharacter = cells.find(cell => cell.role === 'door')!
      expect(doorCharacter.x).toBeCloseTo(realDoor!.cell.x)
      expect(doorCharacter.y).toBeCloseTo(realDoor!.cell.y)
      expect(doorCharacter.access).toBe('locked')
      expect(doorCharacter.lockedText).toBe(street.passages.find(passage => passage.portalId === storefront.portalId)?.lockedText)
    }
  })

  it('keeps all storefront labels, entry frames and glazing on fixed four-slot grids', () => {
    expect(street.storefronts).toHaveLength(14)
    for (const storefront of street.storefronts) {
      const wide = storefront.end - storefront.start >= 30
      const count = wide ? 17 : 7
      expect(storefront.composition?.fixedCellCount).toBe(count)
      expect(storefront.composition?.baseline).toHaveLength(count)
      expect(storefront.composition?.near).toHaveLength(count)
      expect(storefront.composition?.baseline?.filter(role => role === 'sign')).toHaveLength(Array.from(storefront.label).length)
      const signZone = storefront.composition?.baseline?.slice(wide ? 0 : 1, wide ? 4 : 5)
      expect(signZone?.filter(role => role === 'wall')).toHaveLength(4 - Array.from(storefront.label).length)
      expect(storefront.composition?.near?.filter(role => role === 'door')).toHaveLength(1)
      if (wide) {
        expect(storefront.composition?.baseline?.at(-1)).toBe('wall')
        expect(storefront.composition?.near?.at(-1)).toBe('wall')
      } else {
        expect(storefront.composition?.baseline?.[0]).toBe('wall')
        expect(storefront.composition?.near?.[0]).toBe('wall')
      }
    }

    const storefront = street.storefronts.find(slot => slot.id === 'commercial-south-slot-2')!
    const cafe = street.storefronts.find(slot => slot.id === 'commercial-cafe-slot')!
    expect(storefront.start).toBe(36)
    expect(storefront.end).toBe(76)
    expect(storefront.composition?.fixedCellCount).toBe(17)
    expect(storefront.composition?.baseline?.slice(0, 4)).toEqual(['sign', 'sign', 'wall', 'wall'])
    expect(storefront.composition?.near?.slice(0, 4)).toEqual(['wall', 'door', 'wall', 'wall'])
    expect(cafe.composition?.baseline?.slice(0, 4)).toEqual(['sign', 'sign', 'sign', 'wall'])
    expect(cafe.composition?.near?.slice(0, 4)).toEqual(['wall', 'door', 'wall', 'wall'])

    for (const metrics of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      for (const slot of [storefront, cafe, street.storefronts.find(candidate => candidate.id === 'commercial-north-slot-2')!]) {
        const canonical = mainlineCanonicalSceneGeometryUnits(street, metrics)
        const baselineUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[slot.id, 'baseline']]))
        const nearUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[slot.id, 'revealed']]))
        const baseline = baselineUnits.filter(unit => unit.storefrontId === slot.id && unit.variant === 'baseline')
          .flatMap(unit => unit.visual.cells).filter(cell => cell.kind === 'storefront')
        const near = nearUnits.filter(unit => unit.storefrontId === slot.id && unit.variant === 'near')
          .flatMap(unit => unit.visual.cells).filter(cell => cell.kind === 'storefront')
      const animatedCells = storefrontCharacterCells(street, slot, canonical)
      expect(animatedCells.map(cell => cell.baselineGlyph).join('')).toBe(slot.label)
      expect(animatedCells).toHaveLength(Array.from(slot.label).length)
      expect(animatedCells.filter(cell => cell.role === 'door')).toHaveLength(1)
        expect(baseline).toHaveLength(slot.composition?.fixedCellCount)
        expect(near).toHaveLength(slot.composition?.fixedCellCount)
        expect(baseline.map(cell => cell.x)).toEqual(near.map(cell => cell.x))
        expect(baseline.map(cell => cell.y)).toEqual(near.map(cell => cell.y))
        expect(baseline.filter(cell => cell.storefrontRole === 'sign').map(cell => cell.glyph).join('')).toBe(slot.label)
        if (slot.id === 'commercial-south-slot-2' || slot.id === 'commercial-cafe-slot') {
          expect(near.filter(cell => cell.storefrontRole === 'sign')).toHaveLength(0)
          expect(baseline.filter(cell => cell.storefrontRole === 'glass')).toHaveLength(12)
          expect(near.filter(cell => cell.storefrontRole === 'glass')).toHaveLength(12)
          expect(near.slice(0, 4).map(cell => cell.storefrontRole)).toEqual(['wall', 'door', 'wall', 'wall'])
          expect(near[1]?.entityId).toBe(slot.portalId)
          expect(near[1]?.access).toBe('locked')
          expect(near[1]?.lockedText).toBe(street.passages.find(passage => passage.portalId === slot.portalId)?.lockedText)
        } else {
          expect(baseline.filter(cell => cell.storefrontRole === 'glass')).toHaveLength(2)
          expect(near.filter(cell => cell.storefrontRole === 'glass').map(cell => cell.x)).toEqual(baseline.filter(cell => cell.storefrontRole === 'glass').map(cell => cell.x))
          expect(near.slice(1, 5).map(cell => cell.storefrontRole)).toEqual(['wall', 'door', 'wall', 'wall'])
        }
        const approach = mainlineStorefrontApproach(street, slot, metrics)
        const entry = near.find(cell => cell.storefrontRole === 'door')!
        expect(approach.x).toBeCloseTo(entry.x)
        const blockers = (units: typeof baselineUnits) => units.filter(unit => unit.navigation.blocked).map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))
        expect(blockers(nearUnits)).toEqual(blockers(baselineUnits))
      }
    }
  })

  it('keeps four authored sign slots separate from glass on the standard storefront row', () => {
    const metrics = { width: 1180, height: 844, viewportWidth: 1180 }
    const projected = mainlineCanonicalSceneGeometryUnits(street, metrics)
    for (const storefront of street.storefronts.filter(slot => slot.end - slot.start < 30)) {
      const cells = projected.filter(unit => unit.storefrontId === storefront.id && unit.variant === 'baseline')
        .flatMap(unit => unit.visual.cells).filter(cell => cell.kind === 'storefront')
      expect(cells).toHaveLength(7)
      expect(cells.slice(1, 5).filter(cell => cell.storefrontRole === 'sign').map(cell => cell.glyph).join('')).toBe(storefront.label)
      expect(cells.slice(1, 5).filter(cell => cell.storefrontRole === 'wall')).toHaveLength(4 - Array.from(storefront.label).length)
      expect(cells[0]?.storefrontRole).toBe('wall')
      expect(cells.slice(5).map(cell => cell.glyph).join('')).toBe('\u73bb\u7483')
      expect(cells.slice(5).every(cell => cell.storefrontRole === 'glass')).toBe(true)
      expect(storefrontCharacterCells(street, storefront, projected).map(cell => cell.baselineGlyph).join('')).toBe(storefront.label)
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

  it('switches the wide shop 4-slot sign to the entrance frame while leaving its glass row intact', () => {
    const nearUnits = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, cafe))
      .filter((unit) => unit.storefrontId === cafe.id)
    const roles = nearUnits.flatMap((unit) => unit.visual.cells.map((cell) => cell.storefrontRole))

    expect(nearUnits.some((unit) => unit.variant === 'near' && unit.visual.cells.some((cell) => cell.storefrontRole === 'sign'))).toBe(false)
    expect(roles.filter(role => role === 'glass')).toHaveLength(12)
    expect(roles.slice(0, 4)).toEqual(['wall', 'door', 'wall', 'wall'])
  })

  it('limits near emphasis on fixed storefront grids to the entrance cell', () => {
    for (const storefront of street.storefronts.filter(slot => slot.composition?.fixedCellCount)) {
      const near = storefront.composition!.near!
      const states = near.map(role => storefrontCellVisualState(storefront, 'near', role))
      expect(states).toHaveLength(storefront.composition!.fixedCellCount)
      expect(states.filter(state => state === 'near')).toHaveLength(1)
      expect(states[near.indexOf('door')]).toBe('near')
      expect(states.filter((_, index) => near[index] === 'glass')).toEqual(Array(near.filter(role => role === 'glass').length).fill('baseline'))
    }
  })

  it('preserves a sign owner when narrow projection provides fewer cells than label characters', () => {
    const clothing = street.storefronts.find((storefront) => storefront.id === 'commercial-north-slot-2')!
    const projected = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, { width: 390, height: 844 }, new Map([[clothing.id, 'baseline']]))
    const cells = projected.filter((unit) => unit.storefrontId === clothing.id).flatMap((unit) => unit.visual.cells)

    expect(cells.some((cell) => cell.storefrontRole === 'sign')).toBe(true)
  })

  it('keeps storefront glass in complete pairs and uses stable wall caps at odd ends', () => {
    for (const metrics of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      const projected = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics)
      const rowStorefronts = street.storefronts.filter((storefront) => (storefront.edge === 'top' || storefront.edge === 'bottom') && storefront.end - storefront.start < 30)
      for (const storefront of rowStorefronts) {
        const cells = projected
          .filter((unit) => unit.storefrontId === storefront.id && unit.variant === 'baseline')
          .flatMap((unit) => unit.visual.cells)
          .sort((first, second) => (first.cellStart ?? first.x) - (second.cellStart ?? second.x))
        const signIndexes = cells.flatMap((cell, index) => cell.storefrontRole === 'sign' ? [index] : [])
        if (signIndexes.length < Array.from(storefront.label).length || cells.length < signIndexes.length + 2) continue

        const firstSign = signIndexes[0]
        const lastSign = signIndexes.at(-1)!
        expect(cells[0].storefrontRole, `${storefront.id} leading wall cap`).toBe('wall')
        expect(cells.at(-1)?.storefrontRole, `${storefront.id} trailing glass`).toBe('glass')
        const glass = cells.filter(cell => cell.storefrontRole === 'glass')
        expect(glass.length % 2, `${storefront.id} glass count`).toBe(0)
        expect(glass.map(cell => cell.glyph).join('').match(/.{2}/g)?.every(pair => pair === '\u73bb\u7483')).toBe(true)
        expect(cells.slice(firstSign, lastSign + 1).map((cell) => cell.glyph).join('')).toBe(storefront.label)
        expect(cells.slice(firstSign, lastSign + 1).every((cell) => cell.storefrontRole === 'sign')).toBe(true)
      }
    }
  })

  it('renders complete far labels and only the fixed 4-slot near entrance changes before restoring', () => {
    for (const storefront of street.storefronts) {
      const wide = storefront.end - storefront.start >= 30
      const count = wide ? 17 : 7
      const farUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, { width: 1280, height: 720 }, new Map([[storefront.id, 'baseline']]))
      const nearUnits = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, storefront), { width: 1280, height: 720 }, new Map([[storefront.id, 'revealed']]))
      const leaveUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, { width: 1280, height: 720 }, new Map([[storefront.id, 'baseline']]))
      const farUnitsForStore = farUnits.filter(unit => unit.storefrontId === storefront.id && unit.variant === 'baseline')
      const nearUnitsForStore = nearUnits.filter(unit => unit.storefrontId === storefront.id && unit.variant === 'near')
      const farFacade = farUnitsForStore.flatMap(unit => unit.visual.cells).filter(cell => cell.kind === 'storefront')
      const nearFacade = nearUnitsForStore.flatMap(unit => unit.visual.cells).filter(cell => cell.kind === 'storefront')
      const door = nearFacade.filter(cell => cell.storefrontRole === 'door')

      expect(farFacade).toHaveLength(count)
      expect(nearFacade).toHaveLength(count)
      expect(farFacade.map(cell => [cell.x, cell.y])).toEqual(nearFacade.map(cell => [cell.x, cell.y]))
      expect(farFacade.filter(cell => cell.storefrontRole === 'sign').map(cell => cell.glyph).join('')).toBe(storefront.label)
      expect(door).toHaveLength(1)
      expect(door[0].entityId).toBe(storefront.portalId)
      expect(door[0].access).toBe('locked')
      expect(door[0].lockedText).toBe(street.passages.find(passage => passage.portalId === storefront.portalId)?.lockedText)
      expect(nearUnitsForStore).toHaveLength(count)
      expect(leaveUnits.filter(unit => unit.storefrontId === storefront.id && unit.variant === 'baseline')).toEqual(farUnitsForStore)
      if (wide) {
        expect(nearFacade.filter(cell => cell.storefrontRole === 'sign')).toHaveLength(0)
        expect(nearFacade.slice(0, 4).map(cell => cell.storefrontRole)).toEqual(['wall', 'door', 'wall', 'wall'])
        expect(nearFacade.filter(cell => cell.storefrontRole === 'glass')).toHaveLength(12)
      } else {
        expect(nearFacade.filter(cell => cell.storefrontRole === 'glass').map(cell => cell.x))
          .toEqual(farFacade.filter(cell => cell.storefrontRole === 'glass').map(cell => cell.x))
        expect(nearFacade.slice(1, 5).map(cell => cell.storefrontRole)).toEqual(['wall', 'door', 'wall', 'wall'])
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
