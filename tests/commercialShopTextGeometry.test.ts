import { describe, expect, it } from 'vitest'
import { commercialCafeFloorServiceTarget } from '../src/center/runtime/commercialCafeBehavior'
import { resolveCommercialCafeFloorServiceIntent } from '../src/center/runtime/commercialCafeStory'
import { commercialStreetMilkTeaContinuousLayout } from '../src/center/runtime/commercialStreetMilkTeaInterior'
import { mainlineLabelFootprint } from '../src/center/runtime/sceneLayout'
import { compileMainlineSceneSource, mainlineSceneGeometryUnits, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialStreetContinuousWorldSourceBlueprint } from '../src/center/runtime/mainlineSceneModel'
import { defaultSceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'

describe('commercial shop text geometry', () => {
  const interiorSource = compileMainlineSceneSource(commercialStreetContinuousWorldSourceBlueprint)

  it('renders Milk Tea wall glyphs and complete counter words along both L runs', () => {
    const street = interiorSource
    const cells = mainlineSceneGeometryUnits(street, { x: 111, y: 90 }).flatMap((unit) => unit.visual.cells.map((cell) => ({ ownerId: unit.ownerId, cell })))
    const milkTeaWalls = cells.filter(({ ownerId, cell }) => ownerId.startsWith('milk-tea-') && cell.glyph === '墙')
    expect(milkTeaWalls.length).toBeGreaterThan(20)

    const run = street.objects.find(({ id }) => id === 'milk-tea-counter-word-run')!
    const turn = street.objects.find(({ id }) => id === 'milk-tea-counter-word-return')!
    expect(run.label).toBe('柜台'.repeat(5))
    expect(turn.label).toBe('柜台'.repeat(3))
    expect(turn.position.x).toBeGreaterThan(commercialStreetMilkTeaContinuousLayout.counter.return.x)
    expect(run.position.y).toBeGreaterThan(commercialStreetMilkTeaContinuousLayout.counter.run.y)
    expect(street.objects.some(({ id }) => id === 'milk-tea-counter-return-label-a' || id === 'milk-tea-counter-return-label-b')).toBe(false)
  })

  it('keeps all Milk Tea table and chair collision boxes in the customer-front area', () => {
    const street = interiorSource
    const front = commercialStreetMilkTeaContinuousLayout.front
    const rearTop = commercialStreetMilkTeaContinuousLayout.rearDivider.y
    const furniture = street.objects.filter(({ groupId }) => groupId === 'milk-tea-continuous-table')
    expect(furniture).toHaveLength(3)
    for (const entity of furniture) {
      const collision = entity.collision!
      expect(collision.x).toBeGreaterThanOrEqual(front.x)
      expect(collision.x + collision.width).toBeLessThanOrEqual(front.x + front.width)
      expect(collision.y).toBeGreaterThanOrEqual(front.y)
      expect(collision.y + collision.height).toBeLessThan(rearTop)
    }
  })

  it('keeps Cafe wall glyphs around actual openings and places the blackboard below the curved window', () => {
    const scene = interiorSource
    const units = mainlineSceneGeometryUnits(scene, { x: 166, y: 2 })
    const window = scene.curves.find(({ id }) => id === 'commercial-cafe-glass-front')!
    const topWallGlyphs = units.filter((unit) => unit.id.startsWith('commercial-cafe-room-top'))
      .flatMap((unit) => unit.visual.cells).filter((cell) => cell.kind === 'wall' && cell.glyph === '墙')
    const otherCafeWallGlyphs = units.filter((unit) => /commercial-cafe-room-(bottom|left)/.test(unit.id))
      .flatMap((unit) => unit.visual.cells).filter((cell) => cell.kind === 'wall' && cell.glyph === '墙')
    const blackboardCells = units.flatMap((unit) => unit.visual.cells)
      .filter((cell) => cell.featureId === 'commercial-cafe-blackboard-feature' && cell.glyph)

    expect(blackboardCells.map((cell) => cell.glyph)).toEqual(['黑', '板'])
    expect(topWallGlyphs.length).toBeGreaterThan(8)
    expect(otherCafeWallGlyphs.length).toBeGreaterThan(24)
    expect(topWallGlyphs.every((cell) => cell.x < window.start.x - .5 || cell.x > window.end.x + .5)).toBe(true)
    expect(Math.min(...blackboardCells.map((cell) => cell.y))).toBeGreaterThan(window.start.y)
    expect(window.blocksPlayer).toBe(true)
  })

  it('routes the Cafe floor server to the middle table from its aisle and clears both chairs', () => {
    const scene = interiorSource
    const table = scene.objects.find(({ id }) => id === 'commercial-cafe-right-inner-middle-group-table')!
    const snapshot = createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition, {}, defaultSceneScreenMetrics)
    const servicePoint = scene.npcBehaviorTargets.find(({ id }) => id === 'commercial-cafe-floor-service-staging')!.position
    const intent = resolveCommercialCafeFloorServiceIntent(scene, 0)!
    expect(intent.targetId).toBe(table.id)
    const contact = commercialCafeFloorServiceTarget(scene, servicePoint, intent, {}, { actorId: 'cafe-floor-server', screenMetrics: defaultSceneScreenMetrics })
    expect(contact, 'missing service path for Cafe middle table').not.toBeNull()
    const actorLabel = mainlineLabelFootprint(String.fromCharCode(0x5e97, 0x5458), contact!, defaultSceneScreenMetrics, { lineHeight: 1 })
    for (const entityId of [table.id, table.id.replace('-table', '-chair-top'), table.id.replace('-table', '-chair-bottom')]) {
      const tableLabel = snapshot.objects.get(entityId)!.visualBounds!
      const overlapX = Math.min(actorLabel.x + actorLabel.width, tableLabel.x + tableLabel.width) - Math.max(actorLabel.x, tableLabel.x)
      const overlapY = Math.min(actorLabel.y + actorLabel.height, tableLabel.y + tableLabel.height) - Math.max(actorLabel.y, tableLabel.y)
      expect(overlapX <= 0 || overlapY <= 0, entityId + ' overlaps the service text').toBe(true)
    }
  })
})
