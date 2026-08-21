/*
 * Semantic local detail scene for Center.
 *
 * The source of truth in this file is logical world data. SVG path strings are
 * derived at module load and grouped by semantic line hierarchy. The scene is
 * intentionally small: it is a visual acceptance fixture for one region, not
 * a full country generator.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const format = value => Number(value).toFixed(2)

export const LOCAL_DETAIL_VIEWBOX = Object.freeze({ width: 1600, height: 1000 })
export const LOCAL_DETAIL_DOMAIN = Object.freeze({ width: 16, height: 11 })

const PROJECTION = Object.freeze({ originX: 790, originY: 116, tileX: 47, tileY: 27, height: 54 })

export function localDetailProject(x, y, z = 0) {
  return [
    PROJECTION.originX + (x - y) * PROJECTION.tileX,
    PROJECTION.originY + (x + y) * PROJECTION.tileY - z * PROJECTION.height,
  ]
}

function seeded(value) {
  const sample = Math.sin((value * 91.17) + 17.31) * 43758.5453
  return sample - Math.floor(sample)
}

function pointPath(points, close = false) {
  if (!points.length) return ''
  const commands = [`M${format(points[0][0])} ${format(points[0][1])}`]
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L${format(points[index][0])} ${format(points[index][1])}`)
  }
  if (close) commands.push('Z')
  return commands.join(' ')
}

function logicalPath(points, close = false) {
  return pointPath(points.map(point => localDetailProject(point[0], point[1], point[2] ?? 0)), close)
}

function logicalLine(from, to) {
  return logicalPath([from, to])
}

function add(bucket, value) {
  if (value) bucket.push(value)
}

function polygonCenter(points) {
  return points.reduce((center, point) => [center[0] + point[0], center[1] + point[1]], [0, 0])
    .map(value => value / points.length)
}

function scalePolygon(points, scale, center = polygonCenter(points)) {
  return points.map(point => [
    center[0] + (point[0] - center[0]) * scale,
    center[1] + (point[1] - center[1]) * scale,
  ])
}

function samplePolyline(points, steps = 5) {
  const samples = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps
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

function terrainHeight(x, y) {
  const peak = (cx, cy, radius, height) => {
    const dx = (x - cx) / radius
    const dy = (y - cy) / (radius * .74)
    return height * Math.exp(-((dx * dx) + (dy * dy)) * 1.4)
  }

  const ridge = .62 * Math.exp(-(((y - (2.45 + x * .16)) ** 2) / 1.35))
  const valley = .52 * Math.exp(-(((x - 8.7) ** 2) / 18 + ((y - 7.1) ** 2) / 4.1))
  const shoulder = .28 * Math.exp(-(((x - 12.8) ** 2) / 4.4 + ((y - 4.0) ** 2) / 5.8))
  const micro = (Math.sin(x * 1.45 + y * .82) + Math.cos(x * .7 - y * 1.82)) * .018
  return clamp(.08 + peak(3.65, 2.2, 2.45, 2.7) + peak(12.2, 3.4, 2.2, 1.85) + ridge + shoulder - valley + micro, .04, 3.35)
}

function makeMountain(spec) {
  const segments = 9
  const rings = [.35, .58, .78, 1].map((factor, ringIndex) => Array.from({ length: segments }, (_, index) => {
    const angle = (Math.PI * 2 * index) / segments + spec.rotation
    const wobble = 1 + (seeded(index * 7.3 + ringIndex * 13.4 + spec.x) - .5) * .1
    return [
      spec.x + Math.cos(angle) * spec.radius * factor * wobble,
      spec.y + Math.sin(angle) * spec.radius * .7 * factor * wobble,
      spec.height * (1 - factor) ** .84 + .12,
    ]
  }))
  const summit = [spec.x, spec.y, spec.height]
  const facets = []
  const contours = []
  const ribs = []
  rings.forEach(ring => add(contours, logicalPath(ring, true)))
  rings[0].forEach((point, index) => {
    const next = rings[0][(index + 1) % segments]
    add(facets, logicalPath([summit, point, next], true))
    add(ribs, logicalLine(summit, point))
  })
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const inner = rings[ringIndex]
    const outer = rings[ringIndex + 1]
    inner.forEach((point, index) => {
      const next = inner[(index + 1) % segments]
      const outerPoint = outer[index]
      const outerNext = outer[(index + 1) % segments]
      add(facets, logicalPath([point, outerPoint, outerNext], true))
      add(facets, logicalPath([point, outerNext, next], true))
    })
  }
  return { ...spec, summit: localDetailProject(...summit), facets, contours, ribs: ribs.join(' ') }
}

function buildMountainLines(mountain) {
  return {
    facets: mountain.facets.join(' '),
    contours: mountain.contours.join(' '),
    ribs: mountain.ribs,
  }
}

const TERRAIN_DATA = Object.freeze({
  boundary: [
    [.45, .82], [2.45, .24], [5.85, .38], [9.25, .2], [12.8, .7], [15.45, 2.2],
    [15.7, 5.45], [14.65, 8.3], [12.1, 10.35], [8.5, 10.85], [4.35, 10.2],
    [1.4, 8.65], [.25, 5.1],
  ],
  mountains: [
    { id: 'north-ridge', x: 3.55, y: 2.15, radius: 2.35, height: 3.35, rotation: -.18, tone: 'warm' },
    { id: 'east-shoulder', x: 12.1, y: 3.65, radius: 2.15, height: 2.55, rotation: .18, tone: 'cool' },
  ],
  ridgePaths: [
    { id: 'ridge-spine', tone: 'warm', points: [[.9, 2.9], [2.2, 2.18], [3.55, 2.1], [4.75, 2.72], [6.1, 2.35], [7.9, 2.78]] },
    { id: 'east-ridge', tone: 'cool', points: [[9.9, 3.4], [11.25, 3.7], [12.1, 3.55], [13.35, 4.15], [14.8, 4.0]] },
    { id: 'south-shoulder', tone: 'neutral', points: [[3.5, 8.95], [5.2, 8.35], [6.9, 8.7], [8.75, 8.15], [10.25, 8.72], [12.4, 8.25]] },
  ],
  plateau: [
    [5.45, 4.45, 1.12], [6.3, 4.15, 1.18], [7.55, 4.22, 1.12], [8.6, 4.7, 1.02],
    [8.8, 5.62, .95], [7.9, 6.0, .92], [6.45, 5.85, .98], [5.55, 5.35, 1.08],
  ],
})

const RIVER_DATA = Object.freeze({
  id: 'river-azure',
  points: [[1.05, 1.05], [2.0, 2.05], [3.05, 3.18], [4.0, 4.35], [5.2, 5.25], [6.35, 6.12], [7.65, 6.75], [9.0, 7.55], [10.75, 8.45], [13.1, 9.45], [15.0, 9.82]],
  tributaries: [
    [[3.7, 1.12], [3.65, 2.2], [3.05, 3.18]],
    [[9.9, 5.85], [9.4, 6.75], [9.0, 7.55]],
    [[13.8, 7.0], [13.15, 8.35], [13.1, 9.45]],
  ],
})

const ROAD_DATA = Object.freeze([
  { id: 'ridge-road', type: 'road', width: .12, points: [[1.35, 7.55], [2.8, 6.9], [4.3, 6.5], [5.65, 5.65], [6.55, 5.1], [7.2, 4.72]] },
  { id: 'market-road', type: 'road', width: .1, points: [[4.0, 8.3], [5.4, 7.35], [6.6, 6.5], [7.55, 5.75], [8.05, 5.3]] },
  { id: 'station-road', type: 'road', width: .12, points: [[8.05, 5.3], [9.2, 6.15], [10.25, 7.1], [11.2, 7.55], [12.8, 7.4]] },
  { id: 'ridge-path', type: 'path', width: .05, points: [[7.05, 4.8], [8.2, 4.35], [9.35, 4.6], [10.5, 4.15]] },
])

function compoundMass(id, x, y, width, depth, height, options = {}) {
  return { id, x, y, width, depth, height, floors: options.floors ?? Math.max(1, Math.round(height * 1.35)), shape: options.shape ?? 'wing', roof: options.roof ?? 'hip', facadeEdges: options.facadeEdges ?? [0, 1], detail: options.detail ?? 'medium', baseOffset: options.baseOffset ?? .04 }
}

const LANDMARK_DATA = Object.freeze([
  {
    id: 'memory-archive', tone: 'warm', kind: 'courtyard', labelPoint: [5.95, 3.45], focus: true,
    center: [7.05, 5.05],
    courtyard: [[-1.1, -.78], [.18, -.78], [.18, -.22], [.98, -.22], [.98, .82], [-.35, .82], [-.35, .4], [-1.1, .4]],
    masses: [
      compoundMass('archive-core', 7.05, 5.05, 2.28, 1.86, 2.62, { floors: 4, shape: 'courtyard', roof: 'stepped', facadeEdges: [0, 1, 6, 7], detail: 'high' }),
      compoundMass('archive-west-wing', 6.02, 5.22, 1.02, 1.18, 1.48, { floors: 2, shape: 'wing', roof: 'gable', facadeEdges: [0, 1], detail: 'medium' }),
      compoundMass('archive-east-wing', 8.08, 5.38, 1.05, 1.1, 1.28, { floors: 2, shape: 'wing', roof: 'hip', facadeEdges: [0, 1], detail: 'medium' }),
      compoundMass('archive-tower', 7.62, 4.25, .62, .62, 3.16, { floors: 5, shape: 'tower', roof: 'hip', facadeEdges: [0, 1, 2], detail: 'high' }),
    ],
  },
  {
    id: 'crossing-market', tone: 'warm', kind: 'market', labelPoint: [4.4, 6.05], focus: false,
    center: [5.05, 6.9],
    masses: [
      compoundMass('market-hall', 5.05, 6.9, 1.42, 1.05, 1.24, { floors: 2, shape: 'hall', roof: 'gable', facadeEdges: [0, 1], detail: 'medium' }),
      compoundMass('market-east', 5.92, 7.12, .72, .66, .78, { floors: 1, shape: 'wing', roof: 'gable', facadeEdges: [0, 1], detail: 'low' }),
      compoundMass('market-west', 4.18, 6.63, .72, .62, .7, { floors: 1, shape: 'wing', roof: 'gable', facadeEdges: [0, 1], detail: 'low' }),
    ],
  },
  {
    id: 'relay-17', tone: 'cool', kind: 'relay', labelPoint: [3.85, 7.72], focus: false,
    center: [4.75, 7.45],
    masses: [compoundMass('relay-tower', 4.75, 7.45, .42, .42, 1.95, { floors: 3, shape: 'tower', roof: 'hip', facadeEdges: [0, 1, 2], detail: 'low' })],
  },
  {
    id: 'south-station', tone: 'neutral', kind: 'station', labelPoint: [10.12, 6.25], focus: false,
    center: [10.25, 7.65],
    masses: [
      compoundMass('station-hall', 10.25, 7.65, 1.55, .92, 1.18, { floors: 2, shape: 'hall', roof: 'saw', facadeEdges: [0, 1], detail: 'medium' }),
      compoundMass('station-west', 9.3, 7.78, .78, .5, .68, { floors: 1, shape: 'wing', roof: 'gable', facadeEdges: [0, 1], detail: 'low' }),
      compoundMass('station-east', 11.18, 7.82, .78, .5, .72, { floors: 1, shape: 'wing', roof: 'gable', facadeEdges: [0, 1], detail: 'low' }),
    ],
  },
  {
    id: 'signal-tower', tone: 'cool', kind: 'signal', labelPoint: [12.92, 3.0], focus: false,
    center: [12.25, 4.05],
    masses: [compoundMass('signal-tower', 12.25, 4.05, .48, .48, 2.3, { floors: 4, shape: 'tower', roof: 'hip', facadeEdges: [0, 1, 2], detail: 'low' })],
  },
])

const CELL_DATA = Object.freeze([
  { id: 'cell-archive', center: [7.05, 5.05], radius: .82, terrain: 'plateau', neighbors: ['cell-market', 'cell-station'] },
  { id: 'cell-market', center: [5.05, 6.9], radius: .82, terrain: 'slope', neighbors: ['cell-archive', 'cell-relay'] },
  { id: 'cell-relay', center: [4.75, 7.45], radius: .66, terrain: 'slope', neighbors: ['cell-market'] },
  { id: 'cell-station', center: [10.25, 7.65], radius: .86, terrain: 'valley', neighbors: ['cell-archive'] },
])

function hexPath(cell) {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + (Math.PI * 2 * index) / 6
    return [cell.center[0] + Math.cos(angle) * cell.radius, cell.center[1] + Math.sin(angle) * cell.radius, terrainHeight(cell.center[0], cell.center[1]) + .025]
  })
  return logicalPath(points, true)
}

function createTerrainScene() {
  const mountains = TERRAIN_DATA.mountains.map(makeMountain)
  const mountainLineData = mountains.map(buildMountainLines)
  const ridgeLines = TERRAIN_DATA.ridgePaths.map(ridge => ({
    ...ridge,
    d: logicalPath(ridge.points.map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .08])),
    secondary: logicalPath(offsetPolyline(ridge.points, .12).map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .04])),
  }))

  const plateauPrimary = logicalPath(TERRAIN_DATA.plateau)
  const plateauSecondary = logicalPath(offsetPolyline(TERRAIN_DATA.plateau.map(point => point.slice(0, 2)), .12).map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .02]))

  const river = samplePolyline(RIVER_DATA.points, 6)
  const riverWater = logicalPath(river.map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .13]))
  const riverBanks = [-.16, .16].map(offset => logicalPath(offsetPolyline(river, offset).map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .095])))
  const riverMicro = [-.07, .07].map(offset => logicalPath(offsetPolyline(river, offset).map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .16])))
  const tributaries = RIVER_DATA.tributaries.map(points => logicalPath(samplePolyline(points, 5).map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .12])))

  const roads = ROAD_DATA.map(road => {
    const points = samplePolyline(road.points, 5)
    const elevated = points.map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .13])
    const left = offsetPolyline(points, road.width)
    const right = offsetPolyline(points, -road.width).reverse()
    const surface = logicalPath(left.concat(right).map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .105]), true)
    return {
      ...road,
      surface,
      line: logicalPath(elevated),
      edge: logicalPath(left.map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .125])),
      edgeSecondary: logicalPath(right.reverse().map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .125])),
    }
  })

  const backgroundContours = []
  for (let lineIndex = 0; lineIndex < 7; lineIndex += 1) {
    const points = Array.from({ length: 10 }, (_, index) => {
      const x = 1 + index * 1.5
      const y = 8.6 - lineIndex * .46 + Math.sin(index * .8 + lineIndex) * .13 + x * .04
      return [x, y, terrainHeight(x, y) + .03]
    })
    add(backgroundContours, logicalPath(points))
  }

  const slopeLines = []
  for (let index = 0; index < 7; index += 1) {
    const x = 1.55 + index * .52
    const points = [[x, 1.12], [x + .34, 1.78], [x + .48, 2.48], [x + .72, 3.14]]
    add(slopeLines, logicalPath(points.map(point => [point[0], point[1], terrainHeight(point[0], point[1]) + .04])))
  }

  return {
    boundary: TERRAIN_DATA.boundary,
    boundaryPath: logicalPath(TERRAIN_DATA.boundary.map(point => [point[0], point[1], .04]), true),
    mountains: mountains.map((mountain, index) => ({ ...mountain, ...mountainLineData[index] })),
    ridges: ridgeLines,
    plateau: { primary: plateauPrimary, secondary: plateauSecondary },
    backgroundContours: backgroundContours.join(' '),
    slopeLines: slopeLines.join(' '),
    river: { water: riverWater, banks: riverBanks.join(' '), micro: riverMicro.join(' '), tributaries: tributaries.join(' ') },
    roads,
    cells: CELL_DATA.map(cell => ({ ...cell, d: hexPath(cell) })),
  }
}

function massFootprint(mass) {
  const width = mass.width / 2
  const depth = mass.depth / 2
  if (mass.shape === 'courtyard') {
    return [
      [-width, -depth], [width * .12, -depth], [width * .12, -depth * .22], [width, -depth * .22],
      [width, depth], [-width * .34, depth], [-width * .34, depth * .32], [-width, depth * .32],
    ]
  }
  if (mass.shape === 'tower') {
    return [[-width * .72, -depth], [width * .72, -depth], [width, -.18 * depth], [width * .72, depth], [-width * .72, depth], [-width, -.18 * depth]]
  }
  if (mass.shape === 'hall') {
    return [[-width, -depth * .72], [width * .62, -depth * .72], [width, -.12 * depth], [width * .8, depth], [-width * .42, depth], [-width, depth * .32]]
  }
  return [[-width, -depth * .62], [width * .62, -depth * .62], [width, -.08 * depth], [width, depth * .62], [-width * .68, depth], [-width, depth * .28]]
}

function edgeInfo(from, to, center) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dx, dy) || 1
  const tangent = [dx / length, dy / length]
  const normals = [[tangent[1], -tangent[0]], [-tangent[1], tangent[0]]]
  const midpoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
  const outward = normals.find(normal => {
    const probe = [midpoint[0] + normal[0] * .1, midpoint[1] + normal[1] * .1]
    return Math.hypot(probe[0] - center[0], probe[1] - center[1]) > Math.hypot(midpoint[0] - center[0], midpoint[1] - center[1])
  }) || normals[0]
  return { from, to, length, tangent, outward }
}

function edgePoint(edge, distance, offset, z) {
  return [
    edge.from[0] + edge.tangent[0] * distance + edge.outward[0] * offset,
    edge.from[1] + edge.tangent[1] * distance + edge.outward[1] * offset,
    z,
  ]
}

function addWindow(edge, start, end, bottom, top, layers) {
  const bay = end - start
  const inset = Math.min(.08, bay * .16)
  const outer = [
    edgePoint(edge, start + inset * .35, .035, bottom + .1),
    edgePoint(edge, end - inset * .35, .035, bottom + .1),
    edgePoint(edge, end - inset * .35, .035, top - .09),
    edgePoint(edge, start + inset * .35, .035, top - .09),
  ]
  const inner = [
    edgePoint(edge, start + inset, .09, bottom + .16),
    edgePoint(edge, end - inset, .09, bottom + .16),
    edgePoint(edge, end - inset, .09, top - .14),
    edgePoint(edge, start + inset, .09, top - .14),
  ]
  add(layers.tertiary, logicalPath(inner, true))
  outer.forEach((point, index) => add(layers.tertiary, logicalLine(point, inner[index])))
  add(layers.tertiary, logicalLine(inner[0], inner[2]))
  add(layers.tertiary, logicalLine(inner[1], inner[3]))
}

function addArcade(edge, start, end, bottom, top, layers) {
  const center = (start + end) / 2
  const radius = Math.min((end - start) * .32, .2)
  const arch = []
  for (let index = 0; index <= 8; index += 1) {
    const angle = Math.PI - (Math.PI * index / 8)
    arch.push(edgePoint(edge, center + Math.cos(angle) * radius, .1, bottom + .2 + Math.sin(angle) * radius))
  }
  add(layers.secondary, logicalPath(arch))
  add(layers.secondary, logicalLine(edgePoint(edge, center - radius, .1, bottom), edgePoint(edge, center - radius, .1, bottom + .2)))
  add(layers.secondary, logicalLine(edgePoint(edge, center + radius, .1, bottom), edgePoint(edge, center + radius, .1, bottom + .2)))
}

function addRoof(mass, footprint, top, layers) {
  const center = polygonCenter(footprint)
  const outer = scalePolygon(footprint, .93, center).map(point => [point[0], point[1], top + .06])
  const inner = scalePolygon(footprint, .74, center).map(point => [point[0], point[1], top + .13])
  add(layers.primary, logicalPath(outer, true))
  add(layers.secondary, logicalPath(inner, true))

  if (mass.roof === 'gable') {
    const ridgeA = [center[0], center[1] - mass.depth * .28, top + .38]
    const ridgeB = [center[0], center[1] + mass.depth * .28, top + .38]
    add(layers.primary, logicalLine(ridgeA, ridgeB))
    footprint.forEach((point, index) => {
      if (index % 2 === 0) add(layers.secondary, logicalLine([point[0], point[1], top + .06], ridgeA))
    })
  } else if (mass.roof === 'saw') {
    for (let ridge = -1; ridge <= 1; ridge += 1) {
      const x = center[0] + ridge * mass.width * .25
      add(layers.primary, logicalLine([x, center[1] - mass.depth * .3, top + .12], [x, center[1] + mass.depth * .3, top + .36]))
    }
  } else {
    const apex = [center[0], center[1], top + (mass.roof === 'stepped' ? .46 : .32)]
    footprint.forEach(point => add(layers.secondary, logicalLine([point[0], point[1], top + .06], apex)))
    if (mass.roof === 'stepped') {
      const upper = scalePolygon(footprint, .6, center).map(point => [point[0], point[1], top + .28])
      add(layers.primary, logicalPath(upper, true))
      add(layers.secondary, logicalLine([center[0], center[1], top + .28], [center[0], center[1], top + .72]))
    }
  }
}

function createMassGeometry(mass, detail, layers) {
  const footprint = massFootprint(mass)
  const center = polygonCenter(footprint)
  const base = terrainHeight(mass.x, mass.y) + mass.baseOffset
  const floorHeight = mass.height / mass.floors
  const visibleEdges = new Set(mass.facadeEdges)
  add(layers.fill, logicalPath(footprint.map(point => [mass.x + point[0], mass.y + point[1], base]), true))

  for (let floor = 0; floor <= mass.floors; floor += 1) {
    const setback = floor === mass.floors ? .9 : floor >= 2 ? .96 : 1
    const level = scalePolygon(footprint, setback, center)
    const z = base + floor * floorHeight
    const path = logicalPath(level.map(point => [mass.x + point[0], mass.y + point[1], z]), true)
    add(floor === mass.floors ? layers.primary : layers.secondary, path)
  }

  const top = base + mass.height
  const topLevel = scalePolygon(footprint, .9, center)
  footprint.forEach((point, index) => add(layers.primary, logicalLine(
    [mass.x + point[0], mass.y + point[1], base],
    [mass.x + topLevel[index][0], mass.y + topLevel[index][1], top],
  )))

  for (let floor = 0; floor < mass.floors; floor += 1) {
    const z0 = base + floor * floorHeight
    const z1 = z0 + floorHeight
    footprint.forEach((from, edgeIndex) => {
      const to = footprint[(edgeIndex + 1) % footprint.length]
      if (!visibleEdges.has(edgeIndex)) return
      const edge = edgeInfo(from, to, center)
      const columns = clamp(Math.round(edge.length * 3.5), 2, 5)
      const bay = edge.length / columns
      for (let column = 0; column < columns; column += 1) {
        const start = column * bay
        const end = (column + 1) * bay
        if (floor === 0) {
          if ((column + edgeIndex) % 3 === 0) addArcade(edge, start, end, z0, z1, layers)
          else if (detail !== 'low') addWindow(edge, start, end, z0, z1, layers)
        } else if (detail !== 'low' && ((column + floor + edgeIndex) % 5 !== 0)) {
          addWindow(edge, start, end, z0, z1, layers)
        }
      }
      if (floor > 0 && detail === 'high' && edgeIndex % 2 === 0) {
        const balconyStart = edge.length * .2
        const balconyEnd = edge.length * .72
        const balconyBottom = z0 + .08
        add(layers.secondary, logicalPath([
          edgePoint(edge, balconyStart, .02, balconyBottom),
          edgePoint(edge, balconyEnd, .02, balconyBottom),
          edgePoint(edge, balconyEnd, .28, balconyBottom),
          edgePoint(edge, balconyStart, .28, balconyBottom),
        ], true))
        add(layers.secondary, logicalLine(edgePoint(edge, balconyStart, .28, balconyBottom), edgePoint(edge, balconyStart, .28, balconyBottom + .22)))
        add(layers.secondary, logicalLine(edgePoint(edge, balconyEnd, .28, balconyBottom), edgePoint(edge, balconyEnd, .28, balconyBottom + .22)))
        add(layers.secondary, logicalLine(edgePoint(edge, balconyStart, .28, balconyBottom + .22), edgePoint(edge, balconyEnd, .28, balconyBottom + .22)))
      }
    })
  }

  addRoof(mass, footprint.map(point => [mass.x + point[0], mass.y + point[1]]), top, layers)
  return { footprint, base, top }
}

function createLandmarkGeometry(landmark) {
  const layers = { fill: [], primary: [], secondary: [], tertiary: [], connection: [] }
  const massResults = landmark.masses.map(mass => ({ mass, ...createMassGeometry(mass, mass.detail, layers) }))
  if (landmark.courtyard) {
    add(layers.connection, logicalPath(landmark.courtyard.map(point => [landmark.center[0] + point[0], landmark.center[1] + point[1], terrainHeight(landmark.center[0] + point[0], landmark.center[1] + point[1]) + .09]), true))
    const inner = scalePolygon(landmark.courtyard, .68).map(point => [landmark.center[0] + point[0], landmark.center[1] + point[1], terrainHeight(landmark.center[0] + point[0], landmark.center[1] + point[1]) + .12])
    add(layers.connection, logicalPath(inner, true))
    add(layers.connection, logicalLine([landmark.center[0] - .08, landmark.center[1] - .65, terrainHeight(landmark.center[0], landmark.center[1]) + .12], [landmark.center[0] - .08, landmark.center[1] + .62, terrainHeight(landmark.center[0], landmark.center[1]) + .12]))
  }

  if (massResults.length > 1) {
    const core = massResults[0].mass
    massResults.slice(1).forEach((result, index) => {
      const mass = result.mass
      const z = Math.min(result.top, terrainHeight(core.x, core.y) + core.height * .48)
      add(layers.connection, logicalLine([mass.x, mass.y, z], [core.x, core.y, z + .03]))
      if (index % 2 === 0) add(layers.connection, logicalLine([mass.x, mass.y + .08, z + .1], [core.x, core.y + .08, z + .13]))
    })
  }

  const hits = massResults.map(result => logicalPath(result.footprint.map(point => [result.mass.x + point[0], result.mass.y + point[1], result.base - .02]), true)).join(' ')
  return {
    ...landmark,
    geometry: {
      layers: Object.fromEntries(Object.entries(layers).map(([key, paths]) => [key, paths.join(' ')])),
      hitPath: hits,
      stats: { masses: massResults.length, paths: Object.values(layers).reduce((count, paths) => count + paths.length, 0) },
    },
    anchor: localDetailProject(landmark.center[0], landmark.center[1], terrainHeight(...landmark.center) + .32),
    labelAnchor: localDetailProject(landmark.labelPoint[0], landmark.labelPoint[1], terrainHeight(...landmark.labelPoint) + .16),
  }
}

const terrain = createTerrainScene()
const landmarks = LANDMARK_DATA.map(createLandmarkGeometry)

export const LOCAL_DETAIL_SCENE = Object.freeze({
  data: Object.freeze({
    terrain: TERRAIN_DATA,
    river: RIVER_DATA,
    roads: ROAD_DATA,
    cells: CELL_DATA,
    landmarks: LANDMARK_DATA,
  }),
  terrain,
  landmarks: Object.freeze(landmarks),
  viewbox: LOCAL_DETAIL_VIEWBOX,
})

export function localDetailHeightAt(x, y) {
  return terrainHeight(x, y)
}
