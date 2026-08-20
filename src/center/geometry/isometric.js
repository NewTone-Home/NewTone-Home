export const CENTER_SCENE_VIEWBOX = Object.freeze({ width: 1600, height: 1000 })

export const ISOMETRIC_PROJECTION = Object.freeze({
  originX: 820,
  originY: 165,
  tileX: 55,
  tileY: 29,
  height: 18,
})

export function projectPoint(x, y, z = 0, projection = ISOMETRIC_PROJECTION) {
  return [
    projection.originX + (x - y) * projection.tileX,
    projection.originY + (x + y) * projection.tileY - z * projection.height,
  ]
}

export function pointsAttribute(points) {
  return points.map(point => point.join(',')).join(' ')
}

export function polygonPath(points) {
  if (!points.length) return ''
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0]} ${point[1]}`).join(' ')} Z`
}

export function projectGroundPolygon(points) {
  return points.map(([x, y]) => projectPoint(x, y))
}

export function projectGroundLine(points) {
  return points.map(([x, y]) => projectPoint(x, y))
}

export function buildingGeometry(building) {
  const { x, y, width, depth, height } = building.geometry
  const ground = [
    projectPoint(x, y),
    projectPoint(x + width, y),
    projectPoint(x + width, y + depth),
    projectPoint(x, y + depth),
  ]
  const top = [
    projectPoint(x, y, height),
    projectPoint(x + width, y, height),
    projectPoint(x + width, y + depth, height),
    projectPoint(x, y + depth, height),
  ]

  return {
    ground,
    top,
    roof: polygonPath(top),
    eastFace: polygonPath([top[1], ground[1], ground[2], top[2]]),
    westFace: polygonPath([top[2], ground[2], ground[3], top[3]]),
    trace: [
      `M${ground[3][0]} ${ground[3][1]} L${ground[2][0]} ${ground[2][1]} L${ground[1][0]} ${ground[1][1]}`,
      `M${ground[3][0]} ${ground[3][1]} L${top[3][0]} ${top[3][1]} L${top[0][0]} ${top[0][1]} L${top[1][0]} ${top[1][1]} L${top[2][0]} ${top[2][1]} L${top[3][0]} ${top[3][1]}`,
      `M${top[1][0]} ${top[1][1]} L${ground[1][0]} ${ground[1][1]}`,
      `M${top[2][0]} ${top[2][1]} L${ground[2][0]} ${ground[2][1]}`,
    ].join(' '),
    anchor: [
      (top[0][0] + top[1][0] + top[2][0] + top[3][0]) / 4,
      Math.min(...top.map(point => point[1])),
    ],
  }
}

export function entityGroundAnchor(entity) {
  if (entity.kind === 'building') return buildingGeometry(entity).anchor
  if (entity.geometry?.point) return projectPoint(...entity.geometry.point)
  if (entity.geometry?.points?.length) {
    const projected = projectGroundPolygon(entity.geometry.points)
    return [
      projected.reduce((sum, point) => sum + point[0], 0) / projected.length,
      projected.reduce((sum, point) => sum + point[1], 0) / projected.length,
    ]
  }
  return [CENTER_SCENE_VIEWBOX.width / 2, CENTER_SCENE_VIEWBOX.height / 2]
}

