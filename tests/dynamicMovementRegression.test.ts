import { describe, expect, it } from 'vitest'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'

describe('live dynamic occupancy reproduction', () => {
  it('stops at a live occupant, never overlaps, and accepts a new legal route after it clears', () => {
    const movement = createFreeRoamController({ x: 10, y: 10 })
    const occupants = createNavigationRuntime()
    let blocked = 0, arrived = 0
    const options = {
      maxSpeed: .01,
      canOccupy: (point: { x: number; y: number }) => occupants.dynamicObstaclesFor('protagonist').every(box =>
        point.x < box.x || point.x > box.x + box.width || point.y < box.y || point.y > box.y + box.height),
      onBlocked: () => blocked++,
    }
    const target = { x: 13, y: 10 }
    movement.moveAlong([movement.getCurrentPosition(), target], () => arrived++, options)
    occupants.registerActor('npc', { x: 11, y: 10 }, { width: 1, height: 1 })
    for (let now = 100; now < 10000 && movement.isMoving(); now += 40) movement.tick(now)
    expect(blocked).toBe(1)
    expect(arrived).toBe(0)
    expect(movement.getCurrentPosition().x).toBeLessThan(10.5)
    occupants.removeActor('npc')
    movement.moveAlong([movement.getCurrentPosition(), target], () => arrived++, options)
    for (let now = 10000; now < 20000 && movement.isMoving(); now += 40) movement.tick(now)
    expect(arrived).toBe(1)
    expect(movement.getCurrentPosition()).toEqual(target)
  })
})
