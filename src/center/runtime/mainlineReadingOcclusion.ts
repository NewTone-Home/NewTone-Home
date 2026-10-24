import type { CollisionBox, Point } from './sceneGeometry'

export type MainlineReadingOcclusionRect = CollisionBox

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
export function mainlineReadingOcclusionAlpha(point: Point, rect: MainlineReadingOcclusionRect, fadeWidthWorldPx = 16) {
  const outsideX = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
  const outsideY = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
  return Math.max(0, Math.min(1, Math.hypot(outsideX, outsideY) / Math.max(.01, fadeWidthWorldPx)))
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

export function mainlineReadingOcclusionUrl(id: string) {
  return `url(#${id})`
}
