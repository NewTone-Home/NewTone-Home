import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineNpcStagedPoint } from '../src/center/runtime/mainlineNpcStaging'
import { findMainlinePathToEntity, isWalkableMainlinePoint, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { commercialCafeCoffeeDelivered, commercialCafeCoffeeOwnerNpcId, commercialCafeCoffeePreparing, commercialCafeCoffeeReady, commercialCafeCoffeeOrdered, commercialCafeFinishCursorOne, commercialCafeFloorServerNpcId, commercialCafeLaoZhouConversationSeatId, initialCommercialCafeStoryState, resolveCommercialCafeCoffeeDeliveryIntent, resolveCommercialCafeCoffeePrepIntent, resolveCommercialCafeFloorServiceIntent } from '../src/center/runtime/commercialCafeStory'
import { createNpcMovementAdapter } from '../src/center/runtime/useNpcMovement'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'
import { mainlineLabelFootprint, mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'

const cafe = mainlineScenes['commercial-cafe']
const staffIds = [commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId] as const

function createCafeMovement(actorId: typeof staffIds[number]) {
  const navigationRuntime = createNavigationRuntime()
  const protagonistPosition = cafe.initialPlayerPosition
  const protagonistBox = mainlineProtagonistDotFootprint(protagonistPosition)
  navigationRuntime.registerActor('protagonist', protagonistPosition, { width: protagonistBox.width, height: protagonistBox.height })
  for (const npc of cafe.npcs) {
    const point = resolveMainlineNpcPosition(cafe, npc.id)
    const box = mainlineLabelFootprint(npc.label, point, undefined, { lineHeight: 1 })
    navigationRuntime.registerActor(npc.id, point, { width: box.width, height: box.height })
  }
  const initialPosition = mainlineNpcStagedPoint(cafe, actorId)!
  const footprint = mainlineLabelFootprint('店员', initialPosition, undefined, { lineHeight: 1 })
  const controller = createFreeRoamController(initialPosition)
  const adapter = createNpcMovementAdapter({
    npcId: actorId,
    initialPosition,
    movement: controller,
    navigationRuntime,
    getFootprint: () => ({ width: footprint.width, height: footprint.height }),
  })
  return { navigationRuntime, initialPosition, controller, adapter }
}

function runUntilIdle(controller: ReturnType<typeof createFreeRoamController>, adapter: ReturnType<typeof createNpcMovementAdapter>, runtime: ReturnType<typeof createNavigationRuntime>, actorId: string) {
  for (let now = 100; now <= 30_000 && controller.isMoving(); now += 100) {
    controller.tick(now)
    expect(runtime.getActor(actorId)?.position).toEqual(adapter.getPosition())
  }
  expect(controller.isMoving()).toBe(false)
}

describe('Café NPC runtime movement', () => {
  it('registers two distinct live staff occupants and keeps individual runtime snapshots', () => {
    const coffee = createCafeMovement(commercialCafeCoffeeOwnerNpcId)
    const floor = createCafeMovement(commercialCafeFloorServerNpcId)
    const actorIds = coffee.navigationRuntime.getActors().map(({ actorId }) => actorId)
    expect(actorIds).toEqual(expect.arrayContaining(staffIds))
    expect(coffee.initialPosition).not.toEqual(floor.initialPosition)
    expect(coffee.adapter.getSnapshot().npcId).toBe(commercialCafeCoffeeOwnerNpcId)
    expect(floor.adapter.getSnapshot().npcId).toBe(commercialCafeFloorServerNpcId)
    expect(coffee.navigationRuntime.dynamicObstaclesFor(commercialCafeCoffeeOwnerNpcId)).toHaveLength(3)
    expect(coffee.navigationRuntime.getActor(commercialCafeFloorServerNpcId)?.position).toEqual(floor.initialPosition)
    expect(resolveMainlineNpcPosition(cafe, commercialCafeCoffeeOwnerNpcId)).toEqual(coffee.initialPosition)
    expect(resolveMainlineNpcPosition(cafe, commercialCafeFloorServerNpcId)).toEqual(floor.initialPosition)
  })

  it('starts preparation only after a shared-navigation route reaches the prep station', () => {
    const { navigationRuntime, controller, adapter } = createCafeMovement(commercialCafeCoffeeOwnerNpcId)
    const intent = resolveCommercialCafeCoffeePrepIntent(cafe)!
    let story = commercialCafeCoffeeOrdered(initialCommercialCafeStoryState())
    let arrivals = 0
    const started = adapter.requestMove(intent, cafe, {}, { navigationRuntime }, { maxSpeed: 1 }, () => {
      arrivals += 1
      story = commercialCafeCoffeePreparing(story, 42_000)
    })
    expect(started).toBe(true)
    expect(story.coffeeStatus).toBe('ordered')
    expect(story.coffeePreparationStartedAt).toBeNull()
    runUntilIdle(controller, adapter, navigationRuntime, commercialCafeCoffeeOwnerNpcId)
    expect(arrivals).toBe(1)
    expect(story).toMatchObject({ coffeeStatus: 'preparing', coffeePreparationStartedAt: 42_000 })
    expect(adapter.getPosition()).toEqual(intent.target)
  })

  it('keeps the floor actor on public table service while coffee owner prepares', () => {
    const { navigationRuntime: coffeeRuntime, controller: coffeeController, adapter: coffeeAdapter } = createCafeMovement(commercialCafeCoffeeOwnerNpcId)
    const intent = resolveCommercialCafeCoffeePrepIntent(cafe)!
    const started = coffeeAdapter.requestMove(intent, cafe, {}, { navigationRuntime: coffeeRuntime }, { maxSpeed: 1 })
    expect(started).toBe(true)
    const floorIntent = resolveCommercialCafeFloorServiceIntent(cafe)!
    const floorContact = findMainlinePathToEntity(cafe, floorIntent.targetEntityId!, mainlineNpcStagedPoint(cafe, commercialCafeFloorServerNpcId)!, {}, {
      actorId: commercialCafeFloorServerNpcId,
      actorFootprint: mainlineLabelFootprint('店员', mainlineNpcStagedPoint(cafe, commercialCafeFloorServerNpcId)!, undefined, { lineHeight: 1 }),
      navigationRuntime: coffeeRuntime,
    })
    expect(floorContact.path).not.toBeNull()
    expect(coffeeRuntime.getActor(commercialCafeFloorServerNpcId)).toBeDefined()
    expect(coffeeController.isMoving()).toBe(true)
  })

  it('persists delivery only at the real destination arrival, then uses the same adapter to return', () => {
    const { navigationRuntime, controller, adapter, initialPosition } = createCafeMovement(commercialCafeCoffeeOwnerNpcId)
    const seatedSeat = cafe.objects.find(({ id }) => id === commercialCafeLaoZhouConversationSeatId)
    expect(seatedSeat).toBeDefined()
    let story = commercialCafeFinishCursorOne(commercialCafeCoffeeReady(commercialCafeCoffeePreparing(commercialCafeCoffeeOrdered(initialCommercialCafeStoryState()), 100)))
    const delivery = resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeStatus: story.coffeeStatus, narrativePhase: 'coffee-delivery' })!
    let deliveredBeforeArrival = story.coffeeStatus === 'delivered'
    expect(deliveredBeforeArrival).toBe(false)
    const started = adapter.requestMove(delivery, cafe, {}, { navigationRuntime }, { maxSpeed: 1 }, () => {
      story = commercialCafeCoffeeDelivered(story)
      deliveredBeforeArrival = story.coffeeStatus === 'delivered'
    })
    expect(started).toBe(true)
    expect(deliveredBeforeArrival).toBe(false)
    runUntilIdle(controller, adapter, navigationRuntime, commercialCafeCoffeeOwnerNpcId)
    expect(deliveredBeforeArrival).toBe(true)
    expect(story).toMatchObject({ coffeeStatus: 'delivered', narrativeCursor: 1, narrativePhase: 'coffee-delivery' })
    expect(adapter.getSnapshot()).toMatchObject({ phase: 'idle', dutyId: 'cafe-coffee-owner.deliver-coffee' })
    expect(isWalkableMainlinePoint(adapter.getPosition(), cafe, {}, { actorId: commercialCafeCoffeeOwnerNpcId, navigationRuntime })).toBe(true)

    const returning = adapter.requestMove({ dutyId: 'cafe-coffee-owner.return-to-counter', targetId: 'commercial-cafe-counter-service', target: initialPosition }, cafe, {}, { navigationRuntime }, { maxSpeed: 1 })
    expect(returning).toBe(true)
    runUntilIdle(controller, adapter, navigationRuntime, commercialCafeCoffeeOwnerNpcId)
    expect(adapter.getPosition()).toEqual(initialPosition)
    expect(adapter.getSnapshot()).toMatchObject({ phase: 'idle', dutyId: 'cafe-coffee-owner.return-to-counter' })
  })

  it('keeps counter collision authoritative and blocks an occupied story table without teleporting', () => {
    const { navigationRuntime, controller, adapter, initialPosition } = createCafeMovement(commercialCafeCoffeeOwnerNpcId)
    const table = cafe.objects.find(({ id }) => id === 'commercial-cafe-right-window-upper-group-table')!
    navigationRuntime.registerActor('contact-blocker', table.position, { width: 30, height: 30 })
    const intent = resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeStatus: 'ready', narrativePhase: 'coffee-delivery' })!
    expect(adapter.requestMove(intent, cafe, {}, { navigationRuntime })).toBe(false)
    expect(controller.isMoving()).toBe(false)
    expect(adapter.getPosition()).toEqual(initialPosition)
    expect(adapter.getSnapshot()).toMatchObject({ phase: 'blocked', dutyId: 'cafe-coffee-owner.deliver-coffee' })
  })
})
