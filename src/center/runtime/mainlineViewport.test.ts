import { describe, expect, it } from 'vitest'
import type { MainlineSceneDefinition } from './mainlineScenes'
import {
  DEFAULT_MAINLINE_VIEWPORT_SIZE,
  MAINLINE_WORLD_SIZE,
  createMainlineViewportProjection,
  fixedFrameCameraOffset,
  mainlineCameraOffset,
  mainlineCameraTarget,
  mainlineViewportScale,
  mainlineWorldTransform,
  projectMainlineWorldPoint,
  projectMainlineWorldPointPercent,
  unprojectMainlineViewportPoint,
} from './mainlineViewport'

const viewportMatrix = [
  { width: 1280, height: 720, expectedScale: 1 },
  { width: 1920, height: 1080, expectedScale: 1.5 },
  { width: 1024, height: 768, expectedScale: .99 },
  { width: 834, height: 1194, expectedScale: 1.21 },
  { width: 1194, height: 834, expectedScale: 1.09 },
  { width: 390, height: 844, expectedScale: .8 },
  { width: 320, height: 844, expectedScale: .76 },
]

const followScene = {
  viewport: 'follow-player',
  walkBounds: { x: 0, y: 0, width: 100, height: 100 },
} as Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'>

describe('unified mainline viewport projection', () => {
  it.each(viewportMatrix)('keeps one logical world at $width×$height', ({ width, height, expectedScale }) => {
    const projection = createMainlineViewportProjection({ width, height })
    expect(projection.worldSize).toEqual({ width: 1280, height: 720 })
    expect(projection.scale).toBeCloseTo(expectedScale, 1)
    expect(mainlineViewportScale({ width, height })).toBe(projection.scale)
  })

  it('keeps the authored 1280×720 composition at unit scale', () => {
    expect(MAINLINE_WORLD_SIZE).toEqual({ width: 1280, height: 720 })
    expect(createMainlineViewportProjection(DEFAULT_MAINLINE_VIEWPORT_SIZE)).toMatchObject({
      scale: 1,
      offset: { x: 0, y: 0 },
    })
  })

  it.each(viewportMatrix)('round-trips world points through the $width×$height projection', ({ width, height }) => {
    const projection = createMainlineViewportProjection({ width, height })
    const cameraOffset = { x: -17.25, y: 8.5 }
    const worldPoint = { x: 36.75, y: 61.125 }
    const screenPoint = projectMainlineWorldPoint(worldPoint, cameraOffset, projection)
    const actual = unprojectMainlineViewportPoint(screenPoint, cameraOffset, projection)
    expect(actual.x).toBeCloseTo(worldPoint.x, 8)
    expect(actual.y).toBeCloseTo(worldPoint.y, 8)
  })

  it('uses one invertible camera projection for mobile deadzone following', () => {
    const projection = createMainlineViewportProjection({ width: 390, height: 844 })
    const position = { x: 18, y: 68 }
    const initialOffset = mainlineCameraOffset(followScene, position, false, projection)
    const initialScreenPoint = projectMainlineWorldPointPercent(position, initialOffset, projection)
    expect(initialScreenPoint.x).toBeCloseTo(50, 1)

    const target = mainlineCameraTarget(followScene, { x: 34, y: 68 }, initialOffset, false, projection)
    const followedPoint = projectMainlineWorldPointPercent({ x: 34, y: 68 }, target, projection)
    expect(followedPoint.x).toBeCloseTo(65, 1)
    expect(target.x).toBeLessThan(initialOffset.x)
  })

  it('keeps an authored spawn visible when the portrait edge clamp would crop it', () => {
    const projection = createMainlineViewportProjection({ width: 390, height: 844 })
    const scene = {
      ...followScene,
      walkBounds: { x: 24, y: 10, width: 72, height: 80 },
    }
    const position = { x: 18, y: 68 }
    const camera = mainlineCameraOffset(scene, position, false, projection)
    const actor = projectMainlineWorldPointPercent(position, camera, projection)
    expect(actor.x).toBeGreaterThanOrEqual(35)
    expect(actor.x).toBeLessThanOrEqual(65)
  })

  it('shifts a fixed room frame only when the requested actor would be cropped', () => {
    const projection = createMainlineViewportProjection({ width: 390, height: 844 })
    const scene = {
      viewport: 'fixed-frame',
      walkBounds: { x: 24, y: 10, width: 72, height: 80 },
    } as Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'>
    const position = { x: 18, y: 68 }
    const camera = mainlineCameraOffset(scene, position, false, projection)
    const actor = projectMainlineWorldPointPercent(position, camera, projection)
    expect(actor.x).toBeGreaterThanOrEqual(35)
    expect(actor.x).toBeLessThanOrEqual(65)
    expect(mainlineCameraOffset(scene, { x: 50, y: 50 }, false, projection)).toEqual(fixedFrameCameraOffset(scene, projection))
  })

  it('composes stage centering and camera movement before the shared scale', () => {
    const projection = createMainlineViewportProjection({ width: 390, height: 844 })
    const transform = mainlineWorldTransform(projection, { x: 0, y: 0 })
    expect(transform).toContain(`translate3d(${projection.offset.x.toFixed(4)}px, ${projection.offset.y.toFixed(4)}px, 0) scale(${projection.scale.toFixed(6)})`)
  })
})
