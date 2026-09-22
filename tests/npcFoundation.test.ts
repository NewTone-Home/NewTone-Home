import { describe, expect, it } from 'vitest'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { findMainlinePath, findMainlinePathToNpc, isWalkableMainlinePoint, mainlineNavigationCollisionBoxes, mainlineNpcInteractionTarget, resolveMainlineAccessRegionBoundaryTarget, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineSceneOccupiedSeatIds } from '../src/center/runtime/mainlineSeating'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'

describe('static NPC foundation', () => {
  const cafe = mainlineScenes['commercial-cafe']
  const laoZhou = cafe.npcs.find((npc) => npc.id === 'lao-zhou')!
  const server = cafe.npcs.find((npc) => npc.id === 'server')!

  it('keeps Lao Zhou identity separate from the current scene seating placement', () => {
    const placement = cafe.npcPlacements.find((candidate) => candidate.npcId === laoZhou.id)
    const seat = cafe.objects.find((entity) => entity.id === placement?.seatId)

    expect(laoZhou).not.toHaveProperty('seatEntityId')
    expect(placement).toEqual({ npcId: 'lao-zhou', seatId: 'commercial-cafe-right-window-upper-group-chair-top' })
    expect(seat).toMatchObject({
      id: 'commercial-cafe-right-window-upper-group-chair-top',
      kind: 'seat',
      seat: expect.objectContaining({ sit: expect.any(Object) }),
    })
    expect(resolveMainlineNpcPosition(cafe, laoZhou.id)).toEqual(seat?.seat?.sit)
    expect(mainlineSceneOccupiedSeatIds(cafe)).toEqual(new Set([seat?.id]))
  })

  it('keeps NPCs out of spatial entities while exposing their distinct physical interaction targets', () => {
    const laoZhouPosition = resolveMainlineNpcPosition(cafe, laoZhou.id)
    const serverPosition = resolveMainlineNpcPosition(cafe, server.id)
    const from = cafe.initialPlayerPosition
    const laoZhouTarget = mainlineNpcInteractionTarget(cafe, laoZhou.id, from)
    const serverTarget = mainlineNpcInteractionTarget(cafe, server.id, from)

    expect(cafe.objects.some((entity) => entity.id === laoZhou.id || entity.id === server.id)).toBe(false)
    expect(laoZhouTarget).not.toEqual(laoZhouPosition)
    expect(serverTarget).not.toEqual(serverPosition)
    expect(Math.hypot(laoZhouTarget.x - laoZhouPosition.x, laoZhouTarget.y - laoZhouPosition.y)).toBeGreaterThan(.7)
  })

  it('keeps the server clickable from the customer side of the physical counter', () => {
    const placement = cafe.npcPlacements.find((candidate) => candidate.npcId === server.id)!
    const target = mainlineNpcInteractionTarget(cafe, server.id, cafe.initialPlayerPosition)
    const route = findMainlinePathToNpc(cafe, server.id, cafe.initialPlayerPosition)

    expect(placement.interactionApproach).toBeDefined()
    expect(target).toEqual(placement.interactionApproach)
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

  it('derives each counter segment from one physical counter body while preserving independent customer approaches', () => {
    const counters = cafe.objects.filter((entity) => entity.id === 'commercial-cafe-counter' || entity.id.startsWith('commercial-cafe-counter-'))
    const uniqueApproachXs = new Set(counters.map((counter) => counter.approach?.x))

    expect(counters).toHaveLength(17)
    expect(uniqueApproachXs).toHaveLength(17)
    counters.forEach((counter) => {
      expect(counter.collision).toBeDefined()
      expect(counter.approach).toBeDefined()
      expect(counter.position.y).toBeCloseTo(counter.collision!.y + counter.collision!.height / 2)
      expect(counter.approach!.x).toBe(counter.position.x)
      expect(counter.approach!.y).toBeCloseTo(counter.collision!.y + counter.collision!.height + .62)
      expect(counter.interactionBehavior).toBe('cafe-order')
    })
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

  it('stops a denied protagonist click at the staff boundary while allowing server paths across it', () => {
    const staffArea = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const serverPosition = resolveMainlineNpcPosition(cafe, server.id)
    const customerPoint = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-inner-middle-group-table')!.approach!
    const denied = resolveMainlineAccessRegionBoundaryTarget(
      cafe,
      { x: staffArea.x + staffArea.width / 2, y: staffArea.y + staffArea.height / 2 },
      cafe.initialPlayerPosition,
      { actorId: 'protagonist' },
    )

    expect(denied).toMatchObject({ region: { id: 'commercial-cafe-staff-area' } })
    expect(isWalkableMainlinePoint(denied!.target, cafe, {}, { actorId: 'protagonist' })).toBe(true)
    expect(findMainlinePath(cafe.initialPlayerPosition, { x: staffArea.x + staffArea.width / 2, y: staffArea.y + staffArea.height / 2 }, cafe, {}, { actorId: 'protagonist' })).toBeNull()

    const outbound = findMainlinePath(serverPosition, customerPoint, cafe, {}, { actorId: 'server' })
    const returnPath = findMainlinePath(customerPoint, serverPosition, cafe, {}, { actorId: 'server' })
    expect(outbound).not.toBeNull()
    expect(returnPath).not.toBeNull()
    expect(outbound?.every((point) => isWalkableMainlinePoint(point, cafe, {}, { actorId: 'server' }))).toBe(true)
    expect(returnPath?.every((point) => isWalkableMainlinePoint(point, cafe, {}, { actorId: 'server' }))).toBe(true)
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
