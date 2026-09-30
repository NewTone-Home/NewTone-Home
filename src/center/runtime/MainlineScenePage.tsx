'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Point } from './sceneGeometry'
import { MainlineSceneRenderer, type MainlineInputDiagnostic } from './MainlineSceneRenderer'
import { getMainlineSceneEntity, mainlineEntityDisplayLabel, mainlineSceneAreaLabel, mainlineScenes, mainlineStorefrontInteractionCandidates, type MainlineSceneDefinition, type MainlineSceneEntity, type MainlineSceneExternalExit, type MainlineSceneId, type MainlineScenePassage } from './mainlineScenes'
import { canActorReachPassageApproach, classifyMainlineWorldCommand, findMainlinePath, findMainlinePathThroughPassage, findMainlinePathToEntity, isMainlineEntityWithinInteractionRange, isMainlineNavigationBarrierClear, isMainlinePassageInTransitZone, isWalkableMainlinePoint, mainlineInteractionTarget, mainlinePassageCollisionForNavigation, mainlinePassageCrossesToSide, mainlinePassageDoorRegion, mainlinePassageDoorwayForNavigation, mainlinePassageExitPoint, mainlinePassageSide, resolveMainlineEntityInteraction, resolveMainlineInteractionCandidates, resolveMainlineNpcInteraction, resolveMainlineNpcPosition, resolveMainlineSafeEntryPosition, resolveMainlineSafeSpawnPosition, resolveMainlineSeatSitPosition, resolveMainlineWorldNavigation } from './mainlineNavigation'
import { layoutGridSize, mainlineLabelFootprint, mainlineProtagonistDotFootprint, type SceneLayout } from './sceneLayout'
import { clearSceneLayout, loadSceneLayout, persistSceneLayout } from './sceneLayoutPersistence'
import { movementDurationMsForPath, sharedCharacterMovementOptions, useFreeRoamMovement, type FreeRoamMovement } from './useFreeRoamMovement'
import type { PhoneDevice } from './phoneState'
import { sceneInteractionHandlers } from './sceneInteraction'
import { useAutomaticPassages } from './useAutomaticPassages'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineCameraOffset } from './mainlineViewport'
import { sceneDoorMotion } from './sceneDoorConfig'
import { sceneFrameGroupsDueForExit, type SceneFocusFrameMotionProfile } from './sceneFrameExitSchedule'
import type { PlayerChoiceValue, PlayerSceneState } from './playerSave'
import { commercialCafeAnalyticsStageForCursor, commercialCafeCoffeeDeliveredKey, commercialCafeCoffeeOrderedKey, commercialCafeDepartureText, commercialCafeLaoZhouConversationSeatId, commercialCafeLaoZhouIsPresent, commercialCafeNarrativeDialogue, commercialCafeStoryCompleted, commercialCafeStoryNeedsMigration, commercialCafeStoryReadyToLeave, commercialCafeStoryStateFromSceneState, commercialCafeStoryStatePatch, commercialCafeStoryWithCursor, commercialCafeVisibleAttachedPropIds, isCommercialCafeStoryStage, resolveCommercialCafeNpcInteraction, shouldCompleteCommercialCafeStoryOnTransition, type CommercialCafeNpcInteractionResolution, type CommercialCafeStoryStage } from './commercialCafeStory'
import { createCommercialCafeServerBehaviorCoordinator } from './commercialCafeBehavior'
import { createMainlineSceneGeometrySnapshot, type MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { createNavigationRuntime } from './navigationCore'
import { useNpcMovement } from './useNpcMovement'
import { AmbientNpcMotion } from './AmbientNpcMotion'
import type { NpcRuntimeSnapshot } from './npcCore'
import { useStorefrontPresentation } from './useStorefrontPresentation'
import { splitMainlineInteractionText } from './mainlineTextSegments'
import { mainlineEchoLayout } from './mainlineEchoLayout'
import { sceneTextPresentationPosition } from './sceneTextPresentation'
import { incenseBurnPhase, incenseBurnRemainingMs, resolveMainlineSceneEchoChoice, resolveMainlineSceneExploration, type IncenseBurnPhase } from './mainlineSceneInteractions'
import { nextMainlinePlayerSeatId, mainlineSceneOccupiedSeatIds } from './mainlineSeating'
import { commercialCafeServerMovementDebugTarget } from './mainlineSceneModel'
import { mainlineExploredObjectIdsFromSceneState, mainlineInteractionCompletesImmediately, mainlineInteractionExploredStateKey } from './mainlineInteractionVisualState'
import { localSlideDirectionForCrossing, shouldUseLocalSlideForPassage, type MainlineWalkingPassageTransitionIntent } from './mainlineSceneTransition'
import { createCommercialStreetStorefrontExecutionRuntime, createCommercialStreetStorefrontInteractionRuntime, commercialStreetStorefrontInteractionFor, executeCommercialStreetStorefrontInteraction, type CommercialStreetStorefrontAction } from './commercialStreetStorefrontInteractions'
import { commercialStreetQuestionNarrativeAnchor, commercialStreetQuestionNarrativeCompleted, commercialStreetQuestionNarrativeCompletedKey, commercialStreetQuestionNarrativeLines, commercialStreetQuestionNarrativeShouldTrigger, nextCommercialStreetQuestionNarrative, type CommercialStreetQuestionNarrativeState } from './commercialStreetQuestionNarrative'
import { commercialStreetMilkTeaAppUnlockPatch, commercialStreetMilkTeaAppUnlocked, commercialStreetMilkTeaHeld, commercialStreetMilkTeaIsReady, commercialStreetMilkTeaOrderFromSceneState, commercialStreetMilkTeaPickupPatch, commercialStreetMilkTeaStorefrontId, formatCommercialStreetMilkTeaOrderNumber } from './commercialStreetMilkTea'

const emptyExternalStoreSubscribe = () => () => undefined
const emptyLayoutSnapshot: SceneLayout = {}
const emptyExplorationObjectIds: ReadonlySet<string> = new Set()
// Non-Café scenes still render this page. Keep their inactive story reference
// stable so transient save writes (for example a ride arrival position) do not
// repeatedly recreate the NPC registration and presentation dependencies.
const inactiveCommercialCafeStory = commercialCafeStoryStateFromSceneState(undefined)
type NpcDialogueResolution = Extract<CommercialCafeNpcInteractionResolution, { kind: 'dialogue' }>
type CommercialCafeNarrativeRuntime = { phase: 'active' | 'leaving' }
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
  onSceneReady,
  walkRequest,
  phoneOpen = false,
  onPhoneDismiss,
  onDeskInteraction,
  onObjectInteraction,
  onStorefrontAction,
  onMilkTeaAppOpen,
  onChapterAnalytics,
  onNpcInteraction,
  onDoorEvent,
  initialSceneState = {},
  interactionTutorialCompleted = false,
  onPlayerSceneStateChange,
  onPlayerSceneStatePatch,
  carriedMilkTea = false,
  carriedPhoneDevice = 'surface',
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
  onSceneReady?: () => void
  walkRequest?: { id: number; point: Point } | null
  phoneOpen?: boolean
  onPhoneDismiss?: () => void
  onDeskInteraction?: (device: PhoneDevice) => void
  onObjectInteraction?: (entity: MainlineSceneEntity, dwellMs: number) => void
  /** Reserved entry point for future storefront actions such as milk-tea ordering. */
  onStorefrontAction?: (action: CommercialStreetStorefrontAction, storefrontId: string) => void
  onMilkTeaAppOpen?: () => void
  onChapterAnalytics?: (eventName: string, eventData?: Record<string, string | number>) => void
  onNpcInteraction?: (npcId: string) => void
  onDoorEvent?: (phase: 'attempted' | 'blocked' | 'crossed', passage: MainlineScenePassage) => void
  initialSceneState?: PlayerSceneState
  interactionTutorialCompleted?: boolean
  onPlayerSceneStateChange?: (sceneId: MainlineSceneId, key: string, value: PlayerChoiceValue) => void
  onPlayerSceneStatePatch?: (sceneId: MainlineSceneId, patch: PlayerSceneState) => void
  carriedMilkTea?: boolean
  carriedPhoneDevice?: PhoneDevice
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
  const npcInteractionRequestRef = useRef(0)
  const navigationRuntimeRef = useRef(createNavigationRuntime())
  const navigationRuntime = navigationRuntimeRef.current
  const commercialCafeBehaviorRef = useRef(createCommercialCafeServerBehaviorCoordinator())
  const commercialCafeBehavior = commercialCafeBehaviorRef.current
  const debugCafeFixtureAppliedRef = useRef(false)
  const debugCafePlayerPositionAppliedRef = useRef(false)
  const handledWalkRequestRef = useRef<number | null>(null)
  // Scene feedback is intentionally no longer a presentation channel. Calls
  // remain semantic no-ops while navigation and interaction outcomes retain
  // their own state transitions.
  const feedback = null
  const setFeedback = useCallback((_message: string | null) => undefined, [])
  const [ambientNpcRuntime, setAmbientNpcRuntime] = useState<ReadonlyMap<string, { position: Point | null; snapshot: NpcRuntimeSnapshot }>>(new Map())
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
  const debugCafeServerBackDoor = import.meta.env.DEV && new URLSearchParams(debugInputSearch).get('debugCafeServerBackDoor') === '1'
  const debugCafePlayerPosition = import.meta.env.DEV ? debugCafePoint(new URLSearchParams(debugInputSearch).get('debugCafePlayerPosition')) : null
  const [debugCafeStoryStage, setDebugCafeStoryStage] = useState<CommercialCafeStoryStage | null>(() => (
    import.meta.env.DEV && isCommercialCafeStoryStage(debugCafeStageValue) ? debugCafeStageValue : null
  ))
  const debugCafeStoryInterruptAppliedRef = useRef(false)
  const debugCafeStoryInterruptFromDutyRef = useRef<string | null>(null)
  const debugCafeServerBlockerTargetRef = useRef<Point | null>(null)
  const debugCafeServerBackDoorAppliedRef = useRef(false)
  const [debugCafeServerBackDoorReady, setDebugCafeServerBackDoorReady] = useState(false)
  const [debugCafeServerBackDoorStatus, setDebugCafeServerBackDoorStatus] = useState<'idle' | 'approach-unreachable' | 'moving' | 'blocked' | 'lifecycle-requested'>('idle')
  const debugCafeServerBlockerId = 'e2e-commercial-cafe-server-blocker'
  const [dialogueLineIndex, setDialogueLineIndex] = useState<number | null>(null)
  const [dialogueSegmentIndex, setDialogueSegmentIndex] = useState(0)
  const [npcDialogue, setNpcDialogue] = useState<NpcDialogueResolution | null>(null)
  const [commercialCafeNarrative, setCommercialCafeNarrative] = useState<CommercialCafeNarrativeRuntime | null>(null)
  const [playerSeatId, setPlayerSeatId] = useState<string | null>(null)
  // The isolated browser fixture mirrors the real conversation-seat state in
  // memory only. It never writes the user's save and is unavailable in production.
  const activePlayerSeatId = debugCafeFixture ? commercialCafeLaoZhouConversationSeatId : playerSeatId
  const [promptedSeatId, setPromptedSeatId] = useState<string | null>(null)
  const [sceneEcho, setSceneEcho] = useState<MainlineSceneEcho | null>(null)
  const sceneEchoRef = useRef<MainlineSceneEcho | null>(null)
  const pendingSceneEchoRef = useRef<MainlineSceneEcho | null>(null)
  const [commercialStreetQuestionNarrative, setCommercialStreetQuestionNarrative] = useState<CommercialStreetQuestionNarrativeState | null>(null)
  const [commercialStreetQuestionNarrativeCompletedLocally, setCommercialStreetQuestionNarrativeCompletedLocally] = useState(() => commercialStreetQuestionNarrativeCompleted(initialSceneState[commercialStreetQuestionNarrativeCompletedKey]))
  const commercialStreetQuestionNarrativeActiveRef = useRef(false)
  const sceneTextSlowdownActiveRef = useRef(false)
  const [officeBlindsOpen, setOfficeBlindsOpen] = useState(initialSceneState.blindsOpen !== false)
  const [incenseLitAt, setIncenseLitAt] = useState<number | null>(() => typeof initialSceneState.incenseLitAt === 'number' ? initialSceneState.incenseLitAt : null)
  const [incenseClock, setIncenseClock] = useState(() => Date.now())
  const sceneEchoIdRef = useRef(0)
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
  const carryingMilkTea = carriedMilkTea || commercialStreetMilkTeaHeld(initialSceneState)
  const commercialCafeNarrativeActive = Boolean(commercialCafeNarrative)
  const visibleCommercialCafeAttachedPropIds = useMemo(() => commercialCafeVisibleAttachedPropIds({
    story: commercialCafeStory,
    carriedMilkTea: carryingMilkTea,
    meetingActive: commercialCafeNarrativeActive || activePlayerSeatId === commercialCafeLaoZhouConversationSeatId,
  }), [activePlayerSeatId, carryingMilkTea, commercialCafeNarrativeActive, commercialCafeStory])
  const commercialStreetQuestionNarrativeIsCompleted = commercialStreetQuestionNarrativeCompletedLocally || commercialStreetQuestionNarrativeCompleted(initialSceneState[commercialStreetQuestionNarrativeCompletedKey])
  commercialStreetQuestionNarrativeActiveRef.current = Boolean(commercialStreetQuestionNarrative)
  sceneTextSlowdownActiveRef.current = Boolean(sceneEcho || pendingSceneEchoRef.current || commercialStreetQuestionNarrative || commercialCafeNarrative)
  const recordSceneState = useCallback((targetSceneId: MainlineSceneId, key: string, value: PlayerChoiceValue) => {
    onPlayerSceneStateChange?.(targetSceneId, key, value)
  }, [onPlayerSceneStateChange])
  const recordSceneStatePatch = useCallback((targetSceneId: MainlineSceneId, patch: PlayerSceneState) => {
    onPlayerSceneStatePatch?.(targetSceneId, patch)
  }, [onPlayerSceneStatePatch])
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
    // the feedback-only interaction settles into its persistent soft state.
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
    const next = current.phase === 'leaving'
      ? current
      : { ...current, phase: 'leaving' as const, options: undefined }
    sceneEchoRef.current = next
    setSceneEcho(next)
  }, [])
  useEffect(() => {
    if (!phoneOpen) return
    if (commercialCafeNarrative || commercialStreetQuestionNarrative) {
      onPhoneDismiss?.()
      return
    }
    dismissSceneEcho()
  }, [commercialCafeNarrative, commercialStreetQuestionNarrative, dismissSceneEcho, onPhoneDismiss, phoneOpen])
  const presentSceneEcho = useCallback((next: MainlineSceneEcho) => {
    const current = sceneEchoRef.current
    if (!current) {
      sceneEchoRef.current = next
      setSceneEcho(next)
      return
    }
    pendingSceneEchoRef.current = next
    if (current.phase === 'leaving') return
    const leaving = { ...current, phase: 'leaving' as const, options: undefined }
    sceneEchoRef.current = leaving
    setSceneEcho(leaving)
  }, [])
  const completeSceneEchoExit = useCallback((echoId: number) => {
    const current = sceneEchoRef.current
    if (!current || current.id !== echoId || current.phase !== 'leaving') return
    const pending = pendingSceneEchoRef.current
    pendingSceneEchoRef.current = null
    sceneEchoRef.current = pending
    setSceneEcho(pending)
    setActiveObjectId(null)
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
  const cafeNarrativeLine = commercialCafeNarrative
    ? commercialCafeNarrativeDialogue.lines[commercialCafeStory.narrativeCursor] ?? null
    : null
  const activeDialogue = questionDialogueLine
    ? { triggerEntityId: 'commercial-street-question', lines: commercialStreetQuestionNarrativeLines.map((text, index) => ({ id: `commercial-street-question-${index}`, speaker: '修杰' as const, text })) }
    : commercialCafeNarrative ? commercialCafeNarrativeDialogue
      : npcDialogue?.dialogue ?? scene.dialogue
  const activeDialogueLine = questionDialogueLine ?? cafeNarrativeLine ?? (activeDialogue && dialogueLineIndex !== null
    ? activeDialogue.lines[dialogueLineIndex] ?? null
    : null)
  const activeDialogueSegments = activeDialogueLine
    ? questionDialogueLine ? [activeDialogueLine.text] : splitMainlineInteractionText(activeDialogueLine.text)
    : []
  const activeDialogueText = activeDialogueSegments[dialogueSegmentIndex] ?? activeDialogueSegments[0] ?? ''
  const internalMovement = useFreeRoamMovement(initialPosition)
  const { position, moving, moveAlong: rawMoveAlong, stopMovement, resetMovement, getCurrentPosition, getRemainingDurationMs } = movementController ?? internalMovement
  useEffect(() => {
    const current = sceneEchoRef.current
    if (!current || current.phase === 'leaving' || scene.presentation.mode !== 'actor-relative' || !scene.presentation.readingRail) return
    const readableSpan = scene.presentation.readingRail.maxX - scene.presentation.readingRail.minX
    if (Math.abs(position.x - current.position.x) > readableSpan * .7) dismissSceneEcho()
  }, [dismissSceneEcho, position.x, scene.presentation])
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
  const geometrySnapshot = useMemo(() => createMainlineSceneGeometrySnapshot(scene, position, layout, screenMetrics, storefrontPresentation.phaseByStorefront), [layout, position, scene, screenMetrics, storefrontPresentation.phaseByStorefront])
  const stagedNpcPositions = useMemo(() => new Map(scene.npcs.map((npc) => [
    npc.id,
    resolveMainlineNpcPosition(scene, npc.id, layout, { geometrySnapshot, screenMetrics }),
  ])), [geometrySnapshot, layout, scene, screenMetrics])
  const serverInitialPosition = stagedNpcPositions.get('server') ?? scene.initialPlayerPosition
  const serverFootprint = useMemo(() => {
    const box = mainlineLabelFootprint('店员', serverInitialPosition, screenMetrics, { lineHeight: 1 })
    return { width: box.width, height: box.height }
  }, [screenMetrics, serverInitialPosition])
  const serverMovement = useNpcMovement({
    enabled: scene.id === 'commercial-cafe' && scene.npcs.some((npc) => npc.id === 'server'),
    npcId: 'server',
    initialPosition: serverInitialPosition,
    navigationRuntime,
    footprint: serverFootprint,
  })
  const ambientNpcFootprints = useMemo(() => new Map(scene.ambientNpcRoutes.map((schedule) => {
    const npc = scene.npcs.find((candidate) => candidate.id === schedule.npcId)
    const position = stagedNpcPositions.get(schedule.npcId) ?? scene.initialPlayerPosition
    const box = mainlineLabelFootprint(npc?.label ?? '', position, screenMetrics, { lineHeight: 1 })
    return [schedule.npcId, { width: box.width, height: box.height }] as const
  })), [scene, screenMetrics, stagedNpcPositions])
  const handleAmbientNpcRuntimeChange = useCallback((npcId: string, npcPosition: Point | null, snapshot: NpcRuntimeSnapshot) => {
    setAmbientNpcRuntime((current) => {
      const existing = current.get(npcId)
      if (existing
        && existing.position?.x === npcPosition?.x
        && existing.position?.y === npcPosition?.y
        && existing.snapshot.phase === snapshot.phase
        && existing.snapshot.dutyId === snapshot.dutyId
        && existing.snapshot.targetId === snapshot.targetId) return current
      return new Map(current).set(npcId, { position: npcPosition, snapshot })
    })
  }, [])
  const npcRuntimePositions = useMemo(() => {
    const positions = new Map<string, Point>()
    if (serverMovement.position) positions.set('server', serverMovement.position)
    ambientNpcRuntime.forEach(({ position }, npcId) => {
      if (position) positions.set(npcId, position)
    })
    return positions
  }, [ambientNpcRuntime, serverMovement.position])
  const hiddenAmbientNpcIds = useMemo(() => new Set([...ambientNpcRuntime]
    .filter(([, runtime]) => runtime.position === null)
    .map(([npcId]) => npcId)), [ambientNpcRuntime])
  const hiddenNpcIds = useMemo(() => {
    const hidden = new Set(hiddenAmbientNpcIds)
    if (scene.id === 'commercial-cafe' && !commercialCafeLaoZhouIsPresent(commercialCafeStory, Date.now())) hidden.add('lao-zhou')
    return hidden
  }, [commercialCafeStory, hiddenAmbientNpcIds, scene.id])
  const npcRuntimeSnapshots = useMemo(() => {
    const snapshots = new Map<string, NpcRuntimeSnapshot>([['server', serverMovement.snapshot]])
    ambientNpcRuntime.forEach(({ snapshot }, npcId) => snapshots.set(npcId, snapshot))
    return snapshots
  }, [ambientNpcRuntime, serverMovement.snapshot])
  const resolvedNpcPositions = useMemo(() => new Map(scene.npcs.map((npc) => [
    npc.id,
    resolveMainlineNpcPosition(scene, npc.id, layout, { geometrySnapshot, screenMetrics, npcRuntimePositions }),
  ])), [geometrySnapshot, layout, npcRuntimePositions, scene, screenMetrics])
  const registeredNpcPositions = useMemo(() => new Map([...resolvedNpcPositions]
    .filter(([npcId]) => npcId !== 'lao-zhou' || scene.id !== 'commercial-cafe' || commercialCafeLaoZhouIsPresent(commercialCafeStory, Date.now()))), [commercialCafeStory, resolvedNpcPositions, scene.id])
  // Moving actors own their NavigationRuntime registration through their
  // movement adapters. Re-registering them here on every projected position
  // update would briefly remove their live occupancy during the parent effect
  // cleanup, defeating ambient proximity-yield latching.
  const runtimeManagedNpcIds = useMemo(() => new Set([
    ...scene.ambientNpcRoutes.map((schedule) => schedule.npcId),
    ...(scene.id === 'commercial-cafe' && scene.npcs.some((npc) => npc.id === 'server') ? ['server'] : []),
  ]), [scene.ambientNpcRoutes, scene.id, scene.npcs])
  const staticNpcPositions = useMemo(() => new Map([...registeredNpcPositions]
    .filter(([npcId]) => !runtimeManagedNpcIds.has(npcId))), [registeredNpcPositions, runtimeManagedNpcIds])
  const movingNpcIds = useMemo(() => new Set([...npcRuntimeSnapshots]
    .filter(([, snapshot]) => snapshot.phase === 'moving')
    .map(([npcId]) => npcId)), [npcRuntimeSnapshots])
  const occupiedSeatIds = useMemo(() => mainlineSceneOccupiedSeatIds(scene, activePlayerSeatId), [activePlayerSeatId, scene])
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
    setCommercialCafeNarrative(null)
    setPlayerSeatId(null)
    setPromptedSeatId(null)
    setSceneEcho(null)
    setCommercialStreetQuestionNarrative(null)
    setCommercialStreetQuestionNarrativeCompletedLocally(commercialStreetQuestionNarrativeCompleted(initialSceneState[commercialStreetQuestionNarrativeCompletedKey]))
    setOfficeBlindsOpen(initialSceneState.blindsOpen !== false)
    setIncenseLitAt(typeof initialSceneState.incenseLitAt === 'number' ? initialSceneState.incenseLitAt : null)
    setIncenseClock(Date.now())
    stopMovement()
    setFeedback(null)
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
    if (commercialStreetQuestionNarrative || commercialStreetQuestionNarrativeIsCompleted) return
    if (!commercialStreetQuestionNarrativeShouldTrigger(scene, position)) return
    stopMovement()
    setRequestedWorldTarget(null)
    setCommercialStreetQuestionNarrative({ phase: 'active', segmentIndex: 0 })
    onChapterAnalytics?.('commercial_question_triggered')
  }, [commercialStreetQuestionNarrative, commercialStreetQuestionNarrativeIsCompleted, onChapterAnalytics, position, scene, stopMovement])
  const activeDialoguePosition = activeDialogueLine
    ? sceneTextPresentationPosition(scene, position, activeDialogueText, screenMetrics)
    : null
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
    setFeedback('修杰停在门前。')
  }, [getCurrentPosition, presentSceneEcho, scene, screenMetrics])
  const showAccessRegionDeniedText = useCallback((text: string) => {
    sceneEchoIdRef.current += 1
    presentSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      undefined,
      text,
      sceneTextPresentationPosition(scene, getCurrentPosition(), text, screenMetrics),
    ))
    setFeedback('修杰停在员工区域外。')
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
      else setFeedback('当前没有权限通过这扇门。')
    },
  })
  const navigationOptions = useMemo(() => ({ openPassageIds: getOpenPassageIds(), screenMetrics, geometrySnapshot, navigationRuntime, actorId: 'protagonist', actorFootprint: protagonistFootprint, npcRuntimePositions, occupiedSeatIds }), [geometrySnapshot, getOpenPassageIds, navigationRuntime, npcRuntimePositions, occupiedSeatIds, protagonistFootprint, screenMetrics])
  const locomotionOptions = useMemo(() => ({
    ...sharedCharacterMovementOptions(screenMetrics),
    speedMultiplier: () => sceneTextSlowdownActiveRef.current ? .45 : 1,
  }), [screenMetrics])
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
    const coffeeParentId = scene.attachedProps.find((prop) => prop.id === 'commercial-cafe-coffee')?.parentEntityId
    const coffeeTable = coffeeParentId ? geometrySnapshot.objects.get(coffeeParentId) : undefined
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
        serverInitialPosition,
        layout,
        { ...navigationOptions, actorId: 'server', navigationRuntime: undefined },
      ).target
    if (!allContacts) debugCafeServerBlockerTargetRef.current = target
    navigationRuntime.registerActor(debugCafeServerBlockerId, target, {
      width: (allContacts ? 15 : .8) * 2,
      height: (allContacts ? 15 : .8) * 2,
    })
    return () => navigationRuntime.removeActor(debugCafeServerBlockerId)
  }, [debugCafeServerBlocker, debugCafeServerBlockerId, debugCafeServerBlockerMode, geometrySnapshot, layout, navigationOptions, navigationRuntime, scene, serverInitialPosition])
  useEffect(() => {
    if (!debugCafeStoryInterrupt || debugCafeStoryInterruptAppliedRef.current || scene.id !== 'commercial-cafe') return
    const waitsForPublicService = debugCafeStoryInterruptMode === 'public'
    if (commercialCafeStory.status !== 'available' || serverMovement.snapshot.phase !== 'moving') return
    if (waitsForPublicService && serverMovement.snapshot.dutyId !== 'server.table-service') return
    debugCafeStoryInterruptAppliedRef.current = true
    debugCafeStoryInterruptFromDutyRef.current = serverMovement.snapshot.dutyId
    setDebugCafeStoryStage('met-lao-zhou')
  }, [commercialCafeStory.status, debugCafeStoryInterrupt, debugCafeStoryInterruptMode, scene.id, serverMovement.snapshot.dutyId, serverMovement.snapshot.phase])
  useEffect(() => {
    if (debugCafeServerBackDoor && scene.id === 'commercial-cafe') setDebugCafeServerBackDoorReady(true)
  }, [debugCafeServerBackDoor, scene.id])
  useEffect(() => {
    if (!debugCafeServerBackDoor || !debugCafeServerBackDoorReady || debugCafeServerBackDoorAppliedRef.current || scene.id !== 'commercial-cafe' || !serverMovement.position) return
    const passage = lifecycleMainlinePassages.find((candidate) => candidate.id === 'cafe-back-door')
    if (!passage) return
    const approach = canActorReachPassageApproach(scene, passage, serverMovement.position, layout, {
      ...navigationOptions,
      actorId: 'server',
      actorFootprint: serverFootprint,
      navigationRuntime,
    })
    if (!approach) {
      setDebugCafeServerBackDoorStatus('approach-unreachable')
      setFeedback('店员当前无法走到后门前。')
      return
    }
    debugCafeServerBackDoorAppliedRef.current = true
    setDebugCafeServerBackDoorStatus('moving')
    const started = serverMovement.requestMove({
      dutyId: 'server.e2e-back-door-approach',
      targetId: passage.entityId,
      target: approach.target,
    }, scene, layout, navigationOptions, {
      ...locomotionOptions,
      onBlocked: () => setDebugCafeServerBackDoorStatus('blocked'),
    }, (position) => {
      setDebugCafeServerBackDoorStatus('lifecycle-requested')
      requestPassageLifecycle('server', passage.id, position, approach.target)
    })
    if (!started) setFeedback('店员当前无法规划到后门前的路线。')
  }, [debugCafeServerBackDoor, debugCafeServerBackDoorReady, layout, lifecycleMainlinePassages, locomotionOptions, navigationOptions, navigationRuntime, requestPassageLifecycle, scene, serverMovement])
  useEffect(() => {
    if (scene.id !== 'commercial-cafe' || debugCafeServerBackDoor) {
      commercialCafeBehavior.reset()
      return
    }
    if (!serverMovement.position) return
    const intent = commercialCafeBehavior.requestForCoffee({
      scene,
      coffeeOrdered: commercialCafeStory.coffeeOrdered,
      coffeeDelivered: commercialCafeStory.coffeeDelivered,
      from: serverMovement.position,
      snapshot: serverMovement.snapshot,
      layout,
      navigationOptions,
    })
    if (!intent) return
    const started = serverMovement.requestMove(intent, scene, layout, navigationOptions, locomotionOptions, () => {
      if (intent.dutyId === 'server.deliver-coffee') {
        recordSceneState(scene.id, commercialCafeCoffeeDeliveredKey, true)
      }
      commercialCafeBehavior.arrived()
    })
    if (!started) commercialCafeBehavior.block()
  }, [commercialCafeBehavior, commercialCafeStory.coffeeDelivered, commercialCafeStory.coffeeOrdered, debugCafeServerBackDoor, layout, locomotionOptions, navigationOptions, recordSceneState, scene, serverMovement])
  const runDebugServerMovement = useCallback(() => {
    if (scene.id !== 'commercial-cafe' || !serverMovement.position || serverMovement.snapshot.phase === 'moving') return
    setFeedback('店员开发移动演示中。')

    const returnHome = () => {
      serverMovement.requestMove({
        dutyId: 'server.debug-return',
        targetId: 'commercial-cafe-server-home',
        target: serverInitialPosition,
      }, scene, layout, navigationOptions, locomotionOptions)
    }
    const started = serverMovement.requestMove({
      dutyId: 'server.debug-movement',
      targetId: commercialCafeServerMovementDebugTarget.id,
      target: commercialCafeServerMovementDebugTarget.position,
    }, scene, layout, navigationOptions, locomotionOptions, returnHome)
    if (!started) setFeedback('店员的开发移动演示当前无法规划路线。')
  }, [layout, locomotionOptions, navigationOptions, scene, serverInitialPosition, serverMovement])
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

  const beginPassageLeg = useCallback((passage: MainlineScenePassage, requestedTarget: Point, plannedApproachPath: Point[] | null | undefined, continuationPath: Point[] | null | undefined, passageQueue: readonly MainlineScenePassage[], passageIndex: number) => {
    pendingTraversalRef.current = null
    setSceneFrameExit({ phase: 'idle' })
    cancelPassageLifecycle('protagonist')
    const traversalStart = getCurrentPosition()
    const resolvedPath = plannedApproachPath !== undefined
      ? plannedApproachPath
      : canActorReachPassageApproach(scene, passage, traversalStart, layout, navigationOptions)?.path ?? null
    if (!resolvedPath) {
      stopMovement()
      setFeedback('门前的路暂时走不过去。')
      return
    }
    const entity = getMainlineSceneEntity(scene, passage.entityId)
    setPassageDestination(requestedTarget)
    setActiveObjectId(passage.entityId)
    setFeedback(`修杰走向${mainlineEntityDisplayLabel(entity)}外侧。`)
    const approachMovementOptions = {
      ...locomotionOptions,
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
      if (pending.requestIssued || remainingMovementMs > sceneDoorMotion.openingMs + sceneDoorMotion.openingLeadMs) return
      pending.requestIssued = requestPassageLifecycle('protagonist', passage.id, point, requestedTarget)
      if (!pending.requestIssued) {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setSceneFrameExit({ phase: 'idle' })
        setFeedback(`${mainlineEntityDisplayLabel(entity)}暂时无法通行。`)
        return
      }
      armPassageFrameExit(passage, remainingMovementMs)
    }
    moveAlong(resolvedPath, () => {
      const pending = pendingTraversalRef.current
      if (!pending || pending.passage.id !== passage.id) return
      pending.approachArrived = true
      if (!pending.requestIssued && !requestPassageLifecycle('protagonist', passage.id, getCurrentPosition(), requestedTarget)) {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setRequestedWorldTarget(null)
        setSceneFrameExit({ phase: 'idle' })
        setFeedback(`${mainlineEntityDisplayLabel(entity)}暂时无法通行。`)
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
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setSceneFrameExit({ phase: 'idle' })
        onDoorEvent?.('blocked', passage)
        if (passage.access === 'locked') {
          showLockedPassageText(passage)
          return
        }
        setFeedback('修杰在门前停下了，需要重新选择位置。')
      },
    })
  }, [armPassageFrameExit, cancelPassageLifecycle, getCurrentPosition, getOpenPassageIds, getPassagePhase, getRemainingDurationMs, layout, lifecycleMainlinePassages, locomotionOptions, moveAlong, navigationOptions, onDoorEvent, requestPassageLifecycle, scene, screenMetrics, setFeedback, showLockedPassageText, stopMovement])

  const continuePendingTraversal = useCallback((entityId: string) => {
    const pending = pendingTraversalRef.current
    if (!pending || pending.passage.entityId !== entityId) return
    if (!pending.approachArrived) return
    if (!isPassageActorActive('protagonist', pending.passage.id)) return
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
          onChapterAnalytics?.('cafe_story_stage_reached', { stage: 'complete' })
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
          setFeedback('门已经打开，但对面没有安全落脚的位置。')
          return
        }
        setFeedback(completesCommercialCafeStory ? commercialCafeDepartureText : pending.passage.transitionText)
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
        if (!sceneTransitioned) setFeedback('修杰在门洞中停下了，需要重新选择位置。')
      }, {
        ...locomotionOptions,
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
              setFeedback('门洞里的路线被挡住了，需要重新选择位置。')
              return
            }
            setPassageDestination(null)
            setFeedback('修杰在门洞前停下了，需要重新选择位置。')
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
          setFeedback('下一道门前的路线暂时走不过去。')
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
        setFeedback('门已经打开，但对面的路暂时走不过去。')
        return
      }
      pendingTraversalRef.current = null
      moveAlong(continuation.path, () => {
        setPassageDestination(null)
        setActiveObjectId(null)
        setFeedback('修杰停在这里。')
      }, {
        ...locomotionOptions,
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, openNavigationOptions),
        canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
        onBlocked: () => {
          setPassageDestination(null)
          setActiveObjectId(null)
          setFeedback('门已经打开，但通路被挡住了。')
        },
      })
    }
    const collision = mainlinePassageCollisionForNavigation(scene, pending.passage, openNavigationOptions)
    const doorway = mainlinePassageDoorwayForNavigation(scene, pending.passage, openNavigationOptions)
    const exitPoint = mainlinePassageExitPoint(pending.passage, traversalStart, protagonistFootprint, collision, doorway)
    moveAlong([traversalStart, exitPoint], completeSameSceneLeg, {
      ...locomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, openNavigationOptions)
        || isMainlinePassageInTransitZone(pending.passage, point, protagonistFootprint, doorway),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
      onBlocked: () => {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setActiveObjectId(null)
        setFeedback('门已经打开，但通路被挡住了。')
      },
    })
  }, [beginPassageLeg, commercialCafeStory, getCurrentPosition, getOpenPassageIds, isPassageActorActive, layout, locomotionOptions, moveAlong, navigationOptions, notifySceneTransition, onDoorEvent, protagonistFootprint, recordSceneStatePatch, scene, setFeedback])

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

  const moveTo = useCallback((target: Point, onArrive?: () => void, plannedPath?: Point[] | null, framePassage?: MainlineScenePassage) => {
    npcInteractionRequestRef.current += 1
    pendingTraversalRef.current = null
    setSceneFrameExit({ phase: 'idle' })
    cancelPassageLifecycle('protagonist')
    setPassageDestination(null)
    const path = plannedPath ?? findMainlinePath(getCurrentPosition(), target, scene, layout, navigationOptions)
    if (!path) {
      stopMovement()
      setFeedback('这条路被墙、桌面或柜台挡住了。')
      return false
    }
    const movementOptions = {
      ...locomotionOptions,
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
        setFeedback('修杰在边界前停下了，需要重新选择位置。')
      },
    })
    return true
  }, [armPassageFrameExit, cancelPassageLifecycle, getCurrentPosition, getRemainingDurationMs, layout, locomotionOptions, moveAlong, navigationOptions, scene, setFeedback, stopMovement])

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
    setDialogueSegmentIndex(0)
    setNpcDialogue(resolution)
    setDialogueLineIndex(0)
    if (resolution.promptSeatId) setPromptedSeatId(resolution.promptSeatId)
  }, [])
  const startCommercialCafeNarrative = useCallback(() => {
    if (scene.id !== 'commercial-cafe' || commercialCafeStory.status !== 'available') return
    setNpcDialogue(null)
    setDialogueSegmentIndex(0)
    setDialogueLineIndex(commercialCafeStory.narrativeCursor)
    setCommercialCafeNarrative({ phase: 'active' })
    const stage = commercialCafeAnalyticsStageForCursor(commercialCafeStory.narrativeCursor)
    if (stage) onChapterAnalytics?.('cafe_story_stage_reached', { stage })
  }, [commercialCafeStory.narrativeCursor, commercialCafeStory.status, onChapterAnalytics, scene.id])

  const startPassageTraversal = useCallback((passage: MainlineScenePassage, requestedTarget: Point, plannedApproachPath?: Point[] | null, continuationPath?: Point[] | null, passageQueue: readonly MainlineScenePassage[] = [passage], passageIndex = 0) => {
    dismissSceneEcho()
    beginPassageLeg(passage, requestedTarget, plannedApproachPath, continuationPath, passageQueue, passageIndex)
  }, [beginPassageLeg, dismissSceneEcho])

  const interact = useCallback((entityId: string) => {
    if (commercialCafeNarrative) return
    npcInteractionRequestRef.current += 1
    setRequestedWorldTarget(null)
    if (phoneOpen) onPhoneDismiss?.()
    setDialogueLineIndex(null)
    setNpcDialogue(null)
    setCommercialCafeNarrative(null)
    dismissSceneEcho()
    const entity = getMainlineSceneEntity(scene, entityId)
    if (entity.kind === 'seat' && entity.seat) {
      const nextSeatId = nextMainlinePlayerSeatId(scene, activePlayerSeatId, entity.id)
      if (nextSeatId !== entity.id) {
        stopMovement()
        setFeedback('这把椅子已经有人坐了。')
        return
      }
      leavePlayerSeat()
      const resolved = findMainlinePathToEntity(scene, entity.id, getCurrentPosition(), layout, navigationOptions)
      const sitPosition = resolveMainlineSeatSitPosition(scene, entity.id, layout, navigationOptions)
      if (!resolved.path || !sitPosition) {
        stopMovement()
        setFeedback('这把椅子暂时无法使用。')
        return
      }
      setActiveObjectId(entity.id)
      setFeedback(`修杰走向${mainlineEntityDisplayLabel(entity)}。`)
      moveAlong(resolved.path, () => {
        resetMovement(sitPosition)
        navigationRuntime.updateActor('protagonist', sitPosition)
        setPlayerSeatId(nextSeatId)
        setPromptedSeatId(null)
        markEntityExplored(entity.id)
        setFeedback('修杰坐下了。')
        const resolution = resolveCommercialCafeNpcInteraction({
          sceneId: scene.id,
          npcId: 'lao-zhou',
          story: commercialCafeStory,
          playerSeatId: nextSeatId,
        })
        if (resolution?.kind === 'start-narrative') startCommercialCafeNarrative()
      }, {
        ...locomotionOptions,
        // A seat remains a two-step interaction exception. Its route may need
        // to keep the planner's turn around the paired table before the final
        // pulled/sit transition; generic smoothing must not straighten that
        // legal route back through furniture.
        preserveNavigationRoute: true,
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
        canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
        onBlocked: () => {
          setActiveObjectId(null)
          setFeedback('修杰在椅子前停下了，需要重新选择位置。')
        },
      })
      return
    }
    leavePlayerSeat()
    const passage = scene.passages.find((candidate) => candidate.entityId === entityId)
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
        setFeedback('这扇门当前无法从这里靠近。')
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
      const exploration = resolveMainlineSceneExploration(scene, entity, {
        incensePhase,
        officeBlindsOpen,
        carriedPhoneDevice,
        commercialCafeCoffeeOrdered: commercialCafeStory.coffeeOrdered,
        carriedMilkTea: carriedMilkTea || commercialStreetMilkTeaHeld(initialSceneState),
      })
      const explorationChoice = exploration.choice
      const explorationPool = exploration.pool
      const availableExplorationPool = explorationPool ?? []
      const hasExplorationContent = Boolean(explorationChoice || availableExplorationPool.length)
      const startsDialogue = scene.dialogue?.triggerEntityId === entity.id
      setFeedback(explorationChoice || explorationPool ? '修杰停在这里。' : scene.interactionText[entity.id] ?? `${mainlineEntityDisplayLabel(entity)}留在原处。`)
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
      interactionStartedAtRef.current = null
      stopMovement()
      setFeedback('这个位置暂时走不过去。')
      return
    }
    interactionStartedAtRef.current = Date.now()
    setActiveObjectId(entityId)
    setFeedback(`修杰前往${mainlineEntityDisplayLabel(entity)}。`)
    moveAlong(resolved.path, revealInteraction, {
      ...locomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
      onBlocked: () => {
        interactionStartedAtRef.current = null
        setActiveObjectId(null)
        setFeedback('修杰在边界前停下了，需要重新选择位置。')
      },
    })
  }, [activePlayerSeatId, carriedPhoneDevice, commercialCafeNarrative, commercialCafeStory, completeShortInteraction, dismissSceneEcho, getCurrentPosition, incensePhase, layout, leavePlayerSeat, locomotionOptions, markEntityExplored, moveAlong, navigationOptions, navigationRuntime, officeBlindsOpen, onDoorEvent, onObjectInteraction, onPhoneDismiss, phoneOpen, presentSceneEcho, recordSceneState, resetMovement, scene, screenMetrics, startCommercialCafeNarrative, startNpcDialogue, startPassageTraversal, stopMovement])

  const showMilkTeaEcho = useCallback((text: string) => {
    sceneEchoIdRef.current += 1
    presentSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      commercialStreetMilkTeaStorefrontId,
      text,
      sceneTextPresentationPosition(scene, getCurrentPosition(), text, screenMetrics),
    ))
  }, [getCurrentPosition, presentSceneEcho, scene, screenMetrics])

  const beginMilkTeaStorefrontAction = useCallback(() => {
    const currentOrder = commercialStreetMilkTeaOrderFromSceneState(initialSceneState)
    if (carriedMilkTea || commercialStreetMilkTeaHeld(initialSceneState)) {
      showMilkTeaEcho('手里已经有一杯饮料。')
      setFeedback('修杰已经拿着一杯饮料。')
      return
    }
    if (currentOrder) {
      if (commercialStreetMilkTeaIsReady(currentOrder)) {
        recordSceneStatePatch('commercial-street', commercialStreetMilkTeaPickupPatch())
        onChapterAnalytics?.('milk_tea_order_picked_up', { orderNumber: currentOrder.number })
        showMilkTeaEcho('取到奶茶。')
        setFeedback('修杰取走了奶茶。')
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
  }, [carriedMilkTea, initialSceneState, onChapterAnalytics, onMilkTeaAppOpen, recordSceneStatePatch, showMilkTeaEcho])

  const interactStorefront = useCallback((storefrontId: string) => {
    const storefront = scene.storefronts.find((candidate) => candidate.id === storefrontId)
    if (!storefront || !commercialStreetStorefrontInteractionFor(storefrontId)) return
    setRequestedWorldTarget(null)
    if (phoneOpen) onPhoneDismiss?.()
    setDialogueLineIndex(null)
    setNpcDialogue(null)

    const revealStorefrontInteraction = () => {
      const resolution = executeCommercialStreetStorefrontInteraction(storefrontId, storefrontInteractionRuntimeRef.current, storefrontExecutionRuntimeRef.current)
      setActiveObjectId(null)
      if (!resolution) return
      onChapterAnalytics?.('commercial_storefront_interacted', { slotId: storefront.id, storeType: storefront.label })
      dismissSceneEcho()
      if (resolution.kind === 'action') {
        onStorefrontAction?.(resolution.action, storefrontId)
        if (resolution.action === 'milk-tea-order' && storefrontId === commercialStreetMilkTeaStorefrontId) {
          beginMilkTeaStorefrontAction()
          return
        }
        setFeedback(`修杰来到${storefront.label}前。`)
        return
      }
      setFeedback('修杰停在这里。')
      sceneEchoIdRef.current += 1
      presentSceneEcho(createMainlineSceneEcho(
        sceneEchoIdRef.current,
        storefrontId,
        resolution.text,
        sceneTextPresentationPosition(scene, getCurrentPosition(), resolution.text, screenMetrics),
      ))
    }

    const currentPosition = getCurrentPosition()
    const interaction = resolveMainlineInteractionCandidates(
      scene,
      currentPosition,
      mainlineStorefrontInteractionCandidates(scene, storefront),
      .35,
      layout,
      navigationOptions,
    )
    if (interaction.inRange) {
      stopMovement()
      revealStorefrontInteraction()
      return
    }
    if (!interaction.path) {
      stopMovement()
      setFeedback('这个位置暂时走不过去。')
      return
    }
    setActiveObjectId(storefrontId)
    setFeedback(`修杰前往${storefront.label}。`)
    moveAlong(interaction.path, revealStorefrontInteraction, {
      ...locomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
      onBlocked: () => {
        setActiveObjectId(null)
        setFeedback('修杰在边界前停下了，需要重新选择位置。')
      },
    })
  }, [beginMilkTeaStorefrontAction, dismissSceneEcho, getCurrentPosition, layout, locomotionOptions, moveAlong, navigationOptions, onChapterAnalytics, onPhoneDismiss, onStorefrontAction, phoneOpen, presentSceneEcho, scene, screenMetrics, stopMovement])

  const interactNpc = useCallback((npcId: string) => {
    if (commercialCafeNarrative) return
    const npc = scene.npcs.find((candidate) => candidate.id === npcId)
    if (!npc || npc.interactive === false) return
    setRequestedWorldTarget(null)
    if (movingNpcIds.has(npcId)) {
      setFeedback(`${npc.label}正在移动，稍后再接近。`)
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
      setFeedback(`修杰来到${npc.label}身边。`)
      if (seatedResolution.kind === 'dialogue') startNpcDialogue(seatedResolution)
      else if (seatedResolution.kind === 'start-narrative') startCommercialCafeNarrative()
      else setFeedback(seatedResolution.feedback)
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
      setFeedback(`修杰来到${npc.label}身边。`)
      onNpcInteraction?.(npc.id)
      const resolution = resolveCommercialCafeNpcInteraction({
        sceneId: scene.id,
        npcId: npc.id,
        story: commercialCafeStory,
        playerSeatId: null,
      })
      if (!resolution) return
      if (resolution.kind === 'dialogue') startNpcDialogue(resolution)
      else if (resolution.kind === 'start-narrative') startCommercialCafeNarrative()
      else setFeedback(resolution.feedback)
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
      setFeedback('这个人目前无法接近。')
      return
    }
    setFeedback(`修杰走向${npc.label}。`)
    moveAlong(resolved.path, completeInteraction, {
      ...locomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, navigationOptions),
      onBlocked: () => {
        if (npcInteractionRequestRef.current !== requestId) return
        npcInteractionRequestRef.current += 1
        setFeedback('修杰在接近对方前停下了，需要重新选择位置。')
      },
    })
  }, [activePlayerSeatId, commercialCafeNarrative, commercialCafeStory, dismissSceneEcho, getCurrentPosition, layout, leavePlayerSeat, locomotionOptions, moveAlong, movingNpcIds, navigationOptions, onNpcInteraction, onPhoneDismiss, phoneOpen, scene, startCommercialCafeNarrative, startNpcDialogue, stopMovement])

  const chooseSceneEchoOption = useCallback((index: number) => {
    const option = sceneEcho?.options?.[index]
    if (!option) return
    const entity = sceneEcho.entityId ? scene.objects.find((candidate) => candidate.id === sceneEcho.entityId) : undefined
    const resolution = resolveMainlineSceneEchoChoice(scene, entity, option, Date.now(), {
      commercialCafeCoffeeOrdered: commercialCafeStory.coffeeOrdered,
      carriedMilkTea: carriedMilkTea || commercialStreetMilkTeaHeld(initialSceneState),
    })
    if (!resolution) return
    if (resolution.deskDevice) {
      onDeskInteraction?.(resolution.deskDevice)
      dismissSceneEcho()
      return
    }
    if (resolution.stateChange) recordSceneState(scene.id, resolution.stateChange.key, resolution.stateChange.value)
    if (resolution.stateChange?.key === commercialCafeCoffeeOrderedKey && resolution.stateChange.value === true) {
      onChapterAnalytics?.('cafe_coffee_ordered')
    }
    if (resolution.stateChange?.key === 'blindsOpen') {
      const open = resolution.stateChange.value === true
      setOfficeBlindsOpen(open)
    }
    if (resolution.stateChange?.key === 'incenseLitAt' && typeof resolution.stateChange.value === 'number') {
      setIncenseLitAt(resolution.stateChange.value)
      setIncenseClock(resolution.stateChange.value)
    }
    if (resolution.feedback) setFeedback(resolution.feedback)
    if (resolution.dismiss) {
      dismissSceneEcho()
      return
    }
    setSceneEcho((current) => {
      if (!current) return current
      if (resolution.echoText !== undefined) {
        return {
          ...replaceMainlineSceneEchoText(current, resolution.echoText),
          options: resolution.echoOptions,
        }
      }
      return resolution.clearOptions ? { ...current, options: undefined } : current
    })
  }, [carriedMilkTea, commercialCafeStory.coffeeOrdered, dismissSceneEcho, initialSceneState, onChapterAnalytics, onDeskInteraction, recordSceneState, scene, sceneEcho])

  const advanceSceneEcho = useCallback(() => {
    const current = sceneEchoRef.current
    if (!current || current.phase === 'leaving') return
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
    if (current.options && current.options.length > 0) return
    dismissSceneEcho()
  }, [dismissSceneEcho])

  const completeSceneEchoTyping = useCallback((echoId: number) => {
    const current = sceneEchoRef.current
    if (!current || current.id !== echoId || current.phase === 'leaving' || !current.typing) return
    const next = { ...current, typing: false }
    sceneEchoRef.current = next
    setSceneEcho(next)
  }, [])

  const advanceDialogue = useCallback(() => {
    if (commercialStreetQuestionNarrative) {
      setCommercialStreetQuestionNarrative((current) => current ? nextCommercialStreetQuestionNarrative(current) : current)
      return
    }
    if (commercialCafeNarrative) {
      const line = commercialCafeNarrativeDialogue.lines[commercialCafeStory.narrativeCursor]
      if (!line) return
      const segments = splitMainlineInteractionText(line.text)
      if (dialogueSegmentIndex + 1 < segments.length) {
        setDialogueSegmentIndex((current) => current + 1)
        return
      }
      const nextCursor = commercialCafeStory.narrativeCursor + 1
      setDialogueSegmentIndex(0)
      if (nextCursor < commercialCafeNarrativeDialogue.lines.length) {
        const nextStory = commercialCafeStoryWithCursor(commercialCafeStory, nextCursor)
        recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(nextStory))
        setDialogueLineIndex(nextCursor)
        const stage = commercialCafeAnalyticsStageForCursor(nextCursor)
        if (stage) onChapterAnalytics?.('cafe_story_stage_reached', { stage })
        return
      }
      recordSceneStatePatch(scene.id, commercialCafeStoryStatePatch(commercialCafeStoryReadyToLeave(commercialCafeStory)))
      onChapterAnalytics?.('cafe_story_stage_reached', { stage: 'ready-to-leave' })
      onChapterAnalytics?.('cafe_ready_to_leave')
      onChapterAnalytics?.('cafe_banknote_presented')
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
    const completedNpcDialogue = npcDialogue
    setDialogueLineIndex(null)
    setNpcDialogue(null)
    if (completedNpcDialogue) setPromptedSeatId(null)
  }, [activeDialogue, commercialCafeNarrative, commercialCafeStory, commercialStreetQuestionNarrative, dialogueLineIndex, dialogueSegmentIndex, npcDialogue, onChapterAnalytics, recordSceneState, recordSceneStatePatch, scene.id])

  const walk = useCallback((point: Point) => {
    if (commercialStreetQuestionNarrative || commercialCafeNarrative) return
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
      setFeedback('这条路被墙、桌面或柜台挡住了。')
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
    const started = moveTo(resolution.resolvedNavigableTarget, () => {
      if (resolution.deniedAccessRegion) {
        showAccessRegionDeniedText(resolution.deniedAccessRegion.deniedText ?? '这里暂时不能进入。')
        return
      }
      setFeedback('修杰停在这里。')
    }, resolution.path)
    if (started) {
      setFeedback('修杰沿着可行空间移动。')
    }
  }, [commercialCafeNarrative, commercialStreetQuestionNarrative, debugCafeSpatialQa, dismissSceneEcho, getCurrentPosition, layout, leavePlayerSeat, moveTo, navigationOptions, onPhoneDismiss, phoneOpen, sceneDefinition, setFeedback, setDialogueLineIndex, showAccessRegionDeniedText, startPassageTraversal, stopMovement])

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
    }
  }, [commercialCafeNarrative?.phase, commercialStreetQuestionNarrative?.phase, completeCommercialStreetQuestionNarrativeExit])

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
    setIncenseLitAt(null)
    setIncenseClock(Date.now())
    cancelPassageLifecycle('protagonist')
    setPassageDestination(null)
    setRequestedWorldTarget(null)
    resetMovement(initialPosition)
    setFeedback(null)
  }, [cancelPassageLifecycle, initialPosition, resetMovement, scene.id, sceneDefinition, setFeedback])

  const currentAreaLabel = mainlineSceneAreaLabel(scene, position)
  const cameraOffset = mainlineCameraOffset(scene, position, embedded)
  const debugCafeCounterStructure = debugRuntimeEvidence && scene.id === 'commercial-cafe'
    ? scene.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')
    : undefined
  const debugCafeStaffRegion = debugRuntimeEvidence && scene.id === 'commercial-cafe'
    ? scene.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')
    : undefined

  return (
    <>
      {scene.ambientNpcRoutes.map((schedule) => {
        const initialPosition = stagedNpcPositions.get(schedule.npcId) ?? scene.initialPlayerPosition
        return <AmbientNpcMotion
          key={schedule.npcId}
          enabled={scene.id === 'commercial-street'}
          schedule={schedule}
          initialPosition={initialPosition}
          scene={scene}
          layout={layout}
          navigationRuntime={navigationRuntime}
          navigationOptions={navigationOptions}
          footprint={ambientNpcFootprints.get(schedule.npcId) ?? serverFootprint}
          movementOptions={locomotionOptions}
          protagonistPosition={position}
          onRuntimeChange={handleAmbientNpcRuntimeChange}
        />
      })}
    <div {...sceneInteractionHandlers} className={`scene-shell mainline-scene ${embedded ? 'mainline-scene--embedded' : ''} ${!showSceneChrome ? 'mainline-scene--map-only' : ''}`} data-mainline-scene={scene.id} data-commercial-cafe-status={scene.id === 'commercial-cafe' ? commercialCafeStory.status : undefined} data-commercial-cafe-cursor={scene.id === 'commercial-cafe' ? commercialCafeStory.narrativeCursor : undefined} data-commercial-cafe-server-behavior={scene.id === 'commercial-cafe' ? commercialCafeBehavior.getPhase() : undefined} data-commercial-question-narrative={commercialStreetQuestionNarrative?.phase} data-debug-cafe-fixture={debugCafeFixture ? 'true' : undefined} data-debug-runtime-evidence={debugRuntimeEvidence ? 'true' : undefined} data-e2e-server-back-door={debugCafeServerBackDoor ? 'true' : undefined} data-e2e-server-back-door-status={debugCafeServerBackDoor ? debugCafeServerBackDoorStatus : undefined} data-e2e-access-region-x={debugCafeStaffRegion?.x} data-e2e-access-region-y={debugCafeStaffRegion?.y} data-e2e-access-region-width={debugCafeStaffRegion?.width} data-e2e-access-region-height={debugCafeStaffRegion?.height} data-e2e-counter-structure-x={debugCafeCounterStructure?.x} data-e2e-counter-structure-y={debugCafeCounterStructure?.y} data-e2e-counter-structure-width={debugCafeCounterStructure?.width} data-e2e-counter-structure-height={debugCafeCounterStructure?.height} data-e2e-server-blocker={debugCafeServerBlockerMode ?? undefined} data-e2e-server-blocker-x={debugRuntimeEvidence ? debugCafeServerBlockerTargetRef.current?.x : undefined} data-e2e-server-blocker-y={debugRuntimeEvidence ? debugCafeServerBlockerTargetRef.current?.y : undefined} data-e2e-story-interrupt-from-duty={debugRuntimeEvidence ? debugCafeStoryInterruptFromDutyRef.current ?? undefined : undefined}>
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
              dialoguePhase={commercialCafeNarrative?.phase ?? commercialStreetQuestionNarrative?.phase}
              dialogueLock={Boolean(commercialStreetQuestionNarrative || commercialCafeNarrative)}
              onDialogueExitComplete={completeDialogueExit}
              onDialogueAdvance={advanceDialogue}
              sceneEcho={sceneEcho}
              onSceneEchoAdvance={advanceSceneEcho}
              onSceneEchoTypingComplete={completeSceneEchoTyping}
              onSceneEchoChoice={chooseSceneEchoOption}
              onSceneEchoExitComplete={completeSceneEchoExit}
              carriedMilkTea={carryingMilkTea}
              onFrameMotionProfileChange={handleFrameMotionProfileChange}
              exploredObjectIds={exploredObjectIds}
              interactionTutorialCompleted={interactionTutorialCompleted}
              incenseLit={incenseLit}
              incenseBurnRemainingMs={incenseRemainingMs}
              onIncenseBurnComplete={() => setIncenseClock(Date.now())}
              visibleAttachedPropIds={scene.id === 'commercial-cafe' ? visibleCommercialCafeAttachedPropIds : undefined}
              occupiedSeatIds={occupiedSeatIds}
              playerSeatId={activePlayerSeatId}
              promptedSeatId={promptedSeatId}
              debugCafeSpatialQaEnabled={debugCafeSpatialQa}
              debugCafeSpatialQa={debugCafeSpatialQa ? cafeSpatialQaNavigation : null}
              debugRuntimeEvidence={debugRuntimeEvidence}
              debugInput={debugInput}
              debugNpcMovement={debugNpcMovement}
              onDebugNpcMovement={debugNpcMovement ? runDebugServerMovement : undefined}
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
