import { describe, expect, it } from 'vitest'
import { mainlineCameraProjection, mainlinePortraitCameraScale } from './mainlineViewport'

const point = (x: number, y: number) => ({ x, y })
const bounds = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })

const scene = {
  id: 'zhongshuyuan-office' as const,
  viewport: 'fixed-frame' as const,
  walkBounds: bounds(6, 8, 88, 84),
}

describe('mainlineCameraProjection', () => {
  it('zooms and follows the actor in both axes for portrait interiors', () => {
    const actorPosition = point(45, 40)
    const viewport = { width: 390, height: 844 }
    const projection = mainlineCameraProjection(scene, actorPosition, viewport)

    expect(projection.scale).toBe(0.8)
    expect(projection.worldSize.width / projection.worldSize.height).toBeCloseTo(16 / 9)
    expect(projection.worldSize.width / 1280 * projection.scale).toBeCloseTo(projection.worldSize.height / 720 * projection.scale)
    expect(actorPosition.x * projection.scale + projection.offset.x).toBeCloseTo(50 * viewport.width / projection.worldSize.width)
    expect((scene.walkBounds.y + scene.walkBounds.height / 2) * projection.scale + projection.offset.y).toBeCloseTo(50 * viewport.height / projection.worldSize.height)
  })

  it('uses a lighter portrait scale for the street and stops at its world edge', () => {
    const street = { ...scene, id: 'commercial-street' as const, walkBounds: bounds(8, 10, 192, 80) }
    const streetEndPosition = point(196, 86)
    const viewport = { width: 390, height: 844 }
    const projection = mainlineCameraProjection(street, streetEndPosition, viewport)
    const visibleWidthPercent = viewport.width / projection.worldSize.width * 100
    const visibleHeightPercent = viewport.height / projection.worldSize.height * 100

    expect(projection.scale).toBe(0.8)
    expect(projection.offset.x).toBeCloseTo(visibleWidthPercent - 200 * projection.scale - visibleWidthPercent * 0.02)
    expect(projection.offset.y).toBeCloseTo(visibleHeightPercent / 2 - 50 * projection.scale)
  })

  it('preserves existing fixed-frame and embedded camera behavior outside the demo', () => {
    const actorPosition = point(30, 25)
    const landscape = mainlineCameraProjection(scene, actorPosition, { width: 1280, height: 720 })
    const embedded = mainlineCameraProjection(scene, actorPosition, { width: 390, height: 844 }, true)

    expect(landscape).toEqual({ offset: point(0, 0), scale: 1, worldSize: { width: 1280, height: 720 } })
    expect(embedded).toEqual({ offset: point(0, 0), scale: 1, worldSize: { width: 390, height: 844 } })
  })

  it('keeps the 390px phone at the default pull-back and caps narrow phones at 0.65', () => {
    expect(mainlinePortraitCameraScale({ width: 390, height: 844 })).toBe(0.8)
    expect(mainlinePortraitCameraScale({ width: 320, height: 844 })).toBeCloseTo(0.6564)
    expect(mainlinePortraitCameraScale({ width: 280, height: 844 })).toBe(0.65)
  })
})
