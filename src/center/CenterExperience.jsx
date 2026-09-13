import { useCallback, useEffect, useRef, useState } from 'react'
import { MainlineScenePage } from './runtime/MainlineScenePage'
import { WorldPhone } from './runtime/WorldPhone'
import {
  mainlineRespawnSceneId,
  mainlineSceneRoute,
  resolveMainlineSceneId,
} from './runtime/mainlineScenes'
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
import './runtime/scene.css'
import './CenterExperience.css'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { trackEvent } from '../services/analytics'
import {
  hasShownCenterFeedbackPrompt,
  markCenterFeedbackPromptShown,
  submitCenterFeedback,
} from '../services/centerFeedback'

const initialSceneId = mainlineRespawnSceneId

function createRoute(sceneId, entryPosition, spawnMode = 'resume') {
  return { sceneId, entryPosition, spawnMode }
}

export default function CenterExperience({
  entryPhase = 'active',
  onCoverComplete,
  onSceneReady,
  onRevealComplete,
  onExitWorld,
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
  const sceneEnteredAtRef = useRef(null)

  const commitPlayerSave = useCallback((update) => {
    setPlayerSave((current) => persistPlayerSave(update(current)))
  }, [])

  const handleBackgroundAnimationEnd = useCallback((event) => {
    if (event.animationName === 'center-world-cover') onCoverComplete?.()
  }, [onCoverComplete])

  const handleSceneAnimationEnd = useCallback((event) => {
    if (event.animationName === 'center-world-scene-in') onRevealComplete?.()
  }, [onRevealComplete])

  useEffect(() => {
    if (!reducedMotion || entryPhase !== 'covering') return
    onCoverComplete?.()
  }, [entryPhase, onCoverComplete, reducedMotion])

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
      if (result.ok && payload.source === 'exit-prompt') markCenterFeedbackPromptShown()
      return result
    })
  ), [])

  const handleActualWorldExit = useCallback(() => {
    const currentScene = sceneEnteredAtRef.current
    trackEvent('center_scene_exited', {
      sceneId: route.sceneId,
      dwellMs: currentScene?.sceneId === route.sceneId ? Date.now() - currentScene.enteredAt : undefined,
      exitReason: 'return',
      outcome: 'world_exit',
    })
    sceneEnteredAtRef.current = null
    onExitWorld?.()
  }, [onExitWorld, route.sceneId])

  const handleExitWorldRequest = useCallback(() => {
    if (hasShownCenterFeedbackPrompt()) {
      handleActualWorldExit()
      return
    }
    trackEvent('center_feedback_prompt_shown', {
      sceneId: route.sceneId,
      device: phoneDevice,
      outcome: 'shown',
    })
    setFeedbackMode('exit-prompt')
    setPhoneOpen(true)
  }, [handleActualWorldExit, phoneDevice, route.sceneId])

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

  const handleSceneTransition = useCallback((nextSceneId, nextEntryPosition, nextSpawnMode) => {
    const nextRoute = createRoute(nextSceneId, nextEntryPosition, nextSpawnMode || 'resume')
    const currentScene = sceneEnteredAtRef.current
    trackEvent('center_scene_exited', {
      sceneId: route.sceneId,
      destinationSceneId: nextSceneId,
      dwellMs: currentScene?.sceneId === route.sceneId ? Date.now() - currentScene.enteredAt : undefined,
      outcome: 'scene_change',
    })
    sceneEnteredAtRef.current = null
    commitPlayerSave((current) => ({
      ...current,
      currentSceneId: nextSceneId,
      currentPosition: nextEntryPosition ?? current.scenePositions[nextSceneId] ?? null,
    }))
    window.history.pushState(
      { newtoneCenterScene: nextSceneId },
      '',
      mainlineSceneRoute(nextSceneId, nextEntryPosition, nextRoute.spawnMode),
    )
    setRoute(nextRoute)
  }, [commitPlayerSave, route.sceneId])

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
        onAnimationEnd={handleBackgroundAnimationEnd}
      />
      <div className="center-experience__scene-layer" onAnimationEnd={handleSceneAnimationEnd}>
        <MainlineScenePage
          key={`${route.sceneId}:${route.entryPosition?.x ?? ''}:${route.entryPosition?.y ?? ''}:${route.spawnMode}:${resumePosition?.x ?? ''}:${resumePosition?.y ?? ''}`}
          sceneId={route.sceneId}
          onExternalExit={revealPhone}
          onExternalReturn={retractPhone}
          onSceneReady={onSceneReady}
          phoneOpen={phoneOpen}
          onPhoneDismiss={retractPhone}
          onDeskInteraction={switchCarriedPhone}
          onObjectInteraction={handleObjectInteraction}
          onDoorEvent={handleDoorEvent}
          initialSceneState={playerSave.sceneState[route.sceneId] ?? {}}
          onPlayerSceneStateChange={recordSceneState}
          carriedPhoneDevice={phoneDevice}
          onSceneTransition={handleSceneTransition}
          onSafeSpawnCorrection={handleSafeSpawnCorrection}
          onPositionChange={canPersistScenePosition ? handlePositionChange : undefined}
          entryPosition={route.entryPosition}
          spawnMode={route.spawnMode}
          resumePosition={resumePosition}
          showSceneChrome={false}
        />
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
          onExitWorldRequest={handleExitWorldRequest}
          onExitWorld={handleActualWorldExit}
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
