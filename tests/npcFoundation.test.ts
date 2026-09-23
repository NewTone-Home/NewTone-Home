import { describe, expect, it } from 'vitest'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { findMainlinePath, findMainlinePathToEntity, findMainlinePathToNpc, isWalkableMainlinePoint, mainlineInteractionTarget, mainlineNavigationCollisionBoxes, mainlineNpcInteractionTarget, resolveMainlineAccessRegionBoundaryTarget, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineSceneOccupiedSeatIds } from '../src/center/runtime/mainlineSeating'
import { mainlineNpcStagedSeatId, mainlineNpcStagingBehavior } from '../src/center/runtime/mainlineNpcStaging'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'

describe('static NPC foundation', () => {
  const cafe = mainlineScenes['commercial-cafe']
  const laoZhou = cafe.npcs.find((npc) => npc.id === 'lao-zhou')!
  const server = cafe.npcs.find((npc) => npc.id === 'server')!

  it('keeps Lao Zhou identity separate from behavior-derived scene seating', () => {
    const behavior = mainlineNpcStagingBehavior(cafe, laoZhou.id)
    const seat = cafe.objects.find((entity) => entity.id === mainlineNpcStagedSeatId(cafe, laoZhou.id))

    expect(laoZhou).not.toHaveProperty('seatEntityId')
    expect(cafe.npcPlacements).toEqual([])
    expect(behavior).toEqual({ npcId: 'lao-zhou', dutyId: 'lao-zhou.seated', targetId: 'commercial-cafe-right-window-upper-group-chair-top', targetKind: 'seat' })
    expect(seat).toMatchObject({
      id: 'commercial-cafe-right-window-upper-group-chair-top',
      kind: 'seat',
      seat: expect.objectContaining({ sit: expect.any(Object) }),
    })
    expect(resolveMainlineNpcPosition(cafe, laoZhou.id)).toEqual(seat?.seat?.sit)
    expect(mainlineSceneOccupiedSeatIds(cafe)).toEqual(new Set([seat?.id]))
  })

  it('keeps NPCs out of spatial entities and approaches Lao Zhou as a person, not as his story table', () => {
    const laoZhouPosition = resolveMainlineNpcPosition(cafe, laoZhou.id)
    const serverPosition = resolveMainlineNpcPosition(cafe, server.id)
    const from = cafe.initialPlayerPosition
    const laoZhouTarget = mainlineNpcInteractionTarget(cafe, laoZhou.id, from)
    const serverTarget = mainlineNpcInteractionTarget(cafe, server.id, from)

    expect(cafe.objects.some((entity) => entity.id === laoZhou.id || entity.id === server.id)).toBe(false)
    expect(laoZhouTarget).not.toEqual(laoZhouPosition)
    expect(serverTarget).not.toEqual(serverPosition)
    expect(Math.hypot(laoZhouTarget.x - laoZhouPosition.x, laoZhouTarget.y - laoZhouPosition.y)).toBeGreaterThan(.7)
    expect(Math.hypot(laoZhouTarget.x - laoZhouPosition.x, laoZhouTarget.y - laoZhouPosition.y)).toBeLessThan(1.5)
    expect(laoZhouTarget).not.toEqual(mainlineInteractionTarget(cafe, laoZhou.interactionTargetEntityId, from))
    expect(findMainlinePathToNpc(cafe, laoZhou.id, from).path).not.toBeNull()
  })

  it('keeps the server clickable through a dynamic customer-side counter contact', () => {
    const counter = cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter')!
    const target = mainlineNpcInteractionTarget(cafe, server.id, cafe.initialPlayerPosition)
    const route = findMainlinePathToNpc(cafe, server.id, cafe.initialPlayerPosition)

    expect(target.y).toBeGreaterThan(counter.collision!.y + counter.collision!.height)
    expect(isWalkableMainlinePoint(target, cafe)).toBe(true)
    expect(route.path).not.toBeNull()
  })

  it('uses one navigation runtime so NPCs block the protagonist but never themselves', () => {
    const runtime = createNavigationRuntime()
    const laoZhouPosition = resolveMainlineNpcPosition(cafe, laoZhou.id)
    const serverPosition = resolveMainlineNpcPosition(cafe, server.id)
    runtime.registerActor('protagonist', cafe.initialPlayerPosition)
    runtime.registerActor(laoZhou.id, laoZhouPosition)
    runtime.registerActor(server.id, serverPosition)
    const options = { navigationRuntime: runtime, actorId: 'protagonist' as const }
    const target = mainlineNpcInteractionTarget(cafe, laoZhou.id, cafe.initialPlayerPosition, {}, undefined, options)
    const path = findMainlinePath(cafe.initialPlayerPosition, target, cafe, {}, options)

    expect(runtime.dynamicObstaclesFor('protagonist')).toHaveLength(2)
    expect(runtime.dynamicObstaclesFor('protagonist').some((box) => box.x === cafe.initialPlayerPosition.x - .56 && box.y === cafe.initialPlayerPosition.y - .56)).toBe(false)
    expect(isWalkableMainlinePoint(laoZhouPosition, cafe, {}, options)).toBe(false)
    expect(isWalkableMainlinePoint(serverPosition, cafe, {}, options)).toBe(false)
    expect(isWalkableMainlinePoint(target, cafe, {}, options)).toBe(true)
    expect(path).not.toBeNull()
    expect(path?.every((point) => isWalkableMainlinePoint(point, cafe, {}, options))).toBe(true)
  })

  it('derives each counter segment from one continuous physical counter body while preserving independent customer contact regions', () => {
    const counters = cafe.objects.filter((entity) => entity.id === 'commercial-cafe-counter' || entity.id.startsWith('commercial-cafe-counter-'))
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
    const uniqueContactXs = new Set(counters.map((counter) => mainlineInteractionTarget(cafe, counter.id, { x: counter.position.x, y: cafe.walkBounds.y + cafe.walkBounds.height } ).x))

    expect(counters).toHaveLength(17)
    expect(uniqueContactXs).toHaveLength(17)
    counters.forEach((counter) => {
      expect(counter.collision).toBeDefined()
      expect(counter.position.y).toBeCloseTo(counter.collision!.y + counter.collision!.height / 2)
      const renderedCollision = snapshot.objects.get(counter.id)?.collision
      if (!renderedCollision) throw new Error(`Missing rendered collision for ${counter.id}`)
      expect(renderedCollision.x).toBeCloseTo(counter.collision!.x)
      expect(renderedCollision.y).toBeCloseTo(counter.collision!.y)
      expect(renderedCollision.width).toBeCloseTo(counter.collision!.width)
      expect(renderedCollision.height).toBeCloseTo(counter.collision!.height)
      expect(counter.movementCollision).toBe('physical')
      expect(counter.interactionBehavior).toBe('cafe-order')
    })
    expect(Math.min(...counters.map((counter) => counter.collision!.x))).toBeCloseTo(8.7)
    expect(Math.max(...counters.map((counter) => counter.collision!.x + counter.collision!.width))).toBeCloseTo(49.5)
  })

  it('keeps the cafe staff area out of universal blockers and applies access through the querying actor', () => {
    const staffArea = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const serverPosition = resolveMainlineNpcPosition(cafe, server.id)
    const counter = cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter')!

    expect(cafe.blockers.some((blocker) => blocker.id === 'commercial-cafe-staff-only')).toBe(false)
    expect(staffArea).toMatchObject({ requiredAccess: 'staff', deniedText: '还是别进去打扰他们工作了。' })
    expect(cafe.actorAccess.protagonist).toEqual(['public'])
    expect(cafe.actorAccess['lao-zhou']).toEqual(['public'])
    expect(cafe.actorAccess.server).toEqual(['public', 'staff'])
    expect(isWalkableMainlinePoint(serverPosition, cafe, {}, { actorId: 'server' })).toBe(true)
    expect(isWalkableMainlinePoint(serverPosition, cafe, {}, { actorId: 'protagonist' })).toBe(false)
    expect(isWalkableMainlinePoint(counter.position, cafe, {}, { actorId: 'server' })).toBe(false)
    expect(mainlineNavigationCollisionBoxes(cafe, {}, { actorId: 'server' }).some((box) => box.x === staffArea.x && box.y === staffArea.y && box.width === staffArea.width && box.height === staffArea.height)).toBe(false)
    expect(mainlineNavigationCollisionBoxes(cafe, {}, { actorId: 'protagonist' }).some((box) => box.x === staffArea.x && box.y === staffArea.y && box.width === staffArea.width && box.height === staffArea.height)).toBe(true)
  })

  it('routes denied staff clicks to the sole right-side entrance while server paths physically pass around the counter', () => {
    const staffArea = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const portal = cafe.accessPortals.find((candidate) => candidate.regionId === staffArea.id)!
    const serverPosition = resolveMainlineNpcPosition(cafe, server.id)
    const customerPoint = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-inner-middle-group-table')!.approach!
    const denied = resolveMainlineAccessRegionBoundaryTarget(
      cafe,
      { x: staffArea.x + staffArea.width / 2, y: staffArea.y + staffArea.height / 2 },
      cafe.initialPlayerPosition,
      { actorId: 'protagonist' },
    )

    expect(denied).toMatchObject({ region: { id: 'commercial-cafe-staff-area' }, target: portal.outside })
    expect(isWalkableMainlinePoint(denied!.target, cafe, {}, { actorId: 'protagonist' })).toBe(true)
    expect(findMainlinePath(cafe.initialPlayerPosition, { x: staffArea.x + staffArea.width / 2, y: staffArea.y + staffArea.height / 2 }, cafe, {}, { actorId: 'protagonist' })).toBeNull()

    const outbound = findMainlinePath(serverPosition, customerPoint, cafe, {}, { actorId: 'server' })
    const returnPath = findMainlinePath(customerPoint, serverPosition, cafe, {}, { actorId: 'server' })
    expect(outbound).not.toBeNull()
    expect(returnPath).not.toBeNull()
    expect(outbound?.every((point) => isWalkableMainlinePoint(point, cafe, {}, { actorId: 'server' }))).toBe(true)
    expect(returnPath?.every((point) => isWalkableMainlinePoint(point, cafe, {}, { actorId: 'server' }))).toBe(true)
    const counterRight = Math.max(...cafe.objects
      .filter((entity) => entity.id === 'commercial-cafe-counter' || entity.id.startsWith('commercial-cafe-counter-'))
      .map((entity) => entity.collision!.x + entity.collision!.width))
    expect(outbound?.some((point) => point.x > counterRight)).toBe(true)
    expect(returnPath?.some((point) => point.x > counterRight)).toBe(true)
  })

  it('uses table body edges instead of an authored table approach for ordinary interaction', () => {
    const table = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-inner-middle-group-table')!
    const fromLeft = { x: table.position.x - 10, y: table.position.y }
    const fromRight = { x: table.position.x + 10, y: table.position.y }
    const leftTarget = mainlineInteractionTarget(cafe, table.id, fromLeft)
    const rightTarget = mainlineInteractionTarget(cafe, table.id, fromRight)

    expect(leftTarget.x).toBeLessThan(table.collision!.x)
    expect(rightTarget.x).toBeGreaterThan(table.collision!.x + table.collision!.width)
    expect(leftTarget).not.toEqual(table.approach)
    expect(rightTarget).not.toEqual(table.approach)
    expect(findMainlinePathToEntity(cafe, table.id, fromLeft).path).not.toBeNull()
    expect(findMainlinePathToEntity(cafe, table.id, fromRight).path).not.toBeNull()
  })

  it('replaces an unfinished NPC approach before its prior arrival callback can fire', () => {
    const start = cafe.initialPlayerPosition
    const actorStep = 4
    const controller = createFreeRoamController(start)
    const arrivals: string[] = []

    controller.moveAlong([{ x: start.x + actorStep, y: start.y }], () => arrivals.push('lao-zhou'), { maxSpeed: 1 })
    controller.moveAlong([{ x: start.x, y: start.y + actorStep }], () => arrivals.push('server'), { maxSpeed: 1 })
    controller.tick(1000)
    controller.tick(2000)
    controller.tick(3000)
    controller.tick(4000)
    controller.tick(5000)

    expect(arrivals).toEqual(['server'])
  })
})
