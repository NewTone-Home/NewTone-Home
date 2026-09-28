import { useCallback, useEffect, useRef, useState } from 'react'
import { MainlineScenePage } from './runtime/MainlineScenePage'
import { WorldPhone } from './runtime/WorldPhone'
import {
  mainlineRespawnSceneId,
  mainlineSceneRoute,
  mainlineScenes,
  resolveMainlineSceneId,
} from './runtime/mainlineScenes'
import { mainlineCameraOffset } from './runtime/mainlineViewport'
import { isLocalSlidePrototypeIntent, localSlidePrototypeDurationMs } from './runtime/mainlineSceneTransition'
import {
  phoneRideAvailability,
  worldLayerForScene,
} from './runtime/phoneState'
import {
  loadPlayerSave,
  recordPlayerScenePosition,
  recordPlayerSceneState,
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
import { trackEvent } from '../services/analytics'
import {
  hasShownCenterCompletionFeedbackPrompt,
  markCenterCompletionFeedbackSubmitted,
  markCenterFeedbackPromptShown,
  markCenterCompletionFeedbackPromptShown,
  submitCenterFeedback,
} from '../services/centerFeedback'

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
  const [phoneDevice, setPhoneDevice] = useState(() => loadPlayerSave().phoneDevice)
  const [resumeSceneId, setResumeSceneId] = useState(null)
  const [resumePosition, setResumePosition] = useState(undefined)
  const [boundaryNotice, setBoundaryNotice] = useState('')
  const [feedbackMode, setFeedbackMode] = useState(null)
  const [localSlide, setLocalSlide] = useState(null)
  const sceneEnteredAtRef = useRef(null)

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
    trackEvent('center_phone_opened', {
      sceneId: route.sceneId,
      device: phoneDevice,
      outcome: 'opened',
    })
    setPhoneOpen(true)
  }, [phoneDevice, route.sceneId])
  const retractPhone = useCallback(() => {
    setPhoneOpen(false)
    setFeedbackMode(null)
  }, [])

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

  const handleFeedbackSubmit = useCallback((payload) => (
    submitCenterFeedback(payload).then((result) => {
      if (result.ok && payload.source === 'completion-prompt') markCenterCompletionFeedbackSubmitted()
      if (result.ok && payload.source === 'exit-prompt') markCenterFeedbackPromptShown()
      return result
    })
  ), [])

  const handlePlayableCompletion = useCallback(() => {
    if (hasShownCenterCompletionFeedbackPrompt()) return false
    trackEvent('center_feedback_prompt_shown', {
      sceneId: route.sceneId,
      device: phoneDevice,
      trigger: 'playable-completion',
      outcome: 'shown',
    })
    markCenterCompletionFeedbackPromptShown()
    setFeedbackMode('completion-prompt')
    setPhoneOpen(true)
    return true
  }, [phoneDevice, route.sceneId])

  useEffect(() => {
    if (sceneEnteredAtRef.current?.sceneId === route.sceneId) return
    const enteredAt = Date.now()
    sceneEnteredAtRef.current = { sceneId: route.sceneId, enteredAt }
    trackEvent('center_scene_entered', {
      sceneId: route.sceneId,
      device: phoneDevice,
    })
  }, [phoneDevice, route.sceneId])

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

  const handleSceneTransition = useCallback((nextSceneId, nextEntryPosition, nextSpawnMode, transitionIntent) => {
    const nextRoute = createRoute(nextSceneId, nextEntryPosition, nextSpawnMode || 'resume')
    if (isLocalSlidePrototypeIntent(transitionIntent) && !reducedMotion) {
      setLocalSlide({
        sourceRoute: route,
        sourceResumePosition: resumePosition,
        targetRoute: nextRoute,
        transitionIntent,
      })
    }
    const currentScene = sceneEnteredAtRef.current
    trackEvent('center_scene_exited', {
      sceneId: route.sceneId,
      destinationSceneId: nextSceneId,
      dwellMs: currentScene?.sceneId === route.sceneId ? Date.now() - currentScene.enteredAt : undefined,
      outcome: 'scene_change',
    })
    sceneEnteredAtRef.current = null
    commitPlayerSave((current) => {
      const next = {
        ...current,
      currentSceneId: nextSceneId,
      currentPosition: nextEntryPosition ?? current.scenePositions[nextSceneId] ?? null,
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

  const handleSafeSpawnCorrection = useCallback((position) => {
    if (!route.entryPosition) return
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
  }, [route.sceneId])

  const handleRideRequest = useCallback((device, destinationSceneId) => {
    const layer = worldLayerForScene(route.sceneId)
    if (phoneRideAvailability(device, layer) !== 'available') return
    trackEvent('center_ride_ready', {
      sceneId: route.sceneId,
      destinationSceneId,
      device,
      outcome: 'ready',
    })
    const completionPromptShown = device === 'inner' && layer === 'inner'
      ? handlePlayableCompletion()
      : false
    setPhoneOpen(completionPromptShown)
    setBoundaryNotice('叫车功能已接通，后续内容暂未开放。')
  }, [handlePlayableCompletion, route.sceneId])

  const canPersistScenePosition = Boolean(
    route.entryPosition
      || route.spawnMode === 'ride'
      || resumeSceneId === route.sceneId,
  )
  const handlePositionChange = useCallback((position) => {
    if (canPersistScenePosition) commitPlayerSave((current) => recordPlayerScenePosition(current, route.sceneId, position))
  }, [canPersistScenePosition, commitPlayerSave, route.sceneId])

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
      onSceneReady={snapshot ? undefined : onSceneReady}
      phoneOpen={phoneOpen}
      onPhoneDismiss={snapshot ? undefined : retractPhone}
      onDeskInteraction={snapshot ? undefined : switchCarriedPhone}
      onObjectInteraction={snapshot ? undefined : handleObjectInteraction}
      onDoorEvent={snapshot ? undefined : handleDoorEvent}
      initialSceneState={playerSave.sceneState[sceneRoute.sceneId] ?? {}}
      interactionTutorialCompleted={isInteractionTutorialCompleted(playerSave.sceneState['commercial-street'])}
      onPlayerSceneStateChange={snapshot ? undefined : recordSceneState}
      carriedPhoneDevice={phoneDevice}
      onSceneTransition={handleSceneTransition}
      onSafeSpawnCorrection={snapshot ? undefined : handleSafeSpawnCorrection}
      onPositionChange={snapshot ? undefined : canPersistScenePosition ? handlePositionChange : undefined}
      entryPosition={sceneRoute.entryPosition}
      spawnMode={sceneRoute.spawnMode}
      resumePosition={sceneResumePosition}
      showProtagonist={showProtagonist}
      presentationSnapshot={snapshot}
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
      aria-busy={entryPhase !== 'active'}
    >
      <div
        className="center-experience__background"
        aria-hidden="true"
      />
      <div className={`center-experience__scene-layer ${localSlide ? 'is-local-sliding' : ''}`} onAnimationEnd={handleSceneAnimationEnd}>
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
          onRideRequest={handleRideRequest}
          feedbackMode={feedbackMode}
          onFeedbackModeChange={handleFeedbackModeChange}
          onFeedbackOpen={handleFeedbackOpen}
          onFeedbackSubmit={handleFeedbackSubmit}
        />
        {boundaryNotice && (
          <div className="center-experience__boundary" role="status" aria-live="polite">
            {boundaryNotice}
          </div>
        )}
      </div>
    </main>
  )
}
