/*
 * A deliberately small, high-detail local map sample.
 *
 * This is not a second renderer. It is a compact data set made from the same
 * primitives the world map will eventually consume: projected terrain points,
 * triangular facets, relief rings, hydrology and wireframe building records.
 * Keeping the sample deterministic makes it useful as a visual acceptance
 * fixture while the larger world map is still being shaped.
 */

const VIEWBOX = Object.freeze({ width: 1600, height: 1000 })
const DOMAIN = Object.freeze({ width: 14, height: 10 })
const PROJECTION = Object.freeze({ originX: 800, originY: 150, tileX: 52, tileY: 30, height: 42 })

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function unit(value) {
  const sample = Math.sin((value * 91.17) + 17.31) * 43758.5453
  return sample - Math.floor(sample)
}

function format(value) {
  return Number(value).toFixed(2)
}

function pointKey(x, y) {
  return `${x.toFixed(3)}:${y.toFixed(3)}`
}

function project(x, y, z = 0) {
  return [
    PROJECTION.originX + (x - y) * PROJECTION.tileX,
    PROJECTION.originY + (x + y) * PROJECTION.tileY - z * PROJECTION.height,
  ]
}

function pathFromPoints(points, close = false) {
  if (!points.length) return ''
  const commands = [`M${format(points[0][0])} ${format(points[0][1])}`]
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L${format(points[index][0])} ${format(points[index][1])}`)
  }
  if (close) commands.push('Z')
  return commands.join(' ')
}

function logicalPath(points, z = 0, close = false) {
  return pathFromPoints(points.map(point => project(point[0], point[1], point.length > 2 ? point[2] : z)), close)
}

function heightAt(x, y) {
  const peak = (cx, cy, radius, height) => {
    const dx = (x - cx) / radius
    const dy = (y - cy) / (radius * .82)
    return height * Math.exp(-((dx * dx) + (dy * dy)) * 1.55)
  }

  const ridgeY = 2.25 + Math.sin(x * .55) * .25 + x * .16
  const ridge = .72 * Math.exp(-((y - ridgeY) ** 2) / 1.65)
  const valley = .45 * Math.exp(-(((x - 7.1) ** 2) / 13 + ((y - 6.9) ** 2) / 4.6))
  const fine = (Math.sin(x * 2.2 + y * .73) + Math.cos(x * .64 - y * 2.4)) * .035

  return clamp(
    .08
      + peak(2.75, 2.05, 2.1, 2.55)
      + peak(7.35, 1.25, 1.85, 1.7)
      + peak(11.45, 4.0, 2.2, 2.2)
      + ridge
      - valley
      + fine,
    .04,
    3.3,
  )
}

function boundaryPoints() {
  return [
    [.35, .85], [2.65, .15], [5.8, .35], [8.8, .18], [11.8, .55], [13.7, 1.8],
    [13.9, 4.5], [13.25, 7.45], [10.8, 9.3], [7.35, 9.9], [3.75, 9.65],
    [1.05, 8.2], [.25, 5.55],
  ]
}

function createMesh() {
  const columns = 15
  const rows = 11
  const points = []
  const pointAt = (column, row) => points[row * (columns + 1) + column]

  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const edge = row === 0 || row === rows || column === 0 || column === columns
      const x = (column / columns) * DOMAIN.width + (edge ? 0 : (unit(column * 13.3 + row * 7.1) - .5) * .18)
      const y = (row / rows) * DOMAIN.height + (edge ? 0 : (unit(column * 5.7 + row * 19.4) - .5) * .18)
      points.push({ x, y, z: heightAt(x, y), index: row * (columns + 1) + column })
    }
  }

  const triangles = []
  const edges = new Map()
  const addEdge = (from, to) => {
    const key = from.index < to.index ? `${from.index}:${to.index}` : `${to.index}:${from.index}`
    if (!edges.has(key)) edges.set(key, { from, to, band: clamp(Math.round(((from.z + to.z) / 2) / 3.3 * 2), 0, 2) })
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const topLeft = pointAt(column, row)
      const topRight = pointAt(column + 1, row)
      const bottomLeft = pointAt(column, row + 1)
      const bottomRight = pointAt(column + 1, row + 1)
      const split = (row + column) % 2 === 0
      const cellTriangles = split
        ? [[topLeft, topRight, bottomRight], [topLeft, bottomRight, bottomLeft]]
        : [[topLeft, topRight, bottomLeft], [topRight, bottomRight, bottomLeft]]

      cellTriangles.forEach(triangle => {
        const average = triangle.reduce((sum, point) => sum + point.z, 0) / triangle.length
        triangles.push({ triangle, band: clamp(Math.round(average / 3.3 * 2), 0, 2) })
        addEdge(triangle[0], triangle[1])
        addEdge(triangle[1], triangle[2])
        addEdge(triangle[2], triangle[0])
      })
    }
  }

  const edgePaths = [[], [], []]
  edges.forEach(edge => {
    const from = project(edge.from.x, edge.from.y, edge.from.z)
    const to = project(edge.to.x, edge.to.y, edge.to.z)
    edgePaths[edge.band].push(`M${format(from[0])} ${format(from[1])} L${format(to[0])} ${format(to[1])}`)
  })

  const facePaths = [[], [], []]
  triangles.forEach(({ triangle, band }) => {
    facePaths[band].push(logicalPath(triangle.map(point => [point.x, point.y, point.z]), 0, true))
  })

  return {
    edgePaths: edgePaths.map(paths => paths.join(' ')),
    facePaths: facePaths.map(paths => paths.join(' ')),
  }
}

const MOUNTAIN_SPECS = Object.freeze([
  { id: 'ridge-west', x: 2.75, y: 2.05, height: 3.35, radius: 2.2, tone: 'warm', rotation: -.18 },
  { id: 'ridge-center', x: 7.25, y: 1.28, height: 2.5, radius: 1.85, tone: 'neutral', rotation: .15 },
  { id: 'ridge-east', x: 11.4, y: 4.08, height: 2.85, radius: 2.15, tone: 'cool', rotation: -.12 },
])

function createMountainRelief(spec) {
  const segments = 10
  const ringFactors = [.32, .56, .78, 1]
  const rings = ringFactors.map((factor, ringIndex) => {
    const ringRadius = spec.radius * factor
    const ringHeight = spec.height * (1 - factor) ** .86 + .13
    return Array.from({ length: segments }, (_, index) => {
      const angle = (Math.PI * 2 * index) / segments + spec.rotation
      const wobble = 1 + (unit(index * 4.91 + ringIndex * 11.4 + spec.x) - .5) * .12
      return {
        x: spec.x + Math.cos(angle) * ringRadius * wobble,
        y: spec.y + Math.sin(angle) * ringRadius * .72 * wobble,
        z: ringHeight,
      }
    })
  })

  const summit = project(spec.x, spec.y, spec.height)
  const ringPaths = rings.map(ring => logicalPath(ring.map(point => [point.x, point.y, point.z]), 0, true))
  const spokePaths = []
  const facetPaths = []

  rings[0].forEach((point, index) => {
    const projected = project(point.x, point.y, point.z)
    spokePaths.push(`M${format(summit[0])} ${format(summit[1])} L${format(projected[0])} ${format(projected[1])}`)
    const next = rings[0][(index + 1) % segments]
    facetPaths.push(logicalPath([[spec.x, spec.y, spec.height], [point.x, point.y, point.z], [next.x, next.y, next.z]], 0, true))
  })

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const inner = rings[ringIndex]
    const outer = rings[ringIndex + 1]
    inner.forEach((point, index) => {
      const next = inner[(index + 1) % segments]
      const outerPoint = outer[index]
      const outerNext = outer[(index + 1) % segments]
      facetPaths.push(
        logicalPath([[point.x, point.y, point.z], [outerPoint.x, outerPoint.y, outerPoint.z], [outerNext.x, outerNext.y, outerNext.z]], 0, true),
        logicalPath([[point.x, point.y, point.z], [outerNext.x, outerNext.y, outerNext.z], [next.x, next.y, next.z]], 0, true),
      )
    })
  }

  return {
    ...spec,
    summit,
    ringPaths,
    spokePath: spokePaths.join(' '),
    facetPaths,
  }
}

function samplePolyline(points, samplesPerSegment = 5) {
  const samples = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    for (let step = 0; step < samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment
      const eased = t * t * (3 - (2 * t))
      samples.push([
        start[0] + (end[0] - start[0]) * eased,
        start[1] + (end[1] - start[1]) * eased,
      ])
    }
  }
  samples.push(points[points.length - 1])
  return samples
}

function offsetPolyline(points, distance) {
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)]
    const next = points[Math.min(points.length - 1, index + 1)]
    const tangentX = next[0] - previous[0]
    const tangentY = next[1] - previous[1]
    const length = Math.hypot(tangentX, tangentY) || 1
    return [point[0] - (tangentY / length) * distance, point[1] + (tangentX / length) * distance]
  })
}

function createHydrology() {
  const river = samplePolyline([
    [1.0, .72], [2.15, 1.9], [3.35, 3.45], [4.9, 4.9], [6.25, 6.1],
    [7.55, 6.95], [8.8, 7.9], [10.4, 8.85], [12.95, 9.2],
  ], 5)
  const banks = [-.18, .18].map(offset => logicalPath(offsetPolyline(river, offset), .16))
  const water = logicalPath(river, .2)
  const microLines = [-.09, .09].map(offset => logicalPath(offsetPolyline(river, offset), .22))
  const tributaries = [
    [[2.8, .35], [3.05, 1.7], [3.35, 3.45]],
    [[5.35, 2.5], [5.4, 4.15], [4.9, 4.9]],
    [[9.65, 6.0], [9.45, 7.18], [8.8, 7.9]],
    [[12.2, 6.8], [11.35, 8.2], [10.4, 8.85]],
  ].map(points => logicalPath(samplePolyline(points, 4), .18))

  return { banks, water, microLines, tributaries }
}

function buildingCorners(spec, z = .12) {
  const halfWidth = spec.width / 2
  const halfDepth = spec.depth / 2
  return [
    project(spec.x - halfWidth, spec.y - halfDepth, z),
    project(spec.x + halfWidth, spec.y - halfDepth, z),
    project(spec.x + halfWidth, spec.y + halfDepth, z),
    project(spec.x - halfWidth, spec.y + halfDepth, z),
  ]
}

function buildDetailBuilding(spec) {
  const base = buildingCorners(spec)
  const roofZ = spec.height + .16
  const roof = buildingCorners(spec, roofZ)
  const silhouette = [
    pathFromPoints(base, true),
    `M${format(base[0][0])} ${format(base[0][1])} L${format(roof[0][0])} ${format(roof[0][1])}`,
    `M${format(base[1][0])} ${format(base[1][1])} L${format(roof[1][0])} ${format(roof[1][1])}`,
    `M${format(base[2][0])} ${format(base[2][1])} L${format(roof[2][0])} ${format(roof[2][1])}`,
    `M${format(base[3][0])} ${format(base[3][1])} L${format(roof[3][0])} ${format(roof[3][1])}`,
    pathFromPoints(roof, true),
  ]
  const detail = []
  const floorCount = Math.max(1, Math.floor(spec.height * 1.35))
  for (let floor = 1; floor < floorCount; floor += 1) {
    const z = .12 + (spec.height * floor) / floorCount
    const floorPoints = buildingCorners(spec, z)
    detail.push(`M${format(floorPoints[0][0])} ${format(floorPoints[0][1])} L${format(floorPoints[1][0])} ${format(floorPoints[1][1])}`)
    detail.push(`M${format(floorPoints[3][0])} ${format(floorPoints[3][1])} L${format(floorPoints[2][0])} ${format(floorPoints[2][1])}`)
  }

  if (spec.archetype === 'gable' || spec.archetype === 'tower') {
    const ridgeA = project(spec.x - spec.width * .38, spec.y, roofZ + .28)
    const ridgeB = project(spec.x + spec.width * .38, spec.y, roofZ + .28)
    detail.push(`M${format(roof[0][0])} ${format(roof[0][1])} L${format(ridgeA[0])} ${format(ridgeA[1])} L${format(ridgeB[0])} ${format(ridgeB[1])} L${format(roof[1][0])} ${format(roof[1][1])}`)
    detail.push(`M${format(roof[3][0])} ${format(roof[3][1])} L${format(ridgeA[0])} ${format(ridgeA[1])}`)
    detail.push(`M${format(roof[2][0])} ${format(roof[2][1])} L${format(ridgeB[0])} ${format(ridgeB[1])}`)
  }

  if (spec.archetype === 'dome') {
    const domePoints = Array.from({ length: 13 }, (_, index) => {
      const angle = Math.PI - (Math.PI * index) / 12
      return project(spec.x + Math.cos(angle) * spec.width * .48, spec.y, roofZ + Math.sin(angle) * .58)
    })
    detail.push(pathFromPoints(domePoints))
    const domeCross = project(spec.x, spec.y, roofZ + .58)
    detail.push(`M${format(domeCross[0])} ${format(domeCross[1])} V${format(domeCross[1] + 15)}`)
  }

  if (spec.archetype === 'lattice') {
    detail.push(`M${format(base[0][0])} ${format(base[0][1])} L${format(roof[2][0])} ${format(roof[2][1])}`)
    detail.push(`M${format(base[1][0])} ${format(base[1][1])} L${format(roof[3][0])} ${format(roof[3][1])}`)
    detail.push(`M${format(base[3][0])} ${format(base[3][1])} L${format(roof[1][0])} ${format(roof[1][1])}`)
    detail.push(`M${format(base[2][0])} ${format(base[2][1])} L${format(roof[0][0])} ${format(roof[0][1])}`)
  }

  if (spec.archetype === 'market' || spec.archetype === 'station') {
    const canopy = [
      project(spec.x - spec.width * .65, spec.y - spec.depth * .65, roofZ + .24),
      project(spec.x + spec.width * .65, spec.y - spec.depth * .65, roofZ + .24),
      project(spec.x + spec.width * .65, spec.y + spec.depth * .65, roofZ + .24),
      project(spec.x - spec.width * .65, spec.y + spec.depth * .65, roofZ + .24),
    ]
    detail.push(pathFromPoints(canopy, true))
    detail.push(`M${format(canopy[0][0])} ${format(canopy[0][1])} L${format(canopy[2][0])} ${format(canopy[2][1])}`)
    detail.push(`M${format(canopy[1][0])} ${format(canopy[1][1])} L${format(canopy[3][0])} ${format(canopy[3][1])}`)
  }

  if (spec.archetype === 'tower' || spec.archetype === 'lattice') {
    const antennaBase = project(spec.x, spec.y, roofZ + .22)
    const antennaTop = project(spec.x, spec.y, roofZ + 1.05)
    detail.push(`M${format(antennaBase[0])} ${format(antennaBase[1])} L${format(antennaTop[0])} ${format(antennaTop[1])}`)
    detail.push(`M${format(antennaTop[0] - 8)} ${format(antennaTop[1] + 4)} H${format(antennaTop[0] + 8)}`)
  }

  return {
    ...spec,
    ground: pathFromPoints(base, true),
    silhouette: silhouette.join(' '),
    detail: detail.join(' '),
    hit: pathFromPoints([
      project(spec.x - spec.width * .8, spec.y - spec.depth * .8, .1),
      project(spec.x + spec.width * .8, spec.y - spec.depth * .8, .1),
      project(spec.x + spec.width * .8, spec.y + spec.depth * .8, .1),
      project(spec.x - spec.width * .8, spec.y + spec.depth * .8, .1),
    ], true),
  }
}

const BUILDING_SPECS = Object.freeze([
  { id: 'detail-archive', entityId: 'memory-archive', x: 3.05, y: 4.25, width: .9, depth: .8, height: 1.9, archetype: 'gable', tone: 'warm' },
  { id: 'detail-archive-wing-a', x: 2.25, y: 4.7, width: .55, depth: .52, height: .86, archetype: 'low', tone: 'warm' },
  { id: 'detail-archive-wing-b', x: 3.95, y: 4.75, width: .62, depth: .42, height: 1.05, archetype: 'gable', tone: 'warm' },
  { id: 'detail-archive-row-a', x: 2.55, y: 5.5, width: .5, depth: .48, height: .72, archetype: 'low', tone: 'warm' },
  { id: 'detail-archive-row-b', x: 3.25, y: 5.65, width: .5, depth: .52, height: 1.05, archetype: 'gable', tone: 'warm' },
  { id: 'detail-archive-row-c', x: 4.05, y: 5.55, width: .45, depth: .44, height: .76, archetype: 'low', tone: 'warm' },
  { id: 'detail-market', entityId: 'crossing-market', x: 6.35, y: 6.2, width: 1.05, depth: .82, height: 1.15, archetype: 'market', tone: 'warm' },
  { id: 'detail-market-stall-a', x: 5.3, y: 6.35, width: .48, depth: .42, height: .58, archetype: 'market', tone: 'warm' },
  { id: 'detail-market-stall-b', x: 5.8, y: 7.02, width: .5, depth: .44, height: .62, archetype: 'market', tone: 'warm' },
  { id: 'detail-market-stall-c', x: 7.25, y: 5.55, width: .52, depth: .43, height: .62, archetype: 'market', tone: 'warm' },
  { id: 'detail-market-stall-d', x: 7.55, y: 6.8, width: .48, depth: .45, height: .7, archetype: 'market', tone: 'warm' },
  { id: 'detail-relay', entityId: 'relay-17', x: 5.55, y: 7.55, width: .36, depth: .36, height: 1.25, archetype: 'lattice', tone: 'cool' },
  { id: 'detail-station', entityId: 'south-station', x: 9.15, y: 7.35, width: 1.28, depth: .7, height: 1.18, archetype: 'station', tone: 'neutral' },
  { id: 'detail-station-wing-a', x: 8.15, y: 7.8, width: .58, depth: .42, height: .64, archetype: 'low', tone: 'neutral' },
  { id: 'detail-station-wing-b', x: 10.3, y: 7.95, width: .55, depth: .4, height: .64, archetype: 'low', tone: 'neutral' },
  { id: 'detail-station-row-a', x: 8.35, y: 8.6, width: .48, depth: .42, height: .74, archetype: 'gable', tone: 'neutral' },
  { id: 'detail-station-row-b', x: 9.05, y: 8.8, width: .48, depth: .42, height: .86, archetype: 'gable', tone: 'neutral' },
  { id: 'detail-signal', entityId: 'signal-tower', x: 11.5, y: 4.15, width: .48, depth: .48, height: 2.65, archetype: 'tower', tone: 'cool' },
  { id: 'detail-signal-base', x: 11.1, y: 4.9, width: .72, depth: .58, height: .72, archetype: 'low', tone: 'cool' },
  { id: 'detail-signal-wing-a', x: 12.1, y: 4.65, width: .45, depth: .42, height: .9, archetype: 'lattice', tone: 'cool' },
  { id: 'detail-hill-house-a', x: 9.9, y: 2.8, width: .58, depth: .48, height: .72, archetype: 'gable', tone: 'neutral' },
  { id: 'detail-hill-house-b', x: 10.8, y: 2.55, width: .45, depth: .42, height: .6, archetype: 'low', tone: 'neutral' },
  { id: 'detail-hill-house-c', x: 12.2, y: 6.1, width: .52, depth: .46, height: .82, archetype: 'gable', tone: 'cool' },
  { id: 'detail-hill-house-d', x: 12.85, y: 6.55, width: .42, depth: .4, height: .62, archetype: 'low', tone: 'cool' },
])

const DETAIL_BUILDINGS = Object.freeze(BUILDING_SPECS.map(buildDetailBuilding))

function createRoads() {
  const roads = [
    [[1.65, 4.72], [2.55, 4.5], [3.35, 4.65], [4.4, 5.25], [5.35, 6.1]],
    [[4.35, 5.2], [5.25, 5.85], [6.35, 6.2], [7.45, 6.8], [8.35, 7.4]],
    [[7.55, 5.55], [8.45, 6.1], [9.15, 7.35], [10.15, 7.7], [11.2, 7.55]],
    [[8.2, 8.45], [9.15, 7.35], [10.15, 7.7], [11.35, 8.4]],
    [[10.9, 4.85], [11.5, 4.15], [12.2, 4.6], [12.75, 5.75]],
  ]
  const courtyards = [
    [[2.25, 4.1], [3.9, 3.8], [4.45, 4.8], [3.25, 5.4]],
    [[5.55, 5.65], [6.8, 5.4], [7.45, 6.25], [6.4, 6.95]],
    [[8.5, 6.9], [9.85, 6.75], [10.35, 7.65], [9.1, 8.05]],
  ]
  return {
    paths: roads.map(points => logicalPath(samplePolyline(points, 4), .17)).join(' '),
    courtyards: courtyards.map(points => logicalPath(points, .14, true)).join(' '),
  }
}

const DETAIL_MOUNTAINS = Object.freeze(MOUNTAIN_SPECS.map(createMountainRelief))
const DETAIL_MESH = Object.freeze(createMesh())
const DETAIL_HYDROLOGY = Object.freeze(createHydrology())
const DETAIL_ROADS = Object.freeze(createRoads())
const DETAIL_BOUNDARY = Object.freeze(boundaryPoints())

export const DETAIL_PROTOTYPE_VIEWBOX = VIEWBOX
export const DETAIL_PROTOTYPE = Object.freeze({
  boundary: DETAIL_BOUNDARY,
  boundaryPath: logicalPath(DETAIL_BOUNDARY, .06, true),
  mesh: DETAIL_MESH,
  mountains: DETAIL_MOUNTAINS,
  hydrology: DETAIL_HYDROLOGY,
  roads: DETAIL_ROADS,
  buildings: DETAIL_BUILDINGS,
  staticBuildings: Object.freeze(DETAIL_BUILDINGS.filter(building => !building.entityId)),
  interactiveBuildings: Object.freeze(DETAIL_BUILDINGS.filter(building => building.entityId)),
  anchors: Object.freeze([
    { entityId: 'memory-archive', point: [3.05, 4.25], tone: 'warm', labelPoint: [2.25, 3.62] },
    { entityId: 'crossing-market', point: [6.35, 6.2], tone: 'warm', labelPoint: [5.55, 5.05] },
    { entityId: 'south-station', point: [9.15, 7.35], tone: 'neutral', labelPoint: [10.25, 6.35] },
    { entityId: 'signal-tower', point: [11.5, 4.15], tone: 'cool', labelPoint: [12.55, 3.2] },
    { entityId: 'relay-17', point: [5.55, 7.55], tone: 'cool', labelPoint: [4.75, 8.22] },
  ].map(anchor => ({
    ...anchor,
    projected: project(anchor.point[0], anchor.point[1], heightAt(anchor.point[0], anchor.point[1]) + .28),
    labelProjected: project(anchor.labelPoint[0], anchor.labelPoint[1], heightAt(anchor.labelPoint[0], anchor.labelPoint[1]) + .26),
  }))),
})

export function detailProject(x, y, z = 0) {
  return project(x, y, z)
}

export function detailHeightAt(x, y) {
  return heightAt(x, y)
}

export function detailPointKey(x, y) {
  return pointKey(x, y)
}
