import { describe, expect, it } from 'vitest'
import { advanceMainlineCamera, mainlineCameraOffset, mainlineCameraTarget, mainlineCameraVisualOutset, mainlineWorldPointAtViewportPercent, mainlineWorldPointFromClient, mainlineWorldScale, mainlineViewportPointFromWorld, mainlineVisibleWorldSpan } from './mainlineViewport'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'

describe('fixed mainline world projection', () => {
  it('keeps the regular exponential smoothing across common refresh rates', () => {
    const current = { x: 0, y: 0 }
    const target = { x: 0, y: 254 / (1080 * .65 / 100) }
    const runForOneSecond = (hz: number) => {
      let offset = current
      for (let frame = 0; frame < hz; frame += 1) {
        offset = advanceMainlineCamera(offset, target, 1000 / hz)
      }
      return offset
    }
    const at30 = runForOneSecond(30)
    const at60 = runForOneSecond(60)
    const at120 = runForOneSecond(120)

    expect(at30.y).toBeCloseTo(at60.y, 8)
    expect(at60.y).toBeCloseTo(at120.y, 8)
    const firstStep = advanceMainlineCamera(current, target, 1000 / 60)
    const firstStepPx = firstStep.y * 1080 * .65 / 100
    expect(firstStepPx).toBeGreaterThan(6)
    expect(firstStepPx).toBeCloseTo(254 * (1 - Math.exp(-(1000 / 60) / 140)), 4)
  })

  it('follows changing targets, settles after input stops, and reverses from its current offset', () => {
    let current = { x: 0, y: 0 }
    const step = (target: typeof current) => {
      const next = advanceMainlineCamera(current, target, 1000 / 60)
      expect(next.y).toBeCloseTo(current.y + (target.y - current.y) * (1 - Math.exp(-(1000 / 60) / 140)), 10)
      current = next
    }
    for (let frame = 0; frame < 12; frame += 1) step({ x: 0, y: 12 + frame * 2 })
    const beforeStop = current.y
    const fixedTarget = { x: 0, y: 100 }
    for (let frame = 0; frame < 120; frame += 1) step(fixedTarget)
    expect(Math.abs(fixedTarget.y - current.y)).toBeLessThan(.01)

    const beforeReverse = current.y
    step({ x: 0, y: -100 })
    expect(current.y).toBeLessThan(beforeReverse)
    expect(beforeStop).toBeLessThan(beforeReverse)
  })

  it('applies the candidate scale at the authored reference viewport', () => {
    const scale = mainlineWorldScale(sceneDesignReferenceMetrics)
    expect(mainlineWorldScale(sceneDesignReferenceMetrics)).toBeCloseTo(scale, 8)
    const span = mainlineVisibleWorldSpan(sceneDesignReferenceMetrics)
    expect(span.x).toBeCloseTo(100 / scale, 8)
    expect(span.y).toBeCloseTo(100 / scale, 8)
  })

  it.each([
    [{ width: 1920, height: 900 }, 1],
    [{ width: 1280, height: 800 }, 1],
    [{ width: 390, height: 844 }, .65],
  ] as const)('uses one uniform projection at %ix%i', (viewport, expectedScale) => {
    const scale = mainlineWorldScale(viewport)
    expect(scale).toBeCloseTo(expectedScale, 8)
    const xPitch = 28 * scale
    const yPitch = 28 * scale
    expect(xPitch).toBeCloseTo(yPitch, 8)
  })

  it.each([
    [{ width: 360, height: 800 }, .65],
    [{ width: 375, height: 550 }, .65],
    [{ width: 375, height: 667 }, .65],
    [{ width: 411.4, height: 913.9 }, .65],
    [{ width: 480, height: 800 }, .65],
    [{ width: 600, height: 900 }, .675],
    [{ width: 720, height: 900 }, .7],
    [{ width: 1024, height: 768 }, .8628571428571429],
    [{ width: 1280, height: 800 }, 1],
    [{ width: 528, height: 392.5 }, .65],
    [{ width: 707, height: 823 }, .6972916666666666],
    [{ width: 1920, height: 1080 }, 1],
    [{ width: 3440, height: 1440 }, 1],
  ] as const)('applies the device-width candidate at %ix%i', (viewport, expectedScale) => {
    expect(mainlineWorldScale(viewport)).toBeCloseTo(expectedScale, 8)
  })

  it('maps a stage pointer through scale and camera exactly once', () => {
    const viewport = { width: 390, height: 844 }
    const cameraOffset = { x: -125, y: 0 }
    const stage = { left: 10, top: 20, width: 390, height: 844 }
    const center = mainlineWorldPointFromClient({ x: 205, y: 442 }, stage, viewport, cameraOffset)
    expect(center.x).toBeCloseTo(50 - cameraOffset.x, 8)
    expect(center.y).toBeCloseTo(50, 8)
  })

  it.each([
    { viewport: { width: 390, height: 844 }, camera: { x: -125, y: 34 } },
    { viewport: { width: 1280, height: 800 }, camera: { x: 45, y: -20 } },
    { viewport: { width: 528, height: 392.5 }, camera: { x: 75, y: -18 } },
  ])('keeps a subtitle anchor fixed in the viewport while the scene camera moves', ({ viewport, camera }) => {
    const world = mainlineWorldPointAtViewportPercent({ x: 50, y: 90 }, viewport, camera)
    const screen = mainlineViewportPointFromWorld(world, viewport, camera)
    expect(screen.x).toBeCloseTo(50, 8)
    expect(screen.y).toBeCloseTo(90, 8)
  })

  it('centers fixed scenes when they fit and follows the actor when an axis overflows', () => {
    const scene = { viewport: 'fixed-frame', walkBounds: { x: 0, y: 0, width: 300, height: 100 } } as Parameters<typeof mainlineCameraOffset>[0]
    const desktop = mainlineCameraOffset(scene, { x: 180, y: 50 }, false, { width: 1920, height: 1080 })
    expect(desktop.x).toBeCloseTo(-130, 8)
    expect(desktop.y).toBeCloseTo(0, 8)
    const phone = mainlineCameraOffset(scene, { x: 180, y: 50 }, false, { width: 390, height: 844 })
    expect(phone.x).toBeCloseTo(-130, 8)
    expect(phone.y).toBeCloseTo(0, 8)
  })

  it.each([{ width: 390, height: 844 }, { width: 1280, height: 800 }])('shows both outer map edges with overscan at %j', (viewport) => {
    const scene = { viewport: 'follow-player', walkBounds: { x: 8, y: 10, width: 154.9134, height: 170 } } as Parameters<typeof mainlineCameraOffset>[0]
    const visible = mainlineVisibleWorldSpan(viewport)
    for (const axis of ['x', 'y'] as const) {
      const start = scene.walkBounds[axis]
      const end = start + (axis === 'x' ? scene.walkBounds.width : scene.walkBounds.height)
      const margin = Math.min(2, visible[axis] * .04)
      const near = mainlineCameraOffset(scene, { x: -1000, y: -1000 }, false, viewport)
      const far = mainlineCameraOffset(scene, { x: 1000, y: 1000 }, false, viewport)
      expect(50 - near[axis] - visible[axis] / 2).toBeCloseTo(start - margin, 8)
      expect(50 - far[axis] + visible[axis] / 2).toBeCloseTo(end + margin, 8)
      const target = mainlineCameraTarget(scene, { x: 1000, y: 1000 }, near, false, viewport)
      expect(target[axis]).toBeCloseTo(far[axis], 8)
      const returned = mainlineCameraTarget(scene, { x: -1000, y: -1000 }, far, false, viewport)
      expect(returned[axis]).toBeCloseTo(near[axis], 8)
    }
  })

  it('keeps a map smaller than the viewport centered and fully visible', () => {
    const viewport = { width: 390, height: 844 }
    const scene = { viewport: 'fixed-frame', walkBounds: { x: 8, y: 12, width: 10, height: 40 } } as Parameters<typeof mainlineCameraOffset>[0]
    const near = mainlineCameraOffset(scene, { x: -1000, y: -1000 }, false, viewport)
    const far = mainlineCameraOffset(scene, { x: 1000, y: 1000 }, false, viewport)
    expect(near).toEqual({ x: 37, y: 18 })
    expect(far).toEqual(near)
    const span = mainlineVisibleWorldSpan(viewport)
    expect(50 - near.x - span.x / 2).toBeLessThan(8)
    expect(50 - near.x + span.x / 2).toBeGreaterThan(18)
  })

  it('pans an exactly fitting fixed scene far enough to expose either boundary frame', () => {
    const viewport = { width: 1280, height: 800 }
    const scene = { viewport: 'fixed-frame', walkBounds: { x: 10, y: 18, width: 90, height: 64 } } as Parameters<typeof mainlineCameraOffset>[0]
    const span = mainlineVisibleWorldSpan(viewport)
    const outset = mainlineCameraVisualOutset(viewport)
    const left = mainlineCameraOffset(scene, { x: 14, y: 50 }, false, viewport)
    const right = mainlineCameraOffset(scene, { x: 96, y: 50 }, false, viewport)
    expect(50 - left.x - span.x / 2).toBeLessThanOrEqual(10 - outset.x)
    expect(50 - right.x + span.x / 2).toBeGreaterThanOrEqual(100 + outset.x)
    expect(left.x).toBeGreaterThan(right.x)
    expect(left.y).toBe(0)
    expect(right.y).toBe(0)
  })

  it('centers a scene that fits at the capped desktop viewport scale', () => {
    const scene = { viewport: 'fixed-frame', walkBounds: { x: 6, y: 8, width: 88, height: 84 } } as Parameters<typeof mainlineCameraOffset>[0]
    const viewport = { width: 1920, height: 1080 }
    const near = mainlineCameraOffset(scene, { x: 7, y: 10 }, false, viewport)
    const far = mainlineCameraOffset(scene, { x: 93, y: 90 }, false, viewport)
    expect(near.x).toBeCloseTo(far.x, 8)
    expect(near.y).toBeCloseTo(far.y, 8)
  })

  it('centers a fitting desktop courtyard and follows it when the phone view overflows', () => {
    const scene = { viewport: 'fixed-frame', walkBounds: { x: 10, y: 18, width: 90, height: 64 } } as Parameters<typeof mainlineCameraOffset>[0]
    const referenceNear = mainlineCameraOffset(scene, { x: 14, y: 50 }, false, sceneDesignReferenceMetrics)
    const referenceFar = mainlineCameraOffset(scene, { x: 96, y: 50 }, false, sceneDesignReferenceMetrics)
    expect(referenceNear.x).toBeCloseTo(referenceFar.x, 8)
    const phone = { width: 390, height: 844 }
    expect(mainlineCameraOffset(scene, { x: 14, y: 50 }, false, phone).x).toBeGreaterThan(mainlineCameraOffset(scene, { x: 96, y: 50 }, false, phone).x)
  })
})
