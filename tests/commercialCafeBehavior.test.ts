import { describe, expect, it } from 'vitest'
import {
  commercialCafeDutySpeedMultiplier,
  createCommercialCafeCoffeeOwnerBehaviorCoordinator,
  createCommercialCafeFloorServerBehaviorCoordinator,
} from '../src/center/runtime/commercialCafeBehavior'
import { commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId } from '../src/center/runtime/commercialCafeStory'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineNpcStagedPoint } from '../src/center/runtime/mainlineNpcStaging'
import { npcRoles } from '../src/center/runtime/npcRoles'

const cafe = mainlineScenes['commercial-cafe']
const snapshot = (npcId: string, phase: 'idle' | 'moving' = 'idle') => ({ npcId, phase, retryCount: 0 })

describe('commercial café staff duty ownership', () => {
  it('gives the coffee owner exclusive prep/delivery/return duties', () => {
    const coffeeOwner = createCommercialCafeCoffeeOwnerBehaviorCoordinator()
    const ordered = coffeeOwner.request({ scene: cafe, coffeeStatus: 'ordered', narrativePhase: 'dialogue', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId) })
    expect(ordered).toMatchObject({ dutyId: npcRoles.cafeCoffeeOwner.duties.prepare.id, targetId: 'commercial-cafe-prep-station' })
    expect(coffeeOwner.getPhase()).toBe('moving-to-prep')
    expect(coffeeOwner.request({ scene: cafe, coffeeStatus: 'ordered', narrativePhase: 'dialogue', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId, 'moving') })).toBeNull()

    coffeeOwner.arrivedAtPrep()
    expect(coffeeOwner.request({ scene: cafe, coffeeStatus: 'preparing', narrativePhase: 'dialogue', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId) })).toBeNull()
    expect(coffeeOwner.getPhase()).toBe('preparing')
    expect(coffeeOwner.request({ scene: cafe, coffeeStatus: 'ready', narrativePhase: 'dialogue', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId) })).toBeNull()
    expect(coffeeOwner.getPhase()).toBe('preparing')

    const delivery = coffeeOwner.request({ scene: cafe, coffeeStatus: 'ready', narrativePhase: 'coffee-delivery', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId) })
    expect(delivery).toMatchObject({ dutyId: npcRoles.cafeCoffeeOwner.duties.deliverCoffee.id, targetId: 'commercial-cafe-right-window-upper-group-table' })
    expect(coffeeOwner.getPhase()).toBe('delivering')
    coffeeOwner.arrivedAtStoryTable()
    expect(coffeeOwner.request({ scene: cafe, coffeeStatus: 'delivered', narrativePhase: 'dialogue', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId) })).toMatchObject({
      dutyId: npcRoles.cafeCoffeeOwner.duties.returnToCounter.id,
      targetId: 'commercial-cafe-counter-service',
    })
    coffeeOwner.arrivedAtCounter()
    expect(coffeeOwner.getPhase()).toBe('counter')
  })

  it('keeps floor service available while coffee is prepared or ready before its story gate', () => {
    const coffeeOwner = createCommercialCafeCoffeeOwnerBehaviorCoordinator()
    const floor = createCommercialCafeFloorServerBehaviorCoordinator()
    const floorIntent = floor.request(cafe, snapshot(commercialCafeFloorServerNpcId))
    expect(floorIntent).toMatchObject({ dutyId: npcRoles.cafeFloorServer.duties.tableService.id, targetEntityId: expect.any(String) })
    const table = cafe.objects.find(({ id }) => id === floorIntent?.targetEntityId)
    expect(table?.kind).toBe('table')
    expect(floorIntent).not.toHaveProperty('target')
    expect(coffeeOwner.request({ scene: cafe, coffeeStatus: 'ready', narrativePhase: 'dialogue', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId) })).toBeNull()
    expect(floor.getPhase()).toBe('serving')
  })

  it('keeps the two workers on distinct initial real scene positions and staff access roles', () => {
    const coffeeOwner = mainlineNpcStagedPoint(cafe, commercialCafeCoffeeOwnerNpcId)
    const floorServer = mainlineNpcStagedPoint(cafe, commercialCafeFloorServerNpcId)
    expect(coffeeOwner).toBeDefined()
    expect(floorServer).toBeDefined()
    expect(coffeeOwner).not.toEqual(floorServer)
    const staff = cafe.npcs.filter(({ id }) => id === commercialCafeCoffeeOwnerNpcId || id === commercialCafeFloorServerNpcId)
    expect(staff).toHaveLength(2)
    expect(staff.map(({ label }) => label)).toEqual(['店员', '店员'])
    expect(cafe.actorAccess[commercialCafeCoffeeOwnerNpcId]).toEqual(['public', 'staff'])
    expect(cafe.actorAccess[commercialCafeFloorServerNpcId]).toEqual(['public'])
  })

  it('retries blocked coffee duties without changing their owner or delivering before arrival', () => {
    const coffeeOwner = createCommercialCafeCoffeeOwnerBehaviorCoordinator()
    coffeeOwner.request({ scene: cafe, coffeeStatus: 'ready', narrativePhase: 'coffee-delivery', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId) })
    coffeeOwner.block()
    expect(coffeeOwner.getPhase()).toBe('blocked')
    expect(coffeeOwner.request({ scene: cafe, coffeeStatus: 'ready', narrativePhase: 'coffee-delivery', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId) })).toBeNull()
    coffeeOwner.retry()
    expect(coffeeOwner.request({ scene: cafe, coffeeStatus: 'ready', narrativePhase: 'coffee-delivery', snapshot: snapshot(commercialCafeCoffeeOwnerNpcId) })).toMatchObject({ dutyId: npcRoles.cafeCoffeeOwner.duties.deliverCoffee.id })
    expect(commercialCafeFloorServerNpcId).not.toBe(commercialCafeCoffeeOwnerNpcId)
  })

  it('applies 1x only to coffee delivery/return while Reading keeps every ambient worker at 0.45x', () => {
    expect(commercialCafeDutySpeedMultiplier(commercialCafeCoffeeOwnerNpcId, npcRoles.cafeCoffeeOwner.duties.counterService.id, true)).toBe(.45)
    expect(commercialCafeDutySpeedMultiplier(commercialCafeCoffeeOwnerNpcId, npcRoles.cafeCoffeeOwner.duties.prepare.id, true)).toBe(.45)
    expect(commercialCafeDutySpeedMultiplier(commercialCafeCoffeeOwnerNpcId, npcRoles.cafeCoffeeOwner.duties.deliverCoffee.id, true)).toBe(1)
    expect(commercialCafeDutySpeedMultiplier(commercialCafeCoffeeOwnerNpcId, npcRoles.cafeCoffeeOwner.duties.returnToCounter.id, true)).toBe(1)
    expect(commercialCafeDutySpeedMultiplier(commercialCafeFloorServerNpcId, npcRoles.cafeFloorServer.duties.tableService.id, true)).toBe(.45)
    expect(commercialCafeDutySpeedMultiplier(commercialCafeCoffeeOwnerNpcId, npcRoles.cafeCoffeeOwner.duties.returnToCounter.id, false)).toBe(1)
  })

  it('cycles floor service only through public tables and never takes coffee duties', () => {
    const floor = createCommercialCafeFloorServerBehaviorCoordinator()
    const first = floor.request(cafe, snapshot(commercialCafeFloorServerNpcId))!
    expect(first.dutyId).toBe(npcRoles.cafeFloorServer.duties.tableService.id)
    floor.arrived()
    const second = floor.request(cafe, snapshot(commercialCafeFloorServerNpcId))!
    expect(second.dutyId).toBe(npcRoles.cafeFloorServer.duties.tableService.id)
    expect(second.targetEntityId).not.toBe(first.targetEntityId)
    for (const intent of [first, second]) expect(cafe.objects.find(({ id }) => id === intent.targetEntityId)?.kind).toBe('table')
  })
})
