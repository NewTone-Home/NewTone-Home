import type { MainlineSceneDefinition } from './mainlineScenes'
import { mainlineCameraOffset, mainlineVisibleWorldSpan } from './mainlineViewport'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import type { Point } from './sceneGeometry'
import { activeStorefrontInteriorOwner } from './storefrontPresentation'

/** Only the public street uses pages; interiors retain normal camera follow. */
export function usesCommercialStreetPages(scene: MainlineSceneDefinition, position: Point) {
  return (scene.id === 'commercial-street' || scene.id === 'yonghe-mining-perimeter')
    && !activeStorefrontInteriorOwner(scene, position)
}

export function commercialStreetCameraPages(scene: MainlineSceneDefinition, viewport: SceneScreenMetrics, verticalAnchorY?: number) {
  const bounds = scene.walkBounds
  const y = verticalAnchorY ?? bounds.y + bounds.height / 2
  const first = 50 - mainlineCameraOffset(scene, { x: bounds.x, y }, false, viewport).x
  const last = 50 - mainlineCameraOffset(scene, { x: bounds.x + bounds.width, y }, false, viewport).x
  const span = mainlineVisibleWorldSpan(viewport).x
  const centers = [first]
  // Absorb a short terminal remainder, keeping each pan at most 80% of a
  // screen. This avoids an almost-duplicate final page and reverse chatter.
  while (last - centers.at(-1)! > span * .8 + .00001) centers.push(centers.at(-1)! + span * .75)
  if (last - centers.at(-1)! > .00001) centers.push(last)
  return { centers, span, yOffset: mainlineCameraOffset(scene, { x: first, y }, false, viewport).y }
}

export function commercialStreetPageIndex(centers: number[], x: number, span: number, current?: number) {
  if (current === undefined || current < 0 || current >= centers.length) {
    return centers.reduce((best, center, index) => Math.abs(center - x) < Math.abs(centers[best]! - x) ? index : best, 0)
  }
  let page = current
  // Target-page coordinates, not the in-flight camera, provide hysteresis.
  while (page < centers.length - 1 && x > centers[page]! + span * .4 + .00001) page++
  while (page > 0 && x < centers[page]! - span * .4 - .00001) page--
  return page
}
