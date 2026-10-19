import { describe, expect, it } from 'vitest'
import { boundaryGridStepsFromScreenSpacing } from '../src/center/runtime/sceneBoundaryGrid'
import { isMainlineStorefrontNear, isMainlineStorefrontPresentationInRange, mainlineCanonicalSceneGeometryUnits, mainlineSceneGeometryUnits, mainlineScenePassageCollision, mainlineScenes, mainlineStorefrontAnchor, mainlineStorefrontApproach, mainlineStorefrontDepartureRadius } from '../src/center/runtime/mainlineScenes'
import {
  nextStorefrontPresentationPhase,
  storefrontRollDirection,
  storefrontLingerDurationMs,
  storefrontRestoreDelayMs,
  storefrontLabelRollDurationMs,
  storefrontPresentationLabelSlots,
  storefrontCharacterCells,
  storefrontGeometryCellShouldRender,
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
  it('keeps the approved 14-shop order, grid spans, and locked storefront doors', () => {
    expect(street.storefronts.map(({ id }) => id)).toEqual([
      'commercial-north-slot-1', 'commercial-north-slot-2', 'commercial-north-slot-3',
      'commercial-north-slot-4', 'commercial-north-slot-5', 'commercial-north-slot-6', 'commercial-cafe-slot',
      'commercial-south-slot-1', 'commercial-south-slot-2', 'commercial-south-slot-4',
      'commercial-south-slot-5', 'commercial-south-slot-6', 'commercial-south-slot-7', 'commercial-south-slot-8',
    ])
    expect(street.storefronts).toHaveLength(14)
    expect(street.storefronts.map(storefront => storefront.label)).toEqual([
      '\u679c\u8336\u5e97', '\u6587\u521b\u5e97', '\u7f8e\u5986\u5e97', '\u773c\u955c\u5e97', '\u73a9\u5177\u5e97', '\u9999\u6c1b\u5e97', '\u5496\u5561\u9986',
      '\u6f6e\u724c\u5e97', '\u5feb\u9910\u5e97', '\u670d\u88c5\u5e97', '\u5976\u8336\u5e97', '\u751c\u54c1\u5e97', '\u73e0\u5b9d\u5e97', '\u670d\u88c5\u5e97',
    ])
    expect(street.storefronts.every(storefront => Array.from(storefront.label).length === 3)).toBe(true)
    const pitch = boundaryGridStepsFromScreenSpacing().horizontal
    for (const side of ['top', 'bottom'] as const) {
      const row = street.storefronts.filter(storefront => storefront.edge === side)
      for (let index = 0; index < row.length; index += 1) {
        const storefront = row[index]!
        const wide = storefront.id === 'commercial-cafe-slot' || storefront.id === 'commercial-south-slot-2'
        expect(storefront.end - storefront.start).toBeCloseTo(storefront.composition!.fixedCellCount! * pitch)
        if (index > 0) expect(storefront.start - row[index - 1]!.end).toBeCloseTo(pitch)
      }
    }
    expect(street.storefronts.find(storefront => storefront.id === 'commercial-cafe-slot')?.label).toBe('咖啡馆')
    expect(street.storefronts.find(storefront => storefront.id === 'commercial-south-slot-2')?.label).toBe('快餐店')
    expect(street.storefronts.every((storefront) => storefront.portalId && storefront.characterSwitch)).toBe(true)
    expect(street.passages).toHaveLength(14)
    expect(street.passages.every((passage) => passage.access === 'locked' && !passage.targetSceneId)).toBe(true)
    expect(street.passages.find((passage) => passage.id === 'street-cafe-entry')?.targetSceneId).toBeUndefined()
  })

  it('derives equal row and east boundary spans from the authored storefront grid', () => {
    const pitch = boundaryGridStepsFromScreenSpacing().horizontal
    const rows = (['top', 'bottom'] as const).map(edge => street.storefronts.filter(storefront => storefront.edge === edge))
    const rowCellCounts = rows.map(row => row.reduce((cells, storefront) => (
      cells + storefront.composition!.fixedCellCount!
    ), 0) + Math.max(0, row.length - 1))
    expect(rowCellCounts).toEqual([95, 95])
    expect(rows[0]![0]!.start).toBe(rows[1]![0]!.start)
    const lastStorefrontEnd = Math.max(...street.storefronts.map(storefront => storefront.end))
    expect(Math.max(rows[0]!.at(-1)!.end, rows[1]!.at(-1)!.end)).toBeCloseTo(lastStorefrontEnd)

    const facadeRight = street.structures.find(structure => structure.id === 'commercial-north-facade')!.bounds!.x
      + street.structures.find(structure => structure.id === 'commercial-north-facade')!.bounds!.width
    const lane = street.structures.find(structure => structure.id === 'commercial-main-lane')!.bounds!
    const walkRight = street.walkBounds.x + street.walkBounds.width
    const northAirWallRight = street.airWalls!.find(airWall => airWall.id === 'commercial-north-facade-air-wall')!.x
      + street.airWalls!.find(airWall => airWall.id === 'commercial-north-facade-air-wall')!.width
    expect(facadeRight - lastStorefrontEnd).toBeCloseTo(1.5 * pitch)
    expect(lane.x + lane.width).toBeCloseTo(facadeRight - 4)
    expect(walkRight).toBeGreaterThan(facadeRight)
    expect(northAirWallRight).toBeCloseTo(walkRight)

    const phases = new Map(street.storefronts.map(storefront => [storefront.id, 'baseline' as const]))
    const facadeCells = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, { width: 2048, height: 788 }, phases)
    for (const edge of ['top', 'bottom'] as const) {
      const row = street.storefronts.filter(storefront => storefront.edge === edge)
      const facadeId = edge === 'top' ? 'commercial-south-facade' : 'commercial-north-facade'
      const walls = facadeCells
        .filter(unit => unit.sourceWallId === facadeId && unit.edge === edge)
        .flatMap(unit => unit.visual.cells)
        .filter(cell => cell.glyph === '墙')
        .sort((first, second) => first.x - second.x)
      const uniqueWalls = [...new Map(walls.map(cell => [cell.x, cell])).values()]
      expect(uniqueWalls.slice(0, 3).map(cell => cell.storefrontId)).toEqual([undefined, undefined, row[0]!.id])
      expect(uniqueWalls.slice(0, 3).map(cell => cell.storefrontRole)).toEqual([undefined, undefined, 'wall'])
      expect(uniqueWalls.slice(-3).map(cell => cell.storefrontId)).toEqual([row.at(-1)!.id, undefined, undefined])
      expect(uniqueWalls.slice(-3).map(cell => cell.storefrontRole)).toEqual(['wall', undefined, undefined])
      expect(uniqueWalls[1]!.x - uniqueWalls[0]!.x).toBeCloseTo(pitch)
      expect(uniqueWalls[2]!.x - uniqueWalls[1]!.x).toBeCloseTo(pitch)
      expect(uniqueWalls.at(-1)!.x - uniqueWalls.at(-2)!.x).toBeCloseTo(pitch)
    }
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
      expect(near.slice(0, 5).map(cell => cell.storefrontRole)).toEqual(['wall', 'wall', 'door', 'wall', 'wall'])
      expect(near.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window'))).toHaveLength(14)
      expect(near[2]?.entityId).toBe(cafe.portalId)
      expect(near[2]?.access).toBe('locked')
      expect(near[2]?.lockedText).toBe(street.passages.find(passage => passage.portalId === cafe.portalId)?.lockedText)
      expect(new Set(near.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window')).map(cell => cell.x)).size).toBe(14)
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

  it('gives each two-, three-, and four-glyph label one animated owner without dropping facade glass', () => {
    const metrics = { width: 1280, height: 720 }
    const original = mainlineCanonicalSceneGeometryUnits(street, metrics)
    for (const label of ['茶饮', '咖啡馆', '书香茶饮']) {
      const slot = { ...cafe, label }
      let projected = original
      if (Array.from(label).length === 4) {
        const index = projected.findIndex(unit => unit.storefrontId === slot.id && unit.variant === 'baseline'
          && unit.visual.cells.some(cell => cell.storefrontRole === 'sign'))
        const unit = projected[index]!
        const sign = unit.visual.cells.find(cell => cell.storefrontRole === 'sign')!
        const center = (sign.cellStart! + sign.cellEnd!) / 2
        const extra = { ...sign, id: `${sign.id}-fourth-qa`, x: center + .25, cellStart: center + .15, cellEnd: center + .35 }
        projected = projected.map((candidate, unitIndex) => unitIndex === index
          ? { ...candidate, visual: { ...candidate.visual, cells: [...candidate.visual.cells, extra] } }
          : candidate)
      }

      const overlay = storefrontCharacterCells(street, slot, projected)
      expect(overlay.map(cell => cell.baselineGlyph).join('')).toBe(label)
      expect(new Set(overlay.map(cell => cell.id)).size).toBe(overlay.length)
      expect(new Set(overlay.map(cell => `${cell.x},${cell.y}`)).size).toBe(overlay.length)
      expect(overlay.filter(cell => cell.role === 'door')).toHaveLength(1)

      const ownedUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[slot.id, 'baseline']]))
        .filter(unit => unit.storefrontId === slot.id)
      const visibleGeometry = ownedUnits.flatMap(unit => unit.visual.cells
        .filter(cell => storefrontGeometryCellShouldRender(slot, unit, cell, overlay))
        .map(cell => ({ unit, cell })))
      expect(visibleGeometry.filter(({ cell }) => cell.kind === 'storefront' && cell.storefrontRole === 'sign')).toHaveLength(0)
      expect(visibleGeometry.filter(({ cell }) => cell.kind === 'storefront' && (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window'))).toHaveLength(14)
      expect(visibleGeometry.some(({ unit }) => unit.id.startsWith(`${slot.id}-base-`))).toBe(false)
      expect(overlay.every(animated => !visibleGeometry.some(({ cell }) => cell.x === animated.x && cell.y === animated.y))).toBe(true)

      const nearUnits = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[slot.id, 'revealed']]))
        .filter(unit => unit.storefrontId === slot.id)
      expect(new Set(nearUnits.map(unit => unit.variant).filter(Boolean)).size).toBe(1)
      const nearCells = nearUnits.flatMap(unit => unit.visual.cells.filter(cell => storefrontGeometryCellShouldRender(slot, unit, cell, overlay)))
      expect(new Set(nearCells.map(cell => `${cell.x},${cell.y}`)).size).toBe(nearCells.length)
      expect(nearCells.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window'))).toHaveLength(14)
    }

    const second = street.storefronts.find(slot => slot.id === 'commercial-north-slot-2')!
    const activeSlots = new Map([[cafe.id, cafe], [second.id, second]])
    const activeOverlay = new Map([[cafe.id, storefrontCharacterCells(street, cafe, original)], [second.id, storefrontCharacterCells(street, second, original)]])
    const activeVisibleGeometry = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics, new Map([[cafe.id, 'revealed'], [second.id, 'baseline']]))
      .filter(unit => activeSlots.has(unit.storefrontId ?? ''))
      .flatMap(unit => unit.visual.cells.filter(cell => {
        const owner = activeSlots.get(unit.storefrontId ?? '')!
        return storefrontGeometryCellShouldRender(owner, unit, cell, activeOverlay.get(owner.id))
      }).map(cell => `${unit.storefrontId}:${cell.x},${cell.y}`))
    const activeAnimatedGeometry = [...storefrontCharacterCells(street, cafe, original), ...storefrontCharacterCells(street, second, original)]
      .map(cell => `${cell.id.split('-character-')[0]}:${cell.id}`)
    expect(new Set(activeVisibleGeometry).size).toBe(activeVisibleGeometry.length)
    expect(new Set(activeVisibleGeometry.map(entry => entry.split(':')[0])).size).toBe(2)
    expect(new Set(activeAnimatedGeometry).size).toBe(activeAnimatedGeometry.length)
  })

  it('uses exact name-width sign slots and changes only those slots into the entrance', () => {
    expect(street.storefronts).toHaveLength(14)
    for (const storefront of street.storefronts) {
      const wide = storefront.id === 'commercial-cafe-slot' || storefront.id === 'commercial-south-slot-2'
      const signCount = Array.from(storefront.label).length
      const count = wide ? signCount + 20 : signCount + 8
      expect(storefront.composition?.fixedCellCount).toBe(count)
      expect(storefront.composition?.baseline).toHaveLength(count)
      expect(storefront.composition?.near).toHaveLength(count)
      const signZone = Array.from({ length: signCount }, () => 'sign' as const)
      const nearSignZone = signZone.map((_, index) => index === Math.floor(signCount / 2) ? 'door' as const : 'wall' as const)
      const baseline = storefront.composition!.baseline
      const near = storefront.composition!.near!
      expect(baseline.filter(role => role === 'sign')).toHaveLength(signCount)
      expect(baseline.slice(wide ? 1 : 4, (wide ? 1 : 4) + signCount)).toEqual(signZone)
      expect(near.filter(role => role === 'door')).toHaveLength(1)
      if (wide) {
        const moduleB = ['wall', 'window', 'window', 'window', 'window', 'window', 'window', 'window', 'window', 'window', 'wall'] as const
        const moduleA = ['wall', ...signZone, 'wall', 'window', 'window', 'window', 'window', 'window', 'wall']
        const nearModuleA = ['wall', ...nearSignZone, 'wall', 'window', 'window', 'window', 'window', 'window', 'wall']
        expect(baseline).toEqual([...moduleA, 'wall', ...moduleB])
        expect(near).toEqual([...nearModuleA, 'wall', ...moduleB])
        expect(baseline).toHaveLength(23)
        expect(near.filter(role => role === 'door')).toHaveLength(1)
        expect(near[1 + Math.floor(signCount / 2)]).toBe('door')
        expect(near.slice(12)).toEqual(moduleB)
      } else {
        expect(baseline).toEqual(['wall', 'window', 'window', 'wall', ...signZone, 'wall', 'window', 'window', 'wall'])
        expect(near).toEqual(['wall', 'window', 'window', 'wall', ...nearSignZone, 'wall', 'window', 'window', 'wall'])
      }
    }

    const storefront = street.storefronts.find(slot => slot.id === 'commercial-south-slot-2')!
    const cafe = street.storefronts.find(slot => slot.id === 'commercial-cafe-slot')!
    expect(storefront.end - storefront.start).toBeCloseTo(storefront.composition!.fixedCellCount! * boundaryGridStepsFromScreenSpacing().horizontal)
    expect(storefront.composition?.baseline?.slice(0, 5)).toEqual(['wall', 'sign', 'sign', 'sign', 'wall'])
    expect(storefront.composition?.baseline?.slice(0, 11)).toEqual(['wall', 'sign', 'sign', 'sign', 'wall', 'window', 'window', 'window', 'window', 'window', 'wall'])
    expect(storefront.composition?.near?.slice(0, 4)).toEqual(['wall', 'wall', 'door', 'wall'])
    expect(cafe.composition?.baseline?.slice(0, 11)).toEqual(['wall', 'sign', 'sign', 'sign', 'wall', 'window', 'window', 'window', 'window', 'window', 'wall'])
    expect(cafe.composition?.near?.slice(0, 4)).toEqual(['wall', 'wall', 'door', 'wall'])

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
          expect(baseline.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window'))).toHaveLength(14)
          expect(near.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window'))).toHaveLength(14)
          const doorIndex = 2
          expect(near.filter(cell => cell.storefrontRole === 'door')).toHaveLength(1)
          expect(near[doorIndex]?.entityId).toBe(slot.portalId)
          expect(near[doorIndex]?.access).toBe('locked')
          expect(near[doorIndex]?.lockedText).toBe(street.passages.find(passage => passage.portalId === slot.portalId)?.lockedText)
        } else {
          expect(baseline.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window'))).toHaveLength(4)
          expect(near.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window')).map(cell => cell.x)).toEqual(baseline.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window')).map(cell => cell.x))
          const signCount = Array.from(slot.label).length
          expect(near.slice(4, 4 + signCount).map(cell => cell.storefrontRole))
            .toEqual(Array.from({ length: signCount }, (_, index) => index === Math.floor(signCount / 2) ? 'door' : 'wall'))
        }
        const approach = mainlineStorefrontApproach(street, slot, metrics)
        const entry = near.find(cell => cell.storefrontRole === 'door')!
        expect(approach.x).toBeCloseTo(entry.x)
        const blockers = (units: typeof baselineUnits) => units.filter(unit => unit.navigation.blocked).map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))
        expect(blockers(nearUnits)).toEqual(blockers(baselineUnits))
      }
    }
  })

  it('keeps exact-width shop names between complete wall and window groups', () => {
    const metrics = { width: 1180, height: 844, viewportWidth: 1180 }
    const projected = mainlineCanonicalSceneGeometryUnits(street, metrics)
    for (const storefront of street.storefronts.filter(slot => slot.id !== 'commercial-cafe-slot' && slot.id !== 'commercial-south-slot-2')) {
      const cells = projected.filter(unit => unit.storefrontId === storefront.id && unit.variant === 'baseline')
        .flatMap(unit => unit.visual.cells).filter(cell => cell.kind === 'storefront')
      expect(cells).toHaveLength(storefront.composition!.fixedCellCount)
      expect(cells.filter(cell => cell.storefrontRole === 'sign').map(cell => cell.glyph).join('')).toBe(storefront.label)
      expect(cells[0]?.storefrontRole).toBe('wall')
      expect(cells.filter(cell => cell.storefrontRole === 'window').map(cell => cell.glyph).join('')).toBe('窗窗窗窗')
      expect(cells.at(-1)?.storefrontRole).toBe('wall')
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

  it('switches only the wide storefront A name slots and preserves B windows', () => {
    const nearUnits = mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, cafe))
      .filter((unit) => unit.storefrontId === cafe.id)
    const roles = nearUnits.flatMap((unit) => unit.visual.cells.map((cell) => cell.storefrontRole))

    expect(nearUnits.some((unit) => unit.variant === 'near' && unit.visual.cells.some((cell) => cell.storefrontRole === 'sign'))).toBe(false)
    expect(roles.filter(role => (role === 'glass' || role === 'window'))).toHaveLength(14)
    expect(roles.slice(0, 5)).toEqual(['wall', 'wall', 'door', 'wall', 'wall'])
  })

  it('limits near emphasis on fixed storefront grids to the entrance cell', () => {
    for (const storefront of street.storefronts.filter(slot => slot.composition?.fixedCellCount)) {
      const near = storefront.composition!.near!
      const states = near.map(role => storefrontCellVisualState(storefront, 'near', role))
      expect(states).toHaveLength(storefront.composition!.fixedCellCount)
      expect(states.filter(state => state === 'near')).toHaveLength(1)
      expect(states[near.indexOf('door')]).toBe('near')
      expect(states.filter((_, index) => near[index] === 'window')).toEqual(Array(near.filter(role => (role === 'glass' || role === 'window')).length).fill('baseline'))
    }
  })

  it('preserves a sign owner when narrow projection provides fewer cells than label characters', () => {
    const clothing = street.storefronts.find((storefront) => storefront.id === 'commercial-north-slot-2')!
    const projected = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, { width: 390, height: 844 }, new Map([[clothing.id, 'baseline']]))
    const cells = projected.filter((unit) => unit.storefrontId === clothing.id).flatMap((unit) => unit.visual.cells)

    expect(cells.some((cell) => cell.storefrontRole === 'sign')).toBe(true)
  })

  it('keeps storefront windows in complete pairs between outer wall caps', () => {
    for (const metrics of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      const projected = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics)
      const rowStorefronts = street.storefronts.filter((storefront) => (
        (storefront.edge === 'top' || storefront.edge === 'bottom')
        && storefront.id !== 'commercial-cafe-slot' && storefront.id !== 'commercial-south-slot-2'
      ))
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
        expect(cells.at(-1)?.storefrontRole, `${storefront.id} trailing wall`).toBe('wall')
        const windows = cells.filter(cell => cell.storefrontRole === 'window')
        expect(windows).toHaveLength(4)
        expect(windows.map(cell => cell.glyph).join('')).toBe('窗窗窗窗')
        expect(cells.slice(firstSign, lastSign + 1).map((cell) => cell.glyph).join('')).toBe(storefront.label)
        expect(cells.slice(firstSign, lastSign + 1).every((cell) => cell.storefrontRole === 'sign')).toBe(true)
      }
    }
  })

  it('renders complete far labels and changes only the name-width entrance slots before restoring', () => {
    for (const storefront of street.storefronts) {
      const wide = storefront.id === 'commercial-cafe-slot' || storefront.id === 'commercial-south-slot-2'
      const count = storefront.composition!.fixedCellCount!
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
        const signCount = Array.from(storefront.label).length
        expect(nearFacade.slice(1, 1 + signCount).map(cell => cell.storefrontRole))
          .toEqual(Array.from({ length: signCount }, (_, index) => index === Math.floor(signCount / 2) ? 'door' : 'wall'))
        expect(nearFacade.slice(12).map(cell => cell.storefrontRole)).toEqual(storefront.composition!.near!.slice(12))
        expect(nearFacade.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window'))).toHaveLength(14)
      } else {
        expect(nearFacade.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window')).map(cell => cell.x))
          .toEqual(farFacade.filter(cell => (cell.storefrontRole === 'glass' || cell.storefrontRole === 'window')).map(cell => cell.x))
        const signCount = Array.from(storefront.label).length
        expect(nearFacade.slice(4, 4 + signCount).map(cell => cell.storefrontRole))
          .toEqual(Array.from({ length: signCount }, (_, index) => index === Math.floor(signCount / 2) ? 'door' : 'wall'))
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

  it('widens the street lane by one shared wall-character cell on each side', () => {
    const cell = boundaryGridStepsFromScreenSpacing().vertical
    const north = street.structures.find((structure) => structure.id === 'commercial-north-facade')!
    const lane = street.structures.find((structure) => structure.id === 'commercial-main-lane')!
    const south = street.structures.find((structure) => structure.id === 'commercial-south-facade')!
    expect(north.bounds!.y + north.bounds!.height).toBeCloseTo(36 - cell)
    expect(lane.bounds!.y).toBeCloseTo(36 - cell)
    expect(lane.bounds!.height).toBeCloseTo(28 + 2 * cell)
    expect(south.bounds!.y).toBeCloseTo(64 + cell)
    const northApproach = mainlineStorefrontApproach(street, street.storefronts[0]!)
    const southApproach = mainlineStorefrontApproach(street, street.storefronts.find((storefront) => storefront.edge === 'top')!)
    expect(Math.abs(southApproach.y - northApproach.y)).toBeGreaterThan(20)
    expect(Math.abs(southApproach.y - northApproach.y)).toBeCloseTo(16 + 2 * cell)
    for (const first of street.storefronts.filter((storefront) => storefront.edge === 'bottom')) {
      const firstApproach = mainlineStorefrontApproach(street, first)
      for (const second of street.storefronts.filter((storefront) => storefront.edge === 'top')) {
        const secondApproach = mainlineStorefrontApproach(street, second)
        expect(Math.hypot(secondApproach.x - firstApproach.x, secondApproach.y - firstApproach.y))
          .toBeGreaterThan((first.nearRadius ?? 10) + (second.nearRadius ?? 10))
      }
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

  it('runs the old restoration and new reveal in parallel and allows an immediate reversal', () => {
    const outgoing = nextStorefrontPresentationPhase('revealed', 'handoff')
    const incoming = nextStorefrontPresentationPhase('baseline', 'approach')
    expect(outgoing).toBe('restoring')
    expect(incoming).toBe('retracting')
    expect(nextStorefrontPresentationPhase(outgoing, 'approach')).toBe('revealing')
    expect(nextStorefrontPresentationPhase(incoming, 'handoff')).toBe('baseline')
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
