import { createPoint, type CollisionBox, type NavigationBarrierSegment, type Point } from './sceneGeometry'

export type PolygonNavigationOptions = {
  /** The actor-clear walkable rectangle, before obstacle clearance is applied. */
  bounds: CollisionBox
  /** Raw static collision boxes from the shared scene contract. */
  obstacles: readonly CollisionBox[]
  /** Minkowski inset for the current rectangular actor footprint. */
  obstacleInset?: { x: number; y: number }
  /** Non-occupying segments that routes may not cross. */
  barriers?: readonly NavigationBarrierSegment[]
  /** The same actor footprint used by route clearance and barrier endpoints. */
  actorFootprint?: { width: number; height: number }
}

export type PolygonNavigationMesh = {
  findPath: (start: Point, destination: Point) => Point[] | null
  nearestPoint: (point: Point) => Point | null
  /**
   * Resolve a raw world click against the start component of this static
   * mesh. Dynamic actors deliberately do not rewrite the requested target.
   */
  resolvePath: (start: Point, requestedTarget: Point) => PolygonNavigationResolution | null
}

export type PolygonNavigationResolution = {
  requestedTarget: Point
  resolvedNavigableTarget: Point
  path: Point[]
  reachedRequestedTarget: boolean
}

type FreeCell = CollisionBox & { index: number }
type CellEdge = { cell: number; start: number; end: number }
type CellLink = { cell: number; portal: Point }

const epsilon = 0.0001

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function expanded(box: CollisionBox, inset: { x: number; y: number }): CollisionBox {
  return {
    x: box.x - inset.x,
    y: box.y - inset.y,
    width: box.width + inset.x * 2,
    height: box.height + inset.y * 2,
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

function cross(first: Point, second: Point) {
  return first.x * second.y - first.y * second.x
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y }
}

function barrierTangentClearance(barrier: NavigationBarrierSegment, footprint: { width: number; height: number }) {
  const dx = barrier.end.x - barrier.start.x
  const dy = barrier.end.y - barrier.start.y
  const length = Math.hypot(dx, dy)
  if (length <= epsilon) return 0
  return (Math.abs(dx / length) * footprint.width + Math.abs(dy / length) * footprint.height) / 2
}

/**
 * A barrier is a crossing rule, not an occupied strip. Only a segment that
 * changes sides through its span is blocked; movement beside the line remains
 * legal. Endpoint clearance uses the current rectangular actor footprint.
 */
export function navigationBarrierBlocksTravel(
  start: Point,
  end: Point,
  barrier: NavigationBarrierSegment,
  footprint: { width: number; height: number } = { width: 0, height: 0 },
) {
  const direction = subtract(barrier.end, barrier.start)
  const lengthSquared = direction.x * direction.x + direction.y * direction.y
  if (lengthSquared <= epsilon) return false
  const startSide = cross(direction, subtract(start, barrier.start))
  const endSide = cross(direction, subtract(end, barrier.start))
  const onStart = Math.abs(startSide) <= epsilon
  const onEnd = Math.abs(endSide) <= epsilon
  if (!onStart && !onEnd && startSide * endSide >= 0) return false
  if (onStart && onEnd) {
    const projection = (point: Point) => ((point.x - barrier.start.x) * direction.x + (point.y - barrier.start.y) * direction.y) / lengthSquared
    const extension = barrierTangentClearance(barrier, footprint) / Math.sqrt(lengthSquared)
    return Math.min(projection(start), projection(end)) <= 1 + extension + epsilon
      && Math.max(projection(start), projection(end)) >= -extension - epsilon
  }
  const crossing = startSide / (startSide - endSide)
  const point = {
    x: start.x + (end.x - start.x) * crossing,
    y: start.y + (end.y - start.y) * crossing,
  }
  const projection = ((point.x - barrier.start.x) * direction.x + (point.y - barrier.start.y) * direction.y) / lengthSquared
  const extension = barrierTangentClearance(barrier, footprint) / Math.sqrt(lengthSquared)
  return projection >= -extension - epsilon && projection <= 1 + extension + epsilon
}

export function navigationBarriersAllowTravel(
  start: Point,
  end: Point,
  barriers: readonly NavigationBarrierSegment[] = [],
  footprint: { width: number; height: number } = { width: 0, height: 0 },
) {
  return barriers.every((barrier) => !navigationBarrierBlocksTravel(start, end, barrier, footprint))
}

function uniqueSorted(values: number[]) {
  return [...new Set(values.map((value) => Number(value.toFixed(4))))].sort((first, second) => first - second)
}

function clippedObstacle(box: CollisionBox, bounds: CollisionBox, inset: { x: number; y: number }): CollisionBox | null {
  const clipped = expanded(box, inset)
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
  obstacles: readonly CollisionBox[],
  barriers: readonly NavigationBarrierSegment[],
  footprint: { width: number; height: number },
) {
  for (const group of edges.values()) {
    // Only intervals that overlap can share a portal. Barrier endpoints add
    // legitimate scene grid lines, so a full all-pairs comparison here grows
    // quadratically even though nearly every pair is disjoint.
    const ordered = [...group].sort((first, second) => first.start - second.start || first.end - second.end)
    for (let firstIndex = 0; firstIndex < ordered.length; firstIndex += 1) {
      const first = ordered[firstIndex]!
      for (let secondIndex = firstIndex + 1; secondIndex < ordered.length; secondIndex += 1) {
        const second = ordered[secondIndex]!
        if (second.start >= first.end - epsilon) break
        if (first.cell === second.cell) continue
        const start = Math.max(first.start, second.start)
        const end = Math.min(first.end, second.end)
        if (end - start <= epsilon) continue
        const firstCell = cells[first.cell]!
        const secondCell = cells[second.cell]!
        const portal = sharedPortal(firstCell, secondCell)
        if (!portal) continue
        // A relation/access barrier splits otherwise adjacent free cells. The
        // direct center-to-center edge is the shared topology contract used
        // by component projection; route visibility remains the final path
        // planner below.
        const firstCenter = { x: firstCell.x + firstCell.width / 2, y: firstCell.y + firstCell.height / 2 }
        const secondCenter = { x: secondCell.x + secondCell.width / 2, y: secondCell.y + secondCell.height / 2 }
        if (!segmentIsClear(firstCenter, secondCenter, obstacles, barriers, footprint)) continue
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

function segmentIsClear(
  start: Point,
  end: Point,
  obstacles: readonly CollisionBox[],
  barriers: readonly NavigationBarrierSegment[] = [],
  footprint: { width: number; height: number } = { width: 0, height: 0 },
) {
  return obstacles.every((obstacle) => !segmentCrossesInterior(start, end, obstacle))
    && navigationBarriersAllowTravel(start, end, barriers, footprint)
}

function compressVisiblePath(path: Point[], obstacles: readonly CollisionBox[], barriers: readonly NavigationBarrierSegment[] = [], footprint: { width: number; height: number } = { width: 0, height: 0 }) {
  if (path.length < 3) return path
  const compressed = [path[0]!]
  let anchorIndex = 0
  while (anchorIndex < path.length - 1) {
    let nextIndex = anchorIndex + 1
    for (let candidateIndex = path.length - 1; candidateIndex > anchorIndex + 1; candidateIndex -= 1) {
      if (segmentIsClear(path[anchorIndex]!, path[candidateIndex]!, obstacles, barriers, footprint)) {
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
      if (!segmentIsClear(previous, next, obstacles, barriers, footprint)) continue
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
  const inset = options.obstacleInset ?? createPoint(0, 0)
  const obstacles = options.obstacles
    .map((obstacle) => clippedObstacle(obstacle, bounds, inset))
    .filter((obstacle): obstacle is CollisionBox => Boolean(obstacle))
  const barriers = options.barriers ?? []
  const actorFootprint = options.actorFootprint ?? {
    width: (options.obstacleInset?.x ?? 0) * 2,
    height: (options.obstacleInset?.y ?? 0) * 2,
  }

  const xLines = uniqueSorted([
    bounds.x,
    bounds.x + bounds.width,
    ...obstacles.flatMap((obstacle) => [obstacle.x, obstacle.x + obstacle.width]),
    ...barriers.flatMap((barrier) => [barrier.start.x, barrier.end.x]),
  ]).filter((value) => value >= bounds.x - epsilon && value <= bounds.x + bounds.width + epsilon)
  const yLines = uniqueSorted([
    bounds.y,
    bounds.y + bounds.height,
    ...obstacles.flatMap((obstacle) => [obstacle.y, obstacle.y + obstacle.height]),
    ...barriers.flatMap((barrier) => [barrier.start.y, barrier.end.y]),
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
  connectEdgeGroups(verticalEdges, cells, links, obstacles, barriers, actorFootprint)
  connectEdgeGroups(horizontalEdges, cells, links, obstacles, barriers, actorFootprint)

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

  const reachableCellIdsFrom = (start: Point) => {
    const startCell = cellContaining(start)
    if (!startCell) return new Set<number>()
    const reachable = new Set([startCell.index])
    const queue = [startCell.index]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const link of links.get(current) ?? []) {
        if (reachable.has(link.cell)) continue
        reachable.add(link.cell)
        queue.push(link.cell)
      }
    }
    return reachable
  }

  const nearestPointInCells = (point: Point, allowedCells: ReadonlySet<number>): Point | null => {
    let closest: Point | null = null
    let closestDistance = Infinity
    for (const cell of cells) {
      if (!allowedCells.has(cell.index)) continue
      const insetX = Math.min(.02, cell.width / 2)
      const insetY = Math.min(.02, cell.height / 2)
      const candidate = {
        x: clamp(point.x, cell.x + insetX, cell.x + cell.width - insetX),
        y: clamp(point.y, cell.y + insetY, cell.y + cell.height - insetY),
      }
      const candidateDistance = pointDistance(point, candidate)
      if (candidateDistance < closestDistance) {
        closestDistance = candidateDistance
        closest = candidate
      }
    }
    return closest
  }

  // Obstacles and relation barriers are static for this mesh. Build their
  // visibility graph once; each route only adds its start and goal edges.
  const cornerOffset = .02
  const barrierDetours = barriers.flatMap((barrier) => {
    const dx = barrier.end.x - barrier.start.x
    const dy = barrier.end.y - barrier.start.y
    const length = Math.hypot(dx, dy)
    if (length <= epsilon) return []
    const tangent = { x: dx / length, y: dy / length }
    const normal = { x: -tangent.y, y: tangent.x }
    const edgeClearance = barrierTangentClearance(barrier, actorFootprint) + cornerOffset
    return [barrier.start, barrier.end].flatMap((endpoint, index) => {
      const outward = index === 0 ? -1 : 1
      return [-1, 1].map((side) => ({
        x: endpoint.x + tangent.x * edgeClearance * outward + normal.x * cornerOffset * side,
        y: endpoint.y + tangent.y * edgeClearance * outward + normal.y * cornerOffset * side,
      }))
    })
  })
  const staticVisibilityNodes = [
    ...obstacles.flatMap((obstacle) => [
      { x: obstacle.x - cornerOffset, y: obstacle.y - cornerOffset },
      { x: obstacle.x + obstacle.width + cornerOffset, y: obstacle.y - cornerOffset },
      { x: obstacle.x + obstacle.width + cornerOffset, y: obstacle.y + obstacle.height + cornerOffset },
      { x: obstacle.x - cornerOffset, y: obstacle.y + obstacle.height + cornerOffset },
    ]),
    ...barrierDetours,
  ].filter((node) => (
    node.x >= bounds.x && node.x <= bounds.x + bounds.width
    && node.y >= bounds.y && node.y <= bounds.y + bounds.height
    && obstacles.every((obstacle) => !containsPoint(obstacle, node))
  ))
  const staticVisibilityDistances = staticVisibilityNodes.map(() => new Map<number, number>())
  let visibilityGraphReady = false
  const ensureVisibilityGraph = () => {
    if (visibilityGraphReady) return
    visibilityGraphReady = true
    staticVisibilityNodes.forEach((node, nodeIndex) => {
      for (let candidateIndex = nodeIndex + 1; candidateIndex < staticVisibilityNodes.length; candidateIndex += 1) {
        const candidate = staticVisibilityNodes[candidateIndex]!
        if (!segmentIsClear(node, candidate, obstacles, barriers, actorFootprint)) continue
        const distance = pointDistance(node, candidate)
        staticVisibilityDistances[nodeIndex]!.set(candidateIndex, distance)
        staticVisibilityDistances[candidateIndex]!.set(nodeIndex, distance)
      }
    })
  }

  const findPathToGoal = (start: Point, goal: Point): Point[] | null => {
    if (segmentIsClear(start, goal, obstacles, barriers, actorFootprint)) return [start, goal]
    ensureVisibilityGraph()

    const visibilityNodes = [start, goal, ...staticVisibilityNodes]
    const visibilityDistances = visibilityNodes.map(() => new Map<number, number>())
    staticVisibilityDistances.forEach((links, nodeIndex) => {
      links.forEach((distance, candidateIndex) => {
        visibilityDistances[nodeIndex + 2]!.set(candidateIndex + 2, distance)
      })
    })
    for (let dynamicIndex = 0; dynamicIndex < 2; dynamicIndex += 1) {
      const node = visibilityNodes[dynamicIndex]!
      for (let candidateIndex = dynamicIndex + 1; candidateIndex < visibilityNodes.length; candidateIndex += 1) {
        const candidate = visibilityNodes[candidateIndex]!
        if (!segmentIsClear(node, candidate, obstacles, barriers, actorFootprint)) continue
        const distance = pointDistance(node, candidate)
        visibilityDistances[dynamicIndex]!.set(candidateIndex, distance)
        visibilityDistances[candidateIndex]!.set(dynamicIndex, distance)
      }
    }
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

  const resolvePath = (start: Point, requestedTarget: Point): PolygonNavigationResolution | null => {
    const reachableCells = reachableCellIdsFrom(start)
    if (reachableCells.size === 0) return null
    const liesOnBarrier = barriers.some((barrier) => {
      const dx = barrier.end.x - barrier.start.x
      const dy = barrier.end.y - barrier.start.y
      const length = Math.hypot(dx, dy)
      if (length <= epsilon) return pointDistance(requestedTarget, barrier.start) <= epsilon
      const cross = (requestedTarget.x - barrier.start.x) * dy - (requestedTarget.y - barrier.start.y) * dx
      const along = (requestedTarget.x - barrier.start.x) * dx + (requestedTarget.y - barrier.start.y) * dy
      return Math.abs(cross) <= epsilon * length && along >= -epsilon && along <= length * length + epsilon
    })
    const targetCell = liesOnBarrier ? undefined : cellContaining(requestedTarget)
    const reachedRequestedTarget = Boolean(targetCell && reachableCells.has(targetCell.index))
    const resolvedNavigableTarget = reachedRequestedTarget
      ? { x: requestedTarget.x, y: requestedTarget.y }
      : nearestPointInCells(requestedTarget, reachableCells)
    if (!resolvedNavigableTarget) return null
    const path = findPathToGoal(start, resolvedNavigableTarget)
    if (!path) return null
    return { requestedTarget: { ...requestedTarget }, resolvedNavigableTarget, path, reachedRequestedTarget }
  }

  // Keep the established route API strict: callers that ask for an exact
  // navigation point must not silently receive a projected target. World
  // clicks opt into projection explicitly through resolvePath().
  const findPath = (start: Point, destination: Point): Point[] | null => findPathToGoal(start, destination)

  return { findPath, nearestPoint, resolvePath }
}
