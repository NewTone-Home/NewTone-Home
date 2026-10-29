import type { CollisionBox, Point } from './sceneGeometry'
import { mainlineWorldFontSizePx, sceneDesignReferenceMetrics } from './sceneBoundaryGrid'

export type MainlineReadingOcclusionRect = CollisionBox
export const mainlineReadingOcclusionFadeWorldPx = mainlineWorldFontSizePx
export const mainlineReadingWorldWidthPx = sceneDesignReferenceMetrics.width
export const mainlineReadingWorldHeightPx = sceneDesignReferenceMetrics.height

export type MainlineReadingOcclusionSnapshot = {
  sessionKey: string
  contextKey: string
  rect: CollisionBox
  protectedEntityIds: ReadonlySet<string>
  hiddenIdentityKeys: ReadonlySet<string>
}

function sameBox(a: CollisionBox, b: CollisionBox) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/** Preserve the old snapshot reference when a fresh layout has identical values. */
export function retainMainlineReadingOcclusionSnapshot<T extends MainlineReadingOcclusionSnapshot>(current: T | null, next: T): T {
  if (current
    && current.sessionKey === next.sessionKey
    && current.contextKey === next.contextKey) return current
  return next
}

export type MainlineReadingOcclusionCandidate = {
  identityKey: string
  entityId?: string
  relatedEntityIds?: readonly string[]
  bounds: CollisionBox
  spaceId?: string
}

/** Shared visual groups (for example a multi-cell menu) hide as one identity.
 * The space suffix prevents unrelated groups in different rooms from sharing
 * a reading hit identity. Ordinary wall cells keep their own cell IDs. */
export function mainlineReadingOcclusionGroupIdentity(group: string, spaceId?: string) {
  return `focus-group:${group}:space:${spaceId ?? 'unassigned'}`
}

export function mainlineReadingOcclusionCellIdentity(cellId: string, focusGroup?: string, spaceId?: string) {
  return focusGroup ? mainlineReadingOcclusionGroupIdentity(focusGroup, spaceId) : cellId
}

/** Freeze whole-object hits for one reading envelope, excluding protected targets and other spaces. */
export function mainlineReadingOccludedIdentityKeys(
  candidates: readonly MainlineReadingOcclusionCandidate[],
  rect: MainlineReadingOcclusionRect,
  protectedIdentityKeys: ReadonlySet<string>,
  activeSpaceId: string | undefined,
  featherWorldPx = mainlineReadingOcclusionFadeWorldPx,
) {
  return new Set(candidates.filter(candidate =>
    !protectedIdentityKeys.has(candidate.identityKey)
    && !(candidate.entityId && protectedIdentityKeys.has(candidate.entityId))
    && !(candidate.relatedEntityIds?.some(id => protectedIdentityKeys.has(id)))
    && (!candidate.spaceId || candidate.spaceId === activeSpaceId)
    && mainlineReadingOcclusionIntersects(candidate.bounds, rect, featherWorldPx))
    .map(candidate => candidate.identityKey))
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

export type MainlineReadingProtectionRect = CollisionBox

/** Add the existing two-glyph spatial breathing room to each measured glyph independently. */
export function mainlineReadingGlyphSafetyRects(glyphRects: readonly MainlineReadingProtectionRect[], fontSizePx: number) {
  const fontSize = Math.max(1, fontSizePx)
  const horizontalClearance = fontSize
  const verticalClearance = fontSize * .22
  return glyphRects.filter(rect => rect.width > 0 && rect.height > 0).map(rect => ({
    x: rect.x - horizontalClearance,
    y: rect.y - verticalClearance,
    width: rect.width + horizontalClearance * 2,
    height: rect.height + verticalClearance * 2,
  }))
}

/**
 * Hide scene art only under the currently painted reading ink and frame
 * strokes. Each region is a separate transparent hole; intersecting the mask
 * layers makes their holes add spatially without weakening the remaining ink.
 * Bounds and protection rectangles are measured in the same screen space.
 */
export function mainlineReadingLocalFadeMask(
  bounds: CollisionBox,
  regions: readonly MainlineReadingProtectionRect[],
  innerMarginPx = 2,
  featherPx = 6,
  continuous = false,
) {
  if (bounds.width <= 0 || bounds.height <= 0 || featherPx <= 0) return null
  const continuousRegion = continuous && regions.length
    ? (() => {
        const left = Math.min(...regions.map(region => region.x))
        const top = Math.min(...regions.map(region => region.y))
        const right = Math.max(...regions.map(region => region.x + region.width))
        const bottom = Math.max(...regions.map(region => region.y + region.height))
        return [{ x: left, y: top, width: right - left, height: bottom - top }]
      })()
    : null
  const gradients = (continuousRegion ?? regions).flatMap(region => {
    if (region.width <= 0 || region.height <= 0) return []
    const innerX = region.width / 2 + Math.max(0, innerMarginPx)
    const innerY = region.height / 2 + Math.max(0, innerMarginPx)
    // A normal ellipse leaves its four corners uncovered. For a framed menu,
    // expand the ellipse enough that its transparent center contains the
    // complete rectangular reading surface; the remaining outer ring stays a
    // small local feather rather than revealing gaps between rows and edges.
    const outerX = continuous ? innerX * Math.SQRT2 + featherPx * 2 : innerX + featherPx
    const outerY = continuous ? innerY * Math.SQRT2 + featherPx * 2 : innerY + featherPx
    if (region.x + region.width < bounds.x - outerX
      || region.x > bounds.x + bounds.width + outerX
      || region.y + region.height < bounds.y - outerY
      || region.y > bounds.y + bounds.height + outerY) return []
    const centerX = region.x + region.width / 2 - bounds.x
    const centerY = region.y + region.height / 2 - bounds.y
    const cornerRadius = Math.hypot(innerX / outerX, innerY / outerY)
    const clearStop = continuous
      ? Math.min(99, (cornerRadius + .01) * 100)
      : Math.max(innerX / outerX, innerY / outerY) * 100
    const percent = (value: number) => `${Number(value.toFixed(3))}%`
    return [`radial-gradient(ellipse ${percent(outerX / bounds.width * 100)} ${percent(outerY / bounds.height * 100)} at ${percent(centerX / bounds.width * 100)} ${percent(centerY / bounds.height * 100)}, transparent 0%, transparent ${percent(clearStop)}, #000 100%)`]
  })
  return gradients.length ? gradients.join(', ') : null
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
