import type { MainlineSceneGeometryUnit, MainlineStorefrontSlot } from './mainlineScenes'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import type { CollisionBox, Point } from './sceneGeometry'

/** Ordinary stores have an entrance sign, not a traversable portal door. */
export type StorefrontContactGeometry = {
  visualBounds: CollisionBox
  physicalBounds: CollisionBox
  center: Point
  fontSizePx: number
  outward: Point
}

/** Shares the existing sign's CSS 12px / 1.2vw / 16px projection. */
export function storefrontContactGeometry(
  storefront: MainlineStorefrontSlot,
  units: readonly MainlineSceneGeometryUnit[],
  metrics: SceneScreenMetrics,
): StorefrontContactGeometry | null {
  if (storefront.portalId) return null
  const facade = units.filter(unit => unit.storefrontId === storefront.id && !unit.visualOnly)
  const cells = facade.flatMap(unit => unit.visual.cells).filter(cell => cell.storefrontRole === 'sign')
  if (!cells.length) return null
  const horizontal = storefront.edge === 'top' || storefront.edge === 'bottom'
  const start = Math.min(...cells.map(cell => cell.cellStart ?? (horizontal ? cell.x : cell.y)))
  const end = Math.max(...cells.map(cell => cell.cellEnd ?? (horizontal ? cell.x : cell.y)))
  const line = cells.reduce((sum, cell) => sum + (horizontal ? cell.y : cell.x), 0) / cells.length
  const fontSizePx = Math.max(12, Math.min(16, (metrics.viewportWidth ?? metrics.width) * .012))
  const textExtent = (Array.from(storefront.label).length * 1.08 + .7) * fontSizePx
  const tangentPixels = (end - start) * (horizontal ? metrics.width : metrics.height) / 100
  const extent = Math.min(textExtent, tangentPixels - .15 * fontSizePx)
  if (extent <= 0) return null
  // These are the visible sign slot's 1.4em dimensions used by the renderer.
  const width = (horizontal ? extent : 1.4 * fontSizePx) / metrics.width * 100
  const height = (horizontal ? 1.4 * fontSizePx : extent) / metrics.height * 100
  const center = horizontal ? { x: (start + end) / 2, y: line } : { x: line, y: (start + end) / 2 }
  const minX = Math.min(...facade.map(unit => unit.x)), minY = Math.min(...facade.map(unit => unit.y))
  const maxX = Math.max(...facade.map(unit => unit.x + unit.width)), maxY = Math.max(...facade.map(unit => unit.y + unit.height))
  const outward = storefront.edge === 'top' ? { x: 0, y: -1 }
    : storefront.edge === 'bottom' ? { x: 0, y: 1 }
    : storefront.edge === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 }
  return {
    center, fontSizePx, outward,
    visualBounds: { x: center.x - width / 2, y: center.y - height / 2, width, height },
    physicalBounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  }
}
