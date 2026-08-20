import { buildingGeometry, polygonPath, projectPoint } from './isometric'

const linePath = (start, end) => `M${start[0]} ${start[1]} L${end[0]} ${end[1]}`

function between(start, end, amount) {
  return [
    start[0] + (end[0] - start[0]) * amount,
    start[1] + (end[1] - start[1]) * amount,
  ]
}

function faceGrid(topStart, topEnd, bottomStart, bottomEnd, columns, rows) {
  const vertical = []
  const horizontal = []

  for (let index = 1; index < columns; index += 1) {
    const amount = index / columns
    vertical.push(linePath(between(topStart, topEnd, amount), between(bottomStart, bottomEnd, amount)))
  }

  for (let index = 1; index < rows; index += 1) {
    const amount = index / rows
    horizontal.push(linePath(between(topStart, bottomStart, amount), between(topEnd, bottomEnd, amount)))
  }

  return { vertical, horizontal }
}

export function buildingFacadeGeometry(building) {
  const geometry = buildingGeometry(building)
  const east = building.visual?.facade?.east || [0, 0]
  const west = building.visual?.facade?.west || [0, 0]

  return {
    east: faceGrid(geometry.top[1], geometry.top[2], geometry.ground[1], geometry.ground[2], east[0], east[1]),
    west: faceGrid(geometry.top[2], geometry.top[3], geometry.ground[2], geometry.ground[3], west[0], west[1]),
  }
}

export function buildingRoofGeometry(building) {
  const geometry = buildingGeometry(building)
  const { x, y, width, depth, height } = building.geometry
  const visual = building.visual || {}
  const style = visual.roof || 'flat'
  const rise = visual.roofRise || Math.min(width, depth) * .3
  const axis = visual.roofAxis || 'x'
  const lines = []
  const faces = []
  let special = null

  if (style === 'gable') {
    if (axis === 'y') {
      const ridgeStart = projectPoint(x + width / 2, y, height + rise)
      const ridgeEnd = projectPoint(x + width / 2, y + depth, height + rise)
      faces.push(
        polygonPath([geometry.top[0], ridgeStart, ridgeEnd, geometry.top[3]]),
        polygonPath([ridgeStart, geometry.top[1], geometry.top[2], ridgeEnd]),
      )
      lines.push(linePath(ridgeStart, ridgeEnd))
    } else {
      const ridgeStart = projectPoint(x, y + depth / 2, height + rise)
      const ridgeEnd = projectPoint(x + width, y + depth / 2, height + rise)
      faces.push(
        polygonPath([geometry.top[0], geometry.top[1], ridgeEnd, ridgeStart]),
        polygonPath([ridgeStart, ridgeEnd, geometry.top[2], geometry.top[3]]),
      )
      lines.push(linePath(ridgeStart, ridgeEnd))
    }
  }

  if (style === 'flat' || style === 'terrace' || style === 'canopy') {
    const inset = Math.min(width, depth) * .12
    const inner = [
      projectPoint(x + inset, y + inset, height + .03),
      projectPoint(x + width - inset, y + inset, height + .03),
      projectPoint(x + width - inset, y + depth - inset, height + .03),
      projectPoint(x + inset, y + depth - inset, height + .03),
    ]
    lines.push(polygonPath(inner))

    if (style === 'terrace') {
      const terraceInset = Math.min(width, depth) * .28
      const terrace = [
        projectPoint(x + terraceInset, y + terraceInset, height + .28),
        projectPoint(x + width - terraceInset, y + terraceInset, height + .28),
        projectPoint(x + width - terraceInset, y + depth - terraceInset, height + .28),
        projectPoint(x + terraceInset, y + depth - terraceInset, height + .28),
      ]
      lines.push(polygonPath(terrace))
    }

    if (style === 'canopy') {
      for (let index = 1; index < 5; index += 1) {
        const amount = index / 5
        lines.push(linePath(between(geometry.top[0], geometry.top[3], amount), between(geometry.top[1], geometry.top[2], amount)))
      }
    }
  }

  if (style === 'sawtooth') {
    const count = Math.max(3, Math.round((axis === 'x' ? depth : width) * 1.5))
    for (let index = 1; index < count; index += 1) {
      const amount = index / count
      if (axis === 'y') {
        const start = projectPoint(x + width * amount, y, height + (index % 2 ? rise : .04))
        const end = projectPoint(x + width * amount, y + depth, height + (index % 2 ? rise : .04))
        lines.push(linePath(start, end))
      } else {
        const start = projectPoint(x, y + depth * amount, height + (index % 2 ? rise : .04))
        const end = projectPoint(x + width, y + depth * amount, height + (index % 2 ? rise : .04))
        lines.push(linePath(start, end))
      }
    }
  }

  if (style === 'dome') {
    const center = projectPoint(x + width / 2, y + depth / 2, height)
    const left = projectPoint(x + width * .12, y + depth / 2, height)
    const right = projectPoint(x + width * .88, y + depth / 2, height)
    const crown = projectPoint(x + width / 2, y + depth / 2, height + rise)
    special = {
      dome: `M${left[0]} ${left[1]} Q${crown[0]} ${crown[1]} ${right[0]} ${right[1]} M${center[0]} ${center[1] - 1} L${crown[0]} ${crown[1]}`,
    }
  }

  if (style === 'spire') {
    const center = projectPoint(x + width / 2, y + depth / 2, height)
    const peak = projectPoint(x + width / 2, y + depth / 2, height + rise)
    special = {
      spire: [
        linePath(geometry.top[0], peak),
        linePath(geometry.top[1], peak),
        linePath(geometry.top[2], peak),
        linePath(geometry.top[3], peak),
        linePath(center, peak),
      ],
    }
  }

  return { faces, lines, special }
}

export function buildingGroundGeometry(building) {
  const { x, y, width, depth } = building.geometry
  const pad = .12
  return polygonPath([
    projectPoint(x - pad, y - pad),
    projectPoint(x + width + pad, y - pad),
    projectPoint(x + width + pad, y + depth + pad),
    projectPoint(x - pad, y + depth + pad),
  ])
}

export function buildingStepsGeometry(building) {
  if (!building.visual?.steps) return []
  const { x, y, width, depth } = building.geometry
  const start = x + width * .2
  const end = x + width * .8

  return Array.from({ length: 3 }, (_, index) => {
    const offset = .08 + index * .12
    return polygonPath([
      projectPoint(start, y + depth + offset),
      projectPoint(end, y + depth + offset),
      projectPoint(end, y + depth + offset + .065),
      projectPoint(start, y + depth + offset + .065),
    ])
  })
}

export function detailAnchor(detail) {
  return projectPoint(...detail.point)
}
