'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Point } from './sceneGeometry'
import { MainlineAmbientNpcActor, MainlineSceneRenderer, type MainlineInputDiagnostic } from './MainlineSceneRenderer'
import { getMainlineSceneEntity, mainlineEntityDisplayLabel, mainlineSceneAreaLabel, mainlineScenes, mainlineStorefrontInteractionCandidates, type MainlineSceneDefinition, type MainlineSceneEntity, type MainlineSceneExternalExit, type MainlineSceneId, type MainlineScenePassage } from './mainlineScenes'
import { prepareMainlineWorldNavigation, canActorReachPassageApproach, classifyMainlineWorldCommand, findMainlinePath, findMainlinePathThroughPassage, findMainlinePathToEntity, isMainlineEntityWithinInteractionRange, isMainlineNavigationBarrierClear, isMainlinePassageInTransitZone, isWalkableMainlinePoint, mainlineInteractionTarget, mainlinePassageCollisionForNavigation, mainlinePassageCrossesToSide, mainlinePassageDoorRegion, mainlinePassageDoorwayForNavigation, mainlinePassageExitPoint, mainlinePassageSide, resolveMainlineEntityInteraction, resolveMainlineInteractionCandidates, resolveMainlineStorefrontInteraction, resolveMainlineNpcInteraction, resolveMainlineNpcPosition, resolveMainlineSafeEntryPosition, resolveMainlineSafeSpawnPosition, resolveMainlineSeatSitPosition, resolveMainlineWorldNavigation } from './mainlineNavigation'
import { layoutGridSize, mainlineLabelFootprint, mainlineProtagonistDotFootprint, type SceneLayout } from './sceneLayout'
import { clearSceneLayout, loadSceneLayout, persistSceneLayout } from './sceneLayoutPersistence'
import { movementDurationMsForPath, protagonistCharacterMovementOptions, sharedCharacterMovementOptions, useFreeRoamMovement, type FreeRoamMovement } from './useFreeRoamMovement'
import type { PhoneDevice } from './phoneState'
import { sceneInteractionHandlers } from './sceneInteraction'
import { useAutomaticPassages } from './useAutomaticPassages'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { useMainlineCamera } from './useMainlineCamera'
import type { MainlineRideWalkingContext } from './mainlineRide'
import { sceneDoorMotion } from './sceneDoorConfig'
import { sceneFrameGroupsDueForExit, type SceneFocusFrameMotionProfile } from './sceneFrameExitSchedule'
import type { PlayerChoiceValue, PlayerSceneState } from './playerSave'
import { commercialCafeAnalyticsMilestonePatch, commercialCafeAnalyticsMilestonesFromSceneState, commercialCafeAnalyticsStageForCursor, commercialCafeCompletionPresenceMs, commercialCafeCoffeePreparationDurationMs, commercialCafeCoffeePreparationElapsed, commercialCafeCoffeePreparationStartedAtKey, commercialCafeCoffeeStatusKey, commercialCafeCoffeeArrivedAtPrep, commercialCafeCoffeeDelivered, commercialCafeCoffeeOrdered, commercialCafeCoffeeOrderedState, commercialCafeCoffeeReady, commercialCafeDeliveryDialogueLine, commercialCafeDepartureText, commercialCafeFinishCursorOne, commercialCafeFinishDeliveryLine, commercialCafeLaoZhouConversationSeatId, commercialCafeLaoZhouDepartureDue, commercialCafeLaoZhouIsPresent, commercialCafeNarrativeDialogue, commercialCafeNarrativePhaseKey, commercialCafeNarrativeStarted, commercialCafeStoryCompleted, commercialCafeStoryNeedsMigration, commercialCafeStoryReadyToLeave, commercialCafeStoryStateFromSceneState, commercialCafeStoryStatePatch, commercialCafeStoryWithCursor, isCommercialCafeStoryStage, resolveCommercialCafeNpcInteraction, shouldCompleteCommercialCafeStoryOnTransition, commercialCafeLaoZhouDepartureKey, commercialCafeStoryWithLaoZhouDeparture, commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId, commercialCafeStoryTableId, type CommercialCafeAnalyticsStage, type CommercialCafeNpcInteractionResolution, type CommercialCafeStoryStage } from './commercialCafeStory'
import { commercialCafeDutySpeedMultiplier, createCommercialCafeCoffeeOwnerBehaviorCoordinator, createCommercialCafeFloorServerBehaviorCoordinator } from './commercialCafeBehavior'
import { createMainlineSceneGeometrySnapshot, type MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { createNavigationRuntime } from './navigationCore'
import { useNpcMovement } from './useNpcMovement'
import { AmbientNpcMotion } from './AmbientNpcMotion'
import { npcRetryDelay, type NpcRuntimeSnapshot } from './npcCore'
import { npcRoles } from './npcRoles'
import { useStorefrontPresentation } from './useStorefrontPresentation'
import { splitMainlineInteractionText } from './mainlineTextSegments'
import { mainlineEchoLayout } from './mainlineEchoLayout'
import { sceneTextPresentationPosition } from './sceneTextPresentation'
import { incenseBurnPhase, incenseBurnRemainingMs, initializeOfficePlants, plantIsWatered, resolveMainlineSceneEchoChoice, resolveMainlineSceneExploration, type IncenseBurnPhase } from './mainlineSceneInteractions'
import { nextMainlinePlayerSeatId, mainlineSceneOccupiedSeatIds } from './mainlineSeating'
import { mainlineNpcStagedSeatId } from './mainlineNpcStaging'
import { mainlineExploredObjectIdsFromSceneState, mainlineInteractionCompletesImmediately, mainlineInteractionExploredStateKey } from './mainlineInteractionVisualState'
import { localSlideDirectionForCrossing, shouldUseLocalSlideForPassage, type MainlineWalkingPassageTransitionIntent } from './mainlineSceneTransition'
import { createCommercialStreetStorefrontExecutionRuntime, createCommercialStreetStorefrontInteractionRuntime, commercialStreetStorefrontInteractionFor, executeCommercialStreetStorefrontInteraction, type CommercialStreetStorefrontAction } from './commercialStreetStorefrontInteractions'
import { commercialStreetQuestionNarrativeAnchor, commercialStreetQuestionNarrativeCompleted, commercialStreetQuestionNarrativeCompletedKey, commercialStreetQuestionNarrativeLines, commercialStreetQuestionNarrativeShouldTrigger, nextCommercialStreetQuestionNarrative, type CommercialStreetQuestionNarrativeState } from './commercialStreetQuestionNarrative'
import { commercialStreetMilkTeaConsumePatch, commercialStreetMilkTeaAppUnlockPatch, commercialStreetMilkTeaAppUnlocked, commercialStreetMilkTeaHeld, commercialStreetMilkTeaIsReady, commercialStreetMilkTeaOrderFromSceneState, commercialStreetMilkTeaPickupPatch, commercialStreetMilkTeaStorefrontId, formatCommercialStreetMilkTeaOrderNumber, type CommercialStreetMilkTeaOrder } from './commercialStreetMilkTea'

const emptyExternalStoreSubscribe = () => () => undefined
const emptyLayoutSnapshot: SceneLayout = {}
const emptyExplorationObjectIds: ReadonlySet<string> = new Set()
// Non-Café scenes still render this page. Keep their inactive story reference
// stable so transient save writes (for example a ride arrival position) do not
// repeatedly recreate the NPC registration and presentation dependencies.
const inactiveCommercialCafeStory = commercialCafeStoryStateFromSceneState(undefined)
type NpcDialogueResolution = Extract<CommercialCafeNpcInteractionResolution, { kind: 'dialogue' }>
type CommercialCafeNarrativeRuntime = { phase: 'active' | 'coffee-delivery' | 'delivery-line' | 'leaving' }
function commercialCafeNarrativeRuntimeFromSceneState(sceneId: MainlineSceneId, sceneState: PlayerSceneState): CommercialCafeNarrativeRuntime | null {
  if (sceneId !== 'commercial-cafe') return null
  const saved = commercialCafeStoryStateFromSceneState(sceneState)
  if (saved.status === 'ready-to-leave') return { phase: 'leaving' }
  if (saved.status !== 'available' || saved.narrativePhase === 'not-started' || saved.narrativePhase === 'complete') return null
  if (saved.narrativePhase === 'coffee-delivery') {
    return { phase: saved.coffeeStatus === 'delivered' && saved.narrativeCursor === 1 ? 'delivery-line' : 'coffee-delivery' }
  }
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

function isPastExternalExit(point: Point, boundary: MainlineSceneExternalExit, scene: MainlineSceneDefinition) {
  const value = boundary.axis === 'x' ? point.x : point.y
  const pastThreshold = boundary.direction === -1 ? value <= boundary.threshold : value >= boundary.threshold
  if (!pastThreshold) return false
  const trigger = boundary.triggerEntityId
    ? scene.geometry.find((unit) => unit.geometryKind === 'boundary' && unit.entityId === boundary.triggerEntityId)
    : undefined
  if (!trigger && !boundary.triggerSpan) return pastThreshold
  const tangent = boundary.axis === 'x' ? point.y : point.x
  const minimum = boundary.triggerSpan?.start ?? (boundary.axis === 'x' ? trigger!.y : trigger!.x)
  const maximum = boundary.triggerSpan?.end ?? (boundary.axis === 'x' ? trigger!.y + trigger!.height : trigger!.x + trigger!.width)
  return tangent >= minimum && tangent <= maximum
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
  entityId?: string
  text: string
  segments: readonly string[]
  segmentIndex: number
  position: Point
  options?: readonly string[]
  typing: boolean
  phase?: 'leaving'
  exit?: {
    textComplete: boolean
    frameComplete: boolean
  }
}

type MainlineSceneAction = {
  entityId?: string
  options: readonly string[]
  position: Point
  phase?: 'active' | 'committing'
}

function createMainlineSceneEcho(id: number, entityId: string | undefined, text: string, position: Point, options?: readonly string[]): MainlineSceneEcho {
  const segments = splitMainlineInteractionText(text)
  return {
    id,
    entityId,
    text: segments[0] ?? text.trim(),
    segments,
    segmentIndex: 0,
    position,
    options,
    typing: true,
  }
}

function replaceMainlineSceneEchoText(current: MainlineSceneEcho, text: string): MainlineSceneEcho {
  const segments = splitMainlineInteractionText(text)
  return {
    ...current,
    text: segments[0] ?? text.trim(),
    segments,
    segmentIndex: 0,
    typing: true,
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
  walkRequest,
  phoneOpen = false,
  onPhoneDismiss,
  onReadingStateChange,
  onMeaningfulActivity,
  onDeskInteraction,
  onObjectInteraction,
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
  carriedMilkTea = false,
  carriedPhoneDevice = 'surface',
  ridePickup,
  onSceneTransition,
  onSafeSpawnCorrection,
  entryPosition,
  spawnMode = 'resume',
  resumePosition,
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
  walkRequest?: { id: number; point: Point } | null
  phoneOpen?: boolean
  onPhoneDismiss?: () => void
  onReadingStateChange?: (reading: boolean) => void
  onMeaningfulActivity?: () => void
  onDeskInteraction?: (device: PhoneDevice) => void
  onObjectInteraction?: (entity: MainlineSceneEntity, dwellMs: number) => void
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
  carriedMilkTea?: boolean
  carriedPhoneDevice?: PhoneDevice
  ridePickup?: Point
  onSceneTransition: (sceneId: MainlineSceneId, entryPosition?: Point, spawnMode?: 'resume' | 'ride', transitionIntent?: MainlineWalkingPassageTransitionIntent) => void
  onSafeSpawnCorrection?: (position: Point) => void
  entryPosition?: Point
  spawnMode?: 'resume' | 'ride'
  resumePosition?: Point
}) {
  const sceneDefinition: MainlineSceneDefinition = mainlineScenes[sceneId]
  // Entry resolution returns a point value. Stabilize that value across ordinary
  // scene re-renders so actor-footprint registration is an occupancy lifecycle,
  // not a fresh register/remove cycle whenever presentation state changes.
  const initialPosition = useMemo(
    () => initialPositionForEntry(sceneDefinition, sceneId, entryPosition, spawnMode, resumePosition),
    [entryPosition?.x, entryPosition?.y, resumePosition?.x, resumePosition?.y, sceneDefinition, sceneId, spawnMode],
  )
  const cafeSceneEntryRef = useRef({ sceneId, enteredAt: Date.now() })
  const laoZhouWalkoutActiveRef = useRef(false)
  const [laoZhouSeatReleased, setLaoZhouSeatReleased] = useState(false)
  const laoZhouExitRouteStartedRef = useRef(false)
  const laoZhouExitApproachArrivedRef = useRef(false)
  const laoZhouExitCrossingStartedRef = useRef(false)
  const laoZhouExitPassageIdRef = useRef<string | null>(null)
  const laoZhouExitAttemptRef = useRef('pending')
  if (cafeSceneEntryRef.current.sceneId !== sceneId) {
    cafeSceneEntryRef.current = { sceneId, enteredAt: Date.now() }
    laoZhouWalkoutActiveRef.current = false
    laoZhouExitRouteStartedRef.current = false
    laoZhouExitApproachArrivedRef.current = false
    laoZhouExitCrossingStartedRef.current = false
    laoZhouExitPassageIdRef.current = null
  }
  useEffect(() => {
    setLaoZhouSeatReleased(false)
  }, [sceneId])
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
  const [screenMetrics, setScreenMetrics] = useState<SceneScreenMetrics>(defaultSceneScreenMetrics)
  const sceneReadyRef = useRef(false)
  const handleScreenMetricsChange = useCallback((next: SceneScreenMetrics) => {
    setScreenMetrics((previous) => previous.width === next.width && previous.height === next.height ? previous : next)
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
  const [laoZhouExitRetryTick, setLaoZhouExitRetryTick] = useState(0)
  const cafeCoffeeMoveRetryAppliedRef = useRef(0)
  const cafeFloorMoveRetryAppliedRef = useRef(0)
  const laoZhouExitRetryAppliedRef = useRef(0)
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
  const [npcDialogue, setNpcDialogue] = useState<NpcDialogueResolution | null>(null)
  const [commercialCafeNarrative, setCommercialCafeNarrative] = useState<CommercialCafeNarrativeRuntime | null>(() => commercialCafeNarrativeRuntimeFromSceneState(sceneId, initialSceneState))
  const [playerSeatId, setPlayerSeatId] = useState<string | null>(null)
  // The isolated browser fixture mirrors the real conversation-seat state in
  // memory only. It never writes the user's save and is unavailable in production.
  const activePlayerSeatId = debugCafeFixture ? commercialCafeLaoZhouConversationSeatId : playerSeatId
  const [promptedSeatId, setPromptedSeatId] = useState<string | null>(null)
  const [sceneEcho, setSceneEcho] = useState<MainlineSceneEcho | null>(null)
  const sceneEchoRef = useRef<MainlineSceneEcho | null>(null)
  const [sceneAction, setSceneAction] = useState<MainlineSceneAction | null>(null)
  const pendingSceneActionRef = useRef<MainlineSceneAction | null>(null)
  const [commercialStreetQuestionNarrative, setCommercialStreetQuestionNarrative] = useState<CommercialStreetQuestionNarrativeState | null>(null)
  const [genericDialoguePhase, setGenericDialoguePhase] = useState<'active' | 'leaving'>('active')
  const [commercialStreetQuestionNarrativeCompletedLocally, setCommercialStreetQuestionNarrativeCompletedLocally] = useState(() => commercialStreetQuestionNarrativeCompleted(initialSceneState[commercialStreetQuestionNarrativeCompletedKey]))
  const commercialStreetQuestionNarrativeActiveRef = useRef(false)
  const sceneTextSlowdownActiveRef = useRef(false)
  const [officeBlindsOpen, setOfficeBlindsOpen] = useState(initialSceneState.blindsOpen !== false)
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
    if (scene.id !== 'commercial-cafe') return inactiveCommercialCafeStory
    return debugCafeStoryStage
      ? commercialCafeStoryStateFromSceneState({ commercialCafeStoryStage: debugCafeStoryStage })
      : commercialCafeStoryStateFromSceneState(initialSceneState)
  }, [debugCafeStoryStage, initialSceneState, scene.id])
  const commercialCafeExpiryPassedBeforeEntry = scene.id === 'commercial-cafe'
    && commercialCafeStory.completedAt !== null
    && cafeSceneEntryRef.current.enteredAt >= commercialCafeStory.completedAt + commercialCafeCompletionPresenceMs
  const laoZhouVisibleInCurrentVisit = scene.id === 'commercial-cafe'
    && (commercialCafeLaoZhouIsPresent(commercialCafeStory, Date.now()) && !commercialCafeExpiryPassedBeforeEntry
      || commercialCafeStory.laoZhouDeparture === 'walking-out')
  const carryingMilkTea = carriedMilkTea || commercialStreetMilkTeaHeld(initialSceneState)
  const commercialStreetQuestionNarrativeIsCompleted = commercialStreetQuestionNarrativeCompletedLocally || commercialStreetQuestionNarrativeCompleted(initialSceneState[commercialStreetQuestionNarrativeCompletedKey])
  commercialStreetQuestionNarrativeActiveRef.current = Boolean(commercialStreetQuestionNarrative)
  const recordSceneState = useCallback((targetSceneId: MainlineSceneId, key: string, value: PlayerChoiceValue) => {
    onPlayerSceneStateChange?.(targetSceneId, key, value)
  }, [onPlayerSceneStateChange])
  const recordSceneStatePatch = useCallback((targetSceneId: MainlineSceneId, patch: PlayerSceneState) => {
    onPlayerSceneStatePatch?.(targetSceneId, patch)
  }, [onPlayerSceneStatePatch])
  useEffect(() => {
    cafeAnalyticsMilestonesRef.current = scene.id === 'commercial-cafe'
      ? commercialCafeAnalyticsMilestonesFromSceneState(initialSceneState)
      : new Set()
  }, [initialSceneState, scene.id])
  useEffect(() => {
    const patch = initializeOfficePlants(scene, initialSceneState, Date.now())
    if (Object.keys(patch).length) recordSceneStatePatch(scene.id, patch)
  }, [initialSceneState, recordSceneStatePatch, scene])
  const recordCafeAnalyticsMilestone = useCallback((stage: CommercialCafeAnalyticsStage) => {
    if (scene.id !== 'commercial-cafe' || cafeAnalyticsMilestonesRef.current.has(stage)) return false
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
  const dismissSceneAction = useCallback(() => {
    pendingSceneActionRef.current = null
    setSceneAction(null)
  }, [])
  const beginSceneActionChoice = useCallback((index: number) => {
    setSceneAction((current) => {
      if (!current || current.phase === 'committing' || !current.options[index]) return current
      return { ...current, phase: 'committing' }
    })
  }, [])
  const presentSceneEcho = useCallback((next: MainlineSceneEcho) => {
    sceneEchoRef.current = next
    setSceneEcho(next)
  }, [])
  const completeSceneEchoExit = useCallback((echoId: number) => {
    const current = sceneEchoRef.current
    if (!current || current.id !== echoId || current.phase !== 'leaving') return
    sceneEchoRef.current = null
    setSceneEcho(null)
    setActiveObjectId(null)
    const nextAction = pendingSceneActionRef.current
    pendingSceneActionRef.current = null
    if (nextAction) setSceneAction(nextAction)
  }, [])
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
  const activeDialogue = questionDialogueLine
    ? { triggerEntityId: 'commercial-street-question', lines: commercialStreetQuestionNarrativeLines.map((text, index) => ({ id: `commercial-street-question-${index}`, speaker: '修杰' as const, text })) }
    : commercialCafeNarrative ? commercialCafeNarrativeDialogue
      : npcDialogue?.dialogue ?? scene.dialogue
  const activeDialogueLine = questionDialogueLine ?? (commercialCafeNarrative
    ? cafeNarrativeLine
    : activeDialogue && dialogueLineIndex !== null
      ? activeDialogue.lines[dialogueLineIndex] ?? null
      : null)
  const activeDialogueSegments = activeDialogueLine
    ? splitMainlineInteractionText(activeDialogueLine.text)
    : []
  const activeDialogueText = activeDialogueSegments[dialogueSegmentIndex] ?? activeDialogueSegments[0] ?? ''
  const dialogueAnchorSessionRef = useRef<{ key: string; position: Point } | null>(null)
  const dialogueAnchorSessionKey = activeDialogueLine
    ? commercialStreetQuestionNarrative
      ? 'commercial-street-question'
      : commercialCafeNarrative
        ? 'commercial-cafe-narrative'
        : `dialogue:${scene.id}:${npcDialogue?.dialogue.triggerEntityId ?? activeDialogue?.triggerEntityId ?? 'scene'}`
    : null
  const dialogueAnchorText = activeDialogue?.lines.map((line) => line.text).join('\n') ?? activeDialogueLine?.text ?? ''
  const dialoguePresentationPhase = commercialCafeNarrative?.phase === 'coffee-delivery'
    ? undefined
    : commercialCafeNarrative?.phase === 'delivery-line'
      ? 'active'
      : commercialCafeNarrative?.phase ?? commercialStreetQuestionNarrative?.phase ?? (activeDialogueLine ? genericDialoguePhase : undefined)
  const commercialCafeDeliveryBeatActive = commercialCafeNarrative?.phase === 'coffee-delivery'
  const readingActive = Boolean(
    (sceneEcho && sceneEcho.phase !== 'leaving')
    || (activeDialogueLine && dialoguePresentationPhase !== 'leaving')
    || commercialCafeDeliveryBeatActive
  )
  sceneTextSlowdownActiveRef.current = readingActive
  useEffect(() => {
    onReadingStateChange?.(readingActive)
    return () => onReadingStateChange?.(false)
  }, [onReadingStateChange, readingActive])
  useEffect(() => {
    if (!phoneOpen) return
    if (readingActive) {
      onPhoneDismiss?.()
      return
    }
    dismissSceneEcho()
    dismissSceneAction()
  }, [dismissSceneAction, dismissSceneEcho, onPhoneDismiss, phoneOpen, readingActive])
  const internalMovement = useFreeRoamMovement(initialPosition)
  const { position, moving, moveAlong: rawMoveAlong, stopMovement, resetMovement, getCurrentPosition, getRemainingDurationMs } = movementController ?? internalMovement
  const cameraOffset = useMainlineCamera(scene, position, embedded)
  const storefrontPresentation = useStorefrontPresentation(scene, position)
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
    const box = mainlineLabelFootprint('店员', coffeeOwnerInitialPosition, screenMetrics, { lineHeight: 1 })
    return { width: box.width, height: box.height }
  }, [coffeeOwnerInitialPosition, screenMetrics])
  const cafeFloorServerFootprint = useMemo(() => {
    const box = mainlineLabelFootprint('店员', floorServerInitialPosition, screenMetrics, { lineHeight: 1 })
    return { width: box.width, height: box.height }
  }, [floorServerInitialPosition, screenMetrics])
  const laoZhouFootprint = useMemo(() => {
    const box = mainlineLabelFootprint('老周', laoZhouInitialPosition, screenMetrics, { lineHeight: 1 })
    return { width: box.width, height: box.height }
  }, [laoZhouInitialPosition, screenMetrics])
  const cafeCoffeeOwnerMovement = useNpcMovement({
    enabled: !presentationSnapshot && scene.id === 'commercial-cafe' && scene.npcs.some((npc) => npc.id === commercialCafeCoffeeOwnerNpcId),
    npcId: commercialCafeCoffeeOwnerNpcId,
    initialPosition: coffeeOwnerInitialPosition,
    navigationRuntime,
    footprint: cafeCoffeeOwnerFootprint,
  })
  const cafeFloorServerMovement = useNpcMovement({
    enabled: !presentationSnapshot && scene.id === 'commercial-cafe' && scene.npcs.some((npc) => npc.id === commercialCafeFloorServerNpcId),
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
  const ambientNpcFootprints = useMemo(() => new Map(scene.ambientNpcRoutes.map((schedule) => {
    const npc = scene.npcs.find((candidate) => candidate.id === schedule.npcId)
    const position = stagedNpcPositions.get(schedule.npcId) ?? scene.initialPlayerPosition
    const box = mainlineLabelFootprint(npc?.label ?? '', position, screenMetrics, { lineHeight: 1 })
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
    return positions
  }, [cafeCoffeeOwnerMovement.position, cafeFloorServerMovement.position, laoZhouMovement.position])
  const hiddenAmbientNpcIds = useMemo(() => new Set([...ambientNpcRuntime]
    .filter(([, runtime]) => runtime.hidden)
    .map(([npcId]) => npcId)), [ambientNpcRuntime])
  const hiddenNpcIds = useMemo(() => {
    const hidden = new Set(hiddenAmbientNpcIds)
    if (scene.id === 'commercial-cafe' && !laoZhouVisibleInCurrentVisit) hidden.add('lao-zhou')
    return hidden
  }, [hiddenAmbientNpcIds, laoZhouVisibleInCurrentVisit, scene.id])
  const npcRuntimeSnapshots = useMemo(() => {
    const snapshots = new Map<string, NpcRuntimeSnapshot>([
      [commercialCafeCoffeeOwnerNpcId, cafeCoffeeOwnerMovement.snapshot],
      [commercialCafeFloorServerNpcId, cafeFloorServerMovement.snapshot],
      ['lao-zhou', laoZhouMovement.snapshot],
    ])
    ambientNpcRuntime.forEach(({ snapshot }, npcId) => snapshots.set(npcId, snapshot))
    return snapshots
  }, [ambientNpcRuntime, cafeCoffeeOwnerMovement.snapshot, cafeFloorServerMovement.snapshot, laoZhouMovement.snapshot])
  const resolvedNpcPositions = useMemo(() => new Map(scene.npcs.map((npc) => [
    npc.id,
    resolveMainlineNpcPosition(scene, npc.id, layout, { geometrySnapshot, screenMetrics, npcRuntimePositions }),
  ])), [geometrySnapshot, layout, npcRuntimePositions, scene, screenMetrics])
  const registeredNpcPositions = useMemo(() => new Map([...resolvedNpcPositions]
    .filter(([npcId]) => npcId !== 'lao-zhou' || scene.id !== 'commercial-cafe' || laoZhouVisibleInCurrentVisit)), [laoZhouVisibleInCurrentVisit, resolvedNpcPositions, scene.id])
  // Moving actors own their NavigationRuntime registration through their
  // movement adapters. Re-registering them here on every projected position
  // update would briefly remove their live occupancy during the parent effect
  // cleanup, defeating ambient proximity-yield latching.
  const runtimeManagedNpcIds = useMemo(() => new Set([
    ...scene.ambientNpcRoutes.map((schedule) => schedule.npcId),
    ...(scene.id === 'commercial-cafe' ? [commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId, 'lao-zhou'] : []),
  ]), [scene.ambientNpcRoutes, scene.id, scene.npcs])
  const staticNpcPositions = useMemo(() => new Map([...registeredNpcPositions]
    .filter(([npcId]) => !runtimeManagedNpcIds.has(npcId))), [registeredNpcPositions, runtimeManagedNpcIds])
  const movingNpcIds = useMemo(() => new Set([...npcRuntimeSnapshots]
    .filter(([, snapshot]) => snapshot.phase === 'moving')
    .map(([npcId]) => npcId)), [npcRuntimeSnapshots])
  const releasedCafeSeatNpcIds = useMemo(() => (
    scene.id === 'commercial-cafe' && (laoZhouSeatReleased || commercialCafeStory.laoZhouDeparture === 'departed' || commercialCafeExpiryPassedBeforeEntry)
      ? new Set(['lao-zhou'])
      : new Set<string>()
  ), [commercialCafeExpiryPassedBeforeEntry, commercialCafeStory.laoZhouDeparture, laoZhouSeatReleased, scene.id])
  const occupiedSeatIds = useMemo(() => mainlineSceneOccupiedSeatIds(scene, activePlayerSeatId, releasedCafeSeatNpcIds), [activePlayerSeatId, releasedCafeSeatNpcIds, scene])
  const seatedProtagonistPosition = activePlayerSeatId ? geometrySnapshot.objects.get(activePlayerSeatId)?.position : undefined
  const protagonistFootprint = useMemo(() => {
    const seatedPosition = seatedProtagonistPosition
    const box = seatedPosition
      ? mainlineLabelFootprint('修杰', seatedPosition, screenMetrics, { lineHeight: 1 })
      // The walking marker's dimensions are independent of its live world
      // position. Keeping this footprint stable lets the separate position
      // effect update occupancy without unregistering the protagonist between
      // movement frames.
      : mainlineProtagonistDotFootprint(initialPosition, screenMetrics)
    return { width: box.width, height: box.height }
  }, [activePlayerSeatId, initialPosition, screenMetrics, seatedProtagonistPosition?.x, seatedProtagonistPosition?.y])
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
      const box = mainlineLabelFootprint(npc?.label ?? '', npcPosition, screenMetrics, { lineHeight: 1 })
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
    setNpcDialogue(null)
    setGenericDialoguePhase('active')
    setCommercialCafeNarrative(commercialCafeNarrativeRuntimeFromSceneState(sceneId, initialSceneState))
    setPlayerSeatId(null)
    setPromptedSeatId(null)
    setSceneEcho(null)
    sceneEchoRef.current = null
    pendingSceneActionRef.current = null
    setSceneAction(null)
    setCommercialStreetQuestionNarrative(null)
    setCommercialStreetQuestionNarrativeCompletedLocally(commercialStreetQuestionNarrativeCompleted(initialSceneState[commercialStreetQuestionNarrativeCompletedKey]))
    setOfficeBlindsOpen(initialSceneState.blindsOpen !== false)
    setIncenseLitAt(typeof initialSceneState.incenseLitAt === 'number' ? initialSceneState.incenseLitAt : null)
    setPlantWateredAt(typeof initialSceneState.plantWateredAt === 'number' ? initialSceneState.plantWateredAt : null)
    setIncenseClock(Date.now())
    stopMovement()
  }, [sceneDefinition, sceneId, stopMovement])
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
    if (sceneId !== 'commercial-cafe') return
    if (!commercialCafeStoryNeedsMigration(initialSceneState)) return
    onPlayerSceneStatePatch?.(sceneId, commercialCafeStoryStatePatch(commercialCafeStoryStateFromSceneState(initialSceneState)))
  }, [initialSceneState, onPlayerSceneStatePatch, sceneId])
  useEffect(() => {
    if (scene.id !== 'commercial-cafe'
      || commercialCafeStory.status !== 'complete'
      || commercialCafeStory.completedAt === null
      || commercialCafeStory.laoZhouDeparture !== 'seated') return
    if (commercialCafeExpiryPassedBeforeEntry) {
      recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeStoryWithLaoZhouDeparture(commercialCafeStory, 'departed')))
      return
    }
    const expiresAt = commercialCafeStory.completedAt + commercialCafeCompletionPresenceMs
    const timer = window.setTimeout(() => {
      const latestStory = commercialCafeStoryStateFromSceneState(initialSceneState)
      if (!commercialCafeLaoZhouDepartureDue(latestStory, Date.now())) return
      laoZhouWalkoutActiveRef.current = true
      recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeStoryWithLaoZhouDeparture(latestStory, 'walking-out')))
    }, Math.max(0, expiresAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [commercialCafeExpiryPassedBeforeEntry, commercialCafeStory, initialSceneState, recordSceneStatePatch, scene.id])
  useEffect(() => {
    if (commercialStreetQuestionNarrative || commercialStreetQuestionNarrativeIsCompleted) return
    if (!commercialStreetQuestionNarrativeShouldTrigger(scene, position)) return
    stopMovement()
    setRequestedWorldTarget(null)
    setCommercialStreetQuestionNarrative({ phase: 'active', segmentIndex: 0 })
    onChapterAnalytics?.('commercial_question_triggered')
  }, [commercialStreetQuestionNarrative, commercialStreetQuestionNarrativeIsCompleted, onChapterAnalytics, position, scene, stopMovement])
  if (!dialogueAnchorSessionKey) {
    dialogueAnchorSessionRef.current = null
  } else if (dialogueAnchorSessionRef.current?.key !== dialogueAnchorSessionKey) {
    dialogueAnchorSessionRef.current = {
      key: dialogueAnchorSessionKey,
      position: sceneTextPresentationPosition(scene, position, dialogueAnchorText, screenMetrics),
    }
  }
  const activeDialoguePosition = activeDialogueLine ? dialogueAnchorSessionRef.current?.position ?? null : null
  const validatedSpawnKeyRef = useRef<string | null>(null)
  const spawnValidationKey = `${scene.id}:${initialPosition.x}:${initialPosition.y}:${screenMetrics.width}:${screenMetrics.height}`
  useIsomorphicLayoutEffect(() => {
    if (validatedSpawnKeyRef.current === spawnValidationKey) return
    validatedSpawnKeyRef.current = spawnValidationKey
    const safePosition = resolveMainlineSafeSpawnPosition(scene, initialPosition, layout, { screenMetrics })
    if (!safePosition || samePoint(safePosition, initialPosition) || !samePoint(getCurrentPosition(), initialPosition)) return
    resetMovement(safePosition)
    onPositionChange?.(safePosition)
    if (entryPosition) onSafeSpawnCorrection?.(safePosition)
  }, [entryPosition, getCurrentPosition, initialPosition, layout, onPositionChange, onSafeSpawnCorrection, resetMovement, scene, screenMetrics, spawnValidationKey])
  const externalExits = scene.externalExits
  const activeExternalExit = externalExits.find((boundary) => isPastExternalExit(position, boundary, scene))
  const gateTriggered = externalExits.some((boundary) => Boolean(boundary.triggerEntityId) && isPastExternalExit(position, boundary, scene))
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
      sceneTextPresentationPosition(scene, getCurrentPosition(), text, screenMetrics),
    ))
  }, [getCurrentPosition, presentSceneEcho, scene, screenMetrics])
  const showAccessRegionDeniedText = useCallback((text: string) => {
    sceneEchoIdRef.current += 1
    presentSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      undefined,
      text,
      sceneTextPresentationPosition(scene, getCurrentPosition(), text, screenMetrics),
    ))
  }, [getCurrentPosition, presentSceneEcho, scene, screenMetrics])
  const { requestPassage: requestPassageLifecycle, cancelPassage: cancelPassageLifecycle, updateActor: updatePassageLifecycle, completeOpen, completeClose, getPassagePhase, isPassageActorActive, getOpenPassageIds, passageStates } = useAutomaticPassages({
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
  useEffect(() => {
    if (!presentationSnapshot) prepareMainlineWorldNavigation(scene, layout, navigationOptions)
  }, [scene, layout, navigationOptions, presentationSnapshot])
  const locomotionOptions = useMemo(() => ({
    ...sharedCharacterMovementOptions(screenMetrics),
    speedMultiplier: () => sceneTextSlowdownActiveRef.current ? .45 : 1,
  }), [screenMetrics])
  const protagonistLocomotionOptions = useMemo(() => ({
    ...protagonistCharacterMovementOptions(screenMetrics),
    speedMultiplier: () => sceneTextSlowdownActiveRef.current ? .45 : 1,
  }), [screenMetrics])
  const cafeCoffeeOwnerLocomotionOptions = useMemo(() => ({
    ...locomotionOptions,
    speedMultiplier: () => commercialCafeDutySpeedMultiplier(commercialCafeCoffeeOwnerNpcId, cafeCoffeeOwnerCurrentDutyRef.current, sceneTextSlowdownActiveRef.current),
  }), [locomotionOptions])
  useEffect(() => {
    if (scene.id !== 'commercial-cafe'
      || commercialCafeStory.coffeeStatus !== 'preparing'
      || commercialCafeStory.coffeePreparationStartedAt === null) return
    const remainingMs = Math.max(0, commercialCafeStory.coffeePreparationStartedAt + commercialCafeCoffeePreparationDurationMs - Date.now())
    const timer = window.setTimeout(() => {
      const current = commercialCafeStoryStateFromSceneState(initialSceneState)
      if (!commercialCafeCoffeePreparationElapsed(current, Date.now())) return
      recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeCoffeeReady(current)))
    }, remainingMs)
    return () => window.clearTimeout(timer)
  }, [commercialCafeStory.coffeePreparationStartedAt, commercialCafeStory.coffeeStatus, initialSceneState, recordSceneStatePatch, scene.id])
  useEffect(() => {
    if (!debugCafeFixture || debugCafeFixtureAppliedRef.current || scene.id !== 'commercial-cafe') return
    debugCafeFixtureAppliedRef.current = true
    const sitPosition = resolveMainlineSeatSitPosition(scene, commercialCafeLaoZhouConversationSeatId, layout, navigationOptions)
    if (!sitPosition) return
    stopMovement()
    resetMovement(sitPosition)
    navigationRuntime.updateActor('protagonist', sitPosition)
  }, [debugCafeFixture, layout, navigationOptions, navigationRuntime, resetMovement, scene, stopMovement])
  useEffect(() => {
    if (!debugCafePlayerPosition || debugCafePlayerPositionAppliedRef.current || scene.id !== 'commercial-cafe') return
    if (!isWalkableMainlinePoint(debugCafePlayerPosition, scene, layout, navigationOptions)) return
    debugCafePlayerPositionAppliedRef.current = true
    stopMovement()
    resetMovement(debugCafePlayerPosition)
    navigationRuntime.updateActor('protagonist', debugCafePlayerPosition)
  }, [debugCafePlayerPosition, layout, navigationOptions, navigationRuntime, resetMovement, scene, stopMovement])
  useEffect(() => {
    if (!debugCafeServerBlocker || scene.id !== 'commercial-cafe') return undefined
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
    if (!debugCafeStoryInterrupt || debugCafeStoryInterruptAppliedRef.current || scene.id !== 'commercial-cafe') return
    const waitsForPublicService = debugCafeStoryInterruptMode === 'public'
    if (commercialCafeStory.status !== 'available' || cafeFloorServerMovement.snapshot.phase !== 'moving') return
    if (waitsForPublicService && cafeFloorServerMovement.snapshot.dutyId !== 'cafe-floor-server.table-service') return
    debugCafeStoryInterruptAppliedRef.current = true
    debugCafeStoryInterruptFromDutyRef.current = cafeFloorServerMovement.snapshot.dutyId
    setDebugCafeStoryStage('met-lao-zhou')
  }, [cafeFloorServerMovement.snapshot.dutyId, cafeFloorServerMovement.snapshot.phase, commercialCafeStory.status, debugCafeStoryInterrupt, debugCafeStoryInterruptMode, scene.id])
  useEffect(() => {
    if (scene.id !== 'commercial-cafe' || cafeCoffeeOwnerMovement.snapshot.phase !== 'blocked') return
    const timer = window.setTimeout(() => setCafeCoffeeMoveRetryTick((tick) => tick + 1), npcRetryDelay(300, cafeCoffeeOwnerMovement.snapshot.retryCount))
    return () => window.clearTimeout(timer)
  }, [cafeCoffeeOwnerMovement.snapshot.phase, cafeCoffeeOwnerMovement.snapshot.retryCount, scene.id])
  useEffect(() => () => {
    if (cafeCounterAmbientTimerRef.current !== null) window.clearTimeout(cafeCounterAmbientTimerRef.current)
    if (cafeFloorDwellTimerRef.current !== null) window.clearTimeout(cafeFloorDwellTimerRef.current)
  }, [])
  useEffect(() => {
    if (scene.id !== 'commercial-cafe' || cafeFloorServerMovement.snapshot.phase !== 'blocked') return
    const timer = window.setTimeout(() => setCafeFloorMoveRetryTick((tick) => tick + 1), npcRetryDelay(300, cafeFloorServerMovement.snapshot.retryCount))
    return () => window.clearTimeout(timer)
  }, [cafeFloorServerMovement.snapshot.phase, cafeFloorServerMovement.snapshot.retryCount, scene.id])
  useEffect(() => {
    if (scene.id !== 'commercial-cafe') {
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
      if (intent.dutyId === 'cafe-coffee-owner.prepare') {
        const current = commercialCafeStoryStateFromSceneState(initialSceneState)
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeCoffeeArrivedAtPrep(current, Date.now())))
        commercialCafeCoffeeBehavior.arrivedAtPrep()
      } else if (intent.dutyId === 'cafe-coffee-owner.deliver-coffee') {
        const current = commercialCafeStoryStateFromSceneState(initialSceneState)
        const delivered = commercialCafeCoffeeDelivered(current)
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(delivered))
        setDialogueSegmentIndex(0)
        setCommercialCafeNarrative({ phase: 'delivery-line' })
        commercialCafeCoffeeBehavior.arrivedAtStoryTable()
      } else if (intent.dutyId === 'cafe-coffee-owner.return-to-counter') {
        cafeCoffeeOwnerCurrentDutyRef.current = null
        commercialCafeCoffeeBehavior.arrivedAtCounter()
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
  }, [cafeCoffeeMoveRetryTick, cafeCounterAmbientWakeTick, cafeCoffeeOwnerMovement, cafeCoffeeOwnerLocomotionOptions, commercialCafeCoffeeBehavior, commercialCafeStory.coffeeStatus, commercialCafeStory.narrativePhase, initialSceneState, layout, navigationOptions, recordSceneStatePatch, scene])
  useEffect(() => {
    if (scene.id !== 'commercial-cafe') {
      commercialCafeFloorBehavior.reset()
      return
    }
    if (!cafeFloorServerMovement.position) return
    if (cafeFloorServerMovement.snapshot.phase === 'blocked' && cafeFloorMoveRetryTick !== cafeFloorMoveRetryAppliedRef.current) {
      cafeFloorMoveRetryAppliedRef.current = cafeFloorMoveRetryTick
      commercialCafeFloorBehavior.retry()
    }
    const intent = commercialCafeFloorBehavior.request(scene, cafeFloorServerMovement.snapshot)
    if (!intent) return
    const started = cafeFloorServerMovement.requestMove(intent, scene, layout, navigationOptions, locomotionOptions, () => {
      const dwellMs = commercialCafeFloorBehavior.arrived()
      cafeFloorDwellTimerRef.current = window.setTimeout(() => {
        cafeFloorDwellTimerRef.current = null
        commercialCafeFloorBehavior.finishDwell()
        setCafeFloorDwellWake((wake) => wake + 1)
      }, dwellMs)
    })
    if (!started) commercialCafeFloorBehavior.block()
  }, [cafeFloorDwellWake, cafeFloorMoveRetryTick, cafeFloorServerMovement, commercialCafeFloorBehavior, layout, locomotionOptions, navigationOptions, scene])
  const runDebugFloorServerMovement = useCallback(() => {
    if (scene.id !== 'commercial-cafe' || !cafeFloorServerMovement.position || cafeFloorServerMovement.snapshot.phase === 'moving') return
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
      canOccupy: (point: Point) => isWalkableMainlinePoint(point, scene, layout, { ...navigationOptions, openPassageIds: getOpenPassageIds() }),
      canTraverse: (start: Point, end: Point) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
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
  }, [armPassageFrameExit, cancelPassageLifecycle, getCurrentPosition, getOpenPassageIds, getPassagePhase, getRemainingDurationMs, layout, lifecycleMainlinePassages, protagonistLocomotionOptions, moveAlong, navigationOptions, onDoorEvent, protagonistFootprint, requestPassageLifecycle, scene, screenMetrics, stopMovement])

  const continuePendingTraversal = useCallback((entityId: string) => {
    const pending = pendingTraversalRef.current
    if (!pending || pending.passage.entityId !== entityId) return
    if (!pending.approachArrived) return
    if (!isPassageActorActive('protagonist', pending.passage.id)) return
    // Consume approach arrival before crossing; lifecycle updates cannot restart this leg.
    pending.approachArrived = false
    const traversalStart = getCurrentPosition()
    const openNavigationOptions = { ...navigationOptions, openPassageIds: getOpenPassageIds() }
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
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, { ...navigationOptions, openPassageIds: getOpenPassageIds() })
          || isMainlinePassageInTransitZone(pending.passage, point, protagonistFootprint, doorway),
        canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
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
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, openNavigationOptions),
        canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
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
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, openNavigationOptions)
        || isMainlinePassageInTransitZone(pending.passage, point, protagonistFootprint, doorway),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
      onBlocked: () => {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setActiveObjectId(null)
      },
    })
  }, [beginPassageLeg, commercialCafeStory, getCurrentPosition, getOpenPassageIds, isPassageActorActive, layout, protagonistLocomotionOptions, moveAlong, navigationOptions, notifySceneTransition, onDoorEvent, protagonistFootprint, recordCafeAnalyticsMilestone, recordSceneStatePatch, scene])

  continuePendingTraversalRef.current = continuePendingTraversal

  useEffect(() => {
    const pending = pendingTraversalRef.current
    if (!pending?.approachArrived || !pending.requestIssued) return
    if (!isPassageActorActive('protagonist', pending.passage.id)) return
    const phase = getPassagePhase(pending.passage.id)
    if (phase === 'open' || phase === 'crossing') continuePendingTraversalRef.current(pending.passage.entityId)
  }, [getPassagePhase, isPassageActorActive, passageStates])

  const completeDoorTransition = useCallback((entityId: string, completion: 'opened' | 'closed') => {
    const passage = scene.passages.find((candidate) => candidate.entityId === entityId)
    if (!passage) return
    if (completion === 'opened') {
      if (completeOpen(passage.id)) continuePendingTraversal(entityId)
    }
    else {
      completeClose(passage.id)
      setSceneFrameExit((current) => current.phase === 'retracting' && current.scope === 'passage' && current.passageEntityId === entityId
        ? { phase: 'idle' }
        : current)
    }
  }, [completeClose, completeOpen, continuePendingTraversal, scene.passages])

  useEffect(() => () => {
    pendingTraversalRef.current = null
  }, [])

  useEffect(() => onPositionChange?.(position), [onPositionChange, position])
  useEffect(() => onRuntimePositionChange?.(scene.id, position, { layout, screenMetrics, cameraOffset }), [cameraOffset, layout, onRuntimePositionChange, position, scene.id, screenMetrics])
  useEffect(() => {
    onPlayerMovementStateChange?.(moving)
    return () => onPlayerMovementStateChange?.(false)
  }, [moving, onPlayerMovementStateChange])

  useEffect(() => {
    const previousExternalExit = externalExits.find((boundary) => isPastExternalExit(previousExternalExitPositionRef.current, boundary, scene))
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
    const cafeActive = scene.id === 'commercial-cafe'
    updatePassageLifecycle(commercialCafeCoffeeOwnerNpcId, cafeCoffeeOwnerMovement.position ?? coffeeOwnerInitialPosition, cafeActive && Boolean(cafeCoffeeOwnerMovement.position))
    updatePassageLifecycle(commercialCafeFloorServerNpcId, cafeFloorServerMovement.position ?? floorServerInitialPosition, cafeActive && Boolean(cafeFloorServerMovement.position))
    updatePassageLifecycle('lao-zhou', laoZhouMovement.position ?? laoZhouInitialPosition, cafeActive && Boolean(laoZhouMovement.position))
  }, [cafeCoffeeOwnerMovement.position, cafeFloorServerMovement.position, coffeeOwnerInitialPosition, floorServerInitialPosition, laoZhouInitialPosition, laoZhouMovement.position, scene.id, updatePassageLifecycle])

  useEffect(() => {
    if (scene.id !== 'commercial-cafe'
      || commercialCafeStory.status !== 'complete'
      || commercialCafeStory.laoZhouDeparture !== 'walking-out') return
    // A reload resumes the authored walkout from Lao Zhou's staged seat; it
    // must not turn an in-progress physical exit into an immediate despawn.
    laoZhouWalkoutActiveRef.current = true
  }, [commercialCafeStory.laoZhouDeparture, commercialCafeStory.status, scene.id])

  useEffect(() => {
    if (scene.id !== 'commercial-cafe'
      || commercialCafeStory.status !== 'complete'
      || commercialCafeStory.laoZhouDeparture !== 'walking-out'
      || !laoZhouWalkoutActiveRef.current
      || !laoZhouMovement.position
      || laoZhouExitRouteStartedRef.current) return
    // Route queries can fail before the movement adapter gets a path (for
    // example, every legal door approach is temporarily occupied). Retry the
    // same passage request through shared navigation instead of leaving the
    // story stuck in an idle-looking walk-out phase.
    const timer = window.setTimeout(() => setLaoZhouExitRetryTick((tick) => tick + 1), npcRetryDelay(350, laoZhouMovement.snapshot.retryCount))
    return () => window.clearTimeout(timer)
  }, [commercialCafeStory.laoZhouDeparture, commercialCafeStory.status, laoZhouExitRetryTick, laoZhouMovement.position, laoZhouMovement.snapshot.phase, laoZhouMovement.snapshot.retryCount, scene.id])

  useEffect(() => {
    if (scene.id !== 'commercial-cafe'
      || commercialCafeStory.status !== 'complete'
      || commercialCafeStory.laoZhouDeparture !== 'walking-out'
      || !laoZhouWalkoutActiveRef.current
      || !laoZhouMovement.position
      || laoZhouExitRouteStartedRef.current) return
    if (laoZhouMovement.snapshot.phase === 'blocked' && laoZhouExitRetryTick === laoZhouExitRetryAppliedRef.current) return
    if (laoZhouMovement.snapshot.phase === 'blocked') laoZhouExitRetryAppliedRef.current = laoZhouExitRetryTick
    const passage = scene.passages.find((candidate) => candidate.id === 'street-cafe-entry')
    if (!passage) {
      laoZhouExitAttemptRef.current = 'passage-missing'
      return
    }
    const from = laoZhouMovement.getPosition()
    const passageOptions = { ...navigationOptions, actorId: 'lao-zhou', actorFootprint: laoZhouFootprint, navigationRuntime }
    const collision = mainlinePassageCollisionForNavigation(scene, passage, passageOptions)
    const doorway = mainlinePassageDoorwayForNavigation(scene, passage, passageOptions)
    const exitTarget = mainlinePassageExitPoint(passage, from, laoZhouFootprint, collision, doorway)
    const approach = canActorReachPassageApproach(scene, passage, from, layout, passageOptions)
    if (!approach) {
      const staticApproach = debugRuntimeEvidence
        ? canActorReachPassageApproach(scene, passage, from, layout, { ...passageOptions, navigationRuntime: undefined })
        : null
      laoZhouExitAttemptRef.current = staticApproach ? 'approach-blocked-by-actor' : 'approach-unreachable-static'
      return
    }
    if (!requestPassageLifecycle('lao-zhou', passage.id, from, exitTarget)) {
      laoZhouExitAttemptRef.current = 'passage-reservation-denied'
      return
    }
    laoZhouExitPassageIdRef.current = passage.id
    laoZhouExitRouteStartedRef.current = true
    const started = laoZhouMovement.requestMove({
      dutyId: npcRoles.laoZhou.duties.exitCafe.id,
      targetId: passage.entityId,
      target: approach.target,
    }, scene, layout, passageOptions, {
      ...locomotionOptions,
      onMove: (position) => {
        const stagedSeatId = mainlineNpcStagedSeatId(scene, 'lao-zhou')
        const seatCollision = stagedSeatId ? geometrySnapshot.objects.get(stagedSeatId)?.collision : null
        if (!laoZhouSeatReleased && seatCollision) {
          const actorLeft = position.x - laoZhouFootprint.width / 2
          const actorRight = position.x + laoZhouFootprint.width / 2
          const actorTop = position.y - laoZhouFootprint.height / 2
          const actorBottom = position.y + laoZhouFootprint.height / 2
          const stillOverlapsSeat = actorLeft < seatCollision.x + seatCollision.width
            && actorRight > seatCollision.x
            && actorTop < seatCollision.y + seatCollision.height
            && actorBottom > seatCollision.y
          if (!stillOverlapsSeat) setLaoZhouSeatReleased(true)
        }
      },
      onBlocked: () => {
        laoZhouExitAttemptRef.current = 'approach-movement-blocked'
        laoZhouExitRouteStartedRef.current = false
        laoZhouExitPassageIdRef.current = null
        cancelPassageLifecycle('lao-zhou', passage.id)
      },
    }, () => {
      laoZhouExitApproachArrivedRef.current = true
    })
    if (!started) {
      laoZhouExitAttemptRef.current = 'approach-movement-rejected'
      laoZhouExitRouteStartedRef.current = false
      laoZhouExitPassageIdRef.current = null
      cancelPassageLifecycle('lao-zhou', passage.id)
    } else {
      laoZhouExitAttemptRef.current = 'approach-moving'
    }
  }, [cancelPassageLifecycle, commercialCafeStory.laoZhouDeparture, commercialCafeStory.status, geometrySnapshot, laoZhouExitRetryTick, laoZhouFootprint, laoZhouMovement, laoZhouSeatReleased, layout, locomotionOptions, navigationOptions, navigationRuntime, requestPassageLifecycle, scene])

  useEffect(() => {
    const passageId = laoZhouExitPassageIdRef.current
    if (scene.id !== 'commercial-cafe'
      || commercialCafeStory.laoZhouDeparture !== 'walking-out'
      || !laoZhouWalkoutActiveRef.current
      || !laoZhouExitApproachArrivedRef.current
      || laoZhouExitCrossingStartedRef.current
      || !passageId
      || !isPassageActorActive('lao-zhou', passageId)
      || !['open', 'crossing'].includes(getPassagePhase(passageId))
      || !laoZhouMovement.position) return
    if (laoZhouMovement.snapshot.phase === 'blocked' && laoZhouExitRetryTick === laoZhouExitRetryAppliedRef.current) return
    if (laoZhouMovement.snapshot.phase === 'blocked') laoZhouExitRetryAppliedRef.current = laoZhouExitRetryTick
    const passage = scene.passages.find((candidate) => candidate.id === passageId)
    if (!passage) return
    const from = laoZhouMovement.getPosition()
    const passageOptions = { ...navigationOptions, actorId: 'lao-zhou', actorFootprint: laoZhouFootprint, openPassageIds: getOpenPassageIds(), navigationRuntime }
    const collision = mainlinePassageCollisionForNavigation(scene, passage, passageOptions)
    const doorway = mainlinePassageDoorwayForNavigation(scene, passage, passageOptions)
    const exitPoint = mainlinePassageExitPoint(passage, from, laoZhouFootprint, collision, doorway)
    laoZhouExitCrossingStartedRef.current = true
    const started = laoZhouMovement.requestRoute({
      dutyId: `${npcRoles.laoZhou.duties.exitCafe.id}.crossing`,
      targetId: passage.entityId,
      target: exitPoint,
    }, [from, exitPoint], {
      ...locomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, passageOptions)
        || isMainlinePassageInTransitZone(passage, point, laoZhouFootprint, doorway),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, passageOptions),
      onBlocked: () => { laoZhouExitCrossingStartedRef.current = false },
    })
    if (!started) laoZhouExitCrossingStartedRef.current = false
  }, [commercialCafeStory.laoZhouDeparture, getOpenPassageIds, getPassagePhase, isPassageActorActive, laoZhouExitRetryTick, laoZhouFootprint, laoZhouMovement, layout, locomotionOptions, navigationOptions, navigationRuntime, passageStates, scene])

  useEffect(() => {
    const passageId = laoZhouExitPassageIdRef.current
    if (scene.id !== 'commercial-cafe'
      || commercialCafeStory.laoZhouDeparture !== 'walking-out'
      || !laoZhouWalkoutActiveRef.current
      || !laoZhouExitCrossingStartedRef.current
      || !passageId
      || isPassageActorActive('lao-zhou', passageId)
      || getPassagePhase(passageId) !== 'closed') return
    laoZhouWalkoutActiveRef.current = false
    recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeStoryWithLaoZhouDeparture(commercialCafeStory, 'departed')))
  }, [commercialCafeStory, getPassagePhase, isPassageActorActive, passageStates, recordSceneStatePatch, scene.id])

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
    npcInteractionRequestRef.current += 1
    pendingTraversalRef.current = null
    setSceneFrameExit({ phase: 'idle' })
    cancelPassageLifecycle('protagonist')
    setPassageDestination(null)
    const path = plannedPath ?? findMainlinePath(getCurrentPosition(), target, scene, layout, navigationOptions)
    if (!path) {
      stopMovement()
      return false
    }
    const movementOptions = {
      ...protagonistLocomotionOptions,
      canOccupy: (point: Point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
      canTraverse: (start: Point, end: Point) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
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
  }, [armPassageFrameExit, cancelPassageLifecycle, getCurrentPosition, getRemainingDurationMs, layout, protagonistLocomotionOptions, moveAlong, navigationOptions, scene, stopMovement])

  const leavePlayerSeat = useCallback(() => {
    if (!activePlayerSeatId) return false
    const standingPosition = mainlineInteractionTarget(scene, activePlayerSeatId, getCurrentPosition(), layout, undefined, navigationOptions)
    setPlayerSeatId(null)
    setActiveObjectId((current) => current === activePlayerSeatId ? null : current)
    resetMovement(standingPosition)
    navigationRuntime.updateActor('protagonist', standingPosition)
    return true
  }, [activePlayerSeatId, getCurrentPosition, layout, navigationRuntime, navigationOptions, resetMovement, scene])

  const startNpcDialogue = useCallback((resolution: NpcDialogueResolution) => {
    stopMovement()
    setDialogueSegmentIndex(0)
    setGenericDialoguePhase('active')
    setNpcDialogue(resolution)
    setDialogueLineIndex(0)
    if (resolution.promptSeatId) setPromptedSeatId(resolution.promptSeatId)
  }, [stopMovement])
  const startCommercialCafeNarrative = useCallback(() => {
    if (scene.id !== 'commercial-cafe' || commercialCafeStory.status !== 'available') return
    stopMovement()
    setNpcDialogue(null)
    setDialogueSegmentIndex(0)
    setDialogueLineIndex(commercialCafeStory.narrativeCursor)
    setCommercialCafeNarrative({ phase: 'active' })
    recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeNarrativeStarted(commercialCafeStory)))
    const stage = commercialCafeAnalyticsStageForCursor(commercialCafeStory.narrativeCursor)
    if (stage) recordCafeAnalyticsMilestone(stage)
  }, [commercialCafeStory, recordCafeAnalyticsMilestone, recordSceneStatePatch, scene.id, stopMovement])

  const startPassageTraversal = useCallback((passage: MainlineScenePassage, requestedTarget: Point, plannedApproachPath?: Point[] | null, continuationPath?: Point[] | null, passageQueue: readonly MainlineScenePassage[] = [passage], passageIndex = 0) => {
    if (sceneAction?.phase === 'committing') return
    dismissSceneAction()
    dismissSceneEcho()
    beginPassageLeg(passage, requestedTarget, plannedApproachPath, continuationPath, passageQueue, passageIndex)
  }, [beginPassageLeg, dismissSceneAction, dismissSceneEcho, sceneAction?.phase])

  const interact = useCallback((entityId: string, requestAlreadyRecorded = false) => {
    if (readingActive || sceneAction?.phase === 'committing') return
    dismissSceneAction()
    npcInteractionRequestRef.current += 1
    setRequestedWorldTarget(null)
    if (phoneOpen) onPhoneDismiss?.()
    setDialogueLineIndex(null)
    setNpcDialogue(null)
    setCommercialCafeNarrative(null)
    dismissSceneEcho()
    const entity = getMainlineSceneEntity(scene, entityId)
    const passage = scene.passages.find((candidate) => candidate.entityId === entityId)
    if (!requestAlreadyRecorded) pendingInteractionAfterTraversalRef.current = null
    if (!requestAlreadyRecorded) onInteractionAnalytics?.('requested', entityId, passage ? 'door' : entity.kind)
    if (entity.kind === 'seat' && entity.seat) {
      const nextSeatId = nextMainlinePlayerSeatId(scene, activePlayerSeatId, entity.id)
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
        resetMovement(sitPosition)
        navigationRuntime.updateActor('protagonist', sitPosition)
        setPlayerSeatId(nextSeatId)
        setPromptedSeatId(null)
        markEntityExplored(entity.id)
        onInteractionAnalytics?.('completed', entity.id, 'seat', 'seated')
        const resolution = resolveCommercialCafeNpcInteraction({
          sceneId: scene.id,
          npcId: 'lao-zhou',
          story: commercialCafeStory,
          playerSeatId: nextSeatId,
        })
        if (resolution?.kind === 'start-narrative') startCommercialCafeNarrative()
      }, {
        ...protagonistLocomotionOptions,
        // A seat remains a two-step interaction exception. Its route may need
        // to keep the planner's turn around the paired table before the final
        // pulled/sit transition; generic smoothing must not straighten that
        // legal route back through furniture.
        preserveNavigationRoute: true,
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
        canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
        onBlocked: () => {
          setActiveObjectId(null)
          onInteractionAnalytics?.('blocked', entity.id, 'seat', 'movement-blocked')
        },
      })
      return
    }
    leavePlayerSeat()
    if (passage) {
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
      const interactionStartedAt = interactionStartedAtRef.current
      interactionStartedAtRef.current = null
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
        carriedMilkTea: carriedMilkTea || commercialStreetMilkTeaHeld(initialSceneState),
      })
      const explorationChoice = exploration.choice
      const explorationPool = exploration.pool
      const availableExplorationPool = explorationPool ?? []
      const hasExplorationContent = Boolean(explorationChoice || availableExplorationPool.length)
      const startsDialogue = scene.dialogue?.triggerEntityId === entity.id
      if (hasExplorationContent) {
        const text = explorationChoice?.text ?? availableExplorationPool[Math.floor(Math.random() * availableExplorationPool.length)]
        sceneEchoIdRef.current += 1
        presentSceneEcho(createMainlineSceneEcho(
          sceneEchoIdRef.current,
          entity.id,
          text,
          sceneTextPresentationPosition(scene, getCurrentPosition(), text, screenMetrics),
          explorationChoice?.options,
        ))
      }
      if (startsDialogue) {
        setDialogueSegmentIndex(0)
        setGenericDialoguePhase('active')
        setDialogueLineIndex(0)
      }
      if (mainlineInteractionCompletesImmediately({ hasExplorationContent, startsDialogue })) {
        completeShortInteraction(entityId)
      } else {
        markEntityExplored(entityId)
      }
    }
    const interaction = resolveMainlineEntityInteraction(scene, entity.id, getCurrentPosition(), layout, navigationOptions)
    if (interaction.inRange) {
      interactionStartedAtRef.current = Date.now()
      setActiveObjectId(entityId)
      stopMovement()
      revealInteraction()
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
    moveAlong(resolved.path, revealInteraction, {
      ...protagonistLocomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
      onBlocked: () => {
        interactionStartedAtRef.current = null
        setActiveObjectId(null)
        onInteractionAnalytics?.('blocked', entity.id, entity.kind, 'movement-blocked')
      },
    })
  }, [activePlayerSeatId, carriedPhoneDevice, commercialCafeNarrative, commercialCafeStory, completeShortInteraction, dismissSceneAction, dismissSceneEcho, getCurrentPosition, incensePhase, layout, leavePlayerSeat, protagonistLocomotionOptions, markEntityExplored, moveAlong, navigationOptions, navigationRuntime, officeBlindsOpen, onDoorEvent, onInteractionAnalytics, onObjectInteraction, onPhoneDismiss, phoneOpen, initialSceneState, plantWateredAt, presentSceneEcho, readingActive, recordSceneState, resetMovement, scene, sceneAction?.phase, screenMetrics, startCommercialCafeNarrative, startNpcDialogue, startPassageTraversal, stopMovement])

  resumeInteractionRef.current = (entityId) => interact(entityId, true)

  const showMilkTeaEcho = useCallback((text: string, options?: readonly string[]) => {
    sceneEchoIdRef.current += 1
    presentSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      commercialStreetMilkTeaStorefrontId,
      text,
      sceneTextPresentationPosition(scene, getCurrentPosition(), text, screenMetrics),
      options,
    ))
  }, [getCurrentPosition, presentSceneEcho, scene, screenMetrics])

  const beginMilkTeaStorefrontAction = useCallback(() => {
    const currentOrder = commercialStreetMilkTeaOrderFromSceneState(initialSceneState)
    if (carriedMilkTea || commercialStreetMilkTeaHeld(initialSceneState)) {
      showMilkTeaEcho('手里已经有一杯饮料。', ['喝奶茶'])
      return
    }
    if (currentOrder) {
      if (commercialStreetMilkTeaIsReady(currentOrder)) {
        onMilkTeaOrderReady?.(currentOrder)
        recordSceneStatePatch('commercial-street', commercialStreetMilkTeaPickupPatch())
        onChapterAnalytics?.('milk_tea_order_picked_up', { orderNumber: currentOrder.number })
        showMilkTeaEcho('取到奶茶。')
        return
      }
      onMilkTeaAppOpen?.()
      return
    }
    if (!commercialStreetMilkTeaAppUnlocked(initialSceneState)) {
      recordSceneStatePatch('commercial-street', commercialStreetMilkTeaAppUnlockPatch())
      onChapterAnalytics?.('milk_tea_app_unlocked')
    }
    onMilkTeaAppOpen?.()
  }, [carriedMilkTea, initialSceneState, onChapterAnalytics, onMilkTeaAppOpen, onMilkTeaOrderReady, recordSceneStatePatch, showMilkTeaEcho])

  const interactStorefront = useCallback((storefrontId: string) => {
    if (readingActive || sceneAction?.phase === 'committing') return
    dismissSceneAction()
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
        sceneTextPresentationPosition(scene, getCurrentPosition(), resolution.text, screenMetrics),
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
      const interaction = resolveMainlineStorefrontInteraction(scene, storefront, currentPosition, layout, navigationOptions)
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
      moveAlong(interaction.path, revealStorefrontInteraction, {
        ...protagonistLocomotionOptions,
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
        canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
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
  }, [beginMilkTeaStorefrontAction, dismissSceneAction, dismissSceneEcho, getCurrentPosition, layout, protagonistLocomotionOptions, moveAlong, navigationOptions, onChapterAnalytics, onInteractionAnalytics, onPhoneDismiss, onStorefrontAction, phoneOpen, presentSceneEcho, protagonistFootprint, readingActive, scene, sceneAction?.phase, screenMetrics, stopMovement])

  const interactNpc = useCallback((npcId: string) => {
    if (readingActive || sceneAction?.phase === 'committing') return
    dismissSceneAction()
    const npc = scene.npcs.find((candidate) => candidate.id === npcId)
    if (!npc || npc.interactive === false) return
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
    const currentPosition = getCurrentPosition()
    const interaction = resolveMainlineNpcInteraction(scene, npc.id, currentPosition, layout, navigationOptions)
    const alreadyNearby = interaction.inRange
    const completeInteraction = () => {
      if (npcInteractionRequestRef.current !== requestId) return
      onNpcInteraction?.(npc.id)
      const resolution = resolveCommercialCafeNpcInteraction({
        sceneId: scene.id,
        npcId: npc.id,
        story: commercialCafeStory,
        playerSeatId: null,
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
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
      onBlocked: () => {
        if (npcInteractionRequestRef.current !== requestId) return
        npcInteractionRequestRef.current += 1
        onInteractionAnalytics?.('blocked', npc.id, 'npc', 'movement-blocked')
      },
    })
  }, [activePlayerSeatId, commercialCafeNarrative, commercialCafeStory, dismissSceneAction, dismissSceneEcho, getCurrentPosition, layout, leavePlayerSeat, protagonistLocomotionOptions, moveAlong, movingNpcIds, navigationOptions, onInteractionAnalytics, onNpcInteraction, onPhoneDismiss, phoneOpen, readingActive, scene, sceneAction?.phase, startCommercialCafeNarrative, startNpcDialogue, stopMovement])

  const chooseSceneEchoOption = useCallback((index: number) => {
    const option = sceneAction?.options[index]
    if (!option) return
    onMeaningfulActivity?.()
    if (sceneAction?.entityId === commercialStreetMilkTeaStorefrontId && option === '喝奶茶') {
      recordSceneStatePatch('commercial-street', commercialStreetMilkTeaConsumePatch())
      dismissSceneAction()
      return
    }
    const entity = sceneAction?.entityId ? scene.objects.find((candidate) => candidate.id === sceneAction.entityId) : undefined
    const resolution = resolveMainlineSceneEchoChoice(scene, entity, option, Date.now(), {
      carriedPhoneDevice,
      commercialCafeCoffeeOrdered: commercialCafeCoffeeOrderedState(commercialCafeStory),
      carriedMilkTea: carriedMilkTea || commercialStreetMilkTeaHeld(initialSceneState),
      plantWaterStateKey: entity?.id === 'zhongshuyuan-office-plant' ? undefined : entity ? `plantWateredAt:${entity.id}` : undefined,
    })
    if (!resolution) return
    if (resolution.deskDevice) {
      onDeskInteraction?.(resolution.deskDevice)
      dismissSceneAction()
      return
    }
    if (resolution.stateChange?.key === commercialCafeCoffeeStatusKey && resolution.stateChange.value === 'ordered') {
      recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeCoffeeOrdered(commercialCafeStory)))
      onChapterAnalytics?.('cafe_coffee_ordered')
    } else if (resolution.stateChange) recordSceneState(scene.id, resolution.stateChange.key, resolution.stateChange.value)
    if (resolution.stateChange?.key === 'blindsOpen') {
      const open = resolution.stateChange.value === true
      setOfficeBlindsOpen(open)
    }
    if (resolution.stateChange?.key === 'incenseLitAt' && typeof resolution.stateChange.value === 'number') {
      setIncenseLitAt(resolution.stateChange.value)
      setIncenseClock(resolution.stateChange.value)
    }
    if (resolution.stateChange?.key === 'plantWateredAt' && typeof resolution.stateChange.value === 'number') {
      setPlantWateredAt(resolution.stateChange.value)
    }
    dismissSceneAction()
  }, [carriedMilkTea, carriedPhoneDevice, commercialCafeStory, dismissSceneAction, initialSceneState, onChapterAnalytics, onDeskInteraction, onMeaningfulActivity, recordSceneState, recordSceneStatePatch, scene, sceneAction])

  const advanceSceneEcho = useCallback(() => {
    const current = sceneEchoRef.current
    if (!current || current.phase === 'leaving') return
    onMeaningfulActivity?.()
    if (current.typing) {
      const next = { ...current, typing: false }
      sceneEchoRef.current = next
      setSceneEcho(next)
      return
    }
    if (current.segmentIndex + 1 < current.segments.length) {
      const next = {
        ...current,
        segmentIndex: current.segmentIndex + 1,
        text: current.segments[current.segmentIndex + 1] ?? current.text,
        typing: true,
      }
      sceneEchoRef.current = next
      setSceneEcho(next)
      return
    }
    if (current.options && current.options.length > 0) {
      pendingSceneActionRef.current = { entityId: current.entityId, options: current.options, position: current.position }
      dismissSceneEcho()
      return
    }
    dismissSceneEcho()
  }, [dismissSceneEcho, onMeaningfulActivity])

  const completeSceneEchoTyping = useCallback((echoId: number) => {
    const current = sceneEchoRef.current
    if (!current || current.id !== echoId || current.phase === 'leaving' || !current.typing) return
    const next = { ...current, typing: false }
    sceneEchoRef.current = next
    setSceneEcho(next)
  }, [])

  const advanceDialogue = useCallback(() => {
    onMeaningfulActivity?.()
    if (commercialStreetQuestionNarrative) {
      setCommercialStreetQuestionNarrative((current) => current ? nextCommercialStreetQuestionNarrative(current) : current)
      return
    }
    if (commercialCafeNarrative) {
      if (commercialCafeNarrative.phase === 'coffee-delivery') return
      if (commercialCafeNarrative.phase === 'delivery-line') {
        const acknowledged = commercialCafeFinishDeliveryLine(commercialCafeStory)
        if (acknowledged.narrativeCursor === commercialCafeStory.narrativeCursor) return
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(acknowledged))
        setDialogueSegmentIndex(0)
        setDialogueLineIndex(acknowledged.narrativeCursor)
        setCommercialCafeNarrative({ phase: 'active' })
        return
      }
      const line = commercialCafeNarrativeDialogue.lines[commercialCafeStory.narrativeCursor]
      if (!line) return
      const segments = splitMainlineInteractionText(line.text)
      if (dialogueSegmentIndex + 1 < segments.length) {
        setDialogueSegmentIndex((current) => current + 1)
        return
      }
      const nextCursor = commercialCafeStory.narrativeCursor + 1
      setDialogueSegmentIndex(0)
      if (commercialCafeStory.narrativeCursor === 1) {
        const nextStory = commercialCafeFinishCursorOne(commercialCafeStory)
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(nextStory))
        setDialogueLineIndex(nextStory.narrativeCursor)
        setCommercialCafeNarrative({
          phase: nextStory.narrativePhase !== 'coffee-delivery'
            ? 'active'
            : nextStory.coffeeStatus === 'delivered' ? 'delivery-line' : 'coffee-delivery',
        })
        return
      }
      if (nextCursor < commercialCafeNarrativeDialogue.lines.length) {
        const nextStory = commercialCafeStoryWithCursor(commercialCafeStory, nextCursor)
        const narrativeStory = { ...nextStory, narrativePhase: 'dialogue' as const }
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(narrativeStory))
        setDialogueLineIndex(nextCursor)
        const stage = commercialCafeAnalyticsStageForCursor(nextCursor)
        if (stage) recordCafeAnalyticsMilestone(stage)
        return
      }
      recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeStoryReadyToLeave(commercialCafeStory)))
      recordCafeAnalyticsMilestone('ready-to-leave')
      onChapterAnalytics?.('cafe_ready_to_leave')
      setCommercialCafeNarrative({ phase: 'leaving' })
      return
    }
    if (dialogueLineIndex === null || !activeDialogue) return
    const segments = splitMainlineInteractionText(activeDialogue.lines[dialogueLineIndex]?.text ?? '')
    if (dialogueSegmentIndex + 1 < segments.length) {
      setDialogueSegmentIndex((current) => current + 1)
      return
    }
    setDialogueSegmentIndex(0)
    if (dialogueLineIndex + 1 < activeDialogue.lines.length) {
      setDialogueLineIndex(dialogueLineIndex + 1)
      return
    }
    setGenericDialoguePhase('leaving')
  }, [activeDialogue, commercialCafeNarrative, commercialCafeStory, commercialStreetQuestionNarrative, dialogueLineIndex, dialogueSegmentIndex, npcDialogue, onChapterAnalytics, onMeaningfulActivity, recordCafeAnalyticsMilestone, recordSceneState, recordSceneStatePatch, scene.id])

  const walk = useCallback((point: Point) => {
    if (readingActive) return
    if (sceneAction?.phase === 'committing') return
    onMeaningfulActivity?.()
    pendingInteractionAfterTraversalRef.current = null
    storefrontRequestIdRef.current += 1
    dismissSceneAction()
    npcInteractionRequestRef.current += 1
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
  }, [debugCafeSpatialQa, dismissSceneAction, dismissSceneEcho, getCurrentPosition, layout, leavePlayerSeat, moveTo, navigationOptions, onMeaningfulActivity, onPhoneDismiss, phoneOpen, readingActive, sceneAction?.phase, sceneDefinition, setDialogueLineIndex, showAccessRegionDeniedText, startPassageTraversal, stopMovement])

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
    }
  }, [commercialCafeNarrative?.phase, commercialStreetQuestionNarrative?.phase, completeCommercialStreetQuestionNarrativeExit, genericDialoguePhase, npcDialogue])

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
  const debugCafeCounterStructure = debugRuntimeEvidence && scene.id === 'commercial-cafe'
    ? scene.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')
    : undefined
  const debugCafeStaffRegion = debugRuntimeEvidence && scene.id === 'commercial-cafe'
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
        npc={npc}
        position={npcPosition}
        snapshot={snapshot}
        screenMetrics={screenMetrics}
        debugRuntimeEvidence={debugRuntimeEvidence}
      />}
    />
  })

  return (
    <>
    <div
      {...sceneInteractionHandlers}
      className={`scene-shell mainline-scene ${embedded ? 'mainline-scene--embedded' : ''} ${!showSceneChrome ? 'mainline-scene--map-only' : ''}`}
      data-mainline-scene={scene.id}
      data-commercial-cafe-status={scene.id === 'commercial-cafe' ? commercialCafeStory.status : undefined}
      data-commercial-cafe-cursor={scene.id === 'commercial-cafe' ? commercialCafeStory.narrativeCursor : undefined}
      data-commercial-cafe-coffee-status={scene.id === 'commercial-cafe' ? commercialCafeStory.coffeeStatus : undefined}
      data-commercial-cafe-narrative-phase={scene.id === 'commercial-cafe' ? commercialCafeNarrative?.phase ?? commercialCafeStory.narrativePhase : undefined}
      data-commercial-cafe-coffee-owner-phase={scene.id === 'commercial-cafe' ? commercialCafeCoffeeBehavior.getPhase() : undefined}
      data-commercial-cafe-floor-server-phase={scene.id === 'commercial-cafe' ? commercialCafeFloorBehavior.getPhase() : undefined}
      data-e2e-world-speed={debugRuntimeEvidence ? locomotionOptions.speedMultiplier() : undefined}
      data-e2e-coffee-owner-speed={debugRuntimeEvidence && scene.id === 'commercial-cafe' ? cafeCoffeeOwnerLocomotionOptions.speedMultiplier() : undefined}
      data-e2e-floor-server-speed={debugRuntimeEvidence && scene.id === 'commercial-cafe' ? locomotionOptions.speedMultiplier() : undefined}
      data-commercial-question-narrative={commercialStreetQuestionNarrative?.phase}
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
      data-e2e-lao-zhou-exit-attempt={debugRuntimeEvidence && scene.id === 'commercial-cafe' ? laoZhouExitAttemptRef.current : undefined}
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
              onStorefrontRevealMotionComplete={storefrontPresentation.completeRevealMotion}
              onStorefrontLingerAnimationComplete={storefrontPresentation.completeLingerAnimation}
              onStorefrontRestoreMotionComplete={storefrontPresentation.completeRestoreMotion}
              gateTriggered={gateTriggered}
              geometrySnapshot={geometrySnapshot}
              freezeFrameMeasurements={presentationSnapshot}
              onScreenMetricsChange={handleScreenMetricsChange}
              cameraOffset={cameraOffset}
              showProtagonist={showProtagonist}
              suppressWorldEnterAnimation={suppressWorldEnterAnimation}
              onLayoutChange={updateLayout}
              onInteract={interact}
              onStorefrontInteract={interactStorefront}
              onNpcInteract={interactNpc}
              npcPositions={resolvedNpcPositions}
              npcRuntimeSnapshots={npcRuntimeSnapshots}
              hiddenNpcIds={hiddenNpcIds}
              ambientNpcActorLayer={ambientNpcActorLayer}
              onDoorTransitionComplete={completeDoorTransition}
              onWalk={walk}
              worldQuestionMark={scene.id === 'commercial-street' && !commercialStreetQuestionNarrativeIsCompleted ? { anchor: commercialStreetQuestionNarrativeAnchor(scene), visible: !commercialStreetQuestionNarrative } : undefined}
              dialogue={activeDialogue}
              dialogueLine={activeDialogueLine}
              dialogueText={activeDialogueText}
              dialogueLineIndex={commercialCafeNarrative ? commercialCafeStory.narrativeCursor : dialogueLineIndex}
              dialogueSegmentIndex={dialogueSegmentIndex}
              dialogueSegmentCount={activeDialogueSegments.length}
              dialoguePosition={activeDialoguePosition}
              dialoguePhase={dialoguePresentationPhase}
              readingMode={readingActive ? (sceneEcho ? 'observation' : 'dialogue') : null}
              onDialogueExitComplete={completeDialogueExit}
              onDialogueAdvance={advanceDialogue}
              sceneEcho={sceneEcho}
              sceneAction={sceneAction}
              onSceneEchoAdvance={advanceSceneEcho}
              onSceneEchoTypingComplete={completeSceneEchoTyping}
              onSceneActionStart={beginSceneActionChoice}
              onSceneActionChoice={chooseSceneEchoOption}
              onSceneEchoExitComplete={completeSceneEchoExit}
              onMilkTeaInteract={() => showMilkTeaEcho('手里的奶茶还没喝完。', ['喝奶茶'])}
              ridePickup={ridePickup}
              carriedMilkTea={carryingMilkTea}
              onFrameMotionProfileChange={handleFrameMotionProfileChange}
              exploredObjectIds={exploredObjectIds}
              interactionTutorialCompleted={interactionTutorialCompleted}
              incenseLit={incenseLit}
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
      </main>
    </div>
    </>
  )
}
