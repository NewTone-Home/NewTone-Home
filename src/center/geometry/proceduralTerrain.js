import {
  WORLD_MAP_BOUNDS,
  WORLD_MAP_PROJECTION,
} from '../data/centerWorldMap'

const DOMAIN = WORLD_MAP_BOUNDS
const EPSILON = .16
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function gaussian(x, y, centerX, centerY, amplitude, spread) {
  return amplitude * Math.exp(-(((x - centerX) ** 2 + (y - centerY) ** 2) / (spread ** 2)))
}

function hash2d(x, y) {
  const value = Math.sin((x * 127.1) + (y * 311.7) + 17.19) * 43758.5453
  return value - Math.floor(value)
}

function smoothNoise(x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const sx = tx * tx * (3 - (2 * tx))
  const sy = ty * ty * (3 - (2 * ty))
  const a = hash2d(x0, y0)
  const b = hash2d(x0 + 1, y0)
  const c = hash2d(x0, y0 + 1)
  const d = hash2d(x0 + 1, y0 + 1)
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}

function fractalNoise(x, y) {
  return (
    smoothNoise(x * .34, y * .34) * .48
    + smoothNoise(x * .76 + 13, y * .76 - 7) * .32
    + smoothNoise(x * 1.62 - 3, y * 1.62 + 5) * .2
  )
}

/**
 * One continuous scalar field drives every decorative layer. The grid used to
 * sample this function is never exposed as the map's visual skeleton.
 */
export function worldTerrainHeight(x, y) {
  const mainRidges = (
    gaussian(x, y, 4.1, 2.2, 4.4, 3.6)
    + gaussian(x, y, 14.2, 3.2, 3.35, 2.8)
    + gaussian(x, y, 9.35, 13.6, 4.1, 3.2)
    + gaussian(x, y, 6.7, 6.2, 1.1, 4.7)
  )
  const secondaryRidges = (
    gaussian(x, y, 2.0, 8.7, .56, 3.3)
    + gaussian(x, y, 13.1, 10.3, .64, 3.6)
  )
  const riverValley = gaussian(x, y, 7.35, 9.2, .9, 3.1)
  const noise = (fractalNoise(x, y) - .5) * .62
  const fold = Math.abs(Math.sin((x * .76) + (y * .37))) * .12
  return clamp(.13 + mainRidges + secondaryRidges - riverValley + noise + fold, .04, 5.9)
}

export function worldProjectPoint(x, y, z = 0, projection = WORLD_MAP_PROJECTION) {
  return [
    projection.originX + (x - y) * projection.tileX,
    projection.originY + (x + y) * projection.tileY - z * projection.height,
  ]
}

export function worldTerrainPoint(x, y, zOffset = 0) {
  return worldProjectPoint(x, y, worldTerrainHeight(x, y) + zOffset)
}

export function worldPathFromPoints(points, zOffset = 0, close = false) {
  if (!points.length) return ''
  const projected = points.map(([x, y, z = 0]) => worldTerrainPoint(x, y, z + zOffset))
  const commands = projected.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(' ')
  return close ? `${commands} Z` : commands
}

export function worldPolygonPath(points, zOffset = 0) {
  return worldPathFromPoints(points, zOffset, true)
}

export function worldLinePath(points, zOffset = 0) {
  return worldPathFromPoints(points, zOffset, false)
}

export function worldGridPath(axis, value, samples = 18) {
  const points = axis === 'x'
    ? Array.from({ length: samples + 1 }, (_, index) => [value, DOMAIN.minY + ((DOMAIN.maxY - DOMAIN.minY) * index / samples)])
    : Array.from({ length: samples + 1 }, (_, index) => [DOMAIN.minX + ((DOMAIN.maxX - DOMAIN.minX) * index / samples), value])
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
  const verticals = points.map((point, index) => `M${ground[index][0].toFixed(2)} ${ground[index][1].toFixed(2)} L${top[index][0].toFixed(2)} ${top[index][1].toFixed(2)}`)
  const polygon = values => `${values.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(' ')} Z`
  return {
    ground: polygon(ground),
    top: polygon(top),
    verticals: verticals.join(' '),
  }
}

function interpolate(a, valueA, b, valueB, level) {
  const denominator = valueB - valueA
  const ratio = Math.abs(denominator) < 0.00001 ? .5 : clamp((level - valueA) / denominator, 0, 1)
  return [a[0] + ((b[0] - a[0]) * ratio), a[1] + ((b[1] - a[1]) * ratio)]
}

function pointKey(point) {
  return `${Math.round(point[0] * 1000)}:${Math.round(point[1] * 1000)}`
}

function stitchSegments(segments) {
  const adjacency = new Map()
  const add = (key, index) => {
    const entries = adjacency.get(key) || []
    entries.push(index)
    adjacency.set(key, entries)
  }
  segments.forEach((segment, index) => {
    add(pointKey(segment[0]), index)
    add(pointKey(segment[1]), index)
  })

  const used = new Set()
  const polylines = []
  for (let index = 0; index < segments.length; index += 1) {
    if (used.has(index)) continue
    const seed = segments[index]
    used.add(index)
    const line = [seed[0], seed[1]]

    const extend = (prepend) => {
      let current = prepend ? line[0] : line[line.length - 1]
      let currentKey = pointKey(current)
      for (;;) {
        const candidate = (adjacency.get(currentKey) || []).find(segmentIndex => !used.has(segmentIndex))
        if (candidate === undefined) break
        used.add(candidate)
        const segment = segments[candidate]
        const next = pointKey(segment[0]) === currentKey ? segment[1] : segment[0]
        if (prepend) line.unshift(next)
        else line.push(next)
        current = next
        currentKey = pointKey(current)
        if (currentKey === pointKey(prepend ? line[line.length - 1] : line[0])) break
      }
    }

    extend(true)
    extend(false)
    if (line.length > 2) polylines.push(line)
  }
  return polylines
}

function contourPath(grid, cols, rows, level) {
  const segments = []
  const indexAt = (x, y) => (y * (cols + 1)) + x
  const edgePoints = (x, y) => {
    const p0 = [x, y]
    const p1 = [x + 1, y]
    const p2 = [x + 1, y + 1]
    const p3 = [x, y + 1]
    const v0 = grid[indexAt(x, y)]
    const v1 = grid[indexAt(x + 1, y)]
    const v2 = grid[indexAt(x + 1, y + 1)]
    const v3 = grid[indexAt(x, y + 1)]
    return {
      0: interpolate(p0, v0, p1, v1, level),
      1: interpolate(p1, v1, p2, v2, level),
      2: interpolate(p2, v2, p3, v3, level),
      3: interpolate(p3, v3, p0, v0, level),
      values: [v0, v1, v2, v3],
    }
  }

  const cases = {
    1: [[3, 0]],
    2: [[0, 1]],
    3: [[3, 1]],
    4: [[1, 2]],
    5: [[3, 0], [1, 2]],
    6: [[0, 2]],
    7: [[3, 2]],
    8: [[2, 3]],
    9: [[0, 2]],
    10: [[0, 1], [2, 3]],
    11: [[1, 2]],
    12: [[3, 1]],
    13: [[0, 1]],
    14: [[3, 0]],
  }

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const edges = edgePoints(x, y)
      const mask = edges.values.reduce((value, sample, index) => value | (sample >= level ? (1 << index) : 0), 0)
      const pairs = cases[mask]
      if (!pairs) continue
      for (const [startEdge, endEdge] of pairs) {
        const start = edges[startEdge]
        const end = edges[endEdge]
        const startWorld = [DOMAIN.minX + (start[0] / cols) * (DOMAIN.maxX - DOMAIN.minX), DOMAIN.minY + (start[1] / rows) * (DOMAIN.maxY - DOMAIN.minY)]
        const endWorld = [DOMAIN.minX + (end[0] / cols) * (DOMAIN.maxX - DOMAIN.minX), DOMAIN.minY + (end[1] / rows) * (DOMAIN.maxY - DOMAIN.minY)]
        segments.push([startWorld, endWorld])
      }
    }
  }

  return stitchSegments(segments).map(line => {
    const projected = line.map(([x, y]) => worldProjectPoint(x, y, level + .015))
    return projected.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(' ')
  }).join(' ')
}

function createGrid(cols, rows) {
  return Array.from({ length: (cols + 1) * (rows + 1) }, (_, index) => {
    const x = index % (cols + 1)
    const y = Math.floor(index / (cols + 1))
    const worldX = DOMAIN.minX + (x / cols) * (DOMAIN.maxX - DOMAIN.minX)
    const worldY = DOMAIN.minY + (y / rows) * (DOMAIN.maxY - DOMAIN.minY)
    return worldTerrainHeight(worldX, worldY)
  })
}

function createBoundary() {
  return Array.from({ length: 84 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 84
    const radial = 1 + ((fractalNoise(Math.cos(angle) * 2.2 + 21, Math.sin(angle) * 2.2 - 9) - .5) * .18)
    const x = 9 + Math.cos(angle) * 8.85 * radial
    const y = 8 + Math.sin(angle) * 7.55 * radial
    return [clamp(x, DOMAIN.minX + .16, DOMAIN.maxX - .16), clamp(y, DOMAIN.minY + .16, DOMAIN.maxY - .16)]
  })
}

function projectedSegmentPath(segments, zOffset = .02) {
  return segments.map(([a, b]) => {
    const start = worldTerrainPoint(a[0], a[1], zOffset)
    const end = worldTerrainPoint(b[0], b[1], zOffset)
    return `M${start[0].toFixed(2)} ${start[1].toFixed(2)} L${end[0].toFixed(2)} ${end[1].toFixed(2)}`
  }).join(' ')
}

function isInsideLooseLand(x, y) {
  const dx = (x - 9) / 9.05
  const dy = (y - 8) / 7.8
  return (dx * dx) + (dy * dy) < .95
}

function createIrregularNetwork() {
  const points = []
  for (let index = 0; index < 196; index += 1) {
    const x = DOMAIN.minX + (.05 + hash2d(index + 1, 4) * .9) * (DOMAIN.maxX - DOMAIN.minX)
    const y = DOMAIN.minY + (.05 + hash2d(index + 12, 8) * .9) * (DOMAIN.maxY - DOMAIN.minY)
    if (!isInsideLooseLand(x, y)) continue
    points.push([x, y, worldTerrainHeight(x, y)])
  }

  const bands = [[], [], []]
  for (let index = 0; index < points.length; index += 1) {
    const source = points[index]
    const nearest = points
      .map((target, targetIndex) => ({ target, targetIndex, distance: Math.hypot(target[0] - source[0], target[1] - source[1]) }))
      .filter(candidate => candidate.targetIndex !== index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4)
    for (const candidate of nearest) {
      if (candidate.targetIndex < index || candidate.distance > 3.2) continue
      const average = (source[2] + candidate.target[2]) / 2
      const band = average > 2.8 ? 2 : average > 1.4 ? 1 : 0
      bands[band].push([source, candidate.target])
    }
  }

  return {
    points,
    paths: bands.map((segments, index) => ({ level: index, d: projectedSegmentPath(segments, .045 + index * .012) })),
  }
}

function gradientAt(x, y) {
  const dx = (worldTerrainHeight(x + EPSILON, y) - worldTerrainHeight(x - EPSILON, y)) / (EPSILON * 2)
  const dy = (worldTerrainHeight(x, y + EPSILON) - worldTerrainHeight(x, y - EPSILON)) / (EPSILON * 2)
  return [dx, dy]
}

function traceGradient(startX, startY, direction, stepCount = 34) {
  let x = startX
  let y = startY
  const points = []
  for (let index = 0; index < stepCount; index += 1) {
    if (x < DOMAIN.minX || x > DOMAIN.maxX || y < DOMAIN.minY || y > DOMAIN.maxY) break
    points.push([x, y])
    const [dx, dy] = gradientAt(x, y)
    const magnitude = Math.hypot(dx, dy) || 1
    x += (dx / magnitude) * direction * .18
    y += (dy / magnitude) * direction * .18
  }
  return points.length > 6 ? worldLinePath(points, .09) : ''
}

function createGradientLines() {
  const ridgeLines = []
  const flowLines = []
  for (let index = 0; index < 52; index += 1) {
    const startX = DOMAIN.minX + (.08 + hash2d(index + 4, 3) * .84) * (DOMAIN.maxX - DOMAIN.minX)
    const startY = DOMAIN.minY + (.08 + hash2d(index + 8, 11) * .84) * (DOMAIN.maxY - DOMAIN.minY)
    const ridge = traceGradient(startX, startY, 1, 30 + (index % 12))
    const flow = traceGradient(startX, startY, -1, 38 + (index % 16))
    if (ridge) ridgeLines.push(ridge)
    if (flow) flowLines.push(flow)
  }
  return { ridgeLines, flowLines }
}

function createPointField(networkPoints) {
  return networkPoints
    .filter((_, index) => index % 3 !== 0)
    .map(([x, y, height], index) => {
      const point = worldTerrainPoint(x, y, .12)
      return { id: `terrain-point-${index}`, x: point[0], y: point[1], radius: height > 2.7 ? 1.55 : 1.05 }
    })
}

function createContourLayers() {
  const cols = 62
  const rows = 48
  const grid = createGrid(cols, rows)
  const minimum = Math.min(...grid)
  const maximum = Math.max(...grid)
  const levels = Array.from({ length: 24 }, (_, index) => minimum + ((maximum - minimum) * (index + 1) / 26))
  return levels.map((level, index) => ({
    id: `contour-${index}`,
    level,
    major: index % 4 === 0,
    d: contourPath(grid, cols, rows, level),
  }))
}

function createTerrainRenderData() {
  const boundary = createBoundary()
  const network = createIrregularNetwork()
  const gradientLines = createGradientLines()
  return Object.freeze({
    boundary,
    contours: createContourLayers(),
    network: network.paths,
    ridgeLines: gradientLines.ridgeLines,
    flowLines: gradientLines.flowLines,
    points: createPointField(network.points),
  })
}

export const PROCEDURAL_TERRAIN = createTerrainRenderData()
