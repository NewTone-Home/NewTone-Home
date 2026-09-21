import { describe, expect, it } from 'vitest'
import { mainlineNpcOccupiedSeatIds } from '../src/center/runtime/MainlineSceneRenderer'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { findMainlinePath, isWalkableMainlinePoint, mainlineNpcInteractionTarget, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'

describe('static NPC foundation', () => {
  const cafe = mainlineScenes['commercial-cafe']
  const laoZhou = cafe.npcs.find((npc) => npc.id === 'lao-zhou')!
  const server = cafe.npcs.find((npc) => npc.id === 'server')!

  it('binds lao zhou to the existing upper window seat instead of duplicating its sit coordinate', () => {
    const seat = cafe.objects.find((entity) => entity.id === laoZhou.seatEntityId)

    expect(laoZhou.position).toBeUndefined()
    expect(seat).toMatchObject({
      id: 'commercial-cafe-right-window-upper-group-chair-top',
      kind: 'seat',
      seat: expect.objectContaining({ sit: expect.any(Object) }),
    })
    expect(resolveMainlineNpcPosition(cafe, laoZhou.id)).toEqual(seat?.seat?.sit)
    expect(mainlineNpcOccupiedSeatIds(cafe)).toEqual(new Set([seat?.id]))
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
