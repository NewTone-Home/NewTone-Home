'use client'

import { officeBlindsRoomKey, officeRoomBlindsOpen, officeWindowRoom } from './officeRoomLighting'

import { isWallMenuReading } from './menuReading'

import { hasContinuousCafe, isCafeWorldId, isPointInContinuousCafe, isCafeStoryKey, cafeStoryNamespace } from './continuousCafe'
import { cafeRestroomFixtureIds, cafeRestroomFixtureUseDurationMs, cafeRestroomRoomId, isPointInsideCafeRestroom } from './cafeRestroom'

import { isMainlineExternalExitTriggered } from './mainlineExternalExit'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Point } from './sceneGeometry'
import { MainlineAmbientNpcActor, MainlineSceneRenderer, type MainlineInputDiagnostic } from './MainlineSceneRenderer'
import { getMainlineSceneEntity, mainlineEntityDisplayLabel, mainlineSceneAreaLabel, mainlineScenes, mainlineStorefrontInteractionCandidates, type MainlineSceneDefinition, type MainlineSceneEntity, type MainlineSceneId, type MainlineScenePassage } from './mainlineScenes'
import { prepareMainlineWorldNavigation, canActorReachPassageApproach, classifyMainlineWorldCommand, findMainlinePath, findMainlinePathThroughPassage, findMainlinePathToEntity, isMainlineEntityWithinInteractionRange, isMainlineNavigationBarrierClear, isMainlinePassageInTransitZone, isWalkableMainlinePoint, mainlineInteractionTarget, mainlinePassageCollisionForNavigation, mainlinePassageCrossesToSide, mainlinePassageDoorRegion, mainlinePassageDoorwayForNavigation, mainlinePassageExitPoint, mainlinePassageSide, mainlineSafeSpawnValidationDecision, resolveMainlineEntityInteraction, resolveMainlineInteractionCandidates, resolveMainlineStorefrontInteraction, mainlineStorefrontArrivalDecision, resolveMainlineNpcInteraction, resolveMainlineNpcPosition, resolveMainlineSafeEntryPosition, resolveMainlineSafeSpawnPosition, resolveMainlineSeatSitPosition, resolveMainlineWorldNavigation } from './mainlineNavigation'
import { layoutGridSize, mainlineLabelFootprint, mainlineNpcLabelFootprint, mainlineProtagonistDotFootprint, mainlineSceneFootprint, type SceneLayout } from './sceneLayout'
import { clearSceneLayout, loadSceneLayout, persistSceneLayout } from './sceneLayoutPersistence'
import { movementDurationMsForPath, protagonistCharacterMovementOptions, sharedCharacterMovementOptions, useFreeRoamMovement, type FreeRoamMovement } from './useFreeRoamMovement'
import type { PhoneDevice } from './phoneState'
import { crossShopIds, type HeldConsumable } from './crossShopOrders'
import { isTrueMilkTea } from './heldConsumablePresentation'
import { sceneInteractionHandlers } from './sceneInteraction'
import { useAutomaticPassages } from './useAutomaticPassages'
import { defaultSceneScreenMetrics, sceneDesignReferenceMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { useMainlineCamera } from './useMainlineCamera'
import { mainlineWorldScale } from './mainlineViewport'
import { projectCommercialStreetX } from './commercialStreetGridProjection'
import { currentMainlineViewportMetrics, mainlineDeviceProjectionScale, mainlineLegacyAreaProjectionScale, type MainlineViewportMetrics } from './mainlineViewportProjection'
import type { MainlineRideWalkingContext } from './mainlineRide'
import type { MainlineConversationDisplayContent, MainlineConversationDisplayHistoryEntry, MainlineDialogueChoiceWheelPresentation, MainlineSceneChoiceFlow } from './mainlineSceneModel'
import { sceneDoorMotion } from './sceneDoorConfig'
import { sceneFrameGroupsDueForExit, type SceneFocusFrameMotionProfile } from './sceneFrameExitSchedule'
import type { PlayerChoiceValue, PlayerSceneState } from './playerSave'
import { defaultLaoZhouCafeSeatId, laoZhouCafeConversationSeatId, withLaoZhouCafeSeat, withRuoyuCafeSeat } from './commercialCafeSeatSelection'
import { ruoyuCafeConversationSeatId, ruoyuCafeMeetingCompleted, ruoyuCafeMeetingCursorFromSceneState, ruoyuCafeMeetingDialogue, ruoyuCafeMeetingCursorKey, ruoyuCafeMeetingStatusKey, ruoyuCafeSeatFromSceneState, ruoyuCafeUnlockedKey, ruoyuCafeFollowupLine } from './ruoyuCafeMeeting'
import { commercialCafeLaoZhouIsPresent } from './commercialCafeStory'
import { commercialCafeAnalyticsMilestonePatch, commercialCafeAnalyticsMilestonesFromSceneState, commercialCafeAnalyticsStageForCursor, commercialCafeCoffeeDelivered, commercialCafeCoffeeOrderedState, commercialCafeDeliveryDialogueLine, commercialCafeDepartureText, commercialCafeFinishDeliveryLine, commercialCafeFinishDeliveryReturn, commercialCafeNarrativeDialogue, commercialCafeNarrativePhaseKey, commercialCafeNarrativeStarted, commercialCafeStoryCompleted, commercialCafeStoryNeedsMigration, commercialCafeStoryReadyToLeave, commercialCafeStoryStateFromSceneState, commercialCafeStoryStatePatch, commercialCafeStoryWithCursor, isCommercialCafeStoryStage, resolveCommercialCafeNpcInteraction, shouldCompleteCommercialCafeStoryOnTransition, commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId, commercialCafeStoryTableId, type CommercialCafeAnalyticsStage, type CommercialCafeNpcInteractionResolution, type CommercialCafeStoryStage } from './commercialCafeStory'
import { commercialCafeFloorServiceTarget, commercialCafeDutySpeedMultiplier, createCommercialCafeCoffeeOwnerBehaviorCoordinator, createCommercialCafeFloorServerBehaviorCoordinator } from './commercialCafeBehavior'
import { createMainlineSceneGeometrySnapshot, type MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { createNavigationRuntime } from './navigationCore'
import { useNpcMovement } from './useNpcMovement'
import { AmbientNpcMotion } from './AmbientNpcMotion'
import { npcRetryDelay, type NpcRuntimeSnapshot } from './npcCore'
import { npcRoles } from './npcRoles'
import { useStorefrontPresentation } from './useStorefrontPresentation'
import { mainlineDisplaySourceText, mainlineReadingSegmentDisplayText } from './mainlineTextSegments'
import { mainlineDialogueParticipantNpcIds, mainlineReadingActorOpacity, mainlineReadingCameraOffset, mainlineReadingOpacityForActor, mainlineMaximumReadingWidthPx } from './mainlineTextReading'
import { createMainlineReadingSessionLayoutCache, mainlineReadingMeasurementKey } from './mainlineReadingLayoutSession'
import { cancelMainlineSceneActionExit, commitMainlineSceneActionExit, completeMainlineSceneActionOptionExit, createMainlineSceneActionExitBarrier, mainlineSceneActionExitMayUnmount, resolveMainlineSceneActionCancellation, type MainlineSceneActionExitBarrier } from './mainlineSceneActionExit'
import type { MainlineReadingSessionLayoutCache } from './mainlineReadingLayoutSession'
import { useMainlineReadingFontRevision } from './useMainlineReadingFontRevision'
import { sceneTextPresentationPosition } from './sceneTextPresentation'
import { mainlineInteractionRoom, mainlineInteractionSpace, mainlineIsInteriorSpace } from './mainlineTextReading'
import { mainlineDialogueHandoffDurationMs, mainlineDialogueShouldHandoff, mainlineDialogueSpeakerActorId, mainlineDialogueSpeakerOutsidePosition } from './mainlineDialogueStage'
import { incenseBurnPhase, incenseBurnRemainingMs, initializeOfficePlants, mainlineExplorationChoiceIsActionOnly, plantIsWatered, resolveMainlineSceneEchoChoice, resolveMainlineSceneExploration, type IncenseBurnPhase } from './mainlineSceneInteractions'
import { nextMainlinePlayerSeatId, mainlineSceneOccupiedSeatIds } from './mainlineSeating'
import { mainlineNpcStagedSeatId } from './mainlineNpcStaging'
import { mainlineExploredObjectIdsFromSceneState, mainlineInteractionCompletesImmediately, mainlineInteractionExploredStateKey } from './mainlineInteractionVisualState'
import { mainlineActiveSpatialSpaceId, mainlineEntityBelongsToActiveSpace } from './mainlineSceneModel'
import { localSlideDirectionForCrossing, shouldUseLocalSlideForPassage, type MainlineWalkingPassageTransitionIntent } from './mainlineSceneTransition'
import { createCommercialStreetStorefrontExecutionRuntime, createCommercialStreetStorefrontInteractionRuntime, commercialStreetStorefrontInteractionFor, executeCommercialStreetStorefrontInteraction, type CommercialStreetStorefrontAction } from './commercialStreetStorefrontInteractions'
import { commercialStreetQuestionDialoguePosition, commercialStreetQuestionNarrativeAnchor, commercialStreetQuestionNarrativeCompleted, commercialStreetQuestionNarrativeCompletedKey, commercialStreetQuestionNarrativeLines, commercialStreetQuestionNarrativeShouldTrigger, nextCommercialStreetQuestionNarrative, type CommercialStreetQuestionNarrativeState } from './commercialStreetQuestionNarrative'
import { commercialStreetMilkTeaConsumePatch, commercialStreetMilkTeaAppUnlockPatch, commercialStreetMilkTeaAppUnlocked, commercialStreetMilkTeaHeld, commercialStreetMilkTeaIsReady, commercialStreetMilkTeaOrderFromSceneState, commercialStreetMilkTeaPickupPatch, commercialStreetMilkTeaStorefrontId, formatCommercialStreetMilkTeaOrderNumber, type CommercialStreetMilkTeaOrder } from './commercialStreetMilkTea'
import { commercialStreetCafeAppUnlockPatch, commercialStreetCafeAppUnlocked, commercialStreetFruitTeaAppUnlockPatch, commercialStreetFruitTeaAppUnlocked } from './commercialStreetShopApps'
import type { SessionGameActivitySource } from './sessionGameClock'
import { mainlineReadingSessionTextIsFinal, mainlineReadingTextMotionAfterAdvance, mainlineReadingTextMotionAfterAnimation, mainlineReadingTextMotionCompletionMatches, type MainlineReadingTextMotion } from './mainlineReadingTextMotion'
import { yongheMenuForChoice, yongheMenuText, yongheTakeawayCatalog } from './yongheTakeawayCatalog'
import { commercialStreetDrinkShopDialogue, commercialStreetDrinkShopForInteraction, recommendedCommercialStreetDrink } from './commercialStreetDrinkCatalog'
import type { CafeStoryOrderStatus } from './cafeStoryOrderDelivery'

const emptyExternalStoreSubscribe = () => () => undefined
const emptyLayoutSnapshot: SceneLayout = {}
const emptyExplorationObjectIds: ReadonlySet<string> = new Set()
const restroomPresentationSuppressionForSeatedPlayer: ReadonlySet<string> = new Set(['cafe-restroom-sign'])
// Non-Café scenes still render this page. Keep their inactive story reference
// stable so transient save writes (for example a ride arrival position) do not
// repeatedly recreate the NPC registration and presentation dependencies.
const inactiveCommercialCafeStory = commercialCafeStoryStateFromSceneState(undefined)
const commercialCafeLaoZhouDeliveryEventId = 'commercial-cafe-lao-zhou-after-line-2'
function isYongheTakeawayScene(sceneId: string) {
  return sceneId === 'yonghe-eatery' || sceneId === 'yonghe-mining-perimeter'
}
type NpcDialogueResolution = Extract<CommercialCafeNpcInteractionResolution, { kind: 'dialogue' }>
type CafeStoryOrderDeliveryBridge = {
  status: (eventId: string) => CafeStoryOrderStatus
  begin: (eventId: string) => { ok: true } | { ok: false }
  completePresentation: (eventId: string) => void
  beginTableDelivery: (seatId: string) => { ok: boolean; record?: { order: { id: string }; seatId?: string } } | null
  retargetTableDelivery: (seatId: string | null) => void
  tableDelivery: () => { orderId: string; seatId: string } | null
  completeTableDelivery: (orderId: string, seatId: string) => void
}
const debugClockTrialNpcDialogue: NpcDialogueResolution = {
  kind: 'dialogue',
  dialogue: {
    triggerEntityId: 'e2e-clock-formal-dialogue',
    lines: [
      { id: 'e2e-clock-formal-dialogue-0', speaker: '\u8001\u5468', text: 'Clock integration dialogue test.' },
      { id: 'e2e-clock-formal-dialogue-1', speaker: '\u8001\u5468', text: 'Clock integration dialogue continues.' },
    ],
  },
}
type CommercialCafeNarrativeRuntime = { phase: 'active' | 'coffee-delivery' | 'delivery-line' | 'coffee-returning' | 'leaving' }
function commercialCafeNarrativeRuntimeFromSceneState(sceneId: MainlineSceneId, sceneState: PlayerSceneState, inside = true): CommercialCafeNarrativeRuntime | null {
  if (!isCafeWorldId(sceneId) || !inside) return null
  const saved = commercialCafeStoryStateFromSceneState(sceneState)
  if (saved.status === 'ready-to-leave') return { phase: 'leaving' }
  if (saved.status !== 'available' || saved.narrativePhase === 'not-started' || saved.narrativePhase === 'complete') return null
  if (saved.narrativePhase === 'coffee-delivery') {
    return { phase: saved.coffeeStatus === 'delivered' && saved.narrativeCursor === 1 ? 'delivery-line' : 'coffee-delivery' }
  }
  if (saved.narrativePhase === 'coffee-returning') return { phase: 'coffee-returning' }
  return { phase: 'active' }
}
type CafeSpatialQaNavigation = {
  requestedTarget: Point
  resolvedNavigableTarget: Point
  path: readonly Point[]
  reachedRequestedTarget: boolean
  deniedAccessRegionId?: string
}
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
const getDebugInputSnapshot = () => typeof window === 'undefined' ? '' : window.location.search
const getServerDebugInputSnapshot = () => ''
const cachedMainlineLayouts = new Map<string, { href: string; layout: SceneLayout }>()

function getMainlineLayoutSnapshot(sceneId: string) {
  if (typeof window === 'undefined') return emptyLayoutSnapshot
  const href = window.location.href
  const cached = cachedMainlineLayouts.get(sceneId)
  if (cached?.href === href) return cached.layout
  const layout = loadSceneLayout(sceneId)
  cachedMainlineLayouts.set(sceneId, { href, layout })
  return layout
}

function getServerMainlineLayoutSnapshot() {
  return emptyLayoutSnapshot
}


function initialPositionForEntry(scene: MainlineSceneDefinition, sceneId: MainlineSceneId, entryPosition?: Point, spawnMode: 'resume' | 'ride' = 'resume', resumePosition?: Point) {
  void sceneId
  if (entryPosition) return entryPosition
  if (spawnMode === 'ride') return scene.rideArrivalPosition
  return resumePosition ?? scene.initialPlayerPosition
}

function samePoint(first: Point, second: Point) {
  return Math.abs(first.x - second.x) < .001 && Math.abs(first.y - second.y) < .001
}

/** DEV/e2e-only, non-persistent spawn for real browser movement probes. */
function debugCafePoint(value: string | null): Point | null {
  if (!value) return null
  const [rawX, rawY] = value.split(',')
  const x = Number(rawX)
  const y = Number(rawY)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

type MainlineSceneEcho = {
  id: number
  conversationDisplaySessionId?: string
  clockActivitySource: 'scene-observation' | 'menu-reading' | 'counter-observation' | 'plant-observation'
  entityId?: string
  sourceText: string
  text: string
  segments: readonly string[]
  segmentIndex: number
  position: Point
  options?: readonly string[]
  optionFlow?: MainlineSceneChoiceFlow
  textMotion: MainlineReadingTextMotion
  phase?: 'leaving'
  exit?: {
    textComplete: boolean
    frameComplete: boolean
  }
}

function clockActivityForExploration(entity: MainlineSceneEntity, hasOptions: boolean): MainlineSceneEcho['clockActivitySource'] {
  if (hasOptions) return 'menu-reading'
  if (entity.interactionBehavior === 'plant-choice') return 'plant-observation'
  if (entity.interactionBehavior === 'cafe-order') return 'counter-observation'
  return 'scene-observation'
}

type MainlineSceneAction = {
  id: number
  entityId?: string
  options: readonly string[]
  optionFlow?: MainlineSceneChoiceFlow
  /** Keeps the same reading overlay identity through text -> choices -> reply. */
  conversationDisplaySessionId?: string
  confirmedOptionIndex?: number
  position: Point
  cameraOffset?: Point
  phase?: 'active' | 'committing' | 'exiting'
}

type CafeRestroomFixtureUseRequest = {
  phase: 'approaching' | 'using'
  requestId: number
  sceneId: MainlineSceneId
  startedAtGameTimeMs?: number
}

function createMainlineSceneEcho(id: number, entityId: string | undefined, text: string, position: Point, clockActivitySource: MainlineSceneEcho['clockActivitySource'], options?: readonly string[], optionFlow?: MainlineSceneChoiceFlow, conversationDisplaySessionId?: string): MainlineSceneEcho {
  // Keep this observation together; the reading layout decides its pages
  // from the available space rather than sentence punctuation.
  const segments = [mainlineDisplaySourceText(text)]
  return {
    id,
    conversationDisplaySessionId,
    clockActivitySource,
    entityId,
    sourceText: text,
    text: segments[0] ?? text.trim(),
    segments,
    segmentIndex: 0,
    position,
    options,
    optionFlow,
    textMotion: 'typing',
  }
}

function replaceMainlineSceneEchoText(current: MainlineSceneEcho, text: string): MainlineSceneEcho {
  const segments = [mainlineDisplaySourceText(text)]
  return {
    ...current,
    sourceText: text,
    text: segments[0] ?? text.trim(),
    segments,
    segmentIndex: 0,
    textMotion: 'typing',
    phase: undefined,
    exit: undefined,
  }
}

function lockedPassageText(passage: MainlineScenePassage) {
  const pool = passage.lockedTextPool
  return pool?.length
    ? pool[Math.floor(Math.random() * pool.length)]
    : passage.lockedText ?? '当前没有权限通过这扇门。'
}


type PendingMainlineTraversal = {
  passage: MainlineScenePassage
  passageQueue: readonly MainlineScenePassage[]
  passageIndex: number
  requestedTarget: Point
  approachPath: Point[]
  continuationPath?: Point[] | null
  requestIssued: boolean
  approachArrived: boolean
}

type SceneFrameExitLifecycle =
  | { phase: 'idle' }
  | {
      phase: 'retracting'
      passageEntityId: string
      scope: 'passage' | 'scene'
      requestedGroups?: readonly string[]
    }

export function MainlineScenePage({
  sceneId,
  onExternalExit,
  onExternalReturn,
  embedded = false,
  showSceneChrome = true,
  showProtagonist = true,
  presentationSnapshot = false,
  suppressWorldEnterAnimation = false,
  movementController,
  onPositionChange,
  onRuntimePositionChange,
  onPlayerMovementStateChange,
  onSceneReady,
  presentationReady = true,
  walkRequest,
  phoneOpen = false,
  onPhoneDismiss,
  onReadingStateChange,
  onClockActivitySourceChange,
  readGameTimeMs,
  shopOrders,
  gameTimeMs,
  onMeaningfulActivity,
  onDeskInteraction,
  onObjectInteraction,
  onCommerceEntity,
  onDrinkShopOrderOpen,
  cafeStoryOrderDelivery,
  onYongheOrderOpen,
  yongheOrderFeedback = 0,
  yongheReadyCue = null,
  onConsumeHeldConsumable,
  onStorefrontAction,
  onMilkTeaAppOpen,
  onMilkTeaOrderReady,
  onChapterAnalytics,
  onNpcInteraction,
  onDoorEvent,
  onInteractionAnalytics,
  initialSceneState = {},
  interactionTutorialCompleted = false,
  onPlayerSceneStateChange,
  onPlayerSceneStatePatch,
  heldConsumable,
  carriedPhoneDevice = 'surface',
  onSceneTransition,
  onSafeSpawnCorrection,
  entryPosition,
  spawnMode = 'resume',
  resumePosition,
  laoZhouCafeSeatId = defaultLaoZhouCafeSeatId,
}: {
  sceneId: MainlineSceneId
  onExternalExit?: () => void
  onExternalReturn?: () => void
  embedded?: boolean
  showSceneChrome?: boolean
  showProtagonist?: boolean
  presentationSnapshot?: boolean
  suppressWorldEnterAnimation?: boolean
  movementController?: FreeRoamMovement
  onPositionChange?: (position: Point) => void
  onRuntimePositionChange?: (sceneId: MainlineSceneId, position: Point, context: MainlineRideWalkingContext) => void
  onPlayerMovementStateChange?: (moving: boolean) => void
  onSceneReady?: () => void
  presentationReady?: boolean
  walkRequest?: { id: number; point: Point } | null
  phoneOpen?: boolean
  onPhoneDismiss?: () => void
  onReadingStateChange?: (reading: boolean) => void
  onClockActivitySourceChange?: (sourceId: string, source: SessionGameActivitySource | null) => void
  readGameTimeMs: () => number
  shopOrders?: Record<string, { readyAtGameTimeMs: number; status: string } | undefined>
  gameTimeMs?: number
  onMeaningfulActivity?: () => void
  onDeskInteraction?: (device: PhoneDevice) => void
  onObjectInteraction?: (entity: MainlineSceneEntity, dwellMs: number) => void
  onCommerceEntity?: (entity: MainlineSceneEntity) => boolean | { text: string; options?: readonly string[] }
  onDrinkShopOrderOpen?: (shopId: string, productId?: string) => void
  cafeStoryOrderDelivery?: CafeStoryOrderDeliveryBridge
  onYongheOrderOpen?: (productId?: string) => void
  yongheOrderFeedback?: number
  yongheReadyCue?: { id: string; text: string } | null
  onConsumeHeldConsumable?: () => void
  /** Reserved entry point for future storefront actions such as milk-tea ordering. */
  onStorefrontAction?: (action: CommercialStreetStorefrontAction, storefrontId: string) => void
  onMilkTeaAppOpen?: () => void
  onMilkTeaOrderReady?: (order: CommercialStreetMilkTeaOrder) => void
  onChapterAnalytics?: (eventName: string, eventData?: Record<string, string | number>) => void
  onNpcInteraction?: (npcId: string) => void
  onDoorEvent?: (phase: 'attempted' | 'blocked' | 'crossed', passage: MainlineScenePassage) => void
  onInteractionAnalytics?: (phase: 'requested' | 'completed' | 'blocked', objectId: string, objectKind: string, outcome?: string) => void
  initialSceneState?: PlayerSceneState
  interactionTutorialCompleted?: boolean
  onPlayerSceneStateChange?: (sceneId: MainlineSceneId, key: string, value: PlayerChoiceValue) => void
  onPlayerSceneStatePatch?: (sceneId: MainlineSceneId, patch: PlayerSceneState) => void
  heldConsumable?: HeldConsumable | null
  carriedPhoneDevice?: PhoneDevice
  onSceneTransition: (sceneId: MainlineSceneId, entryPosition?: Point, spawnMode?: 'resume' | 'ride', transitionIntent?: MainlineWalkingPassageTransitionIntent) => void
  onSafeSpawnCorrection?: (position: Point) => void
  entryPosition?: Point
  spawnMode?: 'resume' | 'ride'
  resumePosition?: Point
  laoZhouCafeSeatId?: string
}) {
  const clockPageId = useId()
  const baseSceneDefinition: MainlineSceneDefinition = mainlineScenes[sceneId]
  const ruoyuCafeUnlocked = initialSceneState[ruoyuCafeUnlockedKey] === true
  const ruoyuCafeSeatId = ruoyuCafeSeatFromSceneState(initialSceneState)
  const sceneDefinition: MainlineSceneDefinition = useMemo(() => {
    if (sceneId !== 'commercial-street' && sceneId !== 'commercial-cafe') return baseSceneDefinition
    const laoZhouScene = withLaoZhouCafeSeat(baseSceneDefinition, laoZhouCafeSeatId)
    return withRuoyuCafeSeat(laoZhouScene, ruoyuCafeSeatId, ruoyuCafeUnlocked)
  }, [baseSceneDefinition, laoZhouCafeSeatId, ruoyuCafeSeatId, ruoyuCafeUnlocked, sceneId])
  const cafeConversationSeatId = laoZhouCafeConversationSeatId(laoZhouCafeSeatId)
  // Entry resolution returns a point value. Stabilize that value across ordinary
  // scene re-renders so actor-footprint registration is an occupancy lifecycle,
  // not a fresh register/remove cycle whenever presentation state changes.
  const initialPosition = useMemo(
    () => initialPositionForEntry(sceneDefinition, sceneId, entryPosition, spawnMode, resumePosition),
    [entryPosition?.x, entryPosition?.y, resumePosition?.x, resumePosition?.y, sceneDefinition, sceneId, spawnMode],
  )
  const [layoutMode, setLayoutMode] = useState(false)
  const getLayoutSnapshot = useCallback(() => getMainlineLayoutSnapshot(sceneDefinition.id), [sceneDefinition.id])
  const persistedLayout = useSyncExternalStore(emptyExternalStoreSubscribe, getLayoutSnapshot, getServerMainlineLayoutSnapshot)
  const [savedLayout, setSavedLayout] = useState<SceneLayout | null>(null)
  const [draftLayout, setDraftLayout] = useState<SceneLayout | null>(null)
  const committedLayout = savedLayout ?? persistedLayout
  const layout = draftLayout ?? committedLayout
  const [layoutSaveState, setLayoutSaveState] = useState<'clean' | 'dirty' | 'saved'>('clean')
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null)
  const [explorationState, setExplorationState] = useState<{ sceneId: MainlineSceneId; objectIds: ReadonlySet<string> }>(() => ({
    sceneId,
    objectIds: mainlineExploredObjectIdsFromSceneState(initialSceneState),
  }))
  const [, setPassageDestination] = useState<Point | null>(null)
  const [requestedWorldTarget, setRequestedWorldTarget] = useState<Point | null>(null)
  const [cafeSpatialQaNavigation, setCafeSpatialQaNavigation] = useState<CafeSpatialQaNavigation | null>(null)
  const [sceneFrameExit, setSceneFrameExit] = useState<SceneFrameExitLifecycle>({ phase: 'idle' })
  const frameMotionProfileRef = useRef<readonly SceneFocusFrameMotionProfile[]>([])
  const pendingTraversalRef = useRef<PendingMainlineTraversal | null>(null)
  const continuePendingTraversalRef = useRef<(entityId: string) => void>(() => {})
  const pendingInteractionAfterTraversalRef = useRef<string | null>(null)
  const resumeInteractionRef = useRef<(entityId: string) => void>(() => {})
  const [viewportMetrics, setViewportMetrics] = useState<MainlineViewportMetrics>(() => currentMainlineViewportMetrics() ?? defaultSceneScreenMetrics)
  const [viewportFormulaMode, setViewportFormulaMode] = useState<'device' | 'legacy'>('device')
  const screenMetrics = sceneDesignReferenceMetrics
  const movementMetrics = useMemo(() => {
    const scale = mainlineWorldScale(viewportMetrics)
    return { width: sceneDesignReferenceMetrics.width * scale, height: sceneDesignReferenceMetrics.height * scale }
  }, [viewportMetrics])
  const sceneReadyRef = useRef(false)
  const handleScreenMetricsChange = useCallback((next: MainlineViewportMetrics) => {
    setViewportMetrics((previous) => previous.width === next.width && previous.height === next.height && previous.viewportWidth === next.viewportWidth && previous.stableHeight === next.stableHeight && previous.projectionScale === next.projectionScale && previous.projectionPolicy === next.projectionPolicy ? previous : next)
    if (!sceneReadyRef.current) {
      sceneReadyRef.current = true
      onSceneReady?.()
    }
  }, [onSceneReady])
  const scene = sceneDefinition
  const previousExternalExitPositionRef = useRef(initialPosition)
  const interactionStartedAtRef = useRef<number | null>(null)
  const storefrontInteractionRuntimeRef = useRef(createCommercialStreetStorefrontInteractionRuntime())
  const storefrontExecutionRuntimeRef = useRef(createCommercialStreetStorefrontExecutionRuntime())
  const storefrontRequestIdRef = useRef(0)
  const npcInteractionRequestRef = useRef(0)
  const cancelPendingTakeawayWorkerResponseRef = useRef<(() => void) | null>(null)
  const navigationRuntimeRef = useRef(createNavigationRuntime())
  const navigationRuntime = navigationRuntimeRef.current
  const commercialCafeCoffeeBehaviorRef = useRef(createCommercialCafeCoffeeOwnerBehaviorCoordinator())
  const commercialCafeCoffeeBehavior = commercialCafeCoffeeBehaviorRef.current
  const commercialCafeFloorBehaviorRef = useRef(createCommercialCafeFloorServerBehaviorCoordinator())
  const commercialCafeFloorBehavior = commercialCafeFloorBehaviorRef.current
  const cafeCoffeeOwnerCurrentDutyRef = useRef<string | null>(null)
  const [cafeCoffeeMoveRetryTick, setCafeCoffeeMoveRetryTick] = useState(0)
  const [cafeFloorMoveRetryTick, setCafeFloorMoveRetryTick] = useState(0)
  const [cafeCounterAmbientWakeTick, setCafeCounterAmbientWakeTick] = useState(0)
  const cafeCounterAmbientTimerRef = useRef<number | null>(null)
  const cafeFloorDwellTimerRef = useRef<number | null>(null)
  const [cafeFloorDwellWake, setCafeFloorDwellWake] = useState(0)
  const cafeCoffeeMoveRetryAppliedRef = useRef(0)
  const cafeFloorMoveRetryAppliedRef = useRef(0)
  const debugCafeFixtureAppliedRef = useRef(false)
  const debugCafePlayerPositionAppliedRef = useRef(false)
  const handledWalkRequestRef = useRef<number | null>(null)
  const [ambientNpcRuntime, setAmbientNpcRuntime] = useState<ReadonlyMap<string, { hidden: boolean; snapshot: NpcRuntimeSnapshot }>>(new Map())
  const [inputDiagnostic, setInputDiagnostic] = useState<MainlineInputDiagnostic | null>(null)
  useEffect(() => {
    storefrontInteractionRuntimeRef.current = createCommercialStreetStorefrontInteractionRuntime()
    storefrontExecutionRuntimeRef.current = createCommercialStreetStorefrontExecutionRuntime()
  }, [sceneId])
  const debugInputSearch = useSyncExternalStore(emptyExternalStoreSubscribe, getDebugInputSnapshot, getServerDebugInputSnapshot)
  const viewportFormulaLab = import.meta.env.DEV && new URLSearchParams(debugInputSearch).get('viewportFormulaLab') === '1'
  const activeViewportMetrics = useMemo(() => {
    if (!viewportFormulaLab) return viewportMetrics
    const projectionScale = viewportFormulaMode === 'legacy'
      ? mainlineLegacyAreaProjectionScale(viewportMetrics)
      : mainlineDeviceProjectionScale(viewportMetrics)
    return { ...viewportMetrics, projectionScale, projectionPolicy: viewportFormulaMode }
  }, [viewportFormulaMode, viewportFormulaLab, viewportMetrics])
  const readingMetrics = activeViewportMetrics
  const debugInput = new URLSearchParams(debugInputSearch).get('debugInput') === '1'
  const debugNpcMovement = new URLSearchParams(debugInputSearch).get('debugNpcMovement') === '1'
  const debugCafeStageValue = new URLSearchParams(debugInputSearch).get('debugCafeStage')
  // The query parameter is accepted only by a disposable Vercel Preview host
  // (or an explicitly flagged local QA build), never by the production domain.
  const previewQaHost = typeof window !== 'undefined'
    && window.location.hostname.endsWith('-newtone-homes-projects.vercel.app')
  const debugCafeSpatialQa = (import.meta.env.VITE_CAFE_SPATIAL_QA === '1' || previewQaHost)
    && sceneDefinition.id === 'commercial-cafe'
    && new URLSearchParams(debugInputSearch).get('qaCafeSpatial') === '1'
  const debugCafeFixture = import.meta.env.DEV && new URLSearchParams(debugInputSearch).get('debugCafeFixture') === '1'
  const debugRuntimeEvidence = import.meta.env.DEV && new URLSearchParams(debugInputSearch).get('debugRuntimeEvidence') === '1'
  const hasSyntheticClockTrialStorage = import.meta.env.DEV
    && import.meta.env.VITE_E2E_CLOCK_TRIAL === '1'
    && typeof window !== 'undefined'
    && window.localStorage.getItem('newtone-e2e-clock-trial-synthetic-save-v1') === '1'
  const debugClockTrialMode = debugRuntimeEvidence && hasSyntheticClockTrialStorage
    ? new URLSearchParams(debugInputSearch).get('debugClockTrial')
    : null
  const debugClockTrialActive = scene.id === 'commercial-street'
    && (debugClockTrialMode === 'formal-dialogue' || debugClockTrialMode === 'inner-monologue')
  const debugCafeStoryInterruptMode = import.meta.env.DEV ? new URLSearchParams(debugInputSearch).get('debugCafeStoryInterrupt') : null
  const debugCafeStoryInterrupt = debugCafeStoryInterruptMode === '1' || debugCafeStoryInterruptMode === 'public'
  const debugCafeServerBlockerMode = import.meta.env.DEV ? new URLSearchParams(debugInputSearch).get('debugCafeServerBlocker') : null
  const debugCafeServerBlocker = debugCafeServerBlockerMode === '1' || debugCafeServerBlockerMode === 'nearest'
  const debugCafePlayerPosition = import.meta.env.DEV ? debugCafePoint(new URLSearchParams(debugInputSearch).get('debugCafePlayerPosition')) : null
  const [debugCafeStoryStage, setDebugCafeStoryStage] = useState<CommercialCafeStoryStage | null>(() => (
    import.meta.env.DEV && isCommercialCafeStoryStage(debugCafeStageValue) ? debugCafeStageValue : null
  ))
  const debugCafeStoryInterruptAppliedRef = useRef(false)
  const debugCafeStoryInterruptFromDutyRef = useRef<string | null>(null)
  const debugCafeServerBlockerTargetRef = useRef<Point | null>(null)
  const debugCafeServerBlockerId = 'e2e-commercial-cafe-server-blocker'
  const [dialogueLineIndex, setDialogueLineIndex] = useState<number | null>(null)
  const [dialogueSegmentIndex, setDialogueSegmentIndex] = useState(0)
  const [dialogueTextSessionId, setDialogueTextSessionId] = useState(0)
  const dialogueTextSessionIdRef = useRef(0)
  const dialogueTextSessionSceneRef = useRef<string | null>(null)
  const [dialogueTextMotion, setDialogueTextMotion] = useState<MainlineReadingTextMotion>('static')
  const dialogueTextMotionRef = useRef<MainlineReadingTextMotion>('static')
  const [dialogueAdvanceDiagnostic, setDialogueAdvanceDiagnostic] = useState('idle')
  const [dialogueHandoffActive, setDialogueHandoffActive] = useState(false)
  const dialogueHandoffActiveRef = useRef(false)
  const dialogueHandoffStartedAtRef = useRef<number | null>(null)
  const dialogueHandoffTimerRef = useRef<number | null>(null)
  const dialogueHandoffOutgoingIdRef = useRef(0)
  const [dialogueHandoffOutgoing, setDialogueHandoffOutgoing] = useState<{ id: number; startedAt: number; minimumVisibleMs: number; deleted: boolean } | null>(null)
  const markDialogueHandoffOutgoingDeleted = useCallback((id: number) => {
    setDialogueHandoffOutgoing(current => current?.id === id ? { ...current, deleted: true } : current)
  }, [])
  useEffect(() => {
    if (!dialogueHandoffOutgoing?.deleted) return
    const outgoing = dialogueHandoffOutgoing
    const remaining = Math.max(0, outgoing.minimumVisibleMs - (performance.now() - outgoing.startedAt))
    const timer = window.setTimeout(() => {
      setDialogueHandoffOutgoing(current => current?.id === outgoing.id ? null : current)
      if (dialogueHandoffOutgoingIdRef.current === outgoing.id) {
        dialogueHandoffActiveRef.current = false
        dialogueHandoffStartedAtRef.current = null
        setDialogueHandoffActive(false)
      }
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [dialogueHandoffOutgoing])
  useEffect(() => () => {
    if (dialogueHandoffTimerRef.current !== null) window.clearTimeout(dialogueHandoffTimerRef.current)
  }, [])
  const updateDialogueTextMotion = useCallback((motion: MainlineReadingTextMotion) => {
    dialogueTextMotionRef.current = motion
    setDialogueTextMotion(motion)
  }, [])
  const startDialogueTextSession = useCallback(() => {
    dialogueTextSessionIdRef.current += 1
    dialogueTextSessionSceneRef.current = sceneId
    setDialogueTextSessionId(dialogueTextSessionIdRef.current)
    updateDialogueTextMotion('typing')
  }, [sceneId, updateDialogueTextMotion])
  const [npcDialogue, setNpcDialogue] = useState<NpcDialogueResolution | null>(null)
  const [commercialCafeNarrative, setCommercialCafeNarrative] = useState<CommercialCafeNarrativeRuntime | null>(() => commercialCafeNarrativeRuntimeFromSceneState(sceneId, initialSceneState, isPointInContinuousCafe(scene, initialPosition)))
  const [playerSeatId, setPlayerSeatId] = useState<string | null>(null)
  // The isolated browser fixture mirrors the real conversation-seat state in
  // memory only. It never writes the user's save and is unavailable in production.
  const activePlayerSeatId = debugCafeFixture ? cafeConversationSeatId : playerSeatId
  const [promptedSeatId, setPromptedSeatId] = useState<string | null>(null)
  const [sceneEcho, setSceneEcho] = useState<MainlineSceneEcho | null>(null)
  const sceneEchoRef = useRef<MainlineSceneEcho | null>(null)
  const [sceneAction, setSceneAction] = useState<MainlineSceneAction | null>(null)
  const conversationDisplaySessionIdRef = useRef(0)
  const [conversationDisplaySessionId, setConversationDisplaySessionId] = useState<string | null>(() => commercialCafeNarrative
    ? `conversation:resume:${sceneId}:commercial-cafe-story`
    : null)
  const confirmedWheelChoiceRef = useRef<string | null>(null)
  const [cafeRestroomFixtureUsePhases, setCafeRestroomFixtureUsePhases] = useState<Partial<Record<string, CafeRestroomFixtureUseRequest['phase']>>>({})
  const cafeRestroomFixtureUsesRef = useRef<Partial<Record<string, CafeRestroomFixtureUseRequest>>>({})
  const cafeRestroomFixtureUseRequestIdsRef = useRef<Partial<Record<string, number>>>({})
  const cafeRestroomFixtureUseFramesRef = useRef<Partial<Record<string, number>>>({})
  const sceneActionIdRef = useRef(0)
  const sceneActionExitBarrierRef = useRef<MainlineSceneActionExitBarrier | null>(null)
  const pendingSceneActionAfterExitRef = useRef<Omit<MainlineSceneAction, 'id'> | null>(null)
  const pendingSceneActionRef = useRef<Omit<MainlineSceneAction, 'id'> | null>(null)
  const pendingSceneEchoAfterActionRef = useRef<{ entityId: string; text: string } | null>(null)
  const [commercialStreetQuestionNarrative, setCommercialStreetQuestionNarrative] = useState<CommercialStreetQuestionNarrativeState | null>(null)
  const [genericDialoguePhase, setGenericDialoguePhase] = useState<'active' | 'leaving'>('active')
  const [commercialStreetQuestionNarrativeCompletedLocally, setCommercialStreetQuestionNarrativeCompletedLocally] = useState(() => commercialStreetQuestionNarrativeCompleted(initialSceneState[commercialStreetQuestionNarrativeCompletedKey]))
  const commercialStreetQuestionNarrativeActiveRef = useRef(false)
  const commercialStreetQuestionPreviousPositionRef = useRef<{ sceneId: string; position: Point } | null>(null)
  const sceneTextSlowdownActiveRef = useRef(false)
  const [officeBlindsOpen, setOfficeBlindsOpen] = useState(() => { const room = officeWindowRoom(sceneDefinition); return room ? officeRoomBlindsOpen(initialSceneState, room.id, room.id) : initialSceneState.blindsOpen !== false })
  const [incenseLitAt, setIncenseLitAt] = useState<number | null>(() => typeof initialSceneState.incenseLitAt === 'number' ? initialSceneState.incenseLitAt : null)
  const [plantWateredAt, setPlantWateredAt] = useState<number | null>(() => typeof initialSceneState.plantWateredAt === 'number' ? initialSceneState.plantWateredAt : null)
  const [incenseClock, setIncenseClock] = useState(() => Date.now())
  const handleIncenseBurnComplete = useCallback(() => setIncenseClock(Date.now()), [])
  const sceneEchoIdRef = useRef(0)
  const cafeAnalyticsMilestonesRef = useRef<Set<CommercialCafeAnalyticsStage>>(new Set())
  const shortInteractionCompletionFrameRef = useRef<number | null>(null)
  const exploredObjectIds = explorationState.sceneId === scene.id ? explorationState.objectIds : emptyExplorationObjectIds
  const incensePhase: IncenseBurnPhase = incenseBurnPhase(incenseLitAt, incenseClock)
  const incenseLit = incensePhase === 'fresh' || incensePhase === 'half'
  const incenseRemainingMs = incenseBurnRemainingMs(incenseLitAt, incenseClock)
  const commercialCafeStory = useMemo(() => {
    if (!hasContinuousCafe(scene)) return inactiveCommercialCafeStory
    return debugCafeStoryStage
      ? commercialCafeStoryStateFromSceneState({ commercialCafeStoryStage: debugCafeStoryStage })
      : commercialCafeStoryStateFromSceneState(initialSceneState)
  }, [debugCafeStoryStage, initialSceneState, scene.id])
  const laoZhouVisibleInCurrentVisit = hasContinuousCafe(scene) && commercialCafeLaoZhouIsPresent(commercialCafeStory, 0)
  const legacyHeldDrinkFallback: HeldConsumable | null = heldConsumable === undefined && commercialStreetMilkTeaHeld(initialSceneState)
    ? { id: 'legacy-milk-tea', shopId: commercialStreetMilkTeaStorefrontId, productId: 'legacy-milk-tea', kind: 'legacy-unknown', sourceOrderId: null }
    : null
  const resolvedHeldConsumable = heldConsumable === undefined ? legacyHeldDrinkFallback : heldConsumable
  const carryingMilkTea = isTrueMilkTea(resolvedHeldConsumable)
  const commercialStreetQuestionNarrativeIsCompleted = commercialStreetQuestionNarrativeCompletedLocally || commercialStreetQuestionNarrativeCompleted(initialSceneState[commercialStreetQuestionNarrativeCompletedKey])
  commercialStreetQuestionNarrativeActiveRef.current = Boolean(commercialStreetQuestionNarrative)
  const recordSceneState = useCallback((targetSceneId: MainlineSceneId, key: string, value: PlayerChoiceValue) => {
    onPlayerSceneStateChange?.(targetSceneId === 'commercial-street' && isCafeStoryKey(key) ? cafeStoryNamespace : targetSceneId, key, value)
  }, [onPlayerSceneStateChange])
  const recordSceneStatePatch = useCallback((targetSceneId: MainlineSceneId, patch: PlayerSceneState) => {
    const cafe = Object.fromEntries(Object.entries(patch).filter(([key]) => targetSceneId === 'commercial-street' && isCafeStoryKey(key)))
    const ordinary = Object.fromEntries(Object.entries(patch).filter(([key]) => !(targetSceneId === 'commercial-street' && isCafeStoryKey(key))))
    if (Object.keys(cafe).length) onPlayerSceneStatePatch?.(cafeStoryNamespace, cafe)
    if (Object.keys(ordinary).length) onPlayerSceneStatePatch?.(targetSceneId, ordinary)
  }, [onPlayerSceneStatePatch])
  useEffect(() => {
    cafeAnalyticsMilestonesRef.current = hasContinuousCafe(scene)
      ? commercialCafeAnalyticsMilestonesFromSceneState(initialSceneState)
      : new Set()
  }, [initialSceneState, scene.id])
  useEffect(() => {
    const patch = initializeOfficePlants(scene, initialSceneState, Date.now())
    if (Object.keys(patch).length) recordSceneStatePatch(scene.id, patch)
  }, [initialSceneState, recordSceneStatePatch, scene])
  const recordCafeAnalyticsMilestone = useCallback((stage: CommercialCafeAnalyticsStage) => {
    if (!hasContinuousCafe(scene) || cafeAnalyticsMilestonesRef.current.has(stage)) return false
    cafeAnalyticsMilestonesRef.current.add(stage)
    recordSceneStatePatch(scene.id, commercialCafeAnalyticsMilestonePatch(initialSceneState, stage))
    onChapterAnalytics?.('cafe_story_stage_reached', { stage })
    return true
  }, [initialSceneState, onChapterAnalytics, recordSceneStatePatch, scene.id])
  const markEntityExplored = useCallback((entityId: string) => {
    recordSceneState(scene.id, mainlineInteractionExploredStateKey(entityId), true)
    setExplorationState((current) => {
      const objectIds = current.sceneId === scene.id ? current.objectIds : emptyExplorationObjectIds
      if (objectIds.has(entityId)) return current
      const next = new Set(objectIds)
      next.add(entityId)
      return { sceneId: scene.id, objectIds: next }
    })
  }, [recordSceneState, scene.id])
  const completeShortInteraction = useCallback((entityId: string) => {
    markEntityExplored(entityId)
    if (typeof window === 'undefined') {
      setActiveObjectId((current) => current === entityId ? null : current)
      return
    }
    if (shortInteractionCompletionFrameRef.current !== null) {
      window.cancelAnimationFrame(shortInteractionCompletionFrameRef.current)
    }
    // Keep the accepted target through one rendered frame. This is not a
    // timeout: it gives the active state a real visual acknowledgement before
    // the contentless interaction settles into its persistent soft state.
    shortInteractionCompletionFrameRef.current = window.requestAnimationFrame(() => {
      shortInteractionCompletionFrameRef.current = window.requestAnimationFrame(() => {
        shortInteractionCompletionFrameRef.current = null
        setActiveObjectId((current) => current === entityId ? null : current)
      })
    })
  }, [markEntityExplored])
  useEffect(() => () => {
    if (shortInteractionCompletionFrameRef.current !== null) {
      window.cancelAnimationFrame(shortInteractionCompletionFrameRef.current)
    }
  }, [])
  const dismissSceneEcho = useCallback(() => {
    const current = sceneEchoRef.current
    if (!current) return
    const next = current.phase === 'leaving' ? current : { ...current, phase: 'leaving' as const }
    sceneEchoRef.current = next
    setSceneEcho(next)
  }, [])
  const createSceneAction = useCallback((action: Omit<MainlineSceneAction, 'id'>): MainlineSceneAction => {
    const id = ++sceneActionIdRef.current
    sceneActionExitBarrierRef.current = createMainlineSceneActionExitBarrier(id, action.options.length)
    return { ...action, id, phase: 'active' }
  }, [])
  const cancelSceneAction = useCallback((intent: 'cancel' | 'replace' = 'cancel') => {
    const current = sceneAction
    const cancellation = resolveMainlineSceneActionCancellation(
      current?.phase ?? null,
      pendingSceneActionAfterExitRef.current,
      intent,
    )
    pendingSceneActionAfterExitRef.current = cancellation.pendingAction
    if (!current || current.phase !== 'active') return
    const barrier = sceneActionExitBarrierRef.current
    if (!barrier || barrier.actionId !== current.id) {
      const pendingAction = pendingSceneActionAfterExitRef.current
      pendingSceneActionAfterExitRef.current = null
      const nextAction = pendingAction ? createSceneAction(pendingAction) : null
      setSceneAction(value => value?.id === current.id ? nextAction : value)
      return
    }
    sceneActionExitBarrierRef.current = cancelMainlineSceneActionExit(barrier, current.id)
    setSceneAction(value => value?.id === current.id && value.phase === 'active' ? { ...value, phase: 'exiting' } : value)
  }, [createSceneAction, sceneAction])
  const beginSceneActionChoice = useCallback((actionId: number, index: number) => {
    setSceneAction((current) => {
      if (!current || current.id !== actionId || current.phase !== 'active' || !current.options[index]) return current
      return { ...current, phase: 'committing' }
    })
  }, [])
  const finishSceneActionExit = useCallback((actionId: number, optionIndex: number) => {
    const currentBarrier = sceneActionExitBarrierRef.current
    if (!currentBarrier || currentBarrier.actionId !== actionId) return
    const nextBarrier = completeMainlineSceneActionOptionExit(currentBarrier, actionId, optionIndex)
    sceneActionExitBarrierRef.current = nextBarrier
    if (!mainlineSceneActionExitMayUnmount(nextBarrier)) return
    sceneActionExitBarrierRef.current = null
    const pendingAction = pendingSceneActionAfterExitRef.current
    pendingSceneActionAfterExitRef.current = null
    const nextAction = pendingAction ? createSceneAction(pendingAction) : null
    setSceneAction((current) => current?.id === actionId && current.phase === 'exiting' ? nextAction : current)
  }, [createSceneAction])
  const commitSceneActionExit = useCallback((actionId: number) => {
    const currentBarrier = sceneActionExitBarrierRef.current
    if (!currentBarrier || currentBarrier.actionId !== actionId) return
    const nextBarrier = commitMainlineSceneActionExit(currentBarrier, actionId)
    sceneActionExitBarrierRef.current = nextBarrier
    setSceneAction((current) => current?.id === actionId && current.phase === 'committing' ? { ...current, phase: 'exiting' } : current)
    if (!mainlineSceneActionExitMayUnmount(nextBarrier)) return
    sceneActionExitBarrierRef.current = null
    setSceneAction((current) => current?.id === actionId ? null : current)
  }, [])
  const presentSceneEcho = useCallback((next: MainlineSceneEcho) => {
    sceneEchoRef.current = next
    setSceneEcho(next)
  }, [])
  const completeSceneEchoExit = useCallback((echoId: number, displayPosition: Point, displayCameraOffset: Point) => {
    const current = sceneEchoRef.current
    if (!current || current.id !== echoId || current.phase !== 'leaving') return
    sceneEchoRef.current = null
    setSceneEcho(null)
    setActiveObjectId(null)
    const nextAction = pendingSceneActionRef.current
    pendingSceneActionRef.current = null
    if (nextAction) setSceneAction(createSceneAction({ ...nextAction, position: displayPosition, cameraOffset: displayCameraOffset }))
  }, [createSceneAction])
  useIsomorphicLayoutEffect(() => {
    sceneEchoRef.current = sceneEcho
  }, [sceneEcho])
  const notifySceneTransition = useCallback((targetSceneId: MainlineSceneId, targetEntryPosition?: Point, targetSpawnMode?: 'resume' | 'ride', transitionIntent?: MainlineWalkingPassageTransitionIntent) => {
    setIncenseClock(Date.now())
    onSceneTransition(targetSceneId, targetEntryPosition, targetSpawnMode, transitionIntent)
  }, [onSceneTransition])
  const questionDialogueLine = commercialStreetQuestionNarrative
    ? {
        id: `commercial-street-question-${commercialStreetQuestionNarrative.segmentIndex}`,
        speaker: '修杰' as const,
        text: commercialStreetQuestionNarrativeLines[commercialStreetQuestionNarrative.segmentIndex],
      }
    : null
  const cafeNarrativeLine = commercialCafeNarrative?.phase === 'delivery-line'
    ? commercialCafeDeliveryDialogueLine
    : commercialCafeNarrative?.phase === 'active'
      ? commercialCafeNarrativeDialogue.lines[commercialCafeStory.narrativeCursor] ?? null
      : null
  const activeDialogueSource = questionDialogueLine
    ? { triggerEntityId: 'commercial-street-question', lines: commercialStreetQuestionNarrativeLines.map((text, index) => ({ id: `commercial-street-question-${index}`, speaker: '修杰' as const, text })) }
    : commercialCafeNarrative ? commercialCafeNarrativeDialogue
      : npcDialogue?.dialogue ?? scene.dialogue
  const dialoguePresentation = commercialCafeNarrative?.phase === 'delivery-line'
    ? 'aside' as const
    : activeDialogueSource && !commercialStreetQuestionNarrative ? 'conversation' as const : undefined
  const activeDialogue = activeDialogueSource && dialoguePresentation
    ? { ...activeDialogueSource, dialoguePresentation }
    : activeDialogueSource
  const activeDialogueLine = questionDialogueLine ?? (commercialCafeNarrative
    ? cafeNarrativeLine
    : activeDialogue && dialogueLineIndex !== null
      ? activeDialogue.lines[dialogueLineIndex] ?? null
      : null)
  // Keep the active segment available to the conversation display model below.
  const activeDialogueSegments = activeDialogueLine ? [mainlineDisplaySourceText(activeDialogueLine.text)] : []
  const activeDialogueText = mainlineReadingSegmentDisplayText(activeDialogueSegments, dialogueSegmentIndex)
  const dialogueAnchorSessionRef = useRef<{ key: string; positions: Map<string, Point>; outside: Map<string, { side: 'above' | 'below'; speakerY: number }> } | null>(null)
  const dialogueAnchorSessionKey = activeDialogueLine
    ? commercialStreetQuestionNarrative
      ? 'commercial-street-question'
      : commercialCafeNarrative
        ? 'commercial-cafe-narrative'
        : `dialogue:${scene.id}:${npcDialogue?.dialogue.triggerEntityId ?? activeDialogue?.triggerEntityId ?? 'scene'}`
    : null
  const dialogueAnchorText = activeDialogue?.lines.map((line) => line.text).join('\n') ?? activeDialogueLine?.text ?? ''
  const dialoguePresentationPhase = commercialCafeNarrative?.phase === 'coffee-delivery' || commercialCafeNarrative?.phase === 'coffee-returning'
    ? undefined
    : commercialCafeNarrative?.phase === 'delivery-line'
      ? 'active'
      : commercialCafeNarrative?.phase ?? commercialStreetQuestionNarrative?.phase ?? (activeDialogueLine ? genericDialoguePhase : undefined)
  const commercialCafeDeliveryBeatActive = commercialCafeNarrative?.phase === 'coffee-delivery'
  const commercialCafeReturnBeatActive = commercialCafeNarrative?.phase === 'coffee-returning'
  const dialogueChoiceSurfaceActive = sceneAction?.optionFlow === 'dialogue-choice'
    && (sceneAction.phase === 'active'
      || sceneAction.phase === 'committing'
      || (sceneAction.phase === 'exiting' && pendingSceneActionAfterExitRef.current?.optionFlow === 'dialogue-choice'))
  const readingActive = Boolean(
    (sceneEcho && (sceneEcho.phase !== 'leaving' || Boolean(sceneEcho.conversationDisplaySessionId)))
    || (activeDialogueLine && dialoguePresentationPhase !== 'leaving')
    || commercialCafeDeliveryBeatActive
    || commercialCafeReturnBeatActive
    || dialogueChoiceSurfaceActive
  )
  const resumedConversationDisplaySessionId = commercialCafeNarrative
    ? `conversation:resume:${sceneId}:commercial-cafe-story`
    : commercialStreetQuestionNarrative
      ? `conversation:resume:${sceneId}:commercial-street-question`
      : activeDialogueLine
        ? `conversation:resume:${sceneId}:${activeDialogueSource?.triggerEntityId ?? 'scene'}`
        : sceneEcho?.optionFlow === 'dialogue-choice'
          ? `conversation:echo:${sceneId}:${sceneEcho.id}`
          : sceneAction?.optionFlow === 'dialogue-choice'
            ? `conversation:action:${sceneId}:${sceneAction.id}`
            : null
  const currentConversationDisplaySessionId = sceneEcho?.conversationDisplaySessionId
    ?? sceneAction?.conversationDisplaySessionId
    ?? conversationDisplaySessionId
    ?? resumedConversationDisplaySessionId
  const cafeNarrativeHistoryCount = commercialCafeNarrative
    ? commercialCafeStory.narrativeCursor + (commercialCafeNarrative.phase === 'coffee-delivery'
      || commercialCafeNarrative.phase === 'delivery-line'
      || commercialCafeNarrative.phase === 'coffee-returning' ? 1 : 0)
    : 0
  const cafeNarrativeDisplayHistory: readonly MainlineConversationDisplayHistoryEntry[] = commercialCafeNarrative
    ? commercialCafeNarrativeDialogue.lines.slice(0, cafeNarrativeHistoryCount).map(line => ({
        key: line.id,
        speaker: line.speaker,
        speakerIsNpc: Boolean(('speakerNpcId' in line && line.speakerNpcId) || scene.npcs.some(npc => npc.label === line.speaker)),
        text: line.text,
      }))
    : []
  const conversationDisplayContent: MainlineConversationDisplayContent | null =
    (commercialCafeDeliveryBeatActive || commercialCafeReturnBeatActive) && currentConversationDisplaySessionId
      ? commercialCafeDeliveryBeatActive
        ? { sessionId: currentConversationDisplaySessionId, kind: 'waiting', text: '……', canAdvance: false, history: cafeNarrativeDisplayHistory }
        : { sessionId: currentConversationDisplaySessionId, kind: 'aside', text: commercialCafeDeliveryDialogueLine.text, canAdvance: false, history: cafeNarrativeDisplayHistory }
      : (sceneEcho?.optionFlow === 'dialogue-choice' || sceneEcho?.conversationDisplaySessionId) && currentConversationDisplaySessionId
        ? { sessionId: currentConversationDisplaySessionId, kind: 'text', text: sceneEcho.text, textMotion: sceneEcho.textMotion, canAdvance: sceneEcho.phase !== 'leaving' }
        : sceneAction?.optionFlow === 'dialogue-choice' && currentConversationDisplaySessionId
          ? { sessionId: currentConversationDisplaySessionId, kind: 'choice', actionId: sceneAction.id, options: sceneAction.options, canAdvance: false }
          : activeDialogueLine && currentConversationDisplaySessionId
            ? { sessionId: currentConversationDisplaySessionId, kind: dialoguePresentation === 'aside' ? 'aside' : 'text', text: activeDialogueText, textMotion: dialogueTextMotion, canAdvance: true, history: commercialCafeNarrative ? cafeNarrativeDisplayHistory : undefined }
            : null
  sceneTextSlowdownActiveRef.current = readingActive
  useEffect(() => {
    onReadingStateChange?.(readingActive)
    return () => onReadingStateChange?.(false)
  }, [onReadingStateChange, readingActive])
  const dialogueClockSource = activeDialogueLine && dialoguePresentationPhase !== 'leaving'
    ? commercialStreetQuestionNarrative ? 'inner-monologue' : npcDialogue ? 'npc-dialogue' : 'scene-dialogue'
    : null
  const sceneClockSource = sceneEcho && sceneEcho.phase !== 'leaving'
    ? sceneEcho.clockActivitySource
    : sceneAction?.phase === 'active' ? 'menu-reading' : null
  useEffect(() => {
    const dialogueId = `${clockPageId}:dialogue`
    const readingId = `${clockPageId}:reading`
    onClockActivitySourceChange?.(dialogueId, dialogueClockSource)
    onClockActivitySourceChange?.(readingId, sceneClockSource)
    return () => {
      onClockActivitySourceChange?.(dialogueId, null)
      onClockActivitySourceChange?.(readingId, null)
    }
  }, [clockPageId, dialogueClockSource, onClockActivitySourceChange, sceneClockSource])
  useEffect(() => {
    if (!phoneOpen) return
    if (readingActive) {
      onPhoneDismiss?.()
      return
    }
    dismissSceneEcho()
    cancelSceneAction()
  }, [cancelSceneAction, dismissSceneEcho, onPhoneDismiss, phoneOpen, readingActive])
  const internalMovement = useFreeRoamMovement(initialPosition)
  const { position, moving, moveAlong: rawMoveAlong, stopMovement, resetMovement: resetMovementController, getCurrentPosition, getRemainingDurationMs } = movementController ?? internalMovement
  const resetMovement = useCallback((nextPosition?: Point) => {
    resetMovementController(nextPosition)
    commercialStreetQuestionPreviousPositionRef.current = { sceneId: scene.id, position: nextPosition ?? getCurrentPosition() }
  }, [getCurrentPosition, resetMovementController, scene.id])
  const cameraOffset = useMainlineCamera(scene, position, embedded, activeViewportMetrics)

  useEffect(() => {
    if (sceneAction !== null || !pendingSceneEchoAfterActionRef.current) return
    const pending = pendingSceneEchoAfterActionRef.current
    pendingSceneEchoAfterActionRef.current = null
    const position = getCurrentPosition()
    presentSceneEcho(createMainlineSceneEcho(
      ++sceneEchoIdRef.current, pending.entityId, pending.text,
      sceneTextPresentationPosition(scene, position, pending.text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, position, readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)),
      'scene-observation',
    ))
  }, [activeViewportMetrics, cameraOffset, getCurrentPosition, presentSceneEcho, readingMetrics, scene, sceneAction])
  const cafeInsideRef = useRef(false)
  const cafeInsideSceneIdRef = useRef(sceneId)
  useEffect(() => {
    const inside = hasContinuousCafe(scene) && isPointInContinuousCafe(scene, position)
    if (cafeInsideSceneIdRef.current !== sceneId) {
      cafeInsideSceneIdRef.current = sceneId
      cafeInsideRef.current = inside
      const resumedNarrative = commercialCafeNarrativeRuntimeFromSceneState(sceneId, initialSceneState, inside)
      setCommercialCafeNarrative(resumedNarrative)
      setConversationDisplaySessionId(resumedNarrative ? `conversation:resume:${sceneId}:commercial-cafe-story` : null)
      return
    }
    if (inside && !cafeInsideRef.current) {
      const resumedNarrative = commercialCafeNarrativeRuntimeFromSceneState(sceneId, initialSceneState, true)
      setCommercialCafeNarrative(resumedNarrative)
      setConversationDisplaySessionId(resumedNarrative ? `conversation:resume:${sceneId}:commercial-cafe-story` : null)
    } else if (!inside && cafeInsideRef.current) {
      setCommercialCafeNarrative(null)
      setConversationDisplaySessionId(null)
    }
    cafeInsideRef.current = inside
  }, [position.x, position.y, scene, sceneId, initialSceneState])
  const storefrontPresentation = useStorefrontPresentation(
    scene,
    position,
    presentationReady,
    scene.id === 'commercial-street' && activePlayerSeatId ? restroomPresentationSuppressionForSeatedPlayer : undefined,
  )
  const reportedCafeRevealRef = useRef(false)
  const cafeStorefrontPhase = scene.id === 'commercial-street'
    ? storefrontPresentation.phaseByStorefront.get('commercial-cafe-slot')
    : undefined
  useEffect(() => {
    if (cafeStorefrontPhase === 'revealing') {
      if (reportedCafeRevealRef.current) return
      reportedCafeRevealRef.current = true
      onChapterAnalytics?.('cafe_storefront_revealed')
      return
    }
    if (cafeStorefrontPhase === 'baseline') reportedCafeRevealRef.current = false
  }, [cafeStorefrontPhase, onChapterAnalytics])
  const moveAlong = useCallback((path: Point[], onArrive?: () => void, options?: Parameters<FreeRoamMovement['moveAlong']>[2]) => {
    rawMoveAlong(path, onArrive, {
      ...options,
      onMove: (nextPosition) => {
        navigationRuntime.updateActor('protagonist', nextPosition)
        options?.onMove?.(nextPosition)
      },
    })
  }, [navigationRuntime, rawMoveAlong])
  const clearCafeRestroomFixtureUse = useCallback((entityId?: string, requestId?: number) => {
    const targets = entityId ? [entityId] : cafeRestroomFixtureIds
    for (const targetId of targets) {
      const current = cafeRestroomFixtureUsesRef.current[targetId]
      if (requestId !== undefined && current?.requestId !== requestId) continue
      const frame = cafeRestroomFixtureUseFramesRef.current[targetId]
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      delete cafeRestroomFixtureUseFramesRef.current[targetId]
      cafeRestroomFixtureUseRequestIdsRef.current[targetId] = (cafeRestroomFixtureUseRequestIdsRef.current[targetId] ?? 0) + 1
      delete cafeRestroomFixtureUsesRef.current[targetId]
      setCafeRestroomFixtureUsePhases((phases) => { const next = { ...phases }; delete next[targetId]; return next })
      setActiveObjectId((currentId) => currentId === targetId ? null : currentId)
    }
  }, [])
  useEffect(() => {
    clearCafeRestroomFixtureUse()
    return () => {
      for (const entityId of cafeRestroomFixtureIds) {
        const frame = cafeRestroomFixtureUseFramesRef.current[entityId]
        if (frame !== undefined) window.cancelAnimationFrame(frame)
      }
      cafeRestroomFixtureUseFramesRef.current = {}
      cafeRestroomFixtureUsesRef.current = {}
    }
  }, [clearCafeRestroomFixtureUse, scene.id])
  useEffect(() => {
    if (!cafeRestroomFixtureIds.some((entityId) => cafeRestroomFixtureUsesRef.current[entityId])) return
    const restroom = scene.rooms.find((room) => room.id === cafeRestroomRoomId)
    if (!restroom || !isPointInsideCafeRestroom(position, restroom.bounds)) {
      clearCafeRestroomFixtureUse()
    }
  }, [clearCafeRestroomFixtureUse, position.x, position.y, scene])
  // Compiled scene geometry is independent of a moving actor. Storefront
  // visibility is owned by its presentation phase map; use the authored spawn
  // only as the stable fallback during that map's initial render.
  const geometrySnapshot = useMemo(() => createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition, layout, screenMetrics, storefrontPresentation.phaseByStorefront), [layout, scene, screenMetrics, storefrontPresentation.phaseByStorefront])
  const stagedNpcPositions = useMemo(() => new Map(scene.npcs.map((npc) => [
    npc.id,
    resolveMainlineNpcPosition(scene, npc.id, layout, { geometrySnapshot, screenMetrics }),
  ])), [geometrySnapshot, layout, scene, screenMetrics])
  const coffeeOwnerInitialPosition = stagedNpcPositions.get(commercialCafeCoffeeOwnerNpcId) ?? scene.initialPlayerPosition
  const floorServerInitialPosition = stagedNpcPositions.get(commercialCafeFloorServerNpcId) ?? scene.initialPlayerPosition
  const laoZhouInitialPosition = stagedNpcPositions.get('lao-zhou') ?? scene.initialPlayerPosition
  const cafeCoffeeOwnerFootprint = useMemo(() => {
    const box = mainlineNpcLabelFootprint(scene, commercialCafeCoffeeOwnerNpcId, coffeeOwnerInitialPosition, screenMetrics)
    return { width: box.width, height: box.height }
  }, [coffeeOwnerInitialPosition, scene, screenMetrics])
  const cafeFloorServerFootprint = useMemo(() => {
    const box = mainlineNpcLabelFootprint(scene, commercialCafeFloorServerNpcId, floorServerInitialPosition, screenMetrics)
    return { width: box.width, height: box.height }
  }, [floorServerInitialPosition, scene, screenMetrics])
  const laoZhouFootprint = useMemo(() => {
    const box = mainlineNpcLabelFootprint(scene, 'lao-zhou', laoZhouInitialPosition, screenMetrics)
    return { width: box.width, height: box.height }
  }, [laoZhouInitialPosition, scene, screenMetrics])
  const cafeCoffeeOwnerMovement = useNpcMovement({
    enabled: !presentationSnapshot && hasContinuousCafe(scene) && scene.npcs.some((npc) => npc.id === commercialCafeCoffeeOwnerNpcId),
    npcId: commercialCafeCoffeeOwnerNpcId,
    initialPosition: coffeeOwnerInitialPosition,
    navigationRuntime,
    footprint: cafeCoffeeOwnerFootprint,
  })
  const cafeFloorServerMovement = useNpcMovement({
    enabled: !presentationSnapshot && hasContinuousCafe(scene) && scene.npcs.some((npc) => npc.id === commercialCafeFloorServerNpcId),
    npcId: commercialCafeFloorServerNpcId,
    initialPosition: floorServerInitialPosition,
    navigationRuntime,
    footprint: cafeFloorServerFootprint,
  })
  const laoZhouMovement = useNpcMovement({
    enabled: !presentationSnapshot && laoZhouVisibleInCurrentVisit,
    npcId: 'lao-zhou',
    initialPosition: laoZhouInitialPosition,
    navigationRuntime,
    footprint: laoZhouFootprint,
  })
  const milkTeaWorkerId = 'milk-tea-trial-worker'
  const fruitTeaWorkerId = 'fruit-tea-trial-worker'
  const milkTeaWorkerInitial = stagedNpcPositions.get(milkTeaWorkerId) ?? scene.initialPlayerPosition
  const fruitTeaWorkerInitial = stagedNpcPositions.get(fruitTeaWorkerId) ?? scene.initialPlayerPosition
  const milkTeaWorkerBox = mainlineNpcLabelFootprint(scene, milkTeaWorkerId, milkTeaWorkerInitial, screenMetrics)
  const fruitTeaWorkerBox = mainlineNpcLabelFootprint(scene, fruitTeaWorkerId, fruitTeaWorkerInitial, screenMetrics)
  const milkTeaWorkerMovement = useNpcMovement({ enabled: !presentationSnapshot && scene.npcs.some(npc => npc.id === milkTeaWorkerId) && mainlineActiveSpatialSpaceId(scene, milkTeaWorkerInitial) === 'commercial-south-s5-interior', npcId: milkTeaWorkerId, initialPosition: milkTeaWorkerInitial, navigationRuntime, footprint: { width: milkTeaWorkerBox.width, height: milkTeaWorkerBox.height } })
  const fruitTeaWorkerMovement = useNpcMovement({ enabled: !presentationSnapshot && scene.npcs.some(npc => npc.id === fruitTeaWorkerId) && mainlineActiveSpatialSpaceId(scene, fruitTeaWorkerInitial) === 'commercial-north-n1-interior', npcId: fruitTeaWorkerId, initialPosition: fruitTeaWorkerInitial, navigationRuntime, footprint: { width: fruitTeaWorkerBox.width, height: fruitTeaWorkerBox.height } })
  const ambientNpcFootprints = useMemo(() => new Map(scene.ambientNpcRoutes.map((schedule) => {
    const npc = scene.npcs.find((candidate) => candidate.id === schedule.npcId)
    const position = stagedNpcPositions.get(schedule.npcId) ?? scene.initialPlayerPosition
    const box = mainlineSceneFootprint(scene, mainlineLabelFootprint(npc?.label ?? '', position, screenMetrics, { lineHeight: 1 }), screenMetrics)
    return [schedule.npcId, { width: box.width, height: box.height }] as const
  })), [scene, screenMetrics, stagedNpcPositions])
  const handleAmbientNpcRuntimeChange = useCallback((npcId: string, hidden: boolean, snapshot: NpcRuntimeSnapshot) => {
    setAmbientNpcRuntime((current) => {
      const existing = current.get(npcId)
      if (existing
        && existing.hidden === hidden
        && existing.snapshot.phase === snapshot.phase
        && existing.snapshot.dutyId === snapshot.dutyId
        && existing.snapshot.targetId === snapshot.targetId) return current
      return new Map(current).set(npcId, { hidden, snapshot })
    })
  }, [])
  const npcRuntimePositions = useMemo(() => {
    const positions = new Map<string, Point>()
    if (cafeCoffeeOwnerMovement.position) positions.set(commercialCafeCoffeeOwnerNpcId, cafeCoffeeOwnerMovement.position)
    if (cafeFloorServerMovement.position) positions.set(commercialCafeFloorServerNpcId, cafeFloorServerMovement.position)
    if (laoZhouMovement.position) positions.set('lao-zhou', laoZhouMovement.position)
    if (milkTeaWorkerMovement.position) positions.set(milkTeaWorkerId, milkTeaWorkerMovement.position)
    if (fruitTeaWorkerMovement.position) positions.set(fruitTeaWorkerId, fruitTeaWorkerMovement.position)
    return positions
  }, [cafeCoffeeOwnerMovement.position, cafeFloorServerMovement.position, fruitTeaWorkerId, fruitTeaWorkerMovement.position, laoZhouMovement.position, milkTeaWorkerId, milkTeaWorkerMovement.position])
  const hiddenAmbientNpcIds = useMemo(() => new Set([...ambientNpcRuntime]
    .filter(([, runtime]) => runtime.hidden)
    .map(([npcId]) => npcId)), [ambientNpcRuntime])
  const hiddenNpcIds = useMemo(() => {
    const hidden = new Set(hiddenAmbientNpcIds)
    if (hasContinuousCafe(scene) && !laoZhouVisibleInCurrentVisit) hidden.add('lao-zhou')
    return hidden
  }, [hiddenAmbientNpcIds, laoZhouVisibleInCurrentVisit, scene.id])
  const npcRuntimeSnapshots = useMemo(() => {
    const snapshots = new Map<string, NpcRuntimeSnapshot>([
      [commercialCafeCoffeeOwnerNpcId, cafeCoffeeOwnerMovement.snapshot],
      [commercialCafeFloorServerNpcId, cafeFloorServerMovement.snapshot],
      ['lao-zhou', laoZhouMovement.snapshot],
      [milkTeaWorkerId, milkTeaWorkerMovement.snapshot],
      [fruitTeaWorkerId, fruitTeaWorkerMovement.snapshot],
    ])
    ambientNpcRuntime.forEach(({ snapshot }, npcId) => snapshots.set(npcId, snapshot))
    return snapshots
  }, [ambientNpcRuntime, cafeCoffeeOwnerMovement.snapshot, cafeFloorServerMovement.snapshot, fruitTeaWorkerId, fruitTeaWorkerMovement.snapshot, laoZhouMovement.snapshot, milkTeaWorkerId, milkTeaWorkerMovement.snapshot])
  const resolvedNpcPositions = useMemo(() => new Map(scene.npcs.map((npc) => [
    npc.id,
    resolveMainlineNpcPosition(scene, npc.id, layout, { geometrySnapshot, screenMetrics, npcRuntimePositions }),
  ])), [geometrySnapshot, layout, npcRuntimePositions, scene, screenMetrics])
  const registeredNpcPositions = useMemo(() => new Map([...resolvedNpcPositions]
    .filter(([npcId]) => npcId !== 'lao-zhou' || !hasContinuousCafe(scene) || laoZhouVisibleInCurrentVisit)), [laoZhouVisibleInCurrentVisit, resolvedNpcPositions, scene.id])
  // Moving actors own their NavigationRuntime registration through their
  // movement adapters. Re-registering them here on every projected position
  // update would briefly remove their live occupancy during the parent effect
  // cleanup, defeating ambient proximity-yield latching.
  const runtimeManagedNpcIds = useMemo(() => new Set([
    ...scene.ambientNpcRoutes.map((schedule) => schedule.npcId),
    ...(hasContinuousCafe(scene) ? [commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId, 'lao-zhou'] : []),
    ...(scene.npcs.some(npc => npc.id === milkTeaWorkerId) ? [milkTeaWorkerId] : []),
    ...(scene.npcs.some(npc => npc.id === fruitTeaWorkerId) ? [fruitTeaWorkerId] : []),
  ]), [fruitTeaWorkerId, milkTeaWorkerId, scene.ambientNpcRoutes, scene.id, scene.npcs])
  const staticNpcPositions = useMemo(() => new Map([...registeredNpcPositions]
    .filter(([npcId]) => !runtimeManagedNpcIds.has(npcId))), [registeredNpcPositions, runtimeManagedNpcIds])
  const movingNpcIds = useMemo(() => new Set([...npcRuntimeSnapshots]
    .filter(([, snapshot]) => snapshot.phase === 'moving')
    .map(([npcId]) => npcId)), [npcRuntimeSnapshots])
  const releasedCafeSeatNpcIds = useMemo(() => new Set<string>(laoZhouVisibleInCurrentVisit ? [] : ['lao-zhou']), [laoZhouVisibleInCurrentVisit])
  const occupiedSeatIds = useMemo(() => mainlineSceneOccupiedSeatIds(scene, activePlayerSeatId, releasedCafeSeatNpcIds), [activePlayerSeatId, releasedCafeSeatNpcIds, scene])
  const seatedProtagonistPosition = activePlayerSeatId ? geometrySnapshot.objects.get(activePlayerSeatId)?.position : undefined
  const protagonistFootprint = useMemo(() => {
    const seatedPosition = seatedProtagonistPosition
    const box = seatedPosition
      ? mainlineSceneFootprint(scene, mainlineLabelFootprint('修杰', seatedPosition, screenMetrics, { lineHeight: 1 }), screenMetrics)
      // The walking marker's dimensions are independent of its live world
      // position. Keeping this footprint stable lets the separate position
      // effect update occupancy without unregistering the protagonist between
      // movement frames.
      : mainlineProtagonistDotFootprint(initialPosition, screenMetrics, scene.id)
    return { width: box.width, height: box.height }
  }, [activePlayerSeatId, initialPosition, scene.id, screenMetrics, seatedProtagonistPosition?.x, seatedProtagonistPosition?.y])
  useEffect(() => {
    navigationRuntime.registerActor('protagonist', getCurrentPosition(), protagonistFootprint)
    return () => navigationRuntime.removeActor('protagonist')
  }, [getCurrentPosition, navigationRuntime, protagonistFootprint])
  useEffect(() => {
    navigationRuntime.updateActor('protagonist', position)
  }, [navigationRuntime, position])
  useEffect(() => {
    staticNpcPositions.forEach((npcPosition, npcId) => {
      const npc = scene.npcs.find((candidate) => candidate.id === npcId)
      const box = mainlineSceneFootprint(scene, mainlineLabelFootprint(npc?.label ?? '', npcPosition, screenMetrics, { lineHeight: 1 }), screenMetrics)
      navigationRuntime.registerActor(npcId, npcPosition, { width: box.width, height: box.height })
    })
    return () => staticNpcPositions.forEach((_npcPosition, npcId) => navigationRuntime.removeActor(npcId))
  }, [navigationRuntime, scene.npcs, screenMetrics, staticNpcPositions])
  useEffect(() => {
    pendingTraversalRef.current = null
    setPassageDestination(null)
    setRequestedWorldTarget(null)
    setSceneFrameExit({ phase: 'idle' })
    setActiveObjectId(null)
    setExplorationState({ sceneId, objectIds: mainlineExploredObjectIdsFromSceneState(initialSceneState) })
    setDialogueLineIndex(null)
    setDialogueSegmentIndex(0)
    dialogueHandoffActiveRef.current = false
    dialogueHandoffStartedAtRef.current = null
    setDialogueHandoffActive(false)
    setDialogueHandoffOutgoing(null)
    if (dialogueHandoffTimerRef.current !== null) {
      window.clearTimeout(dialogueHandoffTimerRef.current)
      dialogueHandoffTimerRef.current = null
    }
    updateDialogueTextMotion('static')
    setNpcDialogue(null)
    setGenericDialoguePhase('active')
    setCommercialCafeNarrative(commercialCafeNarrativeRuntimeFromSceneState(sceneId, initialSceneState, isPointInContinuousCafe(scene, getCurrentPosition())))
    setPlayerSeatId(null)
    setPromptedSeatId(null)
    setSceneEcho(null)
    sceneEchoRef.current = null
    pendingSceneActionRef.current = null
    pendingSceneActionAfterExitRef.current = null
    sceneActionExitBarrierRef.current = null
    setSceneAction(null)
    setCommercialStreetQuestionNarrative(null)
    setCommercialStreetQuestionNarrativeCompletedLocally(commercialStreetQuestionNarrativeCompleted(initialSceneState[commercialStreetQuestionNarrativeCompletedKey]))
    setOfficeBlindsOpen((() => { const room = officeWindowRoom(sceneDefinition); return room ? officeRoomBlindsOpen(initialSceneState, room.id, room.id) : initialSceneState.blindsOpen !== false })())
    setIncenseLitAt(typeof initialSceneState.incenseLitAt === 'number' ? initialSceneState.incenseLitAt : null)
    setPlantWateredAt(typeof initialSceneState.plantWateredAt === 'number' ? initialSceneState.plantWateredAt : null)
    setIncenseClock(Date.now())
    stopMovement()
  }, [sceneDefinition, sceneId, stopMovement, updateDialogueTextMotion])
  useEffect(() => {
    if (!debugClockTrialActive) return
    if (debugClockTrialMode === 'formal-dialogue') {
      setNpcDialogue(debugClockTrialNpcDialogue)
      setDialogueLineIndex(0)
      setConversationDisplaySessionId(`conversation:${++conversationDisplaySessionIdRef.current}`)
      startDialogueTextSession()
      return
    }
    if (debugClockTrialMode === 'inner-monologue') {
      setConversationDisplaySessionId(`conversation:${++conversationDisplaySessionIdRef.current}`)
      setCommercialStreetQuestionNarrative({ phase: 'active', segmentIndex: 0 })
    }
  }, [debugClockTrialActive, debugClockTrialMode, startDialogueTextSession])
  useEffect(() => {
    const persistedObjectIds = mainlineExploredObjectIdsFromSceneState(initialSceneState)
    setExplorationState((current) => {
      if (current.sceneId === sceneId
        && current.objectIds.size === persistedObjectIds.size
        && [...current.objectIds].every((entityId) => persistedObjectIds.has(entityId))) return current
      return { sceneId, objectIds: persistedObjectIds }
    })
  }, [initialSceneState, sceneId])
  useEffect(() => {
    if (!isCafeWorldId(sceneId)) return
    if (!commercialCafeStoryNeedsMigration(initialSceneState)) return
    recordSceneStatePatch(sceneId, commercialCafeStoryStatePatch(commercialCafeStoryStateFromSceneState(initialSceneState)))
  }, [initialSceneState, onPlayerSceneStatePatch, sceneId])
  useEffect(() => {
    const previous = commercialStreetQuestionPreviousPositionRef.current
    commercialStreetQuestionPreviousPositionRef.current = { sceneId: scene.id, position }
    if (commercialStreetQuestionNarrative || commercialStreetQuestionNarrativeIsCompleted) return
    const previousPosition = previous?.sceneId === scene.id ? previous.position : undefined
    if (!commercialStreetQuestionNarrativeShouldTrigger(scene, position, previousPosition, commercialStreetQuestionNarrativeIsCompleted)) return
    stopMovement()
    setRequestedWorldTarget(null)
    setConversationDisplaySessionId(`conversation:${++conversationDisplaySessionIdRef.current}`)
    setCommercialStreetQuestionNarrative({ phase: 'active', segmentIndex: 0 })
    startDialogueTextSession()
    onChapterAnalytics?.('commercial_question_triggered')
  }, [commercialStreetQuestionNarrative, commercialStreetQuestionNarrativeIsCompleted, onChapterAnalytics, position, scene, startDialogueTextSession, stopMovement])
  useEffect(() => {
    if (!activeDialogueLine || dialoguePresentationPhase !== 'active'
      || (dialogueTextSessionId !== 0 && dialogueTextSessionSceneRef.current === sceneId)) return
    startDialogueTextSession()
  }, [activeDialogueLine, dialoguePresentationPhase, dialogueTextSessionId, sceneId, startDialogueTextSession])
  const activeDialogueSpeakerActorId = activeDialogueLine ? mainlineDialogueSpeakerActorId({
      speaker: activeDialogueLine.speaker,
      speakerNpcId: 'speakerNpcId' in activeDialogueLine ? activeDialogueLine.speakerNpcId : undefined,
      npcs: scene.npcs,
      protagonistLabel: '修杰',
    }) : null
  const activeDialogueSpeakerKey = activeDialogueSpeakerActorId ?? `speaker:${activeDialogueLine?.speaker ?? ''}`
  if (!dialogueAnchorSessionKey) dialogueAnchorSessionRef.current = null
  else if (dialogueAnchorSessionRef.current?.key !== dialogueAnchorSessionKey) dialogueAnchorSessionRef.current = { key: dialogueAnchorSessionKey, positions: new Map(), outside: new Map() }
  if (dialogueAnchorSessionKey && activeDialogueLine && dialogueAnchorSessionRef.current && !dialogueAnchorSessionRef.current.positions.has(activeDialogueSpeakerKey)) {
    const speakerPosition = activeDialogueSpeakerActorId === 'protagonist' ? position : resolvedNpcPositions.get(activeDialogueSpeakerActorId ?? '') ?? position
    const dialogueNpcIds = [...mainlineDialogueParticipantNpcIds(scene, activeDialogue, activeDialogueLine)]
    const otherActorPosition = activeDialogueSpeakerActorId === 'protagonist'
      ? dialogueNpcIds.length === 1 ? resolvedNpcPositions.get(dialogueNpcIds[0]!) ?? position : position
      : position
    const room = mainlineInteractionRoom(scene, position)
    const stagePosition = activeDialogueSpeakerActorId && mainlineIsInteriorSpace(scene, position) && room
      ? mainlineDialogueSpeakerOutsidePosition({ speaker: speakerPosition, other: otherActorPosition, bounds: room.bounds, verticalGap: Math.max(7, Math.min(12, room.bounds.height * .18)) })
      : null
    if (stagePosition && speakerPosition.y !== otherActorPosition.y && Math.abs(speakerPosition.y - otherActorPosition.y) >= Math.abs(speakerPosition.x - otherActorPosition.x)) {
      dialogueAnchorSessionRef.current.outside.set(activeDialogueSpeakerKey, { side: speakerPosition.y < otherActorPosition.y ? 'above' : 'below', speakerY: speakerPosition.y })
    }
    dialogueAnchorSessionRef.current.positions.set(activeDialogueSpeakerKey, commercialStreetQuestionNarrative
      ? commercialStreetQuestionDialoguePosition(scene, position, dialogueAnchorText, readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)
      : stagePosition ?? sceneTextPresentationPosition(scene, position, dialogueAnchorText, readingMetrics, 'dialogue', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, position, readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)))
  }
  const activeDialoguePosition = activeDialogueLine ? dialogueAnchorSessionRef.current?.positions.get(activeDialogueSpeakerKey) ?? null : null
  const validatedSpawnKeyRef = useRef<string | null>(null)
  const spawnValidationKey = `${scene.id}:${initialPosition.x}:${initialPosition.y}:${screenMetrics.width}:${screenMetrics.height}`
  useIsomorphicLayoutEffect(() => {
    if (mainlineSafeSpawnValidationDecision(scene.id, activePlayerSeatId, validatedSpawnKeyRef.current, spawnValidationKey) !== 'validate') return
    validatedSpawnKeyRef.current = spawnValidationKey
    const safePosition = resolveMainlineSafeSpawnPosition(scene, initialPosition, layout, { screenMetrics })
    if (!safePosition || samePoint(safePosition, initialPosition) || !samePoint(getCurrentPosition(), initialPosition)) return
    resetMovement(safePosition)
    onPositionChange?.(safePosition)
    if (entryPosition) onSafeSpawnCorrection?.(safePosition)
  }, [activePlayerSeatId, entryPosition, getCurrentPosition, initialPosition, layout, onPositionChange, onSafeSpawnCorrection, resetMovement, scene, screenMetrics, spawnValidationKey])
  const externalExits = scene.externalExits
  const activeExternalExit = externalExits.find((boundary) => isMainlineExternalExitTriggered(position, boundary, scene))
  const gateTriggered = externalExits.some((boundary) => Boolean(boundary.triggerEntityId) && isMainlineExternalExitTriggered(position, boundary, scene))
  const lifecycleMainlinePassages = scene.passages
  const passageLifecycleDefinitions = useMemo(() => lifecycleMainlinePassages
    .map((passage) => {
      return {
        id: passage.id,
        region: mainlinePassageDoorRegion(
          passage,
          geometrySnapshot.passages.get(passage.id)?.collision ?? mainlinePassageCollisionForNavigation(scene, passage, { geometrySnapshot }),
          geometrySnapshot.passages.get(passage.id)?.doorway ?? mainlinePassageDoorwayForNavigation(scene, passage, { geometrySnapshot }),
        ),
      }
    }), [geometrySnapshot, lifecycleMainlinePassages, scene])
  const showLockedPassageText = useCallback((passage: MainlineScenePassage) => {
    const text = lockedPassageText(passage)
    sceneEchoIdRef.current += 1
    presentSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      passage.entityId,
      text,
      sceneTextPresentationPosition(scene, getCurrentPosition(), text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, getCurrentPosition(), readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)),
      'scene-observation',
      undefined,
    ))
  }, [activeViewportMetrics, cameraOffset, getCurrentPosition, presentSceneEcho, scene, screenMetrics])
  const showAccessRegionDeniedText = useCallback((text: string) => {
    sceneEchoIdRef.current += 1
    presentSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      undefined,
      text,
      sceneTextPresentationPosition(scene, getCurrentPosition(), text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, getCurrentPosition(), readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)),
      'scene-observation',
      undefined,
    ))
  }, [activeViewportMetrics, cameraOffset, getCurrentPosition, presentSceneEcho, scene, screenMetrics])
  const { requestPassage: requestPassageLifecycle, cancelPassage: cancelPassageLifecycle, updateActor: updatePassageLifecycle, getPassagePhase, isPassageActorActive, getOpenPassageIds, passageStates } = useAutomaticPassages({
    passages: passageLifecycleDefinitions,
    canOpen: (_actorId, passage) => lifecycleMainlinePassages.find((candidate) => candidate.id === passage.id)?.access === 'open',
    canUse: (_actorId, passage) => lifecycleMainlinePassages.find((candidate) => candidate.id === passage.id)?.access === 'open',
    onDenied: (_actorId, passage) => {
      const deniedPassage = lifecycleMainlinePassages.find((candidate) => candidate.id === passage.id)
      if (deniedPassage) {
        onDoorEvent?.('blocked', deniedPassage)
        showLockedPassageText(deniedPassage)
      }
    },
  })
  const navigationOptions = useMemo(() => ({ openPassageIds: getOpenPassageIds(), screenMetrics, geometrySnapshot, navigationRuntime, actorId: 'protagonist', actorFootprint: protagonistFootprint, npcRuntimePositions, occupiedSeatIds }), [geometrySnapshot, getOpenPassageIds, navigationRuntime, npcRuntimePositions, occupiedSeatIds, protagonistFootprint, screenMetrics])
  const navigationOptionsRef = useRef(navigationOptions)
  navigationOptionsRef.current = navigationOptions
  const takeawayWorkerOrderKeyRef = useRef('')
  useEffect(() => {
    const activeSpace = mainlineActiveSpatialSpaceId(scene, getCurrentPosition())
    const isMilk = activeSpace === 'commercial-south-s5-interior' && scene.npcs.some(npc => npc.id === milkTeaWorkerId)
    const isFruit = activeSpace === 'commercial-north-n1-interior' && scene.npcs.some(npc => npc.id === fruitTeaWorkerId)
    if (!isMilk && !isFruit) { takeawayWorkerOrderKeyRef.current = ''; return }
    const shopId = isMilk ? crossShopIds.milkTea : crossShopIds.fruitTea
    const order = shopOrders?.[shopId]
    const preparing = Boolean(order && order.status === 'queued' && typeof gameTimeMs === 'number' && gameTimeMs < order.readyAtGameTimeMs)
    const orderKey = order ? `${shopId}:${order.status}:${order.readyAtGameTimeMs}:${preparing}` : `${shopId}:idle`
    if (takeawayWorkerOrderKeyRef.current === orderKey) return
    takeawayWorkerOrderKeyRef.current = orderKey
    const movement = isMilk ? milkTeaWorkerMovement : fruitTeaWorkerMovement
    const workerId = isMilk ? milkTeaWorkerId : fruitTeaWorkerId
    const initial = isMilk ? milkTeaWorkerInitial : fruitTeaWorkerInitial
    const prefix = isMilk ? 'milk-tea-trial' : 'fruit-tea-trial'
    const intent = preparing
      ? { dutyId: `${prefix}.preparing`, targetId: `${prefix}-worktop`, targetEntityId: `${prefix}-equipment-1` }
      : { dutyId: order ? `${prefix}.waiting-pickup` : `${prefix}.return-to-station`, targetId: `${workerId}.station`, target: initial }
    movement.requestMove(intent, scene, layout, { ...navigationOptions, actorId: workerId })
  }, [fruitTeaWorkerInitial, fruitTeaWorkerMovement, fruitTeaWorkerId, gameTimeMs, getCurrentPosition, layout, milkTeaWorkerInitial, milkTeaWorkerMovement, milkTeaWorkerId, navigationOptions, scene, shopOrders])
  const getLiveNavigationOptions = useCallback(() => ({
    ...navigationOptionsRef.current,
    openPassageIds: getOpenPassageIds(),
  }), [getOpenPassageIds])
  const storefrontNavigationRef = useRef({ scene, layout, options: navigationOptions })
  storefrontNavigationRef.current = { scene, layout, options: navigationOptions }
  useEffect(() => {
    if (!presentationSnapshot) prepareMainlineWorldNavigation(scene, layout, navigationOptions)
  }, [scene, layout, navigationOptions, presentationSnapshot])
  const locomotionOptions = useMemo(() => ({
    ...sharedCharacterMovementOptions(movementMetrics),
    speedMultiplier: () => sceneTextSlowdownActiveRef.current ? .45 : 1,
  }), [movementMetrics])
  const protagonistLocomotionOptions = useMemo(() => ({
    ...protagonistCharacterMovementOptions(movementMetrics),
    speedMultiplier: () => sceneTextSlowdownActiveRef.current ? .45 : 1,
  }), [movementMetrics])
  const cafeCoffeeOwnerLocomotionOptions = useMemo(() => ({
    ...locomotionOptions,
    speedMultiplier: () => commercialCafeDutySpeedMultiplier(commercialCafeCoffeeOwnerNpcId, cafeCoffeeOwnerCurrentDutyRef.current, sceneTextSlowdownActiveRef.current),
  }), [locomotionOptions])
  useEffect(() => {
    if (!debugCafeFixture || debugCafeFixtureAppliedRef.current || !hasContinuousCafe(scene)) return
    debugCafeFixtureAppliedRef.current = true
    const sitPosition = resolveMainlineSeatSitPosition(scene, cafeConversationSeatId, layout, navigationOptions)
    if (!sitPosition) return
    stopMovement()
    resetMovement(sitPosition)
    navigationRuntime.updateActor('protagonist', sitPosition)
  }, [debugCafeFixture, layout, navigationOptions, navigationRuntime, resetMovement, scene, stopMovement])
  useEffect(() => {
    if (!debugCafePlayerPosition || debugCafePlayerPositionAppliedRef.current || !hasContinuousCafe(scene)) return
    if (!isWalkableMainlinePoint(debugCafePlayerPosition, scene, layout, navigationOptions)) return
    debugCafePlayerPositionAppliedRef.current = true
    stopMovement()
    resetMovement(debugCafePlayerPosition)
    navigationRuntime.updateActor('protagonist', debugCafePlayerPosition)
  }, [debugCafePlayerPosition, layout, navigationOptions, navigationRuntime, resetMovement, scene, stopMovement])
  useEffect(() => {
    if (!debugCafeServerBlocker || !hasContinuousCafe(scene)) return undefined
    // The full-contact QA obstacle is intentionally deferred until the
    // protagonist has seated and the delivery beat owns the coffee route.
    // Before that point it would also obstruct normal player setup paths.
    if (debugCafeServerBlockerMode === '1' && commercialCafeStory.narrativePhase !== 'coffee-delivery') return undefined
    const coffeeParentId = commercialCafeStoryTableId
    const coffeeTable = geometrySnapshot.objects.get(coffeeParentId)
    if (!coffeeTable) return undefined
    const allContacts = debugCafeServerBlockerMode === '1'
    // DEV/e2e-only dynamic reservations validate the same runtime registry as
    // production: one mode blocks the nearest static contact, the other every
    // contact. Neither changes save state or scene behavior outside DEV.
    const target = allContacts
      ? coffeeTable.position
      : debugCafeServerBlockerTargetRef.current ?? findMainlinePathToEntity(
        scene,
        coffeeParentId!,
        coffeeOwnerInitialPosition,
        layout,
        { ...navigationOptions, actorId: commercialCafeCoffeeOwnerNpcId, navigationRuntime: undefined },
      ).target
    if (!allContacts) debugCafeServerBlockerTargetRef.current = target
    navigationRuntime.registerActor(debugCafeServerBlockerId, target, {
      width: (allContacts ? 15 : .8) * 2,
      height: (allContacts ? 15 : .8) * 2,
    })
    return () => navigationRuntime.removeActor(debugCafeServerBlockerId)
  }, [commercialCafeStory.narrativePhase, debugCafeServerBlocker, debugCafeServerBlockerId, debugCafeServerBlockerMode, geometrySnapshot, layout, navigationOptions, navigationRuntime, scene, coffeeOwnerInitialPosition])
  useEffect(() => {
    if (!debugCafeStoryInterrupt || debugCafeStoryInterruptAppliedRef.current || !hasContinuousCafe(scene)) return
    const waitsForPublicService = debugCafeStoryInterruptMode === 'public'
    if (commercialCafeStory.status !== 'available' || cafeFloorServerMovement.snapshot.phase !== 'moving') return
    if (waitsForPublicService && cafeFloorServerMovement.snapshot.dutyId !== 'cafe-floor-server.table-service') return
    debugCafeStoryInterruptAppliedRef.current = true
    debugCafeStoryInterruptFromDutyRef.current = cafeFloorServerMovement.snapshot.dutyId
    setDebugCafeStoryStage('met-lao-zhou')
  }, [cafeFloorServerMovement.snapshot.dutyId, cafeFloorServerMovement.snapshot.phase, commercialCafeStory.status, debugCafeStoryInterrupt, debugCafeStoryInterruptMode, scene.id])
  useEffect(() => {
    if (!hasContinuousCafe(scene) || cafeCoffeeOwnerMovement.snapshot.phase !== 'blocked') return
    const timer = window.setTimeout(() => setCafeCoffeeMoveRetryTick((tick) => tick + 1), npcRetryDelay(300, cafeCoffeeOwnerMovement.snapshot.retryCount))
    return () => window.clearTimeout(timer)
  }, [cafeCoffeeOwnerMovement.snapshot.phase, cafeCoffeeOwnerMovement.snapshot.retryCount, scene.id])
  useEffect(() => () => {
    if (cafeCounterAmbientTimerRef.current !== null) window.clearTimeout(cafeCounterAmbientTimerRef.current)
    if (cafeFloorDwellTimerRef.current !== null) window.clearTimeout(cafeFloorDwellTimerRef.current)
  }, [])
  useEffect(() => {
    if (!hasContinuousCafe(scene) || cafeFloorServerMovement.snapshot.phase !== 'blocked') return
    const timer = window.setTimeout(() => setCafeFloorMoveRetryTick((tick) => tick + 1), npcRetryDelay(300, cafeFloorServerMovement.snapshot.retryCount))
    return () => window.clearTimeout(timer)
  }, [cafeFloorServerMovement.snapshot.phase, cafeFloorServerMovement.snapshot.retryCount, scene.id])
  useEffect(() => {
    if (!hasContinuousCafe(scene)) {
      commercialCafeCoffeeBehavior.reset()
      commercialCafeFloorBehavior.reset()
      return
    }
    if (!cafeCoffeeOwnerMovement.position) return
    if (cafeCoffeeOwnerMovement.snapshot.phase === 'blocked' && cafeCoffeeMoveRetryTick !== cafeCoffeeMoveRetryAppliedRef.current) {
      cafeCoffeeMoveRetryAppliedRef.current = cafeCoffeeMoveRetryTick
      commercialCafeCoffeeBehavior.retry()
    }
    const intent = commercialCafeCoffeeBehavior.request({
      scene, coffeeStatus: commercialCafeStory.coffeeStatus, narrativePhase: commercialCafeStory.narrativePhase,
      snapshot: cafeCoffeeOwnerMovement.snapshot,
    })
    if (!intent) return
    cafeCoffeeOwnerCurrentDutyRef.current = intent.dutyId
    const started = cafeCoffeeOwnerMovement.requestMove(intent, scene, layout, navigationOptions, {
      ...cafeCoffeeOwnerLocomotionOptions,
      onBlocked: () => commercialCafeCoffeeBehavior.block(),
    }, () => {
      if (intent.dutyId === 'cafe-coffee-owner.deliver-coffee') {
        const current = commercialCafeStoryStateFromSceneState(initialSceneState)
        const delivered = commercialCafeCoffeeDelivered(current)
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(delivered))
        setDialogueSegmentIndex(0)
        startDialogueTextSession()
        updateDialogueTextMotion('static')
        setCommercialCafeNarrative({ phase: 'delivery-line' })
        commercialCafeCoffeeBehavior.arrivedAtStoryTable()
      } else if (intent.dutyId === 'cafe-coffee-owner.return-to-counter') {
        cafeCoffeeOwnerCurrentDutyRef.current = null
        commercialCafeCoffeeBehavior.arrivedAtCounter()
        const current = commercialCafeStoryStateFromSceneState(initialSceneState)
        const resumed = commercialCafeFinishDeliveryReturn(current)
        if (resumed.narrativeCursor !== current.narrativeCursor) {
          recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(resumed))
          setDialogueLineIndex(resumed.narrativeCursor)
          setDialogueSegmentIndex(0)
          setCommercialCafeNarrative({ phase: 'active' })
          startDialogueTextSession()
        }
      } else if (intent.dutyId === 'cafe-coffee-owner.counter-ambient') {
        commercialCafeCoffeeBehavior.arrivedAtAmbientCounter()
        if (cafeCounterAmbientTimerRef.current !== null) window.clearTimeout(cafeCounterAmbientTimerRef.current)
        cafeCounterAmbientTimerRef.current = window.setTimeout(() => {
          cafeCounterAmbientTimerRef.current = null
          commercialCafeCoffeeBehavior.resumeAmbientCounter()
          setCafeCounterAmbientWakeTick((tick) => tick + 1)
        }, 900)
      }
    })
    if (!started) commercialCafeCoffeeBehavior.block()
  }, [cafeCoffeeMoveRetryTick, cafeCounterAmbientWakeTick, cafeCoffeeOwnerMovement, cafeCoffeeOwnerLocomotionOptions, commercialCafeCoffeeBehavior, commercialCafeStory.coffeeStatus, commercialCafeStory.narrativePhase, initialSceneState, layout, navigationOptions, recordSceneStatePatch, scene, setDialogueLineIndex, startDialogueTextSession, updateDialogueTextMotion])
  useEffect(() => {
    if (!hasContinuousCafe(scene)) {
      commercialCafeFloorBehavior.reset()
      return
    }
    if (!cafeFloorServerMovement.position) return
    // Seat occupancy is intentionally session-local. If a refresh drops that
    // local seat, release an in-flight reservation back to normal counter
    // pickup; the queued ready order itself remains durable and unduplicated.
    if (!activePlayerSeatId && cafeStoryOrderDelivery?.tableDelivery()) {
      cafeStoryOrderDelivery.retargetTableDelivery(null)
    }
    const tableReservation = activePlayerSeatId && cafeStoryOrderDelivery
      ? (() => {
        const started = cafeStoryOrderDelivery.beginTableDelivery(activePlayerSeatId)
        const pending = cafeStoryOrderDelivery.tableDelivery()
        return pending ?? (started?.ok && started.record?.seatId ? { orderId: started.record.order.id, seatId: started.record.seatId } : null)
      })()
      : cafeStoryOrderDelivery?.tableDelivery() ?? null
    if (tableReservation) {
      const seat = scene.objects.find(entity => entity.id === tableReservation.seatId && entity.kind === 'seat')
      if (seat && (cafeFloorServerMovement.snapshot.phase !== 'moving'
        || cafeFloorServerMovement.snapshot.dutyId !== 'cafe-floor-server.table-order-delivery'
        || cafeFloorServerMovement.snapshot.targetId !== seat.id)) {
        const started = cafeFloorServerMovement.requestMove({ dutyId: 'cafe-floor-server.table-order-delivery', targetId: seat.id, targetEntityId: seat.id }, scene, layout, navigationOptions, locomotionOptions, () => {
          const current = cafeStoryOrderDelivery?.tableDelivery()
          if (current?.orderId === tableReservation.orderId && current.seatId === activePlayerSeatId) {
            cafeStoryOrderDelivery?.completeTableDelivery(current.orderId, current.seatId)
          }
          setCafeFloorDwellWake(wake => wake + 1)
        })
        if (!started) return
      }
      return
    }
    if (cafeFloorServerMovement.snapshot.phase === 'moving' && cafeFloorServerMovement.snapshot.dutyId === 'cafe-floor-server.table-order-delivery') {
      return
    }
    if (cafeFloorServerMovement.snapshot.phase === 'blocked' && cafeFloorMoveRetryTick !== cafeFloorMoveRetryAppliedRef.current) {
      cafeFloorMoveRetryAppliedRef.current = cafeFloorMoveRetryTick
      commercialCafeFloorBehavior.retry()
    }
    const intent = commercialCafeFloorBehavior.request(scene, cafeFloorServerMovement.snapshot)
    if (!intent) return
    const serviceTarget = commercialCafeFloorServiceTarget(scene, cafeFloorServerMovement.position, intent, layout, navigationOptions)
    if (!serviceTarget) { commercialCafeFloorBehavior.block(); return }
    const started = cafeFloorServerMovement.requestMove({ ...intent, target: serviceTarget }, scene, layout, navigationOptions, locomotionOptions, () => {
      const dwellMs = commercialCafeFloorBehavior.arrived()
      cafeFloorDwellTimerRef.current = window.setTimeout(() => {
        cafeFloorDwellTimerRef.current = null
        commercialCafeFloorBehavior.finishDwell()
        setCafeFloorDwellWake((wake) => wake + 1)
      }, dwellMs)
    })
    if (!started) commercialCafeFloorBehavior.block()
  }, [activePlayerSeatId, cafeStoryOrderDelivery, cafeFloorDwellWake, cafeFloorMoveRetryTick, cafeFloorServerMovement, commercialCafeFloorBehavior, initialSceneState, layout, locomotionOptions, navigationOptions, scene])
  const runDebugFloorServerMovement = useCallback(() => {
    if (!hasContinuousCafe(scene) || !cafeFloorServerMovement.position || cafeFloorServerMovement.snapshot.phase === 'moving') return
    cafeFloorServerMovement.requestMove({
      dutyId: 'cafe-floor-server.debug-movement',
      targetId: 'commercial-cafe-floor-service-staging',
      target: floorServerInitialPosition,
    }, scene, layout, navigationOptions, locomotionOptions)
  }, [cafeFloorServerMovement, floorServerInitialPosition, layout, locomotionOptions, navigationOptions, scene])
  const handleFrameMotionProfileChange = useCallback((profile: readonly SceneFocusFrameMotionProfile[]) => {
    frameMotionProfileRef.current = profile
  }, [])
  const doorPhases = useMemo(() => new Map(passageLifecycleDefinitions
    .map((passage) => [
      scene.passages.find((candidate) => candidate.id === passage.id)?.entityId,
      passageStates.get(passage.id)?.phase ?? 'closed',
    ] as const)
    .filter((entry): entry is readonly [string, 'closed' | 'opening' | 'open' | 'crossing' | 'holding' | 'closing'] => Boolean(entry[0]))), [passageLifecycleDefinitions, passageStates, scene.passages])
  const armPassageFrameExit = useCallback((passage: MainlineScenePassage, remainingMovementMs?: number) => {
    if (passage.targetSceneId) {
      if (remainingMovementMs === undefined || !Number.isFinite(remainingMovementMs)) return
      setSceneFrameExit((current) => {
        const requestedGroups = current.phase === 'retracting'
          && current.passageEntityId === passage.entityId
          && current.scope === 'scene'
          ? current.requestedGroups ?? []
          : []
        const dueGroups = sceneFrameGroupsDueForExit(
          frameMotionProfileRef.current,
          new Set(requestedGroups),
          remainingMovementMs,
        )
        if (dueGroups.length === 0) return current
        return {
          phase: 'retracting',
          passageEntityId: passage.entityId,
          scope: 'scene',
          requestedGroups: [...requestedGroups, ...dueGroups],
        }
      })
      return
    }
    const scope = passage.frameBehavior === 'scene-retract' || passage.targetSceneId ? 'scene' : 'passage'
    setSceneFrameExit((current) => current.phase === 'retracting' && current.passageEntityId === passage.entityId && current.scope === scope
      ? current
      : { phase: 'retracting', passageEntityId: passage.entityId, scope })
  }, [])

  const denyLockedPassageAfterApproach = useCallback((passage: MainlineScenePassage, approachPath: readonly Point[] | null | undefined) => {
    const deny = () => {
      pendingTraversalRef.current = null
      pendingInteractionAfterTraversalRef.current = null
      stopMovement()
      setPassageDestination(null)
      setRequestedWorldTarget(null)
      setActiveObjectId(null)
      setSceneFrameExit({ phase: 'idle' })
      onDoorEvent?.('blocked', passage)
      showLockedPassageText(passage)
    }
    if (!approachPath?.length) {
      stopMovement()
      setPassageDestination(null)
      setRequestedWorldTarget(null)
      setActiveObjectId(null)
      // A directly clicked locked door is an explicit request. If no legal
      // approach path can be found, still explain why the door cannot be used
      // instead of leaving a clickable door with no response.
      onDoorEvent?.('blocked', passage)
      showLockedPassageText(passage)
      return
    }
    const routeLength = approachPath.slice(1).reduce((distance, point, index) => distance + Math.hypot(
      point.x - approachPath[index]!.x,
      point.y - approachPath[index]!.y,
    ), 0)
    // One actor footprint is the near-door zone. Far clicks walk to the same
    // legal approach point used by open passages before checking access.
    if (routeLength <= Math.max(protagonistFootprint.width, protagonistFootprint.height)) {
      deny()
      return
    }
    setPassageDestination(null)
    setActiveObjectId(null)
    moveAlong([...approachPath], deny, {
      ...protagonistLocomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
      onBlocked: () => {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setRequestedWorldTarget(null)
        setActiveObjectId(null)
        stopMovement()
      },
    })
  }, [getLiveNavigationOptions, layout, moveAlong, onDoorEvent, protagonistFootprint.height, protagonistFootprint.width, protagonistLocomotionOptions, scene, showLockedPassageText, stopMovement])

  const beginPassageLeg = useCallback(function beginPassageLeg(passage: MainlineScenePassage, requestedTarget: Point, plannedApproachPath: Point[] | null | undefined, continuationPath: Point[] | null | undefined, passageQueue: readonly MainlineScenePassage[], passageIndex: number, replanCount = 0) {
    pendingTraversalRef.current = null
    setSceneFrameExit({ phase: 'idle' })
    cancelPassageLifecycle('protagonist')
    const traversalStart = getCurrentPosition()
    const resolvedPath = plannedApproachPath !== undefined
      ? plannedApproachPath
      : canActorReachPassageApproach(scene, passage, traversalStart, layout, navigationOptions)?.path ?? null
    if (!resolvedPath) {
      stopMovement()
      return
    }
    const entity = getMainlineSceneEntity(scene, passage.entityId)
    // Reservations describe this door's crossing, not the final room destination.
    const crossingTarget = mainlinePassageExitPoint(passage, resolvedPath.at(-1) ?? traversalStart, protagonistFootprint,
      mainlinePassageCollisionForNavigation(scene, passage, navigationOptions),
      mainlinePassageDoorwayForNavigation(scene, passage, navigationOptions))
    setPassageDestination(requestedTarget)
    setActiveObjectId(passage.entityId)
    const approachMovementOptions = {
      ...protagonistLocomotionOptions,
      canOccupy: (point: Point) => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
      canTraverse: (start: Point, end: Point) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
    }
    const approachDurationMs = movementDurationMsForPath(resolvedPath, traversalStart, approachMovementOptions)
    pendingTraversalRef.current = { passage, passageQueue, passageIndex, requestedTarget, approachPath: resolvedPath, continuationPath, requestIssued: false, approachArrived: false }
    armPassageFrameExit(passage, approachDurationMs)
    const requestApproachOpening = (point: Point) => {
      const pending = pendingTraversalRef.current
      if (!pending || pending.passage.id !== passage.id) return
      const remainingMovementMs = getRemainingDurationMs()
      armPassageFrameExit(passage, remainingMovementMs)
      if (passage.access !== 'open' || pending.requestIssued || remainingMovementMs > sceneDoorMotion.openingMs + sceneDoorMotion.openingLeadMs) return
      pending.requestIssued = requestPassageLifecycle('protagonist', passage.id, point, crossingTarget)
      if (!pending.requestIssued) {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setSceneFrameExit({ phase: 'idle' })
        return
      }
      armPassageFrameExit(passage, remainingMovementMs)
    }
    moveAlong(resolvedPath, () => {
      const pending = pendingTraversalRef.current
      if (!pending || pending.passage.id !== passage.id) return
      pending.approachArrived = true
      if (!pending.requestIssued && !requestPassageLifecycle('protagonist', passage.id, getCurrentPosition(), crossingTarget)) {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setRequestedWorldTarget(null)
        setSceneFrameExit({ phase: 'idle' })
        return
      }
      pending.requestIssued = true
      armPassageFrameExit(passage, 0)
      const phase = getPassagePhase(passage.id)
      if (phase === 'open' || phase === 'crossing') continuePendingTraversalRef.current(entity.id)
    }, {
      ...approachMovementOptions,
      onBeforeMoveStep: requestApproachOpening,
      onMove: requestApproachOpening,
      onBlocked: () => {
        // Replan the same request against current actor occupancy at the legal stop.
        const approach = replanCount < 2
          ? canActorReachPassageApproach(scene, passage, getCurrentPosition(), layout, navigationOptions)
          : null
        if (approach) {
          beginPassageLeg(passage, requestedTarget, approach.path, continuationPath, passageQueue, passageIndex, replanCount + 1)
          return
        }
        pendingTraversalRef.current = null
        cancelPassageLifecycle('protagonist', passage.id)
        setPassageDestination(null)
        setSceneFrameExit({ phase: 'idle' })
        onDoorEvent?.('blocked', passage)
      },
    })
  }, [armPassageFrameExit, cancelPassageLifecycle, getCurrentPosition, getLiveNavigationOptions, getOpenPassageIds, getPassagePhase, getRemainingDurationMs, layout, lifecycleMainlinePassages, protagonistLocomotionOptions, moveAlong, navigationOptions, onDoorEvent, protagonistFootprint, requestPassageLifecycle, scene, screenMetrics, stopMovement])

  const continuePendingTraversal = useCallback((entityId: string) => {
    const pending = pendingTraversalRef.current
    if (!pending || pending.passage.entityId !== entityId) return
    if (!pending.approachArrived) return
    if (!isPassageActorActive('protagonist', pending.passage.id)) return
    // Consume approach arrival before crossing; lifecycle updates cannot restart this leg.
    pending.approachArrived = false
    const traversalStart = getCurrentPosition()
    const openNavigationOptions = getLiveNavigationOptions()
    if (pending.passage.targetSceneId) {
      const collision = mainlinePassageCollisionForNavigation(scene, pending.passage, openNavigationOptions)
      const doorway = mainlinePassageDoorwayForNavigation(scene, pending.passage, openNavigationOptions)
      const exitPoint = mainlinePassageExitPoint(pending.passage, traversalStart, protagonistFootprint, collision, doorway)
      const approachStart = pending.approachPath[0] ?? traversalStart
      const sourceSide = mainlinePassageSide(pending.passage, approachStart, collision, doorway)
      const targetSide: 0 | 1 = sourceSide === 1 ? 0 : 1
      let sceneTransitioned = false
      let previousTraversalPoint = traversalStart
      const transitionScene = (sourceCrossingPosition: Point, previousPoint: Point) => {
        if (sceneTransitioned) return
        sceneTransitioned = true
        const completesCommercialCafeStory = shouldCompleteCommercialCafeStoryOnTransition({ sceneId: scene.id, story: commercialCafeStory, targetSceneId: pending.passage.targetSceneId })
        if (completesCommercialCafeStory) {
          recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeStoryCompleted(commercialCafeStory, Date.now())))
          recordCafeAnalyticsMilestone('complete')
          onChapterAnalytics?.('cafe_completed')
        }
        onDoorEvent?.('crossed', pending.passage)
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setActiveObjectId(null)
        const targetSceneId = pending.passage.targetSceneId!
        const targetScene = mainlineScenes[targetSceneId]
        const targetLayout = getMainlineLayoutSnapshot(targetSceneId)
        const targetGeometry = createMainlineSceneGeometrySnapshot(
          targetScene,
          pending.passage.entryPosition ?? targetScene.initialPlayerPosition,
          targetLayout,
          screenMetrics,
        )
        const safeEntryPosition = resolveMainlineSafeEntryPosition(
          targetScene,
          scene.id,
          pending.passage.entryPosition,
          targetLayout,
          openNavigationOptions,
          targetGeometry,
        )
        if (!safeEntryPosition) {
          return
        }
        const transitionIntent = shouldUseLocalSlideForPassage(pending.passage)
          ? {
              kind: 'walking-passage' as const,
              presentation: 'local-slide' as const,
              passageId: pending.passage.id,
              sourceSceneId: scene.id,
              targetSceneId,
              sourceCrossingPosition,
              safeEntryPosition,
              slideDirection: localSlideDirectionForCrossing(previousPoint, sourceCrossingPosition),
            }
          : undefined
        notifySceneTransition(targetSceneId, safeEntryPosition, undefined, transitionIntent)
      }
      moveAlong([traversalStart, exitPoint], () => {
      }, {
        ...protagonistLocomotionOptions,
        onMove: (point) => {
          if (sceneTransitioned) return
          const crossedDoorway = mainlinePassageCrossesToSide(pending.passage, previousTraversalPoint, point, targetSide, collision, doorway)
          const previousPoint = previousTraversalPoint
          previousTraversalPoint = point
          if (!crossedDoorway) return
          transitionScene(point, previousPoint)
        },
        canOccupy: (point) => {
          const liveOptions = getLiveNavigationOptions()
          return isWalkableMainlinePoint(point, scene, layout, liveOptions)
            || (liveOptions.openPassageIds.has(pending.passage.id)
              && isMainlinePassageInTransitZone(pending.passage, point, protagonistFootprint, doorway))
        },
        canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
          onBlocked: () => {
            if (sceneTransitioned) {
              setSceneFrameExit({ phase: 'idle' })
              return
            }
            setPassageDestination(null)
          },
      })
      return
    }
    const completeSameSceneLeg = () => {
      const current = pendingTraversalRef.current
      if (!current || current.passage.entityId !== entityId) return
      onDoorEvent?.('crossed', current.passage)
      if (shouldCompleteCommercialCafeStoryOnTransition({ sceneId: scene.id, story: commercialCafeStory, targetSceneId: scene.id, passageId: current.passage.id, leavingRoom: mainlinePassageSide(current.passage, getCurrentPosition()) === 0 })) {
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeStoryCompleted(commercialCafeStory, Date.now())))
        recordCafeAnalyticsMilestone('complete')
        onChapterAnalytics?.('cafe_completed')
      }
      const nextPassage = current.passageQueue[current.passageIndex + 1]
      if (nextPassage) {
        const nextPath = findMainlinePathThroughPassage(scene, nextPassage.id, getCurrentPosition(), layout, openNavigationOptions).path
        if (!nextPath) {
          pendingTraversalRef.current = null
          setPassageDestination(null)
          setActiveObjectId(null)
          return
        }
        beginPassageLeg(nextPassage, current.requestedTarget, nextPath, null, current.passageQueue, current.passageIndex + 1)
        return
      }
      const continuation = current.continuationPath
        ? { path: current.continuationPath }
        : resolveMainlineWorldNavigation(
          scene,
          getCurrentPosition(),
          current.requestedTarget,
          layout,
          openNavigationOptions,
        )
      if (!continuation) {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setActiveObjectId(null)
        return
      }
      pendingTraversalRef.current = null
      moveAlong(continuation.path, () => {
        setPassageDestination(null)
        setActiveObjectId(null)
        const pendingInteractionId = pendingInteractionAfterTraversalRef.current
        pendingInteractionAfterTraversalRef.current = null
        if (pendingInteractionId) resumeInteractionRef.current(pendingInteractionId)
      }, {
        ...protagonistLocomotionOptions,
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
        canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
        onBlocked: () => {
          setPassageDestination(null)
          setActiveObjectId(null)
          pendingInteractionAfterTraversalRef.current = null
        },
      })
    }
    const collision = mainlinePassageCollisionForNavigation(scene, pending.passage, openNavigationOptions)
    const doorway = mainlinePassageDoorwayForNavigation(scene, pending.passage, openNavigationOptions)
    const exitPoint = mainlinePassageExitPoint(pending.passage, traversalStart, protagonistFootprint, collision, doorway)
    moveAlong([traversalStart, exitPoint], completeSameSceneLeg, {
      ...protagonistLocomotionOptions,
      canOccupy: (point) => {
        const liveOptions = getLiveNavigationOptions()
        return isWalkableMainlinePoint(point, scene, layout, liveOptions)
          || (liveOptions.openPassageIds.has(pending.passage.id)
            && isMainlinePassageInTransitZone(pending.passage, point, protagonistFootprint, doorway))
      },
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
      onBlocked: () => {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setActiveObjectId(null)
      },
    })
  }, [beginPassageLeg, commercialCafeStory, getCurrentPosition, getLiveNavigationOptions, getOpenPassageIds, isPassageActorActive, layout, protagonistLocomotionOptions, moveAlong, navigationOptions, notifySceneTransition, onDoorEvent, protagonistFootprint, recordCafeAnalyticsMilestone, recordSceneStatePatch, scene])

  continuePendingTraversalRef.current = continuePendingTraversal

  useEffect(() => {
    const pending = pendingTraversalRef.current
    if (!pending?.approachArrived || !pending.requestIssued) return
    if (!isPassageActorActive('protagonist', pending.passage.id)) return
    const phase = getPassagePhase(pending.passage.id)
    if (phase === 'open' || phase === 'crossing') continuePendingTraversalRef.current(pending.passage.entityId)
  }, [getPassagePhase, isPassageActorActive, passageStates])

  useEffect(() => {
    setSceneFrameExit(current => {
      if (current.phase !== 'retracting' || current.scope !== 'passage') return current
      const passage = scene.passages.find(candidate => candidate.entityId === current.passageEntityId)
      return passage && getPassagePhase(passage.id) === 'closed' ? { phase: 'idle' } : current
    })
  }, [getPassagePhase, passageStates, scene.passages])

  useEffect(() => () => {
    pendingTraversalRef.current = null
  }, [])

  useEffect(() => onPositionChange?.(position), [onPositionChange, position])
  const rideWalkingStart = useMemo(() => activePlayerSeatId
    ? mainlineInteractionTarget(scene, activePlayerSeatId, position, layout, undefined, {geometrySnapshot,screenMetrics,actorId:'protagonist'})
    : undefined, [activePlayerSeatId,geometrySnapshot,layout,position,scene,screenMetrics])
  useEffect(() => onRuntimePositionChange?.(scene.id, position, {
    layout, screenMetrics, cameraOffset,
    ...(rideWalkingStart ? { walkingStart: rideWalkingStart } : {}),
  }), [cameraOffset, layout, onRuntimePositionChange, position, rideWalkingStart, scene.id, screenMetrics])
  useEffect(() => {
    onPlayerMovementStateChange?.(moving)
    return () => onPlayerMovementStateChange?.(false)
  }, [moving, onPlayerMovementStateChange])

  useEffect(() => {
    const previousExternalExit = externalExits.find((boundary) => isMainlineExternalExitTriggered(previousExternalExitPositionRef.current, boundary, scene))
    const wasPastBoundary = Boolean(previousExternalExit)
    const isPastBoundary = Boolean(activeExternalExit)
    if (isPastBoundary && !wasPastBoundary) {
      if (activeExternalExit?.frameBehavior === 'scene-retract') {
        setSceneFrameExit({ phase: 'retracting', passageEntityId: activeExternalExit.id ?? 'external-exit', scope: 'scene' })
      }
      onExternalExit?.()
    }
    if (!isPastBoundary && wasPastBoundary) {
      setSceneFrameExit({ phase: 'idle' })
      onExternalReturn?.()
    }
    previousExternalExitPositionRef.current = position
  }, [activeExternalExit, externalExits, onExternalExit, onExternalReturn, position, scene])

  useEffect(() => {
    updatePassageLifecycle('protagonist', position, showProtagonist)
  }, [position, showProtagonist, updatePassageLifecycle])

  useEffect(() => {
    const cafeActive = hasContinuousCafe(scene)
    updatePassageLifecycle(commercialCafeCoffeeOwnerNpcId, cafeCoffeeOwnerMovement.position ?? coffeeOwnerInitialPosition, cafeActive && Boolean(cafeCoffeeOwnerMovement.position))
    updatePassageLifecycle(commercialCafeFloorServerNpcId, cafeFloorServerMovement.position ?? floorServerInitialPosition, cafeActive && Boolean(cafeFloorServerMovement.position))
    updatePassageLifecycle('lao-zhou', laoZhouMovement.position ?? laoZhouInitialPosition, cafeActive && Boolean(laoZhouMovement.position))
  }, [cafeCoffeeOwnerMovement.position, cafeFloorServerMovement.position, coffeeOwnerInitialPosition, floorServerInitialPosition, laoZhouInitialPosition, laoZhouMovement.position, scene.id, updatePassageLifecycle])

  useEffect(() => {
    updatePassageLifecycle(milkTeaWorkerId, milkTeaWorkerMovement.position ?? milkTeaWorkerInitial, Boolean(milkTeaWorkerMovement.position))
    updatePassageLifecycle(fruitTeaWorkerId, fruitTeaWorkerMovement.position ?? fruitTeaWorkerInitial, Boolean(fruitTeaWorkerMovement.position))
  }, [fruitTeaWorkerId, fruitTeaWorkerInitial, fruitTeaWorkerMovement.position, milkTeaWorkerId, milkTeaWorkerInitial, milkTeaWorkerMovement.position, updatePassageLifecycle])

  useEffect(() => () => stopMovement(), [stopMovement])

  const updateLayout = useCallback((itemId: string, point: Point) => {
    setDraftLayout((previous) => ({ ...(previous ?? committedLayout), [itemId]: point }))
    setLayoutSaveState('dirty')
  }, [committedLayout])

  const enterLayoutMode = useCallback(() => {
    setDraftLayout({ ...committedLayout })
    setLayoutSaveState('clean')
    setLayoutMode(true)
  }, [committedLayout])

  const exitLayoutMode = useCallback(() => {
    setDraftLayout(null)
    setLayoutSaveState('clean')
    setLayoutMode(false)
  }, [])

  const saveLayout = useCallback(() => {
    const nextLayout = draftLayout ?? committedLayout
    persistSceneLayout(scene.id, nextLayout)
    setSavedLayout(nextLayout)
    setDraftLayout(nextLayout)
    setLayoutSaveState('saved')
  }, [committedLayout, draftLayout, scene.id])

  const resetLayout = useCallback(() => {
    clearSceneLayout(scene.id)
    setSavedLayout({})
    setDraftLayout({})
    setLayoutSaveState('saved')
  }, [scene.id])

  const moveTo = useCallback((target: Point, onArrive?: () => void, plannedPath?: Point[] | null, framePassage?: MainlineScenePassage, onBlocked?: () => void) => {
    const approachingUse = Object.entries(cafeRestroomFixtureUsesRef.current).find(([, request]) => request?.phase === 'approaching')
    if (approachingUse) clearCafeRestroomFixtureUse(approachingUse[0], approachingUse[1]?.requestId)
    npcInteractionRequestRef.current += 1
    cancelPendingTakeawayWorkerResponseRef.current?.()
    cancelPendingTakeawayWorkerResponseRef.current = null
    pendingTraversalRef.current = null
    setSceneFrameExit({ phase: 'idle' })
    cancelPassageLifecycle('protagonist')
    setPassageDestination(null)
    const liveOptions = getLiveNavigationOptions()
    const path = plannedPath ?? findMainlinePath(getCurrentPosition(), target, scene, layout, liveOptions)
    if (!path) {
      stopMovement()
      return false
    }
    const movementOptions = {
      ...protagonistLocomotionOptions,
      canOccupy: (point: Point) => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
      canTraverse: (start: Point, end: Point) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
    }
    if (framePassage) {
      const movementDurationMs = movementDurationMsForPath(path, getCurrentPosition(), movementOptions)
      armPassageFrameExit(framePassage, movementDurationMs)
    }
    moveAlong(path, onArrive, {
      ...movementOptions,
      onMove: () => {
        if (!framePassage) return
        armPassageFrameExit(framePassage, getRemainingDurationMs())
      },
      onBlocked: () => {
        if (framePassage) setSceneFrameExit({ phase: 'idle' })
        onBlocked?.()
      },
    })
    return true
  }, [armPassageFrameExit, cancelPassageLifecycle, clearCafeRestroomFixtureUse, getCurrentPosition, getLiveNavigationOptions, getRemainingDurationMs, layout, protagonistLocomotionOptions, moveAlong, navigationOptions, scene, stopMovement])

  const startCafeRestroomFixtureUse = useCallback((entityId: string) => {
    const entity = scene.objects.find((candidate) => candidate.id === entityId && candidate.interactionBehavior === 'cafe-restroom-use')
    const durationMs = cafeRestroomFixtureUseDurationMs(entityId)
    if (scene.id !== 'commercial-street' || !entity || durationMs === undefined || !mainlineEntityBelongsToActiveSpace(entity, mainlineActiveSpatialSpaceId(scene, getCurrentPosition()))) {
      onInteractionAnalytics?.('blocked', entityId, 'fixture', 'target-invalid')
      clearCafeRestroomFixtureUse(entityId)
      return
    }
    const currentUse = cafeRestroomFixtureUsesRef.current[entityId]
    if (currentUse?.phase === 'using' && currentUse.sceneId === scene.id) return
    if (currentUse?.phase === 'approaching') return
    const requestId = (cafeRestroomFixtureUseRequestIdsRef.current[entityId] ?? 0) + 1
    cafeRestroomFixtureUseRequestIdsRef.current[entityId] = requestId
    const request: CafeRestroomFixtureUseRequest = { phase: 'approaching', requestId, sceneId: scene.id }
    cafeRestroomFixtureUsesRef.current[entityId] = request
    setCafeRestroomFixtureUsePhases((phases) => ({ ...phases, [entityId]: 'approaching' }))
    setActiveObjectId(null)

    const beginUseAtTarget = () => {
      const pending = cafeRestroomFixtureUsesRef.current[entityId]
      const currentEntity = scene.objects.find((candidate) => candidate.id === entityId && candidate.interactionBehavior === 'cafe-restroom-use')
      if (pending?.requestId !== requestId || pending.sceneId !== scene.id || !currentEntity
        || !mainlineEntityBelongsToActiveSpace(currentEntity, mainlineActiveSpatialSpaceId(scene, getCurrentPosition()))) {
        clearCafeRestroomFixtureUse(entityId, requestId)
        onInteractionAnalytics?.('blocked', entityId, 'fixture', 'target-invalid')
        return
      }
      const arrival = resolveMainlineEntityInteraction(scene, entityId, getCurrentPosition(), layout, getLiveNavigationOptions())
      if (!arrival.inRange) {
        clearCafeRestroomFixtureUse(entityId, requestId)
        onInteractionAnalytics?.('blocked', entityId, 'fixture', 'target-unreached')
        return
      }
      stopMovement()
      const startedAtGameTimeMs = readGameTimeMs()
      cafeRestroomFixtureUsesRef.current[entityId] = { ...pending, phase: 'using', startedAtGameTimeMs }
      setCafeRestroomFixtureUsePhases((phases) => ({ ...phases, [entityId]: 'using' }))
      setActiveObjectId(entityId)
      onInteractionAnalytics?.('completed', entityId, 'fixture', 'used')
      // RAF only polls the injected simulation clock. A frozen/slow game clock
      // cannot finish this action early, and no real-time fallback is scheduled.
      const finishWhenGameTimeElapsed = () => {
        const current = cafeRestroomFixtureUsesRef.current[entityId]
        if (current?.requestId !== requestId || current.sceneId !== scene.id) return
        if (readGameTimeMs() - (current.startedAtGameTimeMs ?? startedAtGameTimeMs) < durationMs) {
          cafeRestroomFixtureUseFramesRef.current[entityId] = window.requestAnimationFrame(finishWhenGameTimeElapsed)
          return
        }
        delete cafeRestroomFixtureUseFramesRef.current[entityId]
        cafeRestroomFixtureUseRequestIdsRef.current[entityId] = (cafeRestroomFixtureUseRequestIdsRef.current[entityId] ?? 0) + 1
        delete cafeRestroomFixtureUsesRef.current[entityId]
        setCafeRestroomFixtureUsePhases((phases) => { const next = { ...phases }; delete next[entityId]; return next })
        setActiveObjectId((currentId) => currentId === entityId ? null : currentId)
      }
      cafeRestroomFixtureUseFramesRef.current[entityId] = window.requestAnimationFrame(finishWhenGameTimeElapsed)
    }

    const interaction = resolveMainlineEntityInteraction(scene, entityId, getCurrentPosition(), layout, getLiveNavigationOptions())
    if (interaction.inRange) {
      beginUseAtTarget()
      return
    }
    if (!interaction.path?.length) {
      clearCafeRestroomFixtureUse(entityId, requestId)
      onInteractionAnalytics?.('blocked', entityId, 'fixture', 'unreachable')
      return
    }
    moveAlong(interaction.path, beginUseAtTarget, {
      ...protagonistLocomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
      onBlocked: () => {
        clearCafeRestroomFixtureUse(entityId, requestId)
        onInteractionAnalytics?.('blocked', entityId, 'fixture', 'movement-blocked')
      },
    })
  }, [clearCafeRestroomFixtureUse, getCurrentPosition, getLiveNavigationOptions, layout, moveAlong, onInteractionAnalytics, protagonistLocomotionOptions, readGameTimeMs, scene, stopMovement])

  const leavePlayerSeat = useCallback(() => {
    if (!activePlayerSeatId) return false
    if (hasContinuousCafe(scene)) cafeStoryOrderDelivery?.retargetTableDelivery(null)
    const standingPosition = mainlineInteractionTarget(scene, activePlayerSeatId, getCurrentPosition(), layout, undefined, navigationOptions)
    setPlayerSeatId(null)
    setActiveObjectId((current) => current === activePlayerSeatId ? null : current)
    resetMovement(standingPosition)
    navigationRuntime.updateActor('protagonist', standingPosition)
    return true
  }, [activePlayerSeatId, cafeStoryOrderDelivery, getCurrentPosition, layout, navigationRuntime, navigationOptions, resetMovement, scene])

  const startNpcDialogue = useCallback((resolution: NpcDialogueResolution, existingDisplaySessionId?: string) => {
    stopMovement()
    const displaySessionId = existingDisplaySessionId ?? `conversation:${++conversationDisplaySessionIdRef.current}`
    setConversationDisplaySessionId(displaySessionId)
    setDialogueSegmentIndex(0)
    setGenericDialoguePhase('active')
    setNpcDialogue(resolution)
    setDialogueLineIndex(0)
    startDialogueTextSession()
    if (resolution.promptSeatId) setPromptedSeatId(resolution.promptSeatId)
  }, [startDialogueTextSession, stopMovement])
  const interactRuoyuCafe = useCallback(() => {
    if (!hasContinuousCafe(scene) || initialSceneState[ruoyuCafeUnlockedKey] !== true) return
    const meetingComplete = ruoyuCafeMeetingCompleted(initialSceneState)
    if (meetingComplete) {
      const followup = ruoyuCafeFollowupLine(initialSceneState, 'ruoyu')
      if (!followup) return
      recordSceneState(scene.id, followup.key, (typeof initialSceneState[followup.key] === 'number' ? initialSceneState[followup.key] as number : 0) + 1)
      const point = getCurrentPosition()
      sceneEchoIdRef.current += 1
      const displaySessionId = `conversation:${++conversationDisplaySessionIdRef.current}`
      setConversationDisplaySessionId(displaySessionId)
      presentSceneEcho(createMainlineSceneEcho(sceneEchoIdRef.current, 'ruoyu', followup.text,
        sceneTextPresentationPosition(scene, point, followup.text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, point, readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)), 'scene-observation', undefined, undefined, displaySessionId))
      return
    }
    const ruoyuSeatId = ruoyuCafeSeatFromSceneState(initialSceneState)
    if (!ruoyuSeatId) return
    const requestId = ++npcInteractionRequestRef.current
    const conversationSeatId = ruoyuCafeConversationSeatId(ruoyuSeatId)
    const startMeeting = () => {
      const cursor = ruoyuCafeMeetingCursorFromSceneState(initialSceneState)
      const dialogue: NpcDialogueResolution = { kind: 'dialogue', dialogue: ruoyuCafeMeetingDialogue }
      startNpcDialogue(dialogue)
      setDialogueLineIndex(cursor)
      recordSceneState(scene.id, ruoyuCafeMeetingStatusKey, 'in-progress')
      recordSceneState(scene.id, ruoyuCafeMeetingCursorKey, cursor)
    }
    if (activePlayerSeatId === conversationSeatId) { startMeeting(); return }
    leavePlayerSeat()
    const resolved = findMainlinePathToEntity(scene, conversationSeatId, getCurrentPosition(), layout, navigationOptions)
    const sitPosition = resolveMainlineSeatSitPosition(scene, conversationSeatId, layout, navigationOptions)
    if (!resolved.path || !sitPosition || nextMainlinePlayerSeatId(scene, activePlayerSeatId, conversationSeatId, occupiedSeatIds) !== conversationSeatId) {
      stopMovement()
      return
    }
    setActiveObjectId(conversationSeatId)
    moveAlong(resolved.path, () => {
      if (npcInteractionRequestRef.current !== requestId) return
      resetMovement(sitPosition)
      navigationRuntime.updateActor('protagonist', sitPosition)
      setPlayerSeatId(conversationSeatId)
      setActiveObjectId(null)
      startMeeting()
    }, {
      ...protagonistLocomotionOptions,
      preserveNavigationRoute: true,
      canOccupy: point => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
      onBlocked: () => { if (npcInteractionRequestRef.current === requestId) setActiveObjectId(null) },
    })
  }, [activePlayerSeatId, activeViewportMetrics, cameraOffset, getCurrentPosition, getLiveNavigationOptions, initialSceneState, layout, leavePlayerSeat, moveAlong, navigationOptions, navigationRuntime, protagonistLocomotionOptions, readingMetrics, recordSceneState, resetMovement, scene, startNpcDialogue, stopMovement])
  const interactXiujieFollowup = useCallback(() => {
    if (!ruoyuCafeMeetingCompleted(initialSceneState)) return
    const followup = ruoyuCafeFollowupLine(initialSceneState, 'xiujie')
    if (!followup) return
    recordSceneState(scene.id, followup.key, (typeof initialSceneState[followup.key] === 'number' ? initialSceneState[followup.key] as number : 0) + 1)
    const point = getCurrentPosition()
    sceneEchoIdRef.current += 1
    presentSceneEcho(createMainlineSceneEcho(sceneEchoIdRef.current, 'lao-zhou', followup.text,
      sceneTextPresentationPosition(scene, point, followup.text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, point, readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)), 'scene-observation'))
  }, [activeViewportMetrics, cameraOffset, getCurrentPosition, initialSceneState, readingMetrics, recordSceneState, scene])
  const startCommercialCafeNarrative = useCallback(() => {
    if (!hasContinuousCafe(scene) || commercialCafeStory.status !== 'available') return
    stopMovement()
    setConversationDisplaySessionId(`conversation:${++conversationDisplaySessionIdRef.current}`)
    setNpcDialogue(null)
    setDialogueSegmentIndex(0)
    setDialogueLineIndex(commercialCafeStory.narrativeCursor)
    setCommercialCafeNarrative({ phase: 'active' })
    startDialogueTextSession()
    recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeNarrativeStarted(commercialCafeStory)))
    const stage = commercialCafeAnalyticsStageForCursor(commercialCafeStory.narrativeCursor)
    if (stage) recordCafeAnalyticsMilestone(stage)
  }, [commercialCafeStory, recordCafeAnalyticsMilestone, recordSceneStatePatch, scene.id, startDialogueTextSession, stopMovement])

  const startPassageTraversal = useCallback((passage: MainlineScenePassage, requestedTarget: Point, plannedApproachPath?: Point[] | null, continuationPath?: Point[] | null, passageQueue: readonly MainlineScenePassage[] = [passage], passageIndex = 0) => {
    if (sceneAction?.phase === 'committing') return
    cancelSceneAction()
    dismissSceneEcho()
    if (passage.access !== 'open') {
      cancelPassageLifecycle('protagonist', passage.id)
      const path = plannedApproachPath ?? canActorReachPassageApproach(scene, passage, getCurrentPosition(), layout, navigationOptions)?.path
      denyLockedPassageAfterApproach(passage, path)
      return
    }
    beginPassageLeg(passage, requestedTarget, plannedApproachPath, continuationPath, passageQueue, passageIndex)
  }, [beginPassageLeg, cancelPassageLifecycle, cancelSceneAction, denyLockedPassageAfterApproach, dismissSceneEcho, getCurrentPosition, layout, navigationOptions, scene, sceneAction?.phase])

  const presentYongheEcho = useCallback((text: string, options?: readonly string[], entityId = 'yonghe-trial-worker', optionFlow?: MainlineSceneChoiceFlow, existingDisplaySessionId?: string) => {
    sceneEchoIdRef.current += 1
    const displaySessionId = optionFlow === 'dialogue-choice'
      ? existingDisplaySessionId ?? `conversation:${++conversationDisplaySessionIdRef.current}`
      : existingDisplaySessionId
    if (displaySessionId) setConversationDisplaySessionId(displaySessionId)
    const currentPosition = getCurrentPosition()
    const worldScale = mainlineWorldScale(activeViewportMetrics)
    const actionCameraOffset = mainlineReadingCameraOffset(scene, currentPosition, readingMetrics, worldScale, cameraOffset)
    presentSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      entityId,
      text,
      sceneTextPresentationPosition(scene, currentPosition, text, readingMetrics, 'observation', worldScale, actionCameraOffset),
      options ? 'menu-reading' : 'scene-observation',
      options,
      optionFlow,
      displaySessionId,
    ))
  }, [activeViewportMetrics, cameraOffset, getCurrentPosition, presentSceneEcho, readingMetrics, scene])
  const presentCommercialDrinkEcho = useCallback((workerId: string, text: string, options?: readonly string[], existingDisplaySessionId?: string) => {
    sceneEchoIdRef.current += 1
    const displaySessionId = existingDisplaySessionId ?? `conversation:${++conversationDisplaySessionIdRef.current}`
    setConversationDisplaySessionId(displaySessionId)
    const currentPosition = getCurrentPosition()
    const worldScale = mainlineWorldScale(activeViewportMetrics)
    const actionCameraOffset = mainlineReadingCameraOffset(scene, currentPosition, readingMetrics, worldScale, cameraOffset)
    presentSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      workerId,
      text,
      sceneTextPresentationPosition(scene, currentPosition, text, readingMetrics, 'observation', worldScale, actionCameraOffset),
      options ? 'menu-reading' : 'scene-observation',
      options,
      options ? 'dialogue-choice' : undefined,
      displaySessionId,
    ))
  }, [activeViewportMetrics, cameraOffset, getCurrentPosition, presentSceneEcho, readingMetrics, scene])
  const lastYongheOrderFeedbackRef = useRef(0)
  const lastYongheReadyCueRef = useRef<string | null>(null)
  const pendingYongheReadyCueRef = useRef<{ id: string; text: string } | null>(null)
  const recommendedDrinkRef = useRef<{ shopId: string; productId: string } | null>(null)
  useEffect(() => {
    if (!isYongheTakeawayScene(scene.id)) return
    let orderFeedbackShown = false
    if (yongheOrderFeedback > lastYongheOrderFeedbackRef.current) {
      lastYongheOrderFeedbackRef.current = yongheOrderFeedback
      presentYongheEcho('行，你找个地方坐会儿吧。')
      orderFeedbackShown = true
    }
    if (yongheReadyCue && lastYongheReadyCueRef.current !== yongheReadyCue.id) {
      lastYongheReadyCueRef.current = yongheReadyCue.id
      pendingYongheReadyCueRef.current = yongheReadyCue
    }
    if (!orderFeedbackShown && !sceneEcho && pendingYongheReadyCueRef.current) {
      const cue = pendingYongheReadyCueRef.current
      pendingYongheReadyCueRef.current = null
      presentYongheEcho(cue.text)
    }
  }, [presentYongheEcho, scene.id, sceneEcho, yongheOrderFeedback, yongheReadyCue])

  const interact = useCallback((entityId: string, requestAlreadyRecorded = false, counterContact?: { partId: string; point: Point }) => {
    if (readingActive || sceneAction?.phase === 'committing') return
    if (sceneAction?.entityId === entityId && sceneAction.phase === 'active') return
    const approachingUse = Object.entries(cafeRestroomFixtureUsesRef.current).find(([, request]) => request?.phase === 'approaching')
    if (approachingUse) clearCafeRestroomFixtureUse(approachingUse[0], approachingUse[1]?.requestId)
    const entity = getMainlineSceneEntity(scene, entityId)
    if (!mainlineEntityBelongsToActiveSpace(entity, mainlineActiveSpatialSpaceId(scene, getCurrentPosition()))) {
      onInteractionAnalytics?.('blocked', entityId, entity.kind, 'outside-space')
      return
    }
    cancelSceneAction()
    const requestId = ++npcInteractionRequestRef.current
    cancelPendingTakeawayWorkerResponseRef.current?.()
    cancelPendingTakeawayWorkerResponseRef.current = null
    setRequestedWorldTarget(null)
    if (phoneOpen) onPhoneDismiss?.()
    setDialogueLineIndex(null)
    setNpcDialogue(null)
    setCommercialCafeNarrative(null)
    dismissSceneEcho()
    const passage = scene.passages.find((candidate) => candidate.entityId === entityId)
    if (!requestAlreadyRecorded) pendingInteractionAfterTraversalRef.current = null
    if (!requestAlreadyRecorded) onInteractionAnalytics?.('requested', entityId, passage ? 'door' : entity.kind)
    if (entity.interactionBehavior === 'cafe-restroom-use') {
      setActiveObjectId(null)
      setSceneAction(createSceneAction({ entityId: entity.id, options: ['使用'], optionFlow: 'world-action', position: entity.position, cameraOffset }))
      return
    }
    if (entity.kind === 'seat' && entity.seat) {
      const nextSeatId = nextMainlinePlayerSeatId(scene, activePlayerSeatId, entity.id, occupiedSeatIds)
      if (nextSeatId !== entity.id) {
        stopMovement()
        onInteractionAnalytics?.('blocked', entity.id, 'seat', 'already-seated')
        return
      }
      leavePlayerSeat()
      const resolved = findMainlinePathToEntity(scene, entity.id, getCurrentPosition(), layout, navigationOptions)
      const sitPosition = resolveMainlineSeatSitPosition(scene, entity.id, layout, navigationOptions)
      if (!resolved.path || !sitPosition) {
        stopMovement()
        onInteractionAnalytics?.('blocked', entity.id, 'seat', 'unreachable')
        return
      }
      setActiveObjectId(entity.id)
      moveAlong(resolved.path, () => {
        if (!mainlineEntityBelongsToActiveSpace(entity, mainlineActiveSpatialSpaceId(scene, sitPosition))) {
          setActiveObjectId(null)
          onInteractionAnalytics?.('blocked', entity.id, 'seat', 'outside-space')
          return
        }
        resetMovement(sitPosition)
        navigationRuntime.updateActor('protagonist', sitPosition)
        setPlayerSeatId(nextSeatId)
        if (hasContinuousCafe(scene)) cafeStoryOrderDelivery?.beginTableDelivery(nextSeatId)
        setPromptedSeatId(null)
        markEntityExplored(entity.id)
        onInteractionAnalytics?.('completed', entity.id, 'seat', 'seated')
        const resolution = resolveCommercialCafeNpcInteraction({
          sceneId: scene.id,
          npcId: 'lao-zhou',
          story: commercialCafeStory,
          playerSeatId: nextSeatId,
          conversationSeatId: cafeConversationSeatId,
        })
        if (resolution?.kind === 'start-narrative') startCommercialCafeNarrative()
      }, {
        ...protagonistLocomotionOptions,
        // A seat remains a two-step interaction exception. Its route may need
        // to keep the planner's turn around the paired table before the final
        // pulled/sit transition; generic smoothing must not straighten that
        // legal route back through furniture.
        preserveNavigationRoute: true,
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
        canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
        onBlocked: () => {
          setActiveObjectId(null)
          onInteractionAnalytics?.('blocked', entity.id, 'seat', 'movement-blocked')
        },
      })
      return
    }
    leavePlayerSeat()
    if (passage?.id === 'yonghe-warehouse-door' && entity.interactionBehavior === 'yonghe-warehouse') {
      // This locked portal is an interactive scene object, not a traversal.
      // Generic door contact can land on the alley's outer boundary; keep the
      // final position safely inside its authored space so the space check,
      // door glyph and action card remain mounted after movement completes.
      const alley = scene.rooms.find(room => room.id === entity.spaceId)
      const contact = resolveMainlineEntityInteraction(scene, entity.id, getCurrentPosition(), layout, navigationOptions)
      const marginX = protagonistFootprint.width / 2 + .1
      const marginY = protagonistFootprint.height / 2 + .1
      const safeTarget = alley && contact.path
        ? {
            x: Math.max(alley.bounds.x + marginX, Math.min(alley.bounds.x + alley.bounds.width - marginX, contact.target.x)),
            y: Math.max(alley.bounds.y + marginY, Math.min(alley.bounds.y + alley.bounds.height - marginY, contact.target.y)),
          }
        : null
      const approachPath = safeTarget && mainlineActiveSpatialSpaceId(scene, safeTarget) === entity.spaceId
        ? findMainlinePath(getCurrentPosition(), safeTarget, scene, layout, navigationOptions)
        : null
      if (!approachPath) {
        stopMovement()
        setActiveObjectId(null)
        onInteractionAnalytics?.('blocked', entity.id, 'door', 'unreachable')
        return
      }
      const presentWarehouseAction = () => {
        const actionPosition = getCurrentPosition()
        setActiveObjectId(null)
        setSceneAction(createSceneAction({
          entityId: entity.id,
          options: ['推一下门'],
          optionFlow: 'world-action',
          position: actionPosition,
          cameraOffset,
        }))
        markEntityExplored(entity.id)
        onInteractionAnalytics?.('completed', entity.id, 'door', 'approached-locked-warehouse')
      }
      if (approachPath.length <= 1) {
        stopMovement()
        presentWarehouseAction()
      } else {
        setActiveObjectId(entity.id)
        moveAlong(approachPath, presentWarehouseAction, {
          ...protagonistLocomotionOptions,
          canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
          canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
          onBlocked: () => {
            setActiveObjectId(null)
            onInteractionAnalytics?.('blocked', entity.id, 'door', 'movement-blocked')
          },
        })
      }
      return
    }
    if (passage && entityId !== 'yonghe-warehouse-door') {
      if (passage.access !== 'open') {
        const approach = canActorReachPassageApproach(scene, passage, getCurrentPosition(), layout, navigationOptions)
        denyLockedPassageAfterApproach(passage, approach?.path)
        return
      }
      // A direct door click is an explicit request to use that door. Resolve
      // the opposite side from the same projected doorway used by movement,
      // then let the shared lifecycle open and complete the crossing.
      const collision = mainlinePassageCollisionForNavigation(scene, passage, navigationOptions)
      const doorway = mainlinePassageDoorwayForNavigation(scene, passage, navigationOptions)
      const side = mainlinePassageSide(passage, getCurrentPosition(), collision, doorway)
      const approach = canActorReachPassageApproach(scene, passage, getCurrentPosition(), layout, navigationOptions)
      if (!approach) {
        stopMovement()
        onDoorEvent?.('blocked', passage)
        return
      }
      onDoorEvent?.('attempted', passage)
      startPassageTraversal(passage, passage.crossingTargets[side], approach.path)
      return
    }

    const revealInteraction = () => {
      if (npcInteractionRequestRef.current !== requestId) return
      if (!mainlineEntityBelongsToActiveSpace(entity, mainlineActiveSpatialSpaceId(scene, getCurrentPosition()))) {
        interactionStartedAtRef.current = null
        setActiveObjectId(null)
        onInteractionAnalytics?.('blocked', entity.id, entity.kind, 'outside-space')
        return
      }
      const interactionStartedAt = interactionStartedAtRef.current
      interactionStartedAtRef.current = null
      if (entity.id === 'yonghe-menu' && isYongheTakeawayScene(scene.id)) {
        presentYongheEcho(yongheMenuText(), undefined, 'yonghe-menu')
        setActiveObjectId(null)
        onInteractionAnalytics?.('completed', entity.id, entity.kind, 'menu-read')
        return
      }
      if (entity.id === 'commercial-s5-milk-tea-app-square' && !commercialStreetMilkTeaAppUnlocked(initialSceneState)) {
        recordSceneStatePatch(scene.id, commercialStreetMilkTeaAppUnlockPatch())
      } else if (entity.id === 'fruit-tea-trial-app-square' && !commercialStreetFruitTeaAppUnlocked(initialSceneState)) {
        recordSceneStatePatch(scene.id, commercialStreetFruitTeaAppUnlockPatch())
      } else if (entity.id === 'commercial-cafe-app-square' && !commercialStreetCafeAppUnlocked(initialSceneState)) {
        recordSceneStatePatch(scene.id, commercialStreetCafeAppUnlockPatch())
      }
      const commerceResult = onCommerceEntity?.(entity)
      if (commerceResult) {
        if (typeof commerceResult === 'object') {
          sceneEchoIdRef.current += 1
          presentSceneEcho(createMainlineSceneEcho(sceneEchoIdRef.current, entity.id, commerceResult.text,
            sceneTextPresentationPosition(scene, getCurrentPosition(), commerceResult.text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, getCurrentPosition(), readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)),
            clockActivityForExploration(entity, Boolean(commerceResult.options)), commerceResult.options,
            commerceResult.options ? 'commerce-choice' : undefined))
        }
        onInteractionAnalytics?.('completed', entity.id, entity.kind, 'commerce-handled')
        setActiveObjectId(null)
        return
      }
      if (commercialStreetDrinkShopForInteraction(entity.id)) {
        recommendedDrinkRef.current = null
        presentCommercialDrinkEcho(entity.id, commercialStreetDrinkShopDialogue.welcome, ['点单', commercialStreetDrinkShopDialogue.recommendationRequest])
        setActiveObjectId(null)
        onInteractionAnalytics?.('completed', entity.id, entity.kind, 'drink-shop-dialogue-started')
        return
      }
      onObjectInteraction?.(entity, Math.max(0, Date.now() - (interactionStartedAt ?? Date.now())))
      onInteractionAnalytics?.('completed', entity.id, entity.kind, 'interacted')
      const exploration = resolveMainlineSceneExploration(scene, entity, {
        incensePhase,
        plantWatered: entity.id === 'zhongshuyuan-office-plant'
          ? plantIsWatered(plantWateredAt, Date.now())
          : plantIsWatered(typeof initialSceneState[`plantWateredAt:${entity.id}`] === 'number' ? initialSceneState[`plantWateredAt:${entity.id}`] as number : null, Date.now()),
        plantHealthyText: entity.id.startsWith('zhongshuyuan-office-port-plant-')
          && plantIsWatered(typeof initialSceneState[`plantWateredAt:${entity.id}`] === 'number' ? initialSceneState[`plantWateredAt:${entity.id}`] as number : null, Date.now())
          ? '叶子翠绿翠绿的，看起来很有活力'
          : undefined,
        plantWaterStateKey: entity.id === 'zhongshuyuan-office-plant' ? undefined : `plantWateredAt:${entity.id}`,
        officeBlindsOpen,
        carriedPhoneDevice,
        commercialCafeCoffeeOrdered: commercialCafeCoffeeOrderedState(commercialCafeStory),
        carriedMilkTea: carryingMilkTea,
      })
      const explorationChoice = exploration.choice
      const explorationPool = exploration.pool
      const availableExplorationPool = explorationPool ?? []
      const hasExplorationContent = Boolean(explorationChoice || availableExplorationPool.length)
      const startsDialogue = scene.dialogue?.triggerEntityId === entity.id
      if (mainlineExplorationChoiceIsActionOnly(explorationChoice)) {
        setSceneAction(createSceneAction({ entityId: entity.id, options: explorationChoice.options, optionFlow: explorationChoice.optionFlow ?? 'world-action', position: entity.position, cameraOffset }))
        markEntityExplored(entityId)
        return
      }
      if (hasExplorationContent) {
        const text = explorationChoice?.text ?? availableExplorationPool[Math.floor(Math.random() * availableExplorationPool.length)]
        const dialogueChoiceSessionId = explorationChoice?.optionFlow === 'dialogue-choice'
          ? `conversation:${++conversationDisplaySessionIdRef.current}`
          : undefined
        if (dialogueChoiceSessionId) setConversationDisplaySessionId(dialogueChoiceSessionId)
        sceneEchoIdRef.current += 1
        presentSceneEcho(createMainlineSceneEcho(
          sceneEchoIdRef.current,
          entity.id,
          text,
          sceneTextPresentationPosition(scene, getCurrentPosition(), text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, getCurrentPosition(), readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)),
          clockActivityForExploration(entity, Boolean(explorationChoice?.options)),
          explorationChoice?.options,
          explorationChoice?.optionFlow,
          dialogueChoiceSessionId,
        ))
      }
      if (startsDialogue) {
        setDialogueSegmentIndex(0)
        setGenericDialoguePhase('active')
        setDialogueLineIndex(0)
        setConversationDisplaySessionId(`conversation:${++conversationDisplaySessionIdRef.current}`)
        startDialogueTextSession()
      }
      if (mainlineInteractionCompletesImmediately({ hasExplorationContent, startsDialogue })) {
        completeShortInteraction(entityId)
      } else {
        markEntityExplored(entityId)
      }
    }
    const presentCounterInteraction = () => {
      if (!counterContact) { revealInteraction(); return }
      const spaceId = mainlineActiveSpatialSpaceId(scene, getCurrentPosition())
      const isMilk = spaceId === 'commercial-south-s5-interior'
      const isFruit = spaceId === 'commercial-north-n1-interior'
      if (!isMilk && !isFruit) { revealInteraction(); return }
      const workerId = isMilk ? milkTeaWorkerId : fruitTeaWorkerId
      const movement = isMilk ? milkTeaWorkerMovement : fruitTeaWorkerMovement
      const part = getMainlineSceneEntity(scene, counterContact.partId)
      const body = part?.interactionStructureId ? scene.continuousStructures?.find(item => item.id === part.interactionStructureId) : undefined
      const side = part?.interactionContactSides?.[0]
      if (!body || !side) { revealInteraction(); return }
      const box = isMilk ? milkTeaWorkerBox : fruitTeaWorkerBox
      const margin = .4
      const target = side === 'left'
        ? { x: body.x + body.width + box.width / 2 + margin, y: Math.max(body.y + box.height / 2, Math.min(body.y + body.height - box.height / 2, counterContact.point.y)) }
        : side === 'right'
          ? { x: body.x - box.width / 2 - margin, y: Math.max(body.y + box.height / 2, Math.min(body.y + body.height - box.height / 2, counterContact.point.y)) }
          : side === 'top'
            ? { x: Math.max(body.x + box.width / 2, Math.min(body.x + body.width - box.width / 2, counterContact.point.x)), y: body.y + body.height + box.height / 2 + margin }
            : { x: Math.max(body.x + box.width / 2, Math.min(body.x + body.width - box.width / 2, counterContact.point.x)), y: body.y - box.height / 2 - margin }
      cancelPendingTakeawayWorkerResponseRef.current = () => movement.requestMove({ dutyId: `${workerId}.return-to-station`, targetId: `${workerId}.station`, target: isMilk ? milkTeaWorkerInitial : fruitTeaWorkerInitial }, scene, layout, { ...navigationOptionsRef.current, actorId: workerId })
      const started = movement.requestMove({ dutyId: `${workerId}.counter-service`, targetId: counterContact.partId, target }, scene, layout, { ...navigationOptions, actorId: workerId }, {
        onBlocked: () => {
          if (npcInteractionRequestRef.current !== requestId) return
          cancelPendingTakeawayWorkerResponseRef.current = null
          interactionStartedAtRef.current = null
          setActiveObjectId(null)
          onInteractionAnalytics?.('blocked', entity.id, entity.kind, 'worker-movement-blocked')
        },
      }, () => {
        if (npcInteractionRequestRef.current !== requestId) return
        cancelPendingTakeawayWorkerResponseRef.current = null
        revealInteraction()
      })
      if (!started) {
        cancelPendingTakeawayWorkerResponseRef.current = null
        interactionStartedAtRef.current = null
        setActiveObjectId(null)
        onInteractionAnalytics?.('blocked', entity.id, entity.kind, 'worker-unreachable')
      }
    }
    const interaction = resolveMainlineEntityInteraction(scene, counterContact?.partId ?? entity.id, getCurrentPosition(), layout, counterContact ? { ...navigationOptions, interactionContactPoint: counterContact.point } : navigationOptions)
    if (interaction.inRange) {
      interactionStartedAtRef.current = Date.now()
      setActiveObjectId(entityId)
      stopMovement()
      presentCounterInteraction()
      return
    }
    const resolved = interaction
    if (!resolved.path) {
      const command = classifyMainlineWorldCommand(scene, getCurrentPosition(), resolved.target, layout, navigationOptions)
      if (command.kind === 'passage' && command.approachPath) {
        pendingInteractionAfterTraversalRef.current = entity.id
        setActiveObjectId(entityId)
        startPassageTraversal(command.passage, command.requestedTarget, command.approachPath, null, command.passages)
        return
      }
      interactionStartedAtRef.current = null
      stopMovement()
      onInteractionAnalytics?.('blocked', entity.id, entity.kind, 'unreachable')
      return
    }
    interactionStartedAtRef.current = Date.now()
    setActiveObjectId(entityId)
    moveAlong(resolved.path, presentCounterInteraction, {
      ...protagonistLocomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
      onBlocked: () => {
        interactionStartedAtRef.current = null
        setActiveObjectId(null)
        onInteractionAnalytics?.('blocked', entity.id, entity.kind, 'movement-blocked')
      },
    })
  }, [activePlayerSeatId, activeViewportMetrics, cameraOffset, cancelSceneAction, carriedPhoneDevice, cafeRestroomFixtureUsesRef, commercialCafeNarrative, commercialCafeStory, completeShortInteraction, createSceneAction, clearCafeRestroomFixtureUse, denyLockedPassageAfterApproach, dismissSceneEcho, fruitTeaWorkerBox.height, fruitTeaWorkerBox.width, fruitTeaWorkerId, fruitTeaWorkerInitial, fruitTeaWorkerMovement, getCurrentPosition, getLiveNavigationOptions, incensePhase, layout, leavePlayerSeat, milkTeaWorkerBox.height, milkTeaWorkerBox.width, milkTeaWorkerId, milkTeaWorkerInitial, milkTeaWorkerMovement, protagonistLocomotionOptions, markEntityExplored, moveAlong, navigationOptions, navigationRuntime, occupiedSeatIds, officeBlindsOpen, onCommerceEntity, onDoorEvent, onInteractionAnalytics, onObjectInteraction, onPhoneDismiss, phoneOpen, initialSceneState, plantWateredAt, presentSceneEcho, presentCommercialDrinkEcho, presentYongheEcho, readingActive, recordSceneState, recordSceneStatePatch, resetMovement, scene, sceneAction, screenMetrics, showLockedPassageText, startCommercialCafeNarrative, startDialogueTextSession, startNpcDialogue, startPassageTraversal, stopMovement])

  resumeInteractionRef.current = (entityId) => interact(entityId, true)

  const showMilkTeaEcho = useCallback((text: string, options?: readonly string[]) => {
    sceneEchoIdRef.current += 1
    presentSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      commercialStreetMilkTeaStorefrontId,
      text,
      sceneTextPresentationPosition(scene, getCurrentPosition(), text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, getCurrentPosition(), readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)),
      options ? 'menu-reading' : 'scene-observation',
      options,
      options ? 'commerce-choice' : undefined,
    ))
  }, [activeViewportMetrics, cameraOffset, getCurrentPosition, presentSceneEcho, scene, screenMetrics])

  const showHeldMilkTeaAction = useCallback(() => {
    if (readingActive) return
    if (phoneOpen) onPhoneDismiss?.()
    const currentPosition = getCurrentPosition()
    const worldScale = mainlineWorldScale(activeViewportMetrics)
    const actionCameraOffset = mainlineReadingCameraOffset(scene, currentPosition, readingMetrics, worldScale, cameraOffset)
    const nextAction = {
      entityId: commercialStreetMilkTeaStorefrontId,
      options: ['喝掉奶茶'],
      optionFlow: 'world-action' as const,
      position: sceneTextPresentationPosition(scene, currentPosition, '喝掉奶茶', readingMetrics, 'observation', worldScale, actionCameraOffset),
      cameraOffset: actionCameraOffset,
    }
    if (sceneAction?.phase === 'committing') return
    if (sceneAction) {
      pendingSceneActionAfterExitRef.current = nextAction
      if (sceneAction.phase === 'active') cancelSceneAction('replace')
      return
    }
    setSceneAction(createSceneAction(nextAction))
  }, [activeViewportMetrics, cameraOffset, cancelSceneAction, createSceneAction, getCurrentPosition, onPhoneDismiss, phoneOpen, readingActive, scene, sceneAction, screenMetrics])

  const beginMilkTeaStorefrontAction = useCallback(() => {
    if (!commercialStreetMilkTeaAppUnlocked(initialSceneState)) {
      recordSceneStatePatch('commercial-street', commercialStreetMilkTeaAppUnlockPatch())
      onChapterAnalytics?.('milk_tea_app_unlocked')
    }
    onMilkTeaAppOpen?.()
  }, [initialSceneState, onChapterAnalytics, onMilkTeaAppOpen, recordSceneStatePatch])

  const interactStorefront = useCallback((storefrontId: string) => {
    if (readingActive || sceneAction?.phase === 'committing') return
    cancelSceneAction()
    npcInteractionRequestRef.current += 1
    cancelPendingTakeawayWorkerResponseRef.current?.()
    cancelPendingTakeawayWorkerResponseRef.current = null
    const storefront = scene.storefronts.find((candidate) => candidate.id === storefrontId)
    if (!storefront || !commercialStreetStorefrontInteractionFor(storefrontId)) return
    onInteractionAnalytics?.('requested', storefrontId, 'storefront')
    const requestId = ++storefrontRequestIdRef.current
    setRequestedWorldTarget(null)
    if (phoneOpen) onPhoneDismiss?.()
    setDialogueLineIndex(null)
    setNpcDialogue(null)
    setGenericDialoguePhase('active')

    const revealStorefrontInteraction = () => {
      if (requestId !== storefrontRequestIdRef.current) return
      const resolution = executeCommercialStreetStorefrontInteraction(storefrontId, storefrontInteractionRuntimeRef.current, storefrontExecutionRuntimeRef.current)
      setActiveObjectId(null)
      if (!resolution) {
        onInteractionAnalytics?.('blocked', storefrontId, 'storefront', 'not-resolved')
        return
      }
      onInteractionAnalytics?.('completed', storefrontId, 'storefront', 'interacted')
      onChapterAnalytics?.('commercial_storefront_interacted', { slotId: storefront.id, storeType: storefront.label })
      dismissSceneEcho()
      if (resolution.kind === 'action') {
        onStorefrontAction?.(resolution.action, storefrontId)
        if (resolution.action === 'milk-tea-order' && storefrontId === commercialStreetMilkTeaStorefrontId) {
          beginMilkTeaStorefrontAction()
          return
        }
        return
      }
      sceneEchoIdRef.current += 1
      presentSceneEcho(createMainlineSceneEcho(
        sceneEchoIdRef.current,
        storefrontId,
        resolution.text,
        sceneTextPresentationPosition(scene, getCurrentPosition(), resolution.text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, getCurrentPosition(), readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)),
        'scene-observation',
        undefined,
      ))
    }

    let blockedReported = false
    const reportFinalBlock = (reason: string) => {
      if (blockedReported || requestId !== storefrontRequestIdRef.current) return
      blockedReported = true
      setActiveObjectId(null)
      onInteractionAnalytics?.('blocked', storefrontId, 'storefront', reason)
    }
    const attemptContact = (retry: number) => {
      if (requestId !== storefrontRequestIdRef.current) return
      const currentPosition = getCurrentPosition()
      const live = storefrontNavigationRef.current
      const interaction = resolveMainlineStorefrontInteraction(live.scene, storefront, currentPosition, live.layout, live.options)
      if (interaction.inRange) {
        stopMovement()
        revealStorefrontInteraction()
        return
      }
      if (!interaction.path) {
        stopMovement()
        reportFinalBlock(retry === 0 ? 'unreachable' : 'dynamic-contacts-unreachable')
        return
      }
      setActiveObjectId(storefrontId)
      moveAlong(interaction.path, () => {
        if (requestId !== storefrontRequestIdRef.current) return
        // Arrival is not permission to reveal: validate the actual body and
        // live occupancy against the same contact contract as a manual click.
        const live = storefrontNavigationRef.current
        const decision = mainlineStorefrontArrivalDecision(live.scene, storefront, getCurrentPosition(), retry, live.layout, live.options)
        if (decision === 'interact') revealStorefrontInteraction()
        else if (decision === 'retry') attemptContact(retry + 1)
        else reportFinalBlock('arrival-contact-invalid')
      }, {
        ...protagonistLocomotionOptions,
        canOccupy: (point) => {
          const live = storefrontNavigationRef.current
          return isWalkableMainlinePoint(point, live.scene, live.layout, getLiveNavigationOptions())
        },
        canTraverse: (start, end) => {
          const live = storefrontNavigationRef.current
          return isMainlineNavigationBarrierClear(start, end, live.scene, live.layout, getLiveNavigationOptions())
        },
        onBlocked: () => {
          if (requestId !== storefrontRequestIdRef.current) return
          if (retry < 2) {
            attemptContact(retry + 1)
            return
          }
          reportFinalBlock('movement-blocked')
        },
      })
    }
    attemptContact(0)
  }, [activeViewportMetrics, beginMilkTeaStorefrontAction, cameraOffset, cancelSceneAction, dismissSceneEcho, getCurrentPosition, getLiveNavigationOptions, layout, protagonistLocomotionOptions, moveAlong, navigationOptions, onChapterAnalytics, onInteractionAnalytics, onPhoneDismiss, onStorefrontAction, phoneOpen, presentSceneEcho, protagonistFootprint, readingActive, scene, sceneAction?.phase, screenMetrics, stopMovement])

  const interactNpc = useCallback((npcId: string) => {
    if (readingActive || sceneAction?.phase === 'committing') return
    if (npcId === 'lao-zhou' && hasContinuousCafe(scene) && !laoZhouVisibleInCurrentVisit) return
    cancelSceneAction()
    const npc = scene.npcs.find((candidate) => candidate.id === npcId)
    if (!npc || npc.interactive === false) return
    if (npcId === 'ruoyu') {
      onNpcInteraction?.(npc.id)
      onInteractionAnalytics?.('requested', npc.id, 'npc')
      interactRuoyuCafe()
      return
    }
    if (npcId === 'lao-zhou' && hasContinuousCafe(scene) && ruoyuCafeMeetingCompleted(initialSceneState)) {
      onInteractionAnalytics?.('requested', npc.id, 'npc')
      interactXiujieFollowup()
      return
    }
    onInteractionAnalytics?.('requested', npc.id, 'npc')
    setRequestedWorldTarget(null)
    if (movingNpcIds.has(npcId)) {
      onInteractionAnalytics?.('blocked', npc.id, 'npc', 'actor-moving')
      return
    }
    if (phoneOpen) onPhoneDismiss?.()
    setDialogueLineIndex(null)
    setNpcDialogue(null)
    dismissSceneEcho()
    setActiveObjectId(null)
    const seatedResolution = resolveCommercialCafeNpcInteraction({
      sceneId: scene.id,
      npcId: npc.id,
      story: commercialCafeStory,
      playerSeatId: activePlayerSeatId,
      conversationSeatId: cafeConversationSeatId,
    })
    if (activePlayerSeatId && seatedResolution) {
      stopMovement()
      onNpcInteraction?.(npc.id)
      onInteractionAnalytics?.('completed', npc.id, 'npc', 'dialogue-started')
      if (seatedResolution.kind === 'dialogue') startNpcDialogue(seatedResolution)
      else if (seatedResolution.kind === 'start-narrative') startCommercialCafeNarrative()
      return
    }
    leavePlayerSeat()
    const requestId = npcInteractionRequestRef.current + 1
    npcInteractionRequestRef.current = requestId
    cancelPendingTakeawayWorkerResponseRef.current?.()
    cancelPendingTakeawayWorkerResponseRef.current = null
    const currentPosition = getCurrentPosition()
    const interaction = resolveMainlineNpcInteraction(scene, npc.id, currentPosition, layout, navigationOptions)
    const alreadyNearby = interaction.inRange
    const completeInteraction = () => {
      if (npcInteractionRequestRef.current !== requestId) return
      onNpcInteraction?.(npc.id)
      if (commercialStreetDrinkShopForInteraction(npc.id)) {
        recommendedDrinkRef.current = null
        onInteractionAnalytics?.('completed', npc.id, 'npc', 'dialogue-started')
        presentCommercialDrinkEcho(npc.id, commercialStreetDrinkShopDialogue.welcome, ['点单', commercialStreetDrinkShopDialogue.recommendationRequest])
        return
      }
      if (isYongheTakeawayScene(scene.id) && npc.id === 'yonghe-trial-worker') {
        onInteractionAnalytics?.('completed', npc.id, 'npc', 'dialogue-started')
        presentYongheEcho('吃点什么？', ['点餐', '有什么推荐吗', '聊聊'], 'yonghe-trial-worker', 'dialogue-choice')
        return
      }
      const resolution = resolveCommercialCafeNpcInteraction({
        sceneId: scene.id,
        npcId: npc.id,
        story: commercialCafeStory,
        playerSeatId: null,
        conversationSeatId: cafeConversationSeatId,
      })
      if (!resolution) {
        onInteractionAnalytics?.('blocked', npc.id, 'npc', 'no-interaction-available')
        return
      }
      onInteractionAnalytics?.('completed', npc.id, 'npc', 'dialogue-started')
      if (resolution.kind === 'dialogue') startNpcDialogue(resolution)
      else if (resolution.kind === 'start-narrative') startCommercialCafeNarrative()
    }
    if (alreadyNearby) {
      stopMovement()
      completeInteraction()
      return
    }
    const resolved = interaction
    if (!resolved.path) {
      npcInteractionRequestRef.current += 1
      stopMovement()
      onInteractionAnalytics?.('blocked', npc.id, 'npc', 'unreachable')
      return
    }
    moveAlong(resolved.path, completeInteraction, {
      ...protagonistLocomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, getLiveNavigationOptions()),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, getLiveNavigationOptions()),
      onBlocked: () => {
        if (npcInteractionRequestRef.current !== requestId) return
        npcInteractionRequestRef.current += 1
        onInteractionAnalytics?.('blocked', npc.id, 'npc', 'movement-blocked')
      },
    })
  }, [activePlayerSeatId, cafeStoryOrderDelivery, commercialCafeNarrative, commercialCafeStory, cancelSceneAction, dismissSceneEcho, getCurrentPosition, getLiveNavigationOptions, initialSceneState, interactRuoyuCafe, interactXiujieFollowup, laoZhouVisibleInCurrentVisit, layout, leavePlayerSeat, onInteractionAnalytics, onNpcInteraction, onPhoneDismiss, phoneOpen, presentCommercialDrinkEcho, presentYongheEcho, protagonistLocomotionOptions, moveAlong, movingNpcIds, navigationOptions, readingActive, scene, sceneAction?.phase, startCommercialCafeNarrative, startNpcDialogue, stopMovement])

  const chooseSceneEchoOption = useCallback((actionId: number, index: number) => {
    if (!sceneAction || sceneAction.id !== actionId || sceneAction.phase !== 'committing') return
    const option = sceneAction?.options[index]
    if (!option) return
    onMeaningfulActivity?.()
    if (sceneAction.entityId === 'commercial-cafe-counter' && (option === '点一杯咖啡' || option === '是' || option === '否')) {
      if (option !== '否') onDrinkShopOrderOpen?.('commercial-cafe-slot')
      commitSceneActionExit(actionId)
      return
    }
    const drinkShopId = sceneAction.entityId ? commercialStreetDrinkShopForInteraction(sceneAction.entityId) : null
    if (drinkShopId) {
      if (option === '点单') {
        onDrinkShopOrderOpen?.(drinkShopId)
      } else if (option === commercialStreetDrinkShopDialogue.recommendationRequest) {
        presentCommercialDrinkEcho(sceneAction.entityId!, commercialStreetDrinkShopDialogue.preferenceQuestion, commercialStreetDrinkShopDialogue.preferenceOptions, sceneAction.conversationDisplaySessionId)
      } else if (commercialStreetDrinkShopDialogue.preferenceOptions.includes(option as typeof commercialStreetDrinkShopDialogue.preferenceOptions[number])) {
        const product = recommendedCommercialStreetDrink(drinkShopId, option)
        if (product?.recommendation) {
          recommendedDrinkRef.current = { shopId: drinkShopId, productId: product.id }
          presentCommercialDrinkEcho(sceneAction.entityId!, product.recommendation.line, commercialStreetDrinkShopDialogue.recommendationOptions, sceneAction.conversationDisplaySessionId)
        }
      } else if (option === commercialStreetDrinkShopDialogue.recommendationOptions[0]) {
        const recommended = recommendedDrinkRef.current
        onDrinkShopOrderOpen?.(drinkShopId, recommended?.shopId === drinkShopId ? recommended.productId : undefined)
        recommendedDrinkRef.current = null
      } else if (option === commercialStreetDrinkShopDialogue.recommendationOptions[1]) {
        recommendedDrinkRef.current = null
        onDrinkShopOrderOpen?.(drinkShopId)
      }
      commitSceneActionExit(actionId)
      return
    }
    if (sceneAction.entityId === 'yonghe-trial-worker' && isYongheTakeawayScene(scene.id)) {
      if (option === '点餐') onYongheOrderOpen?.()
      else if (option === '有什么推荐吗') presentYongheEcho('你想吃面还是吃饭？', ['面', '饭'], 'yonghe-trial-worker', 'dialogue-choice', sceneAction.conversationDisplaySessionId)
      else if (option === '聊聊') {
        const text = '你们平常都这么忙吗？\n后面那个门是通向哪儿？'
        pendingSceneActionAfterExitRef.current = {
          entityId: 'yonghe-trial-worker',
          options: ['你们平常都这么忙吗？', '后面那个门是通向哪儿？'],
          optionFlow: 'dialogue-choice',
          conversationDisplaySessionId: sceneAction.conversationDisplaySessionId,
          position: sceneTextPresentationPosition(scene, getCurrentPosition(), text, readingMetrics, 'observation', mainlineWorldScale(activeViewportMetrics), mainlineReadingCameraOffset(scene, getCurrentPosition(), readingMetrics, mainlineWorldScale(activeViewportMetrics), cameraOffset)),
        }
        commitSceneActionExit(actionId)
        return
      }
      else if (option === '面' || option === '饭') {
        const products = yongheMenuForChoice(option)
        presentYongheEcho(products.map(product => product.name).join('\n'), [...products.map(product => product.name)], 'yonghe-trial-worker', 'commerce-choice')
      } else if (option === '全部菜品') {
        const choices = yongheTakeawayCatalog.map(product => `${product.name} ${product.price}元`)
        presentYongheEcho(yongheMenuText(), choices, 'yonghe-trial-worker', 'commerce-choice')
      } else {
        const product = yongheTakeawayCatalog.find(candidate => `${candidate.name} ${candidate.price}元` === option || candidate.name === option)
        if (product) onYongheOrderOpen?.(product.id)
        else if (option === '你们平常都这么忙吗？') {
          startNpcDialogue({ kind: 'dialogue', dialogue: { triggerEntityId: 'yonghe-trial-worker', lines: [
            { id: 'yonghe-business-question', speaker: '修杰', text: '你们平常都这么忙吗？' },
            { id: 'yonghe-business-answer', speaker: '店员', speakerNpcId: 'yonghe-trial-worker', text: '对啊，平常都这么忙。' },
          ] } }, sceneAction.conversationDisplaySessionId)
        } else if (option === '后面那个门是通向哪儿？') {
          startNpcDialogue({ kind: 'dialogue', dialogue: { triggerEntityId: 'yonghe-trial-worker', lines: [
            { id: 'yonghe-backdoor-question', speaker: '修杰', text: '后面那个门是通向哪儿？' },
            { id: 'yonghe-backdoor-answer', speaker: '店员', speakerNpcId: 'yonghe-trial-worker', text: '后面是后巷，顺着走也能出去。' },
          ] } }, sceneAction.conversationDisplaySessionId)
        }
      }
      commitSceneActionExit(actionId)
      return
    }
    if (sceneAction?.entityId === commercialStreetMilkTeaStorefrontId && option === '喝掉奶茶') {
      recordSceneStatePatch('commercial-street', commercialStreetMilkTeaConsumePatch())
      commitSceneActionExit(actionId)
      return
    }
    const entity = sceneAction?.entityId ? scene.objects.find((candidate) => candidate.id === sceneAction.entityId) : undefined
    if (entity?.interactionBehavior === 'cafe-restroom-use' && index === 0) {
      startCafeRestroomFixtureUse(entity.id)
      commitSceneActionExit(actionId)
      return
    }
    const resolution = resolveMainlineSceneEchoChoice(scene, entity, option, Date.now(), {
      carriedPhoneDevice,
      commercialCafeCoffeeOrdered: commercialCafeCoffeeOrderedState(commercialCafeStory),
      carriedMilkTea: carryingMilkTea,
      plantWaterStateKey: entity?.id === 'zhongshuyuan-office-plant' ? undefined : entity ? `plantWateredAt:${entity.id}` : undefined,
    })
    if (!resolution) {
      commitSceneActionExit(actionId)
      return
    }
    if (resolution.followupText && entity) pendingSceneEchoAfterActionRef.current = { entityId: entity.id, text: resolution.followupText }
    if (resolution.deskDevice) {
      onDeskInteraction?.(resolution.deskDevice)
      commitSceneActionExit(actionId)
      return
    }
    if (resolution.stateChange?.key === 'blindsOpen') {
      const open = resolution.stateChange.value === true
      const room = officeWindowRoom(scene)
      recordSceneStatePatch(scene.id, { blindsOpen: open, ...(room ? { [officeBlindsRoomKey(room.id)]: open } : {}) })
      setOfficeBlindsOpen(open)
    } else if (resolution.stateChange) recordSceneState(scene.id, resolution.stateChange.key, resolution.stateChange.value)
    if (resolution.stateChange?.key === 'incenseLitAt' && typeof resolution.stateChange.value === 'number') {
      setIncenseLitAt(resolution.stateChange.value)
      setIncenseClock(resolution.stateChange.value)
    }
    if (resolution.stateChange?.key === 'plantWateredAt' && typeof resolution.stateChange.value === 'number') {
      setPlantWateredAt(resolution.stateChange.value)
    }
    commitSceneActionExit(actionId)
  }, [carryingMilkTea, heldConsumable, carriedPhoneDevice, commercialCafeStory, commitSceneActionExit, initialSceneState, onChapterAnalytics, onDeskInteraction, onDrinkShopOrderOpen, onMeaningfulActivity, presentCommercialDrinkEcho, recordSceneState, recordSceneStatePatch, scene, sceneAction, startCafeRestroomFixtureUse])

  const requestSceneActionChoice = useCallback((actionId: number, index: number) => {
    if (sceneAction?.id === actionId && sceneAction.optionFlow === 'dialogue-choice' && sceneAction.phase === 'active') {
      if (!sceneAction.options[index]) return
      setSceneAction(current => current?.id === actionId && current.phase === 'active'
        ? { ...current, phase: 'committing', confirmedOptionIndex: index }
        : current)
      return
    }
    chooseSceneEchoOption(actionId, index)
  }, [chooseSceneEchoOption, sceneAction])

  useEffect(() => {
    if (sceneAction?.optionFlow !== 'dialogue-choice'
      || sceneAction.phase !== 'committing'
      || sceneAction.confirmedOptionIndex === undefined) return
    const commitKey = `${sceneAction.id}:${sceneAction.confirmedOptionIndex}`
    if (confirmedWheelChoiceRef.current === commitKey) return
    confirmedWheelChoiceRef.current = commitKey
    chooseSceneEchoOption(sceneAction.id, sceneAction.confirmedOptionIndex)
  }, [chooseSceneEchoOption, sceneAction])

  const finishSceneEchoReading = useCallback((current: MainlineSceneEcho) => {
    if (current.options && current.options.length > 0) {
      const nextAction = {
        entityId: current.entityId,
        options: current.options,
        optionFlow: current.optionFlow,
        conversationDisplaySessionId: current.conversationDisplaySessionId
          ?? (current.optionFlow === 'dialogue-choice'
            ? conversationDisplaySessionId ?? `conversation:echo:${scene.id}:${current.id}`
            : undefined),
        position: current.position,
      }
      if (current.optionFlow === 'dialogue-choice' && nextAction.conversationDisplaySessionId) {
        setConversationDisplaySessionId(nextAction.conversationDisplaySessionId)
        pendingSceneActionRef.current = null
        sceneEchoRef.current = null
        setSceneEcho(null)
        setActiveObjectId(null)
        setSceneAction(createSceneAction({ ...nextAction, cameraOffset }))
        return
      }
      pendingSceneActionRef.current = nextAction
    }
    if ((!current.options || current.options.length === 0) && current.conversationDisplaySessionId) {
      sceneEchoRef.current = null
      setSceneEcho(null)
      setActiveObjectId(null)
      return
    }
    dismissSceneEcho()
  }, [cameraOffset, conversationDisplaySessionId, createSceneAction, dismissSceneEcho, scene.id])

  const advanceSceneEcho = useCallback(() => {
    const current = sceneEchoRef.current
    if (!current || current.phase === 'leaving') return
    onMeaningfulActivity?.()
    if (current.textMotion === 'typing') {
      const next = { ...current, textMotion: mainlineReadingTextMotionAfterAdvance(current.textMotion, false) }
      sceneEchoRef.current = next
      setSceneEcho(next)
      return
    }
    if (current.textMotion === 'deleting' || current.textMotion === 'deleted') {
      if (isWallMenuReading(current.entityId)) {
        const completed = { ...current, textMotion: 'deleted' as const }
        sceneEchoRef.current = completed
        finishSceneEchoReading(completed)
      }
      return
    }
    if (current.segmentIndex + 1 < current.segments.length) {
      const next = {
        ...current,
        segmentIndex: current.segmentIndex + 1,
        text: mainlineReadingSegmentDisplayText(current.segments, current.segmentIndex + 1),
        textMotion: mainlineReadingTextMotionAfterAdvance(current.textMotion, false),
      }
      sceneEchoRef.current = next
      setSceneEcho(next)
      return
    }
    const atSessionEnd = mainlineReadingSessionTextIsFinal(current.segmentIndex, current.segments.length, 0, 1)
    const next = { ...current, textMotion: mainlineReadingTextMotionAfterAdvance(current.textMotion, atSessionEnd) }
    if (next.textMotion === 'deleting') {
      sceneEchoRef.current = next
      setSceneEcho(next)
      return
    }
    finishSceneEchoReading(next)
  }, [finishSceneEchoReading, onMeaningfulActivity])

  const completeSceneEchoTextMotion = useCallback((echoId: number, sessionKey: string, motion: MainlineReadingTextMotion) => {
    const current = sceneEchoRef.current
    if (!current) return 'rejected:no-scene-echo'
    if (current.id !== echoId) return `rejected:echo-id:${current.id}`
    if (current.phase === 'leaving') return 'rejected:echo-leaving'
    const callbackMatchesEcho = current && (
      mainlineReadingTextMotionCompletionMatches(`echo:${current.id}`, sessionKey)
      || Boolean(current.conversationDisplaySessionId && mainlineReadingTextMotionCompletionMatches(current.conversationDisplaySessionId, sessionKey))
    )
    if (!callbackMatchesEcho) return `rejected:echo-session:${sessionKey}`
    if (current.textMotion !== motion) return `rejected:echo-motion:${current.textMotion}`
    const nextMotion = mainlineReadingTextMotionAfterAnimation(current.textMotion)
    const next = { ...current, textMotion: nextMotion }
    sceneEchoRef.current = next
    setSceneEcho(next)
    if (nextMotion === 'deleted') finishSceneEchoReading(next)
    return `accepted:echo-${nextMotion}`
  }, [finishSceneEchoReading])

  const dialogueAtSessionEnd = useCallback(() => {
    const currentSegments = activeDialogueLine ? [mainlineDisplaySourceText(activeDialogueLine.text)] : []
    if (dialogueSegmentIndex + 1 < currentSegments.length) return false
    if (commercialStreetQuestionNarrative) {
      return mainlineReadingSessionTextIsFinal(commercialStreetQuestionNarrative.segmentIndex, commercialStreetQuestionNarrativeLines.length, dialogueSegmentIndex, currentSegments.length)
    }
    if (commercialCafeNarrative) {
      if (commercialCafeNarrative.phase !== 'active') return false
      if (commercialCafeStory.narrativeCursor === 1) return false
      return mainlineReadingSessionTextIsFinal(commercialCafeStory.narrativeCursor, commercialCafeNarrativeDialogue.lines.length, dialogueSegmentIndex, currentSegments.length)
    }
    return Boolean(activeDialogue && dialogueLineIndex !== null
      && mainlineReadingSessionTextIsFinal(dialogueLineIndex, activeDialogue.lines.length, dialogueSegmentIndex, currentSegments.length))
  }, [activeDialogue, activeDialogueLine?.text, commercialCafeNarrative, commercialCafeStory.narrativeCursor, commercialStreetQuestionNarrative, dialogueLineIndex, dialogueSegmentIndex])

  const noteDialogueAdvance = useCallback((event: string, intent: 'line' | 'segment') => {
    setDialogueAdvanceDiagnostic(JSON.stringify({
      event,
      intent,
      scene: scene.id,
      sessionId: dialogueTextSessionIdRef.current,
      lineIndex: commercialCafeNarrative ? commercialCafeStory.narrativeCursor : dialogueLineIndex,
      segmentIndex: dialogueSegmentIndex,
      motion: dialogueTextMotionRef.current,
      handoff: dialogueHandoffActiveRef.current,
      cafePhase: commercialCafeNarrative?.phase ?? null,
    }))
  }, [commercialCafeNarrative, commercialCafeStory.narrativeCursor, dialogueLineIndex, dialogueSegmentIndex, scene.id])

  const advanceDialogue = useCallback((tailDeletionComplete = false, advanceIntent: 'line' | 'segment' = 'segment') => {
    noteDialogueAdvance('received', advanceIntent)
    onMeaningfulActivity?.()
    if (!tailDeletionComplete && dialogueHandoffActiveRef.current) {
      if (dialogueTextMotionRef.current === 'typing') updateDialogueTextMotion('static')
      noteDialogueAdvance('blocked:handoff-active', advanceIntent)
      return
    }
    const cursorOneDeliveryStatus = commercialCafeNarrative?.phase === 'active' && commercialCafeStory.narrativeCursor === 1
      ? cafeStoryOrderDelivery?.status(commercialCafeLaoZhouDeliveryEventId) ?? 'none'
      : 'none'
    const deliveryInterruptsDialogue = cursorOneDeliveryStatus === 'queued'
      || cursorOneDeliveryStatus === 'ready'
      || cursorOneDeliveryStatus === 'delivered-pending-presentation'
    if (!tailDeletionComplete) {
      if (dialogueTextMotion === 'typing') {
        updateDialogueTextMotion('static')
        noteDialogueAdvance('skip-typing', advanceIntent)
        return
      }
      if (dialogueTextMotion === 'deleting' || dialogueTextMotion === 'deleted') {
        noteDialogueAdvance('blocked:text-deleting', advanceIntent)
        return
      }
      if (advanceIntent !== 'line' && dialogueAtSessionEnd()) {
        updateDialogueTextMotion('deleting')
        noteDialogueAdvance('starting-dialogue-exit', advanceIntent)
        return
      }
      const nextLine = commercialCafeNarrative
        ? commercialCafeNarrative.phase === 'delivery-line' ? null : commercialCafeNarrativeDialogue.lines[commercialCafeStory.narrativeCursor + 1]
        : activeDialogue && dialogueLineIndex !== null ? activeDialogue.lines[dialogueLineIndex + 1] : null
      const currentSegments = activeDialogueLine ? [mainlineDisplaySourceText(activeDialogueLine.text)] : []
      if (!deliveryInterruptsDialogue && mainlineDialogueShouldHandoff({
        currentSpeaker: activeDialogueLine?.speaker,
        nextSpeaker: nextLine?.speaker,
        currentSegmentIndex: advanceIntent === 'line' ? currentSegments.length - 1 : dialogueSegmentIndex,
        segmentCount: currentSegments.length,
        isInterior: !commercialStreetQuestionNarrative && mainlineIsInteriorSpace(scene, position),
      })) {
        dialogueHandoffActiveRef.current = true
        const startedAt = performance.now()
        dialogueHandoffStartedAtRef.current = startedAt
        const id = ++dialogueHandoffOutgoingIdRef.current
        setDialogueHandoffOutgoing({
          id,
          startedAt,
          minimumVisibleMs: 300,
          deleted: false,
        })
        setDialogueHandoffActive(true)
        noteDialogueAdvance('handoff-started', advanceIntent)
        // Advance the story exactly once. The outgoing visual now owns its
        // own delete motion while the next speaker starts typing in parallel.
        advanceDialogueRef.current(true, advanceIntent)
        return
      }
    }
    if (!tailDeletionComplete) updateDialogueTextMotion('static')
    if (commercialStreetQuestionNarrative) {
      setDialogueSegmentIndex(0)
      setCommercialStreetQuestionNarrative((current) => current ? nextCommercialStreetQuestionNarrative(current) : current)
      noteDialogueAdvance('advanced:street-question', advanceIntent)
      return
    }
    if (commercialCafeNarrative) {
      if (commercialCafeNarrative.phase === 'coffee-delivery' || commercialCafeNarrative.phase === 'coffee-returning') {
        noteDialogueAdvance(`blocked:cafe-${commercialCafeNarrative.phase}`, advanceIntent)
        return
      }
      if (commercialCafeNarrative.phase === 'delivery-line') {
        const acknowledged = commercialCafeFinishDeliveryLine(commercialCafeStory)
        if (acknowledged === commercialCafeStory) {
          noteDialogueAdvance('blocked:delivery-ack-unchanged', advanceIntent)
          return
        }
        cafeStoryOrderDelivery?.completePresentation(commercialCafeLaoZhouDeliveryEventId)
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(acknowledged))
        setDialogueSegmentIndex(0)
        setCommercialCafeNarrative({ phase: 'coffee-returning' })
        noteDialogueAdvance('advanced:coffee-returning', advanceIntent)
        return
      }
      const line = commercialCafeNarrativeDialogue.lines[commercialCafeStory.narrativeCursor]
      if (!line) {
        noteDialogueAdvance('blocked:cafe-empty-line', advanceIntent)
        return
      }
      const segments = [mainlineDisplaySourceText(line.text)]
      if (advanceIntent !== 'line' && dialogueSegmentIndex + 1 < segments.length) {
        setDialogueSegmentIndex((current) => current + 1)
        noteDialogueAdvance('advanced:cafe-segment', advanceIntent)
        return
      }
      const nextCursor = commercialCafeStory.narrativeCursor + 1
      setDialogueSegmentIndex(0)
      if (commercialCafeStory.narrativeCursor === 1) {
        const deliveryStatus = cursorOneDeliveryStatus
        if (deliveryStatus === 'queued' || deliveryStatus === 'ready' || deliveryStatus === 'delivered-pending-presentation') {
          const delivery = cafeStoryOrderDelivery?.begin(commercialCafeLaoZhouDeliveryEventId)
          if (delivery?.ok) {
            const nextStory = { ...commercialCafeStory, coffeeStatus: 'ready' as const, coffeePreparationStartedAt: null, narrativeCursor: 1, narrativePhase: 'coffee-delivery' as const }
            recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(nextStory))
            setDialogueLineIndex(1)
            if (tailDeletionComplete && dialogueHandoffActiveRef.current) startDialogueTextSession()
            setCommercialCafeNarrative({ phase: 'coffee-delivery' })
            noteDialogueAdvance('advanced:coffee-delivery', advanceIntent)
            return
          }
        }
        // The shared order state is authoritative. Old coffeeStatus values
        // never create or wait for a second, legacy Cafe order.
        const nextStory = { ...commercialCafeStory, coffeeStatus: 'none' as const, coffeePreparationStartedAt: null, narrativeCursor: 2, narrativePhase: 'dialogue' as const }
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(nextStory))
        setDialogueLineIndex(2)
        if (tailDeletionComplete && dialogueHandoffActiveRef.current) {
          startDialogueTextSession()
        }
        setCommercialCafeNarrative({ phase: 'active' })
        noteDialogueAdvance('advanced:cafe-cursor-2', advanceIntent)
        return
      }
      if (nextCursor < commercialCafeNarrativeDialogue.lines.length) {
        const nextStory = commercialCafeStoryWithCursor(commercialCafeStory, nextCursor)
        const narrativeStory = { ...nextStory, narrativePhase: 'dialogue' as const }
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(narrativeStory))
        setDialogueLineIndex(nextCursor)
        if (tailDeletionComplete && dialogueHandoffActiveRef.current) {
          startDialogueTextSession()
        }
        const stage = commercialCafeAnalyticsStageForCursor(nextCursor)
        if (stage) recordCafeAnalyticsMilestone(stage)
        noteDialogueAdvance('advanced:cafe-cursor', advanceIntent)
        return
      }
      recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeStoryReadyToLeave(commercialCafeStory)))
      recordCafeAnalyticsMilestone('ready-to-leave')
      onChapterAnalytics?.('cafe_ready_to_leave')
      setCommercialCafeNarrative({ phase: 'leaving' })
      noteDialogueAdvance('advanced:cafe-leaving', advanceIntent)
      return
    }
    if (dialogueLineIndex === null || !activeDialogue) {
      noteDialogueAdvance('blocked:missing-active-dialogue', advanceIntent)
      return
    }
    const currentText = activeDialogue.lines[dialogueLineIndex]?.text ?? ''
    const segments = currentText ? [mainlineDisplaySourceText(currentText)] : []
    if (advanceIntent !== 'line' && dialogueSegmentIndex + 1 < segments.length) {
      setDialogueSegmentIndex((current) => current + 1)
      noteDialogueAdvance('advanced:dialogue-segment', advanceIntent)
      return
    }
    setDialogueSegmentIndex(0)
    if (dialogueLineIndex + 1 < activeDialogue.lines.length) {
      setDialogueLineIndex(dialogueLineIndex + 1)
      if (activeDialogue.triggerEntityId === ruoyuCafeMeetingDialogue.triggerEntityId) {
        recordSceneState(scene.id, ruoyuCafeMeetingCursorKey, dialogueLineIndex + 1)
        recordSceneState(scene.id, ruoyuCafeMeetingStatusKey, 'in-progress')
      }
      if (tailDeletionComplete && dialogueHandoffActiveRef.current) {
        startDialogueTextSession()
      }
      noteDialogueAdvance('advanced:dialogue-line', advanceIntent)
      return
    }
    if (activeDialogue.triggerEntityId === ruoyuCafeMeetingDialogue.triggerEntityId) {
      recordSceneState(scene.id, ruoyuCafeMeetingCursorKey, ruoyuCafeMeetingDialogue.lines.length)
      recordSceneState(scene.id, ruoyuCafeMeetingStatusKey, 'complete')
    }
    setGenericDialoguePhase('leaving')
    noteDialogueAdvance('advanced:dialogue-leaving', advanceIntent)
  }, [activeDialogue, activeDialogueLine, activeDialoguePosition, activeDialogueText, activeViewportMetrics, cameraOffset, cafeStoryOrderDelivery, commercialCafeNarrative, commercialCafeStory, commercialStreetQuestionNarrative, dialogueAtSessionEnd, dialogueLineIndex, dialogueSegmentIndex, dialogueTextMotion, npcDialogue, noteDialogueAdvance, onChapterAnalytics, onMeaningfulActivity, position, recordCafeAnalyticsMilestone, recordSceneState, recordSceneStatePatch, scene, screenMetrics, startDialogueTextSession, updateDialogueTextMotion])

  const skipDialogueTyping = useCallback((sessionId: number) => {
    if (sessionId !== dialogueTextSessionIdRef.current || dialogueTextMotionRef.current !== 'typing') return
    updateDialogueTextMotion('static')
  }, [updateDialogueTextMotion])

  const advanceDialogueRef = useRef(advanceDialogue)
  advanceDialogueRef.current = advanceDialogue

  const completeDialogueTextMotion = useCallback((sessionId: number, motion: MainlineReadingTextMotion) => {
    if (!mainlineReadingTextMotionCompletionMatches(`dialogue:${dialogueTextSessionIdRef.current}`, `dialogue:${sessionId}`)) return `rejected:dialogue-session:${dialogueTextSessionIdRef.current}`
    if (dialogueTextMotionRef.current !== motion) return `rejected:dialogue-motion:${dialogueTextMotionRef.current}`
    const nextMotion = mainlineReadingTextMotionAfterAnimation(dialogueTextMotionRef.current)
    updateDialogueTextMotion(nextMotion)
    if (nextMotion === 'deleted') {
      if (dialogueHandoffActiveRef.current && dialogueHandoffStartedAtRef.current !== null) {
        const remaining = Math.max(0, 300 - (performance.now() - dialogueHandoffStartedAtRef.current))
        if (dialogueHandoffTimerRef.current !== null) window.clearTimeout(dialogueHandoffTimerRef.current)
        dialogueHandoffTimerRef.current = window.setTimeout(() => {
          dialogueHandoffTimerRef.current = null
          if (sessionId !== dialogueTextSessionIdRef.current || !dialogueHandoffActiveRef.current) return
          dialogueHandoffStartedAtRef.current = null
          advanceDialogueRef.current(true)
        }, remaining)
      } else advanceDialogueRef.current(true)
    }
    return `accepted:dialogue-${nextMotion}`
  }, [updateDialogueTextMotion])

  const walk = useCallback((point: Point) => {
    if (readingActive) return
    if (sceneAction?.phase === 'committing') return
    const approachingUse = Object.entries(cafeRestroomFixtureUsesRef.current).find(([, request]) => request?.phase === 'approaching')
    if (approachingUse) clearCafeRestroomFixtureUse(approachingUse[0], approachingUse[1]?.requestId)
    onMeaningfulActivity?.()
    pendingInteractionAfterTraversalRef.current = null
    storefrontRequestIdRef.current += 1
    cancelSceneAction()
    npcInteractionRequestRef.current += 1
    cancelPendingTakeawayWorkerResponseRef.current?.()
    cancelPendingTakeawayWorkerResponseRef.current = null
    if (phoneOpen) {
      onPhoneDismiss?.()
    }
    setDialogueLineIndex(null)
    setNpcDialogue(null)
    setActiveObjectId(null)
    leavePlayerSeat()
    // The marker is the player's unmodified world command, not the current
    // waypoint used by movement or a passage lifecycle.
    setRequestedWorldTarget({ ...point })
    if (debugCafeSpatialQa) setCafeSpatialQaNavigation(null)
    const command = classifyMainlineWorldCommand(sceneDefinition, getCurrentPosition(), point, layout, navigationOptions)
    if (command.kind === 'passage') {
      startPassageTraversal(command.passage, command.requestedTarget, command.approachPath, null, command.passages)
      return
    }
    const resolution = resolveMainlineWorldNavigation(sceneDefinition, getCurrentPosition(), point, layout, navigationOptions)
    if (!resolution) {
      stopMovement()
      return
    }
    if (debugCafeSpatialQa) {
      setCafeSpatialQaNavigation({
        requestedTarget: resolution.requestedTarget,
        resolvedNavigableTarget: resolution.resolvedNavigableTarget,
        path: resolution.path,
        reachedRequestedTarget: resolution.reachedRequestedTarget,
        deniedAccessRegionId: resolution.deniedAccessRegion?.id,
      })
    }
    const showDeniedFeedback = resolution.deniedAccessRegion
      ? () => showAccessRegionDeniedText(resolution.deniedAccessRegion!.deniedText ?? '这里暂时不能进入。')
      : undefined
    const started = moveTo(resolution.resolvedNavigableTarget, showDeniedFeedback, resolution.path, undefined, showDeniedFeedback)
    if (!started) showDeniedFeedback?.()
  }, [cancelSceneAction, cafeRestroomFixtureUsesRef, clearCafeRestroomFixtureUse, debugCafeSpatialQa, dismissSceneEcho, getCurrentPosition, layout, leavePlayerSeat, moveTo, navigationOptions, onMeaningfulActivity, onPhoneDismiss, phoneOpen, readingActive, scene.id, sceneAction?.phase, sceneDefinition, setDialogueLineIndex, showAccessRegionDeniedText, startPassageTraversal, stopMovement])

  const completeCommercialStreetQuestionNarrativeExit = useCallback(() => {
    if (commercialStreetQuestionNarrative?.phase !== 'leaving') return
    setCommercialStreetQuestionNarrative(null)
    setCommercialStreetQuestionNarrativeCompletedLocally(true)
    recordSceneState('commercial-street', commercialStreetQuestionNarrativeCompletedKey, true)
    onChapterAnalytics?.('commercial_question_completed')
  }, [commercialStreetQuestionNarrative?.phase, onChapterAnalytics, recordSceneState])
  const completeDialogueExit = useCallback(() => {
    if (commercialStreetQuestionNarrative?.phase === 'leaving') {
      completeCommercialStreetQuestionNarrativeExit()
      return
    }
    if (commercialCafeNarrative?.phase === 'leaving') {
      setCommercialCafeNarrative(null)
      setDialogueLineIndex(null)
      return
    }
    if (genericDialoguePhase === 'leaving') {
      const completedNpcDialogue = npcDialogue
      setDialogueLineIndex(null)
      setNpcDialogue(null)
      setGenericDialoguePhase('active')
      if (completedNpcDialogue) setPromptedSeatId(null)
      if (completedNpcDialogue?.dialogue.triggerEntityId === ruoyuCafeMeetingDialogue.triggerEntityId) leavePlayerSeat()
    }
  }, [commercialCafeNarrative?.phase, commercialStreetQuestionNarrative?.phase, completeCommercialStreetQuestionNarrativeExit, genericDialoguePhase, leavePlayerSeat, npcDialogue])

  useEffect(() => {
    if (!walkRequest || handledWalkRequestRef.current === walkRequest.id) return
    handledWalkRequestRef.current = walkRequest.id
    walk(walkRequest.point)
  }, [walk, walkRequest])

  const reset = useCallback(() => {
    pendingTraversalRef.current = null
    setLayoutMode(false)
    setActiveObjectId(null)
    setExplorationState({ sceneId: scene.id, objectIds: new Set() })
    setDialogueLineIndex(null)
    setNpcDialogue(null)
    setPlayerSeatId(null)
    setPromptedSeatId(null)
    setSceneEcho(null)
    sceneEchoRef.current = null
    pendingSceneActionRef.current = null
    pendingSceneActionAfterExitRef.current = null
    sceneActionExitBarrierRef.current = null
    setSceneAction(null)
    setGenericDialoguePhase('active')
    setIncenseLitAt(null)
    setPlantWateredAt(null)
    setIncenseClock(Date.now())
    cancelPassageLifecycle('protagonist')
    setPassageDestination(null)
    setRequestedWorldTarget(null)
    resetMovement(initialPosition)
  }, [cancelPassageLifecycle, initialPosition, resetMovement, scene.id, sceneDefinition])

  const currentAreaLabel = mainlineSceneAreaLabel(scene, position)
  const ambientReadingPosition = sceneEcho?.position ?? activeDialoguePosition
  const dialogueParticipantNpcIds = mainlineDialogueParticipantNpcIds(scene, activeDialogue, activeDialogueLine)
  const ambientReadingSessionKey = !readingActive ? null : sceneEcho
    ? `${scene.id}:observation:echo:${sceneEcho.id}`
    : `${scene.id}:dialogue:${activeDialogue?.triggerEntityId ?? ''}`
  const ambientReadingFontKey = useMainlineReadingFontRevision(ambientReadingSessionKey)
  const ambientReadingEntries = sceneEcho
    ? (sceneEcho.segments.length ? sceneEcho.segments : [sceneEcho.text]).map(text => ({ text, speaker: undefined }))
    : activeDialogue?.lines.length
      ? activeDialogue.lines.map(line => ({ text: line.text, speaker: line.speaker }))
      : [{ text: activeDialogueText, speaker: activeDialogueLine?.speaker }]
  // Page and Renderer share one session cache. NPC motion rerenders only
  // recompute actor-to-envelope geometry; authored text is laid out once.
  const sharedReadingSessionLayoutCacheRef = useRef<MainlineReadingSessionLayoutCache | null>(null)
  let sharedReadingSessionLayoutCache = sharedReadingSessionLayoutCacheRef.current
  const readingMeasurementKey = mainlineReadingMeasurementKey(readingMetrics, mainlineWorldScale(activeViewportMetrics))
  if (!ambientReadingSessionKey || !ambientReadingPosition) {
    sharedReadingSessionLayoutCacheRef.current = null
    sharedReadingSessionLayoutCache = null
  } else if (!sharedReadingSessionLayoutCache
    || sharedReadingSessionLayoutCache.sessionKey !== ambientReadingSessionKey
    || sharedReadingSessionLayoutCache.fontKey !== ambientReadingFontKey
    || sharedReadingSessionLayoutCache.measurementKey !== readingMeasurementKey) {
    const worldScale = mainlineWorldScale(activeViewportMetrics)
    sharedReadingSessionLayoutCache = createMainlineReadingSessionLayoutCache({
      sessionKey: ambientReadingSessionKey,
      entries: ambientReadingEntries,
      metrics: readingMetrics,
      maximumWidthPx: mainlineMaximumReadingWidthPx(scene, ambientReadingPosition, readingMetrics, worldScale),
      fontKey: ambientReadingFontKey,
      worldScale,
      preferWholeText: Boolean(sceneEcho),
    })
    sharedReadingSessionLayoutCacheRef.current = sharedReadingSessionLayoutCache
  } else {
    // Newly authored text is measured as a delta; old entries remain cached.
    sharedReadingSessionLayoutCache.addEntries(ambientReadingEntries)
  }
  const ambientReadingLayout = sharedReadingSessionLayoutCache
    ? sharedReadingSessionLayoutCache.envelopeAtOrBelow(sharedReadingSessionLayoutCache.widths[0]?.widthPx ?? 0)
    : null
  const ambientReadingOpacity = (actorPosition: Point, npcId: string) => {
    if (!readingActive || !ambientReadingPosition || !ambientReadingLayout) return 1
    return mainlineReadingOpacityForActor(npcId, dialogueParticipantNpcIds, mainlineReadingActorOpacity(actorPosition, ambientReadingPosition, ambientReadingLayout, mainlineWorldScale(activeViewportMetrics), value => scene.id === 'commercial-street' ? projectCommercialStreetX(value, screenMetrics) : value))
  }
  const debugCafeCounterStructure = debugRuntimeEvidence && hasContinuousCafe(scene)
    ? scene.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')
    : undefined
  const debugCafeStaffRegion = debugRuntimeEvidence && hasContinuousCafe(scene)
    ? scene.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')
    : undefined
  const ambientNpcActorLayer = scene.ambientNpcRoutes.map((schedule) => {
    const initialPosition = stagedNpcPositions.get(schedule.npcId) ?? scene.initialPlayerPosition
    const npc = scene.npcs.find((candidate) => candidate.id === schedule.npcId)
    if (!npc) return null
    return <AmbientNpcMotion
      key={schedule.npcId}
      enabled={!presentationSnapshot && scene.id === 'commercial-street'}
      schedule={schedule}
      initialPosition={initialPosition}
      scene={scene}
      layout={layout}
      navigationRuntime={navigationRuntime}
      navigationOptions={navigationOptions}
      footprint={ambientNpcFootprints.get(schedule.npcId) ?? protagonistFootprint}
      movementOptions={locomotionOptions}
      protagonistPosition={position}
      onRuntimeChange={handleAmbientNpcRuntimeChange}
      renderActor={(npcPosition, snapshot) => <MainlineAmbientNpcActor
        sceneId={scene.id}
        npc={npc}
        position={npcPosition}
        snapshot={snapshot}
        screenMetrics={screenMetrics}
        debugRuntimeEvidence={debugRuntimeEvidence}
        readingOpacity={ambientReadingOpacity(npcPosition, npc.id)}
        readingProtected={Boolean(readingActive && dialogueParticipantNpcIds.has(npc.id))}
      />}
    />
  })

  return (
    <>
    <div
      {...sceneInteractionHandlers}
      className={`scene-shell mainline-scene ${embedded ? 'mainline-scene--embedded' : ''} ${!showSceneChrome ? 'mainline-scene--map-only' : ''}`}
      data-mainline-scene={scene.id}
      data-commercial-cafe-status={hasContinuousCafe(scene) ? commercialCafeStory.status : undefined}
      data-commercial-cafe-cursor={hasContinuousCafe(scene) ? commercialCafeStory.narrativeCursor : undefined}
      data-commercial-cafe-coffee-status={hasContinuousCafe(scene) ? commercialCafeStory.coffeeStatus : undefined}
      data-commercial-cafe-narrative-phase={hasContinuousCafe(scene) ? commercialCafeNarrative?.phase ?? commercialCafeStory.narrativePhase : undefined}
      data-commercial-cafe-coffee-owner-phase={hasContinuousCafe(scene) ? commercialCafeCoffeeBehavior.getPhase() : undefined}
      data-commercial-cafe-floor-server-phase={hasContinuousCafe(scene) ? commercialCafeFloorBehavior.getPhase() : undefined}
      data-e2e-world-speed={debugRuntimeEvidence ? locomotionOptions.speedMultiplier() : undefined}
      data-e2e-coffee-owner-speed={debugRuntimeEvidence && hasContinuousCafe(scene) ? cafeCoffeeOwnerLocomotionOptions.speedMultiplier() : undefined}
      data-e2e-floor-server-speed={debugRuntimeEvidence && hasContinuousCafe(scene) ? locomotionOptions.speedMultiplier() : undefined}
      data-commercial-question-narrative={commercialStreetQuestionNarrative?.phase}
      data-e2e-clock-source={debugClockTrialActive ? dialogueClockSource ?? sceneClockSource ?? 'normal-play' : undefined}
      data-debug-cafe-fixture={debugCafeFixture ? 'true' : undefined}
      data-debug-runtime-evidence={debugRuntimeEvidence ? 'true' : undefined}
      data-e2e-access-region-x={debugCafeStaffRegion?.x}
      data-e2e-access-region-y={debugCafeStaffRegion?.y}
      data-e2e-access-region-width={debugCafeStaffRegion?.width}
      data-e2e-access-region-height={debugCafeStaffRegion?.height}
      data-e2e-counter-structure-x={debugCafeCounterStructure?.x}
      data-e2e-counter-structure-y={debugCafeCounterStructure?.y}
      data-e2e-counter-structure-width={debugCafeCounterStructure?.width}
      data-e2e-counter-structure-height={debugCafeCounterStructure?.height}
      data-e2e-coffee-owner-blocker={debugCafeServerBlockerMode ?? undefined}
      data-e2e-coffee-owner-blocker-x={debugRuntimeEvidence ? debugCafeServerBlockerTargetRef.current?.x : undefined}
      data-e2e-coffee-owner-blocker-y={debugRuntimeEvidence ? debugCafeServerBlockerTargetRef.current?.y : undefined}
      data-e2e-story-interrupt-from-duty={debugRuntimeEvidence ? debugCafeStoryInterruptFromDutyRef.current ?? undefined : undefined}
    >
      {!embedded && showSceneChrome && <header className="scene-shell__header">
        <div>
          <p className="scene-shell__eyebrow">NEWTONE / CENTER / MAINLINE SCENE</p>
          <h1>{scene.title}</h1>
          <p className="scene-shell__subtitle">{scene.subtitle}</p>
        </div>
        <div className="scene-shell__state" aria-label="当前场景状态">
          <span>区域</span>
          <strong>{currentAreaLabel}</strong>
        </div>
      </header>}

      <main className="scene-shell__main">
        {!embedded && showSceneChrome && <nav className="mainline-scene-nav" aria-label="主线地点">
          <a href="?scene=jijia-ancestral-home">姬家祖宅</a>
          <a href="?scene=commercial-street">商业街</a>
          <a href="?scene=yonghe-mining-perimeter">矿区</a>
          <a href="?scene=yonghe-eatery">永和小馆</a>
        </nav>}

        <MainlineSceneRenderer
              officeBlindsOpen={officeBlindsOpen}
              officeRoomBlindsState={initialSceneState}
              scene={scene}
              position={position}
              moving={moving}
              destination={requestedWorldTarget}
              layoutMode={layoutMode}
              layout={layout}
              activeObjectId={activeObjectId}
              doorPhases={doorPhases}
              sceneFrameExit={sceneFrameExit}
              storefrontPresentation={storefrontPresentation.phaseByStorefront}
              activeStorefrontId={storefrontPresentation.activeStorefrontId}
              visibleInteriorStorefrontIds={storefrontPresentation.visibleInteriorStorefrontIds}
              paintedInteriorStorefrontId={storefrontPresentation.paintedInteriorStorefrontId}
              onStorefrontFrameRetractionComplete={storefrontPresentation.completeFrameRetraction}
              onStorefrontRevealMotionComplete={storefrontPresentation.completeRevealMotion}
              onStorefrontRestoreMotionComplete={storefrontPresentation.completeRestoreMotion}
              gateTriggered={gateTriggered}
              geometrySnapshot={geometrySnapshot}
              viewportMetrics={activeViewportMetrics}
              embedded={embedded}
              freezeFrameMeasurements={presentationSnapshot}
              onScreenMetricsChange={handleScreenMetricsChange}
              cameraOffset={cameraOffset}
              showProtagonist={showProtagonist}
              suppressWorldEnterAnimation={suppressWorldEnterAnimation}
              onLayoutChange={updateLayout}
              onInteract={interact}
              onCounterInteract={(serviceId, partId, point) => interact(serviceId, false, { partId, point })}
              onStorefrontInteract={interactStorefront}
              onNpcInteract={interactNpc}
              npcPositions={resolvedNpcPositions}
              npcRuntimeSnapshots={npcRuntimeSnapshots}
              hiddenNpcIds={hiddenNpcIds}
              ambientNpcActorLayer={ambientNpcActorLayer}
              readingSessionLayoutCache={sharedReadingSessionLayoutCache}
              onWalk={walk}
              worldQuestionMark={scene.id === 'commercial-street' && !commercialStreetQuestionNarrativeIsCompleted ? { anchor: commercialStreetQuestionNarrativeAnchor(scene), visible: !commercialStreetQuestionNarrative } : undefined}
              dialogue={activeDialogue ? { ...activeDialogue, conversationDisplaySessionId: currentConversationDisplaySessionId ?? undefined } : activeDialogue}
              dialogueLine={activeDialogueLine}
              dialogueText={activeDialogueText}
              dialogueLineIndex={commercialCafeNarrative ? commercialCafeStory.narrativeCursor : dialogueLineIndex}
              dialogueSegmentIndex={dialogueSegmentIndex}
              dialogueSegmentCount={activeDialogueSegments.length}
              dialoguePosition={activeDialoguePosition}
              dialogueOutside={dialogueAnchorSessionRef.current?.outside.get(activeDialogueSpeakerKey)}
              dialoguePhase={dialoguePresentationPhase}
              dialogueTextSessionId={dialogueTextSessionId}
              dialogueTextMotion={dialogueTextMotion}
              dialogueAdvanceDiagnostic={dialogueAdvanceDiagnostic}
              dialogueStage={null}
              dialogueHandoffActive={dialogueHandoffActive}
              dialogueHandoffFadeDurationMs={mainlineDialogueHandoffDurationMs(activeDialogueText.length)}
              dialogueHandoffOutgoing={dialogueHandoffOutgoing}
              onDialogueHandoffOutgoingDeleted={markDialogueHandoffOutgoingDeleted}
              readingMode={readingActive ? (sceneEcho ? 'observation' : 'dialogue') : null}
              onDialogueExitComplete={completeDialogueExit}
              onDialogueAdvance={(intent) => advanceDialogue(false, intent ?? 'segment')}
              onDialogueTypingSkip={skipDialogueTyping}
              onDialogueTextMotionComplete={completeDialogueTextMotion}
              sceneEcho={sceneEcho}
              conversationDisplaySessionId={currentConversationDisplaySessionId}
              conversationDisplayContent={conversationDisplayContent}
              sceneAction={sceneAction}
              onSceneEchoAdvance={advanceSceneEcho}
              onSceneEchoTextMotionComplete={completeSceneEchoTextMotion}
              onSceneActionStart={beginSceneActionChoice}
              onSceneActionChoice={requestSceneActionChoice}
              onSceneActionCancel={() => cancelSceneAction()}
              dialogueChoiceWheel={sceneAction?.optionFlow === 'dialogue-choice' && currentConversationDisplaySessionId
                ? {
                    sessionId: currentConversationDisplaySessionId,
                    actionId: sceneAction.id,
                    flow: 'dialogue-choice',
                    options: sceneAction.options,
                    phase: sceneAction.phase === 'committing' || sceneAction.phase === 'exiting' ? sceneAction.phase : 'active',
                  } satisfies MainlineDialogueChoiceWheelPresentation
                : null}
              onSceneActionExitComplete={finishSceneActionExit}
              onSceneEchoExitComplete={completeSceneEchoExit}
              onHeldConsumableInteract={onConsumeHeldConsumable ?? showHeldMilkTeaAction}
              heldConsumable={resolvedHeldConsumable}
              onFrameMotionProfileChange={handleFrameMotionProfileChange}
              exploredObjectIds={exploredObjectIds}
              interactionTutorialCompleted={interactionTutorialCompleted}
              incenseLit={incenseLit}
              cafeRestroomFixtureUsePhases={cafeRestroomFixtureUsePhases}
              incenseBurnRemainingMs={incenseRemainingMs}
              onIncenseBurnComplete={handleIncenseBurnComplete}
              occupiedSeatIds={occupiedSeatIds}
              playerSeatId={activePlayerSeatId}
              promptedSeatId={promptedSeatId}
              debugCafeSpatialQaEnabled={debugCafeSpatialQa}
              debugCafeSpatialQa={debugCafeSpatialQa ? cafeSpatialQaNavigation : null}
              debugRuntimeEvidence={debugRuntimeEvidence}
              debugInput={debugInput}
              debugNpcMovement={debugNpcMovement}
              onDebugNpcMovement={debugNpcMovement ? runDebugFloorServerMovement : undefined}
              inputDiagnostic={inputDiagnostic}
              onInputDiagnostic={debugInput ? setInputDiagnostic : undefined}
            />
        {!embedded && showSceneChrome && <>
          <div className="scene-hint">{layoutMode ? `拖动文字或桌组调整构图；位置会吸附到 ${layoutGridSize}% 网格。` : scene.hint}</div>
          <div className="scene-toolbar">
            <span>{layoutMode ? `摆设编辑中 · 网格 ${layoutGridSize}%` : currentAreaLabel}</span>
            <div className="scene-toolbar__actions">
              <button className={`scene-layout-toggle ${layoutMode ? 'is-active' : ''}`} type="button" onClick={layoutMode ? exitLayoutMode : enterLayoutMode}>
                {layoutMode ? '退出摆设编辑' : '编辑摆设'}
              </button>
              {layoutMode && <button className="scene-layout-save" type="button" onClick={saveLayout} disabled={layoutSaveState !== 'dirty'}>{layoutSaveState === 'saved' ? '布局已保存' : '保存布局'}</button>}
              {layoutMode && <button className="scene-layout-reset" type="button" onClick={resetLayout}>恢复默认布局</button>}
              <button className="scene-reset" type="button" onClick={reset}>重置场景</button>
            </div>
          </div>
        </>}
        {viewportFormulaLab && !embedded && <aside data-viewport-formula-lab="true" style={{ position: 'fixed', zIndex: 10000, right: 12, top: 12, padding: 12, borderRadius: 8, background: 'rgba(16, 19, 24, .94)', color: '#fff', font: '14px/1.4 system-ui, sans-serif', boxShadow: '0 4px 18px rgba(0,0,0,.35)' }}>
          <div>游戏视口 {viewportMetrics.width} × {viewportMetrics.height} CSS px</div>
          <div>倍率 {mainlineWorldScale(activeViewportMetrics).toFixed(4)}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" aria-pressed={viewportFormulaMode === 'legacy'} onClick={() => setViewportFormulaMode('legacy')}>旧公式</button>
            <button type="button" aria-pressed={viewportFormulaMode === 'device'} onClick={() => setViewportFormulaMode('device')}>新公式</button>
          </div>
        </aside>}
      </main>
    </div>
    </>
  )
}

