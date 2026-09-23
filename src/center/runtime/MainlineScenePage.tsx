'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Point } from './sceneGeometry'
import { MainlineSceneRenderer, type MainlineInputDiagnostic } from './MainlineSceneRenderer'
import { getMainlineSceneEntity, mainlineEntityDisplayLabel, mainlineSceneAreaLabel, mainlineSceneGeometryUnits, mainlineSceneWalkBounds, mainlineScenes, type MainlineSceneDefinition, type MainlineSceneEntity, type MainlineSceneExternalExit, type MainlineSceneId, type MainlineScenePassage } from './mainlineScenes'
import { findMainlinePath, findMainlinePathThroughPassage, findMainlinePathToEntity, findMainlinePathToNpc, findMainlineWorldRoute, isMainlineEntityWithinInteractionRange, isMainlineNpcWithinInteractionRange, isMainlinePassageInTransitZone, isWalkableMainlinePoint, mainlineInteractionTarget, mainlinePassageCollisionForNavigation, mainlinePassageCrossesToSide, mainlinePassageDoorRegion, mainlinePassageDoorwayForNavigation, mainlinePassageExitPoint, mainlinePassageSide, resolveMainlineAccessRegionBoundaryTarget, resolveMainlineNpcPosition, resolveMainlineSafeEntryPosition, resolveMainlineSafeSpawnPosition, resolveMainlineSeatSitPosition } from './mainlineNavigation'
import { layoutGridSize, mainlineEntityInteractionBounds, mainlineEntityVisualBounds, type SceneLayout } from './sceneLayout'
import { clearSceneLayout, loadSceneLayout, persistSceneLayout } from './sceneLayoutPersistence'
import { movementDurationMsForPath, useFreeRoamMovement, type FreeRoamMovement } from './useFreeRoamMovement'
import type { PhoneDevice } from './phoneState'
import { sceneInteractionHandlers } from './sceneInteraction'
import { useAutomaticPassages } from './useAutomaticPassages'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineCameraOffset } from './mainlineViewport'
import { sceneFrameDefaultMotionMs, sceneFrameRetractionBudgetMs } from './sceneMotion'
import { sceneDoorMotion } from './sceneDoorConfig'
import type { PlayerChoiceValue, PlayerSceneState } from './playerSave'
import { commercialCafeDepartureText, commercialCafeLaoZhouConversationSeatId, commercialCafeStoryStageFromSceneState, commercialCafeStoryStageKey, isCommercialCafeStoryStage, resolveCommercialCafeAttachedPropInteraction, resolveCommercialCafeNpcInteraction, shouldCompleteCommercialCafeStoryOnTransition, type CommercialCafeNpcInteractionResolution, type CommercialCafeStoryStage } from './commercialCafeStory'
import { createCommercialCafeServerBehaviorCoordinator } from './commercialCafeBehavior'
import { createMainlineSceneGeometrySnapshot, type MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { createNavigationRuntime } from './navigationCore'
import { useNpcMovement } from './useNpcMovement'
import { splitMainlineInteractionText } from './mainlineTextSegments'
import { mainlineEchoLayout } from './mainlineEchoLayout'
import { incenseBurnPhase, incenseBurnRemainingMs, resolveMainlineSceneEchoChoice, resolveMainlineSceneExploration, type IncenseBurnPhase } from './mainlineSceneInteractions'
import { nextMainlinePlayerSeatId, mainlineSceneOccupiedSeatIds } from './mainlineSeating'
import { commercialCafeServerMovementDebugTarget } from './mainlineSceneModel'

const emptyExternalStoreSubscribe = () => () => undefined
const emptyLayoutSnapshot: SceneLayout = {}
const emptyExplorationObjectIds: ReadonlySet<string> = new Set()
type NpcDialogueResolution = Extract<CommercialCafeNpcInteractionResolution, { kind: 'dialogue' }>
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
const getDebugInputSnapshot = () => typeof window === 'undefined' ? '' : window.location.search
const getServerDebugInputSnapshot = () => ''
let cachedMainlineLayoutHref: string | null = null
let cachedMainlineLayoutSceneId: string | null = null
let cachedMainlineLayout: SceneLayout = emptyLayoutSnapshot

function getMainlineLayoutSnapshot(sceneId: string) {
  if (typeof window === 'undefined') return emptyLayoutSnapshot
  const href = window.location.href
  if (href !== cachedMainlineLayoutHref || sceneId !== cachedMainlineLayoutSceneId) {
    cachedMainlineLayoutHref = href
    cachedMainlineLayoutSceneId = sceneId
    cachedMainlineLayout = loadSceneLayout(sceneId)
  }
  return cachedMainlineLayout
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
  }
}

function replaceMainlineSceneEchoText(current: MainlineSceneEcho, text: string): MainlineSceneEcho {
  const segments = splitMainlineInteractionText(text)
  return {
    ...current,
    text: segments[0] ?? text.trim(),
    segments,
    segmentIndex: 0,
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

function clampEchoPoint(point: Point, scene: MainlineSceneDefinition, screenMetrics: SceneScreenMetrics): Point {
  const bounds = mainlineSceneWalkBounds(scene, screenMetrics)
  return {
    x: Math.min(bounds.x + bounds.width, Math.max(bounds.x, point.x)),
    y: Math.min(bounds.y + bounds.height, Math.max(bounds.y, point.y)),
  }
}

type EchoBox = { x: number; y: number; width: number; height: number }

function echoTextBox(text: string, position: Point, screenMetrics: SceneScreenMetrics): EchoBox {
  const { widthPx, heightPx } = mainlineEchoLayout(text, screenMetrics)
  return {
    x: position.x - (widthPx / screenMetrics.width) * 50,
    y: position.y - (heightPx / screenMetrics.height) * 50,
    width: (widthPx / screenMetrics.width) * 100,
    height: (heightPx / screenMetrics.height) * 100,
  }
}

function mainlineWallGlyphOccupancy(scene: MainlineSceneDefinition, position: Point, screenMetrics: SceneScreenMetrics, geometrySnapshot?: MainlineSceneGeometrySnapshot): EchoBox[] {
  const fontSizePx = Math.max(9, Math.min(16, screenMetrics.width * .0115))
  const seen = new Set<string>()
  return (geometrySnapshot?.units ?? mainlineSceneGeometryUnits(scene, position, screenMetrics)).flatMap((unit) => unit.visual.cells)
    .filter((cell) => Boolean(cell.glyph?.trim()) && cell.baselineVisible !== false)
    .filter((cell) => {
      const key = `${cell.x}:${cell.y}:${cell.glyph}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((cell) => {
      const glyphCount = Math.max(1, Array.from(cell.glyph ?? '').length)
      const width = (glyphCount * fontSizePx / screenMetrics.width) * 100
      const height = (fontSizePx * 1.2 / screenMetrics.height) * 100
      return { x: cell.x - width / 2, y: cell.y - height / 2, width, height }
    })
}

function boxesOverlap(first: EchoBox, second: EchoBox, padding: number) {
  return first.x < second.x + second.width + padding
    && first.x + first.width > second.x - padding
    && first.y < second.y + second.height + padding
    && first.y + first.height > second.y - padding
}

function echoPositionNearPlayer(scene: MainlineSceneDefinition, text: string, position: Point, layout: SceneLayout, screenMetrics: SceneScreenMetrics, geometrySnapshot?: MainlineSceneGeometrySnapshot): Point {
  const step = layoutGridSize
  const bounds = geometrySnapshot?.walkBounds ?? mainlineSceneWalkBounds(scene, screenMetrics)
  const ringCount = Math.ceil(Math.max(bounds.width, bounds.height) / step)
  const directionCount = 8
  const echoClearance = layoutGridSize
  const visualOccupancy = scene.objects
    .map((entity) => geometrySnapshot?.objects.get(entity.id)?.visualBounds ?? mainlineEntityVisualBounds(scene, entity, layout, screenMetrics))
    .filter((footprint): footprint is EchoBox => Boolean(footprint))
  const wallGlyphOccupancy = mainlineWallGlyphOccupancy(scene, position, screenMetrics, geometrySnapshot)
  const candidates: Array<{ point: Point; score: number }> = []
  for (let ring = 1; ring <= ringCount; ring += 1) {
    for (let direction = 0; direction < directionCount; direction += 1) {
      const angle = direction * (Math.PI * 2 / directionCount)
      const candidate = clampEchoPoint({
        x: position.x + Math.cos(angle) * step * ring,
        y: position.y + Math.sin(angle) * step * ring,
      }, scene, screenMetrics)
      if (!isWalkableMainlinePoint(candidate, scene, layout, { screenMetrics, geometrySnapshot })) continue
      const candidateBox = echoTextBox(text, candidate, screenMetrics)
      if (
        candidateBox.x < bounds.x + echoClearance
        || candidateBox.x + candidateBox.width > bounds.x + bounds.width - echoClearance
        || candidateBox.y < bounds.y + echoClearance
        || candidateBox.y + candidateBox.height > bounds.y + bounds.height - echoClearance
      ) continue
      if (visualOccupancy.some((footprint) => boxesOverlap(candidateBox, footprint, echoClearance))) continue
      if (wallGlyphOccupancy.some((footprint) => boxesOverlap(candidateBox, footprint, .9))) continue
      const interactiveTextOverlap = scene.objects.some((entity) => {
        const footprint = geometrySnapshot?.objects.get(entity.id)?.interactionBounds ?? mainlineEntityInteractionBounds(scene, entity, layout, screenMetrics)
        return footprint ? boxesOverlap(candidateBox, footprint, echoClearance) : false
      })
      if (interactiveTextOverlap) continue
      const edgeDistance = Math.min(
        candidateBox.x - bounds.x,
        bounds.x + bounds.width - candidateBox.x - candidateBox.width,
        candidateBox.y - bounds.y,
        bounds.y + bounds.height - candidateBox.y - candidateBox.height,
      )
      candidates.push({ point: candidate, score: ring * step - Math.min(edgeDistance, 12) * .15 })
    }
  }
  return candidates.sort((first, second) => first.score - second.score)[0]?.point ?? position
}

function entryFeedbackForScene(scene: MainlineSceneDefinition) {
  return scene.entryFeedback ?? `从${scene.title.replace(/^第[一二三]章 · /, '')}入口进入。`
}

type PendingMainlineTraversal = {
  passage: MainlineScenePassage
  passageQueue: readonly MainlineScenePassage[]
  passageIndex: number
  requestedTarget: Point
  approachPath: Point[]
  continuationPath?: Point[] | null
  requestIssued: boolean
  frameRetractionStarted: boolean
  approachArrived: boolean
}

type SceneFrameExitLifecycle =
  | { phase: 'idle' }
  | {
      phase: 'retracting'
      passageEntityId: string
      scope: 'passage' | 'scene'
    }

export function MainlineScenePage({
  sceneId,
  onExternalExit,
  onExternalReturn,
  embedded = false,
  showSceneChrome = true,
  showProtagonist = true,
  movementController,
  onPositionChange,
  onSceneReady,
  onFeedbackChange,
  walkRequest,
  phoneOpen = false,
  onPhoneDismiss,
  onDeskInteraction,
  onObjectInteraction,
  onNpcInteraction,
  onDoorEvent,
  initialSceneState = {},
  onPlayerSceneStateChange,
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
  movementController?: FreeRoamMovement
  onPositionChange?: (position: Point) => void
  onSceneReady?: () => void
  onFeedbackChange?: (feedback: string | null) => void
  walkRequest?: { id: number; point: Point } | null
  phoneOpen?: boolean
  onPhoneDismiss?: () => void
  onDeskInteraction?: (device: PhoneDevice) => void
  onObjectInteraction?: (entity: MainlineSceneEntity, dwellMs: number) => void
  onNpcInteraction?: (npcId: string) => void
  onDoorEvent?: (phase: 'attempted' | 'blocked' | 'crossed', passage: MainlineScenePassage) => void
  initialSceneState?: PlayerSceneState
  onPlayerSceneStateChange?: (sceneId: MainlineSceneId, key: string, value: PlayerChoiceValue) => void
  carriedPhoneDevice?: PhoneDevice
  onSceneTransition: (sceneId: MainlineSceneId, entryPosition?: Point, spawnMode?: 'resume' | 'ride') => void
  onSafeSpawnCorrection?: (position: Point) => void
  entryPosition?: Point
  spawnMode?: 'resume' | 'ride'
  resumePosition?: Point
}) {
  const sceneDefinition: MainlineSceneDefinition = mainlineScenes[sceneId]
  const initialPosition = initialPositionForEntry(sceneDefinition, sceneId, entryPosition, spawnMode, resumePosition)
  const [layoutMode, setLayoutMode] = useState(false)
  const getLayoutSnapshot = useCallback(() => getMainlineLayoutSnapshot(sceneDefinition.id), [sceneDefinition.id])
  const persistedLayout = useSyncExternalStore(emptyExternalStoreSubscribe, getLayoutSnapshot, getServerMainlineLayoutSnapshot)
  const [savedLayout, setSavedLayout] = useState<SceneLayout | null>(null)
  const [draftLayout, setDraftLayout] = useState<SceneLayout | null>(null)
  const committedLayout = savedLayout ?? persistedLayout
  const layout = draftLayout ?? committedLayout
  const [layoutSaveState, setLayoutSaveState] = useState<'clean' | 'dirty' | 'saved'>('clean')
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null)
  const [explorationState, setExplorationState] = useState<{ sceneId: MainlineSceneId; objectIds: ReadonlySet<string> }>(() => ({ sceneId, objectIds: new Set() }))
  const [passageDestination, setPassageDestination] = useState<Point | null>(null)
  const [sceneFrameExit, setSceneFrameExit] = useState<SceneFrameExitLifecycle>({ phase: 'idle' })
  const frameMotionBudgetMsRef = useRef(sceneFrameRetractionBudgetMs(sceneFrameDefaultMotionMs))
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
  const npcInteractionRequestRef = useRef(0)
  const navigationRuntimeRef = useRef(createNavigationRuntime())
  const navigationRuntime = navigationRuntimeRef.current
  const commercialCafeBehaviorRef = useRef(createCommercialCafeServerBehaviorCoordinator())
  const commercialCafeBehavior = commercialCafeBehaviorRef.current
  const debugCafeFixtureAppliedRef = useRef(false)
  const debugCafePlayerPositionAppliedRef = useRef(false)
  const handledWalkRequestRef = useRef<number | null>(null)
  const [feedback, setFeedback] = useState(entryFeedbackForScene(sceneDefinition))
  const [inputDiagnostic, setInputDiagnostic] = useState<MainlineInputDiagnostic | null>(null)
  const debugInputSearch = useSyncExternalStore(emptyExternalStoreSubscribe, getDebugInputSnapshot, getServerDebugInputSnapshot)
  const debugInput = new URLSearchParams(debugInputSearch).get('debugInput') === '1'
  const debugNpcMovement = new URLSearchParams(debugInputSearch).get('debugNpcMovement') === '1'
  const debugCafeStageValue = new URLSearchParams(debugInputSearch).get('debugCafeStage')
  const debugCafeFixture = import.meta.env.DEV && new URLSearchParams(debugInputSearch).get('debugCafeFixture') === '1'
  const debugRuntimeEvidence = import.meta.env.DEV && new URLSearchParams(debugInputSearch).get('debugRuntimeEvidence') === '1'
  const debugCafeStoryInterrupt = import.meta.env.DEV && new URLSearchParams(debugInputSearch).get('debugCafeStoryInterrupt') === '1'
  const debugCafeServerBlocker = import.meta.env.DEV && new URLSearchParams(debugInputSearch).get('debugCafeServerBlocker') === '1'
  const debugCafePlayerPosition = import.meta.env.DEV ? debugCafePoint(new URLSearchParams(debugInputSearch).get('debugCafePlayerPosition')) : null
  const [debugCafeStoryStage, setDebugCafeStoryStage] = useState<CommercialCafeStoryStage | null>(() => (
    import.meta.env.DEV && isCommercialCafeStoryStage(debugCafeStageValue) ? debugCafeStageValue : null
  ))
  const debugCafeStoryInterruptAppliedRef = useRef(false)
  const debugCafeServerBlockerId = 'e2e-commercial-cafe-server-blocker'
  const [dialogueLineIndex, setDialogueLineIndex] = useState<number | null>(null)
  const [dialogueSegmentIndex, setDialogueSegmentIndex] = useState(0)
  const [npcDialogue, setNpcDialogue] = useState<NpcDialogueResolution | null>(null)
  const [playerSeatId, setPlayerSeatId] = useState<string | null>(null)
  // The isolated browser fixture mirrors the real conversation-seat state in
  // memory only. It never writes the user's save and is unavailable in production.
  const activePlayerSeatId = debugCafeFixture ? commercialCafeLaoZhouConversationSeatId : playerSeatId
  const [promptedSeatId, setPromptedSeatId] = useState<string | null>(null)
  const [sceneEcho, setSceneEcho] = useState<MainlineSceneEcho | null>(null)
  const sceneEchoRef = useRef<MainlineSceneEcho | null>(null)
  const [officeBlindsOpen, setOfficeBlindsOpen] = useState(initialSceneState.blindsOpen !== false)
  const [incenseLitAt, setIncenseLitAt] = useState<number | null>(() => typeof initialSceneState.incenseLitAt === 'number' ? initialSceneState.incenseLitAt : null)
  const [incenseClock, setIncenseClock] = useState(() => Date.now())
  const sceneEchoIdRef = useRef(0)
  const exploredObjectIds = explorationState.sceneId === scene.id ? explorationState.objectIds : emptyExplorationObjectIds
  const incensePhase: IncenseBurnPhase = incenseBurnPhase(incenseLitAt, incenseClock)
  const incenseLit = incensePhase === 'fresh' || incensePhase === 'half'
  const incenseRemainingMs = incenseBurnRemainingMs(incenseLitAt, incenseClock)
  const persistedCommercialCafeStoryStage = commercialCafeStoryStageFromSceneState(initialSceneState)
  const commercialCafeStoryStage = debugCafeStoryStage ?? persistedCommercialCafeStoryStage
  const recordSceneState = useCallback((targetSceneId: MainlineSceneId, key: string, value: PlayerChoiceValue) => {
    if (debugCafeStoryStage && targetSceneId === 'commercial-cafe' && key === commercialCafeStoryStageKey && isCommercialCafeStoryStage(value)) {
      setDebugCafeStoryStage(value)
      return
    }
    onPlayerSceneStateChange?.(targetSceneId, key, value)
  }, [debugCafeStoryStage, onPlayerSceneStateChange])
  const dismissSceneEcho = useCallback(() => {
    const current = sceneEchoRef.current
    if (!current) return
    const next = current.phase === 'leaving'
      ? current
      : { ...current, phase: 'leaving' as const, options: undefined, exit: { textComplete: false, frameComplete: false } }
    sceneEchoRef.current = next
    setSceneEcho(next)
  }, [])
  const completeSceneEchoExit = useCallback((echoId: number, source: 'text' | 'frame') => {
    const current = sceneEchoRef.current
    if (!current || current.id !== echoId || current.phase !== 'leaving') return
    const exit = {
      textComplete: current.exit?.textComplete ?? false,
      frameComplete: current.exit?.frameComplete ?? false,
      [source === 'text' ? 'textComplete' : 'frameComplete']: true,
    }
    const next = exit.textComplete && exit.frameComplete
      ? null
      : { ...current, exit }
    sceneEchoRef.current = next
    setSceneEcho(next)
    if (!next) setActiveObjectId(null)
  }, [])
  useIsomorphicLayoutEffect(() => {
    sceneEchoRef.current = sceneEcho
  }, [sceneEcho])
  const notifySceneTransition = useCallback((targetSceneId: MainlineSceneId, targetEntryPosition?: Point, targetSpawnMode?: 'resume' | 'ride') => {
    setExplorationState({ sceneId: targetSceneId, objectIds: new Set() })
    setIncenseClock(Date.now())
    onSceneTransition(targetSceneId, targetEntryPosition, targetSpawnMode)
  }, [onSceneTransition])
  const activeDialogue = npcDialogue?.dialogue ?? scene.dialogue
  const activeDialogueLine = activeDialogue && dialogueLineIndex !== null
    ? activeDialogue.lines[dialogueLineIndex] ?? null
    : null
  const activeDialogueSegments = activeDialogueLine ? splitMainlineInteractionText(activeDialogueLine.text) : []
  const activeDialogueText = activeDialogueSegments[dialogueSegmentIndex] ?? activeDialogueSegments[0] ?? ''
  const internalMovement = useFreeRoamMovement(initialPosition)
  const { position, moving, destination, moveAlong: rawMoveAlong, stopMovement, resetMovement, getCurrentPosition, getRemainingDurationMs } = movementController ?? internalMovement
  const moveAlong = useCallback((path: Point[], onArrive?: () => void, options?: Parameters<FreeRoamMovement['moveAlong']>[2]) => {
    rawMoveAlong(path, onArrive, {
      ...options,
      onMove: (nextPosition) => {
        navigationRuntime.updateActor('protagonist', nextPosition)
        options?.onMove?.(nextPosition)
      },
    })
  }, [navigationRuntime, rawMoveAlong])
  const geometrySnapshot = useMemo(() => createMainlineSceneGeometrySnapshot(scene, position, layout, screenMetrics), [layout, position, scene, screenMetrics])
  const stagedNpcPositions = useMemo(() => new Map(scene.npcs.map((npc) => [
    npc.id,
    resolveMainlineNpcPosition(scene, npc.id, layout, { geometrySnapshot, screenMetrics }),
  ])), [geometrySnapshot, layout, scene, screenMetrics])
  const serverInitialPosition = stagedNpcPositions.get('server') ?? scene.initialPlayerPosition
  const serverMovement = useNpcMovement({
    enabled: scene.id === 'commercial-cafe' && scene.npcs.some((npc) => npc.id === 'server'),
    npcId: 'server',
    initialPosition: serverInitialPosition,
    navigationRuntime,
  })
  const npcRuntimePositions = useMemo(() => serverMovement.position
    ? new Map<string, Point>([['server', serverMovement.position]])
    : new Map<string, Point>(), [serverMovement.position])
  const npcRuntimeSnapshots = useMemo(() => new Map([['server', serverMovement.snapshot]]), [serverMovement.snapshot])
  const resolvedNpcPositions = useMemo(() => new Map(scene.npcs.map((npc) => [
    npc.id,
    resolveMainlineNpcPosition(scene, npc.id, layout, { geometrySnapshot, screenMetrics, npcRuntimePositions }),
  ])), [geometrySnapshot, layout, npcRuntimePositions, scene, screenMetrics])
  const movingNpcIds = useMemo(() => serverMovement.snapshot.phase === 'moving'
    ? new Set(['server'])
    : new Set<string>(), [serverMovement.snapshot.phase])
  const occupiedSeatIds = useMemo(() => mainlineSceneOccupiedSeatIds(scene, activePlayerSeatId), [activePlayerSeatId, scene])
  useEffect(() => {
    navigationRuntime.registerActor('protagonist', getCurrentPosition())
    return () => navigationRuntime.removeActor('protagonist')
  }, [getCurrentPosition, navigationRuntime])
  useEffect(() => {
    navigationRuntime.updateActor('protagonist', position)
  }, [navigationRuntime, position])
  useEffect(() => {
    resolvedNpcPositions.forEach((npcPosition, npcId) => navigationRuntime.registerActor(npcId, npcPosition))
    return () => resolvedNpcPositions.forEach((_npcPosition, npcId) => navigationRuntime.removeActor(npcId))
  }, [navigationRuntime, resolvedNpcPositions])
  useEffect(() => {
    pendingTraversalRef.current = null
    setPassageDestination(null)
    setSceneFrameExit({ phase: 'idle' })
    setActiveObjectId(null)
    setExplorationState({ sceneId, objectIds: new Set() })
    setDialogueLineIndex(null)
    setDialogueSegmentIndex(0)
    setNpcDialogue(null)
    setPlayerSeatId(null)
    setPromptedSeatId(null)
    setSceneEcho(null)
    setOfficeBlindsOpen(initialSceneState.blindsOpen !== false)
    setIncenseLitAt(typeof initialSceneState.incenseLitAt === 'number' ? initialSceneState.incenseLitAt : null)
    setIncenseClock(Date.now())
    stopMovement()
    setFeedback(entryFeedbackForScene(sceneDefinition))
  }, [sceneDefinition, sceneId, stopMovement])
  useEffect(() => {
    if (sceneId !== 'commercial-cafe') return
    const stage = commercialCafeStoryStageFromSceneState(initialSceneState)
    if (initialSceneState[commercialCafeStoryStageKey] === stage) return
    onPlayerSceneStateChange?.(sceneId, commercialCafeStoryStageKey, stage)
  }, [initialSceneState, onPlayerSceneStateChange, sceneId])
  const activeDialoguePosition = activeDialogueLine
    ? echoPositionNearPlayer(scene, activeDialogueText, position, layout, screenMetrics, geometrySnapshot)
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
    setSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      passage.entityId,
      text,
      echoPositionNearPlayer(scene, text, getCurrentPosition(), layout, screenMetrics, geometrySnapshot),
    ))
    setFeedback('修杰停在门前。')
  }, [geometrySnapshot, getCurrentPosition, layout, scene, screenMetrics])
  const showAccessRegionDeniedText = useCallback((text: string) => {
    sceneEchoIdRef.current += 1
    setSceneEcho(createMainlineSceneEcho(
      sceneEchoIdRef.current,
      undefined,
      text,
      echoPositionNearPlayer(scene, text, getCurrentPosition(), layout, screenMetrics, geometrySnapshot),
    ))
    setFeedback('修杰停在员工区域外。')
  }, [geometrySnapshot, getCurrentPosition, layout, scene, screenMetrics])
  const { requestPassage: requestPassageLifecycle, cancelPassage: cancelPassageLifecycle, updateActor: updatePassageLifecycle, completeOpen, completeClose, getPassagePhase, getOpenPassageIds, passageStates } = useAutomaticPassages({
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
  const navigationOptions = useMemo(() => ({ openPassageIds: getOpenPassageIds(), screenMetrics, geometrySnapshot, navigationRuntime, actorId: 'protagonist', npcRuntimePositions }), [geometrySnapshot, getOpenPassageIds, navigationRuntime, npcRuntimePositions, screenMetrics])
  const locomotionOptions = useMemo(() => ({ screenMetrics, screenSpeedPxPerSecond: 520 }), [screenMetrics])
  const commercialCafeServiceMovementOptions = useMemo(() => ({ screenMetrics, screenSpeedPxPerSecond: 160 }), [screenMetrics])
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
    // This is an invisible DEV-only actor reservation, deliberately larger
    // than every legal table contact. It proves that delivery respects the
    // same dynamic-actor obstacle registry as normal play.
    navigationRuntime.registerActor(debugCafeServerBlockerId, coffeeTable.position, 15)
    return () => navigationRuntime.removeActor(debugCafeServerBlockerId)
  }, [debugCafeServerBlocker, debugCafeServerBlockerId, geometrySnapshot, navigationRuntime, scene])
  useEffect(() => {
    if (!debugCafeStoryInterrupt || debugCafeStoryInterruptAppliedRef.current || scene.id !== 'commercial-cafe') return
    if (commercialCafeStoryStage !== 'entered' || serverMovement.snapshot.phase !== 'moving') return
    debugCafeStoryInterruptAppliedRef.current = true
    setDebugCafeStoryStage('met-lao-zhou')
  }, [commercialCafeStoryStage, debugCafeStoryInterrupt, scene.id, serverMovement.snapshot.phase])
  useEffect(() => {
    if (scene.id !== 'commercial-cafe') {
      commercialCafeBehavior.reset()
      return
    }
    if (!serverMovement.position) return
    const intent = commercialCafeBehavior.requestForStage({
      scene,
      stage: commercialCafeStoryStage,
      from: serverMovement.position,
      snapshot: serverMovement.snapshot,
      layout,
      navigationOptions,
    })
    if (!intent) return
    const started = serverMovement.requestMove(intent, scene, layout, navigationOptions, commercialCafeServiceMovementOptions, () => {
      if (intent.dutyId === 'server.deliver-coffee') {
        recordSceneState(scene.id, commercialCafeStoryStageKey, 'coffee-delivered')
      }
      commercialCafeBehavior.arrived()
    })
    if (!started) commercialCafeBehavior.block()
  }, [commercialCafeBehavior, commercialCafeServiceMovementOptions, commercialCafeStoryStage, layout, navigationOptions, recordSceneState, scene, serverMovement])
  const runDebugServerMovement = useCallback(() => {
    if (scene.id !== 'commercial-cafe' || !serverMovement.position || serverMovement.snapshot.phase === 'moving') return
    setFeedback('店员开发移动演示中。')

    const returnHome = () => {
      serverMovement.requestMove({
        dutyId: 'server.debug-return',
        targetId: 'commercial-cafe-server-home',
        target: serverInitialPosition,
      }, scene, layout, navigationOptions, commercialCafeServiceMovementOptions)
    }
    const started = serverMovement.requestMove({
      dutyId: 'server.debug-movement',
      targetId: commercialCafeServerMovementDebugTarget.id,
      target: commercialCafeServerMovementDebugTarget.position,
    }, scene, layout, navigationOptions, commercialCafeServiceMovementOptions, returnHome)
    if (!started) setFeedback('店员的开发移动演示当前无法规划路线。')
  }, [commercialCafeServiceMovementOptions, layout, navigationOptions, scene, serverInitialPosition, serverMovement])
  const handleFrameMotionBudgetChange = useCallback((durationMs: number) => {
    if (Number.isFinite(durationMs) && durationMs > 0) frameMotionBudgetMsRef.current = sceneFrameRetractionBudgetMs(durationMs)
  }, [])
  const doorPhases = useMemo(() => new Map(passageLifecycleDefinitions
    .map((passage) => [
      scene.passages.find((candidate) => candidate.id === passage.id)?.entityId,
      passageStates.get(passage.id)?.phase ?? 'closed',
    ] as const)
    .filter((entry): entry is readonly [string, 'closed' | 'opening' | 'open' | 'crossing' | 'holding' | 'closing'] => Boolean(entry[0]))), [passageLifecycleDefinitions, passageStates, scene.passages])
  const armPassageFrameExit = useCallback((passage: MainlineScenePassage) => {
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
      : findMainlinePathThroughPassage(scene, passage.id, traversalStart, layout, navigationOptions).path
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
    }
    const approachDurationMs = movementDurationMsForPath(resolvedPath, traversalStart, approachMovementOptions)
    const shouldStartFrameExitImmediately = approachDurationMs > 0 && approachDurationMs <= frameMotionBudgetMsRef.current
    pendingTraversalRef.current = { passage, passageQueue, passageIndex, requestedTarget, approachPath: resolvedPath, continuationPath, requestIssued: false, frameRetractionStarted: shouldStartFrameExitImmediately, approachArrived: false }
    if (shouldStartFrameExitImmediately) armPassageFrameExit(passage)
    moveAlong(resolvedPath, () => {
      const pending = pendingTraversalRef.current
      if (!pending || pending.passage.id !== passage.id) return
      pending.approachArrived = true
      if (!pending.requestIssued && !requestPassageLifecycle('protagonist', passage.id, getCurrentPosition(), requestedTarget)) {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setSceneFrameExit({ phase: 'idle' })
        setFeedback(`${mainlineEntityDisplayLabel(entity)}暂时无法通行。`)
        return
      }
      pending.requestIssued = true
      pending.frameRetractionStarted = true
      armPassageFrameExit(passage)
      const phase = getPassagePhase(passage.id)
      if (phase === 'open' || phase === 'crossing') continuePendingTraversalRef.current(entity.id)
    }, {
      ...approachMovementOptions,
      onMove: (point) => {
        const pending = pendingTraversalRef.current
        if (!pending || pending.passage.id !== passage.id) return
        const remainingMovementMs = getRemainingDurationMs()
        if (!pending.frameRetractionStarted && remainingMovementMs <= frameMotionBudgetMsRef.current) {
          pending.frameRetractionStarted = true
          armPassageFrameExit(passage)
        }
        if (pending.requestIssued || remainingMovementMs > sceneDoorMotion.openingMs) return
        pending.requestIssued = requestPassageLifecycle('protagonist', passage.id, point, requestedTarget)
        if (!pending.requestIssued) {
          pendingTraversalRef.current = null
          setPassageDestination(null)
          setSceneFrameExit({ phase: 'idle' })
          setFeedback(`${mainlineEntityDisplayLabel(entity)}暂时无法通行。`)
          return
        }
        pending.frameRetractionStarted = true
        armPassageFrameExit(passage)
      },
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
    const traversalStart = getCurrentPosition()
    const openNavigationOptions = { ...navigationOptions, openPassageIds: getOpenPassageIds() }
    if (pending.passage.targetSceneId) {
      const collision = mainlinePassageCollisionForNavigation(scene, pending.passage, openNavigationOptions)
      const doorway = mainlinePassageDoorwayForNavigation(scene, pending.passage, openNavigationOptions)
      const exitPoint = mainlinePassageExitPoint(pending.passage, traversalStart, undefined, collision, doorway)
      const approachStart = pending.approachPath[0] ?? traversalStart
      const sourceSide = mainlinePassageSide(pending.passage, approachStart, collision, doorway)
      const targetSide: 0 | 1 = sourceSide === 1 ? 0 : 1
      let sceneTransitioned = false
      let previousTraversalPoint = traversalStart
      const transitionScene = () => {
        if (sceneTransitioned) return
        sceneTransitioned = true
        const completesCommercialCafeStory = shouldCompleteCommercialCafeStoryOnTransition({ sceneId: scene.id, stage: commercialCafeStoryStage, targetSceneId: pending.passage.targetSceneId })
        if (completesCommercialCafeStory) {
          recordSceneState(scene.id, commercialCafeStoryStageKey, 'complete')
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
        notifySceneTransition(targetSceneId, safeEntryPosition)
      }
      moveAlong([traversalStart, exitPoint], () => {
        if (!sceneTransitioned) setFeedback('修杰在门洞中停下了，需要重新选择位置。')
      }, {
        ...locomotionOptions,
        onMove: (point) => {
          if (sceneTransitioned) return
          const crossedDoorway = mainlinePassageCrossesToSide(pending.passage, previousTraversalPoint, point, targetSide, collision, doorway)
          previousTraversalPoint = point
          if (!crossedDoorway) return
          transitionScene()
        },
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, { ...navigationOptions, openPassageIds: getOpenPassageIds() })
          || isMainlinePassageInTransitZone(pending.passage, point, undefined, doorway),
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
      const continuationPath = current.continuationPath ?? findMainlinePath(
        getCurrentPosition(),
        current.requestedTarget,
        scene,
        layout,
        openNavigationOptions,
      )
      if (!continuationPath) {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setActiveObjectId(null)
        setFeedback('门已经打开，但对面的路暂时走不过去。')
        return
      }
      pendingTraversalRef.current = null
      moveAlong(continuationPath, () => {
        setPassageDestination(null)
        setActiveObjectId(null)
        setFeedback('修杰停在这里。')
      }, {
        ...locomotionOptions,
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, openNavigationOptions),
        onBlocked: () => {
          setPassageDestination(null)
          setActiveObjectId(null)
          setFeedback('门已经打开，但通路被挡住了。')
        },
      })
    }
    const collision = mainlinePassageCollisionForNavigation(scene, pending.passage, openNavigationOptions)
    const doorway = mainlinePassageDoorwayForNavigation(scene, pending.passage, openNavigationOptions)
    const exitPoint = mainlinePassageExitPoint(pending.passage, traversalStart, undefined, collision, doorway)
    moveAlong([traversalStart, exitPoint], completeSameSceneLeg, {
      ...locomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, openNavigationOptions)
        || isMainlinePassageInTransitZone(pending.passage, point, undefined, doorway),
      onBlocked: () => {
        pendingTraversalRef.current = null
        setPassageDestination(null)
        setActiveObjectId(null)
        setFeedback('门已经打开，但通路被挡住了。')
      },
    })
  }, [beginPassageLeg, commercialCafeStoryStage, getCurrentPosition, getOpenPassageIds, layout, locomotionOptions, moveAlong, navigationOptions, notifySceneTransition, onDoorEvent, recordSceneState, scene, setFeedback])

  continuePendingTraversalRef.current = continuePendingTraversal

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
  useEffect(() => onFeedbackChange?.(feedback), [feedback, onFeedbackChange])

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
    }
    let frameRetractionStarted = false
    if (framePassage) {
      const movementDurationMs = movementDurationMsForPath(path, getCurrentPosition(), movementOptions)
      frameRetractionStarted = movementDurationMs > 0 && movementDurationMs <= frameMotionBudgetMsRef.current
      if (frameRetractionStarted) armPassageFrameExit(framePassage)
    }
    moveAlong(path, onArrive, {
      ...movementOptions,
      onMove: () => {
        if (!framePassage || frameRetractionStarted) return
        if (getRemainingDurationMs() > frameMotionBudgetMsRef.current) return
        frameRetractionStarted = true
        armPassageFrameExit(framePassage)
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

  const startPassageTraversal = useCallback((passage: MainlineScenePassage, requestedTarget: Point, plannedApproachPath?: Point[] | null, continuationPath?: Point[] | null, passageQueue: readonly MainlineScenePassage[] = [passage], passageIndex = 0) => {
    beginPassageLeg(passage, requestedTarget, plannedApproachPath, continuationPath, passageQueue, passageIndex)
  }, [beginPassageLeg])

  const interact = useCallback((entityId: string) => {
    npcInteractionRequestRef.current += 1
    if (phoneOpen) onPhoneDismiss?.()
    setDialogueLineIndex(null)
    setNpcDialogue(null)
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
        setFeedback('修杰坐下了。')
        const resolution = resolveCommercialCafeNpcInteraction({
          sceneId: scene.id,
          npcId: 'lao-zhou',
          stage: commercialCafeStoryStage,
          playerSeatId: nextSeatId,
        })
        if (resolution?.kind === 'dialogue' && resolution.stateChangeOnDialogueComplete) startNpcDialogue(resolution)
      }, {
        ...locomotionOptions,
        canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
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
      onDoorEvent?.('attempted', passage)
      // A direct door click is an explicit request to use that door. Resolve
      // the opposite side from the same projected doorway used by movement,
      // then let the shared lifecycle open and complete the crossing.
      const collision = mainlinePassageCollisionForNavigation(scene, passage, navigationOptions)
      const doorway = mainlinePassageDoorwayForNavigation(scene, passage, navigationOptions)
      const side = mainlinePassageSide(passage, getCurrentPosition(), collision, doorway)
      startPassageTraversal(passage, passage.crossingTargets[side])
      return
    }

    interactionStartedAtRef.current = Date.now()
    setActiveObjectId(entityId)
    const revealInteraction = () => {
      const interactionStartedAt = interactionStartedAtRef.current
      interactionStartedAtRef.current = null
      onObjectInteraction?.(entity, Math.max(0, Date.now() - (interactionStartedAt ?? Date.now())))
      setExplorationState((current) => {
        const objectIds = current.sceneId === scene.id ? current.objectIds : emptyExplorationObjectIds
        if (objectIds.has(entityId)) return current
        const next = new Set(objectIds)
        next.add(entityId)
        return { sceneId: scene.id, objectIds: next }
      })
      const exploration = resolveMainlineSceneExploration(scene, entity, {
        incensePhase,
        officeBlindsOpen,
        carriedPhoneDevice,
        commercialCafeStoryStage,
      })
      const explorationChoice = exploration.choice
      const explorationPool = exploration.pool
      const availableExplorationPool = explorationPool ?? []
      setFeedback(explorationChoice || explorationPool ? '修杰停在这里。' : scene.interactionText[entity.id] ?? `${mainlineEntityDisplayLabel(entity)}留在原处。`)
      if (explorationChoice || availableExplorationPool.length) {
        const text = explorationChoice?.text ?? availableExplorationPool[Math.floor(Math.random() * availableExplorationPool.length)]
        sceneEchoIdRef.current += 1
        setSceneEcho(createMainlineSceneEcho(
          sceneEchoIdRef.current,
          entity.id,
          text,
          echoPositionNearPlayer(scene, text, getCurrentPosition(), layout, screenMetrics, geometrySnapshot),
          explorationChoice?.options,
        ))
      }
      if (scene.dialogue?.triggerEntityId === entity.id) {
        setDialogueSegmentIndex(0)
        setDialogueLineIndex(0)
      }
    }
    if (isMainlineEntityWithinInteractionRange(scene, entity.id, getCurrentPosition(), layout, navigationOptions)) {
      stopMovement()
      revealInteraction()
      return
    }
    const resolved = findMainlinePathToEntity(scene, entityId, getCurrentPosition(), layout, navigationOptions)
    if (!resolved.path) {
      interactionStartedAtRef.current = null
      stopMovement()
      setFeedback('这个位置暂时走不过去。')
      return
    }
    setFeedback(`修杰前往${mainlineEntityDisplayLabel(entity)}。`)
    moveAlong(resolved.path, revealInteraction, {
      ...locomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
      onBlocked: () => {
        interactionStartedAtRef.current = null
        setActiveObjectId(null)
        setFeedback('修杰在边界前停下了，需要重新选择位置。')
      },
    })
  }, [activePlayerSeatId, carriedPhoneDevice, commercialCafeStoryStage, dismissSceneEcho, geometrySnapshot, getCurrentPosition, incensePhase, layout, leavePlayerSeat, locomotionOptions, moveAlong, navigationOptions, navigationRuntime, officeBlindsOpen, onDoorEvent, onObjectInteraction, onPhoneDismiss, phoneOpen, recordSceneState, resetMovement, scene, screenMetrics, startNpcDialogue, startPassageTraversal, stopMovement])

  const interactNpc = useCallback((npcId: string) => {
    const npc = scene.npcs.find((candidate) => candidate.id === npcId)
    if (!npc) return
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
      stage: commercialCafeStoryStage,
      playerSeatId: activePlayerSeatId,
    })
    if (activePlayerSeatId && seatedResolution?.kind === 'dialogue') {
      stopMovement()
      onNpcInteraction?.(npc.id)
      setFeedback(`修杰来到${npc.label}身边。`)
      startNpcDialogue(seatedResolution)
      return
    }
    leavePlayerSeat()
    const requestId = npcInteractionRequestRef.current + 1
    npcInteractionRequestRef.current = requestId
    const currentPosition = getCurrentPosition()
    const alreadyNearby = isMainlineNpcWithinInteractionRange(scene, npc.id, currentPosition, layout, navigationOptions)
    const completeInteraction = () => {
      if (npcInteractionRequestRef.current !== requestId) return
      setFeedback(`修杰来到${npc.label}身边。`)
      onNpcInteraction?.(npc.id)
      const resolution = resolveCommercialCafeNpcInteraction({
        sceneId: scene.id,
        npcId: npc.id,
        stage: commercialCafeStoryStage,
        playerSeatId: null,
      })
      if (!resolution) return
      if (resolution.kind === 'dialogue') startNpcDialogue(resolution)
      else setFeedback(resolution.feedback)
    }
    if (alreadyNearby) {
      stopMovement()
      completeInteraction()
      return
    }
    const resolved = findMainlinePathToNpc(scene, npc.id, currentPosition, layout, navigationOptions)
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
      onBlocked: () => {
        if (npcInteractionRequestRef.current !== requestId) return
        npcInteractionRequestRef.current += 1
        setFeedback('修杰在接近对方前停下了，需要重新选择位置。')
      },
    })
  }, [activePlayerSeatId, commercialCafeStoryStage, dismissSceneEcho, getCurrentPosition, layout, leavePlayerSeat, locomotionOptions, moveAlong, movingNpcIds, navigationOptions, onNpcInteraction, onPhoneDismiss, phoneOpen, scene, startNpcDialogue, stopMovement])

  const interactAttachedProp = useCallback((propId: string) => {
    const prop = scene.attachedProps.find((candidate) => candidate.id === propId)
    if (!prop) return
    const resolution = resolveCommercialCafeAttachedPropInteraction({ sceneId: scene.id, propId, stage: commercialCafeStoryStage })
    if (!resolution) return
    const reveal = () => {
      if (resolution.kind === 'dialogue') startNpcDialogue(resolution)
      else setFeedback(resolution.feedback)
    }
    const currentPosition = getCurrentPosition()
    const currentSeat = activePlayerSeatId ? scene.objects.find((candidate) => candidate.id === activePlayerSeatId) : undefined
    if (currentSeat?.seat?.tableId === prop.parentEntityId) {
      stopMovement()
      reveal()
      return
    }
    if (isMainlineEntityWithinInteractionRange(scene, prop.interactionTargetEntityId, currentPosition, layout, navigationOptions)) {
      stopMovement()
      reveal()
      return
    }
    const route = findMainlinePathToEntity(scene, prop.interactionTargetEntityId, currentPosition, layout, navigationOptions)
    if (!route.path) {
      setFeedback('这个位置暂时走不过去。')
      return
    }
    moveAlong(route.path, reveal, {
      ...locomotionOptions,
      canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, navigationOptions),
      onBlocked: () => setFeedback('修杰在边界前停下了，需要重新选择位置。'),
    })
  }, [activePlayerSeatId, commercialCafeStoryStage, getCurrentPosition, layout, locomotionOptions, moveAlong, navigationOptions, scene, startNpcDialogue, stopMovement])

  const chooseSceneEchoOption = useCallback((index: number) => {
    const option = sceneEcho?.options?.[index]
    if (!option) return
    const entity = sceneEcho.entityId ? scene.objects.find((candidate) => candidate.id === sceneEcho.entityId) : undefined
    const resolution = resolveMainlineSceneEchoChoice(scene, entity, option, Date.now(), { commercialCafeStoryStage })
    if (!resolution) return
    if (resolution.deskDevice) {
      onDeskInteraction?.(resolution.deskDevice)
      dismissSceneEcho()
      return
    }
      if (resolution.stateChange) recordSceneState(scene.id, resolution.stateChange.key, resolution.stateChange.value)
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
  }, [commercialCafeStoryStage, dismissSceneEcho, onDeskInteraction, recordSceneState, scene, sceneEcho])

  const advanceSceneEcho = useCallback(() => {
    const current = sceneEchoRef.current
    if (!current || current.phase === 'leaving') return
    if (current.segmentIndex + 1 < current.segments.length) {
      const next = {
        ...current,
        segmentIndex: current.segmentIndex + 1,
        text: current.segments[current.segmentIndex + 1] ?? current.text,
      }
      sceneEchoRef.current = next
      setSceneEcho(next)
      return
    }
    if (current.options && current.options.length > 0) return
    dismissSceneEcho()
  }, [dismissSceneEcho])

  const advanceDialogue = useCallback(() => {
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
    if (completedNpcDialogue) {
      const stateChange = completedNpcDialogue.stateChangeOnDialogueComplete
      if (stateChange) recordSceneState(scene.id, stateChange.key, stateChange.value)
    }
  }, [activeDialogue, dialogueLineIndex, dialogueSegmentIndex, npcDialogue, recordSceneState, scene.id])

  const walk = useCallback((point: Point) => {
    npcInteractionRequestRef.current += 1
    if (phoneOpen) {
      onPhoneDismiss?.()
    }
    setDialogueLineIndex(null)
    setNpcDialogue(null)
    dismissSceneEcho()
    setActiveObjectId(null)
    leavePlayerSeat()
    const deniedRegion = resolveMainlineAccessRegionBoundaryTarget(sceneDefinition, point, getCurrentPosition(), navigationOptions)
    if (deniedRegion) {
      const started = moveTo(deniedRegion.target, () => {
        showAccessRegionDeniedText(deniedRegion.region.deniedText ?? '这里暂时不能进入。')
      })
      if (started) setFeedback('修杰走到员工区域外。')
      return
    }
    const route = findMainlineWorldRoute(sceneDefinition, getCurrentPosition(), point, layout, navigationOptions)
    if (route.passage) {
      startPassageTraversal(route.passage, route.requestedTarget, route.approachPath, route.continuationPath, route.passages.length > 0 ? route.passages : [route.passage])
      return
    }
    const walkBounds = mainlineSceneWalkBounds(sceneDefinition, navigationOptions.screenMetrics)
    const outsideScene = point.x < walkBounds.x
      || point.x > walkBounds.x + walkBounds.width
      || point.y < walkBounds.y
      || point.y > walkBounds.y + walkBounds.height
    const started = moveTo(route.target, () => {
      setPassageDestination(null)
      setFeedback('修杰停在这里。')
    }, route.approachPath, route.framePassage)
    if (started) {
      if (outsideScene) setPassageDestination(route.requestedTarget)
      setFeedback('修杰沿着可行空间移动。')
    }
  }, [dismissSceneEcho, getCurrentPosition, layout, leavePlayerSeat, moveTo, navigationOptions, onPhoneDismiss, phoneOpen, sceneDefinition, setFeedback, setDialogueLineIndex, showAccessRegionDeniedText, startPassageTraversal])

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
    resetMovement(initialPosition)
    setFeedback(entryFeedbackForScene(sceneDefinition))
  }, [cancelPassageLifecycle, initialPosition, resetMovement, scene.id, sceneDefinition, setFeedback])

  const currentAreaLabel = mainlineSceneAreaLabel(scene, position)
  const shouldRenderFeedback = !embedded && Boolean(feedback) && (showSceneChrome || feedback !== entryFeedbackForScene(sceneDefinition))
  const cameraOffset = mainlineCameraOffset(scene, position, embedded)

  return (
    <div {...sceneInteractionHandlers} className={`scene-shell mainline-scene ${embedded ? 'mainline-scene--embedded' : ''} ${!showSceneChrome ? 'mainline-scene--map-only' : ''}`} data-mainline-scene={scene.id} data-commercial-cafe-stage={scene.id === 'commercial-cafe' ? commercialCafeStoryStage : undefined} data-commercial-cafe-server-behavior={scene.id === 'commercial-cafe' ? commercialCafeBehavior.getPhase() : undefined} data-debug-cafe-fixture={debugCafeFixture ? 'true' : undefined} data-debug-runtime-evidence={debugRuntimeEvidence ? 'true' : undefined} data-e2e-server-blocker={debugCafeServerBlocker ? 'true' : undefined}>
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
              destination={passageDestination ?? destination}
              layoutMode={layoutMode}
              layout={layout}
              activeObjectId={activeObjectId}
              doorPhases={doorPhases}
              sceneFrameExit={sceneFrameExit}
              gateTriggered={gateTriggered}
              geometrySnapshot={geometrySnapshot}
              onScreenMetricsChange={handleScreenMetricsChange}
              cameraOffset={cameraOffset}
              showProtagonist={showProtagonist}
              onLayoutChange={updateLayout}
              onInteract={interact}
              onNpcInteract={interactNpc}
              onAttachedPropInteract={interactAttachedProp}
              npcPositions={resolvedNpcPositions}
              npcRuntimeSnapshots={npcRuntimeSnapshots}
              onDoorTransitionComplete={completeDoorTransition}
              onWalk={walk}
              dialogue={activeDialogue}
              dialogueLine={activeDialogueLine}
              dialogueText={activeDialogueText}
              dialogueLineIndex={dialogueLineIndex}
              dialogueSegmentIndex={dialogueSegmentIndex}
              dialogueSegmentCount={activeDialogueSegments.length}
              dialoguePosition={activeDialoguePosition}
              onDialogueAdvance={advanceDialogue}
              sceneEcho={sceneEcho}
              onSceneEchoAdvance={advanceSceneEcho}
              onSceneEchoChoice={chooseSceneEchoOption}
              onSceneEchoExitComplete={completeSceneEchoExit}
              onFrameMotionBudgetChange={handleFrameMotionBudgetChange}
              exploredObjectIds={exploredObjectIds}
              incenseLit={incenseLit}
              incenseBurnRemainingMs={incenseRemainingMs}
              onIncenseBurnComplete={() => setIncenseClock(Date.now())}
              commercialCafeStoryStage={commercialCafeStoryStage}
              occupiedSeatIds={occupiedSeatIds}
              playerSeatId={activePlayerSeatId}
              promptedSeatId={promptedSeatId}
              debugRuntimeEvidence={debugRuntimeEvidence}
              debugInput={debugInput}
              debugNpcMovement={debugNpcMovement}
              onDebugNpcMovement={debugNpcMovement ? runDebugServerMovement : undefined}
              debugFeedback={feedback}
              inputDiagnostic={inputDiagnostic}
              onInputDiagnostic={debugInput ? setInputDiagnostic : undefined}
            />
        {!embedded && showSceneChrome && <>
          {shouldRenderFeedback && <div className="scene-feedback" aria-live="polite">{feedback}</div>}
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
        {!showSceneChrome && shouldRenderFeedback && <div className="scene-feedback scene-feedback--overlay" aria-live="polite">{feedback}</div>}
      </main>
    </div>
  )
}
