import { describe, expect, it } from 'vitest'
import { mainlineCameraOffset, mainlineWorldPointFromClient, mainlineWorldScale, mainlineVisibleWorldSpan } from './mainlineViewport'
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
})
