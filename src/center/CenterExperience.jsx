import { useCallback, useEffect, useRef, useState } from 'react'
import { MainlineScenePage } from './runtime/MainlineScenePage'
import { LongDistanceTravel } from './runtime/LongDistanceTravel'
import { enqueuePhoneNotification, presentPhoneNotifications, readPhoneNotifications } from './runtime/phoneNotifications'
import { mainlineRideWaitingGuidance } from './runtime/mainlineRide'
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
import { advanceMainlineStoryClock } from './runtime/mainlineStoryClock'
import { advancePhoneStoryNotes, createPlayerPhoneNote, ensurePhoneYongheLead, pinPhoneStoryNote, updatePhoneNote } from './runtime/phonePersonalData'
import { commercialCafeStoryStatusKey } from './runtime/commercialCafeStory'
import { mainlineRideAtPickup, mainlineRideOrderFromState, mainlineRideOrderPatch, mainlineRideWalkingEtaMs, mainlineRideZone } from './runtime/mainlineRide'
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

function screenPositionForScene(sceneId, position, liveCameraOffset) {
  const cameraOffset = liveCameraOffset ?? mainlineCameraOffset(mainlineScenes[sceneId], position)
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
  const playerSaveRef = useRef(playerSave)
  const [route, setRoute] = useState(() => createRoute(resolveMainlineSceneId() ?? loadPlayerSave().currentSceneId ?? initialSceneId))
  const [phoneOpen, setPhoneOpen] = useState(false)
  const sceneReadingActiveRef = useRef(false)
  const [sceneReadingActive, setSceneReadingActive] = useState(false)
  const [phoneNotificationScreen, setPhoneNotificationScreen] = useState(false)
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
  const [sceneSlot, setSceneSlot] = useState(0)
  const [boundaryNotice, setBoundaryNotice] = useState('')
  const [rideOrder, setRideOrder] = useState(() => mainlineRideOrderFromState(loadPlayerSave().sceneState))
  const rideBoardingRef = useRef(() => {})
  const phoneRetractedRef = useRef(true)
  useEffect(() => { if (phoneOpen) phoneRetractedRef.current = false }, [phoneOpen])
  const [feedbackMode, setFeedbackMode] = useState(null)
  const [localSlide, setLocalSlide] = useState(null)
  const [longDistanceTravel, setLongDistanceTravel] = useState(null)
  const sceneEnteredAtRef = useRef(null)
  const milkTeaReadyAnalyticsMarkerRef = useRef(null)
  const commercialStreetState = playerSave.sceneState['commercial-street'] ?? {}
  const milkTeaOrder = commercialStreetMilkTeaOrderFromSceneState(commercialStreetState)


  const commitPlayerSave = useCallback((update) => {
    const current = playerSaveRef.current
    const next = update(current)
    if (next === current) return
    playerSaveRef.current = persistPlayerSave(next)
    setPlayerSave(playerSaveRef.current)
  }, [])

  useEffect(() => {
    commitPlayerSave(current => {
      const storyClock = advanceMainlineStoryClock(current.storyClock, route.sceneId)
      if (storyClock === current.storyClock) return current
      return { ...current, storyClock, phoneNotes: advancePhoneStoryNotes(current.phoneNotes, storyClock.stage) }
    })
  }, [commitPlayerSave, route.sceneId])
  const cafeStoryStatus = playerSave.sceneState['commercial-cafe']?.[commercialCafeStoryStatusKey]
  useEffect(() => {
    if (cafeStoryStatus !== 'complete') return
    commitPlayerSave(current => {
      const phoneNotes = ensurePhoneYongheLead(current.phoneNotes)
      return phoneNotes === current.phoneNotes ? current : { ...current, phoneNotes }
    })
  }, [cafeStoryStatus, commitPlayerSave])

  const createPhoneNote = useCallback((title, body) => {
    commitPlayerSave(current => {
      const phoneNotes = createPlayerPhoneNote(current.phoneNotes, title, body)
      return phoneNotes === current.phoneNotes ? current : { ...current, phoneNotes }
    })
  }, [commitPlayerSave])
  const changePhoneNote = useCallback((id, update) => {
    commitPlayerSave(current => ({ ...current, phoneNotes: updatePhoneNote(current.phoneNotes, id, update) }))
  }, [commitPlayerSave])
  const pinPhoneNote = useCallback((id) => {
    commitPlayerSave(current => ({ ...current, phoneNotes: pinPhoneStoryNote(current.phoneNotes, id) }))
  }, [commitPlayerSave])
  const changePhoneContactNote = useCallback((contactId, note) => {
    commitPlayerSave(current => ({ ...current, phoneContactNotes: { ...current.phoneContactNotes, [contactId]: note.slice(0, 1000) } }))
  }, [commitPlayerSave])
  const recordPhoneCall = useCallback((record) => {
    commitPlayerSave(current => ({ ...current, phoneCallHistory: [...current.phoneCallHistory, record].slice(-50) }))
  }, [commitPlayerSave])

  const notifyPhone = useCallback((event) => {
    commitPlayerSave(current => {
      const notifications = enqueuePhoneNotification(current.phoneNotifications, event)
      return notifications === current.phoneNotifications ? current : { ...current, phoneNotifications: notifications }
    })
  }, [commitPlayerSave])
  const readPhoneApp = useCallback((app) => {
    setPhoneNotificationScreen(false)
    if (app !== 'ride' && app !== 'milk-tea') return
    commitPlayerSave(current => current.phoneNotifications.some(n => n.app === app && n.unread)
      ? { ...current, phoneNotifications: readPhoneNotifications(current.phoneNotifications, app) } : current)
  }, [commitPlayerSave])
  useEffect(() => {
    if (sceneReadingActiveRef.current || sceneReadingActive || localSlide || longDistanceTravel || entryPhase !== 'active') return
    if (!playerSave.phoneNotifications.some(n => n.unread && !n.presented)) return
    commitPlayerSave(current => ({ ...current, phoneNotifications: presentPhoneNotifications(current.phoneNotifications) }))
    setRequestedPhoneApp(null)
    setPhoneNotificationScreen(true)
    setPhoneOpen(true)
  }, [commitPlayerSave, entryPhase, localSlide, longDistanceTravel, playerSave.phoneNotifications, sceneReadingActive])

  const handleSceneAnimationEnd = useCallback((event) => {
    if (event.animationName === 'center-world-scene-in') onRevealComplete?.()
  }, [onRevealComplete])

  useEffect(() => {
    if (!reducedMotion || entryPhase !== 'revealing') return
    onRevealComplete?.()
  }, [entryPhase, onRevealComplete, reducedMotion])

  const revealPhone = useCallback(() => {
    if (sceneReadingActiveRef.current) return
    setPhoneNotificationScreen(false)
    setRequestedPhoneApp(null)
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
    setPhoneNotificationScreen(false)
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

  const handleMilkTeaOrderReady = useCallback((order = commercialStreetMilkTeaOrderFromSceneState(playerSaveRef.current.sceneState['commercial-street'])) => {
    if (!order || !commercialStreetMilkTeaIsReady(order)) return false
    const marker = `${order.number}:${order.readyAt}`
    notifyPhone({ id: `milk-tea:${marker}`, app: 'milk-tea', title: '奶茶已制作完成', body: '可以去奶茶店取餐了' })
    if (milkTeaReadyAnalyticsMarkerRef.current === marker
      || commercialStreetMilkTeaReadyAnalyticsWasReported(playerSaveRef.current.sceneState['commercial-street'], order)) return false
    milkTeaReadyAnalyticsMarkerRef.current = marker
    commitPlayerSave((current) => recordPlayerSceneStatePatch(
      current,
      'commercial-street',
      commercialStreetMilkTeaReadyAnalyticsPatch(order),
    ))
    trackEvent('milk_tea_order_ready', { sceneId: route.sceneId, eventData: { orderNumber: order.number } })
    return true
  }, [commitPlayerSave, notifyPhone, route.sceneId])

  useEffect(() => {
    if (!milkTeaOrder) { milkTeaReadyAnalyticsMarkerRef.current = null; return }
    const remaining = milkTeaOrder.readyAt - Date.now()
    if (remaining <= 0) { handleMilkTeaOrderReady(milkTeaOrder); return }
    // The order deadline owns readiness even when its app and Phone are closed.
    const timer = window.setTimeout(() => handleMilkTeaOrderReady(milkTeaOrder), remaining)
    return () => window.clearTimeout(timer)
  }, [handleMilkTeaOrderReady, milkTeaOrder?.number, milkTeaOrder?.readyAt])

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
    setSceneReadingActive(reading)
    setCenterReadingActive(reading)
    if (!reading) {
      const current = latestWorldPositionRef.current
      if (current) rideBoardingRef.current(current.sceneId, current.position, current.context)
    }
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
      setSceneSlot(1 - sceneSlot)
      setLocalSlide({
        sourceRoute: route,
        sourceSlot: sceneSlot,
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
  }, [commitPlayerSave, reducedMotion, resumePosition, route, sceneSlot])

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
    phoneRetractedRef.current = true
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

  const boardRide = useCallback((order) => {
    const intent = mainlineLongDistanceTravelIntentForRide(order.sourceSceneId, order.targetSceneId)
    if (!intent) return
    setRideOrder(null)
    readPhoneApp('ride')
    recordSceneStatePatch(order.sourceSceneId, mainlineRideOrderPatch(null))
    setFeedbackMode(null)
    setBoundaryNotice('')
    setLongDistanceTravel({ phase: phoneRetractedRef.current ? 'scene-fading' : 'phone-retracting', intent, targetReady: false })
    setPhoneOpen(false)
  }, [readPhoneApp, recordSceneStatePatch])
  rideBoardingRef.current = (sceneId, position, context) => {
    if (!sceneReadingActiveRef.current && rideOrder && Date.now() >= rideOrder.driverArrivesAt && mainlineRideAtPickup(rideOrder, sceneId, position)) boardRide(rideOrder)
  }
  useEffect(() => {
    if (!rideOrder) return
    const arrived = () => {
      notifyPhone({ id: 'ride:' + rideOrder.sourceSceneId + ':' + rideOrder.targetSceneId + ':' + rideOrder.driverArrivesAt, app: 'ride', title: '司机已到达', body: '正在' + mainlineRideWaitingGuidance(rideOrder.sourceSceneId).waitingLabel + '等你' })
      const current = latestWorldPositionRef.current
      if (current) rideBoardingRef.current(current.sceneId, current.position, current.context)
    }
    const timer = window.setTimeout(arrived, Math.max(0, rideOrder.driverArrivesAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [notifyPhone, rideOrder])
  const handleRideRequest = useCallback((device, destinationSceneId) => {
    if (rideOrder || phoneRideAvailability(device, worldLayerForScene(route.sceneId)) !== 'available') return
    const zone = mainlineRideZone(route.sceneId)
    const intent = zone && mainlineLongDistanceTravelIntentForRide(zone.pickupSceneId, destinationSceneId)
    const current = latestWorldPositionRef.current
    if (!intent || current?.sceneId !== route.sceneId) return
    const etaMs = mainlineRideWalkingEtaMs(route.sceneId, current.position, current.context)
    if (etaMs === null) return
    const order = { sourceSceneId: zone.pickupSceneId, targetSceneId: destinationSceneId, driverArrivesAt: Date.now() + Math.ceil(etaMs) }
    trackEvent('center_ride_ready', { sceneId: route.sceneId, destinationSceneId, device, outcome: 'ready' })
    if (etaMs === 0 && mainlineRideAtPickup(order, route.sceneId, current.position)) boardRide(order)
    else {
      recordSceneStatePatch(order.sourceSceneId, mainlineRideOrderPatch(order))
      setRideOrder(order)
    }
  }, [boardRide, recordSceneStatePatch, rideOrder, route.sceneId])

  const canPersistScenePosition = Boolean(
    route.entryPosition
      || route.spawnMode === 'ride'
      || resumeSceneId === route.sceneId,
  )
  const handlePositionChange = useCallback((position) => {
    if (!canPersistScenePosition) return
    const current = playerSaveRef.current
    const next = recordPlayerScenePosition(current, route.sceneId, position)
    // Position is persisted continuously; only scene state needs a React publication.
    if (next !== current) playerSaveRef.current = persistPlayerSave(next)
  }, [canPersistScenePosition, route.sceneId])

  const handleRuntimePositionChange = useCallback((sceneId, position, context) => {
    latestWorldPositionRef.current = { sceneId, position, context }
    rideBoardingRef.current(sceneId, position, context)
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
        from: screenPositionForScene(localSlide.transitionIntent.sourceSceneId, localSlide.transitionIntent.sourceCrossingPosition, latestWorldPositionRef.current?.context?.cameraOffset),
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
          {[0, 1].map((slot) => {
            const source = localSlide && slot === localSlide.sourceSlot
            const active = slot === sceneSlot
            const sceneRoute = source ? localSlide.sourceRoute : active ? route : null
            return <div key={slot} hidden={!sceneRoute} className={`center-local-slide__surface center-local-slide__surface--${localSlide && active ? 'target' : 'source'}`} onAnimationEnd={localSlide && active ? handleLocalSlideTargetAnimationEnd : undefined}>
              {sceneRoute && renderScenePage(sceneRoute, {
                showProtagonist: !localSlide,
                snapshot: Boolean(localSlide),
                resumePosition: source ? localSlide.sourceResumePosition : active && !localSlide ? resumePosition : undefined,
              })}
            </div>
          })}
          {localSlide && localSlideActor && <div className="scene-protagonist center-local-slide__actor" aria-hidden="true"><span className="scene-protagonist__dot" /></div>}
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
          rideOrder={rideOrder}
          notifications={playerSave.phoneNotifications}
          storyClock={playerSave.storyClock}
          notificationScreen={phoneNotificationScreen}
          onNotificationDismiss={() => setPhoneNotificationScreen(false)}
          onAppOpen={readPhoneApp}
          milkTeaAppUnlocked={commercialStreetMilkTeaAppUnlocked(commercialStreetState)}
          milkTeaOrder={milkTeaOrder}
          milkTeaHeld={commercialStreetMilkTeaHeld(commercialStreetState)}
          requestedApp={requestedPhoneApp}
          onRequestedAppHandled={() => setRequestedPhoneApp(null)}
          onMilkTeaOrderConfirm={confirmMilkTeaOrder}
          onMilkTeaOrderStarted={handleMilkTeaOrderStarted}
          feedbackMode={feedbackMode}
          onFeedbackModeChange={handleFeedbackModeChange}
          onFeedbackOpen={handleFeedbackOpen}
          onFeedbackSubmit={handleFeedbackSubmit}
          onMeaningfulActivity={handleMeaningfulActivity}
          notes={playerSave.phoneNotes}
          yongheLeadUnlocked={cafeStoryStatus === 'complete'}
          contactNotes={playerSave.phoneContactNotes}
          callHistory={playerSave.phoneCallHistory}
          onNoteCreate={createPhoneNote}
          onNoteChange={changePhoneNote}
          onNotePin={pinPhoneNote}
          onContactNoteChange={changePhoneContactNote}
          onCallRecord={recordPhoneCall}
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
