import { describe, expect, it } from 'vitest'
import { defaultSceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineEntityTextFootprint, mainlineLabelFootprint } from '../src/center/runtime/sceneLayout'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { canActorReachPassageApproach, classifyMainlineWorldCommand, findMainlinePathToEntity, findMainlinePathToNpc, findMainlineRoomPassageSequence, mainlineInteractionTarget, mainlineNpcInteractionTarget, resolveMainlineEntityInteraction, resolveMainlineNpcInteraction, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'

describe('mainline visual footprint contract', () => {
  it('derives ordinary labels from the same font, orientation, line-height and scale used by the renderer', () => {
    const tree = mainlineScenes['jijia-ancestral-home'].objects.find((entity) => entity.id === 'jijia-old-tree')!
    expect(mainlineEntityTextFootprint(tree, tree.position, defaultSceneScreenMetrics)).toEqual(
      mainlineLabelFootprint(tree.label, tree.position, defaultSceneScreenMetrics, {
        visualScale: tree.visualScale,
        lineHeight: 1.2,
      }),
    )
  })

  it('keeps the approved object focus frames visual-only', () => {
    const tree = mainlineScenes['jijia-ancestral-home'].objects.find((entity) => entity.id === 'jijia-old-tree')!
    const interior = mainlineScenes['jijia-ancestral-interior']
    const burner = interior.objects.find((entity) => entity.id === 'jijia-incense-burner')!
    const plant = mainlineScenes['zhongshuyuan-office'].objects.find((entity) => entity.id === 'zhongshuyuan-office-plant')!

    expect([tree, burner, plant].every((entity) => entity.focusFrame === 'interactive')).toBe(true)
    expect(tree.visualBounds).toEqual({ x: tree.position.x - 4.5, y: tree.position.y - 4.5, width: 9, height: 9 })
    expect(burner.visualBounds).toEqual(burner.collision)
    expect(plant.visualBounds).toEqual({ x: plant.position.x - 1.7, y: plant.position.y - 2.15, width: 3.4, height: 4.3 })
    expect(plant.visualBounds).not.toEqual(plant.collision)
  })

  it('measures NPC presentation labels without changing their legacy movement collision in Phase 0', () => {
    const laoZhou = mainlineScenes['commercial-cafe'].npcs.find((npc) => npc.id === 'lao-zhou')!
    const footprint = mainlineLabelFootprint(laoZhou.label, resolveMainlineNpcPosition(mainlineScenes['commercial-cafe'], laoZhou.id), defaultSceneScreenMetrics, { lineHeight: 1 })
    expect(footprint.width).toBeCloseTo((14.72 * 2 / 1280) * 100, 4)
    expect(footprint.height).toBeCloseTo((14.72 / 720) * 100, 4)
  })

  it('uses one selected contact for entity and NPC proximity as well as their route destination', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const from = cafe.initialPlayerPosition
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, from, {}, defaultSceneScreenMetrics)
    const options = { geometrySnapshot: snapshot, screenMetrics: defaultSceneScreenMetrics }
    const counter = resolveMainlineEntityInteraction(cafe, 'commercial-cafe-counter-8', from, {}, options)
    expect(mainlineInteractionTarget(cafe, 'commercial-cafe-counter-8', from, {}, undefined, options)).toEqual(counter.target)
    expect(findMainlinePathToEntity(cafe, 'commercial-cafe-counter-8', from, {}, options).target).toEqual(counter.target)

    const laoZhou = resolveMainlineNpcInteraction(cafe, 'lao-zhou', from, {}, options)
    expect(mainlineNpcInteractionTarget(cafe, 'lao-zhou', from, {}, undefined, options)).toEqual(laoZhou.target)
    expect(findMainlinePathToNpc(cafe, 'lao-zhou', from, {}, options).target).toEqual(laoZhou.target)
  })

  it('keeps all four Office corridor plant contacts reachable from the current lower-left office', () => {
    const office = mainlineScenes['zhongshuyuan-office']
    const from = office.initialPlayerPosition
    const snapshot = createMainlineSceneGeometrySnapshot(office, from, {}, defaultSceneScreenMetrics)
    const options = { geometrySnapshot: snapshot, screenMetrics: defaultSceneScreenMetrics }
    const corridorPlants = office.objects.filter((entity) => entity.id.startsWith('zhongshuyuan-office-port-plant-'))

    expect(corridorPlants).toHaveLength(4)
    corridorPlants.forEach((plant) => {
      const interaction = resolveMainlineEntityInteraction(office, plant.id, from, {}, options)
      const command = classifyMainlineWorldCommand(office, from, interaction.target, {}, options)

      expect(findMainlineRoomPassageSequence(office, from, plant.position, {}, options, true)?.passages[0]?.id).toBe('zhongshuyuan-office-south-door-1')
      expect(command.kind, plant.id).toBe('passage')
      if (command.kind !== 'passage') throw new Error(`${plant.id} must route through its legal Office passage`)
      expect(canActorReachPassageApproach(office, command.passage, from, {}, options)?.path).not.toBeNull()
      expect(command.kind === 'passage' ? command.requestedTarget : null, plant.id).toEqual(interaction.target)
    })
  })

  it('keeps the cafe counter one continuous structure while its visual cells reflow', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const body = cafe.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')!
    const compactMetrics = { width: 390, height: 844 }
    const desktop = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition, {}, defaultSceneScreenMetrics)
    const compact = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition, {}, compactMetrics)
    const bodyOnDesktop = desktop.units.find((unit) => unit.id === body.id)!
    const bodyOnCompact = compact.units.find((unit) => unit.id === body.id)!
    const leftCell = cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter-1')!
    const rightCell = cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter-17')!

    expect(bodyOnDesktop).toMatchObject(body)
    expect(bodyOnCompact).toMatchObject(body)
    expect(desktop.objects.get(leftCell.id)?.collision).toBeNull()
    expect(compact.objects.get(rightCell.id)?.collision).toBeNull()
    expect(mainlineInteractionTarget(cafe, leftCell.id, { x: body.x, y: body.y + body.height + 12 }, {}, undefined, { screenMetrics: compactMetrics }).x)
      .toBeLessThan(mainlineInteractionTarget(cafe, rightCell.id, { x: body.x + body.width, y: body.y + body.height + 12 }, {}, undefined, { screenMetrics: compactMetrics }).x)
  })
})
