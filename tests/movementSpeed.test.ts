import { describe, expect, it } from 'vitest'
import { commercialCafeServerMovementDebugTarget } from '../src/center/runtime/mainlineSceneModel'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createFreeRoamController, movementDurationMsForPath, sharedCharacterMovementOptions, sharedCharacterWalkSpeedPxPerSecond } from '../src/center/runtime/useFreeRoamMovement'

describe('shared ordinary character movement speed', () => {
  const start = mainlineScenes['commercial-cafe'].initialPlayerPosition
  const target = commercialCafeServerMovementDebugTarget.position
  const screenMetrics = { width: 1000, height: 600 }

  it('uses 280 px/s as the single protagonist and NPC default', () => {
    expect(sharedCharacterWalkSpeedPxPerSecond).toBe(280)
    expect(sharedCharacterMovementOptions(screenMetrics)).toEqual({
      screenMetrics,
      screenSpeedPxPerSecond: 280,
    })
  })

  it('uses the same shared speed for path duration and the live movement controller', () => {
    const options = sharedCharacterMovementOptions(screenMetrics)
    const path = [target]
    const estimatedDuration = movementDurationMsForPath(path, start, options)
    const controller = createFreeRoamController(start)

    controller.moveAlong(path, undefined, options)

    const screenDistance = Math.hypot(
      (target.x - start.x) * screenMetrics.width / 100,
      (target.y - start.y) * screenMetrics.height / 100,
    )
    expect(estimatedDuration).toBeCloseTo(screenDistance / sharedCharacterWalkSpeedPxPerSecond * 1000, 8)
    expect(controller.getRemainingDurationMs()).toBeCloseTo(estimatedDuration, 8)
  })
})
