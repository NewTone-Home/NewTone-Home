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

export type DoorPassageActorFootprint = {
  width: number
  height: number
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
  /** FIFO ownership of a physically narrow doorway. Only the head may cross. */
  queue: readonly string[]
  activeActorId?: string
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
  return { phase, reservations: {}, queue: [] }
}

export function doorPassageActorIsActive(state: DoorPassageRuntime, actorId: string) {
  return state.activeActorId === actorId && Boolean(state.reservations[actorId])
}

function nextActiveActor(queue: readonly string[], reservations: Readonly<Record<string, DoorPassageReservation>>) {
  return queue.find((actorId) => Boolean(reservations[actorId]))
}

export function reduceDoorPassageRuntime(state: DoorPassageRuntime, action: DoorPassageAction): DoorPassageRuntime {
  if (action.type === 'request') {
    if (!action.allowed) return state
    const reservations = { ...state.reservations, [action.reservation.actorId]: action.reservation }
    const queue = state.queue.includes(action.reservation.actorId)
      ? state.queue
      : [...state.queue, action.reservation.actorId]
    const activeActorId = state.activeActorId && reservations[state.activeActorId]
      ? state.activeActorId
      : nextActiveActor(queue, reservations)
    const phase = state.phase === 'open' || state.phase === 'crossing'
      ? state.phase
      : state.phase === 'holding' || state.phase === 'closing' ? 'open' : 'opening'
    return {
      phase,
      reservations,
      queue,
      activeActorId,
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
    if (state.activeActorId && state.activeActorId !== action.actorId) return state
    if (!reservation) return { ...state, phase: 'crossing' }
    return {
      ...state,
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
    const queue = state.queue.filter((actorId) => actorId !== action.actorId)
    const activeActorId = state.activeActorId === action.actorId
      ? nextActiveActor(queue, reservations)
      : state.activeActorId
    return { ...state, reservations, queue, activeActorId }
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
  return { phase: 'closed', reservations: {}, queue: [] }
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

/** Keep the actor's incoming tangent inside the real usable doorway span. */
export function doorwayLegalTangent(doorway: DoorRegionBox, axis: 'x' | 'y', footprint: DoorPassageActorFootprint, incoming: Point) {
  const origin = axis === 'x' ? doorway.y : doorway.x
  const span = axis === 'x' ? doorway.height : doorway.width
  const half = axis === 'x' ? footprint.height / 2 : footprint.width / 2
  const min = origin + half + .02
  const max = origin + span - half - .02
  return min > max ? origin + span / 2 : Math.max(min, Math.min(max, axis === 'x' ? incoming.y : incoming.x))
}

/** Resolve a clear approach point for every doorway orientation. */
export function doorwayBoundaryPoint(region: DoorPassageRegion, from: Point, _target: Point, actorFootprint: DoorPassageActorFootprint, tangentPoint?: Point) {
  const horizontalNormal = region.normal.axis === 'x'
  const normalClearance = horizontalNormal ? actorFootprint.width / 2 : actorFootprint.height / 2
  const center = { x: region.doorway.x + region.doorway.width / 2, y: region.doorway.y + region.doorway.height / 2 }
  const side = doorRegionSide(region, from)
  const direction = region.normal.direction * (side === 1 ? 1 : -1)
  const tangent = doorwayLegalTangent(region.doorway, region.normal.axis, actorFootprint, tangentPoint ?? from)
  return horizontalNormal
    ? { x: center.x + direction * (region.doorway.width / 2 + normalClearance + .08), y: tangent }
    : { x: tangent, y: center.y + direction * (region.doorway.height / 2 + normalClearance + .08) }
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
