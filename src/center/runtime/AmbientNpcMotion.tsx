'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { MainlineAmbientNpcRoute, MainlineAmbientNpcRouteStep } from './mainlineSceneModel'
import { mainlineStorefrontInteractionCandidates, type MainlineSceneDefinition } from './mainlineScenes'
import { resolveMainlineInteractionCandidates, type MainlineNavigationOptions } from './mainlineNavigation'
import type { NavigationActorFootprint, NavigationRuntime } from './navigationCore'
import type { NpcRuntimeSnapshot } from './npcCore'
import type { SceneLayout } from './sceneLayout'
import type { Point } from './sceneGeometry'
import type { MovementOptions } from './useFreeRoamMovement'
import { useNpcMovement } from './useNpcMovement'
import { ambientNpcDwellDuration, ambientNpcReentryPoint, ambientNpcShouldYieldToProtagonist } from './ambientNpcLifecycle'

/** A blocked pedestrian gets one scene-clock recovery attempt before skipping its route step. */
export const ambientNpcBlockedRecoveryDelayMs = 350
export const ambientNpcBlockedRetryLimit = 1

type AmbientNpcBlockedRecoveryDecision = {
  kind: 'retry' | 'skip'
  clearRequested: true
  retryCount: number
  delayMs?: number
}

/**
 * Keep blocked recovery local to ambient route scheduling. Shared movement
 * remains responsible only for reporting that its live occupancy step failed.
 */
export function ambientNpcBlockedRecoveryDecision(
  previousPhase: NpcRuntimeSnapshot['phase'],
  nextPhase: NpcRuntimeSnapshot['phase'],
  retryCount: number,
): AmbientNpcBlockedRecoveryDecision | null {
  if (previousPhase !== 'moving' || nextPhase !== 'blocked') return null
  if (retryCount >= ambientNpcBlockedRetryLimit) {
    return { kind: 'skip', clearRequested: true, retryCount }
  }
  return {
    kind: 'retry',
    clearRequested: true,
    retryCount: retryCount + 1,
    delayMs: ambientNpcBlockedRecoveryDelayMs,
  }
}

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
  protagonistPosition: Point
  onRuntimeChange: (npcId: string, hidden: boolean, snapshot: NpcRuntimeSnapshot) => void
  renderActor?: (position: Point, snapshot: NpcRuntimeSnapshot) => ReactNode
}

/**
 * A nearby protagonist may make an ambient actor skip one authored step. The
 * scene clock is continuous, so callers keep the returned latch until the
 * actors separate instead of issuing that skip once per animation frame.
 */
export function ambientNpcYieldEncounterDecision(isNearby: boolean, hasYieldedForCurrentProximity: boolean) {
  if (!isNearby) return { shouldYield: false, resetLatch: true }
  return { shouldYield: !hasYieldedForCurrentProximity, resetLatch: false }
}

type HiddenAmbientActivity = {
  kind: 'storefront-visit' | 'offstreet'
  untilMs: number
  reentry: Point
}

function targetForAmbientStep(
  step: MainlineAmbientNpcRouteStep,
  scene: MainlineSceneDefinition,
  from: Point,
  layout: SceneLayout,
  navigationOptions: MainlineNavigationOptions,
) {
  if (step.kind !== 'storefront-visit') return step.target
  const storefront = scene.storefronts.find((candidate) => candidate.id === step.storefrontId)
  if (!storefront || storefront.portalId || storefront.label === '奶茶店' || storefront.label === '果茶店') return null
  return resolveMainlineInteractionCandidates(
    scene,
    from,
    mainlineStorefrontInteractionCandidates(scene, storefront),
    .35,
    layout,
    navigationOptions,
  ).target
}

/**
 * A scene-frame clock local to each ambient route projection. Keeping this
 * state below MainlineScenePage prevents clock ticks from feeding the Page's
 * NPC-runtime projection back into adapter revisions.
 */
export function useAmbientNpcSceneClock(enabled: boolean, wakeAtMs: number | null) {
  const startedAtRef = useRef<number | null>(null)
  const clockRef = useRef(0)
  const notifiedWakeRef = useRef<number | null>(null)
  const [, setWakeRevision] = useState(0)
  const readSceneClockMs = useCallback(() => clockRef.current, [])
  useEffect(() => {
    if (!enabled) {
      startedAtRef.current = null
      clockRef.current = 0
      notifiedWakeRef.current = null
      return
    }
    const startedAt = startedAtRef.current ?? performance.now()
    startedAtRef.current = startedAt
    let frame = 0
    const advance = (now: number) => {
      clockRef.current = now - startedAt
      if (wakeAtMs !== null && clockRef.current >= wakeAtMs && notifiedWakeRef.current !== wakeAtMs) {
        notifiedWakeRef.current = wakeAtMs
        setWakeRevision((revision) => revision + 1)
        return
      }
      frame = window.requestAnimationFrame(advance)
    }
    frame = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frame)
  }, [enabled, wakeAtMs])
  return { sceneClockMs: clockRef.current, readSceneClockMs }
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
  protagonistPosition,
  onRuntimeChange,
  renderActor,
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
  const [recovery, setRecovery] = useState<{ routeIndex: number; retryAtMs: number } | null>(null)
  const [hiddenActivity, setHiddenActivity] = useState<HiddenAmbientActivity | null>(null)
  const requestedRouteIndexRef = useRef<number | null>(null)
  const recoveryRef = useRef<{ routeIndex: number; retryAtMs: number } | null>(null)
  const retryCountRef = useRef(0)
  const previousPhaseRef = useRef(movement.snapshot.phase)
  const hiddenActivityRef = useRef<HiddenAmbientActivity | null>(null)
  const yieldedForCurrentProximityRef = useRef(false)
  const lastRuntimeReportRef = useRef<string | null>(null)
  const nextWakeAtMs = hiddenActivity?.untilMs
    ?? recovery?.retryAtMs
    ?? (movement.snapshot.phase === 'moving' ? null : readyAtMs)
  const { sceneClockMs, readSceneClockMs } = useAmbientNpcSceneClock(enabled, nextWakeAtMs)
  const latestRef = useRef({ enabled, scene, layout, navigationOptions, movementOptions, requestMove: movement.requestMove, phase: movement.snapshot.phase, sceneClockMs, readSceneClockMs })
  latestRef.current = { enabled, scene, layout, navigationOptions, movementOptions, requestMove: movement.requestMove, phase: movement.snapshot.phase, sceneClockMs, readSceneClockMs }
  const resetKey = `${enabled}:${schedule.npcId}:${initialPosition.x}:${initialPosition.y}`

  useEffect(() => {
    setRouteIndex(0)
    setReadyAtMs(schedule.initialDelayMs)
    requestedRouteIndexRef.current = null
    recoveryRef.current = null
    retryCountRef.current = 0
    previousPhaseRef.current = movement.snapshot.phase
    hiddenActivityRef.current = null
    yieldedForCurrentProximityRef.current = false
    lastRuntimeReportRef.current = null
    setRecovery(null)
    setHiddenActivity(null)
  }, [resetKey, schedule.initialDelayMs])

  useEffect(() => {
    const { phase, dutyId, targetId } = movement.snapshot
    const report = [
      hiddenActivity ? 'hidden' : 'visible',
      phase,
      dutyId ?? '',
      targetId ?? '',
    ].join(':')
    if (lastRuntimeReportRef.current === report) return
    lastRuntimeReportRef.current = report
    onRuntimeChange(schedule.npcId, Boolean(hiddenActivity), movement.snapshot)
  }, [hiddenActivity, movement.snapshot.dutyId, movement.snapshot.phase, movement.snapshot.targetId, onRuntimeChange, schedule.npcId])

  useEffect(() => {
    if (!enabled || !hiddenActivity || sceneClockMs < hiddenActivity.untilMs) return
    if (hiddenActivityRef.current !== hiddenActivity) return
    // Claim this lifecycle edge before resetting locomotion. reset() publishes
    // a movement snapshot synchronously; if the hidden activity still looked
    // current during that nested render, this effect could re-enter and reset
    // the same actor until React rejected the update depth.
    hiddenActivityRef.current = null
    movement.reset(ambientNpcReentryPoint(hiddenActivity.reentry))
    setHiddenActivity(null)
    requestedRouteIndexRef.current = null
    retryCountRef.current = 0
    setRouteIndex((index) => (index + 1) % schedule.steps.length)
    setReadyAtMs(readSceneClockMs())
  }, [enabled, hiddenActivity, movement, readSceneClockMs, sceneClockMs, schedule.steps.length])

  useEffect(() => {
    if (!enabled || hiddenActivity || movement.snapshot.phase === 'moving') return
    const protagonist = navigationRuntime.getActor('protagonist')
    const ambient = navigationRuntime.getActor(schedule.npcId)
    const yieldDecision = ambientNpcYieldEncounterDecision(
      ambientNpcShouldYieldToProtagonist(protagonist, ambient),
      yieldedForCurrentProximityRef.current,
    )
    if (yieldDecision.resetLatch) {
      yieldedForCurrentProximityRef.current = false
      return
    }
    // The shared scene clock updates every animation frame. Yielding is an
    // encounter edge, not a per-frame command: after an ambient actor has
    // skipped its current dwell/route step for this nearby protagonist, wait
    // until the two actors separate before it can yield again.
    if (!yieldDecision.shouldYield) return
    yieldedForCurrentProximityRef.current = true
    requestedRouteIndexRef.current = null
    recoveryRef.current = null
    retryCountRef.current = 0
    setRecovery(null)
    setRouteIndex((index) => (index + 1) % schedule.steps.length)
    setReadyAtMs(sceneClockMs)
  }, [enabled, hiddenActivity, movement.snapshot.phase, navigationRuntime, protagonistPosition.x, protagonistPosition.y, schedule.npcId, schedule.steps.length, sceneClockMs])

  useEffect(() => {
    const decision = ambientNpcBlockedRecoveryDecision(
      previousPhaseRef.current,
      movement.snapshot.phase,
      retryCountRef.current,
    )
    previousPhaseRef.current = movement.snapshot.phase
    if (!enabled || !decision || requestedRouteIndexRef.current !== routeIndex) return

    const step = schedule.steps[routeIndex]
    if (!step) return
    requestedRouteIndexRef.current = null
    if (decision.kind === 'skip') {
      retryCountRef.current = 0
      recoveryRef.current = null
      setRecovery(null)
      setRouteIndex((index) => (index + 1) % schedule.steps.length)
      setReadyAtMs(sceneClockMs + step.dwellMs)
      return
    }

    retryCountRef.current = decision.retryCount
    const nextRecovery = {
      routeIndex,
      retryAtMs: sceneClockMs + (decision.delayMs ?? 0),
    }
    recoveryRef.current = nextRecovery
    setRecovery(nextRecovery)
  }, [enabled, movement.snapshot.phase, routeIndex, sceneClockMs, schedule.steps])

  useEffect(() => {
    if (!recovery || sceneClockMs < recovery.retryAtMs) return
    if (recoveryRef.current?.routeIndex !== recovery.routeIndex) return
    recoveryRef.current = null
    setRecovery(null)
  }, [recovery, sceneClockMs])

  useEffect(() => {
    if (!enabled || hiddenActivity || movement.snapshot.phase === 'moving' || sceneClockMs < readyAtMs) return
    const step = schedule.steps[routeIndex]
    if (!step || requestedRouteIndexRef.current === routeIndex || recoveryRef.current?.routeIndex === routeIndex) return
    requestedRouteIndexRef.current = routeIndex
    const current = latestRef.current
    if (!current.enabled || current.phase === 'moving') return
    const advanceRoute = () => {
      requestedRouteIndexRef.current = null
      recoveryRef.current = null
      retryCountRef.current = 0
      setRecovery(null)
      setRouteIndex((index) => (index + 1) % schedule.steps.length)
      setReadyAtMs(latestRef.current.readSceneClockMs() + ('dwellMs' in step ? step.dwellMs : 0))
    }
    const target = targetForAmbientStep(step, current.scene, movement.getPosition(), current.layout, current.navigationOptions)
    if (!target) {
      advanceRoute()
      return
    }
    const started = current.requestMove({
      dutyId: 'pedestrian.walk',
      targetId: `${schedule.npcId}:route:${routeIndex}`,
      target,
    }, current.scene, current.layout, current.navigationOptions, current.movementOptions, () => {
      if (step.kind !== 'storefront-visit' && step.kind !== 'offstreet') {
        advanceRoute()
        return
      }
      const activity: HiddenAmbientActivity = {
        kind: step.kind,
        untilMs: latestRef.current.readSceneClockMs() + ambientNpcDwellDuration(step.minDwellMs, step.maxDwellMs),
        reentry: step.reentry,
      }
      navigationRuntime.removeActor(schedule.npcId)
      hiddenActivityRef.current = activity
      setHiddenActivity(activity)
    })
    if (!started) advanceRoute()
  }, [enabled, hiddenActivity, movement, movement.snapshot.phase, navigationRuntime, readyAtMs, routeIndex, sceneClockMs, schedule.npcId, schedule.steps])

  return hiddenActivity || !movement.position
    ? null
    : <>{renderActor?.(movement.position, movement.snapshot)}</>
}
