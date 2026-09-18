'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Point } from './sceneGeometry'
import { MainlineSceneRenderer, type MainlineInputDiagnostic } from './MainlineSceneRenderer'
import { getMainlineSceneEntity, mainlineEntityDisplayLabel, mainlineSceneGeometryUnits, mainlineSceneWalkBounds, mainlineScenes, type MainlineSceneDefinition, type MainlineSceneEntity, type MainlineSceneExternalExit, type MainlineSceneId, type MainlineScenePassage } from './mainlineScenes'
import { findMainlinePath, findMainlinePathThroughPassage, findMainlinePathToEntity, findMainlineWorldRoute, isMainlineEntityWithinInteractionRange, isMainlinePassageInTransitZone, isWalkableMainlinePoint, mainlinePassageCollisionForNavigation, mainlinePassageCrossesToSide, mainlinePassageDoorRegion, mainlinePassageDoorwayForNavigation, mainlinePassageExitPoint, mainlinePassageSide, resolveMainlineSafeEntryPosition, resolveMainlineSafeSpawnPosition } from './mainlineNavigation'
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
import { createMainlineSceneGeometrySnapshot, type MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { splitMainlineInteractionText } from './mainlineTextSegments'

const emptyExternalStoreSubscribe = () => () => undefined
const emptyLayoutSnapshot: SceneLayout = {}
const emptyExplorationObjectIds: ReadonlySet<string> = new Set()
// Keep the incense phase long enough to be revisited during one play session.
const incenseBurnDurationMs = 10 * 60 * 1000
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

type IncenseBurnPhase = 'unlit' | 'fresh' | 'half' | 'burned'

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

function incenseBurnPhase(litAt: number | null, now: number): IncenseBurnPhase {
  if (litAt === null) return 'unlit'
  const elapsed = now - litAt
  if (elapsed >= incenseBurnDurationMs) return 'burned'
  if (elapsed >= incenseBurnDurationMs / 2) return 'half'
  return 'fresh'
}

function incenseExplorationChoice(phase: IncenseBurnPhase) {
  if (phase === 'fresh') return { text: '重新点上了香。' }
  if (phase === 'half') return { text: '重新点上的香已经烧到了一半。' }
  return { text: '香早就烧完了，只剩根部伫立在里面。', options: ['重新点香', '置之不理'] }
}

function shouldRevealWallExplorationInPlace(sceneId: MainlineSceneId, entityId: string) {
  return (sceneId === 'jijia-ancestral-interior' && entityId.startsWith('jijia-portrait-'))
    || (sceneId === 'zhongshuyuan-office' && entityId === 'zhongshuyuan-office-window')
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
  const fontSizePx = Math.max(13, Math.min(16, screenMetrics.width * .011))
  const maxWidthPx = Math.min(screenMetrics.width * .42, Math.max(1, screenMetrics.width - 24))
  const currentLinePx = Math.max(fontSizePx * 4, Array.from(text).length * fontSizePx)
  const widthPx = Math.min(maxWidthPx, currentLinePx)
  const heightPx = fontSizePx * 1.6 + fontSizePx * .8
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
  if (scene.id === 'commercial-street') return '从商业街右侧尾端进入，咖啡馆店面就在右侧。'
  if (scene.id === 'commercial-cafe') return '进入咖啡馆，商业街在身后。'
  if (scene.id === 'yonghe-mining-perimeter') return '从画面下方进入矿区外围，沿中央通道向上，左侧店面深处是永和小馆。'
  if (scene.id === 'yonghe-eatery') return '进入永和小馆，矿区外围老街在身后。'
  if (scene.id === 'jijia-ancestral-interior') return '进入祖宅内堂，前院在身后。'
  if (scene.id === 'zhongshuyuan-passage') return '进入祖宅后方的窄暗道。'
  if (scene.id === 'zhongshuyuan-office') return '进入里世界·中枢院内部楼层，暗道入口在左侧。'
  return `从${scene.title.replace(/^第[一二三]章 · /, '')}入口进入。`
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
  const handledWalkRequestRef = useRef<number | null>(null)
  const [feedback, setFeedback] = useState(entryFeedbackForScene(sceneDefinition))
  const [inputDiagnostic, setInputDiagnostic] = useState<MainlineInputDiagnostic | null>(null)
  const debugInputSearch = useSyncExternalStore(emptyExternalStoreSubscribe, getDebugInputSnapshot, getServerDebugInputSnapshot)
  const debugInput = new URLSearchParams(debugInputSearch).get('debugInput') === '1'
  const [dialogueLineIndex, setDialogueLineIndex] = useState<number | null>(null)
  const [dialogueSegmentIndex, setDialogueSegmentIndex] = useState(0)
  const [sceneEcho, setSceneEcho] = useState<MainlineSceneEcho | null>(null)
  const sceneEchoRef = useRef<MainlineSceneEcho | null>(null)
  const [officeBlindsOpen, setOfficeBlindsOpen] = useState(initialSceneState.blindsOpen !== false)
  const [incenseLitAt, setIncenseLitAt] = useState<number | null>(() => typeof initialSceneState.incenseLitAt === 'number' ? initialSceneState.incenseLitAt : null)
  const [incenseClock, setIncenseClock] = useState(() => Date.now())
  const sceneEchoIdRef = useRef(0)
  const exploredObjectIds = explorationState.sceneId === scene.id ? explorationState.objectIds : emptyExplorationObjectIds
  const incensePhase = scene.id === 'jijia-ancestral-interior'
    ? incenseBurnPhase(incenseLitAt, incenseClock)
    : 'unlit'
  const incenseLit = incensePhase === 'fresh' || incensePhase === 'half'
  const incenseBurnRemainingMs = incenseLitAt === null
    ? 0
    : Math.max(0, incenseBurnDurationMs - (incenseClock - incenseLitAt))
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
  const activeDialogueLine = scene.dialogue && dialogueLineIndex !== null
    ? scene.dialogue.lines[dialogueLineIndex] ?? null
    : null
  const activeDialogueSegments = activeDialogueLine ? splitMainlineInteractionText(activeDialogueLine.text) : []
  const activeDialogueText = activeDialogueSegments[dialogueSegmentIndex] ?? activeDialogueSegments[0] ?? ''
  const internalMovement = useFreeRoamMovement(initialPosition)
  const { position, moving, destination, moveAlong, stopMovement, resetMovement, getCurrentPosition, getRemainingDurationMs } = movementController ?? internalMovement
  const geometrySnapshot = useMemo(() => createMainlineSceneGeometrySnapshot(scene, position, layout, screenMetrics), [layout, position, scene, screenMetrics])
  useEffect(() => {
    pendingTraversalRef.current = null
    setPassageDestination(null)
    setSceneFrameExit({ phase: 'idle' })
    setActiveObjectId(null)
    setExplorationState({ sceneId, objectIds: new Set() })
    setDialogueLineIndex(null)
    setDialogueSegmentIndex(0)
    setSceneEcho(null)
    setOfficeBlindsOpen(initialSceneState.blindsOpen !== false)
    setIncenseLitAt(typeof initialSceneState.incenseLitAt === 'number' ? initialSceneState.incenseLitAt : null)
    setIncenseClock(Date.now())
    stopMovement()
    setFeedback(entryFeedbackForScene(sceneDefinition))
  }, [sceneDefinition, sceneId, stopMovement])
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
  const navigationOptions = useMemo(() => ({ openPassageIds: getOpenPassageIds(), screenMetrics, geometrySnapshot }), [geometrySnapshot, getOpenPassageIds, screenMetrics])
  const locomotionOptions = useMemo(() => ({ screenMetrics, screenSpeedPxPerSecond: 520 }), [screenMetrics])
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
        setFeedback(pending.passage.transitionText)
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
  }, [beginPassageLeg, getCurrentPosition, getOpenPassageIds, layout, locomotionOptions, moveAlong, navigationOptions, notifySceneTransition, onDoorEvent, scene, setFeedback])

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

  const startPassageTraversal = useCallback((passage: MainlineScenePassage, requestedTarget: Point, plannedApproachPath?: Point[] | null, continuationPath?: Point[] | null, passageQueue: readonly MainlineScenePassage[] = [passage], passageIndex = 0) => {
    beginPassageLeg(passage, requestedTarget, plannedApproachPath, continuationPath, passageQueue, passageIndex)
  }, [beginPassageLeg])

  const interact = useCallback((entityId: string) => {
    if (phoneOpen) onPhoneDismiss?.()
    setDialogueLineIndex(null)
    dismissSceneEcho()
    const entity = getMainlineSceneEntity(scene, entityId)
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
      const configuredChoice = scene.explorationChoices?.[entity.id]
      const incenseChoice = scene.id === 'jijia-ancestral-interior' && entity.id === 'jijia-incense-burner'
        ? incenseExplorationChoice(incensePhase)
        : undefined
      const explorationChoice = scene.id === 'zhongshuyuan-office' && entity.id === 'zhongshuyuan-office-desk'
        ? {
          text: scene.explorationText?.[entity.id]?.[0] ?? scene.interactionText[entity.id] ?? '',
          options: [carriedPhoneDevice === 'surface' ? '里世界手机' : '表世界手机'],
        }
        : scene.id === 'zhongshuyuan-office' && entity.id === 'zhongshuyuan-office-window'
          ? {
            text: officeBlindsOpen ? (scene.explorationText?.[entity.id] ?? []).join('\n') : '',
            options: [officeBlindsOpen ? '拉上百叶窗' : '打开百叶窗'],
          }
          : incenseChoice ?? configuredChoice
      const explorationPool = explorationChoice
        ? undefined
        : scene.explorationText?.[entity.id]
        ?? (scene.id === 'jijia-ancestral-home' && entity.id === 'jijia-old-tree' ? scene.echoPool : undefined)
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
    if (shouldRevealWallExplorationInPlace(scene.id, entity.id) && isMainlineEntityWithinInteractionRange(scene, entity.id, getCurrentPosition(), layout, navigationOptions)) {
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
  }, [carriedPhoneDevice, dismissSceneEcho, geometrySnapshot, getCurrentPosition, incensePhase, layout, locomotionOptions, moveAlong, navigationOptions, officeBlindsOpen, onDoorEvent, onObjectInteraction, onPhoneDismiss, phoneOpen, scene, screenMetrics, startPassageTraversal, stopMovement])

  const chooseSceneEchoOption = useCallback((index: number) => {
    const option = sceneEcho?.options?.[index]
    if (!option) return
    if (sceneEcho.entityId === 'zhongshuyuan-office-desk') {
      onDeskInteraction?.(option === '里世界手机' ? 'inner' : 'surface')
      dismissSceneEcho()
      return
    }
    if (sceneEcho.entityId === 'zhongshuyuan-office-window') {
      const open = option === '打开百叶窗'
      setOfficeBlindsOpen(open)
      onPlayerSceneStateChange?.(scene.id, 'blindsOpen', open)
      setSceneEcho((current) => current
        ? {
          ...replaceMainlineSceneEchoText(current, open ? (scene.explorationText?.[current.entityId ?? ''] ?? []).join('\n') : ''),
          options: [open ? '拉上百叶窗' : '打开百叶窗'],
        }
        : null)
      return
    }
    if (sceneEcho.entityId === 'zhongshuyuan-office-plant') {
      setFeedback(option === '浇水' ? '修杰给绿植浇了水。' : '修杰没有理会绿植。')
      setSceneEcho((current) => current ? { ...current, options: undefined } : null)
      return
    }
    if (sceneEcho.entityId === 'jijia-incense-burner') {
      if (option === '重新点香') {
        const litAt = Date.now()
        setIncenseLitAt(litAt)
        setIncenseClock(litAt)
        onPlayerSceneStateChange?.(scene.id, 'incenseLitAt', litAt)
        setFeedback('修杰重新点上了香。')
        setSceneEcho((current) => current ? { ...replaceMainlineSceneEchoText(current, '重新点上了香。'), options: undefined } : null)
      }
      else {
        setFeedback('修杰没有理会香炉。')
        setSceneEcho((current) => current ? { ...current, options: undefined } : null)
      }
      return
    }
    setFeedback(option === '重新点香' ? '修杰重新点上了香。' : '修杰没有理会香炉。')
    setSceneEcho((current) => current ? { ...current, options: undefined } : null)
  }, [dismissSceneEcho, onDeskInteraction, onPlayerSceneStateChange, scene, sceneEcho])

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
    if (dialogueLineIndex === null || !scene.dialogue) return
    const segments = splitMainlineInteractionText(scene.dialogue.lines[dialogueLineIndex]?.text ?? '')
    if (dialogueSegmentIndex + 1 < segments.length) {
      setDialogueSegmentIndex((current) => current + 1)
      return
    }
    setDialogueSegmentIndex(0)
    setDialogueLineIndex(dialogueLineIndex + 1 < scene.dialogue.lines.length ? dialogueLineIndex + 1 : null)
  }, [dialogueLineIndex, dialogueSegmentIndex, scene.dialogue])

  const walk = useCallback((point: Point) => {
    if (phoneOpen) {
      onPhoneDismiss?.()
    }
    setDialogueLineIndex(null)
    dismissSceneEcho()
    setActiveObjectId(null)
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
  }, [dismissSceneEcho, getCurrentPosition, layout, moveTo, navigationOptions, onPhoneDismiss, phoneOpen, sceneDefinition, setFeedback, setDialogueLineIndex, startPassageTraversal])

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
    setSceneEcho(null)
    setIncenseLitAt(null)
    setIncenseClock(Date.now())
    cancelPassageLifecycle('protagonist')
    setPassageDestination(null)
    resetMovement(initialPosition)
    setFeedback(entryFeedbackForScene(sceneDefinition))
  }, [cancelPassageLifecycle, initialPosition, resetMovement, scene.id, sceneDefinition, setFeedback])

  const currentAreaLabel = scene.id === 'jijia-ancestral-home'
    ? '前院'
    : scene.id === 'jijia-ancestral-interior'
      ? '祖宅内堂'
      : scene.id === 'commercial-street'
        ? position.x >= 140 ? '商业街尾端' : scene.statusLabel
        : scene.id === 'commercial-cafe'
          ? '咖啡馆'
          : scene.id === 'yonghe-mining-perimeter'
            ? position.y >= 150 ? '矿区' : position.y >= 100 ? '矿区外围' : position.y <= 70 ? '永和小馆门口' : '矿区外围老街'
            : scene.id === 'yonghe-eatery'
              ? '永和小馆'
            : scene.id === 'zhongshuyuan-passage'
              ? '中枢院窄暗道'
              : scene.id === 'zhongshuyuan-office'
                ? '中枢院办公室'
                : scene.statusLabel
  const shouldRenderFeedback = !embedded && Boolean(feedback) && (showSceneChrome || feedback !== entryFeedbackForScene(sceneDefinition))
  const cameraOffset = mainlineCameraOffset(scene, position, embedded)

  return (
    <div {...sceneInteractionHandlers} className={`scene-shell mainline-scene ${embedded ? 'mainline-scene--embedded' : ''} ${!showSceneChrome ? 'mainline-scene--map-only' : ''}`} data-mainline-scene={scene.id}>
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
              onDoorTransitionComplete={completeDoorTransition}
              onWalk={walk}
              dialogue={scene.dialogue}
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
              incenseBurnRemainingMs={incenseBurnRemainingMs}
              onIncenseBurnComplete={() => setIncenseClock(Date.now())}
              debugInput={debugInput}
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
