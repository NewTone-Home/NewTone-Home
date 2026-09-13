import type { CollisionBox, Point } from './sceneGeometry'

export type PolygonNavigationOptions = {
  /** The actor-clear walkable rectangle, before obstacle clearance is applied. */
  bounds: CollisionBox
  /** Raw static collision boxes from the shared scene contract. */
  obstacles: readonly CollisionBox[]
  /** Clearance around every obstacle for the current actor. */
  obstacleClearance?: number
}

export type PolygonNavigationMesh = {
  findPath: (start: Point, destination: Point) => Point[] | null
  nearestPoint: (point: Point) => Point | null
}

type FreeCell = CollisionBox & { index: number }
type CellEdge = { cell: number; start: number; end: number }
type CellLink = { cell: number; portal: Point }

const epsilon = 0.0001

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function expanded(box: CollisionBox, amount: number): CollisionBox {
  return {
    x: box.x - amount,
    y: box.y - amount,
    width: box.width + amount * 2,
    height: box.height + amount * 2,
  }
}

function containsPoint(box: CollisionBox, point: Point) {
  return point.x >= box.x - epsilon
    && point.x <= box.x + box.width + epsilon
    && point.y >= box.y - epsilon
    && point.y <= box.y + box.height + epsilon
}

function overlaps(first: CollisionBox, second: CollisionBox) {
  return first.x < second.x + second.width - epsilon
    && first.x + first.width > second.x + epsilon
    && first.y < second.y + second.height - epsilon
    && first.y + first.height > second.y + epsilon
}

function pointDistance(first: Point, second: Point) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function uniqueSorted(values: number[]) {
  return [...new Set(values.map((value) => Number(value.toFixed(4))))].sort((first, second) => first - second)
}

function clippedObstacle(box: CollisionBox, bounds: CollisionBox, clearance: number): CollisionBox | null {
  const clipped = expanded(box, clearance)
  const left = Math.max(bounds.x, clipped.x)
  const top = Math.max(bounds.y, clipped.y)
  const right = Math.min(bounds.x + bounds.width, clipped.x + clipped.width)
  const bottom = Math.min(bounds.y + bounds.height, clipped.y + clipped.height)
  if (right - left <= epsilon || bottom - top <= epsilon) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function sharedPortal(first: FreeCell, second: FreeCell): Point | null {
  const verticalGap = Math.abs((first.x + first.width) - second.x) <= epsilon
    || Math.abs((second.x + second.width) - first.x) <= epsilon
  if (verticalGap) {
    const start = Math.max(first.y, second.y)
    const end = Math.min(first.y + first.height, second.y + second.height)
    if (end - start > epsilon) return { x: Math.max(first.x, second.x), y: (start + end) / 2 }
  }

  const horizontalGap = Math.abs((first.y + first.height) - second.y) <= epsilon
    || Math.abs((second.y + second.height) - first.y) <= epsilon
  if (horizontalGap) {
    const start = Math.max(first.x, second.x)
    const end = Math.min(first.x + first.width, second.x + second.width)
    if (end - start > epsilon) return { x: (start + end) / 2, y: Math.max(first.y, second.y) }
  }
  return null
}

function connectEdgeGroups(
  edges: Map<string, CellEdge[]>,
  cells: readonly FreeCell[],
  links: Map<number, CellLink[]>,
) {
  for (const group of edges.values()) {
    for (let firstIndex = 0; firstIndex < group.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < group.length; secondIndex += 1) {
        const first = group[firstIndex]!
        const second = group[secondIndex]!
        if (first.cell === second.cell) continue
        const start = Math.max(first.start, second.start)
        const end = Math.min(first.end, second.end)
        if (end - start <= epsilon) continue
        const firstCell = cells[first.cell]!
        const secondCell = cells[second.cell]!
        const portal = sharedPortal(firstCell, secondCell)
        if (!portal) continue
        const firstLinks = links.get(first.cell) ?? []
        const secondLinks = links.get(second.cell) ?? []
        if (!firstLinks.some((link) => link.cell === second.cell)) firstLinks.push({ cell: second.cell, portal })
        if (!secondLinks.some((link) => link.cell === first.cell)) secondLinks.push({ cell: first.cell, portal })
        links.set(first.cell, firstLinks)
        links.set(second.cell, secondLinks)
      }
    }
  }
}

function segmentCrossesInterior(start: Point, end: Point, box: CollisionBox) {
  let entry = 0
  let exit = 1
  const axes = [
    [start.x, end.x, box.x, box.x + box.width],
    [start.y, end.y, box.y, box.y + box.height],
  ] as const
  for (const [startValue, endValue, minimum, maximum] of axes) {
    const delta = endValue - startValue
    if (Math.abs(delta) <= epsilon) {
      if (startValue <= minimum + epsilon || startValue >= maximum - epsilon) return false
      continue
    }
    const first = (minimum - startValue) / delta
    const second = (maximum - startValue) / delta
    entry = Math.max(entry, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
    if (entry >= exit - epsilon) return false
  }
  return entry < 1 - epsilon && exit > epsilon && entry < exit - epsilon
}

function segmentIsClear(start: Point, end: Point, obstacles: readonly CollisionBox[]) {
  return obstacles.every((obstacle) => !segmentCrossesInterior(start, end, obstacle))
}

function compressVisiblePath(path: Point[], obstacles: readonly CollisionBox[]) {
  if (path.length < 3) return path
  const compressed = [path[0]!]
  let anchorIndex = 0
  while (anchorIndex < path.length - 1) {
    let nextIndex = anchorIndex + 1
    for (let candidateIndex = path.length - 1; candidateIndex > anchorIndex + 1; candidateIndex -= 1) {
      if (segmentIsClear(path[anchorIndex]!, path[candidateIndex]!, obstacles)) {
        nextIndex = candidateIndex
        break
      }
    }
    compressed.push(path[nextIndex]!)
    anchorIndex = nextIndex
  }
  let changed = true
  while (changed && compressed.length >= 3) {
    changed = false
    for (let index = 1; index < compressed.length - 1; index += 1) {
      const previous = compressed[index - 1]!
      const current = compressed[index]!
      const next = compressed[index + 1]!
      const incoming = { x: current.x - previous.x, y: current.y - previous.y }
      const outgoing = { x: next.x - current.x, y: next.y - current.y }
      if (incoming.x * outgoing.x + incoming.y * outgoing.y >= 0) continue
      if (!segmentIsClear(previous, next, obstacles)) continue
      compressed.splice(index, 1)
      changed = true
      break
    }
  }
  return compressed
}

/**
 * Build one continuous scene navigator from the canonical collision boxes.
 * Obstacle edges define free-space cells; the cell graph only owns adjacency,
 * while the resulting waypoints remain real scene coordinates. This replaces
 * the old arbitrary-size search lattice and keeps doors out of route search.
 */
export function createPolygonNavigationMesh(options: PolygonNavigationOptions): PolygonNavigationMesh {
  const bounds = options.bounds
  const clearance = options.obstacleClearance ?? 0
  const obstacles = options.obstacles
    .map((obstacle) => clippedObstacle(obstacle, bounds, clearance))
    .filter((obstacle): obstacle is CollisionBox => Boolean(obstacle))

  const xLines = uniqueSorted([
    bounds.x,
    bounds.x + bounds.width,
    ...obstacles.flatMap((obstacle) => [obstacle.x, obstacle.x + obstacle.width]),
  ]).filter((value) => value >= bounds.x - epsilon && value <= bounds.x + bounds.width + epsilon)
  const yLines = uniqueSorted([
    bounds.y,
    bounds.y + bounds.height,
    ...obstacles.flatMap((obstacle) => [obstacle.y, obstacle.y + obstacle.height]),
  ]).filter((value) => value >= bounds.y - epsilon && value <= bounds.y + bounds.height + epsilon)

  const cells: FreeCell[] = []
  for (let xIndex = 0; xIndex < xLines.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < yLines.length - 1; yIndex += 1) {
      const left = xLines[xIndex]!
      const right = xLines[xIndex + 1]!
      const top = yLines[yIndex]!
      const bottom = yLines[yIndex + 1]!
      if (right - left <= epsilon || bottom - top <= epsilon) continue
      const cell: CollisionBox = { x: left, y: top, width: right - left, height: bottom - top }
      const center = { x: (left + right) / 2, y: (top + bottom) / 2 }
      if (obstacles.some((obstacle) => containsPoint(obstacle, center) || overlaps(cell, obstacle))) continue
      cells.push({ ...cell, index: cells.length })
    }
  }

  const verticalEdges = new Map<string, CellEdge[]>()
  const horizontalEdges = new Map<string, CellEdge[]>()
  const addEdge = (map: Map<string, CellEdge[]>, coordinate: number, start: number, end: number, cell: number) => {
    const key = coordinate.toFixed(4)
    const group = map.get(key) ?? []
    group.push({ cell, start, end })
    map.set(key, group)
  }
  cells.forEach((cell) => {
    addEdge(verticalEdges, cell.x, cell.y, cell.y + cell.height, cell.index)
    addEdge(verticalEdges, cell.x + cell.width, cell.y, cell.y + cell.height, cell.index)
    addEdge(horizontalEdges, cell.y, cell.x, cell.x + cell.width, cell.index)
    addEdge(horizontalEdges, cell.y + cell.height, cell.x, cell.x + cell.width, cell.index)
  })
  const links = new Map<number, CellLink[]>()
  connectEdgeGroups(verticalEdges, cells, links)
  connectEdgeGroups(horizontalEdges, cells, links)

  const cellContaining = (point: Point) => cells.find((cell) => containsPoint(cell, point))
  const nearestPoint = (point: Point): Point | null => {
    let closest: Point | null = null
    let closestDistance = Infinity
    for (const cell of cells) {
      const candidate = {
        x: clamp(point.x, cell.x, cell.x + cell.width),
        y: clamp(point.y, cell.y, cell.y + cell.height),
      }
      const distance = pointDistance(point, candidate)
      if (distance < closestDistance) {
        closestDistance = distance
        closest = candidate
      }
    }
    return closest
  }

  const findPath = (start: Point, destination: Point): Point[] | null => {
    const exactDestinationCell = cellContaining(destination)
    const goal = exactDestinationCell ? { x: destination.x, y: destination.y } : nearestPoint(destination)
    if (!goal) return null
    if (segmentIsClear(start, goal, obstacles)) return [start, goal]

    const cornerOffset = .02
    const visibilityNodes = [start, goal, ...obstacles.flatMap((obstacle) => [
      { x: obstacle.x - cornerOffset, y: obstacle.y - cornerOffset },
      { x: obstacle.x + obstacle.width + cornerOffset, y: obstacle.y - cornerOffset },
      { x: obstacle.x + obstacle.width + cornerOffset, y: obstacle.y + obstacle.height + cornerOffset },
      { x: obstacle.x - cornerOffset, y: obstacle.y + obstacle.height + cornerOffset },
    ]).filter((node) => (
      node.x >= bounds.x && node.x <= bounds.x + bounds.width
      && node.y >= bounds.y && node.y <= bounds.y + bounds.height
      && obstacles.every((obstacle) => !containsPoint(obstacle, node))
    ))]
    const visibilityDistances = visibilityNodes.map(() => new Map<number, number>())
    visibilityNodes.forEach((node, nodeIndex) => {
      visibilityNodes.forEach((candidate, candidateIndex) => {
        if (nodeIndex === candidateIndex || !segmentIsClear(node, candidate, obstacles)) return
        visibilityDistances[nodeIndex]!.set(candidateIndex, pointDistance(node, candidate))
      })
    })
    const visibilityCost = visibilityNodes.map(() => Infinity)
    const visibilityPrevious = visibilityNodes.map(() => -1)
    const visited = new Set<number>()
    visibilityCost[0] = 0
    for (let iteration = 0; iteration < visibilityNodes.length; iteration += 1) {
      let current = -1
      for (let index = 0; index < visibilityCost.length; index += 1) {
        if (visited.has(index) || visibilityCost[index] === Infinity) continue
        if (current < 0 || visibilityCost[index]! < visibilityCost[current]!) current = index
      }
      if (current < 0) break
      visited.add(current)
      for (const [candidate, edgeCost] of visibilityDistances[current]!) {
        const nextCost = visibilityCost[current]! + edgeCost
        if (nextCost < visibilityCost[candidate]!) {
          visibilityCost[candidate] = nextCost
          visibilityPrevious[candidate] = current
        }
      }
    }
    if (visibilityCost[1] !== Infinity) {
      const visibilityPath: Point[] = []
      for (let current = 1; current >= 0; current = visibilityPrevious[current]!) {
        visibilityPath.push(visibilityNodes[current]!)
        if (current === 0) break
      }
      return visibilityPath.reverse()
    }

    return null
  }

  return { findPath, nearestPoint }
}
