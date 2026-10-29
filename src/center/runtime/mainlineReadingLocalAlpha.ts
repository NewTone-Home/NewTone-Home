import type { CollisionBox, Point } from './sceneGeometry'

export type MainlineReadingAlphaRegion = CollisionBox

export type MainlineReadingAlphaCell = {
  key: string
  x: number
  y: number
  size: number
  width: number
  height: number
  target: number
}

export const mainlineReadingAlphaCellLimit = 4096
export const mainlineReadingAlphaEnterMs = 45
export const mainlineReadingAlphaExitMs = 140
export const mainlineReadingAlphaFeatherOffset = 8
export const mainlineReadingAlphaFeatherStdDev = 4

export function mainlineReadingAlphaCellSize(bounds: CollisionBox, limit = mainlineReadingAlphaCellLimit) {
  if (!(bounds.width > 0) || !(bounds.height > 0)) return 3
  let size = Math.max(2.5, Math.sqrt(bounds.width * bounds.height / Math.max(1, limit)))
  while (Math.ceil(bounds.width / size) * Math.ceil(bounds.height / size) > limit) size *= 1.025
  return size
}

function erf(value: number) {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * x)
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - polynomial * Math.exp(-x * x))
}

/** Core opacity is exactly 1; the old 8px expansion plus 4px Gaussian rim is retained outside it. */
export function mainlineReadingAlphaAt(point: Point, region: MainlineReadingAlphaRegion) {
  const dx = Math.max(region.x - point.x, 0, point.x - (region.x + region.width))
  const dy = Math.max(region.y - point.y, 0, point.y - (region.y + region.height))
  if (dx === 0 && dy === 0) return 1
  const distance = Math.hypot(dx, dy)
  const z = (mainlineReadingAlphaFeatherOffset - distance) / (mainlineReadingAlphaFeatherStdDev * Math.SQRT2)
  return Math.max(0, Math.min(1, (1 + erf(z)) / 2))
}

/** Evaluate coverage against the whole fixed cell, not just its center.
 * A thin protected stroke can cross a cell while missing its center; treating
 * that cell as uncovered lets the background stroke leak through the reading
 * core. Full alpha is applied only when the cell intersects the core; the
 * existing spatial feather is measured from the nearest cell edge otherwise.
 */
export function mainlineReadingAlphaForCell(cell: Pick<MainlineReadingAlphaCell, 'x' | 'y' | 'width' | 'height'>, region: MainlineReadingAlphaRegion) {
  const dx = Math.max(region.x - (cell.x + cell.width), 0, cell.x - (region.x + region.width))
  const dy = Math.max(region.y - (cell.y + cell.height), 0, cell.y - (region.y + region.height))
  if (dx === 0 && dy === 0) return 1
  const distance = Math.hypot(dx, dy)
  const z = (mainlineReadingAlphaFeatherOffset - distance) / (mainlineReadingAlphaFeatherStdDev * Math.SQRT2)
  return Math.max(0, Math.min(1, (1 + erf(z)) / 2))
}

/** Rasterize only cells touched by this plane's current text/frame regions; grid coordinates stay fixed for the plane lifetime. */
export function rasterizeMainlineReadingAlphaField(
  bounds: Pick<CollisionBox, 'width' | 'height'>,
  regions: readonly MainlineReadingAlphaRegion[],
  cellSize: number,
): MainlineReadingAlphaCell[] {
  const size = Math.max(1, cellSize)
  const columns = Math.max(1, Math.ceil(bounds.width / size))
  const rows = Math.max(1, Math.ceil(bounds.height / size))
  const limit = mainlineReadingAlphaFeatherOffset + mainlineReadingAlphaFeatherStdDev * 4
  const values = new Map<string, MainlineReadingAlphaCell>()

  for (const region of regions) {
    if (region.width <= 0 || region.height <= 0) continue
    const left = Math.max(0, Math.floor((region.x - limit) / size))
    const top = Math.max(0, Math.floor((region.y - limit) / size))
    const right = Math.min(columns - 1, Math.floor((region.x + region.width + limit) / size))
    const bottom = Math.min(rows - 1, Math.floor((region.y + region.height + limit) / size))
    for (let row = top; row <= bottom; row += 1) {
      const y = row * size
      for (let column = left; column <= right; column += 1) {
        const x = column * size
        const key = `${column}:${row}`
        const width = Math.min(size, bounds.width - x)
        const height = Math.min(size, bounds.height - y)
        const target = mainlineReadingAlphaForCell({ x, y, width, height }, region)
        if (target <= .005) continue
        const previous = values.get(key)
        if (previous) previous.target = Math.max(previous.target, target)
        else values.set(key, { key, x, y, size, width, height, target })
      }
    }
  }
  return [...values.values()]
}

export function mainlineReadingAlphaTransitionValue(from: number, to: number, startedAt: number, durationMs: number, now: number) {
  if (durationMs <= 0) return to
  const progress = Math.max(0, Math.min(1, (now - startedAt) / durationMs))
  const eased = progress * progress * (3 - 2 * progress)
  return from + (to - from) * eased
}
