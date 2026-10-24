import type { CollisionBox, Point } from './sceneGeometry'
import { mainlineWorldFontSizePx, sceneDesignReferenceMetrics } from './sceneBoundaryGrid'

export type MainlineReadingOcclusionRect = CollisionBox
export const mainlineReadingOcclusionFadeWorldPx = mainlineWorldFontSizePx
export const mainlineReadingWorldWidthPx = sceneDesignReferenceMetrics.width
export const mainlineReadingWorldHeightPx = sceneDesignReferenceMetrics.height

export type MainlineReadingOcclusionSnapshot = {
  sessionKey: string
  rect: CollisionBox
  region: CollisionBox
  protectedEntityIds: ReadonlySet<string>
}

function sameBox(a: CollisionBox, b: CollisionBox) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/** Preserve the old snapshot reference when a fresh layout has identical values. */
export function retainMainlineReadingOcclusionSnapshot<T extends MainlineReadingOcclusionSnapshot>(current: T | null, next: T): T {
  if (current
    && current.sessionKey === next.sessionKey
    && sameBox(current.rect, next.rect)
    && sameBox(current.region, next.region)
    && current.protectedEntityIds.size === next.protectedEntityIds.size
    && [...current.protectedEntityIds].every(id => next.protectedEntityIds.has(id))) return current
  return next
}

export function mainlineReadingOcclusionRect(
  position: Point,
  layout: { widthPx: number; heightPx: number },
  worldScale: number,
  projectedX: (value: number) => number = value => value,
) {
  const scale = Math.max(.01, worldScale)
  const centerX = projectedX(position.x) / 100 * 1920
  const centerY = position.y / 100 * 1080
  const width = Math.max(0, layout.widthPx / scale)
  const height = Math.max(0, layout.heightPx / scale)
  return { x: centerX - width / 2, y: centerY - height / 2, width, height }
}

/** Alpha is 0 in the reading rectangle and rises linearly to 1 over one world glyph. */
export function mainlineReadingOcclusionAlpha(point: Point, rect: MainlineReadingOcclusionRect, fadeWidthWorldPx = mainlineReadingOcclusionFadeWorldPx) {
  const outsideX = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
  const outsideY = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
  return Math.max(0, Math.min(1, Math.hypot(outsideX, outsideY) / Math.max(.01, fadeWidthWorldPx)))
}

export function mainlineReadingOcclusionIntersects(bounds: CollisionBox, rect: MainlineReadingOcclusionRect, featherWorldPx = mainlineReadingOcclusionFadeWorldPx) {
  return bounds.x <= rect.x + rect.width + featherWorldPx
    && bounds.x + bounds.width >= rect.x - featherWorldPx
    && bounds.y <= rect.y + rect.height + featherWorldPx
    && bounds.y + bounds.height >= rect.y - featherWorldPx
}

export function mainlineReadingWorldPoint(point: Point, projectedX: (value: number) => number = value => value) {
  return { x: projectedX(point.x) / 100 * mainlineReadingWorldWidthPx, y: point.y / 100 * mainlineReadingWorldHeightPx }
}

export function mainlineReadingWorldBox(bounds: CollisionBox, projectedX: (value: number) => number = value => value, paddingWorldPx = 0) {
  const x1 = projectedX(bounds.x) / 100 * mainlineReadingWorldWidthPx
  const x2 = projectedX(bounds.x + bounds.width) / 100 * mainlineReadingWorldWidthPx
  const y1 = bounds.y / 100 * mainlineReadingWorldHeightPx
  const y2 = (bounds.y + bounds.height) / 100 * mainlineReadingWorldHeightPx
  const padding = Math.max(0, paddingWorldPx)
  return { x: Math.min(x1, x2) - padding, y: Math.min(y1, y2) - padding, width: Math.abs(x2 - x1) + padding * 2, height: Math.abs(y2 - y1) + padding * 2 }
}

/** Place an authored world point inside a bounded visual wrapper. */
export function mainlineReadingLocalPercent(point: Point, bounds: CollisionBox, projectedX: (value: number) => number = value => value) {
  const world = mainlineReadingWorldPoint(point, projectedX)
  return {
    x: bounds.width > 0 ? (world.x - bounds.x) / bounds.width * 100 : 50,
    y: bounds.height > 0 ? (world.y - bounds.y) / bounds.height * 100 : 50,
  }
}

export function mainlineReadingLocalMaskBounds(bounds: CollisionBox, rect: MainlineReadingOcclusionRect) {
  return { x: -bounds.x, y: -bounds.y, width: bounds.width, height: bounds.height,
    readingRect: { x: rect.x - bounds.x, y: rect.y - bounds.y, width: rect.width, height: rect.height } }
}

/** Convert normalized scene bounds to the renderer's 1920×1080 world coordinate system. */
export function mainlineOcclusionWorldRect(
  bounds: CollisionBox,
  projectedX: (value: number) => number = value => value,
  paddingWorldPx = 0,
): MainlineReadingOcclusionRect {
  const x1 = projectedX(bounds.x) / 100 * 1920
  const x2 = projectedX(bounds.x + bounds.width) / 100 * 1920
  const y1 = bounds.y / 100 * 1080
  const y2 = (bounds.y + bounds.height) / 100 * 1080
  const pad = Math.max(0, paddingWorldPx)
  return {
    x: Math.min(x1, x2) - pad,
    y: Math.min(y1, y2) - pad,
    width: Math.abs(x2 - x1) + pad * 2,
    height: Math.abs(y2 - y1) + pad * 2,
  }
}

export function mainlineReadingOcclusionMaskRegion(
  sceneBounds: CollisionBox,
  readingRect: MainlineReadingOcclusionRect,
  paddingWorldPx = mainlineReadingOcclusionFadeWorldPx * 2,
) {
  const bounds = [mainlineOcclusionWorldRect(sceneBounds), readingRect]
  const left = Math.min(...bounds.map(rect => rect.x)) - paddingWorldPx
  const top = Math.min(...bounds.map(rect => rect.y)) - paddingWorldPx
  const right = Math.max(...bounds.map(rect => rect.x + rect.width)) + paddingWorldPx
  const bottom = Math.max(...bounds.map(rect => rect.y + rect.height)) + paddingWorldPx
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function mainlineReadingOcclusionUrl(id: string) {
  return `url(#${id})`
}
