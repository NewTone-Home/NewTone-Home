import { describe, expect, it } from 'vitest'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'

const start = { x: 10, y: 10 }
const near = { x: 10.1, y: 10 }

describe('free roam waypoint arrival legality', () => {
  it('blocks an illegal arrival snap once, preserves the last legal point, then accepts a new move', () => {
    const movement = createFreeRoamController(start)
    let blocked = 0
    movement.moveAlong([start, near], undefined, {
      maxSpeed: 1,
      canOccupy: (point) => point.x === start.x && point.y === start.y,
      onBlocked: () => { blocked += 1 },
    })
    movement.tick(100)
    expect(movement.getCurrentPosition()).toEqual(start)
    expect(movement.isMoving()).toBe(false)
    expect(blocked).toBe(1)

    movement.moveAlong([start, { x: 11, y: 10 }], undefined, { maxSpeed: 1 })
    expect(movement.isMoving()).toBe(true)
  })

  it('does not snap across a final segment rejected by canTraverse', () => {
    const movement = createFreeRoamController(start)
    let blocked = 0
    movement.moveAlong([start, near], undefined, {
      maxSpeed: 1,
      canOccupy: () => true,
      canTraverse: () => false,
      onBlocked: () => { blocked += 1 },
    })
    movement.tick(100)
    expect(movement.getCurrentPosition()).toEqual(start)
    expect(movement.isMoving()).toBe(false)
    expect(blocked).toBe(1)
  })
})
