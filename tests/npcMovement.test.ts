import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialCafeServerMovementDebugTarget } from '../src/center/runtime/mainlineSceneModel'
import { mainlineNpcStagedPoint } from '../src/center/runtime/mainlineNpcStaging'
import { isWalkableMainlinePoint, resolveMainlineNpcPosition, resolveMainlineSeatSitPosition } from '../src/center/runtime/mainlineNavigation'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { commercialCafeLaoZhouConversationSeatId, resolveCommercialCafeCoffeeDeliveryIntent, resolveCommercialCafeReturnToCounterIntent } from '../src/center/runtime/commercialCafeStory'
import { npcRoles } from '../src/center/runtime/npcRoles'
import { createNpcMovementAdapter } from '../src/center/runtime/useNpcMovement'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'

const cafe = mainlineScenes['commercial-cafe']
const laoZhouPosition = resolveMainlineNpcPosition(cafe, 'lao-zhou')
const serverHome = mainlineNpcStagedPoint(cafe, 'server')!
const movementTestTarget = commercialCafeServerMovementDebugTarget.position

function runUntilIdle(controller: ReturnType<typeof createFreeRoamController>, adapter: ReturnType<typeof createNpcMovementAdapter>, runtime: ReturnType<typeof createNavigationRuntime>) {
  for (let now = 100; now <= 20000 && controller.isMoving(); now += 100) {
    controller.tick(now)
    expect(runtime.getActor('server')?.position).toEqual(adapter.getPosition())
  }
  expect(controller.isMoving()).toBe(false)
}

describe('NPC movement adapter', () => {
  function createServerMovement(protagonistPosition = cafe.initialPlayerPosition) {
    const navigationRuntime = createNavigationRuntime()
    const controller = createFreeRoamController(serverHome)
    navigationRuntime.registerActor('protagonist', protagonistPosition)
    navigationRuntime.registerActor('lao-zhou', laoZhouPosition)
    navigationRuntime.registerActor('server', serverHome)
    const adapter = createNpcMovementAdapter({
      npcId: 'server',
      initialPosition: serverHome,
      movement: controller,
      navigationRuntime,
    })
    return { navigationRuntime, controller, adapter }
  }

  it('uses behavior staging only as the server start point, then resolves renderer/navigation position from the runtime', () => {
    const { adapter } = createServerMovement()
    const runtimePosition = movementTestTarget

    expect(adapter.getPosition()).toEqual(serverHome)
    expect(resolveMainlineNpcPosition(cafe, 'server')).toEqual(serverHome)
    expect(resolveMainlineNpcPosition(cafe, 'server', {}, {
      npcRuntimePositions: new Map([['server', runtimePosition]]),
    })).toEqual(runtimePosition)
  })

  it('plans a legal server route through shared navigation, updates its actor every tick, and returns home', () => {
    const { navigationRuntime, controller, adapter } = createServerMovement()
    const moved = adapter.requestMove({
      dutyId: 'server.debug-movement',
      targetId: 'commercial-cafe-server-movement-test-point',
      target: movementTestTarget,
    }, cafe, {})

    expect(moved).toBe(true)
    expect(adapter.getSnapshot()).toMatchObject({
      npcId: 'server',
      phase: 'moving',
      dutyId: 'server.debug-movement',
      targetId: 'commercial-cafe-server-movement-test-point',
    })
    expect(navigationRuntime.getActors().map((actor) => actor.actorId)).toEqual(expect.arrayContaining(['protagonist', 'lao-zhou', 'server']))
    expect(navigationRuntime.dynamicObstaclesFor('server')).toHaveLength(2)
    runUntilIdle(controller, adapter, navigationRuntime)

    expect(adapter.getPosition()).toEqual(movementTestTarget)
    expect(adapter.getSnapshot()).toMatchObject({ phase: 'idle', dutyId: 'server.debug-movement', targetId: 'commercial-cafe-server-movement-test-point' })
    expect(isWalkableMainlinePoint(adapter.getPosition(), cafe, {}, { actorId: 'server', navigationRuntime })).toBe(true)

    const returned = adapter.requestMove({
      dutyId: 'server.debug-return',
      targetId: 'commercial-cafe-server-home',
      target: serverHome,
    }, cafe, {})
    expect(returned).toBe(true)
    runUntilIdle(controller, adapter, navigationRuntime)
    expect(adapter.getPosition()).toEqual(serverHome)
    expect(adapter.getSnapshot()).toMatchObject({ phase: 'idle', dutyId: 'server.debug-return', targetId: 'commercial-cafe-server-home' })
  })

  it('keeps counter collision authoritative and reports a blocked intent without an ignore-static escape hatch', () => {
    const { controller, adapter } = createServerMovement()
    const counter = cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter')!
    const started = adapter.requestMove({
      dutyId: 'server.debug-invalid',
      targetId: counter.id,
      target: counter.position,
    }, cafe, {})

    expect(started).toBe(false)
    expect(controller.isMoving()).toBe(false)
    expect(adapter.getPosition()).toEqual(serverHome)
    expect(adapter.getSnapshot()).toMatchObject({
      phase: 'blocked',
      dutyId: 'server.debug-invalid',
      targetId: counter.id,
      retryCount: 1,
    })
  })

  it('persists delivery only after arrival, then returns with the same movement adapter', () => {
    const seatedProtagonist = resolveMainlineSeatSitPosition(cafe, commercialCafeLaoZhouConversationSeatId)!
    const { navigationRuntime, controller, adapter } = createServerMovement(seatedProtagonist)
    const delivery = resolveCommercialCafeCoffeeDeliveryIntent({
      scene: cafe,
      stage: 'met-lao-zhou',
      from: serverHome,
      navigationOptions: { navigationRuntime },
    })!
    let stage = 'met-lao-zhou'
    let deliveries = 0
    const started = adapter.requestMove(delivery, cafe, {}, { navigationRuntime }, {}, () => {
      deliveries += 1
      stage = 'coffee-delivered'
      const returning = adapter.requestMove(resolveCommercialCafeReturnToCounterIntent(cafe)!, cafe, {}, { navigationRuntime })
      expect(returning).toBe(true)
    })

    expect(started).toBe(true)
    expect(stage).toBe('met-lao-zhou')
    runUntilIdle(controller, adapter, navigationRuntime)

    expect(deliveries).toBe(1)
    expect(stage).toBe('coffee-delivered')
    expect(adapter.getPosition()).toEqual(serverHome)
    expect(adapter.getSnapshot()).toMatchObject({ phase: 'idle', dutyId: npcRoles.server.duties.returnToCounter.id })
  })
})
