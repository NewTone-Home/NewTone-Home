import {
  WORLD_MAP_BOUNDS,
  WORLD_MAP_PROJECTION,
} from '../data/centerWorldMap'

const peak = (x, y, centerX, centerY, amplitude, spread) => (
  amplitude * Math.exp(-(((x - centerX) ** 2 + (y - centerY) ** 2) / (spread ** 2)))
)

export function worldProjectPoint(x, y, z = 0, projection = WORLD_MAP_PROJECTION) {
  return [
    projection.originX + (x - y) * projection.tileX,
    projection.originY + (x + y) * projection.tileY - z * projection.height,
  ]
}

export function worldTerrainHeight(x, y) {
  const elevation = .1
    + peak(x, y, 4.35, 2.3, 4.55, 3.4)
    + peak(x, y, 14.15, 3.05, 3.15, 2.8)
    + peak(x, y, 9.55, 13.45, 4.05, 3.2)
    + .12 * Math.sin(x * .9 + y * .28)
    + .08 * Math.cos(x * .35 - y * .8)

  return Math.max(0, elevation)
}

export function worldTerrainPoint(x, y, zOffset = 0) {
  return worldProjectPoint(x, y, worldTerrainHeight(x, y) + zOffset)
}

export function worldPathFromPoints(points, zOffset = 0, close = false) {
  if (!points.length) return ''
  const projected = points.map(([x, y, z = 0]) => worldTerrainPoint(x, y, z + zOffset))
  const commands = projected.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0]} ${point[1]}`).join(' ')
  return close ? `${commands} Z` : commands
}

export function worldPolygonPath(points, zOffset = 0) {
  return worldPathFromPoints(points, zOffset, true)
}

export function worldLinePath(points, zOffset = 0) {
  if (!points.length) return ''
  const projected = points.map(([x, y, z = 0]) => worldTerrainPoint(x, y, z + zOffset))
  return projected.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0]} ${point[1]}`).join(' ')
}

export function worldGridPath(axis, value, samples = 18) {
  const points = axis === 'x'
    ? Array.from({ length: samples + 1 }, (_, index) => [value, WORLD_MAP_BOUNDS.minY + ((WORLD_MAP_BOUNDS.maxY - WORLD_MAP_BOUNDS.minY) * index / samples)])
    : Array.from({ length: samples + 1 }, (_, index) => [WORLD_MAP_BOUNDS.minX + ((WORLD_MAP_BOUNDS.maxX - WORLD_MAP_BOUNDS.minX) * index / samples), value])
  return worldLinePath(points, .035)
}

export function worldRingPath([centerX, centerY], radius, ringScale = 1, segments = 24, zOffset = 0) {
  const points = Array.from({ length: segments }, (_, index) => {
    const angle = (Math.PI * 2 * index) / segments
    return [
      centerX + Math.cos(angle) * radius * ringScale,
      centerY + Math.sin(angle) * radius * ringScale,
    ]
  })
  return worldLinePath(points, zOffset)
}

export function worldFootprint(points, height) {
  const ground = points.map(([x, y]) => worldTerrainPoint(x, y))
  const top = points.map(([x, y]) => worldTerrainPoint(x, y, height))
  const verticals = points.map((point, index) => `M${ground[index][0]} ${ground[index][1]} L${top[index][0]} ${top[index][1]}`)
  const polygon = values => `${values.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0]} ${point[1]}`).join(' ')} Z`
  return {
    ground: polygon(ground),
    top: polygon(top),
    verticals: verticals.join(' '),
  }
}
