import { useCallback, useEffect, useRef, useState } from 'react'
import { MainlineScenePage } from './runtime/MainlineScenePage'
import { LongDistanceTravel } from './runtime/LongDistanceTravel'
import { WorldPhone } from './runtime/WorldPhone'
import {
  mainlineRespawnSceneId,
  mainlineSceneRoute,
  mainlineScenes,
  resolveMainlineSceneId,
} from './runtime/mainlineScenes'
import { mainlineCameraOffset } from './runtime/mainlineViewport'
import { isLocalSlidePrototypeIntent, localSlidePrototypeDurationMs } from './runtime/mainlineSceneTransition'
import { mainlineLongDistanceTravelIntentForRide } from './runtime/longDistanceTravelContract'
import {
  phoneRideAvailability,
  worldLayerForScene,
} from './runtime/phoneState'
import {
  loadPlayerSave,
  recordPlayerScenePosition,
  recordPlayerSceneState,
  recordPlayerSceneStatePatch,
  savePlayerSave as persistPlayerSave,
} from './runtime/playerSave'
import {
  interactionTutorialCompletedStateKey,
  isInteractionTutorialCompleted,
  isTutorialCompletionTransition,
} from './runtime/mainlineInteractionVisualState'
import './runtime/scene.css'
import './CenterExperience.css'
import { useReducedMotion } from '../hooks/useReducedMotion'
import {
  checkpointSessionActivityIfDue,
  markSessionActivity,
  setAnalyticsCurrentScene,
  setAnalyticsPhoneOpen,
  setCenterMovementActive,
  setCenterReadingActive,
  trackEvent,
} from '../services/analytics'
import { createCenterPositionSampler } from '../services/centerPositionSampler'
import { submitCenterFeedback } from '../services/centerFeedback'
import {
  commercialStreetMilkTeaAppUnlocked,
  commercialStreetMilkTeaHeld,
  commercialStreetMilkTeaIsReady,
  commercialStreetMilkTeaOrderFromSceneState,
  commercialStreetMilkTeaOrderPatch,
  commercialStreetMilkTeaReadyAnalyticsPatch,
  commercialStreetMilkTeaReadyAnalyticsWasReported,
  createCommercialStreetMilkTeaOrder,
} from './runtime/commercialStreetMilkTea'

const initialSceneId = mainlineRespawnSceneId
function createRoute(sceneId, entryPosition, spawnMode = 'resume') {
  return { sceneId, entryPosition, spawnMode }
}

function screenPositionForScene(sceneId, position) {
  const cameraOffset = mainlineCameraOffset(mainlineScenes[sceneId], position)
  return {
    x: position.x + cameraOffset.x,
    y: position.y + cameraOffset.y,
  }
}

export default function CenterExperience({
  entryPhase = 'active',
  onSceneReady,
  onRevealComplete,
}) {
  const reducedMotion = useReducedMotion()
  const [playerSave, setPlayerSave] = useState(() => loadPlayerSave())
  const [route, setRoute] = useState(() => createRoute(resolveMainlineSceneId() ?? loadPlayerSave().currentSceneId ?? initialSceneId))
  const [phoneOpen, setPhoneOpen] = useState(false)
  const sceneReadingActiveRef = useRef(false)
  const positionSamplerRef = useRef(null)
  const currentSceneIdRef = useRef(route.sceneId)
  const latestWorldPositionRef = useRef(null)
  const pendingInteractionRequestsRef = useRef(new Map())
  currentSceneIdRef.current = route.sceneId
  if (!positionSamplerRef.current) {
    positionSamplerRef.current = createCenterPositionSampler({
      onSample: ({ sceneId, positionX, positionY }) => trackEvent('center_position_sample', {
        sceneId,
        positionX,
        positionY,
      }, { deferred: true }).then(() => checkpointSessionActivityIfDue()),
    })
  }
  const [phoneDevice, setPhoneDevice] = useState(() => loadPlayerSave().phoneDevice)
  const [requestedPhoneApp, setRequestedPhoneApp] = useState(null)
  const [resumeSceneId, setResumeSceneId] = useState(null)
  const [resumePosition, setResumePosition] = useState(undefined)
  const [localSlideHandoffRoute, setLocalSlideHandoffRoute] = useState(null)
  const [boundaryNotice, setBoundaryNotice] = useState('')
  const [feedbackMode, setFeedbackMode] = useState(null)
  const [localSlide, setLocalSlide] = useState(null)
  const [longDistanceTravel, setLongDistanceTravel] = useState(null)
  const sceneEnteredAtRef = useRef(null)
  const milkTeaReadyAnalyticsMarkerRef = useRef(null)
  const commercialStreetState = playerSave.sceneState['commercial-street'] ?? {}
  const milkTeaOrder = commercialStreetMilkTeaOrderFromSceneState(commercialStreetState)


  const commitPlayerSave = useCallback((update) => {
    setPlayerSave((current) => persistPlayerSave(update(current)))
  }, [])

  const handleSceneAnimationEnd = useCallback((event) => {
    if (event.animationName === 'center-world-scene-in') onRevealComplete?.()
  }, [onRevealComplete])

  useEffect(() => {
    if (!reducedMotion || entryPhase !== 'revealing') return
    onRevealComplete?.()
  }, [entryPhase, onRevealComplete, reducedMotion])

  const revealPhone = useCallback(() => {
    if (sceneReadingActiveRef.current) return
    setPhoneOpen(true)
  }, [])
  const retractPhone = useCallback(() => {
    setPhoneOpen(false)
    setFeedbackMode(null)
    setRequestedPhoneApp(null)
  }, [])

  const trackChapterEvent = useCallback((eventName, eventData = {}) => {
    trackEvent(eventName, { sceneId: route.sceneId, eventData })
  }, [route.sceneId])

  useEffect(() => {
    setAnalyticsCurrentScene(route.sceneId)
  }, [route.sceneId])

  const previousPhoneOpenRef = useRef(false)
  useEffect(() => {
    if (previousPhoneOpenRef.current === phoneOpen) return
    previousPhoneOpenRef.current = phoneOpen
    setAnalyticsPhoneOpen(phoneOpen, phoneDevice)
  }, [phoneDevice, phoneOpen])

  const openMilkTeaApp = useCallback(() => {
    setRequestedPhoneApp('milk-tea')
    setPhoneOpen(true)
  }, [])

  const confirmMilkTeaOrder = useCallback((selection) => {
    if (commercialStreetMilkTeaHeld(commercialStreetState) || milkTeaOrder) return
    const order = createCommercialStreetMilkTeaOrder(commercialStreetState, selection)
    commitPlayerSave((current) => recordPlayerSceneStatePatch(current, 'commercial-street', commercialStreetMilkTeaOrderPatch(order)))
    trackEvent('milk_tea_order_confirmed', {
      sceneId: route.sceneId,
      eventData: {
        drink: order.drink,
        sugar: order.sugar,
        ice: order.ice,
        orderNumber: order.number,
        queueAheadAtOrder: order.queueAhead,
      },
    })
  }, [commercialStreetState, commitPlayerSave, milkTeaOrder, route.sceneId])

  const handleMilkTeaOrderStarted = useCallback(() => {
    trackEvent('milk_tea_order_started', { sceneId: route.sceneId })
  }, [route.sceneId])

  const handleMilkTeaOrderReady = useCallback((order = milkTeaOrder) => {
    if (!order || !commercialStreetMilkTeaIsReady(order)) return false
    const marker = `${order.number}:${order.readyAt}`
    if (milkTeaReadyAnalyticsMarkerRef.current === marker
      || commercialStreetMilkTeaReadyAnalyticsWasReported(commercialStreetState, order)) return false
    milkTeaReadyAnalyticsMarkerRef.current = marker
    commitPlayerSave((current) => recordPlayerSceneStatePatch(
      current,
      'commercial-street',
      commercialStreetMilkTeaReadyAnalyticsPatch(order),
    ))
    trackEvent('milk_tea_order_ready', { sceneId: route.sceneId, eventData: { orderNumber: order.number } })
    return true
  }, [commercialStreetState, commitPlayerSave, milkTeaOrder, route.sceneId])

  useEffect(() => {
    if (!milkTeaOrder) {
      milkTeaReadyAnalyticsMarkerRef.current = null
      return
    }
    if (commercialStreetMilkTeaReadyAnalyticsWasReported(commercialStreetState, milkTeaOrder)) {
      milkTeaReadyAnalyticsMarkerRef.current = `${milkTeaOrder.number}:${milkTeaOrder.readyAt}`
      return
    }
    handleMilkTeaOrderReady(milkTeaOrder)
  }, [commercialStreetState, handleMilkTeaOrderReady, milkTeaOrder, route.sceneId])

  const handleFeedbackModeChange = useCallback((mode) => {
    setFeedbackMode(mode)
  }, [])

  const handleFeedbackOpen = useCallback(() => {
    trackEvent('center_feedback_opened', {
      sceneId: route.sceneId,
      device: phoneDevice,
      outcome: 'opened',
    })
    setFeedbackMode('phone')
  }, [phoneDevice, route.sceneId])

  const handleFeedbackSubmit = useCallback((payload) => submitCenterFeedback(payload), [])

  useEffect(() => {
    if (sceneEnteredAtRef.current?.sceneId === route.sceneId) return
    const enteredAt = Date.now()
    sceneEnteredAtRef.current = { sceneId: route.sceneId, enteredAt }
    trackEvent('center_scene_entered', {
      sceneId: route.sceneId,
      device: phoneDevice,
    })
    if (route.sceneId === 'commercial-street') {
      trackEvent('commercial_street_entered', { sceneId: route.sceneId })
    }
  }, [phoneDevice, route.sceneId])
  const handleSceneReadingStateChange = useCallback((reading) => {
    sceneReadingActiveRef.current = reading
    setCenterReadingActive(reading)
  }, [])

  const handleMeaningfulActivity = useCallback(() => {
    markSessionActivity()
  }, [])

  useEffect(() => {
    setBoundaryNotice('')
    setResumeSceneId(null)
    setResumePosition(undefined)
    if (route.spawnMode === 'ride' || route.entryPosition) return
    setResumePosition(loadPlayerSave(undefined, route.sceneId).scenePositions[route.sceneId])
    setResumeSceneId(route.sceneId)
  }, [route.sceneId, route.entryPosition?.x, route.entryPosition?.y, route.spawnMode])

  const switchCarriedPhone = useCallback((device) => {
    setPhoneDevice(device)
    commitPlayerSave((current) => ({ ...current, phoneDevice: device }))
    setPhoneOpen(true)
  }, [commitPlayerSave])

  const recordSceneState = useCallback((sceneId, key, value) => {
    commitPlayerSave((current) => recordPlayerSceneState(current, sceneId, key, value))
  }, [commitPlayerSave])

  const recordSceneStatePatch = useCallback((sceneId, patch) => {
    commitPlayerSave((current) => recordPlayerSceneStatePatch(current, sceneId, patch))
  }, [commitPlayerSave])

  const handleSceneTransition = useCallback((nextSceneId, nextEntryPosition, nextSpawnMode, transitionIntent) => {
    const lastPosition = latestWorldPositionRef.current
    if (lastPosition?.sceneId === route.sceneId) {
      positionSamplerRef.current?.sample(route.sceneId, lastPosition.position, { boundary: true })
    }
    const nextRoute = createRoute(nextSceneId, nextEntryPosition, nextSpawnMode || 'resume')
    const startsLocalSlide = isLocalSlidePrototypeIntent(transitionIntent) && !reducedMotion
    if (startsLocalSlide) {
      setLocalSlide({
        sourceRoute: route,
        sourceResumePosition: resumePosition,
        targetRoute: nextRoute,
        transitionIntent,
      })
    }
    setLocalSlideHandoffRoute(startsLocalSlide ? nextRoute : null)
    const currentScene = sceneEnteredAtRef.current
    trackEvent('center_scene_exited', {
      sceneId: route.sceneId,
      destinationSceneId: nextSceneId,
      dwellMs: currentScene?.sceneId === route.sceneId ? Date.now() - currentScene.enteredAt : undefined,
      outcome: 'scene_change',
    })
    if (route.sceneId === 'commercial-street' && nextSceneId === 'commercial-cafe') {
      trackEvent('cafe_entered', { sceneId: nextSceneId })
    }
    sceneEnteredAtRef.current = null
    commitPlayerSave((current) => {
      const next = {
        ...current,
        currentSceneId: nextSceneId,
        currentPosition: nextEntryPosition
          ?? (nextRoute.spawnMode === 'ride' ? mainlineScenes[nextSceneId].rideArrivalPosition : current.scenePositions[nextSceneId])
          ?? null,
      }
      return isTutorialCompletionTransition(route.sceneId, nextSceneId, nextRoute.spawnMode)
        ? recordPlayerSceneState(next, 'commercial-street', interactionTutorialCompletedStateKey, true)
        : next
    })
    window.history.pushState(
      { newtoneCenterScene: nextSceneId },
      '',
      mainlineSceneRoute(nextSceneId, nextEntryPosition, nextRoute.spawnMode),
    )
    setRoute(nextRoute)
  }, [commitPlayerSave, reducedMotion, resumePosition, route])

  const handleLocalSlideTargetAnimationEnd = useCallback((event) => {
    if (event.target !== event.currentTarget) return
    if (
      event.animationName !== 'center-local-slide-target-left'
      && event.animationName !== 'center-local-slide-target-right'
      && event.animationName !== 'center-local-slide-target-up'
      && event.animationName !== 'center-local-slide-target-down'
    ) return
    setLocalSlide(null)
  }, [])

  const handlePhoneCloseComplete = useCallback(() => {
    setLongDistanceTravel((current) => (
      current?.phase === 'phone-retracting'
        ? { ...current, phase: 'scene-fading' }
        : current
    ))
  }, [])

  const handleLongDistanceSourceAnimationEnd = useCallback((event) => {
    if (event.target !== event.currentTarget || event.animationName !== 'center-long-distance-source-out') return
    if (longDistanceTravel?.phase !== 'scene-fading') return
    handleSceneTransition(longDistanceTravel.intent.targetSceneId, undefined, 'ride')
    setLongDistanceTravel((current) => (
      current?.phase === 'scene-fading'
        ? { ...current, phase: 'travelling', targetReady: false }
        : current
    ))
  }, [handleSceneTransition, longDistanceTravel])

  const handleLongDistanceTravelComplete = useCallback(() => {
    setLongDistanceTravel((current) => {
      if (!current || current.phase !== 'travelling') return current
      return current.targetReady
        ? { ...current, phase: 'scene-entering' }
        : { ...current, phase: 'awaiting-target' }
    })
  }, [])

  const handleSceneReady = useCallback(() => {
    onSceneReady?.()
    setLongDistanceTravel((current) => {
      if (!current || current.phase === 'phone-retracting' || current.phase === 'scene-fading') return current
      if (current.phase === 'awaiting-target') return { ...current, phase: 'scene-entering', targetReady: true }
      if (current.phase === 'travelling') return { ...current, targetReady: true }
      return current
    })
  }, [onSceneReady])

  const handleLongDistanceTargetAnimationEnd = useCallback((event) => {
    if (event.target !== event.currentTarget || event.animationName !== 'center-long-distance-target-in') return
    setLongDistanceTravel((current) => current?.phase === 'scene-entering' ? null : current)
  }, [])

  const handleSafeSpawnCorrection = useCallback((position) => {
    if (!route.entryPosition && route.spawnMode !== 'ride') return
    commitPlayerSave((current) => recordPlayerScenePosition(current, route.sceneId, position))
    const nextRoute = createRoute(route.sceneId, position, route.spawnMode)
    window.history.replaceState(
      { newtoneCenterScene: route.sceneId },
      '',
      mainlineSceneRoute(route.sceneId, position, route.spawnMode),
    )
    setRoute(nextRoute)
  }, [commitPlayerSave, route.entryPosition, route.sceneId, route.spawnMode])

  const handleObjectInteraction = useCallback((entity, dwellMs) => {
    trackEvent('center_object_interacted', {
      sceneId: route.sceneId,
      objectId: entity.id,
      objectKind: entity.kind,
      dwellMs,
      outcome: 'revealed',
    })
  }, [route.sceneId])

  const handleDoorEvent = useCallback((phase, passage) => {
    if (phase === 'attempted') handleMeaningfulActivity()
    const eventName = phase === 'attempted'
      ? 'center_door_attempted'
      : phase === 'blocked'
        ? 'center_door_blocked'
        : 'center_door_crossed'
    trackEvent(eventName, {
      sceneId: route.sceneId,
      objectId: passage.entityId,
      objectKind: 'door',
      destinationSceneId: passage.targetSceneId,
      outcome: phase,
    })
    const interactionKey = `${route.sceneId}/${passage.entityId}/door`
    const pending = pendingInteractionRequestsRef.current.get(interactionKey) ?? 0
    if ((phase === 'crossed' || phase === 'blocked') && pending > 0) {
      trackEvent(phase === 'crossed' ? 'center_interaction_completed' : 'center_interaction_blocked', {
        sceneId: route.sceneId,
        objectId: passage.entityId,
        objectKind: 'door',
        outcome: phase,
      })
      if (pending === 1) pendingInteractionRequestsRef.current.delete(interactionKey)
      else pendingInteractionRequestsRef.current.set(interactionKey, pending - 1)
    }
  }, [handleMeaningfulActivity, route.sceneId])

  const handleInteractionAnalytics = useCallback((phase, objectId, objectKind, outcome) => {
    if (phase === 'requested') handleMeaningfulActivity()
    const eventName = phase === 'requested'
      ? 'center_interaction_requested'
      : phase === 'completed'
        ? 'center_interaction_completed'
        : 'center_interaction_blocked'
    trackEvent(eventName, {
      sceneId: route.sceneId,
      objectId,
      objectKind,
      outcome,
    })
    const key = `${route.sceneId}/${objectId}/${objectKind}`
    const pending = pendingInteractionRequestsRef.current.get(key) ?? 0
    if (phase === 'requested') pendingInteractionRequestsRef.current.set(key, pending + 1)
    else if (pending > 1) pendingInteractionRequestsRef.current.set(key, pending - 1)
    else pendingInteractionRequestsRef.current.delete(key)
  }, [handleMeaningfulActivity, route.sceneId])

  const handleRideRequest = useCallback((device, destinationSceneId) => {
    const layer = worldLayerForScene(route.sceneId)
    if (phoneRideAvailability(device, layer) !== 'available') return
    const travelIntent = mainlineLongDistanceTravelIntentForRide(route.sceneId, destinationSceneId)
    trackEvent('center_ride_ready', {
      sceneId: route.sceneId,
      destinationSceneId,
      device,
      outcome: 'ready',
    })
    if (travelIntent) {
      setFeedbackMode(null)
      setBoundaryNotice('')
      setLongDistanceTravel({ phase: 'phone-retracting', intent: travelIntent, targetReady: false })
      setPhoneOpen(false)
      return
    }
    setPhoneOpen(false)
    setBoundaryNotice('叫车功能已接通，后续内容暂未开放。')
  }, [route.sceneId])

  const canPersistScenePosition = Boolean(
    route.entryPosition
      || route.spawnMode === 'ride'
      || resumeSceneId === route.sceneId,
  )
  const handlePositionChange = useCallback((position) => {
    if (canPersistScenePosition) commitPlayerSave((current) => recordPlayerScenePosition(current, route.sceneId, position))
  }, [canPersistScenePosition, commitPlayerSave, route.sceneId])

  const handleRuntimePositionChange = useCallback((sceneId, position) => {
    latestWorldPositionRef.current = { sceneId, position }
    positionSamplerRef.current?.sample(sceneId, position)
  }, [])

  const handlePlayerMovementStateChange = useCallback((moving) => {
    setCenterMovementActive(moving)
  }, [])

  const renderScenePage = (sceneRoute, {
    key,
    showProtagonist = true,
    snapshot = false,
    resumePosition: sceneResumePosition = resumePosition,
  } = {}) => (
    <MainlineScenePage
      key={key ?? `${sceneRoute.sceneId}:${sceneRoute.entryPosition?.x ?? ''}:${sceneRoute.entryPosition?.y ?? ''}:${sceneRoute.spawnMode}:${sceneResumePosition?.x ?? ''}:${sceneResumePosition?.y ?? ''}`}
      sceneId={sceneRoute.sceneId}
      onExternalExit={snapshot ? undefined : revealPhone}
      onExternalReturn={snapshot ? undefined : retractPhone}
      onSceneReady={snapshot ? undefined : handleSceneReady}
      phoneOpen={phoneOpen}
      onPhoneDismiss={snapshot ? undefined : retractPhone}
      onReadingStateChange={snapshot ? undefined : handleSceneReadingStateChange}
      onMeaningfulActivity={snapshot ? undefined : handleMeaningfulActivity}
      onPlayerMovementStateChange={snapshot ? undefined : handlePlayerMovementStateChange}
      onRuntimePositionChange={snapshot ? undefined : handleRuntimePositionChange}
      onDeskInteraction={snapshot ? undefined : switchCarriedPhone}
      onObjectInteraction={snapshot ? undefined : handleObjectInteraction}
      onDoorEvent={snapshot ? undefined : handleDoorEvent}
      onInteractionAnalytics={snapshot ? undefined : handleInteractionAnalytics}
      onMilkTeaAppOpen={snapshot ? undefined : openMilkTeaApp}
      onMilkTeaOrderReady={snapshot ? undefined : handleMilkTeaOrderReady}
      onChapterAnalytics={snapshot ? undefined : trackChapterEvent}
      initialSceneState={playerSave.sceneState[sceneRoute.sceneId] ?? {}}
      carriedMilkTea={commercialStreetMilkTeaHeld(playerSave.sceneState['commercial-street'])}
      interactionTutorialCompleted={isInteractionTutorialCompleted(playerSave.sceneState['commercial-street'])}
      onPlayerSceneStateChange={snapshot ? undefined : recordSceneState}
      onPlayerSceneStatePatch={snapshot ? undefined : recordSceneStatePatch}
      carriedPhoneDevice={phoneDevice}
      onSceneTransition={handleSceneTransition}
      onSafeSpawnCorrection={snapshot ? undefined : handleSafeSpawnCorrection}
      onPositionChange={snapshot ? undefined : canPersistScenePosition ? handlePositionChange : undefined}
      entryPosition={sceneRoute.entryPosition}
      spawnMode={sceneRoute.spawnMode}
      resumePosition={sceneResumePosition}
      showProtagonist={showProtagonist}
      presentationSnapshot={snapshot}
      suppressWorldEnterAnimation={!snapshot && localSlideHandoffRoute === sceneRoute}
      showSceneChrome={false}
    />
  )

  const localSlideActor = localSlide
    ? {
        from: screenPositionForScene(localSlide.transitionIntent.sourceSceneId, localSlide.transitionIntent.sourceCrossingPosition),
        to: screenPositionForScene(localSlide.transitionIntent.targetSceneId, localSlide.transitionIntent.safeEntryPosition),
      }
    : null

  return (
    <main
      className={`center-experience center-experience--${entryPhase}`}
      data-center-boundary="inner-phone-ride-ready"
      data-entry-phase={entryPhase}
      data-long-distance-phase={longDistanceTravel?.phase}
      aria-busy={entryPhase !== 'active' || Boolean(longDistanceTravel)}
    >
      <div
        className="center-experience__background"
        aria-hidden="true"
      />
      <div
        className={`center-experience__scene-layer ${localSlide ? 'is-local-sliding' : ''} ${longDistanceTravel ? `is-long-distance-${longDistanceTravel.phase}` : ''}`}
        onAnimationEnd={(event) => {
          handleSceneAnimationEnd(event)
          handleLongDistanceSourceAnimationEnd(event)
          handleLongDistanceTargetAnimationEnd(event)
        }}
      >
        <div
          className={`center-local-slide ${localSlide && localSlideActor ? `center-local-slide--${localSlide.transitionIntent.slideDirection}` : ''}`}
          style={localSlide && localSlideActor
            ? { '--local-slide-duration': `${localSlidePrototypeDurationMs}ms`, '--local-slide-actor-from-x': `${localSlideActor.from.x}%`, '--local-slide-actor-from-y': `${localSlideActor.from.y}%`, '--local-slide-actor-to-x': `${localSlideActor.to.x}%`, '--local-slide-actor-to-y': `${localSlideActor.to.y}%` }
            : undefined}
        >
          <div className="center-local-slide__surface center-local-slide__surface--source">
            {renderScenePage(localSlide?.sourceRoute ?? route, {
              showProtagonist: !localSlide,
              snapshot: Boolean(localSlide),
              resumePosition: localSlide?.sourceResumePosition,
            })}
          </div>
          {localSlide && localSlideActor && <>
            <div
              className="center-local-slide__surface center-local-slide__surface--target"
              onAnimationEnd={handleLocalSlideTargetAnimationEnd}
            >
              {renderScenePage(localSlide.targetRoute, { key: `local-slide-target:${localSlide.targetRoute.sceneId}:${localSlide.targetRoute.entryPosition?.x ?? ''}:${localSlide.targetRoute.entryPosition?.y ?? ''}`, showProtagonist: false, snapshot: true, resumePosition: undefined })}
            </div>
            <div className="scene-protagonist center-local-slide__actor" aria-hidden="true"><span className="scene-protagonist__dot" /></div>
          </>}
        </div>
        <WorldPhone
          currentSceneId={route.sceneId}
          worldLayer={worldLayerForScene(route.sceneId)}
          device={phoneDevice}
          open={phoneOpen}
          onOpen={revealPhone}
          onClose={retractPhone}
          onCloseComplete={handlePhoneCloseComplete}
          onRideRequest={handleRideRequest}
          milkTeaAppUnlocked={commercialStreetMilkTeaAppUnlocked(commercialStreetState)}
          milkTeaOrder={milkTeaOrder}
          milkTeaHeld={commercialStreetMilkTeaHeld(commercialStreetState)}
          requestedApp={requestedPhoneApp}
          onRequestedAppHandled={() => setRequestedPhoneApp(null)}
          onMilkTeaOrderConfirm={confirmMilkTeaOrder}
          onMilkTeaOrderStarted={handleMilkTeaOrderStarted}
          onMilkTeaOrderReady={handleMilkTeaOrderReady}
          feedbackMode={feedbackMode}
          onFeedbackModeChange={handleFeedbackModeChange}
          onFeedbackOpen={handleFeedbackOpen}
          onFeedbackSubmit={handleFeedbackSubmit}
          onMeaningfulActivity={handleMeaningfulActivity}
        />
        {boundaryNotice && (
          <div className="center-experience__boundary" role="status" aria-live="polite">
            {boundaryNotice}
          </div>
        )}
      </div>
      {longDistanceTravel && (longDistanceTravel.phase === 'travelling' || longDistanceTravel.phase === 'awaiting-target' || longDistanceTravel.phase === 'scene-entering') && (
        <LongDistanceTravel
          leaving={longDistanceTravel.phase === 'scene-entering'}
          onTravelComplete={handleLongDistanceTravelComplete}
        />
      )}
    </main>
  )
}
