import { describe, expect, it } from 'vitest'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { mainlineSceneRoute, mainlineScenes } from './mainlineScenes'
import {
  DEFAULT_MAINLINE_VIEWPORT_SIZE,
  MAINLINE_WORLD_SIZE,
  createMainlineViewportProjection,
  fixedFrameCameraOffset,
  mainlineCameraFollowAxes,
  mainlineCameraOffset,
  mainlineCameraTarget,
  mainlineViewportScale,
  mainlineWorldTransform,
  projectMainlineWorldPoint,
  projectMainlineWorldPointPercent,
  resolveMainlineViewportScaleMode,
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

  it.each([
    { width: 1280, height: 720, c: 1, d: 1 },
    { width: 390, height: 844, c: 844 / 720, d: .85 },
    { width: 320, height: 844, c: 844 / 720, d: .85 },
    { width: 419, height: 1024, c: 1024 / 720, d: .85 },
    { width: 844, height: 390, c: .85, d: .85 },
    { width: 834, height: 1194, c: 1.5, d: .85 },
    { width: 1194, height: 834, c: 834 / 720, d: 1194 / 1280 },
    { width: 1920, height: 1080, c: 1.5, d: 1.5 },
  ])('exposes reversible C/D scale candidates at $width×$height', ({ width, height, c, d }) => {
    expect(createMainlineViewportProjection({ width, height }, 'C').scale).toBeCloseTo(c, 3)
    expect(createMainlineViewportProjection({ width, height }, 'D').scale).toBeCloseTo(d, 3)
    expect(createMainlineViewportProjection({ width, height }, 'C').scaleMode).toBe('C')
    expect(createMainlineViewportProjection({ width, height }, 'D').scaleMode).toBe('D')
  })

  it('selects only explicit C/D URL candidates and otherwise preserves the current projection', () => {
    expect(resolveMainlineViewportScaleMode('?scene=jijia-ancestral-home&viewportScale=C')).toBe('C')
    expect(resolveMainlineViewportScaleMode('?viewportScale=D')).toBe('D')
    expect(resolveMainlineViewportScaleMode('?viewportScale=invalid')).toBe('current')
    expect(resolveMainlineViewportScaleMode('')).toBe('current')
    expect(createMainlineViewportProjection({ width: 390, height: 844 }).scaleMode).toBe('current')
  })

  it.each(['C', 'D', 'current'] as const)('keeps the %s viewport mode in scene routes', (mode) => {
    const route = mainlineSceneRoute('jijia-ancestral-interior', { x: 96, y: 50 }, 'resume', mode)
    const search = new URL(route, 'https://example.test').search

    expect(resolveMainlineViewportScaleMode(search)).toBe(mode)
    expect(route).toContain('entryX=96&entryY=50')
    expect(route).not.toContain('access_token')
    expect(route).not.toContain('unknownQuery')
  })

  it('keeps the selected mode through a multi-scene route sequence', () => {
    const sceneIds = ['jijia-ancestral-interior', 'jijia-ancestral-home', 'zhongshuyuan-passage', 'zhongshuyuan-office'] as const

    for (const sceneId of sceneIds) {
      const route = mainlineSceneRoute(sceneId, undefined, 'resume', 'C')
      expect(resolveMainlineViewportScaleMode(new URL(route, 'https://example.test').search)).toBe('C')
    }
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

  it('keeps a fixed room actor in the deadzone and preserves axes that fit', () => {
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
    const centerCamera = mainlineCameraOffset(scene, { x: 50, y: 50 }, false, projection)
    const centeredActor = projectMainlineWorldPointPercent({ x: 50, y: 50 }, centerCamera, projection)
    expect(centeredActor.x).toBeCloseTo(35, 0)
    expect(centeredActor.y).toBeCloseTo(50, 0)
  })

  const fixedFrameSceneCases = Object.values(mainlineScenes)
    .filter((scene) => scene.viewport === 'fixed-frame')
    .map((scene) => [scene.id, scene] as const)

  it.each(fixedFrameSceneCases)(
    'follows the player only along cropped axes in %s',
    (_id, scene) => {
      for (const size of [
        { width: 390, height: 844 },
        { width: 838, height: 2048 },
        { width: 1194, height: 834 },
      ]) {
        const projection = createMainlineViewportProjection(size)
        const axes = mainlineCameraFollowAxes(scene, projection)
        const center = {
          x: scene.walkBounds.x + scene.walkBounds.width / 2,
          y: scene.walkBounds.y + scene.walkBounds.height / 2,
        }
        const current = mainlineCameraOffset(scene, center, false, projection)
        const targetPosition = {
          x: center.x + (axes.x ? size.width / (projection.scale * projection.worldSize.width) * 100 * .45 : 0),
          y: center.y + (axes.y ? size.height / (projection.scale * projection.worldSize.height) * 100 * .45 : 0),
        }
        const target = mainlineCameraTarget(scene, targetPosition, current, false, projection)
        const screen = projectMainlineWorldPointPercent(targetPosition, target, projection)
        if (axes.x) expect(screen.x).toBeCloseTo(65, 0)
        else expect(target.x).toBeCloseTo(fixedFrameCameraOffset(scene, projection).x, 6)
        if (axes.y) expect(screen.y).toBeCloseTo(65, 0)
        else expect(target.y).toBeCloseTo(fixedFrameCameraOffset(scene, projection).y, 6)
      }
    },
  )

  it('composes stage centering and camera movement before the shared scale', () => {
    const projection = createMainlineViewportProjection({ width: 390, height: 844 })
    const transform = mainlineWorldTransform(projection, { x: 0, y: 0 })
    expect(transform).toContain(`translate3d(${projection.offset.x.toFixed(4)}px, ${projection.offset.y.toFixed(4)}px, 0) scale(${projection.scale.toFixed(6)})`)
  })
})
