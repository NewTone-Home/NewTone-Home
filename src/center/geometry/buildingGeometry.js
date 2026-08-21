/*
 * A small procedural architecture kernel for the Center detail tile.
 *
 * The generator works in logical x/y/z space and only projects at the very
 * end. That distinction matters: windows, balconies, roof ribs and setbacks
 * are real parts of a building graph, not rectangles painted on a cuboid.
 * The SVG adapter can still batch each structural layer into one path, so the
 * scene remains light and the data stays available for future Canvas/WebGL
 * renderers.
 */

const format = value => Number(value).toFixed(2)
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function seeded(value) {
  const sample = Math.sin((value * 91.17) + 17.31) * 43758.5453
  return sample - Math.floor(sample)
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

function logicalPoint(spec, point, z) {
  return [spec.x + point[0], spec.y + point[1], z]
}

function projectPoint(project, point) {
  return project(point[0], point[1], point[2])
}

function addSegment(bucket, project, from, to) {
  bucket.push(pathFromPoints([projectPoint(project, from), projectPoint(project, to)]))
}

function addPath(bucket, project, points, close = false) {
  bucket.push(pathFromPoints(points.map(point => projectPoint(project, point)), close))
}

function polygonCenter(points) {
  return points.reduce((center, point) => [center[0] + point[0], center[1] + point[1]], [0, 0])
    .map(value => value / points.length)
}

function scaleFootprint(points, scale, center = polygonCenter(points)) {
  return points.map(point => [
    center[0] + (point[0] - center[0]) * scale,
    center[1] + (point[1] - center[1]) * scale,
  ])
}

function rectangleFootprint(spec) {
  return [
    [-spec.width / 2, -spec.depth / 2],
    [spec.width / 2, -spec.depth / 2],
    [spec.width / 2, spec.depth / 2],
    [-spec.width / 2, spec.depth / 2],
  ]
}

function civicFootprint(spec) {
  const width = spec.width / 2
  const depth = spec.depth / 2
  return [
    [-width, -depth],
    [width * .2, -depth],
    [width * .2, -depth * .42],
    [width, -depth * .42],
    [width, depth],
    [-width * .36, depth],
    [-width * .36, depth * .48],
    [-width, depth * .48],
  ]
}

function marketFootprint(spec) {
  const width = spec.width / 2
  const depth = spec.depth / 2
  return [
    [-width, -depth * .72],
    [width * .7, -depth * .72],
    [width, -depth * .22],
    [width, depth * .68],
    [-width * .2, depth],
    [-width, depth * .46],
  ]
}

function stationFootprint(spec) {
  const width = spec.width / 2
  const depth = spec.depth / 2
  return [
    [-width, -depth],
    [width, -depth],
    [width, depth * .42],
    [width * .42, depth],
    [-width * .68, depth],
    [-width, depth * .5],
  ]
}

// Secondary wings deliberately use an offset polygon instead of another
// rectangle. The small chamfers make a compound feel assembled from real
// architectural masses when it is viewed at detail zoom.
function wingFootprint(spec) {
  const width = spec.width / 2
  const depth = spec.depth / 2
  return [
    [-width, -depth * .62],
    [width * .66, -depth * .62],
    [width, -depth * .12],
    [width, depth * .66],
    [-width * .72, depth],
    [-width, depth * .28],
  ]
}

function towerFootprint(spec) {
  const width = spec.width / 2
  const depth = spec.depth / 2
  return [
    [-width * .72, -depth],
    [width * .72, -depth],
    [width, -depth * .42],
    [width * .72, depth],
    [-width * .72, depth],
    [-width, -depth * .42],
  ]
}

function getFootprint(spec) {
  if (spec.footprintType === 'wing') return wingFootprint(spec)
  if (spec.footprintType === 'tower') return towerFootprint(spec)
  if (spec.geometryStyle === 'civic') return civicFootprint(spec)
  if (spec.geometryStyle === 'market') return marketFootprint(spec)
  if (spec.geometryStyle === 'station') return stationFootprint(spec)
  return rectangleFootprint(spec)
}

function edgeData(from, to, center) {
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

function pointOnEdge(edge, distance, offset = 0, z = 0) {
  return [
    edge.from[0] + edge.tangent[0] * distance + edge.outward[0] * offset,
    edge.from[1] + edge.tangent[1] * distance + edge.outward[1] * offset,
    z,
  ]
}

function edgeQuad(edge, start, end, offset, bottom, top) {
  return [
    pointOnEdge(edge, start, offset, bottom),
    pointOnEdge(edge, end, offset, bottom),
    pointOnEdge(edge, end, offset, top),
    pointOnEdge(edge, start, offset, top),
  ]
}

function addWindowCell(edge, start, end, bottom, top, project, layers, key) {
  const bay = end - start
  const inset = Math.min(.09, bay * .15)
  const windowBottom = bottom + Math.min(.14, (top - bottom) * .2)
  const windowTop = top - Math.min(.13, (top - bottom) * .18)
  const outer = edgeQuad(edge, start + inset * .4, end - inset * .4, .025, windowBottom - inset * .4, windowTop + inset * .4)
  const inner = edgeQuad(edge, start + inset, end - inset, .075, windowBottom, windowTop)

  addPath(layers.window, project, inner, true)
  inner.forEach((point, index) => addSegment(layers.reveal, project, outer[index], point))
  addSegment(layers.frame, project, inner[0], inner[2])
  addSegment(layers.frame, project, inner[1], inner[3])
  addSegment(layers.frame, project, inner[0], inner[1])

  if (seeded(key + 11) > .4) {
    const mullion = pointOnEdge(edge, (start + end) / 2, .078, windowBottom)
    const mullionTop = pointOnEdge(edge, (start + end) / 2, .078, windowTop)
    addSegment(layers.frame, project, mullion, mullionTop)
  }
  if (seeded(key + 17) > .56) {
    addSegment(layers.fine, project, inner[0], inner[2])
  }
}

function addBalcony(edge, start, end, z, project, layers) {
  const frontStart = pointOnEdge(edge, start + .06, .02, z)
  const frontEnd = pointOnEdge(edge, end - .06, .02, z)
  const outerStart = pointOnEdge(edge, start + .06, .28, z)
  const outerEnd = pointOnEdge(edge, end - .06, .28, z)
  addPath(layers.balcony, project, [frontStart, frontEnd, outerEnd, outerStart], true)
  const railBottom = z + .03
  const railTop = z + .23
  addSegment(layers.balcony, project, outerStart, pointOnEdge(edge, start + .06, .28, railTop))
  addSegment(layers.balcony, project, outerEnd, pointOnEdge(edge, end - .06, .28, railTop))
  addSegment(layers.balcony, project, pointOnEdge(edge, start + .06, .28, railTop), pointOnEdge(edge, end - .06, .28, railTop))
  for (let rail = 1; rail < 4; rail += 1) {
    const at = start + (end - start) * rail / 4
    addSegment(layers.balcony, project, pointOnEdge(edge, at, .28, railBottom), pointOnEdge(edge, at, .28, railTop))
  }
}

function addArcade(edge, start, end, bottom, top, project, layers) {
  const center = (start + end) / 2
  const radius = Math.min((end - start) * .3, .18)
  const archPoints = []
  for (let index = 0; index <= 8; index += 1) {
    const angle = Math.PI - (Math.PI * index / 8)
    archPoints.push(pointOnEdge(edge, center + Math.cos(angle) * radius, .08, bottom + .18 + Math.sin(angle) * radius))
  }
  addPath(layers.arcade, project, archPoints)
  addSegment(layers.arcade, project, pointOnEdge(edge, center - radius, .08, bottom), pointOnEdge(edge, center - radius, .08, bottom + .18))
  addSegment(layers.arcade, project, pointOnEdge(edge, center + radius, .08, bottom), pointOnEdge(edge, center + radius, .08, bottom + .18))
  addSegment(layers.arcade, project, pointOnEdge(edge, center - radius, .08, bottom), pointOnEdge(edge, center + radius, .08, bottom))
  if (top - bottom > .6) addSegment(layers.fine, project, pointOnEdge(edge, center, .09, top - .12), pointOnEdge(edge, center, .1, top - .12))
}

function addFacadeModules(spec, footprint, floor, floorCount, z0, z1, project, layers, seed) {
  const center = polygonCenter(footprint)
  const facadeProject = (x, y, z) => project(spec.x + x, spec.y + y, z)
  footprint.forEach((from, edgeIndex) => {
    const to = footprint[(edgeIndex + 1) % footprint.length]
    const edge = edgeData(from, to, center)
    const columns = clamp(Math.round(edge.length * 3.8), 2, 6)
    const bay = edge.length / columns
    addSegment(layers.structure, project, logicalPoint(spec, from, z0), logicalPoint(spec, to, z0))
    if (floor === floorCount - 1) addSegment(layers.structure, project, logicalPoint(spec, from, z1), logicalPoint(spec, to, z1))

    for (let column = 0; column < columns; column += 1) {
      const start = column * bay
      const end = (column + 1) * bay
      const key = seed + floor * 31 + edgeIndex * 13 + column * 7
      if (floor === 0 && (column === Math.floor(columns / 2) || seeded(key) > .78)) {
        addArcade(edge, start, end, z0, z1, facadeProject, layers)
      } else {
        addWindowCell(edge, start, end, z0, z1, facadeProject, layers, key)
      }

      if (floor > 0 && seeded(key + 23) > .73) addBalcony(edge, start, end, z0 + .04, facadeProject, layers)
      if (floor > 0 && seeded(key + 41) < .18) {
        const ac = pointOnEdge(edge, start + bay * .7, .08, z0 + (z1 - z0) * .42)
        const acTop = pointOnEdge(edge, start + bay * .7, .08, z0 + (z1 - z0) * .54)
        addPath(layers.service, facadeProject, [
          pointOnEdge(edge, start + bay * .58, .08, z0 + (z1 - z0) * .4),
          pointOnEdge(edge, start + bay * .82, .08, z0 + (z1 - z0) * .4),
          acTop,
          ac,
        ], true)
        addSegment(layers.service, facadeProject, ac, pointOnEdge(edge, start + bay * .82, .11, z0 - .14))
      }
    }
  })
}

function addRoof(spec, footprint, roofType, top, project, layers) {
  const center = polygonCenter(footprint)
  const roofRing = footprint.map(point => logicalPoint(spec, point, top + .06))
  addPath(layers.roof, project, roofRing, true)
  const inner = scaleFootprint(footprint, .82, center).map(point => logicalPoint(spec, point, top + .13))
  addPath(layers.roof, project, inner, true)

  if (roofType === 'gable') {
    const ridgeA = logicalPoint(spec, [center[0], center[1] - spec.depth * .28], top + .38)
    const ridgeB = logicalPoint(spec, [center[0], center[1] + spec.depth * .28], top + .38)
    addSegment(layers.roof, project, ridgeA, ridgeB)
    footprint.forEach((point, index) => {
      const next = footprint[(index + 1) % footprint.length]
      if (index % 2 === 0) addSegment(layers.roof, project, logicalPoint(spec, point, top + .06), ridgeA)
      if (index % 2 === 1) addSegment(layers.roof, project, logicalPoint(spec, next, top + .06), ridgeB)
    })
  } else {
    const apex = logicalPoint(spec, [center[0], center[1]], top + .34)
    footprint.forEach(point => addSegment(layers.roof, project, logicalPoint(spec, point, top + .06), apex))
  }

  const antennaBase = logicalPoint(spec, [center[0] + .12, center[1] - .04], top + .1)
  const antennaTop = logicalPoint(spec, [center[0] + .12, center[1] - .04], top + .7)
  addSegment(layers.roof, project, antennaBase, antennaTop)
  addSegment(layers.roof, project, logicalPoint(spec, [center[0] - .08, center[1] - .04], top + .48), logicalPoint(spec, [center[0] + .3, center[1] - .04], top + .48))
}

function addAnnex(spec, footprint, top, project, layers) {
  const point = footprint[Math.max(0, footprint.length - 2)]
  const annex = [
    [point[0] - .18, point[1] - .16],
    [point[0] + .25, point[1] - .16],
    [point[0] + .25, point[1] + .22],
    [point[0] - .18, point[1] + .22],
  ]
  const annexTop = top + .48
  addPath(layers.structure, project, annex.map(value => logicalPoint(spec, value, top)), true)
  addPath(layers.primary, project, annex.map(value => logicalPoint(spec, value, annexTop)), true)
  annex.forEach(value => addSegment(layers.primary, project, logicalPoint(spec, value, top), logicalPoint(spec, value, annexTop)))
  for (let floor = 0; floor < 2; floor += 1) {
    const z0 = top + floor * .23 + .06
    const z1 = z0 + .13
    addPath(layers.fine, project, [
      logicalPoint(spec, [annex[0][0] + .05, annex[0][1]], z0),
      logicalPoint(spec, [annex[1][0] - .05, annex[1][1]], z0),
      logicalPoint(spec, [annex[1][0] - .05, annex[1][1]], z1),
      logicalPoint(spec, [annex[0][0] + .05, annex[0][1]], z1),
    ], true)
  }
}

function makeLayers() {
  return Object.fromEntries(['fill', 'primary', 'structure', 'window', 'reveal', 'frame', 'fine', 'balcony', 'arcade', 'service', 'roof'].map(key => [key, []]))
}

function massSpecFrom(parent, mass) {
  const width = mass.width ?? parent.width * (mass.widthScale ?? 1)
  const depth = mass.depth ?? parent.depth * (mass.depthScale ?? 1)
  const height = mass.height ?? parent.height * (mass.heightScale ?? 1)
  return {
    ...parent,
    ...mass,
    x: parent.x + (mass.dx ?? 0),
    y: parent.y + (mass.dy ?? 0),
    width,
    depth,
    height,
    floors: mass.floors ?? Math.max(1, Math.round((parent.floors ?? 4) * (mass.heightScale ?? 1))),
    baseZ: mass.baseZ ?? parent.baseZ ?? .12,
    seed: (parent.seed ?? 1) + (mass.seedOffset ?? 0),
  }
}

function compoundMasses(spec) {
  const shared = [{ id: 'core', geometryStyle: spec.geometryStyle, footprintType: spec.footprintType }]
  if (spec.geometryStyle === 'civic') {
    return shared.concat([
      { id: 'west-wing', dx: -.66, dy: .12, widthScale: .64, depthScale: .7, heightScale: .7, floors: 3, footprintType: 'wing', roofType: 'gable', seedOffset: 101 },
      { id: 'east-wing', dx: .62, dy: .2, widthScale: .54, depthScale: .62, heightScale: .58, floors: 2, footprintType: 'wing', roofType: 'hip', seedOffset: 137 },
      { id: 'rear-wing', dx: .05, dy: .6, widthScale: .74, depthScale: .38, heightScale: .48, floors: 2, footprintType: 'wing', roofType: 'gable', seedOffset: 173 },
    ])
  }
  if (spec.geometryStyle === 'market') {
    return shared.concat([
      { id: 'west-stall-hall', dx: -.58, dy: .12, widthScale: .58, depthScale: .7, heightScale: .5, floors: 1, footprintType: 'wing', roofType: 'gable', seedOffset: 211 },
      { id: 'east-stall-hall', dx: .55, dy: .18, widthScale: .48, depthScale: .62, heightScale: .46, floors: 1, footprintType: 'wing', roofType: 'gable', seedOffset: 239 },
      { id: 'market-tower', dx: .04, dy: .48, widthScale: .28, depthScale: .28, heightScale: .9, floors: 2, footprintType: 'tower', roofType: 'hip', seedOffset: 263 },
    ])
  }
  if (spec.geometryStyle === 'station') {
    return shared.concat([
      { id: 'platform-west', dx: -.74, dy: .12, widthScale: .5, depthScale: .56, heightScale: .55, floors: 1, footprintType: 'wing', roofType: 'gable', seedOffset: 307 },
      { id: 'platform-east', dx: .74, dy: .2, widthScale: .46, depthScale: .58, heightScale: .52, floors: 1, footprintType: 'wing', roofType: 'gable', seedOffset: 337 },
      { id: 'station-concourse', dx: .02, dy: .52, widthScale: .72, depthScale: .3, heightScale: .66, floors: 1, footprintType: 'wing', roofType: 'hip', seedOffset: 359 },
    ])
  }
  return shared
}

function addMassGeometry(spec, project, layers, footprint, seed) {
  const base = spec.baseZ ?? .12
  const floors = spec.floors ?? 4
  const floorHeight = spec.height / floors

  addPath(layers.fill, project, footprint.map(point => logicalPoint(spec, point, base)), true)

  for (let floor = 0; floor <= floors; floor += 1) {
    const setback = floor === floors ? .92 : floor >= 2 ? .97 : 1
    const level = scaleFootprint(footprint, setback)
    const z = base + floor * floorHeight
    addPath(floor === floors ? layers.primary : layers.structure, project, level.map(point => logicalPoint(spec, point, z)), true)
  }

  const topLevel = scaleFootprint(footprint, .92).map(point => logicalPoint(spec, point, base + spec.height))
  footprint.forEach((point, index) => addSegment(layers.primary, project, logicalPoint(spec, point, base), topLevel[index]))

  for (let floor = 0; floor < floors; floor += 1) {
    const setback = floor >= 2 ? .97 : 1
    const level = scaleFootprint(footprint, setback)
    const z0 = base + floor * floorHeight
    const z1 = z0 + floorHeight
    addFacadeModules(spec, level, floor, floors, z0, z1, project, layers, seed)
  }

  addRoof(spec, scaleFootprint(footprint, .92), spec.roofType || (spec.geometryStyle === 'market' ? 'gable' : 'hip'), base + spec.height, project, layers)
  if (spec.geometryStyle === 'civic' && spec.id === 'core') addAnnex(spec, footprint, base + spec.height, project, layers)
}

function addCompoundSite(spec, project, layers, masses) {
  const base = spec.baseZ ?? .12
  const courtyard = [
    [-spec.width * .28, -spec.depth * .12],
    [spec.width * .2, -spec.depth * .12],
    [spec.width * .24, spec.depth * .28],
    [-spec.width * .3, spec.depth * .3],
  ]
  const courtyardInner = scaleFootprint(courtyard, .72)
  addPath(layers.primary, project, courtyard.map(point => logicalPoint(spec, point, base + .035)), true)
  addPath(layers.fine, project, courtyardInner.map(point => logicalPoint(spec, point, base + .06)), true)
  courtyard.forEach((point, index) => {
    const next = courtyard[(index + 1) % courtyard.length]
    addSegment(layers.fine, project, logicalPoint(spec, point, base + .06), logicalPoint(spec, next, base + .06))
  })

  const core = masses[0]
  masses.slice(1).forEach((mass, index) => {
    const from = [mass.x - spec.x, mass.y - spec.y, base + Math.min(mass.height, spec.height) * .28]
    const to = [core.x - spec.x, core.y - spec.y, base + Math.min(mass.height, spec.height) * .28]
    addSegment(layers.structure, project, logicalPoint(spec, from, from[2]), logicalPoint(spec, to, to[2]))
    if (index % 2 === 0) {
      addSegment(layers.fine, project, logicalPoint(spec, [from[0], from[1] + .06], from[2] + .16), logicalPoint(spec, [to[0], to[1] + .06], to[2] + .16))
    }
  })

  // Sparse site ribs make the masses sit on one architectural ground plane;
  // they are intentionally weaker than facade lines so they don't become a
  // second terrain mesh.
  const siteRibs = [
    [[-spec.width * .82, -spec.depth * .72], [spec.width * .82, -spec.depth * .72]],
    [[-spec.width * .82, spec.depth * .72], [spec.width * .82, spec.depth * .72]],
  ]
  siteRibs.forEach(([from, to]) => addSegment(layers.fine, project, logicalPoint(spec, from, base + .02), logicalPoint(spec, to, base + .02)))
}

export function createBuildingGeometry(spec, project) {
  const layers = makeLayers()
  const massRecords = compoundMasses(spec).map(mass => massSpecFrom(spec, mass))
  const footprints = massRecords.map(mass => getFootprint(mass))

  massRecords.forEach((mass, index) => addMassGeometry(mass, project, layers, footprints[index], mass.seed))
  if (massRecords.length > 1) addCompoundSite(spec, project, layers, massRecords)

  const hits = footprints.map((footprint, index) => pathFromPoints(
    footprint.map(point => projectPoint(project, logicalPoint(massRecords[index], point, (massRecords[index].baseZ ?? .12) - .03))),
    true,
  )).join(' ')
  const primaryFootprint = footprints[0]
  const floors = spec.floors ?? 4

  return Object.freeze({
    style: spec.geometryStyle || 'generic',
    footprint: primaryFootprint,
    masses: Object.freeze(massRecords.map((mass, index) => Object.freeze({
      id: mass.id,
      x: mass.x,
      y: mass.y,
      width: mass.width,
      depth: mass.depth,
      height: mass.height,
      footprintVertices: footprints[index].length,
    }))),
    layers: Object.freeze(Object.fromEntries(Object.entries(layers).map(([key, paths]) => [key, paths.join(' ')]))),
    hitPath: hits,
    stats: Object.freeze({
      floors,
      masses: massRecords.length,
      footprintVertices: primaryFootprint.length,
      pathCount: Object.values(layers).reduce((total, paths) => total + paths.length, 0),
    }),
  })
}

export const BUILDING_GEOMETRY_STYLES = Object.freeze(['civic', 'market', 'station', 'generic'])
