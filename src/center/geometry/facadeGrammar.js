/*
 * Data-driven facade grammar for the local SVG detail study.
 *
 * The important distinction from the old building renderer is that a
 * building is no longer one cuboid with a few floor lines. It is split into
 * facade bands and cells, then each cell receives a small repeatable module:
 * wall panel, window frame, storefront, balcony, awning, service unit or
 * cable. The renderer still emits ordinary SVG paths; the grammar only owns
 * the architectural structure and deterministic variation.
 */

const format = value => Number(value).toFixed(2)

function pathFromPoints(points, close = false) {
  if (!points.length) return ''
  const commands = [`M${format(points[0][0])} ${format(points[0][1])}`]
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L${format(points[index][0])} ${format(points[index][1])}`)
  }
  if (close) commands.push('Z')
  return commands.join(' ')
}

function line(from, to) {
  return `M${format(from[0])} ${format(from[1])} L${format(to[0])} ${format(to[1])}`
}

function seeded(value) {
  const sample = Math.sin((value * 91.17) + 17.31) * 43758.5453
  return sample - Math.floor(sample)
}

function axisPoint(spec, face, coordinate, z, project) {
  if (face === 'front') {
    return project(spec.x + coordinate, spec.y - spec.depth / 2, z)
  }
  return project(spec.x - spec.width / 2, spec.y + coordinate, z)
}

function facadeQuad(spec, face, start, end, bottom, top, project) {
  return [
    axisPoint(spec, face, start, bottom, project),
    axisPoint(spec, face, end, bottom, project),
    axisPoint(spec, face, end, top, project),
    axisPoint(spec, face, start, top, project),
  ]
}

function facadeLine(spec, face, start, end, z, project) {
  return line(axisPoint(spec, face, start, z, project), axisPoint(spec, face, end, z, project))
}

function verticalLine(spec, face, coordinate, bottom, top, project) {
  return line(axisPoint(spec, face, coordinate, bottom, project), axisPoint(spec, face, coordinate, top, project))
}

function addWindow(spec, face, start, end, bottom, top, project, windows, frames, accents, key) {
  const width = end - start
  const insetX = Math.min(width * .16, .1)
  const insetZ = Math.min((top - bottom) * .2, .1)
  const windowStart = start + insetX
  const windowEnd = end - insetX
  const windowBottom = bottom + insetZ
  const windowTop = top - insetZ
  const outer = facadeQuad(spec, face, windowStart, windowEnd, windowBottom, windowTop, project)
  windows.push(pathFromPoints(outer, true))
  frames.push(
    line(axisPoint(spec, face, (windowStart + windowEnd) / 2, windowBottom, project), axisPoint(spec, face, (windowStart + windowEnd) / 2, windowTop, project)),
    facadeLine(spec, face, windowStart, windowEnd, (windowBottom + windowTop) / 2, project),
  )

  // A second, finer mullion is deliberately sparse. It reads as a real
  // window assembly at close zoom without turning the whole scene into noise.
  if (seeded(key + 11) > .42) {
    frames.push(verticalLine(spec, face, windowStart + width * .3, windowBottom, windowTop, project))
  }
  if (seeded(key + 19) > .58) {
    accents.push(facadeLine(spec, face, windowStart, windowEnd, windowTop + insetZ * .48, project))
  }
}

function addStorefront(spec, face, start, end, bottom, top, project, windows, frames, accents, key) {
  const width = end - start
  const inset = Math.min(width * .1, .07)
  const frame = facadeQuad(spec, face, start + inset, end - inset, bottom + .08, top - .08, project)
  windows.push(pathFromPoints(frame, true))
  frames.push(
    line(frame[0], frame[3]),
    line(axisPoint(spec, face, (start + end) / 2, bottom + .08, project), axisPoint(spec, face, (start + end) / 2, top - .08, project)),
  )
  accents.push(facadeLine(spec, face, start + inset, end - inset, top - .08, project))
  if (seeded(key + 3) > .36) {
    accents.push(facadeLine(spec, face, start + inset * 1.2, end - inset * 1.2, top + .06, project))
  }
}

function addBalcony(spec, face, start, end, bottom, top, project, props, accents) {
  const projection = facadeQuad(spec, face, start - .04, end + .04, bottom - .02, bottom + .025, project)
  props.push(pathFromPoints(projection, true))
  props.push(
    verticalLine(spec, face, start - .035, bottom - .02, bottom + .22, project),
    verticalLine(spec, face, end + .035, bottom - .02, bottom + .22, project),
    facadeLine(spec, face, start - .035, end + .035, bottom + .22, project),
  )
  accents.push(facadeLine(spec, face, start - .04, end + .04, bottom + .11, project))
}

function addAirConditioner(spec, face, coordinate, z, project, props, accents) {
  const width = .13
  const height = .09
  const unit = facadeQuad(spec, face, coordinate - width / 2, coordinate + width / 2, z, z + height, project)
  props.push(pathFromPoints(unit, true))
  accents.push(
    facadeLine(spec, face, coordinate - width * .25, coordinate + width * .25, z + height * .52, project),
    facadeLine(spec, face, coordinate + width * .15, coordinate + width * .65, z - .12, project),
  )
}

function addRoof(spec, top, project, roof, accents) {
  const corners = [
    project(spec.x - spec.width / 2, spec.y - spec.depth / 2, top),
    project(spec.x + spec.width / 2, spec.y - spec.depth / 2, top),
    project(spec.x + spec.width / 2, spec.y + spec.depth / 2, top),
    project(spec.x - spec.width / 2, spec.y + spec.depth / 2, top),
  ]
  roof.push(pathFromPoints(corners, true))
  roof.push(
    line(corners[0], corners[2]),
    line(corners[1], corners[3]),
  )

  const parapetInset = .1
  const inner = [
    project(spec.x - spec.width / 2 + parapetInset, spec.y - spec.depth / 2 + parapetInset, top + .06),
    project(spec.x + spec.width / 2 - parapetInset, spec.y - spec.depth / 2 + parapetInset, top + .06),
    project(spec.x + spec.width / 2 - parapetInset, spec.y + spec.depth / 2 - parapetInset, top + .06),
    project(spec.x - spec.width / 2 + parapetInset, spec.y + spec.depth / 2 - parapetInset, top + .06),
  ]
  roof.push(pathFromPoints(inner, true))

  const antennaBase = project(spec.x + .14, spec.y - .04, top + .08)
  const antennaTop = project(spec.x + .14, spec.y - .04, top + .56)
  roof.push(line(antennaBase, antennaTop), line([antennaTop[0] - 9, antennaTop[1] + 3], [antennaTop[0] + 9, antennaTop[1] - 3]))
  accents.push(facadeLine(spec, 'front', -spec.width * .28, spec.width * .28, top - .04, project))
}

const STYLE_PROFILES = Object.freeze({
  archive: Object.freeze({ floors: 4, columns: 5, balconyRate: .24, airRate: .36, sideWindowRate: .72 }),
  market: Object.freeze({ floors: 2, columns: 4, balconyRate: .08, airRate: .18, sideWindowRate: .68 }),
  station: Object.freeze({ floors: 2, columns: 5, balconyRate: .12, airRate: .1, sideWindowRate: .5 }),
  relay: Object.freeze({ floors: 3, columns: 2, balconyRate: .06, airRate: .08, sideWindowRate: .42 }),
})

export function createFacadeGrammar(spec, project) {
  const profile = STYLE_PROFILES[spec.detailStyle]
  if (!profile) return null

  const base = spec.baseZ ?? .12
  const floors = spec.floors ?? profile.floors
  const columns = spec.columns ?? profile.columns
  const floorHeight = spec.height / floors
  const faces = ['front', 'side']
  const faceLength = { front: spec.width, side: spec.depth }
  const facePaths = []
  const structure = []
  const windows = []
  const frames = []
  const props = []
  const accents = []
  const roof = []
  const seed = spec.seed ?? 1

  faces.forEach((face, faceIndex) => {
    const length = faceLength[face]
    const step = length / columns
    const edgeStart = -length / 2
    const edgeEnd = length / 2
    const wall = facadeQuad(spec, face, edgeStart, edgeEnd, base, base + spec.height, project)
    facePaths.push(pathFromPoints(wall, true))
    structure.push(
      verticalLine(spec, face, edgeStart, base, base + spec.height, project),
      verticalLine(spec, face, edgeEnd, base, base + spec.height, project),
    )

    for (let floor = 0; floor < floors; floor += 1) {
      const floorBottom = base + floor * floorHeight
      const floorTop = floorBottom + floorHeight
      structure.push(facadeLine(spec, face, edgeStart, edgeEnd, floorBottom, project))
      if (floor === floors - 1) structure.push(facadeLine(spec, face, edgeStart, edgeEnd, floorTop, project))

      for (let column = 0; column < columns; column += 1) {
        const start = edgeStart + column * step
        const end = start + step
        const key = seed + faceIndex * 101 + floor * 17 + column * 7
        const isGround = floor === 0
        const isCorner = column === 0 || column === columns - 1
        const detailChance = seeded(key)

        if (isGround && spec.detailStyle !== 'relay') {
          addStorefront(spec, face, start, end, floorBottom + .02, floorTop - .08, project, windows, frames, accents, key)
        } else if (!isGround && detailChance > .08) {
          addWindow(spec, face, start, end, floorBottom + .06, floorTop - .06, project, windows, frames, accents, key)
        }

        if (!isGround && (detailChance > .73 || (isCorner && detailChance > .44))) {
          addBalcony(spec, face, start + step * .18, end - step * .18, floorBottom + .08, floorTop, project, props, accents)
        }

        if (!isGround && seeded(key + 29) < profile.airRate && face === 'side') {
          addAirConditioner(spec, face, start + step * .68, floorBottom + floorHeight * .42, project, props, accents)
        }

        if (!isGround && isCorner) {
          structure.push(verticalLine(spec, face, column === 0 ? start + step * .08 : end - step * .08, floorBottom, floorTop, project))
        }
      }
    }

    // A fine lintel pattern keeps the facade from reading as a flat grid.
    for (let column = 1; column < columns; column += 1) {
      const coordinate = edgeStart + column * step
      structure.push(verticalLine(spec, face, coordinate, base + .02, base + spec.height - .02, project))
    }

    if (face === 'front') {
      const signY = base + floorHeight * .78
      accents.push(facadeLine(spec, face, edgeStart + step * .18, edgeEnd - step * .18, signY, project))
      if (spec.detailStyle === 'archive') {
        accents.push(facadeLine(spec, face, -step * .32, step * .32, signY + .12, project))
      }
    }
  })

  const top = base + spec.height
  addRoof(spec, top, project, roof, accents)

  return Object.freeze({
    facePaths,
    structurePath: structure.join(' '),
    windowPath: windows.join(' '),
    framePath: frames.join(' '),
    propPath: props.join(' '),
    accentPath: accents.join(' '),
    roofPath: roof.join(' '),
    floors,
    columns,
  })
}

export const FACADE_GRAMMAR_STYLES = Object.freeze(Object.keys(STYLE_PROFILES))
