import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createFreeRoamController, movementDurationMsForPath, protagonistCharacterMovementOptions, protagonistCharacterWalkSpeedPxPerSecond, sharedCharacterMovementOptions, sharedCharacterWalkSpeedPxPerSecond } from '../src/center/runtime/useFreeRoamMovement'

describe('shared ordinary character movement speed', () => {
  const start = mainlineScenes['commercial-cafe'].initialPlayerPosition
  const target = { x: start.x + 8, y: start.y + 4 }
  const screenMetrics = { width: 1000, height: 600 }

  it('uses 340 px/s for the protagonist while preserving the shared NPC default', () => {
    expect(sharedCharacterWalkSpeedPxPerSecond).toBe(280)
    expect(sharedCharacterMovementOptions(screenMetrics)).toEqual({
      screenMetrics,
      screenSpeedPxPerSecond: 280,
    })
    expect(protagonistCharacterWalkSpeedPxPerSecond).toBe(340)
    expect(protagonistCharacterMovementOptions(screenMetrics)).toEqual({
      screenMetrics,
      screenSpeedPxPerSecond: 340,
    })
  })

  it('uses the same shared speed for path duration and the live movement controller', () => {
    const options = protagonistCharacterMovementOptions(screenMetrics)
    const path = [target]
    const estimatedDuration = movementDurationMsForPath(path, start, options)
    const controller = createFreeRoamController(start)

    controller.moveAlong(path, undefined, options)

    const screenDistance = Math.hypot(
      (target.x - start.x) * screenMetrics.width / 100,
      (target.y - start.y) * screenMetrics.height / 100,
    )
    expect(estimatedDuration).toBeCloseTo(screenDistance / protagonistCharacterWalkSpeedPxPerSecond * 1000, 8)
    expect(controller.getRemainingDurationMs()).toBeCloseTo(estimatedDuration, 8)
  })

  it('can apply a live presentation multiplier to an already-running movement session', () => {
    let paused = true
    const controller = createFreeRoamController(start)
    controller.moveAlong([target], undefined, { maxSpeed: sharedCharacterWalkSpeedPxPerSecond / screenMetrics.width, speedMultiplier: () => paused ? 0 : 1 })
    controller.tick(Number.MAX_SAFE_INTEGER)
    expect(controller.getCurrentPosition()).toEqual(start)
    paused = false
    controller.tick(Number.MAX_SAFE_INTEGER)
    expect(controller.getCurrentPosition().x).toBeGreaterThan(start.x)
  })
})
