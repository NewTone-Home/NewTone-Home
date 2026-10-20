import { describe, expect, it } from 'vitest'
import { mainlineCameraOffset, mainlineCameraTarget, mainlineWorldPointFromClient, mainlineWorldScale, mainlineVisibleWorldSpan } from './mainlineViewport'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'

describe('fixed mainline world projection', () => {
  it('keeps the 1920x1080 reference at 1:1', () => {
    expect(mainlineWorldScale(sceneDesignReferenceMetrics)).toBe(1)
    expect(mainlineVisibleWorldSpan(sceneDesignReferenceMetrics)).toEqual({ x: 100, y: 100 })
  })

  it.each([
    [{ width: 1920, height: 900 }, 900 / 1080],
    [{ width: 1280, height: 800 }, 800 / 1080],
    [{ width: 390, height: 844 }, 844 / 1080],
  ] as const)('uses one uniform projection at %ix%i', (viewport, expectedScale) => {
    const scale = mainlineWorldScale(viewport)
    expect(scale).toBeCloseTo(expectedScale, 8)
    const xPitch = 28 * scale
    const yPitch = 28 * scale
    expect(xPitch).toBeCloseTo(yPitch, 8)
  })

  it('maps a stage pointer through scale and camera exactly once', () => {
    const viewport = { width: 390, height: 844 }
    const cameraOffset = { x: -125, y: 0 }
    const stage = { left: 10, top: 20, width: 390, height: 844 }
    const center = mainlineWorldPointFromClient({ x: 205, y: 442 }, stage, viewport, cameraOffset)
    expect(center.x).toBeCloseTo(50 - cameraOffset.x, 8)
    expect(center.y).toBeCloseTo(50, 8)
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
})
