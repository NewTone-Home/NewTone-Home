import type { Point } from './sceneGeometry'

export type DoorRegionBox = {
  x: number
  y: number
  width: number
  height: number
}

export type DoorRegionNormal = {
  axis: 'x' | 'y'
  direction: -1 | 1
}

/**
 * A doorway is a fixed geometric region. Its visual cell, collision opening,
 * approach area, and crossing direction are all derived from this contract;
 * none of them are inferred from a label's text width.
 */
export type DoorPassageRegion = {
  doorway: DoorRegionBox
  detection: DoorRegionBox
  normal: DoorRegionNormal
  crossingTargets: readonly [Point, Point]
  targetDepth: number
}

export type DoorPassageSide = 0 | 1

export type DoorPassagePhase = 'closed' | 'opening' | 'open' | 'crossing' | 'holding' | 'closing'

export type DoorPassageReservation = {
  actorId: string
  fromSide: DoorPassageSide
  targetSide: DoorPassageSide
  target: Point
  crossed: boolean
}

export type DoorPassageRuntime = {
  phase: DoorPassagePhase
  reservations: Readonly<Record<string, DoorPassageReservation>>
  /** The lifecycle deadline after every visible actor clears the real doorway. */
  clearHoldUntil?: number
}

export type DoorPassageAction =
  | { type: 'request'; reservation: DoorPassageReservation; allowed: boolean }
  | { type: 'approach' }
  | { type: 'opened' }
  | { type: 'crossed'; actorId: string }
  | { type: 'release'; actorId: string }
  | { type: 'begin-hold'; until: number }
  | { type: 'begin-closing' }
  | { type: 'closed' }

export function createDoorPassageRuntime(phase: DoorPassagePhase = 'closed'): DoorPassageRuntime {
  return { phase, reservations: {} }
}

export function reduceDoorPassageRuntime(state: DoorPassageRuntime, action: DoorPassageAction): DoorPassageRuntime {
  if (action.type === 'request') {
    if (!action.allowed) return state
    const phase = state.phase === 'open' || state.phase === 'crossing'
      ? state.phase
      : state.phase === 'holding' || state.phase === 'closing' ? 'open' : 'opening'
    return {
      phase,
      reservations: { ...state.reservations, [action.reservation.actorId]: action.reservation },
      clearHoldUntil: undefined,
    }
  }

  if (action.type === 'approach') {
    if (state.phase === 'open' || state.phase === 'crossing') return state
    if (state.phase === 'holding' || state.phase === 'closing') return { ...state, phase: 'open', clearHoldUntil: undefined }
    return { ...state, phase: 'opening' }
  }

  if (action.type === 'opened') {
    if (state.phase !== 'opening') return state
    return { ...state, phase: 'open' }
  }

  if (action.type === 'crossed') {
    const reservation = state.reservations[action.actorId]
    if (!reservation) return { ...state, phase: 'crossing' }
    return {
      phase: 'crossing',
      reservations: {
        ...state.reservations,
        [action.actorId]: { ...reservation, crossed: true },
      },
    }
  }

  if (action.type === 'release') {
    const reservations = { ...state.reservations }
    delete reservations[action.actorId]
    return { ...state, reservations }
  }

  if (action.type === 'begin-hold') {
    if (state.phase !== 'open' && state.phase !== 'crossing') return state
    return { ...state, phase: 'holding', clearHoldUntil: action.until }
  }

  if (action.type === 'begin-closing') {
    if (state.phase !== 'open' && state.phase !== 'crossing' && state.phase !== 'holding') return state
    return { ...state, phase: 'closing', clearHoldUntil: undefined }
  }

  if (state.phase !== 'closing') return state
  return { phase: 'closed', reservations: {} }
}

export function doorPassageIsOpen(phase: DoorPassagePhase) {
  return phase === 'opening' || phase === 'open' || phase === 'crossing' || phase === 'holding'
}

/** A passage is physically traversable only after its visual opening completes. */
export function doorPassageIsPassable(phase: DoorPassagePhase) {
  return phase === 'open' || phase === 'crossing' || phase === 'holding'
}

export function containsDoorRegion(point: Point, box: DoorRegionBox) {
  return point.x >= box.x
    && point.x <= box.x + box.width
    && point.y >= box.y
    && point.y <= box.y + box.height
}

function normalDistanceFromDoorway(region: DoorPassageRegion, point: Point) {
  const center = {
    x: region.doorway.x + region.doorway.width / 2,
    y: region.doorway.y + region.doorway.height / 2,
  }
  const value = region.normal.axis === 'x' ? point.x - center.x : point.y - center.y
  return value * region.normal.direction
}

export function doorRegionSide(region: DoorPassageRegion, point: Point): DoorPassageSide {
  return normalDistanceFromDoorway(region, point) >= 0 ? 1 : 0
}

type SegmentBoxInterval = { entry: number; exit: number }

function segmentBoxInterval(start: Point, target: Point, box: DoorRegionBox): SegmentBoxInterval | null {
  let entry = 0
  let exit = 1
  const axes = [
    [start.x, target.x, box.x, box.x + box.width],
    [start.y, target.y, box.y, box.y + box.height],
  ] as const
  for (const [startValue, targetValue, minimum, maximum] of axes) {
    const delta = targetValue - startValue
    if (Math.abs(delta) <= 0.000001) {
      if (startValue < minimum || startValue > maximum) return null
      continue
    }
    const first = (minimum - startValue) / delta
    const second = (maximum - startValue) / delta
    entry = Math.max(entry, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
    if (entry > exit) return null
  }
  return { entry, exit }
}

function pointOnSegment(start: Point, target: Point, progress: number): Point {
  return {
    x: start.x + (target.x - start.x) * progress,
    y: start.y + (target.y - start.y) * progress,
  }
}

/** Resolve a clear approach point for every doorway orientation. */
export function doorwayBoundaryPoint(region: DoorPassageRegion, from: Point, target: Point, actorRadius: number, tangentPoint?: Point) {
  const expandedDoor = {
    x: region.doorway.x - actorRadius,
    y: region.doorway.y - actorRadius,
    width: region.doorway.width + actorRadius * 2,
    height: region.doorway.height + actorRadius * 2,
  }
  const length = Math.hypot(target.x - from.x, target.y - from.y)
  const interval = segmentBoxInterval(from, target, expandedDoor)
  if (interval && length > 0.001) return pointOnSegment(from, target, Math.max(0, interval.entry - .08 / length))

  const center = {
    x: region.doorway.x + region.doorway.width / 2,
    y: region.doorway.y + region.doorway.height / 2,
  }
  const side = doorRegionSide(region, from)
  const direction = region.normal.direction * (side === 1 ? 1 : -1)
  const tangent = tangentPoint ?? center
  if (region.normal.axis === 'x') {
    return {
      x: center.x + direction * (region.doorway.width / 2 + actorRadius + .08),
      y: tangent.y,
    }
  }
  return {
    x: tangent.x,
    y: center.y + direction * (region.doorway.height / 2 + actorRadius + .08),
  }
}

/**
 * True only when the requested target has crossed the canonical doorway.
 *
 * `crossingTargets` are movement reference points used after a door opens;
 * they deliberately sit farther into each side of the room. They must not be
 * used to decide whether a click has already gone through the rendered door,
 * otherwise a target immediately beyond a wall-mounted door is misread as a
 * normal local move. The compiled doorway is the shared visual, collision,
 * and navigation boundary, so its centre is the only valid side threshold.
 */
export function isDoorTargetBehind(region: DoorPassageRegion, from: Point, target: Point) {
  const fromDistance = normalDistanceFromDoorway(region, from)
  const targetDistance = normalDistanceFromDoorway(region, target)
  const centerlineEpsilon = .001
  const crossedCenterline = (
    fromDistance < -centerlineEpsilon && targetDistance > centerlineEpsilon
  ) || (
    fromDistance > centerlineEpsilon && targetDistance < -centerlineEpsilon
  )
  return crossedCenterline && Math.abs(targetDistance) >= region.targetDepth
}
