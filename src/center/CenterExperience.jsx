import { getGameStorage } from '../save-session.mjs'
import { createRuntimeSaveLifecycle } from './runtime/runtimeSaveLifecycle.mjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { attachSessionGameClockVisibilityLifecycle, createSessionGameClock } from './runtime/sessionGameClock'
import { MainlineScenePage } from './runtime/MainlineScenePage'
import { LongDistanceTravel } from './runtime/LongDistanceTravel'
import { enqueuePhoneNotification, readPhoneNotifications } from './runtime/phoneNotifications'
import { commercialStreetMapGuideActive, laoZhouArrivalLabel, laoZhouArrivalShouldDeliver, laoZhouArrivalTimeKey } from './runtime/openingGuidance'
import { WorldPhone } from './runtime/WorldPhone'
import { mainlineSceneRoomAtPosition } from './runtime/mainlineSceneModel'
import { storeOrderEntryRoute } from './runtime/storeOrderEntryPolicy'
import {
  mainlineRespawnSceneId,
  mainlineSceneRoute,
  mainlineScenes,
  resolveMainlineSceneId,
  resolveLegacyCafeEntryPosition,
  legacyCafeEntryPosition,
} from './runtime/mainlineScenes'
import { mainlineCameraOffset, mainlineViewportPointFromWorld, mainlineWorldScale } from './runtime/mainlineViewport'
import { currentMainlineViewportMetrics } from './runtime/mainlineViewportProjection'
import { sceneDesignReferenceMetrics } from './runtime/sceneBoundaryGrid'
import { createMainlineSceneGeometrySnapshot } from './runtime/mainlineSceneGeometrySnapshot'
import { isLocalSlidePrototypeIntent, localSlidePrototypeDurationMs } from './runtime/mainlineSceneTransition'
import { mainlineLongDistanceTravelIntentForRide } from './runtime/longDistanceTravelContract'
import { isPointInContinuousCafe } from './runtime/continuousCafe'
import { advanceMainlineStoryClock, isStoryNight } from './runtime/mainlineStoryClock'
import { advancePhoneStoryNotes, createPlayerPhoneNote, ensurePhoneYongheLead, pinPhoneStoryNote, updatePhoneNote } from './runtime/phonePersonalData'
import { commercialCafeStoryStatusKey, commercialCafeDepartureOnTransition, commercialCafeLegacyDeparture } from './runtime/commercialCafeStory'
import { ruoyuCafeDepartureOnTransition, ruoyuCafeMineExitPatch, ruoyuCafeUnlockedKey } from './runtime/ruoyuCafeMeeting'
import {
  commercialCafeCompletionPhoneCanRequest,
  commercialCafeCompletionPhoneDisplayedPatch,
  commercialCafeCompletionPhonePendingKey,
  commercialCafeCompletionPhoneStoryPatch,
} from './runtime/cafeCompletionPhone'
import { mainlineRideAtPickup, mainlineRideOrderFromState, mainlineRideOrderPatch, mainlineRideSuppressExternalPhoneReveal, mainlineRideWalkingEtaMs, mainlineRideZone } from './runtime/mainlineRide'
import {
  phoneRideAvailability,
  worldLayerForScene,
} from './runtime/phoneState'
import {
  attachPositionSaveLifecycle,
  createGameTimeSaveCheckpoint,
  createPositionSaveCoordinator,
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
  installHistoryClock,
  recordBusinessCompletion,
  markSessionActivity,
  setAnalyticsCurrentScene,
  setAnalyticsLocation,
  getInteractionSessions,
  endAnalyticsLocation,
  setAnalyticsPhoneOpen,
  setCenterMovementActive,
  setCenterReadingActive,
  trackEvent,
} from '../services/analytics'
import { storyCompletionTransitions } from '../services/storyAnalytics'
import { shopAnalyticsTransitions } from '../services/shopAnalytics'
import { createCenterPositionSampler } from '../services/centerPositionSampler'
import { submitCenterFeedback } from '../services/centerFeedback'
import {
  commercialStreetMilkTeaHeld,
  commercialStreetMilkTeaIsReady,
  commercialStreetMilkTeaOrderNumberKey,
  commercialStreetMilkTeaOrderFromSceneState,
  commercialStreetMilkTeaOrderPatch,
  commercialStreetMilkTeaReadyAnalyticsPatch,
  commercialStreetMilkTeaReadyAnalyticsWasReported,
  createCommercialStreetMilkTeaOrder,
} from './runtime/commercialStreetMilkTea'
import { appendShopOrderHistory, cancelUnmappedLegacyOrder, claimCrossShopOrder, consumeHeldConsumable, crossShopIds } from './runtime/crossShopOrders'
import { shopPreparationDurationGameMs } from './runtime/shopPreparationPolicy'
import { placePaidShopOrder } from './runtime/shopOrderPayment'
import { shopProductFor } from './runtime/shopOrderCatalog'
import { notifyDueShopOrders } from './runtime/shopOrderCompletion'
import { createCafeStoryOrderDeliveryController } from './runtime/cafeStoryOrderDelivery'
import { unlockedCommercialDrinkShopIds } from './runtime/commercialStreetShopApps'
import { commercialShopWelcomeCopy, shopServiceCopy } from './runtime/shopServiceCopy'
import { yongheTakeawayCatalog } from './runtime/yongheTakeawayCatalog'

const initialSceneId = mainlineRespawnSceneId
const freeTrialClockRates = { normalPlay: 30, ordinaryReading: 15, idle: 5 }
const syntheticClockTrialStorageKey = 'newtone-e2e-clock-trial-synthetic-save-v1'
const syntheticShopOrderStorageKey = 'newtone-e2e-shop-orders-synthetic-save-v1'
const commercialCafeTableDeliverySeatKey = 'commercialCafeTableDeliverySeatId'
function hasSyntheticClockTrialStorage() {
  if (!import.meta.env.DEV || import.meta.env.VITE_E2E_CLOCK_TRIAL !== '1' || typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(syntheticClockTrialStorageKey) === '1'
  } catch {
    return false
  }
}
function syntheticShopOrderStorage() {
  if (!import.meta.env.DEV || import.meta.env.VITE_E2E_SHOP_ORDERS !== '1' || typeof window === 'undefined'
    || new URLSearchParams(window.location.search).get('e2eShopOrders') !== '1') return null
  try { return window.sessionStorage.getItem(syntheticShopOrderStorageKey) === '1' ? window.sessionStorage : null } catch { return null }
}
function formatTrialGameTime(gameTimeMs) {
  const minuteOfDay = Math.floor(gameTimeMs / 60_000) % (24 * 60)
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`
}
function createRoute(sceneId, entryPosition, spawnMode = 'resume') {
  return { sceneId, entryPosition, spawnMode }
}

function screenPositionForScene(sceneId, position, liveCameraOffset) {
  const viewport = currentMainlineViewportMetrics() ?? sceneDesignReferenceMetrics
  const cameraOffset = liveCameraOffset ?? mainlineCameraOffset(mainlineScenes[sceneId], position, false, viewport)
  return mainlineViewportPointFromWorld(position, viewport, cameraOffset)
}

export default function CenterExperience({
  entryPhase = 'active',
  onSceneReady,
  onRevealComplete,
  sessionHandle,
}) {
  const reducedMotion = useReducedMotion()
  const fixtureStorage = syntheticShopOrderStorage()
  const [runtimeStorage] = useState(() => sessionHandle?.storage ?? fixtureStorage ?? getGameStorage())
  const [saveLifecycle] = useState(() => createRuntimeSaveLifecycle(runtimeStorage, sessionHandle))
  useEffect(() => saveLifecycle.connect(), [saveLifecycle])
  const [debugClockTrial] = useState(() => {
    if (!hasSyntheticClockTrialStorage()) return null
    const mode = new URLSearchParams(window.location.search).get('debugClockTrial')
    return mode === 'formal-dialogue' || mode === 'inner-monologue' ? mode : null
  })
  const [playerSave, setPlayerSave] = useState(() => loadPlayerSave(runtimeStorage))
  const sessionGameClockRef = useRef(null)
  if (!sessionGameClockRef.current) {
    sessionGameClockRef.current = createSessionGameClock({
      rates: freeTrialClockRates,
      idleAfterMs: 60_000,
      initialGameTimeMs: playerSave.gameTimeMs,
    })
  }
  const [trialClockSnapshot, setTrialClockSnapshot] = useState(() => sessionGameClockRef.current.read())
  const playerSaveRef = useRef(playerSave)
  const [route, setRoute] = useState(() => createRoute(resolveMainlineSceneId() ?? loadPlayerSave(runtimeStorage).currentSceneId ?? initialSceneId, resolveLegacyCafeEntryPosition()))
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('scene') === 'commercial-cafe') {
      window.history.replaceState({ newtoneCenterScene: 'commercial-street' }, '', mainlineSceneRoute('commercial-street', route.entryPosition ?? legacyCafeEntryPosition()))
    }
  }, [route.entryPosition])
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [requestedShopId, setRequestedShopId] = useState(null)
  const [requestedShopProductId, setRequestedShopProductId] = useState(null)
  const [yongheOrderFeedback, setYongheOrderFeedback] = useState(0)
  const [yongheReadyCue, setYongheReadyCue] = useState(null)
  const yongheReadyCueMarkerRef = useRef(null)
  const [phonePanelRetracted, setPhonePanelRetracted] = useState(true)
  const sceneReadingActiveRef = useRef(false)
  const [sceneReadingActive, setSceneReadingActive] = useState(false)
  const [sceneDialogueActive, setSceneDialogueActive] = useState(false)
  const [phoneNotificationScreen, setPhoneNotificationScreen] = useState(false)
  const positionSamplerRef = useRef(null)
  const currentSceneIdRef = useRef(route.sceneId)
  const latestWorldPositionRef = useRef(null)
  const cafeHandoffOutsideRef = useRef(null)
  const rideBoardingHandoffRef = useRef(false)
  const [cafeHandoffPositionRevision, setCafeHandoffPositionRevision] = useState(0)
  const positionSaveCoordinatorRef = useRef(null)
  if (!positionSaveCoordinatorRef.current) {
    positionSaveCoordinatorRef.current = createPositionSaveCoordinator({
      getSave: () => playerSaveRef.current,
      setSave: next => { playerSaveRef.current = next },
      getCurrentSceneId: () => currentSceneIdRef.current,
      recordPosition: recordPlayerScenePosition,
      canPersist: saveLifecycle.canPersist,
      persist: next => persistPlayerSave({
        ...next,
        gameTimeMs: sessionGameClockRef.current.read().gameTimeMs,
      }, runtimeStorage),
    })
  }
  const gameTimeSaveCheckpointRef = useRef(null)
  if (!gameTimeSaveCheckpointRef.current) {
    gameTimeSaveCheckpointRef.current = createGameTimeSaveCheckpoint({
      getSave: () => playerSaveRef.current,
      setSave: next => { playerSaveRef.current = next; setPlayerSave(next) },
      getGameTimeMs: () => sessionGameClockRef.current.read().gameTimeMs,
      canPersist: saveLifecycle.canPersist,
      persist: next => persistPlayerSave(next, runtimeStorage, undefined, { preserveFreshSeatOnly: true }),
    })
  }
  useEffect(() => saveLifecycle.onStop(() => positionSaveCoordinatorRef.current.clear()), [saveLifecycle])
  const getRideMapSnapshot = useCallback(() => {
    const current = latestWorldPositionRef.current
    if (!current || current.sceneId !== route.sceneId) return null
    return createMainlineSceneGeometrySnapshot(
      mainlineScenes[current.sceneId], current.position,
      current.context.layout, current.context.screenMetrics,
    )
  }, [route.sceneId])
  const pendingInteractionRequestsRef = useRef(new Map())
  const completedInteractionCandidatesRef = useRef(new Map())
  const pendingBusinessFactsRef = useRef([])
  currentSceneIdRef.current = route.sceneId
  if (!positionSamplerRef.current) {
    positionSamplerRef.current = createCenterPositionSampler({
      onSample: ({ sceneId, positionX, positionY }) => trackEvent('center_position_sample', {
        sceneId,
        positionX,
        positionY,
      }, { deferred: true }).then(() => saveLifecycle.run(() => checkpointSessionActivityIfDue())),
    })
  }
  const [phoneDevice, setPhoneDevice] = useState(() => loadPlayerSave(runtimeStorage).phoneDevice)
  const [requestedPhoneApp, setRequestedPhoneApp] = useState(null)
  const [resumeSceneId, setResumeSceneId] = useState(null)
  const [resumePosition, setResumePosition] = useState(undefined)
  const [localSlideHandoffRoute, setLocalSlideHandoffRoute] = useState(null)
  const [sceneSlot, setSceneSlot] = useState(0)
  const [boundaryNotice, setBoundaryNotice] = useState('')
  const [rideOrder, setRideOrder] = useState(() => mainlineRideOrderFromState(loadPlayerSave(runtimeStorage).sceneState))
  const rideBoardingRef = useRef(() => {})
  const phoneRetractedRef = useRef(true)
  useEffect(() => {
    if (!phoneOpen) return
    phoneRetractedRef.current = false
    setPhonePanelRetracted(false)
  }, [phoneOpen])
  const [feedbackMode, setFeedbackMode] = useState(null)
  const [localSlide, setLocalSlide] = useState(null)
  const [longDistanceTravel, setLongDistanceTravel] = useState(null)
  const sceneEnteredAtRef = useRef(null)
  const milkTeaReadyAnalyticsMarkerRef = useRef(null)
  const commercialStreetState = playerSave.sceneState['commercial-street'] ?? {}
  const syntheticDrinkAppUnlock = Boolean(fixtureStorage && new URLSearchParams(window.location.search).get('e2eUnlockDrinkApp') === '1')
  const availableDrinkShopIds = unlockedCommercialDrinkShopIds(commercialStreetState, syntheticDrinkAppUnlock)
  const drinkOrderingAppUnlocked = availableDrinkShopIds.length > 0
  const resolvedHeldConsumable = playerSave.heldConsumable ?? (commercialStreetMilkTeaHeld(commercialStreetState)
    ? { id: 'legacy-milk-tea', shopId: 'commercial-south-slot-5', productId: 'legacy-milk-tea', kind: 'legacy-unknown', sourceOrderId: null }
    : null)
  const cafeWorldSceneState = useMemo(() => ({ ...playerSave.sceneState['commercial-street'], ...playerSave.sceneState['commercial-cafe'] }), [playerSave.sceneState['commercial-street'], playerSave.sceneState['commercial-cafe']])
  const milkTeaOrder = commercialStreetMilkTeaOrderFromSceneState(commercialStreetState)


  const commitPlayerSave = useCallback((update) => {
    saveLifecycle.assertActive()
    const previous = playerSaveRef.current
    const next = positionSaveCoordinatorRef.current.commit(update)
    if (next !== previous) {
      setPlayerSave(next)
      // The persistence coordinator throws on failure before reaching this point.
      const interactions=getInteractionSessions()
      for (const event of [...shopAnalyticsTransitions(previous, next), ...storyCompletionTransitions(previous, next)]) {
        if(event.objectKind!=='story')recordBusinessCompletion(event)
        if(event.objectKind==='story') interactions.instant({objectId:event.objectId,objectKind:event.objectKind,contentId:event.objectId},event.outcome)
        else if(!(interactions.annotate('display',event.outcome) || interactions.annotate('phone',event.outcome))) pendingBusinessFactsRef.current.push(event)
      }
    }
  }, [])

  useEffect(() => {
    commitPlayerSave(current => {
      const cafeState = { ...current.sceneState['commercial-street'], ...current.sceneState['commercial-cafe'] }
      const patch = commercialCafeLegacyDeparture(cafeState, current.currentSceneId)
      return patch ? recordPlayerSceneStatePatch(current, 'commercial-cafe', patch) : current
    })
  }, [commitPlayerSave])

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
  useEffect(() => saveLifecycle.onStop(() => endAnalyticsLocation()), [saveLifecycle])
  const handlePhoneAppInteraction = useCallback((app, outcome) => {
    const interactions=getInteractionSessions()
    if(outcome==='app-opened')interactions.begin('phone',app,{objectId:`phone-app:${app}`,objectKind:'phone-app',contentId:app})
    else interactions.finish('phone')
  }, [])
  const readPhoneApp = useCallback((app) => {
    setPhoneNotificationScreen(false)
    if (!['ride', 'milk-tea', 'yonghe-order', 'cafe-takeaway'].includes(app)) return
    commitPlayerSave(current => current.phoneNotifications.some(n => n.app === app && n.unread)
      ? { ...current, phoneNotifications: readPhoneNotifications(current.phoneNotifications, app) } : current)
  }, [commitPlayerSave])


  const handleSceneAnimationEnd = useCallback((event) => {
    if (event.animationName === 'center-world-scene-in') onRevealComplete?.()
  }, [onRevealComplete])

  useEffect(() => {
    if (!reducedMotion || entryPhase !== 'revealing') return
    onRevealComplete?.()
  }, [entryPhase, onRevealComplete, reducedMotion])

  const revealPhone = useCallback(() => {
    if (sceneReadingActiveRef.current) return
    setPhoneNotificationScreen(playerSaveRef.current.phoneNotifications.some(n => n.unread))
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
    setRequestedPhoneApp(null)
    setRequestedShopId(crossShopIds.milkTea)
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

  const openShopOrderApp = useCallback((shopId, productId = null) => {
    setPhoneNotificationScreen(false)
    setRequestedPhoneApp(null)
    setRequestedShopId(shopId)
    setRequestedShopProductId(productId)
    setPhoneOpen(true)
  }, [])

  const handleYongheOrderPlaced = useCallback(({ shopId }) => {
    if (shopId !== crossShopIds.yonghe) return
    setPhoneOpen(false)
    setYongheOrderFeedback(current => current + 1)
  }, [])

  const handleYongheOrderReady = useCallback((order) => {
    if (yongheReadyCueMarkerRef.current === order.id) return
    yongheReadyCueMarkerRef.current = order.id
    setYongheReadyCue({ id: order.id, text: `${order.productName}好了。` })
  }, [])

  useEffect(() => {
    const order = playerSave.shopOrders?.[crossShopIds.yonghe]
    if (!order || order.status !== 'queued' || order.readyAtGameTimeMs === null) return
    const productName = yongheTakeawayCatalog.find(product => product.id === order.productId)?.name ?? order.productId
    let timer = null
    const checkGameClock = () => {
      if (!saveLifecycle.canPersist()) return true
      const nowGameTimeMs = sessionGameClockRef.current.read().gameTimeMs
      if (nowGameTimeMs >= order.readyAtGameTimeMs) {
        if (timer !== null) window.clearInterval(timer)
        handleYongheOrderReady({ id: order.id, shopId: crossShopIds.yonghe, productId: order.productId, productName })
        return true
      }
      return false
    }
    if (checkGameClock()) return
    timer = window.setInterval(checkGameClock, 250)
    const cancel = () => { if (timer !== null) window.clearInterval(timer) }
    const unsubscribe = saveLifecycle.onStop(cancel)
    return () => { unsubscribe(); cancel() }
  }, [handleYongheOrderReady, playerSave.shopOrders?.[crossShopIds.yonghe]?.id, playerSave.shopOrders?.[crossShopIds.yonghe]?.productId, playerSave.shopOrders?.[crossShopIds.yonghe]?.readyAtGameTimeMs, playerSave.shopOrders?.[crossShopIds.yonghe]?.status])

  useEffect(() => {
    const nowGameTimeMs = trialClockSnapshot.gameTimeMs
    commitPlayerSave(current => {
      const completion = notifyDueShopOrders(current.shopOrders, current.phoneNotifications, nowGameTimeMs)
      return completion.changed ? { ...current, shopOrders: completion.orders, phoneNotifications: completion.notifications } : current
    })
  }, [commitPlayerSave, playerSave.shopOrders, trialClockSnapshot.gameTimeMs])

  useEffect(() => {
    if (!fixtureStorage) return
    const shopId = new URLSearchParams(window.location.search).get('e2eShopId')
    if (!shopId || !Object.values(crossShopIds).includes(shopId)) return
    openShopOrderApp(shopId)
  }, [fixtureStorage, openShopOrderApp])

  const confirmShopOrder = useCallback(({ shopId, productId, options, idempotencyKey }) => {
    const current = playerSaveRef.current
    const legacyHeldDrink = commercialStreetMilkTeaHeld(current.sceneState['commercial-street'])
    if ((current.heldConsumable || legacyHeldDrink) && !current.shopOrderPaymentReceipts?.[idempotencyKey]) {
      return { ok: false, reason: 'hand-full' }
    }
    const nowGameTimeMs = sessionGameClockRef.current.read().gameTimeMs
    const preparationDurationMs = shopPreparationDurationGameMs(shopId, productId, { overrides: fixtureStorage ? {
      [`${crossShopIds.milkTea}:${productId}`]: 1000,
      [`${crossShopIds.fruitTea}:${productId}`]: 1000,
      [`${crossShopIds.yonghe}:${productId}`]: 1000,
    } : undefined })
    const product = shopProductFor(shopId, productId)
    if (!product || !Number.isSafeInteger(product.price) || !idempotencyKey) return { ok: false, reason: 'invalid-payment' }
    let outcome = null
    commitPlayerSave(current => {
      const result = placePaidShopOrder({ ordersByShop: current.shopOrders, heldConsumable: current.heldConsumable }, {
        walletBalance: current.walletBalance, paymentReceipts: current.shopOrderPaymentReceipts,
      }, {
        shopId, productId, idempotencyKey, orderId: `order-${idempotencyKey}`,
        price: product.price, placedAtGameTimeMs: nowGameTimeMs, preparationDurationMs, options,
      })
      outcome = result
      if (!result.ok) return current
      const cafeStoryDeliveries = { ...current.cafeStoryDeliveries }
      let cafeDeliveryHistoryChanged = false
      if (shopId === crossShopIds.cafeTakeaway) {
        for (const [eventId, delivery] of Object.entries(cafeStoryDeliveries)) {
          if (delivery.deliveryKind === 'table' && delivery.presentation === 'complete') {
            delete cafeStoryDeliveries[eventId]
            cafeDeliveryHistoryChanged = true
          }
        }
      }
      const updated = {
        ...current,
        shopOrders: result.orderState.ordersByShop,
        heldConsumable: result.orderState.heldConsumable,
        walletBalance: result.paymentState.walletBalance,
        shopOrderPaymentReceipts: result.paymentState.paymentReceipts,
        ...(cafeDeliveryHistoryChanged ? { cafeStoryDeliveries } : {}),
      }
      return shopId === crossShopIds.cafeTakeaway
        ? recordPlayerSceneStatePatch(updated, 'commercial-street', { [commercialCafeTableDeliverySeatKey]: null })
        : updated
    })
    return outcome?.ok ? { ok: true } : { ok: false, reason: outcome?.reason ?? 'order-not-saved' }
  }, [commitPlayerSave, fixtureStorage])

  const cancelLegacyShopOrder = useCallback((shopId) => {
    let outcome = null
    commitPlayerSave(current => {
      const result = cancelUnmappedLegacyOrder({ ordersByShop: current.shopOrders, heldConsumable: current.heldConsumable }, shopId)
      outcome = result
      if (!result.ok) return current
      const updated = { ...current, shopOrders: result.state.ordersByShop }
      return shopId === crossShopIds.milkTea
        ? recordPlayerSceneStatePatch(updated, 'commercial-street', { [commercialStreetMilkTeaOrderNumberKey]: null })
        : updated
    })
    return outcome?.ok ? { ok: true } : { ok: false, reason: outcome?.reason ?? 'order-not-saved' }
  }, [commitPlayerSave])

  const claimShopOrder = useCallback((shopId) => {
    const nowGameTimeMs = sessionGameClockRef.current.read().gameTimeMs
    let outcome = null
    commitPlayerSave(current => {
      if (current.heldConsumable || commercialStreetMilkTeaHeld(current.sceneState['commercial-street'])) {
        outcome = { ok: false, reason: 'hand-full' }
        return current
      }
      const tableDeliveryPending = shopId === crossShopIds.cafeTakeaway
        && Object.values(current.cafeStoryDeliveries ?? {}).some(record => record.deliveryKind === 'table' && record.order.id === current.shopOrders?.[shopId]?.id && record.presentation === 'pending')
      if (tableDeliveryPending) return current
      const kind = shopId === crossShopIds.yonghe ? 'meal' : 'drink'
      const result = claimCrossShopOrder({ ordersByShop: current.shopOrders, heldConsumable: current.heldConsumable }, shopId, nowGameTimeMs, kind)
      outcome = result
      if (!result.ok) return current
      const updated = { ...current, shopOrders: result.state.ordersByShop, heldConsumable: result.state.heldConsumable, shopOrderHistory: appendShopOrderHistory(current.shopOrderHistory, current.shopOrders?.[shopId], nowGameTimeMs) }
      return shopId === crossShopIds.cafeTakeaway
        ? recordPlayerSceneStatePatch(updated, 'commercial-street', { [commercialCafeTableDeliverySeatKey]: null })
        : updated
    })
    if (outcome?.ok) return true
    if (shopId === crossShopIds.cafeTakeaway && Object.values(playerSaveRef.current.cafeStoryDeliveries ?? {}).some(record => record.deliveryKind === 'table' && record.presentation === 'pending')) {
      setBoundaryNotice('咖啡正在送到座位，请稍等。')
      return false
    }
    if (outcome?.reason === 'hand-full') setBoundaryNotice('\u624b\u91cc\u8fd8\u6709\u4e1c\u897f\uff0c\u6682\u65f6\u62ff\u4e0d\u4e86\u3002')
    else if (outcome?.reason === 'not-ready') setBoundaryNotice('\u996e\u54c1\u8fd8\u5728\u5236\u4f5c\u4e2d\uff0c\u7a0d\u540e\u518d\u6765\u53d6\u5427\u3002')
    else setBoundaryNotice('\u73b0\u5728\u6ca1\u6709\u53ef\u4ee5\u9886\u53d6\u7684\u8ba2\u5355\u3002')
    return false
  }, [commitPlayerSave])

  const consumeShopHeldItem = useCallback(() => {
    commitPlayerSave(current => {
      if (!current.heldConsumable && commercialStreetMilkTeaHeld(current.sceneState['commercial-street'])) {
        return recordPlayerSceneStatePatch(current, 'commercial-street', commercialStreetMilkTeaConsumePatch())
      }
      const result = consumeHeldConsumable({ ordersByShop: current.shopOrders, heldConsumable: current.heldConsumable })
      if (!result.ok) return current
      return { ...current, shopOrders: result.state.ordersByShop, heldConsumable: null }
    })
  }, [commitPlayerSave])

  const handleCommerceEntity = useCallback((entity) => {
    const serviceCopy = shopServiceCopy(drinkOrderingAppUnlocked ? 'unlocked' : 'not-unlocked')
    const useShopCounter = (shopId) => {
      const order = playerSaveRef.current.shopOrders?.[shopId]
      const nowGameTimeMs = sessionGameClockRef.current.read().gameTimeMs
      if (playerSaveRef.current.heldConsumable || commercialStreetMilkTeaHeld(playerSaveRef.current.sceneState['commercial-street'])) return { text: serviceCopy.heldFull }
      if (order?.status === 'queued' && order.readyAtGameTimeMs !== null && nowGameTimeMs >= order.readyAtGameTimeMs) {
        const claimed = claimShopOrder(shopId)
        return claimed ? { text: serviceCopy.pickup } : true
      }
      return { text: order?.status === 'legacy-unmapped' ? '这个旧订单没有可领取的订单号。' : serviceCopy.orderPending }
    }
    const routeDrinkShopCounter = (shopId) => {
      // With no existing order, let the physical worker/counter start the
      // shared welcome and recommendation dialogue. Active orders stay on
      // the existing app/pickup path, including ready claims.
      if (!playerSaveRef.current.shopOrders?.[shopId]) {
        if (playerSaveRef.current.heldConsumable || commercialStreetMilkTeaHeld(playerSaveRef.current.sceneState['commercial-street'])) return { text: serviceCopy.heldFull }
        return false
      }
      return useShopCounter(shopId) ?? true
    }
    if (entity.id === 'commercial-s5-milk-tea-order-service-label' || entity.id === 'milk-tea-trial-long-counter-0') {
      return routeDrinkShopCounter(crossShopIds.milkTea)
    }
    if (entity.id === 'commercial-s5-milk-tea-app-square') {
      if (storeOrderEntryRoute('explicit-app-entry') === 'open-phone-app') openShopOrderApp(crossShopIds.milkTea)
      return true
    }
    if (entity.id === 'fruit-tea-trial-order' || entity.id === 'fruit-tea-trial-long-counter-0') {
      return routeDrinkShopCounter(crossShopIds.fruitTea)
    }
    if (entity.id === 'fruit-tea-trial-app-square') {
      if (storeOrderEntryRoute('explicit-app-entry') === 'open-phone-app') openShopOrderApp(crossShopIds.fruitTea)
      return true
    }
    if (entity.id === 'commercial-cafe-app-square') {
      if (storeOrderEntryRoute('explicit-app-entry') === 'open-phone-app') openShopOrderApp(crossShopIds.cafeTakeaway)
      return true
    }
    if (entity.id === 'yonghe-counter') {
      const order = playerSaveRef.current.shopOrders?.[crossShopIds.yonghe]
      const gameTimeMs = sessionGameClockRef.current.read().gameTimeMs
      if (order?.status === 'queued' && order.readyAtGameTimeMs !== null && gameTimeMs >= order.readyAtGameTimeMs) {
        if (playerSaveRef.current.heldConsumable || commercialStreetMilkTeaHeld(playerSaveRef.current.sceneState['commercial-street'])) return { text: '手里还有东西，拿不了这么多。' }
        claimShopOrder(crossShopIds.yonghe)
        return true
      }
      if (order?.status === 'queued') return { text: '还没好，再等会儿。' }
      // With no active order the player starts through the owner's opening,
      // then chooses ordering or recommendation. The phone QR remains a
      // separate shortcut inside the unified app.
      return false
    }
    if (entity.id === 'commercial-cafe-counter') {
      const order = playerSaveRef.current.shopOrders?.[crossShopIds.cafeTakeaway]
      const gameTimeMs = sessionGameClockRef.current.read().gameTimeMs
      if ((playerSaveRef.current.heldConsumable || commercialStreetMilkTeaHeld(playerSaveRef.current.sceneState['commercial-street'])) && order) return { text: serviceCopy.heldFull }
      if (order?.status === 'queued' && order.readyAtGameTimeMs !== null && gameTimeMs >= order.readyAtGameTimeMs) {
        return claimShopOrder(crossShopIds.cafeTakeaway) ? { text: serviceCopy.pickup } : true
      }
      if (order) return { text: serviceCopy.orderPending }
      if (playerSaveRef.current.heldConsumable || commercialStreetMilkTeaHeld(playerSaveRef.current.sceneState['commercial-street'])) return { text: serviceCopy.heldFull }
      return { text: commercialShopWelcomeCopy, options: ['\u70b9\u5355', '\u6709\u4ec0\u4e48\u63a8\u8350\uff1f', '\u6211\u518d\u770b\u770b\u5427'] }
    }
    return false
  }, [claimShopOrder, drinkOrderingAppUnlocked, openShopOrderApp])

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
    if (!milkTeaOrder || playerSave.shopOrders[crossShopIds.milkTea]) { milkTeaReadyAnalyticsMarkerRef.current = null; return }
    const remaining = milkTeaOrder.readyAt - Date.now()
    if (remaining <= 0) { handleMilkTeaOrderReady(milkTeaOrder); return }
    // The order deadline owns readiness even when its app and Phone are closed.
    const timer = window.setTimeout(() => saveLifecycle.run(() => handleMilkTeaOrderReady(milkTeaOrder)), remaining)
    const unsubscribe = saveLifecycle.onStop(() => window.clearTimeout(timer))
    return () => { unsubscribe(); window.clearTimeout(timer) }
  }, [handleMilkTeaOrderReady, milkTeaOrder?.number, milkTeaOrder?.readyAt, playerSave.shopOrders])

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
    // Location entry is reported from the actual runtime position, not a door click or route intent.
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
  const handleSceneConversationActiveChange = useCallback((active) => {
    setSceneDialogueActive(active)
  }, [])

  const handleClockActivitySourceChange = useCallback((sourceId, source) => {
    const snapshot = sessionGameClockRef.current.setActivitySource(sourceId, source)
    setTrialClockSnapshot(snapshot)
  }, [])
  const readSessionGameTimeMs = useCallback(() => sessionGameClockRef.current.read().gameTimeMs, [])
  useEffect(() => installHistoryClock(readSessionGameTimeMs), [readSessionGameTimeMs])
  const cafeStoryOrderDelivery = useMemo(() => createCafeStoryOrderDeliveryController({
    readSave: () => playerSaveRef.current,
    commitSave: update => commitPlayerSave(update),
    readGameTimeMs: readSessionGameTimeMs,
  }), [commitPlayerSave, readSessionGameTimeMs, playerSave.shopOrders, playerSave.cafeStoryDeliveries, playerSave.phoneNotifications])

  useEffect(() => {
    const sessionClock = sessionGameClockRef.current
    const detachVisibilityLifecycle = attachSessionGameClockVisibilityLifecycle(sessionClock, snapshot => saveLifecycle.run(() => setTrialClockSnapshot(snapshot)))
    const recordTrustedInput = (event) => {
      if (!event.isTrusted || !saveLifecycle.canPersist()) return
      setTrialClockSnapshot(sessionClock.markInput())
    }
    const inputEvents = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'click']
    inputEvents.forEach((name) => window.addEventListener(name, recordTrustedInput, true))
    const timer = window.setInterval(() => {
      if (!saveLifecycle.canPersist()) return
      const next = sessionClock.read()
      setTrialClockSnapshot((current) => {
        const minuteChanged = Math.floor(current.gameTimeMs / 60_000) !== Math.floor(next.gameTimeMs / 60_000)
        return minuteChanged || current.activityMode !== next.activityMode || current.idle !== next.idle || current.multiplier !== next.multiplier
          ? next
          : current
      })
    }, 250)
    const saveTimer = window.setInterval(() => gameTimeSaveCheckpointRef.current(), 10_000)
    const cancel = () => {
      inputEvents.forEach((name) => window.removeEventListener(name, recordTrustedInput, true))
      window.clearInterval(timer)
      window.clearInterval(saveTimer)
      detachVisibilityLifecycle()
    }
    const unsubscribe = saveLifecycle.onStop(cancel)
    return () => {
      unsubscribe(); cancel()
      gameTimeSaveCheckpointRef.current()
    }
  }, [saveLifecycle])

  const handleMeaningfulActivity = useCallback(() => {
    markSessionActivity()
  }, [])

  useEffect(() => {
    setBoundaryNotice('')
    setResumeSceneId(null)
    setResumePosition(undefined)
    if (route.spawnMode === 'ride' || route.entryPosition) return
    setResumePosition(loadPlayerSave(runtimeStorage, route.sceneId).scenePositions[route.sceneId])
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
    commitPlayerSave((current) => {
      if (patch.laoZhouConversationTriggered === true) {
        const next = recordPlayerSceneStatePatch(current, sceneId, patch)
        return recordPlayerSceneStatePatch(next, 'commercial-street', { laoZhouConversationTriggered: true, laoZhouTriggerEvidenceVersion: 1, laoZhouOpeningPromptStatus: 'suppressed' })
      }
      if (sceneId !== 'commercial-cafe' || patch[commercialCafeStoryStatusKey] !== 'complete') {
        return recordPlayerSceneStatePatch(current, sceneId, patch)
      }
      const storyPatch = commercialCafeCompletionPhoneStoryPatch(current.sceneState[sceneId], patch)
      return recordPlayerSceneStatePatch(current, sceneId, storyPatch)
    })
  }, [commitPlayerSave])

  const acknowledgeCafeStoryMessagesDisplayed = useCallback(() => {
    commitPlayerSave(current => {
      const street = current.sceneState['commercial-street'] ?? {}
      let next = current
      if (street.laoZhouOpeningPromptStatus === 'pending' && typeof street.laoZhouOpeningPromptTime === 'string') {
        next = recordPlayerSceneStatePatch(next, 'commercial-street', { laoZhouOpeningPromptStatus: 'displayed', [laoZhouArrivalTimeKey]: street.laoZhouOpeningPromptTime })
      }
      const patch = commercialCafeCompletionPhoneDisplayedPatch(next.sceneState['commercial-cafe'])
      return patch ? recordPlayerSceneStatePatch(next, 'commercial-cafe', patch) : next
    })
  }, [commitPlayerSave])

  const handleSceneTransition = useCallback((nextSceneId, nextEntryPosition, nextSpawnMode, transitionIntent) => {
    if (nextSceneId === 'commercial-cafe') { nextSceneId = 'commercial-street'; nextEntryPosition = legacyCafeEntryPosition(nextEntryPosition) }
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
    // Real-time location ledger closes the old visit when the new runtime position arrives.
    if (route.sceneId === 'commercial-street' && nextSceneId === 'commercial-cafe') {
      trackEvent('cafe_entered', { sceneId: nextSceneId })
    }
    sceneEnteredAtRef.current = null
    commitPlayerSave((current) => {
      let next = {
        ...current,
        currentSceneId: nextSceneId,
        currentPosition: nextEntryPosition
          ?? (nextRoute.spawnMode === 'ride' ? mainlineScenes[nextSceneId].rideArrivalPosition : current.scenePositions[nextSceneId])
          ?? null,
      }
      const cafeState = { ...current.sceneState['commercial-street'], ...current.sceneState['commercial-cafe'] }
      const departure = commercialCafeDepartureOnTransition(cafeState, route.sceneId, nextSceneId)
      if (departure) next = recordPlayerSceneStatePatch(next, 'commercial-cafe', departure)
      const ruoyuDeparture = ruoyuCafeDepartureOnTransition(cafeState, route.sceneId, nextSceneId)
      if (ruoyuDeparture) next = recordPlayerSceneStatePatch(next, 'commercial-cafe', ruoyuDeparture)
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

  useEffect(() => {
    if (!debugClockTrial || !hasSyntheticClockTrialStorage()) return
    const handleClockTrialTransition = event => {
      if (!hasSyntheticClockTrialStorage() || event.detail?.sceneId !== 'jijia-ancestral-interior') return
      handleSceneTransition('jijia-ancestral-interior')
    }
    window.addEventListener('newtone:e2e-clock-transition', handleClockTrialTransition)
    return () => window.removeEventListener('newtone:e2e-clock-transition', handleClockTrialTransition)
  }, [debugClockTrial, handleSceneTransition])

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
    setPhonePanelRetracted(true)
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

  const handleObjectInteraction = useCallback(() => {}, [])
  const handleDoorEvent = useCallback((phase, passage) => {
    if (phase === 'attempted') { handleMeaningfulActivity(); return }
    if(phase==='crossed')getInteractionSessions().instant({objectId:passage.entityId,objectKind:'door',contentId:passage.id},'completed')
    else if(phase==='blocked')completedInteractionCandidatesRef.current.set(passage.entityId,{objectId:passage.entityId,objectKind:'door',contentId:passage.id,result:'blocked'})
  }, [handleMeaningfulActivity])
  const handleInteractionAnalytics = useCallback((phase, objectId, objectKind, outcome) => {
    const key = `${route.sceneId}/${objectId}`
    const interactions=getInteractionSessions()
    if(phase==='requested') { handleMeaningfulActivity();pendingInteractionRequestsRef.current.set(key,true);return }
    if(phase==='ended') { interactions.finish(objectKind==='seat' ? 'seat' : `fixture:${objectId}`,outcome ?? 'completed');return }
    if(phase==='blocked') {
      if(pendingInteractionRequestsRef.current.delete(key))completedInteractionCandidatesRef.current.set(objectId,{objectId,objectKind,contentId:objectId,result:'blocked'})
      return
    }
    if(!pendingInteractionRequestsRef.current.delete(key))return
    if(objectKind==='choice')return // The already-active display owns its entire options chain.
    if(objectKind==='seat' || objectKind==='fixture') {
      interactions.begin(objectKind==='seat' ? 'seat' : `fixture:${objectId}`,objectId,{objectId,objectKind,contentId:objectId})
    } else completedInteractionCandidatesRef.current.set(objectId,{objectId,objectKind,contentId:objectId})
  }, [handleMeaningfulActivity, route.sceneId])
  const handleInteractionDisplay = useCallback(info => {
    const interactions=getInteractionSessions()
    if(info.active && info.objectId) {
      const candidate=completedInteractionCandidatesRef.current.get(info.objectId)
      interactions.begin('display',info.key,{objectId:info.objectId,objectKind:candidate?.objectKind ?? info.objectKind,contentId:info.contentId,sceneId:info.sceneId,roomId:info.roomId})
      if(candidate?.result)interactions.annotate('display',candidate.result)
      if(info.result==='cancelled')interactions.annotate('display','cancelled')
      completedInteractionCandidatesRef.current.delete(info.objectId)
    } else interactions.finish('display',info.result ?? 'completed')
    if(info.seatId)interactions.begin('seat',info.seatId,{objectId:info.seatId,objectKind:'seat',contentId:info.seatId,sceneId:info.sceneId,roomId:info.roomId})
    else interactions.finish('seat')
    const facts=pendingBusinessFactsRef.current.splice(0)
    if(info.active)for(const fact of facts)interactions.annotate('display',fact.outcome)
    const candidates=[...completedInteractionCandidatesRef.current.values()]
    if(!info.active) {
      if(candidates.length)for(const candidate of candidates)interactions.instant(candidate,candidate.result ?? facts.at(-1)?.outcome ?? 'completed')
      else for(const fact of facts)interactions.instant({objectId:fact.objectId,objectKind:fact.objectKind,contentId:fact.objectId},fact.outcome)
    }
    completedInteractionCandidatesRef.current.clear()
  }, [])

  const boardRide = useCallback((order) => {
    const intent = mainlineLongDistanceTravelIntentForRide(order.sourceSceneId, order.targetSceneId)
    if (!intent) return
    setRideOrder(null)
    readPhoneApp('ride')
    recordSceneStatePatch(order.sourceSceneId, mainlineRideOrderPatch(null))
    setFeedbackMode(null)
    setBoundaryNotice('')
    rideBoardingHandoffRef.current = true
    setLongDistanceTravel({ phase: phoneRetractedRef.current ? 'scene-fading' : 'phone-retracting', intent, targetReady: false })
    setPhoneOpen(false)
  }, [readPhoneApp, recordSceneStatePatch])
  rideBoardingRef.current = (sceneId, position, context) => {
    if (!sceneReadingActiveRef.current && rideOrder && Date.now() >= rideOrder.driverArrivesAt && mainlineRideAtPickup(rideOrder, sceneId, position)) boardRide(rideOrder)
  }
  useEffect(() => {
    if (!rideOrder || route.sceneId !== rideOrder.sourceSceneId) return
    const arrived = () => {
      if (!saveLifecycle.canPersist()) return
      notifyPhone({ id: 'ride:' + rideOrder.sourceSceneId + ':' + rideOrder.targetSceneId + ':' + rideOrder.driverArrivesAt, app: 'ride', title: '司机已到达', body: '请前往上车点' })
      const current = latestWorldPositionRef.current
      if (current) rideBoardingRef.current(current.sceneId, current.position, current.context)
    }
    const timer = window.setTimeout(arrived, Math.max(0, rideOrder.driverArrivesAt - Date.now()))
    const unsubscribe = saveLifecycle.onStop(() => window.clearTimeout(timer))
    return () => { unsubscribe(); window.clearTimeout(timer) }
  }, [notifyPhone, rideOrder, route.sceneId])
  const handleRideRequest = useCallback((device, destinationSceneId, presentation) => {
    if (rideOrder) return { ok: false, reason: '已有进行中的订单' }
    if (phoneRideAvailability(device, worldLayerForScene(route.sceneId)) !== 'available') return { ok: false, reason: '当前手机无法使用叫车服务' }
    const zone = mainlineRideZone(route.sceneId)
    const intent = zone && mainlineLongDistanceTravelIntentForRide(zone.pickupSceneId, destinationSceneId)
    const current = latestWorldPositionRef.current
    if (!intent) return { ok: false, reason: '此目的地暂时无法叫车前往' }
    if (current?.sceneId !== route.sceneId) return { ok: false, reason: '当前位置尚未就绪，请稍后重试' }
    const etaMs = mainlineRideWalkingEtaMs(route.sceneId, current.position, current.context)
    if (etaMs === null) return { ok: false, reason: '暂时无法找到通往上车点的路线，请换一个位置重试' }
    const requestedAt = Date.now()
    const order = { sourceSceneId: zone.pickupSceneId, targetSceneId: destinationSceneId, driverArrivesAt: requestedAt + Math.ceil(etaMs), requestedAt, ...presentation }
    trackEvent('center_ride_ready', { sceneId: route.sceneId, destinationSceneId, device, outcome: 'ready' })
    if (etaMs === 0 && mainlineRideAtPickup(order, route.sceneId, current.position)) boardRide(order)
    else {
      recordSceneStatePatch(order.sourceSceneId, mainlineRideOrderPatch(order))
      setRideOrder(order)
    }
    return { ok: true }
  }, [boardRide, recordSceneStatePatch, rideOrder, route.sceneId])

  const canPersistScenePosition = Boolean(
    route.entryPosition
      || route.spawnMode === 'ride'
      || resumeSceneId === route.sceneId,
  )
  const handlePositionChange = useCallback((position) => {
    if (!canPersistScenePosition) return
    positionSaveCoordinatorRef.current.queue(route.sceneId, position)
  }, [canPersistScenePosition, route.sceneId])

  const flushPositionSave = useCallback((sceneId) => {
    positionSaveCoordinatorRef.current.flush(sceneId)
  }, [])

  useEffect(() => {
    const detach = attachPositionSaveLifecycle(
      flushPositionSave,
      () => route.sceneId,
      undefined,
      undefined,
      () => gameTimeSaveCheckpointRef.current(),
      saveLifecycle.canPersist,
    )
    const unsubscribe = saveLifecycle.onStop(detach)
    return () => { unsubscribe(); detach() }
  }, [flushPositionSave, route.sceneId, saveLifecycle])

  const cafeClockInsideRef = useRef(false)
  const handleRuntimePositionChange = useCallback((sceneId, position, context) => {
    const insideCafe = sceneId === 'commercial-street' && isPointInContinuousCafe(mainlineScenes[sceneId], position)
    if (insideCafe && !cafeClockInsideRef.current) {
      commitPlayerSave(current => {
        const storyClock = advanceMainlineStoryClock(current.storyClock, 'commercial-cafe')
        return storyClock === current.storyClock ? current : { ...current, storyClock, phoneNotes: advancePhoneStoryNotes(current.phoneNotes, storyClock.stage) }
      })
    }
    cafeClockInsideRef.current = insideCafe
    setAnalyticsLocation(sceneId, mainlineSceneRoomAtPosition(mainlineScenes[sceneId], position)?.id ?? 'unassigned')
    latestWorldPositionRef.current = { sceneId, position, context }
    rideBoardingRef.current(sceneId, position, context)
    if (sceneId === 'commercial-street') {
      const wasOutsideCafe = cafeHandoffOutsideRef.current
      cafeHandoffOutsideRef.current = !insideCafe
      const pending = playerSaveRef.current.sceneState['commercial-cafe']?.[commercialCafeCompletionPhonePendingKey] === true
      if (pending && !insideCafe && wasOutsideCafe !== true) setCafeHandoffPositionRevision(value => value + 1)
    }
    positionSamplerRef.current?.sample(sceneId, position)
  }, [commitPlayerSave])

  useEffect(() => {
    if (longDistanceTravel === null) rideBoardingHandoffRef.current = false
    if (route.sceneId !== 'commercial-street') return
    const position = latestWorldPositionRef.current
    if (!position || position.sceneId !== 'commercial-street') return
    const cafeState = playerSave.sceneState['commercial-cafe']
    const insideCafe = isPointInContinuousCafe(mainlineScenes['commercial-street'], position.position)
    if (!commercialCafeCompletionPhoneCanRequest(cafeState, {
      insideCafe,
      phoneDevice,
      readingActive: sceneReadingActive,
      phoneOpen,
      phoneRetracted: phonePanelRetracted && phoneRetractedRef.current,
      traveling: longDistanceTravel !== null,
      rideBoarding: rideBoardingHandoffRef.current,
    })) return
    setPhoneNotificationScreen(false)
    setRequestedPhoneApp('lao-zhou-messages')
    setPhoneOpen(true)
  }, [cafeHandoffPositionRevision, longDistanceTravel, phoneDevice, phoneOpen, phonePanelRetracted, playerSave.sceneState, route.sceneId, sceneReadingActive])

  useEffect(() => {
    if (entryPhase !== 'active' || route.sceneId !== 'commercial-street') return
    if (phoneDevice !== 'inner' || sceneReadingActive || phoneOpen || longDistanceTravel !== null) return
    if (!laoZhouArrivalShouldDeliver(playerSave.sceneState['commercial-street'], playerSave.sceneState['commercial-cafe'])) return
    commitPlayerSave(current => recordPlayerSceneStatePatch(current, 'commercial-street', { laoZhouOpeningPromptTime: current.sceneState['commercial-street']?.laoZhouOpeningPromptTime ?? current.sceneState['commercial-street']?.[laoZhouArrivalTimeKey] ?? formatTrialGameTime(trialClockSnapshot.gameTimeMs) }))
    setPhoneNotificationScreen(false)
    setRequestedPhoneApp('lao-zhou-messages')
    setPhoneOpen(true)
  }, [commitPlayerSave, entryPhase, longDistanceTravel, phoneDevice, phoneOpen, playerSave.sceneState, route.sceneId, sceneReadingActive, trialClockSnapshot.gameTimeMs])

  const handlePlayerMovementStateChange = useCallback((moving) => {
    setCenterMovementActive(moving)
    if (!moving) flushPositionSave(route.sceneId)
  }, [flushPositionSave, route.sceneId])

  const renderScenePage = (sceneRoute, {
    key,
    showProtagonist = true,
    snapshot = false,
    resumePosition: sceneResumePosition = resumePosition,
  } = {}) => (
    <MainlineScenePage
      key={key ?? `${sceneRoute.sceneId}:${sceneRoute.entryPosition?.x ?? ''}:${sceneRoute.entryPosition?.y ?? ''}:${sceneRoute.spawnMode}:${sceneResumePosition?.x ?? ''}:${sceneResumePosition?.y ?? ''}`}
      sceneId={sceneRoute.sceneId}
      cafeStoryOrderDelivery={snapshot ? undefined : cafeStoryOrderDelivery}
      laoZhouCafeSeatId={playerSave.laoZhouCafeSeatId}
      onExternalExit={snapshot ? undefined : () => {
        const current = latestWorldPositionRef.current
        if (current && mainlineRideSuppressExternalPhoneReveal(rideOrder, current.sceneId, current.position)) return
        const cafeState = playerSaveRef.current.sceneState['commercial-cafe']
        if (current?.sceneId === 'yonghe-mining-perimeter' && cafeState?.[commercialCafeStoryStatusKey] === 'complete') {
          const patch = ruoyuCafeMineExitPatch(cafeState, playerSaveRef.current.laoZhouCafeSeatId)
          if (patch) {
            commitPlayerSave(save => recordPlayerSceneStatePatch(save, 'commercial-cafe', patch))
            setPhoneNotificationScreen(false)
            setRequestedPhoneApp('ruoyu-messages')
            setPhoneOpen(true)
            return
          }
        }
        revealPhone()
      }}
      onExternalReturn={snapshot ? undefined : retractPhone}
      onSceneReady={snapshot ? undefined : handleSceneReady}
      presentationReady={!snapshot && entryPhase === 'active' && !longDistanceTravel}
      phoneOpen={phoneOpen}
      onPhoneDismiss={snapshot ? undefined : retractPhone}
      onReadingStateChange={snapshot ? undefined : handleSceneReadingStateChange}
      onConversationDisplayActiveChange={snapshot ? undefined : handleSceneConversationActiveChange}
      onClockActivitySourceChange={snapshot ? undefined : handleClockActivitySourceChange}
      readGameTimeMs={readSessionGameTimeMs}
      shopOrders={playerSave.shopOrders}
      gameTimeMs={trialClockSnapshot.gameTimeMs}
      onMeaningfulActivity={snapshot ? undefined : handleMeaningfulActivity}
      onPlayerMovementStateChange={snapshot ? undefined : handlePlayerMovementStateChange}
      onRuntimePositionChange={snapshot ? undefined : handleRuntimePositionChange}
      onDeskInteraction={snapshot ? undefined : switchCarriedPhone}
      onObjectInteraction={snapshot ? undefined : handleObjectInteraction}
      onCommerceEntity={snapshot ? undefined : handleCommerceEntity}
      onShopOrderConfirm={snapshot ? undefined : confirmShopOrder}
      onDrinkShopOrderOpen={snapshot ? undefined : (shopId, productId) => openShopOrderApp(shopId, productId)}
      onYongheOrderOpen={snapshot ? undefined : (productId) => openShopOrderApp(crossShopIds.yonghe, productId)}
      yongheOrderFeedback={yongheOrderFeedback}
      yongheReadyCue={yongheReadyCue}
      onDoorEvent={snapshot ? undefined : handleDoorEvent}
      onInteractionAnalytics={snapshot ? undefined : handleInteractionAnalytics}
      onInteractionDisplay={snapshot ? undefined : handleInteractionDisplay}
      onMilkTeaAppOpen={snapshot ? undefined : openMilkTeaApp}
      onStorefrontAction={snapshot ? undefined : (action) => { if (action === 'fruit-tea-order') openShopOrderApp(crossShopIds.fruitTea) }}
      onMilkTeaOrderReady={snapshot ? undefined : handleMilkTeaOrderReady}
      onChapterAnalytics={snapshot ? undefined : trackChapterEvent}
      initialSceneState={sceneRoute.sceneId === 'commercial-street' || sceneRoute.sceneId === 'commercial-cafe' ? cafeWorldSceneState : playerSave.sceneState[sceneRoute.sceneId] ?? {}}
      heldConsumable={resolvedHeldConsumable}
      onConsumeHeldConsumable={snapshot ? undefined : consumeShopHeldItem}
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
      className={`center-experience center-experience--${entryPhase} center-experience--${isStoryNight(trialClockSnapshot.gameTimeMs) ? 'night' : 'day'}`}
      data-center-boundary="inner-phone-ride-ready"
      data-entry-phase={entryPhase}
      data-world-period={isStoryNight(trialClockSnapshot.gameTimeMs) ? 'night' : 'day'}
      data-long-distance-phase={longDistanceTravel?.phase}
      data-e2e-game-time-ms={debugClockTrial ? trialClockSnapshot.gameTimeMs : undefined}
      data-e2e-game-clock-activity={debugClockTrial ? trialClockSnapshot.activity : undefined}
      data-e2e-game-clock-mode={debugClockTrial ? trialClockSnapshot.activityMode : undefined}
      data-e2e-game-clock-multiplier={debugClockTrial ? trialClockSnapshot.multiplier : undefined}
      data-e2e-game-clock-idle={debugClockTrial ? String(trialClockSnapshot.idle) : undefined}
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
          {localSlide && localSlideActor && <div className="scene-protagonist center-local-slide__actor" aria-hidden="true"><span className="scene-protagonist__dot" style={{ transform: `scale(${mainlineWorldScale(currentMainlineViewportMetrics() ?? sceneDesignReferenceMetrics)})` }} /></div>}
        </div>
        <WorldPhone
          getPlayerPosition={() => latestWorldPositionRef.current?.sceneId === route.sceneId ? latestWorldPositionRef.current.position : null}
          getRideMapSnapshot={getRideMapSnapshot}
          currentSceneId={route.sceneId}
          worldLayer={worldLayerForScene(route.sceneId)}
          device={phoneDevice}
          open={phoneOpen}
          dialogueActive={sceneDialogueActive}
          onOpen={revealPhone}
          onClose={retractPhone}
          onCloseComplete={handlePhoneCloseComplete}
          onRideRequest={handleRideRequest}
          rideOrder={rideOrder}
          notifications={playerSave.phoneNotifications}
          storyClock={playerSave.storyClock}
          gameTimeLabel={formatTrialGameTime(trialClockSnapshot.gameTimeMs)}
          notificationScreen={phoneNotificationScreen}
          onNotificationDismiss={() => setPhoneNotificationScreen(false)}
          onAppOpen={readPhoneApp}
          onAppInteraction={handlePhoneAppInteraction}
          milkTeaAppUnlocked={drinkOrderingAppUnlocked}
          ruoyuMessagesUnlocked={playerSave.sceneState['commercial-cafe']?.[ruoyuCafeUnlockedKey] === true}
          availableShopIds={availableDrinkShopIds}
          milkTeaOrder={milkTeaOrder}
          milkTeaHeld={commercialStreetMilkTeaHeld(commercialStreetState)}
          requestedApp={requestedPhoneApp}
          requestedShopId={requestedShopId}
          requestedShopProductId={requestedShopProductId}
          onShopOrderPlaced={handleYongheOrderPlaced}
          onShopOrderReady={handleYongheOrderReady}
          onShopNotificationOpen={openShopOrderApp}
          shopOrders={playerSave.shopOrders}
          shopOrderHistory={playerSave.shopOrderHistory}
          heldConsumable={resolvedHeldConsumable}
          walletBalance={playerSave.walletBalance}
          gameTimeMs={trialClockSnapshot.gameTimeMs}
          preparationConfiguredByShop={{ [crossShopIds.milkTea]: true, [crossShopIds.fruitTea]: true, [crossShopIds.yonghe]: true, [crossShopIds.cafeTakeaway]: true }}
          onShopOrderConfirm={confirmShopOrder}
          onLegacyShopOrderCancel={cancelLegacyShopOrder}
          onRequestedAppHandled={() => { setRequestedPhoneApp(null); setRequestedShopId(null); setRequestedShopProductId(null) }}
          onLaoZhouMessagesDisplayed={acknowledgeCafeStoryMessagesDisplayed}
          laoZhouArrivalLabel={laoZhouArrivalLabel(playerSave.sceneState['commercial-street'])}
          commercialMapGuide={commercialStreetMapGuideActive(route.sceneId, playerSave.sceneState['commercial-cafe'])}
          onMilkTeaOrderConfirm={confirmMilkTeaOrder}
          onMilkTeaOrderStarted={handleMilkTeaOrderStarted}
          feedbackMode={feedbackMode}
          onFeedbackModeChange={handleFeedbackModeChange}
          onFeedbackOpen={handleFeedbackOpen}
          onFeedbackSubmit={handleFeedbackSubmit}
          onMeaningfulActivity={handleMeaningfulActivity}
          onClockActivitySourceChange={handleClockActivitySourceChange}
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
