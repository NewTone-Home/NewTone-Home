'use client'

import { useEffect, useRef, useState } from 'react'
import type { MainlineAmbientNpcRoute } from './mainlineSceneModel'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { MainlineNavigationOptions } from './mainlineNavigation'
import type { NavigationActorFootprint, NavigationRuntime } from './navigationCore'
import type { NpcRuntimeSnapshot } from './npcCore'
import type { SceneLayout } from './sceneLayout'
import type { Point } from './sceneGeometry'
import type { MovementOptions } from './useFreeRoamMovement'
import { useNpcMovement } from './useNpcMovement'

type AmbientNpcMotionProps = {
  enabled: boolean
  schedule: MainlineAmbientNpcRoute
  initialPosition: Point
  scene: MainlineSceneDefinition
  layout: SceneLayout
  navigationRuntime: NavigationRuntime
  navigationOptions: MainlineNavigationOptions
  footprint: NavigationActorFootprint
  movementOptions: MovementOptions
  sceneClockMs: number
  onRuntimeChange: (npcId: string, position: Point | null, snapshot: NpcRuntimeSnapshot) => void
}

/** A shared scene-frame clock; route timing advances only while this scene is mounted. */
export function useAmbientNpcSceneClock(enabled: boolean) {
  const [sceneClockMs, setSceneClockMs] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setSceneClockMs(0)
      return
    }
    const startedAt = performance.now()
    let frame = 0
    const advance = (now: number) => {
      setSceneClockMs(now - startedAt)
      frame = window.requestAnimationFrame(advance)
    }
    frame = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frame)
  }, [enabled])
  return sceneClockMs
}

/**
 * A scene-local timing projection over the shared NPC movement adapter. It
 * only decides when an authored route step is requested; pathfinding,
 * occupancy, collision, and live positions remain owned by useNpcMovement.
 */
export function AmbientNpcMotion({
  enabled,
  schedule,
  initialPosition,
  scene,
  layout,
  navigationRuntime,
  navigationOptions,
  footprint,
  movementOptions,
  sceneClockMs,
  onRuntimeChange,
}: AmbientNpcMotionProps) {
  const movement = useNpcMovement({
    enabled,
    npcId: schedule.npcId,
    initialPosition,
    navigationRuntime,
    footprint,
  })
  const [routeIndex, setRouteIndex] = useState(0)
  const [readyAtMs, setReadyAtMs] = useState(schedule.initialDelayMs)
  const requestedRouteIndexRef = useRef<number | null>(null)
  const latestRef = useRef({ enabled, scene, layout, navigationOptions, movementOptions, requestMove: movement.requestMove, phase: movement.snapshot.phase, sceneClockMs })
  latestRef.current = { enabled, scene, layout, navigationOptions, movementOptions, requestMove: movement.requestMove, phase: movement.snapshot.phase, sceneClockMs }
  const resetKey = `${enabled}:${schedule.npcId}:${initialPosition.x}:${initialPosition.y}`

  useEffect(() => {
    setRouteIndex(0)
    setReadyAtMs(schedule.initialDelayMs)
    requestedRouteIndexRef.current = null
  }, [resetKey, schedule.initialDelayMs])

  useEffect(() => {
    onRuntimeChange(schedule.npcId, movement.position, movement.snapshot)
  }, [movement.position, movement.snapshot, onRuntimeChange, schedule.npcId])

  useEffect(() => {
    if (!enabled || movement.snapshot.phase === 'moving' || sceneClockMs < readyAtMs) return
    const step = schedule.steps[routeIndex]
    if (!step || requestedRouteIndexRef.current === routeIndex) return
    requestedRouteIndexRef.current = routeIndex
    const current = latestRef.current
    if (!current.enabled || current.phase === 'moving') return
    const advanceRoute = () => {
      requestedRouteIndexRef.current = null
      setRouteIndex((index) => (index + 1) % schedule.steps.length)
      setReadyAtMs(latestRef.current.sceneClockMs + step.dwellMs)
    }
    const started = current.requestMove({
      dutyId: 'pedestrian.walk',
      targetId: `${schedule.npcId}:route:${routeIndex}`,
      target: step.target,
    }, current.scene, current.layout, current.navigationOptions, current.movementOptions, advanceRoute)
    if (!started) advanceRoute()
  }, [enabled, movement.snapshot.phase, readyAtMs, routeIndex, sceneClockMs, schedule.npcId, schedule.steps])

  return null
}
