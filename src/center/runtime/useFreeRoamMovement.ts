'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point } from './sceneGeometry'
import { canTravelAlongSegment } from './navigationCore'

// One shared cruise speed keeps desktop, tablet, and phone movement consistent.
// The value is expressed in stage-percent per millisecond.
const defaultFreeRoamSpeed = .018
const defaultFreeRoamScreenSpeed = 240

export type MovementOptions = {
  /** Called once when a non-empty movement actually starts. */
  onStart?: () => void
  /** Called after each locomotion tick with the actor's real position. */
  onMove?: (position: Point) => void
  canOccupy?: (point: Point) => boolean
  /** Predicate for the first segment only, used to leave the actor's own seat group. */
  initialCanOccupy?: (point: Point) => boolean
  /** Predicate for the final waypoint only, used to enter a resolved chair anchor. */
  finalCanOccupy?: (point: Point) => boolean
  onBlocked?: (point: Point) => void
  /** Stage-percent distance travelled per millisecond at cruise. */
  maxSpeed?: number
  /** Optional screen-space cruise speed used to keep the visual pace stable across viewports. */
  screenSpeedPxPerSecond?: number
  /** The measured stage size used to convert screen-space speed back to scene coordinates. */
  screenMetrics?: { width: number; height: number }
  /** Kept in the public contract for scene movement profiles. */
  acceleration?: number
  /** Kept in the public contract for scene movement profiles. */
  deceleration?: number
  /** Kept for compatibility; MOBA movement does not rotate through old heading inertia. */
  turnSmoothing?: number
}

export type MovementComplete = (position: Point) => void

export type FreeRoamSnapshot = {
  position: Point
  moving: boolean
  destination: Point | null
}

export type FreeRoamMovement = {
  position: Point
  moving: boolean
  destination: Point | null
  moveAlong: (path: Point[], onArrive?: MovementComplete, options?: MovementOptions) => void
  stopMovement: () => void
  resetMovement: (point?: Point) => void
  getCurrentPosition: () => Point
  getRemainingDurationMs: () => number
}

type MovementSession = {
  waypoints: Point[]
  waypointIndex: number
  lastFrameAt: number
  options: MovementOptions
  onArrive?: MovementComplete
  preserveInitialExit: boolean
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y }
}

function compressPath(path: Point[], preserveFinalApproach = false, preserveInitialExit = false): Point[] {
  if (preserveInitialExit && path.length >= 3) {
    const initialSegment = path.slice(0, 2)
    const remainder = compressPath(path.slice(1), preserveFinalApproach)
    return [...initialSegment, ...remainder.slice(1)]
  }
  if (preserveFinalApproach && path.length >= 3) {
    const finalPoint = path[path.length - 1]
    return [...compressPath(path.slice(0, -1)), finalPoint]
  }
  if (path.length < 3) return path

  const compressed = [path[0]]
  let previousDirection = {
    x: Math.sign(path[1].x - path[0].x),
    y: Math.sign(path[1].y - path[0].y),
  }

  for (let index = 2; index < path.length; index += 1) {
    const direction = {
      x: Math.sign(path[index].x - path[index - 1].x),
      y: Math.sign(path[index].y - path[index - 1].y),
    }
    if (direction.x !== previousDirection.x || direction.y !== previousDirection.y) {
      compressed.push(path[index - 1])
      previousDirection = direction
    }
  }

  compressed.push(path[path.length - 1])
  return compressed
}

function smoothPath(path: Point[], canOccupy?: (point: Point) => boolean, preserveInitialExit = false) {
  if (!canOccupy || path.length < 3) return path

  const smoothed = preserveInitialExit ? [path[0], path[1]] : [path[0]]
  let anchorIndex = preserveInitialExit ? 1 : 0
  while (anchorIndex < path.length - 1) {
    let nextIndex = anchorIndex + 1
    for (let candidateIndex = path.length - 1; candidateIndex > anchorIndex + 1; candidateIndex -= 1) {
      if (canTravelAlongSegment(path[anchorIndex], path[candidateIndex], canOccupy)) {
        nextIndex = candidateIndex
        break
      }
    }
    smoothed.push(path[nextIndex])
    anchorIndex = nextIndex
  }
  return smoothed
}

/**
 * Converts a grid route into the sparse waypoint route consumed by locomotion.
 * This is deliberately pure so the player and fixed scene actors use the same
 * route preparation.
 */
export function prepareMovementPath(path: Point[], start: Point, options: MovementOptions = {}) {
  const preserveInitialExit = Boolean(options.initialCanOccupy)
  const compressed = compressPath(path, Boolean(options.finalCanOccupy), preserveInitialExit)
  return {
    waypoints: smoothPath(compressed, options.canOccupy, preserveInitialExit)
      .filter((point) => point.x !== start.x || point.y !== start.y),
    preserveInitialExit,
  }
}

function clockNow() {
  return typeof performance === 'undefined' ? 0 : performance.now()
}

function movementDelta(now: number, previous: number) {
  if (previous <= 0) return 16
  return Math.min(40, Math.max(1, now - previous))
}

function screenSpaceMovement(dx: number, dy: number, delta: number, options: MovementOptions) {
  const width = options.screenMetrics?.width
  const height = options.screenMetrics?.height
  const pixelsPerSecond = options.screenSpeedPxPerSecond ?? defaultFreeRoamScreenSpeed
  if (!(width && width > 0) || !(height && height > 0) || !(pixelsPerSecond > 0)) return null

  const projectedDx = dx * width / 100
  const projectedDy = dy * height / 100
  const projectedDistance = Math.hypot(projectedDx, projectedDy)
  if (projectedDistance <= .000001) return { x: dx, y: dy }

  const travelPixels = pixelsPerSecond * delta / 1000
  if (projectedDistance <= travelPixels) return { x: dx, y: dy }
  const ratio = travelPixels / projectedDistance
  return { x: dx * ratio, y: dy * ratio }
}

function screenSpaceDistance(first: Point, second: Point, options: MovementOptions) {
  const width = options.screenMetrics?.width
  const height = options.screenMetrics?.height
  if (!(width && width > 0) || !(height && height > 0)) return null
  return Math.hypot((second.x - first.x) * width / 100, (second.y - first.y) * height / 100)
}

export type FreeRoamController = {
  moveAlong: (path: Point[], onArrive?: MovementComplete, options?: MovementOptions) => void
  stopMovement: () => void
  resetMovement: (position?: Point) => void
  getCurrentPosition: () => Point
  getRemainingDurationMs: () => number
  getSnapshot: () => FreeRoamSnapshot
  isMoving: () => boolean
  tick: (now: number) => boolean
}

/**
 * Stateful but renderer-independent click-to-move controller.
 *
 * The controller owns the locomotion session and advances one waypoint at a
 * time at a constant cruise speed. There is no heading inertia: a redirect
 * changes the next travel vector immediately, which is the useful MOBA model
 * for a crowded top-down room.
 */
export function createFreeRoamController(initialPosition: Point): FreeRoamController {
  let position = copyPoint(initialPosition)
  let session: MovementSession | null = null

  const stopMovement = () => {
    session = null
  }

  const resetMovement = (nextPosition?: Point) => {
    session = null
    position = copyPoint(nextPosition ?? initialPosition)
  }

  const moveAlong = (path: Point[], onArrive?: MovementComplete, options: MovementOptions = {}) => {
    const prepared = prepareMovementPath(path, position, options)
    if (prepared.waypoints.length === 0) {
      session = null
      onArrive?.(copyPoint(position))
      return
    }

    // Redirects retain the current locomotion phase. The next tick reads the
    // new route, so a click or replan does not restart the unit from zero.
    const wasMoving = session !== null
    session = {
      waypoints: prepared.waypoints,
      waypointIndex: 0,
      lastFrameAt: clockNow(),
      options,
      onArrive,
      preserveInitialExit: prepared.preserveInitialExit,
    }
    if (!wasMoving) options.onStart?.()
  }

  const getCurrentPosition = () => copyPoint(position)

  const getSnapshot = (): FreeRoamSnapshot => ({
    position: copyPoint(position),
    moving: session !== null,
    destination: session ? copyPoint(session.waypoints[session.waypoints.length - 1]) : null,
  })

  const getRemainingDurationMs = () => {
    if (!session) return Number.POSITIVE_INFINITY
    let stageDistance = 0
    let screenDistance = 0
    let previous = position
    for (let index = session.waypointIndex; index < session.waypoints.length; index += 1) {
      const waypoint = session.waypoints[index]
      stageDistance += Math.hypot(waypoint.x - previous.x, waypoint.y - previous.y)
      screenDistance += screenSpaceDistance(previous, waypoint, session.options) ?? 0
      previous = waypoint
    }
    const screenSpeed = session.options.screenSpeedPxPerSecond
    if (screenSpeed && screenSpeed > 0 && screenDistance > 0) return screenDistance / screenSpeed * 1000
    const stageSpeed = session.options.maxSpeed ?? defaultFreeRoamSpeed
    return stageSpeed > 0 && stageDistance > 0 ? stageDistance / stageSpeed * 1000 : Number.POSITIVE_INFINITY
  }

  const tick = (now: number) => {
    const activeSession = session
    if (!activeSession) return false

    const delta = movementDelta(now, activeSession.lastFrameAt)
    activeSession.lastFrameAt = now
    const arrivalRadius = .22
    let current = position

    while (activeSession.waypointIndex < activeSession.waypoints.length) {
      const waypoint = activeSession.waypoints[activeSession.waypointIndex]
      if (Math.hypot(waypoint.x - current.x, waypoint.y - current.y) > arrivalRadius) break
      current = waypoint
      activeSession.waypointIndex += 1
    }

    if (activeSession.waypointIndex >= activeSession.waypoints.length) {
      position = copyPoint(current)
      session = null
      activeSession.onArrive?.(copyPoint(position))
      return true
    }

    const target = activeSession.waypoints[activeSession.waypointIndex]
    const dx = target.x - current.x
    const dy = target.y - current.y
    const distance = Math.hypot(dx, dy)
    const maxSpeed = activeSession.options.maxSpeed ?? defaultFreeRoamSpeed
    const movement = activeSession.options.maxSpeed === undefined
      ? screenSpaceMovement(dx, dy, delta, activeSession.options)
        ?? (distance <= maxSpeed * delta
          ? { x: dx, y: dy }
          : { x: (dx / distance) * maxSpeed * delta, y: (dy / distance) * maxSpeed * delta })
      : distance <= maxSpeed * delta
        ? { x: dx, y: dy }
        : { x: (dx / distance) * maxSpeed * delta, y: (dy / distance) * maxSpeed * delta }
    const substeps = Math.max(1, Math.ceil(Math.hypot(movement.x, movement.y) / .18))
    const occupancy = activeSession.waypointIndex === 0 && activeSession.preserveInitialExit
      ? activeSession.options.initialCanOccupy
      : activeSession.waypointIndex === activeSession.waypoints.length - 1
        ? activeSession.options.finalCanOccupy ?? activeSession.options.canOccupy
        : activeSession.options.canOccupy

    let blocked = false
    for (let index = 0; index < substeps; index += 1) {
      const step = { x: movement.x / substeps, y: movement.y / substeps }
      const candidate = { x: current.x + step.x, y: current.y + step.y }
      if (!occupancy || canTravelAlongSegment(current, candidate, occupancy, .18)) {
        current = candidate
        continue
      }

      // Preserve the old collision contract's useful slide behavior without
      // inventing a second steering system. This only resolves a narrow
      // contact frame; the route remains the source of truth.
      const slideX = { x: current.x + step.x, y: current.y }
      const slideY = { x: current.x, y: current.y + step.y }
      const canSlideX = Math.abs(step.x) > .000001 && canTravelAlongSegment(current, slideX, occupancy, .18)
      const canSlideY = Math.abs(step.y) > .000001 && canTravelAlongSegment(current, slideY, occupancy, .18)
      if (canSlideX) current = slideX
      else if (canSlideY) current = slideY
      else {
        blocked = true
        break
      }
    }

    position = copyPoint(current)
    activeSession.options.onMove?.(copyPoint(position))
    if (blocked) {
      session = null
      activeSession.options.onBlocked?.(copyPoint(position))
    }
    return true
  }

  return {
    moveAlong,
    stopMovement,
    resetMovement,
    getCurrentPosition,
    getRemainingDurationMs,
    getSnapshot,
    isMoving: () => session !== null,
    tick,
  }
}

export function useFreeRoamMovement(initialPosition: Point) {
  const [controller] = useState(() => createFreeRoamController(initialPosition))
  const [snapshot, setSnapshot] = useState<FreeRoamSnapshot>(() => controller.getSnapshot())
  const frameRef = useRef<number | null>(null)
  const scheduleRef = useRef<(() => void) | null>(null)

  const schedule = useCallback(() => {
    if (frameRef.current !== null || !controller.isMoving()) return
    frameRef.current = window.requestAnimationFrame((now) => {
      frameRef.current = null
      if (controller.tick(now)) setSnapshot(controller.getSnapshot())
      scheduleRef.current?.()
    })
  }, [controller])

  useEffect(() => {
    scheduleRef.current = schedule
    return () => { scheduleRef.current = null }
  }, [schedule])

  const moveAlong = useCallback((path: Point[], onArrive?: MovementComplete, options?: MovementOptions) => {
    controller.moveAlong(path, onArrive, options)
    setSnapshot(controller.getSnapshot())
    schedule()
  }, [controller, schedule])

  const stopMovement = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    controller.stopMovement()
    setSnapshot(controller.getSnapshot())
  }, [controller])

  const resetMovement = useCallback((nextPosition?: Point) => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    controller.resetMovement(nextPosition)
    setSnapshot(controller.getSnapshot())
  }, [controller])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    controller.stopMovement()
  }, [controller])

  return {
    position: snapshot.position,
    moving: snapshot.moving,
    destination: snapshot.destination,
    moveAlong,
    stopMovement,
    resetMovement,
    getCurrentPosition: controller.getCurrentPosition,
    getRemainingDurationMs: controller.getRemainingDurationMs,
  }
}
