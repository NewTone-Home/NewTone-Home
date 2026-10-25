'use client'

import { Fragment, memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { MainlineCounterSurface } from './MainlineCounterSurface'
import EntryButtonSurface from '../../components/EntryButtonSurface'
import type { CollisionBox, Point } from './sceneGeometry'
import { mainlineCanonicalSceneGeometryUnits, mainlineSceneGeometryUnits, mainlineStorefrontAnchor, mainlineStorefrontApproach, type MainlineSceneDefinition, type MainlineSceneEntity, type MainlineSceneGeometryUnit } from './mainlineScenes'
import type { MainlineSceneDialogueLine, MainlineSceneDialoguePresentation } from './mainlineSceneModel'
import { mainlineActiveSpatialSpaceId, mainlineEntityIsPublicStreetContent, mainlineEntityMatchesCurrentPresentation, mainlinePublicStreetPresentationIsActive } from './mainlineSceneModel'
import { mainlineGeometryCellWithinViewport, mainlineGeometryUnitShouldRender } from './mainlineSceneVisibility'
import { clampMainlineLayoutAnchor, mainlineEntityFontSizePx, mainlineEntityVisualBounds, mainlineLabelFootprint, mainlineLayoutAnchor, mainlineLayoutItemForEntity, snapDelta, snapPoint, type LayoutItemId, type SceneLayout } from './sceneLayout'
import type { MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { SceneCharacters, SceneCharacterSwitch } from './SceneCharacters'
import { SceneDoor, type SceneDoorTransitionCompletion } from './SceneDoor'
import { sceneDoorIsVisuallyOpen, type SceneDoorRuntimePhase } from './sceneDoorConfig'
import { mainlineWorldFontSizePx, sceneDesignReferenceMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { readMainlineViewportMetrics, type MainlineViewportMetrics } from './mainlineViewportProjection'
import { commercialStreetHorizontalScale, projectCommercialStreetX } from './commercialStreetGridProjection'
import { mainlineWorldPointFromClient, mainlineWorldScale, mainlineVisibleWorldSpan } from './mainlineViewport'
import { advanceCommercialStreetQuestionCameraHandoff, commercialStreetQuestionCameraHandoffSettled } from './commercialStreetQuestionCameraHandoff'
import { useSceneFocusFrameController } from './SceneFocusFrames'
import { sceneFrameDefaultMotionMs } from './sceneMotion'
import { sceneFrameExitRequestsTarget, type SceneFrameTarget } from './sceneFrameLifecycle'
import type { SceneFocusFrameMotionProfile } from './sceneFrameExitSchedule'
import { mainlineEchoLayout, mainlineSpeakerAnchor, type MainlineEchoLayout } from './mainlineEchoLayout'
import { interpolateMainlineReadingLayout, mainlineReadingLayoutTransitionProgress, mainlineReadingLayoutsHaveSameSize, mainlineReadingPageTransitionDurationMs } from './mainlineReadingLayoutTransition'
import { mainlineDialogueReadingSessionKey, mainlineReadingAnchorContextKey as createReadingAnchorContextKey, mainlineReadingAnchorForSession, mainlineReadingPresentationForPhase, type MainlineReadingPresentationSnapshot } from './mainlineReadingPresentation'
import { DialogueSpeaker } from './DialogueSpeaker'
import { mainlineVisiblePresentationText } from './dialoguePresentation'
import { resolveMainlineNpcPosition } from './mainlineNavigation'
import { storefrontRoomConnection } from './storefrontRoomConnection'
import { isMainlineSeatLabelSuppressed, isMainlineSeatPrompted, mainlineProtagonistPresentation, mainlineSceneOccupiedSeatIds, mainlineSeatedActorVisualPosition, mainlineNpcVisualSeatId } from './mainlineSeating'
import type { NpcRuntimeSnapshot } from './npcCore'
import { resolveMainlineInteractionVisualState } from './mainlineInteractionVisualState'
import { activeStorefrontInteriorOwner, storefrontCellVisualState, storefrontCharacterCells, storefrontCharacterProgress, storefrontRollDirection, storefrontLabelRollDurationMs, storefrontPresentationRetractsFrame, storefrontDoorFrameShouldRetract, storefrontGeometryCellShouldRender, storefrontInteriorFeatureOpacity, type StorefrontPresentationPhase } from './storefrontPresentation'
import { commercialStreetStorefrontInteractionFor } from './commercialStreetStorefrontInteractions'
import type { StorefrontContactGeometry } from './storefrontContactGeometry'
import { storefrontContactGeometry } from './storefrontContactGeometry'
import { mainlineAvailableReadingWidthPx, mainlineMaximumReadingWidthPx, mainlineReadingActorOpacity, mainlineReadingCameraOffset, mainlineReadingEnvelopeNeedsCameraPan, mainlineReadingOpacityForActor, mainlineObservationTypingIntervalMs, mainlineReadingFadeTransitionMs, resolveMainlineDialogueParticipants } from './mainlineTextReading'
import { centerReadingDimmerTargets, centerReadingDimmerTransitionDurationMs } from './readingDimmer'
import { mainlineSceneRenderBounds } from './mainlineSceneRenderBounds'
import { currentMainlineReadingTargetIds, mainlineFitReadingText, mainlinePlaceReadingAction, mainlinePlaceReadingBox, mainlineReadingMaskRects, mainlineReadingOverflowPageForSession, mainlineReadingOverflowPageIndex } from './mainlineReadingProtection'
import { MainlineReadingOcclusionMask } from './MainlineReadingOcclusionMask'
import { MainlineReadingIdentityPlane } from './MainlineReadingIdentityPlane'
import { mainlineReadingLocalPercent, mainlineReadingOcclusionFadeWorldPx, mainlineReadingOcclusionMaskRegion, mainlineReadingOcclusionRect, mainlineReadingWorldBox, retainMainlineReadingOcclusionSnapshot } from './mainlineReadingOcclusion'

type MainlineSceneRendererProps = {
  scene: MainlineSceneDefinition
  position: Point
  moving: boolean
  destination: Point | null
  layoutMode: boolean
  layout: SceneLayout
  activeObjectId: string | null
  doorPhases?: ReadonlyMap<string, SceneDoorRuntimePhase>
  sceneFrameExit?: { phase: 'idle' | 'retracting'; passageEntityId?: string; scope?: 'passage' | 'scene'; requestedGroups?: readonly string[] }
  storefrontPresentation?: ReadonlyMap<string, StorefrontPresentationPhase>
  activeStorefrontId?: string | null
  visibleInteriorStorefrontIds?: readonly string[]
  paintedInteriorStorefrontId?: string | null
  onStorefrontFrameRetractionComplete?: (storefrontId: string) => void
  onStorefrontRevealMotionComplete?: (storefrontId: string) => void
  onStorefrontRestoreMotionComplete?: (storefrontId: string) => void
  gateTriggered?: boolean
  geometrySnapshot: MainlineSceneGeometrySnapshot
  freezeFrameMeasurements?: boolean
  onScreenMetricsChange?: (metrics: MainlineViewportMetrics) => void
  viewportMetrics: SceneScreenMetrics
  cameraOffset: Point
  showProtagonist?: boolean
  suppressWorldEnterAnimation?: boolean
  onLayoutChange: (itemId: LayoutItemId, point: Point) => void
  onInteract: (id: string) => void
  onStorefrontInteract?: (storefrontId: string) => void
  onNpcInteract?: (npcId: string) => void
  npcPositions?: ReadonlyMap<string, Point>
  npcRuntimeSnapshots?: ReadonlyMap<string, NpcRuntimeSnapshot>
  hiddenNpcIds?: ReadonlySet<string>
  ambientNpcActorLayer?: ReactNode
  onDoorTransitionComplete?: (entityId: string, completion: SceneDoorTransitionCompletion) => void
  onWalk: (point: Point) => void
  worldQuestionMark?: { anchor: Point; visible: boolean }
  dialogue?: MainlineSceneDialoguePresentation
  dialogueLine?: MainlineSceneDialogueLine | null
  dialogueText?: string
  dialogueLineIndex?: number | null
  dialogueSegmentIndex?: number
  dialogueSegmentCount?: number
  dialoguePosition?: Point | null
  dialoguePhase?: 'active' | 'leaving'
  readingMode?: 'observation' | 'dialogue' | null
  onDialogueExitComplete?: () => void
  onDialogueAdvance?: () => void
  sceneEcho?: { id: number; entityId?: string; text: string; segments: readonly string[]; segmentIndex: number; position: Point; options?: readonly string[]; typing: boolean; phase?: 'leaving' } | null
  onSceneEchoAdvance?: () => void
  onSceneEchoTypingComplete?: (echoId: number) => void
  onSceneEchoExitComplete?: (echoId: number, displayPosition: Point, displayCameraOffset: Point) => void
  sceneAction?: { entityId?: string; options: readonly string[]; position: Point; cameraOffset?: Point; phase?: 'active' | 'committing' } | null
  onSceneActionStart?: (index: number) => void
  onSceneActionChoice?: (index: number) => void
  carriedMilkTea?: boolean
  onMilkTeaInteract?: () => void
  onFrameMotionProfileChange?: (profile: readonly SceneFocusFrameMotionProfile[]) => void
  exploredObjectIds?: ReadonlySet<string>
  interactionTutorialCompleted?: boolean
  debugInput?: boolean
  debugNpcMovement?: boolean
  onDebugNpcMovement?: () => void
  inputDiagnostic?: MainlineInputDiagnostic | null
  onInputDiagnostic?: (diagnostic: MainlineInputDiagnostic) => void
  incenseLit?: boolean
  incenseBurnRemainingMs?: number
  onIncenseBurnComplete?: () => void
  occupiedSeatIds?: ReadonlySet<string>
  playerSeatId?: string | null
  promptedSeatId?: string | null
  /** DEV/e2e-only geometry evidence. It never participates in scene behavior. */
  debugRuntimeEvidence?: boolean
  /** Preview-only, read-only café geometry overlay. */
  debugCafeSpatialQaEnabled?: boolean
  debugCafeSpatialQa?: {
    requestedTarget: Point
    resolvedNavigableTarget: Point
    path: readonly Point[]
    reachedRequestedTarget: boolean
    deniedAccessRegionId?: string
  } | null
}

type RetainedReadingOcclusion = {
  sessionKey: string
  rect: CollisionBox
  region: CollisionBox
  protectedEntityIds: ReadonlySet<string>
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export type MainlineInputDiagnostic = {
  source: 'click' | 'touch'
  pointerType: string
  client: Point
  rect: { left: number; top: number; width: number; height: number }
  screenPoint: Point
  mappedPoint: Point
  target: string
}

function objectVisibility(entity: MainlineSceneEntity, layoutMode: boolean) {
  if (layoutMode) return 'is-near'
  if (entity.visualVisibility === 'static') return 'is-static'
  // Proximity is no longer a visual highlight. Objects keep their authored
  // baseline state until interaction activates them; storefront geometry is
  // the only remaining distance-driven visual variant.
  return 'is-baseline'
}

export function mainlineEntityUsesBreathing(_scene: MainlineSceneDefinition, entity: MainlineSceneEntity, incenseLit = false) {
  const isIncense = entity.visualProfile === 'incense'
  return (entity.visualProfile === 'tree-ring' && entity.interactive !== false)
    || isIncense && incenseLit
    || entity.animationGroup === 'office-breathing'
}

function objectClass(scene: MainlineSceneDefinition, entity: MainlineSceneEntity, visibility: string, active: boolean, explored: boolean, tutorialCompleted: boolean, underPlayer: boolean, selected: boolean, dragging: boolean, incenseLit: boolean, readingProtected = false) {
  const isOfferingTable = entity.kind === 'table' && scene.furnitureGroups.some((group) => group.layout === 'altar-ring' && group.entityIds.includes(entity.id))
  const isIncense = entity.visualProfile === 'incense'
  const tutorialEligible = mainlineEntityUsesBreathing(scene, entity, incenseLit)
  const interactionVisualState = entity.interactive === false
    ? null
    : resolveMainlineInteractionVisualState({
      active: active && !readingProtected,
      dynamic: isIncense && incenseLit,
      explored: explored && !readingProtected,
      tutorialCompleted,
      tutorialEligible,
    })
  return [
    'scene-object',
    'scene-mainline-object',
    `scene-mainline-object--${entity.kind}`,
    entity.facing ? `scene-mainline-object--facing-${entity.facing}` : '',
    `scene-object--${entity.weight}`,
    entity.visualProfile === 'tree-ring' ? 'scene-mainline-yard-tree-ring' : '',
    interactionVisualState === 'tutorial-unexplored' ? 'scene-mainline-exploration--breathing' : '',
    interactionVisualState ? `scene-mainline-interaction--${interactionVisualState}` : '',
    entity.kind === 'table' ? 'scene-mainline-exploration--steady' : '',
    isOfferingTable ? 'scene-mainline-altar-table' : '',
    isIncense && incenseLit ? 'scene-mainline-incense--lit' : '',
    isIncense && incenseLit ? 'scene-mainline-incense--burning' : '',
    isIncense && !incenseLit ? 'scene-mainline-incense--unlit' : '',
    visibility,
    active && !readingProtected ? 'is-active' : '',
    underPlayer ? 'is-under-player' : '',
    selected ? 'is-layout-selected' : '',
    dragging ? 'is-layout-dragging' : '',
  ].filter(Boolean).join(' ')
}

type MainlineFocusPolicy = 'interactive' | 'passage' | 'gate'

type MainlineGeometryCellEntry = {
  unit: MainlineSceneGeometryUnit
  cell: MainlineSceneGeometryUnit['visual']['cells'][number]
  entityId?: string
  focusGroup: string
  focusPolicy: MainlineFocusPolicy
  storefrontInteractionId?: string
}

function unionWorldBounds(boxes: readonly CollisionBox[], padding = 0): CollisionBox {
  const left = Math.min(...boxes.map(box => box.x))
  const top = Math.min(...boxes.map(box => box.y))
  const right = Math.max(...boxes.map(box => box.x + box.width))
  const bottom = Math.max(...boxes.map(box => box.y + box.height))
  return { x: left - padding, y: top - padding, width: right - left + padding * 2, height: bottom - top + padding * 2 }
}

function cellGlyphWorldBounds(cell: MainlineSceneGeometryUnit['visual']['cells'][number], horizontalScale = 1): CollisionBox {
  const x = cell.x / 100 * sceneDesignReferenceMetrics.width
  const y = cell.y / 100 * sceneDesignReferenceMetrics.height
  const width = cell.kind === 'door' ? 42 : mainlineWorldFontSizePx / Math.max(.01, horizontalScale)
  return { x: x - width / 2, y: y - mainlineWorldFontSizePx / 2, width, height: mainlineWorldFontSizePx }
}

function localPointInWorldBounds(point: Point, bounds: CollisionBox) {
  return mainlineReadingLocalPercent(point, bounds)
}

type MainlineDoorButtonProps = {
  cell: MainlineGeometryCellEntry['cell']
  entityId: string
  className: string
  style: CSSProperties
  doorLabel: string
  glyph: string
  doorPhase: SceneDoorRuntimePhase
  focusGroup: string
  frameGroup?: string
  focusPolicy: Exclude<MainlineFocusPolicy, 'interactive'>
  gateTriggered: boolean
  frameRetracting: boolean
  active: boolean
  closeHint: string
  ariaLabel: string
  renderFocusFrame: (group: string, presentationActive?: boolean) => ReactNode
  presentationActive?: boolean
  presentationDurationMs?: number
  onInteract: (id: string) => void
  onDoorTransitionComplete?: (entityId: string, completion: SceneDoorTransitionCompletion) => void
  dataAttributes?: Record<string, string | undefined>
  characterPresentation?: ReactNode
}

type MainlineAmbientNpcActorProps = {
  sceneId: MainlineSceneDefinition['id']
  npc: MainlineSceneDefinition['npcs'][number]
  position: Point
  snapshot: NpcRuntimeSnapshot
  screenMetrics: SceneScreenMetrics
  debugRuntimeEvidence: boolean
  readingOpacity?: number
  readingProtected?: boolean
}

/** Ambient locomotion owns its live point; this component only projects it into the scene. */
function MainlineAmbientNpcActorView({ sceneId, npc, position, snapshot, screenMetrics, debugRuntimeEvidence, readingOpacity = 1, readingProtected = false }: MainlineAmbientNpcActorProps) {
  const visualFootprint = mainlineLabelFootprint(npc.label, position, screenMetrics, { lineHeight: 1 })
  const effectiveReadingOpacity = readingProtected ? 1 : readingOpacity
  return <span
    className={`scene-mainline-npc scene-mainline-npc--ambient ${effectiveReadingOpacity < 1 ? 'is-reading-through' : ''} ${readingProtected ? 'is-reading-protected' : ''}`}
    style={{
      left: `${position.x}%`,
      top: `${position.y}%`,
      filter: effectiveReadingOpacity < 1 ? `opacity(${effectiveReadingOpacity})` : undefined,
      zIndex: readingProtected ? 11 : effectiveReadingOpacity < 1 ? 15 : undefined,
      transition: `filter ${mainlineReadingFadeTransitionMs}ms linear`,
      '--scene-mainline-object-font-size': `${mainlineEntityFontSizePx(null, screenMetrics)}px`,
    } as CSSProperties}
    data-actor-id={npc.id}
    data-npc-role={npc.roleId}
    data-npc-id={npc.id}
    data-npc-phase={snapshot.phase}
    data-npc-duty-id={snapshot.dutyId ?? undefined}
    data-npc-target-id={snapshot.targetId ?? undefined}
    data-npc-target-x={debugRuntimeEvidence ? snapshot.target?.x : undefined}
    data-npc-target-y={debugRuntimeEvidence ? snapshot.target?.y : undefined}
    data-runtime-x={debugRuntimeEvidence ? position.x : undefined}
    data-runtime-y={debugRuntimeEvidence ? position.y : undefined}
    data-rendered-x={debugRuntimeEvidence ? sceneId === 'commercial-street' ? projectCommercialStreetX(position.x, screenMetrics) : position.x : undefined}
    data-rendered-y={debugRuntimeEvidence ? position.y : undefined}
    data-visual-x={debugRuntimeEvidence ? visualFootprint.x : undefined}
    data-visual-y={debugRuntimeEvidence ? visualFootprint.y : undefined}
    data-visual-width={debugRuntimeEvidence ? visualFootprint.width : undefined}
    data-visual-height={debugRuntimeEvidence ? visualFootprint.height : undefined}
    aria-hidden="true"
  ><span className="scene-mainline-npc__grid-content">{npc.label}</span></span>
}

export const MainlineAmbientNpcActor = memo(MainlineAmbientNpcActorView)

function ReadingPageFlip({ pageKey, text, children, mode, onFlipComplete }: { pageKey: string; text: string; children: React.ReactNode; mode: 'observation' | 'dialogue'; onFlipComplete?: () => void }) {
  const [page, setPage] = useState<{ key: string; text: string; previousText: string | null; flipping: boolean }>({ key: pageKey, text, previousText: null, flipping: false })
  const onFlipCompleteRef = useRef(onFlipComplete)
  onFlipCompleteRef.current = onFlipComplete
  useIsomorphicLayoutEffect(() => {
    setPage(current => current.key === pageKey
      ? current
      : { key: pageKey, text, previousText: current.text, flipping: true })
  }, [pageKey, text])
  useEffect(() => {
    if (!page.flipping && page.key === pageKey) onFlipCompleteRef.current?.()
  }, [page.flipping, page.key, pageKey])

  const finishFlip = (event: React.AnimationEvent<HTMLSpanElement>) => {
    if (event.target !== event.currentTarget || !page.flipping || event.animationName !== 'mainline-reading-page-open') return
    setPage(current => current.key === pageKey ? { ...current, previousText: null, flipping: false } : current)
  }

  return <span className={`scene-mainline-page-stack scene-mainline-page-stack--${mode}`} data-page-flip={page.flipping ? 'running' : 'settled'}>
    {page.flipping && page.previousText !== null && <span className="scene-mainline-page scene-mainline-page--outgoing" aria-hidden="true">{page.previousText}</span>}
    <span
      className={`scene-mainline-page ${page.flipping ? 'scene-mainline-page--incoming' : 'scene-mainline-page--current'}`}
      data-reading-page-role={page.flipping ? 'incoming' : 'current'}
      onAnimationEnd={finishFlip}
    >{children}</span>
  </span>
}

function ObservationText({ echoId, pageKey, text, typing, onTypingComplete, onFlipComplete }: { echoId: number; pageKey: string; text: string; typing: boolean; onTypingComplete?: (echoId: number) => void; onFlipComplete?: () => void }) {
  const characters = useMemo(() => Array.from(mainlineVisiblePresentationText(text)), [text])
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    setVisibleCount(0)
    if (!typing || characters.length === 0) {
      setVisibleCount(characters.length)
      return
    }
    let frame = 0
    let startedAt: number | null = null
    const advance = (now: number) => {
      startedAt ??= now
      const next = Math.min(characters.length, Math.floor((now - startedAt) / mainlineObservationTypingIntervalMs) + 1)
      setVisibleCount((current) => current === next ? current : next)
      if (next < characters.length) frame = window.requestAnimationFrame(advance)
      else onTypingComplete?.(echoId)
    }
    frame = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frame)
  }, [characters, echoId, onTypingComplete, typing])

  return <span className="scene-mainline-text__observation" data-scene-text-mode="observation">
    <ReadingPageFlip pageKey={pageKey} text={text} mode="observation" onFlipComplete={onFlipComplete}>
      {characters.slice(0, visibleCount).join('')}
    </ReadingPageFlip>
  </span>
}

function DialogueText({ group, pageKey, text, onReadyChange, onFlipComplete }: { group: string; pageKey: string; text: string; onReadyChange?: (group: string, ready: boolean) => void; onFlipComplete?: () => void }) {
  useIsomorphicLayoutEffect(() => onReadyChange?.(group, false), [group, onReadyChange])
  return <span
    className="scene-mainline-text__dialogue"
    data-scene-text-mode="dialogue"
  >
    <ReadingPageFlip pageKey={pageKey} text={text} mode="dialogue" onFlipComplete={() => { onFlipComplete?.(); onReadyChange?.(group, true) }}>
      {mainlineVisiblePresentationText(text)}
    </ReadingPageFlip>
  </span>
}

type ReadingLayoutTransitionMode = 'active' | 'leaving' | 'inactive'

function useMainlineReadingLayoutTransition(
  mode: ReadingLayoutTransitionMode,
  continuityKey: string | null,
  pageKey: string | null,
  target: MainlineEchoLayout | null,
) {
  const [displayedLayout, setDisplayedLayout] = useState<MainlineEchoLayout | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const frameRef = useRef<number | null>(null)
  const currentRef = useRef<{ mode: ReadingLayoutTransitionMode; continuityKey: string; pageKey: string; layout: MainlineEchoLayout } | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null

    if (mode === 'inactive' || !target || !continuityKey || !pageKey) {
      currentRef.current = null
      setDisplayedLayout(null)
      setTransitioning(false)
      return
    }

    if (mode === 'leaving') {
      if (currentRef.current) {
        currentRef.current = { ...currentRef.current, mode: 'leaving' }
        setDisplayedLayout(currentRef.current.layout)
      }
      setTransitioning(false)
      return
    }

    const previous = currentRef.current
    if (!previous || previous.continuityKey !== continuityKey) {
      currentRef.current = { mode: 'active', continuityKey, pageKey, layout: target }
      setDisplayedLayout(target)
      setTransitioning(false)
      return
    }

    const from = previous.layout
    currentRef.current = { mode: 'active', continuityKey, pageKey, layout: from }
    if (mainlineReadingLayoutsHaveSameSize(from, target)) {
      currentRef.current = { mode: 'active', continuityKey, pageKey, layout: target }
      setDisplayedLayout(target)
      setTransitioning(false)
      return
    }

    setDisplayedLayout(from)
    setTransitioning(true)
    const startedAt = performance.now()
    const advance = (now: number) => {
      const progress = mainlineReadingLayoutTransitionProgress(now - startedAt)
      const next = interpolateMainlineReadingLayout(from, target, progress)
      currentRef.current = { mode: 'active', continuityKey, pageKey, layout: next }
      setDisplayedLayout(next)
      if (progress >= 1) {
        frameRef.current = null
        currentRef.current = { mode: 'active', continuityKey, pageKey, layout: target }
        setTransitioning(false)
        return
      }
      frameRef.current = window.requestAnimationFrame(advance)
    }
    frameRef.current = window.requestAnimationFrame(advance)
  }, [continuityKey, mode, pageKey, target?.fontSizePx, target?.heightPx, target?.widthPx])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  return { layout: displayedLayout ?? target, transitioning }
}

function MainlineDoorButton({ cell, entityId, className, style, doorLabel, glyph, doorPhase, focusGroup, frameGroup, focusPolicy, gateTriggered, frameRetracting, active, closeHint, ariaLabel, renderFocusFrame, presentationActive, presentationDurationMs = sceneFrameDefaultMotionMs, onInteract, onDoorTransitionComplete, dataAttributes, characterPresentation }: MainlineDoorButtonProps) {
  const resolvedFrameGroup = frameGroup ?? focusGroup
  const visualOpen = sceneDoorIsVisuallyOpen(cell.doorBehavior, doorPhase)
  const animatedInterior = presentationActive !== undefined
  const visualStyle = { opacity: presentationActive === false ? 0 : 1, transition: `opacity ${presentationDurationMs}ms ease-in-out` }
  const restoredWallStyle = { position: 'absolute' as const, inset: 0, opacity: presentationActive === false ? 1 : 0, transition: `opacity ${presentationDurationMs}ms ease-in-out`, pointerEvents: 'none' as const }
  return (
    <button
      className={`${className} scene-mainline-door-button ${visualOpen ? 'is-open' : ''} ${active ? 'is-active' : ''}`}
      type="button"
      style={{ ...style, pointerEvents: presentationActive === false ? 'none' : style.pointerEvents }}
      disabled={presentationActive === false}
      tabIndex={presentationActive === false ? -1 : undefined}
      aria-hidden={presentationActive === false ? true : undefined}
      onClick={(event) => { event.stopPropagation(); onInteract(entityId) }}
      aria-label={`${ariaLabel}；${closeHint}`}
      data-focus-target-id={cell.id}
      data-focus-target-group={resolvedFrameGroup}
      data-focus-target-policy={focusPolicy}
      data-focus-passage-phase={focusPolicy === 'passage' ? doorPhase : undefined}
      data-focus-passage-retracting={frameRetracting ? 'true' : undefined}
      data-focus-gate-triggered={focusPolicy === 'gate' ? gateTriggered : undefined}
      {...dataAttributes}
    >
      {animatedInterior && <span className="scene-mainline-door-button__restored-wall" style={restoredWallStyle} aria-hidden="true"><SceneCharacters>{cell.baselineGlyph ?? '墙'}</SceneCharacters></span>}
      {animatedInterior
        ? <span style={visualStyle} aria-hidden={presentationActive === false}><SceneDoor phase={doorPhase} behavior={cell.doorBehavior} label={doorLabel} glyph={glyph} visualGroup={focusGroup} characters={characterPresentation} onTransitionComplete={(completion) => onDoorTransitionComplete?.(entityId, completion)} /></span>
        : <SceneDoor phase={doorPhase} behavior={cell.doorBehavior} label={doorLabel} glyph={glyph} visualGroup={focusGroup} characters={characterPresentation} onTransitionComplete={(completion) => onDoorTransitionComplete?.(entityId, completion)} />}
      {renderFocusFrame(resolvedFrameGroup, presentationActive)}
    </button>
  )
}

/** The facade is a presentation of its authored cells, not a second doorway.
 * One clock updates all windows; the original button/SceneDoor owns input. */
function PortalStorefrontCharacters({ scene, storefront, cells, phase, doorPhase, screenMetrics, renderFrame, onInteract, onStorefrontInteract, onDoorTransitionComplete, onMotionComplete, frameRetracting, coordinateBounds }: {
  scene: MainlineSceneDefinition
  storefront: MainlineSceneDefinition['storefronts'][number]
  cells: ReturnType<typeof storefrontCharacterCells>
  phase: StorefrontPresentationPhase
  doorPhase: SceneDoorRuntimePhase
  screenMetrics: SceneScreenMetrics
  renderFrame: (group: string) => ReactNode
  onInteract: (id: string) => void
  onStorefrontInteract?: (storefrontId: string) => void
  onDoorTransitionComplete?: MainlineDoorButtonProps['onDoorTransitionComplete']
  onMotionComplete: (phase: 'revealing' | 'restoring') => void
  frameRetracting: boolean
  coordinateBounds: CollisionBox
}) {
  const host = useRef<HTMLDivElement>(null)
  const progress = useRef(0)
  const completed = useRef(onMotionComplete)
  completed.current = onMotionComplete
  const entity = scene.objects.find(object => object.id === storefront.portalId)!
  const largeGroup = `storefront:${storefront.id}:baseline`
  const doorGroup = `door:${entity.id}`
  const hasMultipleDoorCells = cells.filter(cell => cell.role === 'door').length > 1
  const direction = storefrontRollDirection(storefront.edge)
  useIsomorphicLayoutEffect(() => {
    const node = host.current
    if (!node) return
    const target = ['revealing', 'revealed', 'lingering'].includes(phase) ? 1 : 0
    const paint = (value: number) => {
      progress.current = value
      node.style.setProperty('--character-progress', String(value))
      node.dataset.characterProgress = value.toFixed(4)
    }
    const from = progress.current
    if (Math.abs(target - from) < .001) { paint(target); return }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { paint(target); completed.current(target > from ? 'revealing' : 'restoring'); return }
    const duration = storefrontLabelRollDurationMs * Math.abs(target - from)
    node.dataset.characterMotionDuration = String(duration)
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      paint(storefrontCharacterProgress(from, target, now - started, duration))
      if (now - started < duration) frame = requestAnimationFrame(tick)
      else completed.current(target > from ? 'revealing' : 'restoring')
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])
  return <div ref={host} className="scene-portal-characters" data-storefront-id={storefront.id}
    data-storefront-label-phase={phase} data-focus-target-group={largeGroup} data-focus-target-policy="passage"
    style={{ '--roll-x': direction.x, '--roll-y': direction.y } as CSSProperties}>
    {cells.map(cell => {
      const cellDoorGroup = cell.role === 'door' && hasMultipleDoorCells
        ? storefrontDoorFocusGroup({ ...cell, storefrontId: storefront.id }, undefined, true)
        : doorGroup
      const characters = <SceneCharacterSwitch before={cell.baselineGlyph} after={cell.glyph} beforeGroup={largeGroup} afterGroup={cell.role === 'door' ? cellDoorGroup : undefined} beforeOffsetPx={{ x: ((cell.baselineX ?? cell.x) - cell.x) * screenMetrics.width / 100, y: ((cell.baselineY ?? cell.y) - cell.y) * screenMetrics.height / 100 }} />
      const attributes = { 'data-storefront-cell-id': cell.id, 'data-storefront-presentation-phase': phase }
      const local = localPointInWorldBounds({ x: cell.x, y: cell.y }, coordinateBounds)
      const style = { left: `${local.x}%`, top: `${local.y}%` }
      const closeHint = cell.access === 'locked' ? (cell.lockedText ?? '当前权限不足') : '接近时自动开门，进入门洞后继续路线'
      if (cell.role === 'door') return <MainlineDoorButton key={cell.id}
        cell={{ ...cell, kind: 'door', doorBehavior: entity.doorBehavior }} entityId={entity.id}
        className="scene-spatial-glyph scene-mainline-wall scene-mainline-wall-door is-baseline"
        style={style} doorLabel={entity.displayLabel ?? entity.label} glyph={cell.glyph} doorPhase={doorPhase}
        focusGroup={doorGroup}
        frameGroup={cellDoorGroup}
        focusPolicy="passage" gateTriggered={false} frameRetracting={frameRetracting}
        active={false} closeHint={closeHint} ariaLabel={cell.access === 'locked' ? `门，${closeHint}` : '门，点击门后目标会在接近时自动开门并穿过'}
        renderFocusFrame={renderFrame} onInteract={onInteract} onDoorTransitionComplete={onDoorTransitionComplete}
        dataAttributes={attributes} characterPresentation={characters} />
      return <span key={cell.id} className="scene-spatial-glyph scene-mainline-wall is-baseline" style={style} {...attributes} aria-hidden="true">{characters}</span>
    })}
    {renderFrame(largeGroup)}
  </div>
}

/** A facade wall cap is ordinary masonry, not a worn shop sign. */
function storefrontMaterialClass(sceneId: string, style: string | undefined, role: string) {
  const mining = sceneId === 'yonghe-mining-perimeter' || sceneId === 'yonghe-eatery'
  return mining && role === 'wall' ? 'scene-mainline-wall--ordinary' : `scene-mainline-storefront--${style ?? 'modern'}`
}

function storefrontFocusGroup(cell: MainlineGeometryCellEntry['cell'], variant?: MainlineSceneGeometryUnit['variant']) {
  const variantSuffix = variant ? `:${variant}` : ''
  return `storefront:${cell.storefrontId ?? cell.id}${variantSuffix}`
}

function storefrontDoorFocusGroup(cell: { id: string; x: number; y: number; storefrontId?: string }, variant?: MainlineSceneGeometryUnit['variant'], independentCell = false) {
  const variantSuffix = variant ? `:${variant}` : ''
  if (independentCell) return `storefront-door:${cell.storefrontId ?? cell.id}:cell:${cell.x.toFixed(4)}:${cell.y.toFixed(4)}`
  return `storefront-door:${cell.storefrontId ?? cell.id}${variantSuffix}`
}

function mainlineCellFocusTarget(scene: MainlineSceneDefinition, cell: MainlineGeometryCellEntry['cell'], entityId?: string, variant?: MainlineSceneGeometryUnit['variant']) {
  if (cell.kind === 'feature' && cell.featureCellRole === 'flank') return undefined
  if (cell.kind === 'storefront' && cell.storefrontRole === 'sign') {
    return {
      group: storefrontFocusGroup(cell, variant),
      policy: commercialStreetStorefrontInteractionFor(cell.storefrontId ?? '') && !scene.storefronts.some(storefront => storefront.id === cell.storefrontId && storefront.portalId) ? 'interactive' as const : 'passage' as const,
      storefrontInteractionId: commercialStreetStorefrontInteractionFor(cell.storefrontId ?? '') && !scene.storefronts.some(storefront => storefront.id === cell.storefrontId && storefront.portalId) ? cell.storefrontId : undefined,
    }
  }
  if (cell.kind === 'storefront' && cell.storefrontRole === 'door' && entityId) {
    const storefront = scene.storefronts.find(candidate => candidate.id === cell.storefrontId)
    const independentCell = ((storefront?.composition?.near ?? []).filter(role => role === 'door').length) > 1
    return { group: storefrontDoorFocusGroup(cell, variant, independentCell), policy: 'passage' as const }
  }
  if (cell.kind === 'door' && entityId) {
    const gatePart = cell.doorLabelPart
    return gatePart
      ? { group: `gate:${entityId}:${gatePart}`, policy: 'gate' as const }
      : { group: `door:${entityId}`, policy: 'passage' as const }
  }
  if (cell.kind !== 'feature' || !entityId) return undefined
  const entity = scene.objects.find((candidate) => candidate.id === entityId)
  const directWallFeature = entity?.interactionBehavior === 'direct-wall'
  if (!entity || (entity.interactive === false && !directWallFeature)) return undefined
  return { group: `interactive:${cell.featureId ?? entityId}`, policy: 'interactive' as const }
}

function mainlineWallCellVisibility(scene: MainlineSceneDefinition, cell: MainlineGeometryCellEntry['cell'], unit: MainlineSceneGeometryUnit) {
  if (cell.kind === 'wall') return 'is-baseline'
  if (cell.kind === 'storefront') {
    const storefrontId = cell.storefrontId ?? unit.storefrontId
    const storefront = storefrontId ? scene.storefronts.find(candidate => candidate.id === storefrontId) : undefined
    return storefrontCellVisualState(storefront, unit.variant, cell.storefrontRole) === 'near' ? 'is-near' : 'is-baseline'
  }
  return (cell.baselineVisible ?? cell.baseline ?? true) ? 'is-baseline' : 'is-hidden'
}

export function MainlineFocusGroup({ entries, className, visibilityClass, renderFrame, onInteract, onStorefrontInteract, interactionEntityId, storefrontInteractionId, ariaLabel, passagePhase, gateTriggered, frameRetracting = false, hideGlyphs = false, storefrontId, storefrontSpan, storefrontCenter, storefrontLabel, storefrontGeometry, storefrontPresentationPhase = 'baseline', active = false, explored = false, interiorPresentationActive, presentationDurationMs = sceneFrameDefaultMotionMs, suppressInteractionEmphasis = false }: {
  entries: readonly MainlineGeometryCellEntry[]
  className: string
  visibilityClass: string
  renderFrame: (group: string, presentationActive?: boolean) => ReactNode
  onInteract?: (id: string) => void
  onStorefrontInteract?: (storefrontId: string) => void
  interactionEntityId?: string
  storefrontInteractionId?: string
  ariaLabel?: string
  passagePhase?: string
  gateTriggered?: boolean
  frameRetracting?: boolean
  hideGlyphs?: boolean
  storefrontId?: string
  storefrontSpan?: number
  storefrontCenter?: Point
  storefrontLabel?: string
  storefrontGeometry?: StorefrontContactGeometry
  storefrontPresentationPhase?: StorefrontPresentationPhase
  active?: boolean
  explored?: boolean
  interiorPresentationActive?: boolean
  presentationDurationMs?: number
  suppressInteractionEmphasis?: boolean
}) {
  const first = entries[0]
  if (!first) return null
  const xs = entries.map(({ cell }) => cell.x)
  const ys = entries.map(({ cell }) => cell.y)
  const vertical = first.cell.layoutOrientation
    ? first.cell.layoutOrientation === 'vertical'
    : first.cell.orientation === 'vertical'
      || (entries.length > 1 && Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const cellAxisStart = (cell: MainlineGeometryCellEntry['cell']) => cell.cellStart ?? (vertical ? cell.y : cell.x)
  const cellAxisEnd = (cell: MainlineGeometryCellEntry['cell']) => cell.cellEnd ?? (vertical ? cell.y : cell.x)
  const cellRangeStart = Math.min(...entries.map(({ cell }) => cellAxisStart(cell)))
  const cellRangeEnd = Math.max(...entries.map(({ cell }) => cellAxisEnd(cell)))
  const cellRangeCenter = (cellRangeStart + cellRangeEnd) / 2
  const centerX = vertical ? (minX + maxX) / 2 : cellRangeCenter
  const centerY = vertical ? cellRangeCenter : (minY + maxY) / 2
  const span = Math.max(.001, cellRangeEnd - cellRangeStart)
  const contentExtent = `${span}%`
  const style: CSSProperties = vertical
    ? { left: `${centerX}%`, top: `${centerY}%`, width: '1em', height: `${span}%` }
    : { left: `${centerX}%`, top: `${centerY}%`, width: contentExtent, height: '1.2em' }
  if (storefrontLabel && storefrontSpan && storefrontCenter && storefrontGeometry) {
    const textExtent = Array.from(storefrontLabel).length * 1.08 + .7
    Object.assign(style, vertical
      ? { left: `${centerX}%`, top: `${centerY}%`, width: '1.4em', height: `min(${textExtent}em, calc(${span}% - .15em))` }
      : { left: `${centerX}%`, top: `${centerY}%`, width: `min(${textExtent}em, calc(${span}% - .15em))`, height: '1.4em' })
  }
  if (storefrontGeometry) {
    const { center, visualBounds, fontSizePx } = storefrontGeometry
    Object.assign(style, { left: `${center.x}%`, top: `${center.y}%`, width: `${visualBounds.width}%`, height: `${visualBounds.height}%`, fontSize: `${fontSizePx}px` })
  }
  const glyphs = entries.map(({ cell }) => cell.glyph ?? '')
  const content = hideGlyphs ? null : storefrontLabel ? (
    <span className="scene-mainline-storefront__label-slot" data-storefront-label-slot="true" data-storefront-id={storefrontId} data-storefront-label-phase={storefrontPresentationPhase} style={{ '--storefront-label-length': Array.from(storefrontLabel).length * 1.08 } as CSSProperties}>
      <span className="scene-mainline-storefront__label-track">
        <span className="scene-mainline-storefront__label-text"><SceneCharacters data-focus-visual-group={first.focusGroup}>{storefrontLabel}</SceneCharacters></span>
      </span>
    </span>
  ) : glyphs.map((glyph, index) => {
    const cell = entries[index]?.cell
    if (!cell) return null
    const offset = vertical ? ((cell.y - centerY) / Math.max(.001, span)) * 100 + 50 : ((cell.x - centerX) / Math.max(.001, span)) * 100 + 50
    return <span key={cell.id} data-focus-visual-group={first.focusGroup} className="scene-mainline-focus-group__glyph" style={{ left: vertical ? '50%' : offset + '%', top: vertical ? offset + '%' : '50%' }} aria-hidden="true"><SceneCharacters className="scene-mainline-focus-group__glyph-visual">{glyph}</SceneCharacters></span>
  })
  const commonProps = {
    className: `scene-mainline-focus-group ${className} ${visibilityClass} scene-mainline-interaction--${resolveMainlineInteractionVisualState({ active: active && !suppressInteractionEmphasis, explored: explored && !suppressInteractionEmphasis, tutorialCompleted: true, tutorialEligible: false })}`,
    style: { ...style, pointerEvents: interiorPresentationActive === false ? 'none' : style.pointerEvents },
    'data-interior-active': interiorPresentationActive === undefined ? undefined : interiorPresentationActive ? 'true' : 'false',
    'data-focus-target-id': first.cell.id,
    'data-focus-target-group': first.focusGroup,
    'data-focus-target-policy': first.focusPolicy,
    'data-focus-passage-phase': first.focusPolicy === 'passage' ? passagePhase : undefined,
    'data-focus-passage-retracting': frameRetracting ? 'true' : undefined,
    'data-focus-gate-triggered': first.focusPolicy === 'gate' ? gateTriggered : undefined,
  }
  const presentedContent = interiorPresentationActive === undefined
    ? content
    : <span className="scene-mainline-focus-group__content" style={{ position: 'absolute', inset: 0, opacity: interiorPresentationActive ? 1 : 0, transition: `opacity ${presentationDurationMs}ms ease-in-out`, pointerEvents: 'none' }}>{content}</span>
  if (first.focusPolicy === 'interactive' && interactionEntityId && onInteract) {
    return <button {...commonProps} type="button" disabled={interiorPresentationActive === false} tabIndex={interiorPresentationActive === false ? -1 : undefined} onClick={(event) => { event.stopPropagation(); onInteract(interactionEntityId) }} aria-label={ariaLabel}>{presentedContent}{renderFrame(first.focusGroup, interiorPresentationActive)}</button>
  }
  if (first.focusPolicy === 'interactive' && storefrontInteractionId && onStorefrontInteract) {
    return <button {...commonProps} type="button" disabled={interiorPresentationActive === false} tabIndex={interiorPresentationActive === false ? -1 : undefined} onClick={(event) => { event.stopPropagation(); onStorefrontInteract(storefrontInteractionId) }} aria-label={ariaLabel}>{presentedContent}{renderFrame(first.focusGroup, interiorPresentationActive)}</button>
  }
  return <span {...commonProps} aria-hidden="true">{presentedContent}{renderFrame(first.focusGroup, interiorPresentationActive)}</span>
}

function MainlineObject({ entity, scene, position, visualPosition, collision, focusGroup, renderFrame, visibility, active, explored, tutorialCompleted, underPlayer, layoutMode, selected, dragging, screenMetrics, incenseLit, incenseBurnRemainingMs, onIncenseBurnComplete, onStartLayoutDrag, onSelectLayoutItem, onInteract, breathingAnimationDelay, sharedBreathingClock, registerBreathingNode, suppressLabel = false, prompted = false, debugRuntimeEvidence = false, interiorPresentationActive, presentationDurationMs = sceneFrameDefaultMotionMs, readingProtected = false }: {
  entity: MainlineSceneEntity
  scene: MainlineSceneDefinition
  position: Point
  visualPosition?: Point
  collision?: CollisionBox
  visualBounds?: CollisionBox | null
  focusGroup?: string
  renderFrame?: (group: string, presentationActive?: boolean) => ReactNode
  visibility: string
  active: boolean
  explored: boolean
  tutorialCompleted: boolean
  underPlayer: boolean
  layoutMode: boolean
  selected: boolean
  dragging: boolean
  screenMetrics: SceneScreenMetrics
  incenseLit: boolean
  incenseBurnRemainingMs: number
  onIncenseBurnComplete?: () => void
  onStartLayoutDrag: (itemId: LayoutItemId, event: React.PointerEvent<HTMLElement>) => void
  onSelectLayoutItem: (itemId: LayoutItemId) => void
  onInteract: (id: string) => void
  breathingAnimationDelay?: string
  sharedBreathingClock?: boolean
  registerBreathingNode?: (entityId: string, node: HTMLSpanElement | null) => void
  suppressLabel?: boolean
  prompted?: boolean
  debugRuntimeEvidence?: boolean
  interiorPresentationActive?: boolean
  presentationDurationMs?: number
  readingProtected?: boolean
}) {
  const layoutItemId = mainlineLayoutItemForEntity(scene, entity.id)
  const className = objectClass(scene, entity, visibility, active, explored, tutorialCompleted, underPlayer, selected, dragging, incenseLit, readingProtected)
  const visualScale = entity.visualScale ?? 1
  // Focus emphasis follows the visible label/glyph's typography, never the
  // object's collision or authored spatial envelope.
  const focusContent = Boolean(focusGroup)
  const renderedPosition = visualPosition ?? position
  const presentedInterior = interiorPresentationActive !== false
  const commonProps = {
    className: `${className} ${readingProtected ? 'is-reading-protected-target' : ''} ${layoutItemId ? 'scene-object--layout-draggable' : ''} ${suppressLabel ? 'is-occupied' : ''} ${prompted ? 'is-story-prompted' : ''}`,
    style: {
      left: `${renderedPosition.x}%`,
      top: `${renderedPosition.y}%`,
      boxSizing: 'border-box',
      '--incense-burn-remaining': `${incenseBurnRemainingMs}ms`,
      '--scene-mainline-object-font-size': `${mainlineEntityFontSizePx(entity, screenMetrics)}px`,
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: 'translate(-50%, -50%)',
      opacity: presentedInterior ? 1 : 0,
      pointerEvents: presentedInterior ? undefined : 'none',
      transition: interiorPresentationActive === undefined ? undefined : `opacity ${presentationDurationMs}ms ease-in-out`,
    } as CSSProperties,
    'data-object-id': entity.id,
    'data-focus-target-id': focusGroup ? entity.id : undefined,
    'data-focus-target-group': focusGroup,
    'data-focus-target-policy': focusGroup ? 'interactive' : undefined,
    'data-layout-item-id': layoutItemId ?? undefined,
    'data-story-seat-prompt': prompted ? 'true' : undefined,
    'data-rendered-x': debugRuntimeEvidence ? scene.id === 'commercial-street' ? projectCommercialStreetX(position.x, screenMetrics) : position.x : undefined,
    'data-rendered-y': debugRuntimeEvidence ? position.y : undefined,
    'data-collision-x': debugRuntimeEvidence && collision ? collision.x : undefined,
    'data-collision-y': debugRuntimeEvidence && collision ? collision.y : undefined,
    'data-collision-width': debugRuntimeEvidence && collision ? collision.width : undefined,
    'data-collision-height': debugRuntimeEvidence && collision ? collision.height : undefined,
    'data-seat-table-id': debugRuntimeEvidence ? entity.seat?.tableId : undefined,
    'data-seat-side': debugRuntimeEvidence ? entity.seat?.side : undefined,
  }
  const labelStyle = {
    '--scene-exploration-animation-delay': breathingAnimationDelay,
    writingMode: entity.textLayout === 'vertical' ? 'vertical-rl' : undefined,
    textOrientation: entity.textLayout === 'vertical' ? 'upright' : undefined,
    lineHeight: entity.textLayout === 'vertical' ? 1 : undefined,
    transform: visualScale === 1 ? undefined : `scale(${visualScale})`,
  } as CSSProperties
  // Paint-only breathing belongs above the measured text subtree. Updating
  // the label's style would notify every focus-frame character observer.
  const paintRef = useCallback((node: HTMLSpanElement | null) => {
    if (!sharedBreathingClock || !registerBreathingNode) return
    registerBreathingNode(entity.id, node)
  }, [entity.id, registerBreathingNode, sharedBreathingClock])
  const frame = focusGroup && renderFrame
    ? focusContent
      ? <span
          className="scene-mainline-object__focus-host scene-mainline-object__focus-host--content"
          style={{
            left: `${renderedPosition.x}%`,
            top: `${renderedPosition.y}%`,
            fontSize: `${mainlineEntityFontSizePx(entity, screenMetrics) * visualScale}px`,
            opacity: 1,
          }}
          aria-hidden="true"
        >{renderFrame(focusGroup, interiorPresentationActive)}</span>
      : renderFrame(focusGroup, interiorPresentationActive)
    : null

  if (entity.interactive === false) {
    return <>{focusContent && frame}<span {...commonProps} aria-hidden="true">{!suppressLabel && <span className="scene-mainline-object__grid-content" ref={paintRef}><SceneCharacters className="scene-mainline-object__label" style={labelStyle} data-focus-visual-group={focusGroup}>{entity.label}</SceneCharacters></span>}{!focusContent && frame}</span></>
  }

  return (
    <>
      {focusContent && frame}
      <button
      {...commonProps}
      type="button"
      disabled={!presentedInterior}
      tabIndex={presentedInterior ? undefined : -1}
      aria-label={layoutMode && layoutItemId ? `${entity.label}，拖动摆设套件` : `${entity.label}，点击让主角前往互动`}
      onPointerDown={(event) => {
        if (layoutMode && layoutItemId) onStartLayoutDrag(layoutItemId, event)
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (layoutMode) {
          if (layoutItemId) onSelectLayoutItem(layoutItemId)
          return
        }
        onInteract(entity.id)
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'scene-incense-burn-lifecycle') onIncenseBurnComplete?.()
      }}
    >
      {!suppressLabel && <span className="scene-mainline-object__grid-content" ref={paintRef}><SceneCharacters className="scene-mainline-object__label" style={labelStyle} data-focus-visual-group={focusGroup}>{entity.label}</SceneCharacters></span>}
      {!focusContent && frame}
      </button>
    </>
  )
}

const MemoMainlineObject = memo(MainlineObject)

type MainlineNpcActorProps = {
  sceneId: MainlineSceneDefinition['id']
  npc: MainlineSceneDefinition['npcs'][number]
  position: Point
  snapshot?: NpcRuntimeSnapshot
  seatId?: string
  seatPosition?: Point
  screenMetrics: SceneScreenMetrics
  interactive: boolean
  presentationActive?: boolean
  readingOpacity?: number
  readingProtected?: boolean
  debugRuntimeEvidence: boolean
  onInteract?: (npcId: string) => void
}

function MainlineNpcActor({ sceneId, npc, position, snapshot, seatId, seatPosition, screenMetrics, interactive, presentationActive = true, readingOpacity = 1, readingProtected = false, debugRuntimeEvidence, onInteract }: MainlineNpcActorProps) {
  const visualPosition = mainlineSeatedActorVisualPosition(position, seatId, seatPosition)
  const visualFootprint = mainlineLabelFootprint(npc.label, visualPosition, screenMetrics, { lineHeight: 1 })
  const effectiveReadingOpacity = readingProtected ? 1 : readingOpacity
  const className = `scene-mainline-npc ${interactive ? '' : 'scene-mainline-npc--ambient'} ${effectiveReadingOpacity < 1 ? 'is-reading-through' : ''} ${readingProtected ? 'is-reading-protected' : ''}`
  const style = {
    left: `${visualPosition.x}%`,
    top: `${visualPosition.y}%`,
    opacity: presentationActive ? 1 : 0,
    pointerEvents: presentationActive ? undefined : 'none',
    filter: effectiveReadingOpacity < 1 ? `opacity(${effectiveReadingOpacity})` : undefined,
    zIndex: readingProtected ? 11 : effectiveReadingOpacity < 1 ? 15 : undefined,
    transition: `opacity ${sceneFrameDefaultMotionMs}ms ease-in-out, filter ${mainlineReadingFadeTransitionMs}ms linear`,
    '--scene-mainline-object-font-size': `${mainlineEntityFontSizePx(null, screenMetrics)}px`,
  } as CSSProperties
  const attributes = {
    className,
    style,
    'data-actor-id': npc.id,
    'data-npc-role': npc.roleId,
    'data-npc-id': npc.id,
    'data-seat-entity-id': seatId,
    'data-interaction-target-entity-id': npc.interactionTargetEntityId,
    'data-npc-phase': snapshot?.phase,
    'data-npc-duty-id': snapshot?.dutyId ?? undefined,
    'data-npc-target-id': snapshot?.targetId ?? undefined,
    'data-npc-target-x': debugRuntimeEvidence ? snapshot?.target?.x : undefined,
    'data-npc-target-y': debugRuntimeEvidence ? snapshot?.target?.y : undefined,
    'data-runtime-x': debugRuntimeEvidence ? position.x : undefined,
    'data-runtime-y': debugRuntimeEvidence ? position.y : undefined,
    'data-rendered-x': debugRuntimeEvidence ? sceneId === 'commercial-street' ? projectCommercialStreetX(visualPosition.x, screenMetrics) : visualPosition.x : undefined,
    'data-rendered-y': debugRuntimeEvidence ? visualPosition.y : undefined,
    'data-visual-x': debugRuntimeEvidence ? visualFootprint.x : undefined,
    'data-visual-y': debugRuntimeEvidence ? visualFootprint.y : undefined,
    'data-visual-width': debugRuntimeEvidence ? visualFootprint.width : undefined,
    'data-visual-height': debugRuntimeEvidence ? visualFootprint.height : undefined,
  }
  return interactive
    ? <button {...attributes} type="button" disabled={!presentationActive} tabIndex={presentationActive ? undefined : -1} onClick={(event) => { event.stopPropagation(); onInteract?.(npc.id) }} aria-label={`${npc.label}，点击让主角前往互动`}><span className="scene-mainline-npc__grid-content"><SceneCharacters>{npc.label}</SceneCharacters></span></button>
    : <span {...attributes} aria-hidden="true"><span className="scene-mainline-npc__grid-content"><SceneCharacters>{npc.label}</SceneCharacters></span></span>
}

const MemoMainlineNpcActor = memo(MainlineNpcActor)

export function MainlineSceneRenderer({
  scene,
  position,
  moving,
  destination,
  layoutMode,
  layout,
  activeObjectId,
  doorPhases = new Map(),
  sceneFrameExit = { phase: 'idle' },
  storefrontPresentation = new Map(),
  activeStorefrontId = null,
  visibleInteriorStorefrontIds = [],
  paintedInteriorStorefrontId = null,
  onStorefrontFrameRetractionComplete,
  onStorefrontRevealMotionComplete,
  onStorefrontRestoreMotionComplete,
  onScreenMetricsChange,
  viewportMetrics,
  cameraOffset,
  gateTriggered = false,
  showProtagonist = true,
  suppressWorldEnterAnimation = false,
  geometrySnapshot,
  freezeFrameMeasurements = false,
  onLayoutChange,
  onInteract,
  onStorefrontInteract,
  onNpcInteract,
  npcPositions,
  npcRuntimeSnapshots,
  hiddenNpcIds,
  ambientNpcActorLayer,
  onDoorTransitionComplete,
  onWalk,
  worldQuestionMark,
  dialogue,
  dialogueLine = null,
  dialogueText = '',
  dialogueLineIndex = null,
  dialogueSegmentIndex = 0,
  dialogueSegmentCount = 1,
  dialoguePosition = null,
  dialoguePhase = 'active',
  readingMode = null,
  onDialogueExitComplete,
  onDialogueAdvance,
  sceneEcho = null,
  onSceneEchoAdvance,
  onSceneEchoTypingComplete,
  onSceneEchoExitComplete,
  sceneAction = null,
  onSceneActionStart,
  onSceneActionChoice,
  carriedMilkTea = false,
  onMilkTeaInteract,
  onFrameMotionProfileChange,
  exploredObjectIds = new Set(),
  interactionTutorialCompleted = false,
  debugInput = false,
  debugNpcMovement = false,
  onDebugNpcMovement,
  inputDiagnostic = null,
  onInputDiagnostic,
  incenseLit = false,
  incenseBurnRemainingMs = 0,
  onIncenseBurnComplete,
  occupiedSeatIds: runtimeOccupiedSeatIds,
  playerSeatId = null,
  promptedSeatId = null,
  debugCafeSpatialQaEnabled = false,
  debugCafeSpatialQa = null,
  debugRuntimeEvidence = false,
}: MainlineSceneRendererProps) {
  const readingMaskId = `mainline-reading-mask-${useId().replace(/:/g, '')}`
  const readingOcclusionMaskId = `mainline-reading-occlusion-${useId().replace(/:/g, '')}`
  const [dialogueReady, setDialogueReady] = useState(false)
  const [readingOverflowPage, setReadingOverflowPage] = useState<import('./mainlineReadingProtection').MainlineReadingOverflowPageState>(null)
  const readingPageAdvanceLockedRef = useRef(false)
  const readingPageAdvanceLockTimerRef = useRef<number | null>(null)
  const typingCompletionLockRef = useRef(false)
  const releaseReadingPageAdvance = useCallback(() => {
    readingPageAdvanceLockedRef.current = false
    if (readingPageAdvanceLockTimerRef.current !== null) window.clearTimeout(readingPageAdvanceLockTimerRef.current)
    readingPageAdvanceLockTimerRef.current = null
  }, [])
  const lockReadingPageAdvance = useCallback(() => {
    readingPageAdvanceLockedRef.current = true
    if (readingPageAdvanceLockTimerRef.current !== null) window.clearTimeout(readingPageAdvanceLockTimerRef.current)
    readingPageAdvanceLockTimerRef.current = window.setTimeout(releaseReadingPageAdvance, mainlineReadingPageTransitionDurationMs + 240)
  }, [releaseReadingPageAdvance])
  useEffect(() => () => releaseReadingPageAdvance(), [releaseReadingPageAdvance])
  const [retainedReadingOcclusion, setRetainedReadingOcclusion] = useState<RetainedReadingOcclusion | null>(null)
  const [activeReadingOcclusionSession, setActiveReadingOcclusionSession] = useState<string | null>(null)
  const readingOcclusionExitTimerRef = useRef<number | null>(null)
  const readingOcclusionExitStartedAtRef = useRef<number | null>(null)
  const readingOcclusionEntryRafRef = useRef<number | null>(null)
  const speakerPlacementRef = useRef<{ session: string; metrics: string; anchor: ReturnType<typeof mainlineSpeakerAnchor> } | null>(null)
  if (!dialogue || !dialogueLine || !dialoguePosition || sceneEcho) speakerPlacementRef.current = null
  const dialogueReadyGroupRef = useRef<string | null>(null)
  const currentDialogueGroupRef = useRef<string | null>(null)
  const dialogueAdvanceConsumedGroupRef = useRef<string | null>(null)
  const retainedReadingPresentationRef = useRef<MainlineReadingPresentationSnapshot | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const stableViewportRef = useRef<HTMLSpanElement>(null)
  const dimmerRef = useRef<HTMLDivElement>(null)
  const altarBreathingNodesRef = useRef(new Map<string, HTMLSpanElement>())
  const registerBreathingNode = useCallback((entityId: string, node: HTMLSpanElement | null) => {
    if (node) altarBreathingNodesRef.current.set(entityId, node)
    else altarBreathingNodesRef.current.delete(entityId)
  }, [])
  const altarLeaderIds = useMemo(() => new Set(scene.altars.map((altar) => altar.incenseBurnerId)), [scene.altars])
  const occupiedSeatIds = useMemo(() => runtimeOccupiedSeatIds ?? mainlineSceneOccupiedSeatIds(scene), [runtimeOccupiedSeatIds, scene])
  const protagonistPresentation = mainlineProtagonistPresentation(playerSeatId)
  const updateDialogueReady = useCallback((group: string, ready: boolean) => {
    if (ready) dialogueReadyGroupRef.current = group
    else if (dialogueReadyGroupRef.current === group) dialogueReadyGroupRef.current = null
    setDialogueReady(ready)
  }, [])
  const protagonistVisualPosition = mainlineSeatedActorVisualPosition(
    position,
    playerSeatId,
    playerSeatId ? geometrySnapshot.objects.get(playerSeatId)?.position : undefined,
  )
  const cafeSpatialQa = scene.id === 'commercial-cafe' && debugCafeSpatialQaEnabled
  const cafeQaCounter = cafeSpatialQa ? scene.continuousStructures?.find((structure) => structure.id === 'commercial-cafe-counter-body') : undefined
  const cafeQaStaffArea = cafeSpatialQa ? scene.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area') : undefined
  const cafeQaAccessBoundary = cafeSpatialQa ? geometrySnapshot.navigationBarriers.find((barrier) => barrier.id === 'commercial-cafe-staff-right-access-boundary') : undefined
  const cafeQaBackDoor = cafeSpatialQa ? geometrySnapshot.passages.get('cafe-back-door') : undefined
  const hasAltarBreathing = incenseLit && scene.objects.some((entity) => entity.visualProfile === 'incense')
  useIsomorphicLayoutEffect(() => {
    const dimmer = dimmerRef.current
    if (!dimmer) return
    const currentOpacity = Number(getComputedStyle(dimmer).opacity)
    const targetOpacity = readingMode ? centerReadingDimmerTargets[readingMode] : 0
    dimmer.getAnimations().forEach((animation) => animation.cancel())
    dimmer.style.opacity = String(currentOpacity)
    const duration = centerReadingDimmerTransitionDurationMs(
      currentOpacity,
      targetOpacity,
      readingMode ? centerReadingDimmerTargets[readingMode] : currentOpacity,
    )
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (duration <= 0.5 || reducedMotion) {
      dimmer.style.opacity = String(targetOpacity)
      return
    }
    const animation = dimmer.animate(
      [{ opacity: currentOpacity }, { opacity: targetOpacity }],
      { duration, easing: 'linear', fill: 'forwards' },
    )
    animation.onfinish = () => {
      if (dimmerRef.current !== dimmer) return
      dimmer.style.opacity = String(targetOpacity)
      animation.cancel()
    }
  }, [readingMode])
  useEffect(() => {
    if (!hasAltarBreathing || typeof window === 'undefined') return undefined
    const startedAt = performance.now()
    let frameId = 0
    const tick = (now: number) => {
      const cycle = ((now - startedAt) % 2800) / 2800
      altarBreathingNodesRef.current.forEach((node, entityId) => {
        const offset = altarLeaderIds.has(entityId) ? .5 : 0
        const phase = (cycle + offset) % 1
        const progress = (1 - Math.cos(phase * Math.PI * 2)) / 2
        node.style.setProperty('--scene-breathing-progress', progress.toFixed(4))
      })
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [altarLeaderIds, hasAltarBreathing])
  const hasOfficeBreathing = scene.objects.some((entity) => entity.animationGroup === 'office-breathing')
  const synchronizedBreathingDelay = useMemo(() => {
    if (!hasOfficeBreathing) return undefined
    const now = typeof performance === 'undefined' ? 0 : performance.now()
    return `${-(now % 2800)}ms`
  }, [hasOfficeBreathing])
  const [draggingItemId, setDraggingItemId] = useState<LayoutItemId | null>(null)
  const [selectedLayoutItemId, setSelectedLayoutItemId] = useState<LayoutItemId | null>(null)
  const dragRef = useRef<{ itemId: LayoutItemId; pointerId: number; startPointer: Point; startAnchor: Point; moved: boolean } | null>(null)
  const suppressNextLayoutStageClickRef = useRef(false)
  useIsomorphicLayoutEffect(() => {
    const stage = stageRef.current
    const stableViewport = stableViewportRef.current
    if (!stage || !stableViewport) return undefined
    const reportMetrics = () => {
      const metrics = readMainlineViewportMetrics(stage, stableViewport)
      if (!metrics) return
      onScreenMetricsChange?.(metrics)
    }
    reportMetrics()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reportMetrics)
    observer?.observe(stage)
    observer?.observe(stableViewport)
    let dpiQuery: MediaQueryList | undefined
    const watchDpi = () => {
      dpiQuery?.removeEventListener('change', onDpiChange)
      dpiQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      dpiQuery.addEventListener('change', onDpiChange)
    }
    const onDpiChange = () => {
      reportMetrics()
      watchDpi()
    }
    watchDpi()
    window.addEventListener('resize', reportMetrics)
    window.visualViewport?.addEventListener('resize', reportMetrics)
    return () => {
      observer?.disconnect()
      dpiQuery?.removeEventListener('change', onDpiChange)
      window.removeEventListener('resize', reportMetrics)
      window.visualViewport?.removeEventListener('resize', reportMetrics)
    }
  }, [onScreenMetricsChange])

  // The page owns the stage measurement and passes the same snapshot to
  // navigation and rendering. Keeping one authority prevents a responsive
  // stage from projecting visible cells with one size while navigation tests
  // collision against another.
  const renderScreenMetrics = geometrySnapshot.screenMetrics
  const horizontalGridScale = scene.id === 'commercial-street' ? commercialStreetHorizontalScale(renderScreenMetrics) : 1
  const sceneRenderBounds = useMemo(
    () => mainlineSceneRenderBounds(scene, geometrySnapshot.layout, renderScreenMetrics, horizontalGridScale),
    [geometrySnapshot.layout, horizontalGridScale, renderScreenMetrics, scene],
  )
  const worldScale = mainlineWorldScale(viewportMetrics)
  const readingMetrics = viewportMetrics
  const activeReadingPosition = sceneEcho?.position ?? dialoguePosition
  const activeReadingText = sceneEcho?.text ?? dialogueText ?? dialogueLine?.text ?? ''
  const readingIsLeaving = sceneEcho?.phase === 'leaving' || (!sceneEcho && dialoguePhase === 'leaving' && Boolean(dialogue && dialogueLine && dialoguePosition))
  const readingPresentationPhase = readingMode ? 'active' : readingIsLeaving ? 'leaving' : 'inactive'
  useIsomorphicLayoutEffect(() => {
    if (readingPresentationPhase !== 'active') {
      typingCompletionLockRef.current = false
      releaseReadingPageAdvance()
    }
  }, [readingPresentationPhase, releaseReadingPageAdvance])
  useEffect(() => {
    if (!typingCompletionLockRef.current || sceneEcho?.typing) return
    typingCompletionLockRef.current = false
    releaseReadingPageAdvance()
  }, [releaseReadingPageAdvance, sceneEcho?.typing])
  const readingPresentationMode = readingMode ?? (sceneEcho ? 'observation' : readingIsLeaving ? 'dialogue' : null)
  const readingSessionKey = !readingPresentationMode ? null : sceneEcho
    ? `${scene.id}:observation:echo:${sceneEcho.id}:${sceneEcho.entityId ?? ''}`
    : mainlineDialogueReadingSessionKey(scene.id, dialogue?.triggerEntityId, dialogueLine?.id, dialogueLineIndex)
  const retainedReadingPresentation = readingPresentationPhase === 'leaving'
    && readingSessionKey
    && retainedReadingPresentationRef.current?.sessionKey === readingSessionKey
    ? retainedReadingPresentationRef.current
    : null
  const readingOverflowKey = sceneEcho
    ? `${readingSessionKey}:echo:${sceneEcho.segmentIndex}:${activeReadingText}`
    : `${readingSessionKey}:dialogue:${dialogueSegmentIndex}:${activeReadingText}`
  const readingOverflowIndex = mainlineReadingOverflowPageIndex(readingOverflowPage, readingSessionKey, readingOverflowKey)
  useEffect(() => {
    setReadingOverflowPage(current => mainlineReadingOverflowPageForSession(current, readingSessionKey))
  }, [readingSessionKey])
  const dialogueParticipantResolution = resolveMainlineDialogueParticipants(scene, dialogue, dialogueLine)
  const dialogueParticipantNpcIds = dialogueParticipantResolution.npcIds
  const readingProtectedEntityIds = useMemo(() => {
    return currentMainlineReadingTargetIds({
      readingMode: readingPresentationPhase !== 'inactive',
      activeObjectId,
      sceneEchoEntityId: sceneEcho?.entityId,
      sceneActionEntityId: sceneAction?.entityId,
      dialogueTriggerEntityId: dialogue?.triggerEntityId,
    })
  }, [activeObjectId, dialogue?.triggerEntityId, readingPresentationPhase, sceneAction?.entityId, sceneEcho?.entityId])
  const currentReadingWidthPx = activeReadingPosition ? mainlineAvailableReadingWidthPx(scene, activeReadingPosition, readingMetrics, worldScale, cameraOffset) : readingMetrics.width - 24
  const maximumReadingWidthPx = activeReadingPosition ? mainlineMaximumReadingWidthPx(scene, activeReadingPosition, readingMetrics, worldScale) : currentReadingWidthPx
  const readingEnvelopeTexts = useMemo(() => sceneEcho
    ? (sceneEcho.segments.length ? sceneEcho.segments : [sceneEcho.text])
    : dialogueLine ? [dialogueLine.text] : [activeReadingText],
  [activeReadingText, dialogueLine?.text, sceneEcho?.segments, sceneEcho?.text])
  const maximumReadingLayout = activeReadingPosition
    ? readingEnvelopeTexts.map(text => mainlineEchoLayout(text, readingMetrics, { speaker: !sceneEcho ? dialogueLine?.speaker : undefined, maxWidthPx: maximumReadingWidthPx }))
      .reduce((largest, layout) => ({
        widthPx: Math.max(largest.widthPx, layout.widthPx),
        heightPx: Math.max(largest.heightPx, layout.heightPx),
        fontSizePx: layout.fontSizePx,
      }))
    : null
  const dialogueSpeakerEnvelope = readingMode === 'dialogue' && dialogue && activeReadingPosition
    ? mainlineSpeakerAnchor(dialogue.lines, readingMetrics, {
      x: scene.id === 'commercial-street' ? projectCommercialStreetX(activeReadingPosition.x, readingMetrics) : activeReadingPosition.x,
      y: activeReadingPosition.y,
    }, { x: 0, y: 0 }, worldScale, maximumReadingWidthPx)
    : null
  const dialogueEnvelopeNeedsPan = dialogueSpeakerEnvelope
    ? mainlineReadingEnvelopeNeedsCameraPan(dialogueSpeakerEnvelope.left, dialogueSpeakerEnvelope.widthPx, readingMetrics, worldScale, cameraOffset)
    : false
  const shouldPanForReading = Boolean(readingMode && activeReadingPosition && maximumReadingLayout && (
    maximumReadingLayout.widthPx > currentReadingWidthPx + 1 || dialogueEnvelopeNeedsPan
  ))
  const readingCameraOffset = retainedReadingPresentation?.cameraOffset ?? (shouldPanForReading && activeReadingPosition
    ? mainlineReadingCameraOffset(scene, activeReadingPosition, readingMetrics, worldScale, cameraOffset)
    : cameraOffset)
  const questionDialogueActive = scene.id === 'commercial-street' && dialogue?.triggerEntityId === 'commercial-street-question'
  const questionReadingActive = questionDialogueActive && readingPresentationPhase !== 'inactive'
  const [questionExitCameraOffset, setQuestionExitCameraOffset] = useState<Point | null>(null)
  const questionNormalCameraOffsetRef = useRef(cameraOffset)
  questionNormalCameraOffsetRef.current = cameraOffset
  const lastQuestionReadingCameraOffsetRef = useRef<Point | null>(null)
  useLayoutEffect(() => {
    if (questionReadingActive) lastQuestionReadingCameraOffsetRef.current = readingCameraOffset
  }, [questionReadingActive, readingCameraOffset])
  useLayoutEffect(() => {
    if (questionReadingActive) {
      setQuestionExitCameraOffset(null)
      return
    }

    if (readingPresentationPhase !== 'inactive' || scene.id !== 'commercial-street') {
      lastQuestionReadingCameraOffsetRef.current = null
      setQuestionExitCameraOffset(null)
      return
    }

    const retainedOffset = lastQuestionReadingCameraOffsetRef.current
    lastQuestionReadingCameraOffsetRef.current = null
    if (!retainedOffset) {
      setQuestionExitCameraOffset(null)
      return
    }

    let current = retainedOffset
    let previousTime = performance.now()
    let frame = 0
    setQuestionExitCameraOffset(current)
    const advance = (now: number) => {
      current = advanceCommercialStreetQuestionCameraHandoff(current, questionNormalCameraOffsetRef.current, now - previousTime)
      previousTime = now
      if (commercialStreetQuestionCameraHandoffSettled(current, questionNormalCameraOffsetRef.current)) {
        setQuestionExitCameraOffset(null)
        return
      }
      setQuestionExitCameraOffset(current)
      frame = window.requestAnimationFrame(advance)
    }
    frame = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frame)
  }, [questionReadingActive, readingPresentationPhase, scene.id])
  const renderCameraOffset = questionExitCameraOffset ?? readingCameraOffset
  const sceneActionCameraOffset = sceneAction?.cameraOffset ?? cameraOffset
  const sceneActionMaxWidthPx = sceneAction
    ? mainlineAvailableReadingWidthPx(scene, sceneAction.position, renderScreenMetrics, worldScale, sceneActionCameraOffset)
    : 0
  const sceneActionMeasureKey = sceneAction ? JSON.stringify([
    scene.id,
    sceneAction.entityId ?? 'scene',
    sceneAction.options,
    sceneAction.position.x,
    sceneAction.position.y,
    sceneActionCameraOffset.x,
    sceneActionCameraOffset.y,
    renderScreenMetrics.width,
    renderScreenMetrics.height,
    viewportMetrics.width,
    viewportMetrics.height,
    worldScale,
    sceneActionMaxWidthPx,
  ]) : null
  const sceneActionRef = useRef<HTMLDivElement | null>(null)
  const [sceneActionMeasuredSize, setSceneActionMeasuredSize] = useState<{ key: string; width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const node = sceneActionRef.current
    if (!sceneActionMeasureKey || !node) {
      setSceneActionMeasuredSize(current => current?.key === sceneActionMeasureKey ? null : current)
      return
    }
    const measure = () => {
      const rect = node.getBoundingClientRect()
      if (!(rect.width > 0) || !(rect.height > 0)) return
      const next = {
        key: sceneActionMeasureKey,
        width: rect.width,
        // scrollHeight captures the full wrapped option content after the
        // bounded viewport is applied; transform scale converts it to screen px.
        height: Math.max(rect.height, node.scrollHeight * worldScale),
      }
      setSceneActionMeasuredSize(current => current?.key === next.key
        && Math.abs(current.width - next.width) < .25
        && Math.abs(current.height - next.height) < .25
        ? current
        : next)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [sceneActionMeasureKey, worldScale])
  const matchingSceneActionSize = sceneActionMeasureKey && sceneActionMeasuredSize?.key === sceneActionMeasureKey
    ? sceneActionMeasuredSize
    : null
  const sceneActionPlacement = sceneAction && matchingSceneActionSize
    ? mainlinePlaceReadingAction(scene, sceneAction.position, matchingSceneActionSize, renderScreenMetrics, worldScale, sceneActionCameraOffset)
    : null
  const activeReadingWidthPx = activeReadingPosition ? mainlineAvailableReadingWidthPx(scene, activeReadingPosition, readingMetrics, worldScale, renderCameraOffset) : readingMetrics.width - 24
  const activeReadingLayout = activeReadingPosition
    ? mainlineEchoLayout(activeReadingText, readingMetrics, { speaker: !sceneEcho ? dialogueLine?.speaker : undefined, maxWidthPx: activeReadingWidthPx })
    : null
  const projectReadingX = useCallback((x: number) => scene.id === 'commercial-street' ? projectCommercialStreetX(x, renderScreenMetrics) : x, [renderScreenMetrics, scene.id])
  const geometryUnits = geometrySnapshot.units
  const switchableStorefronts = useMemo(() => scene.storefronts.filter(slot => slot.portalId && slot.characterSwitch), [scene.storefronts])
  const switchCells = useMemo(() => new Map(switchableStorefronts.map(slot => {
    const projected = mainlineCanonicalSceneGeometryUnits(scene, renderScreenMetrics)
    return [slot.id, storefrontCharacterCells(scene, slot, projected)] as const
  })), [renderScreenMetrics, scene, switchableStorefronts])
  const activeSwitchableStorefronts = useMemo(() => switchableStorefronts.filter(slot => (switchCells.get(slot.id)?.length ?? 0) > 0), [switchCells, switchableStorefronts])
  const storefrontLabelGeometry = useMemo(() => new Map(switchableStorefronts.flatMap(slot => {
    const geometry = storefrontContactGeometry(slot, geometryUnits, renderScreenMetrics, true)
    return geometry ? [[slot.id, geometry] as const] : []
  })), [geometryUnits, renderScreenMetrics, switchableStorefronts])
  // Player movement only invalidates frame targets when crossing a storefront
  // approach boundary. Keep ordinary walking out of the measured-frame path.
  const approachedStorefrontIds = useMemo(
    () => new Set(activeStorefrontId ? [activeStorefrontId] : []),
    [activeStorefrontId],
  )
  const activeShellRoom = scene.rooms.find((room) => room.id.endsWith('-interior')
    && position.x >= room.bounds.x
    && position.x <= room.bounds.x + room.bounds.width
    && position.y >= room.bounds.y
    && position.y <= room.bounds.y + room.bounds.height)
  const activeSpatialSpaceId = mainlineActiveSpatialSpaceId(scene, position)
  const streetPresentationActive = mainlinePublicStreetPresentationIsActive(scene, position)
  const streetSpaceContentRetained = Boolean(scene.id === 'commercial-street' || scene.id === 'yonghe-mining-perimeter')
  const activeShellRoomConnection = activeShellRoom && scene.storefronts.map(slot => storefrontRoomConnection(scene, slot)).find(connection => connection?.interiorRoom.id === activeShellRoom.id)
  const activeShellRoomId = activeShellRoomConnection && activeShellRoomConnection.passage.access !== 'open' ? undefined : activeShellRoom?.id
  const interiorStorefrontId = activeStorefrontInteriorOwner(scene, position)
  const visibleInteriorRoomIds = new Set(visibleInteriorStorefrontIds.flatMap(storefrontId => {
    const storefront = scene.storefronts.find(candidate => candidate.id === storefrontId)
    const room = storefront && storefrontRoomConnection(scene, storefront)?.interiorRoom
    return room ? [room.id] : []
  }))
  const interiorRoomOwner = (roomId: string | undefined) => roomId
    ? scene.storefronts.find(storefront => storefrontRoomConnection(scene, storefront)?.interiorRoom.id === roomId)?.id ?? null
    : null
  const interiorRoomPresentationActive = (roomId: string | undefined) => {
    const owner = interiorRoomOwner(roomId)
    return owner ? owner === paintedInteriorStorefrontId : undefined
  }
  const interiorRoomIsVisuallyActive = (roomId: string | undefined) => interiorRoomPresentationActive(roomId) !== false
  const renderedRoomIds = new Set([...visibleInteriorRoomIds, ...(activeShellRoomId ? [activeShellRoomId] : [])])
  const geometryCells = useMemo(() => geometryUnits.flatMap((unit) => unit.visual.cells
    .filter(cell => {
      const slot = unit.storefrontId ? activeSwitchableStorefronts.find(candidate => candidate.id === unit.storefrontId) : undefined
      if (!slot) return true
      return storefrontGeometryCellShouldRender(slot, unit, cell, switchCells.get(slot.id))
    }).map((cell) => ({
    unit,
    // The compiled geometry unit owns storefront identity. Carry it into
    // every visual cell so a vertical label cannot split into one focus group
    // per glyph when a cell omitted its local copy of the id.
    cell: cell.kind === 'storefront' && unit.storefrontId
      ? { ...cell, storefrontId: unit.storefrontId }
      : cell,
  }))), [activeSwitchableStorefronts, geometryUnits, switchCells])

  // In the continuous commercial street, room ownership only controls room
  // contents. Shell glyphs are culled by camera visibility, never by room
  // transitions, while their collision/navigation geometry stays persistent.
  const visibleShellWorldSpan = useMemo(() => mainlineVisibleWorldSpan(viewportMetrics), [viewportMetrics])
  const renderedGeometryCells = useMemo(() => geometryCells.filter(({ unit, cell }) => {
    if (!mainlineGeometryUnitShouldRender(scene.id, unit, activeShellRoomId, layoutMode)) return false
    if (!unit.sourceWallId?.endsWith('-shell')) return true
    return mainlineGeometryCellWithinViewport(cell, renderCameraOffset, 5, scene.id, renderScreenMetrics, viewportMetrics, visibleShellWorldSpan)
  }), [activeShellRoomId, renderCameraOffset, geometryCells, layoutMode, renderScreenMetrics, scene.id, viewportMetrics, visibleShellWorldSpan])

  const focusGroupCells = useMemo(() => {
    const groups = new Map<string, MainlineGeometryCellEntry[]>()
    geometryCells.forEach(({ unit, cell }) => {
      const entityId = cell.entityId ?? unit.entityId
      const target = mainlineCellFocusTarget(scene, cell, entityId, unit.variant)
      if (!target) return
      const entries = groups.get(target.group) ?? []
      entries.push({ unit, cell, entityId, focusGroup: target.group, focusPolicy: target.policy, storefrontInteractionId: target.storefrontInteractionId })
      groups.set(target.group, entries)
    })
    return groups
  }, [geometryCells, scene])
  const wallFeatureEntityIds = useMemo(() => new Set(geometryUnits.flatMap((unit) => unit.visual.cells
    .filter((cell) => cell.kind === 'feature' && cell.entityId)
    .flatMap((cell) => cell.entityId ? [cell.entityId] : []))), [geometryUnits])
  const counterSurfaces = useMemo(() => {
    const groups = new Map<string, typeof scene.continuousStructures[number][]>()
    scene.continuousStructures.forEach(body => {
      if (!body.counterSurface) return
      const group = body.counterSurface.groupId
      groups.set(group, [...(groups.get(group) ?? []), body])
    })
    return [...groups.values()]
  }, [scene.continuousStructures])
  const readingProtectedVisuals = useMemo<CollisionBox[]>(() => {
    if (readingPresentationPhase === 'inactive') return []
    const boxes: CollisionBox[] = []
    const add = (box: CollisionBox | null | undefined) => {
      if (box && Number.isFinite(box.x) && Number.isFinite(box.y) && box.width > 0 && box.height > 0) boxes.push(box)
    }
    for (const entity of scene.objects) {
      if (!readingProtectedEntityIds.has(entity.id)) continue
      add(geometrySnapshot.objects.get(entity.id)?.visualBounds
        ?? mainlineEntityVisualBounds(scene, entity, geometrySnapshot.layout, renderScreenMetrics))
    }
    const glyphHalfWidth = mainlineWorldFontSizePx / 1920 * 50 / Math.max(.01, horizontalGridScale)
    const glyphHalfHeight = mainlineWorldFontSizePx / 1080 * 50
    geometrySnapshot.units.forEach(unit => unit.visual.cells.forEach(cell => {
      const entityId = cell.entityId ?? unit.entityId
      if (!entityId || !readingProtectedEntityIds.has(entityId)) return
      add({ x: cell.x - glyphHalfWidth, y: cell.y - glyphHalfHeight, width: glyphHalfWidth * 2, height: glyphHalfHeight * 2 })
    }))
    scene.continuousStructures.forEach(structure => {
      const surface = structure.counterSurface
      if (!surface || !readingProtectedEntityIds.has(surface.interactionEntityId)) return
      add(surface.outlineBounds ?? structure)
    })
    scene.npcs.forEach(npc => {
      if (!readingProtectedEntityIds.has(npc.id) && !dialogueParticipantNpcIds.has(npc.id)) return
      const snapshot = npcRuntimeSnapshots?.get(npc.id)
      const seatId = mainlineNpcVisualSeatId(scene, npc.id, snapshot)
      const npcPosition = npcPositions?.get(npc.id) ?? resolveMainlineNpcPosition(scene, npc.id, geometrySnapshot.layout, { geometrySnapshot, screenMetrics: renderScreenMetrics })
      const visualPosition = mainlineSeatedActorVisualPosition(npcPosition, seatId, seatId ? geometrySnapshot.objects.get(seatId)?.position : undefined)
      add(mainlineLabelFootprint(npc.label, visualPosition, renderScreenMetrics, { lineHeight: 1 }))
    })
    add(mainlineLabelFootprint(protagonistPresentation.kind === 'dot' ? '人' : protagonistPresentation.label, protagonistVisualPosition, renderScreenMetrics, { lineHeight: 1 }))
    return boxes
  }, [dialogueParticipantNpcIds, geometrySnapshot, horizontalGridScale, npcPositions, npcRuntimeSnapshots, protagonistPresentation.label, protagonistVisualPosition, readingPresentationPhase, readingProtectedEntityIds, renderScreenMetrics, scene])
  const readingFit = readingMode && activeReadingPosition
    ? mainlineFitReadingText(scene, activeReadingPosition, activeReadingText, !sceneEcho ? dialogueLine?.speaker : undefined, activeReadingWidthPx, readingProtectedVisuals, readingMetrics, worldScale, renderCameraOffset, readingEnvelopeTexts)
    : null
  const fittedReadingSegments = readingFit?.segments ?? [activeReadingText]
  const activeDisplayOverflowIndex = Math.min(readingOverflowIndex, Math.max(0, fittedReadingSegments.length - 1))
  const activeDisplayReadingText = fittedReadingSegments[activeDisplayOverflowIndex] ?? activeReadingText
  const activeDisplayReadingLayout = readingFit
    ? mainlineEchoLayout(activeDisplayReadingText, readingMetrics, { speaker: !sceneEcho ? dialogueLine?.speaker : undefined, maxWidthPx: readingFit.maxWidthPx })
    : activeReadingLayout
  const readingAnchorContextKey = useMemo(() => activeReadingPosition ? createReadingAnchorContextKey({
    sceneId: scene.id,
    viewport: readingMetrics,
    worldScale,
    cameraOffset,
    source: activeReadingPosition,
    protectedBoxes: readingProtectedVisuals,
  }) : '', [activeReadingPosition?.x, activeReadingPosition?.y, cameraOffset.x, cameraOffset.y, readingMetrics.height, readingMetrics.viewportWidth, readingMetrics.width, readingProtectedVisuals, scene.id, worldScale])
  const candidateReadingPosition = readingMode && activeReadingPosition && activeDisplayReadingLayout
    ? readingFit?.position ?? mainlinePlaceReadingBox(scene, activeReadingPosition, { width: activeDisplayReadingLayout.widthPx, height: activeDisplayReadingLayout.heightPx }, readingProtectedVisuals, readingMetrics, worldScale, renderCameraOffset) ?? activeReadingPosition
    : activeReadingPosition
  const activeDisplayReadingPosition = readingMode && activeReadingPosition && activeDisplayReadingLayout
    ? readingSessionKey
      ? mainlineReadingAnchorForSession(readingSessionKey, readingAnchorContextKey, candidateReadingPosition!, retainedReadingPresentationRef.current)
      : candidateReadingPosition
    : activeReadingPosition
  const currentReadingPresentation: MainlineReadingPresentationSnapshot | null = readingMode && readingSessionKey && activeDisplayReadingPosition && activeDisplayReadingLayout
    ? { sessionKey: readingSessionKey, anchorContextKey: readingAnchorContextKey, position: activeDisplayReadingPosition, cameraOffset: renderCameraOffset, layout: activeDisplayReadingLayout, maxWidthPx: readingFit?.maxWidthPx ?? activeReadingWidthPx, text: activeDisplayReadingText, overflowIndex: activeDisplayOverflowIndex }
    : null
  const readingPresentation = mainlineReadingPresentationForPhase(readingPresentationPhase, readingSessionKey, currentReadingPresentation, retainedReadingPresentation)
  useIsomorphicLayoutEffect(() => {
    if (readingPresentationPhase === 'active' && currentReadingPresentation) retainedReadingPresentationRef.current = currentReadingPresentation
    else if (readingPresentationPhase === 'inactive') retainedReadingPresentationRef.current = null
  }, [currentReadingPresentation, readingPresentationPhase])
  const displayOverflowIndex = readingPresentation?.overflowIndex ?? activeDisplayOverflowIndex
  const displayReadingText = readingPresentation?.text ?? activeDisplayReadingText
  const displayReadingLayout = readingPresentation?.layout ?? activeDisplayReadingLayout
  const displayReadingMaxWidthPx = readingPresentation?.maxWidthPx ?? activeReadingWidthPx
  const readingLayoutContinuityKey = !readingSessionKey ? null : sceneEcho
    ? `echo:${scene.id}:${sceneEcho.id}`
    : `dialogue:${scene.id}:${dialogue?.triggerEntityId ?? dialogueLine?.id ?? ''}`
  const readingLayoutPageKey = readingSessionKey && displayReadingLayout
    ? `${readingSessionKey}:${sceneEcho?.segmentIndex ?? dialogueSegmentIndex}:${displayOverflowIndex}:${displayReadingText}`
    : null
  const readingLayoutTransition = useMainlineReadingLayoutTransition(
    readingPresentationPhase,
    readingLayoutContinuityKey,
    readingLayoutPageKey,
    displayReadingLayout,
  )
  const presentedReadingLayout = readingLayoutTransition.layout ?? displayReadingLayout
  const readingLayoutTransitioning = readingLayoutTransition.transitioning
  const currentDialogueGroup = dialogue && dialogueLine
    ? `dialogue:${dialogueLine.id}:${dialogueSegmentIndex}:fit:${displayOverflowIndex}`
    : null
  currentDialogueGroupRef.current = currentDialogueGroup
  const readingVisualActive = Boolean(readingPresentation && activeReadingPosition && displayReadingLayout)
  const readingMaskRects = useMemo(() => mainlineReadingMaskRects(sceneRenderBounds, readingProtectedVisuals), [readingProtectedVisuals, sceneRenderBounds])
  const readingDisplayPosition = readingPresentation?.position ?? activeReadingPosition
  const readingOcclusionRect = useMemo(() => readingVisualActive && readingDisplayPosition && presentedReadingLayout
    ? mainlineReadingOcclusionRect(readingDisplayPosition, presentedReadingLayout, worldScale, projectReadingX)
    : null, [presentedReadingLayout, projectReadingX, readingDisplayPosition, readingVisualActive, worldScale])
  const readingOcclusionMaskRegion = useMemo(() => readingOcclusionRect
    ? mainlineReadingOcclusionMaskRegion(sceneRenderBounds, readingOcclusionRect)
    : null, [readingOcclusionRect, sceneRenderBounds])
  useEffect(() => {
    if (readingPresentationPhase !== 'active' || !readingSessionKey || !readingOcclusionRect || !readingOcclusionMaskRegion) return
    if (readingLayoutTransitioning) return
    setRetainedReadingOcclusion(current => retainMainlineReadingOcclusionSnapshot(current, {
      sessionKey: readingSessionKey,
      rect: readingOcclusionRect,
      region: readingOcclusionMaskRegion,
      protectedEntityIds: readingProtectedEntityIds,
    }))
  }, [readingLayoutTransitioning, readingOcclusionMaskRegion, readingOcclusionRect, readingPresentationPhase, readingProtectedEntityIds, readingSessionKey])
  useEffect(() => {
    if (readingPresentationPhase !== 'active' || !readingVisualActive || !readingSessionKey) return
    if (activeReadingOcclusionSession === readingSessionKey) return
    setActiveReadingOcclusionSession(null)
    readingOcclusionEntryRafRef.current = window.requestAnimationFrame(() => {
      readingOcclusionEntryRafRef.current = null
      setActiveReadingOcclusionSession(readingSessionKey)
    })
    return () => {
      if (readingOcclusionEntryRafRef.current !== null) window.cancelAnimationFrame(readingOcclusionEntryRafRef.current)
      readingOcclusionEntryRafRef.current = null
    }
  }, [activeReadingOcclusionSession, readingPresentationPhase, readingSessionKey, readingVisualActive])
  useEffect(() => {
    if (readingPresentationPhase === 'active') {
      if (readingOcclusionExitTimerRef.current !== null) window.clearTimeout(readingOcclusionExitTimerRef.current)
      readingOcclusionExitTimerRef.current = null
      readingOcclusionExitStartedAtRef.current = null
      return
    }
    if (!retainedReadingOcclusion) return
    if (readingOcclusionExitStartedAtRef.current === null) readingOcclusionExitStartedAtRef.current = performance.now()
    if (readingOcclusionExitTimerRef.current !== null) window.clearTimeout(readingOcclusionExitTimerRef.current)
    const elapsed = performance.now() - readingOcclusionExitStartedAtRef.current
    const remaining = Math.max(0, mainlineReadingFadeTransitionMs - elapsed)
    readingOcclusionExitTimerRef.current = window.setTimeout(() => {
      readingOcclusionExitTimerRef.current = null
      readingOcclusionExitStartedAtRef.current = null
      setRetainedReadingOcclusion(null)
      setActiveReadingOcclusionSession(null)
    }, remaining)
    return () => {
      if (readingOcclusionExitTimerRef.current !== null) window.clearTimeout(readingOcclusionExitTimerRef.current)
      readingOcclusionExitTimerRef.current = null
    }
  }, [readingPresentationPhase, retainedReadingOcclusion])
  useEffect(() => () => {
    if (readingOcclusionExitTimerRef.current !== null) window.clearTimeout(readingOcclusionExitTimerRef.current)
    if (readingOcclusionEntryRafRef.current !== null) window.cancelAnimationFrame(readingOcclusionEntryRafRef.current)
  }, [])
  const retainedOcclusionSnapshot = readingVisualActive && readingOcclusionRect && readingOcclusionMaskRegion
    ? { sessionKey: readingSessionKey ?? '', rect: readingOcclusionRect, region: readingOcclusionMaskRegion, protectedEntityIds: readingProtectedEntityIds }
    : retainedReadingOcclusion
  const readingOcclusionActive = readingPresentationPhase === 'active' && readingVisualActive && activeReadingOcclusionSession === readingSessionKey
  const readingOcclusionProtectedEntityIds = readingPresentationPhase === 'inactive'
    ? retainedReadingOcclusion?.protectedEntityIds ?? readingProtectedEntityIds
    : readingProtectedEntityIds
  const readingDisplayShift = activeReadingPosition && readingDisplayPosition
    ? { x: projectReadingX(readingDisplayPosition.x) - projectReadingX(activeReadingPosition.x), y: readingDisplayPosition.y - activeReadingPosition.y }
    : { x: 0, y: 0 }
  const actorReadingOpacity = (point: Point) => readingVisualActive && readingDisplayPosition && presentedReadingLayout
    ? mainlineReadingActorOpacity(point, readingDisplayPosition, presentedReadingLayout, worldScale, projectReadingX)
    : 1
  const objectFrameOwners = useMemo(() => {
    const owners = new Map<string, string>()
    scene.objects.forEach(entity => {
      if (entity.focusFrameGroup && !owners.has(entity.focusFrameGroup)) owners.set(entity.focusFrameGroup, entity.id)
    })
    return owners
  }, [scene.objects])
  const focusFrameTargets = useMemo<readonly SceneFrameTarget[]>(() => {
    if (layoutMode) return []
    const targetMap = new Map<string, SceneFrameTarget>()
    const addTarget = (target: SceneFrameTarget) => {
      const existing = targetMap.get(target.group)
      if (!existing) {
        targetMap.set(target.group, target)
        return
      }
      existing.gateTriggered ||= target.gateTriggered
      existing.interactionBusy ||= target.interactionBusy
      existing.interactionActive ||= target.interactionActive
      existing.retractRequested ||= target.retractRequested
      existing.suppressed ||= target.suppressed
      if (existing.phase === 'closed' && target.phase !== 'closed') existing.phase = target.phase
    }
    geometryCells.forEach(({ unit, cell }) => {
      const entityId = cell.entityId ?? unit.entityId
      const target = mainlineCellFocusTarget(scene, cell, entityId, unit.variant)
      if (!target) return
      const storefrontId = cell.storefrontId ?? unit.storefrontId
      const storefront = storefrontId ? scene.storefronts.find((candidate) => candidate.id === storefrontId) : undefined
      const storefrontPresentationPhase = storefront ? storefrontPresentation.get(storefront.id) ?? 'baseline' : 'baseline'
      const storefrontPassageEntityId = storefront?.portalId
        ? scene.passages.find((passage) => passage.portalId === storefront.portalId)?.entityId
        : undefined
      const passageEntityId = storefrontPassageEntityId ?? entityId
      const interactionId = target.storefrontInteractionId ?? entityId
      const retractRequested = sceneFrameExitRequestsTarget(
        sceneFrameExit,
        target.group,
        target.policy === 'passage' ? passageEntityId : undefined,
      )
      addTarget({
        group: target.group,
        policy: target.policy,
        phase: target.policy === 'passage' ? doorPhases.get(passageEntityId ?? '') ?? 'closed' : 'closed',
        gateTriggered: target.policy === 'gate' && gateTriggered,
        interactionBusy: target.policy === 'interactive' && activeObjectId === interactionId && moving,
        interactionActive: target.policy === 'interactive' && (activeObjectId === interactionId || sceneEcho?.entityId === interactionId),
        retractRequested: Boolean(retractRequested
          || (cell.kind === 'storefront' && cell.storefrontRole === 'sign' && storefrontPresentationRetractsFrame(storefrontPresentationPhase))
          || (cell.kind === 'door' && storefront?.characterSwitch && storefrontDoorFrameShouldRetract(storefront.id, interiorStorefrontId, storefrontPresentationPhase, approachedStorefrontIds.has(storefront.id)))),
        suppressed: false,
      })
    })
    switchableStorefronts.forEach(slot => {
      const phase = storefrontPresentation.get(slot.id) ?? 'baseline'
      const entityId = scene.passages.find(passage => passage.portalId === slot.portalId)?.entityId ?? slot.portalId!
      const baselineGroup = 'storefront:' + slot.id + ':baseline'
      const doorGroup = `door:${entityId}`
      addTarget({ group: baselineGroup, policy: 'passage', phase: 'closed', gateTriggered: false, interactionBusy: false, interactionActive: false,
        retractRequested: phase !== 'baseline' || sceneFrameExitRequestsTarget(sceneFrameExit, baselineGroup, entityId), suppressed: false })
      const doorCells = (switchCells.get(slot.id) ?? []).filter(cell => cell.role === 'door')
      const independentDoorCells = doorCells.length > 1
      const frameGroups = independentDoorCells
        ? doorCells.map(cell => storefrontDoorFocusGroup({ ...cell, storefrontId: slot.id }, undefined, true))
        : [doorGroup]
      frameGroups.forEach(group => addTarget({ group, policy: 'passage', phase: doorPhases.get(entityId) ?? 'closed', gateTriggered: false,
        interactionBusy: false, interactionActive: false, retractRequested: storefrontDoorFrameShouldRetract(slot.id, interiorStorefrontId, phase, approachedStorefrontIds.has(slot.id))
          || sceneFrameExitRequestsTarget(sceneFrameExit, group, entityId), suppressed: false }))
    })
    scene.objects.forEach((entity) => {
      if (entity.focusFrame !== 'interactive' || entity.visible === false) return
      const streetContent = mainlineEntityIsPublicStreetContent(scene.id, entity)
      // Keep the focus-frame target mounted so it can collapse smoothly. The
      // street entity itself is disabled and removed from active interaction.
      if (!mainlineEntityMatchesCurrentPresentation(entity, renderedRoomIds, activeSpatialSpaceId) && !streetContent) return
      const group = `interactive:${entity.focusFrameGroup ?? entity.id}`
      addTarget({
        group,
        policy: 'interactive',
        phase: 'closed',
        gateTriggered: false,
        interactionBusy: activeObjectId === entity.id && moving,
        interactionActive: !streetContent && (activeObjectId === entity.id || sceneEcho?.entityId === entity.id),
        retractRequested: streetContent && !streetPresentationActive,
        suppressed: isMainlineSeatLabelSuppressed(entity, occupiedSeatIds),
      })
    })
    return [...targetMap.values()]
  }, [activeObjectId, switchableStorefronts, approachedStorefrontIds, interiorStorefrontId, doorPhases, gateTriggered, geometryCells, layoutMode, moving, scene, sceneEcho, sceneFrameExit, storefrontPresentation, occupiedSeatIds, renderedRoomIds, activeSpatialSpaceId, streetPresentationActive])
  const focusFrames = useSceneFocusFrameController({
    targets: focusFrameTargets,
    freezeMeasurements: freezeFrameMeasurements,
    projectionScale: worldScale,
  })
  useEffect(() => {
    scene.storefronts.forEach(storefront => {
      if (storefrontPresentation.get(storefront.id) !== 'retracting') return
      if (focusFrames.isCollapsed('storefront:' + storefront.id + ':baseline')) onStorefrontFrameRetractionComplete?.(storefront.id)
    })
  }, [focusFrames.isCollapsed, geometryCells, onStorefrontFrameRetractionComplete, scene.storefronts, storefrontPresentation])
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    switchableStorefronts.forEach(slot => {
      const phase = storefrontPresentation.get(slot.id)
      if (phase !== 'revealing' && phase !== 'restoring') return
      const callback = phase === 'revealing' ? onStorefrontRevealMotionComplete : onStorefrontRestoreMotionComplete
      if (!callback) return
      const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      timers.push(setTimeout(() => {
        callback(slot.id)
        if (phase === 'revealing' && typeof window !== 'undefined') {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => focusFrames.remeasureGroup(`door:${slot.portalId}`)))
        }
      }, reducedMotion ? 1 : storefrontLabelRollDurationMs))
    })
    return () => timers.forEach(clearTimeout)
  }, [focusFrames.remeasureGroup, onStorefrontRestoreMotionComplete, onStorefrontRevealMotionComplete, storefrontPresentation, switchableStorefronts])
  // Reading and an immediately following local Action are one interaction
  // lifecycle for the source content. Focus-frame targets intentionally keep
  // their neutral contract; this helper is only for the object/glyph content.
  const isCurrentInteractionSource = (entityId: string | undefined) => Boolean(
    entityId
      && (activeObjectId === entityId || sceneEcho?.entityId === entityId || sceneAction?.entityId === entityId),
  )
  const frameMotionProfile = useMemo<readonly SceneFocusFrameMotionProfile[]>(() => focusFrameTargets
    .map((target) => ({ group: target.group, durationMs: focusFrames.motionDurationMs(target.group) }))
    .sort((first, second) => first.group.localeCompare(second.group)), [focusFrameTargets, focusFrames.motionDurationMs])
  const frameMotionProfileKey = frameMotionProfile.map(({ group, durationMs }) => `${group}:${durationMs}`).join('|')
  const reportedFrameMotionProfileRef = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (!onFrameMotionProfileChange || reportedFrameMotionProfileRef.current === frameMotionProfileKey) return
    reportedFrameMotionProfileRef.current = frameMotionProfileKey
    onFrameMotionProfileChange(frameMotionProfile)
  }, [frameMotionProfile, frameMotionProfileKey, onFrameMotionProfileChange])
  const touchWalkRef = useRef<{ clientX: number; clientY: number; at: number } | null>(null)

  const pointFromPointer = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return mainlineWorldPointFromClient({ x: clientX, y: clientY }, rect, viewportMetrics, renderCameraOffset)
  }, [renderCameraOffset, viewportMetrics])

  const startLayoutDrag = useCallback((itemId: LayoutItemId, event: React.PointerEvent<HTMLElement>) => {
    if (!layoutMode) return
    const pointer = pointFromPointer(event.clientX, event.clientY)
    const anchor = mainlineLayoutAnchor(scene, itemId, layout)
    if (!pointer || !anchor) return
    event.preventDefault()
    event.stopPropagation()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // The window listener remains the fallback event owner in embedded surfaces.
    }
    dragRef.current = { itemId, pointerId: event.pointerId, startPointer: pointer, startAnchor: anchor, moved: false }
    setSelectedLayoutItemId(itemId)
    setDraggingItemId(itemId)
  }, [layout, layoutMode, pointFromPointer, scene])

  useEffect(() => {
    if (!draggingItemId) return undefined
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const pointer = pointFromPointer(event.clientX, event.clientY)
      if (!pointer) return
      const rawDelta = { x: pointer.x - drag.startPointer.x, y: pointer.y - drag.startPointer.y }
      if (!drag.moved && Math.hypot(rawDelta.x, rawDelta.y) < .5) return
      drag.moved = true
      const delta = snapDelta(rawDelta)
      const nextAnchor = { x: drag.startAnchor.x + delta.x, y: drag.startAnchor.y + delta.y }
      onLayoutChange(drag.itemId, clampMainlineLayoutAnchor(scene, nextAnchor))
    }
    const finishDrag = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const target = event.target instanceof Element ? event.target.closest('[data-layout-item-id]') : null
      suppressNextLayoutStageClickRef.current = drag.moved && !target
      dragRef.current = null
      setDraggingItemId(null)
    }
    const cancelDrag = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      dragRef.current = null
      suppressNextLayoutStageClickRef.current = false
      setDraggingItemId(null)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishDrag, { once: true })
    window.addEventListener('pointercancel', cancelDrag, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', cancelDrag)
    }
  }, [draggingItemId, onLayoutChange, pointFromPointer, scene])

  const walkToPoint = useCallback((clientX: number, clientY: number, rect: DOMRect, input: { source: 'click' | 'touch'; pointerType: string; target: string }) => {
    const screenPoint = {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    }
    const point = mainlineWorldPointFromClient({ x: clientX, y: clientY }, rect, viewportMetrics, renderCameraOffset)
    onInputDiagnostic?.({
      ...input,
      client: { x: clientX, y: clientY },
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      screenPoint,
      mappedPoint: point,
    })
    if (layoutMode) {
      if (suppressNextLayoutStageClickRef.current) {
        suppressNextLayoutStageClickRef.current = false
        return
      }
      if (selectedLayoutItemId) onLayoutChange(selectedLayoutItemId, clampMainlineLayoutAnchor(scene, snapPoint(point)))
      return
    }
    onWalk(point)
  }, [renderCameraOffset, layoutMode, onInputDiagnostic, onLayoutChange, onWalk, scene, selectedLayoutItemId, viewportMetrics])

  const walkToEmptySpace = (event: React.MouseEvent<HTMLDivElement>) => {
    const touchWalk = touchWalkRef.current
    if (touchWalk && Date.now() - touchWalk.at < 500 && Math.hypot(event.clientX - touchWalk.clientX, event.clientY - touchWalk.clientY) < 12) {
      touchWalkRef.current = null
      return
    }
    walkToPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), {
      source: 'click',
      pointerType: 'pointerType' in event.nativeEvent && typeof event.nativeEvent.pointerType === 'string' ? event.nativeEvent.pointerType : 'mouse',
      target: event.target instanceof Element ? event.target.tagName.toLowerCase() : 'unknown',
    })
  }

  const walkFromTouch = (event: React.PointerEvent<HTMLDivElement>) => {
    if (layoutMode || event.pointerType === 'mouse' || !event.isPrimary) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('button, a, input, textarea, select, [role="button"], [data-focus-target-id], [data-scene-interaction-text]')) return
    if (event.defaultPrevented) return
    event.preventDefault()
    touchWalkRef.current = { clientX: event.clientX, clientY: event.clientY, at: Date.now() }
    walkToPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), {
      source: 'touch',
      pointerType: event.pointerType,
      target: event.target instanceof Element ? event.target.tagName.toLowerCase() : 'unknown',
    })
  }

  const worldProjectionStyle = {
    left: '50%',
    top: '50%',
    width: `${sceneDesignReferenceMetrics.width}px`,
    height: `${sceneDesignReferenceMetrics.height}px`,
    marginLeft: `${-sceneDesignReferenceMetrics.width * worldScale / 2}px`,
    marginTop: `${-sceneDesignReferenceMetrics.height * worldScale / 2}px`,
    transform: `scale(${worldScale}) translate(${renderCameraOffset.x}%, ${renderCameraOffset.y}%)`,
    transformOrigin: 'top left',
    '--scene-horizontal-grid-counter-scale': String(1 / horizontalGridScale),
  } as CSSProperties

  const extractProtectedWallNode = (_entityId: string, _key: string, node: ReactNode): ReactNode => node
  const visibleObjectEntities = scene.objects.filter(entity => entity.visible !== false
    && !entity.counterSurfaceId
    && entity.kind !== 'door'
    && !wallFeatureEntityIds.has(entity.id)
    && (mainlineEntityMatchesCurrentPresentation(entity, renderedRoomIds, activeSpatialSpaceId)
      || (streetSpaceContentRetained && mainlineEntityIsPublicStreetContent(scene.id, entity))))
  const renderMainlineObject = (entity: MainlineSceneEntity, coordinateBounds: CollisionBox) => {
    const entityPosition = geometrySnapshot.objects.get(entity.id)?.position ?? entity.position
    const localVisualPosition = localPointInWorldBounds(entityPosition, coordinateBounds)
    const focusGroup = !layoutMode && entity.focusFrame === 'interactive' ? `interactive:${entity.focusFrameGroup ?? entity.id}` : undefined
    const streetContent = mainlineEntityIsPublicStreetContent(scene.id, entity)
    const presentationActive = streetContent ? streetPresentationActive : interiorRoomPresentationActive(entity.roomId)
    const underPlayer = entity.visualProfile === 'tree-ring' && entity.interactive === false && Math.hypot(position.x - entityPosition.x, position.y - entityPosition.y) <= 2.8
    return <MemoMainlineObject
      entity={entity}
      scene={scene}
      position={entityPosition}
      visualPosition={localVisualPosition}
      collision={geometrySnapshot.objects.get(entity.id)?.collision ?? undefined}
      visualBounds={geometrySnapshot.objects.get(entity.id)?.visualBounds}
      focusGroup={focusGroup}
      renderFrame={!entity.focusFrameGroup || objectFrameOwners.get(entity.focusFrameGroup) === entity.id ? focusFrames.renderFrame : undefined}
      visibility={objectVisibility(entity, layoutMode)}
      active={isCurrentInteractionSource(entity.id) && !readingMode}
      explored={exploredObjectIds.has(entity.id)}
      tutorialCompleted={interactionTutorialCompleted}
      underPlayer={underPlayer}
      layoutMode={layoutMode}
      screenMetrics={renderScreenMetrics}
      incenseLit={incenseLit}
      incenseBurnRemainingMs={incenseBurnRemainingMs}
      onIncenseBurnComplete={onIncenseBurnComplete}
      selected={selectedLayoutItemId === mainlineLayoutItemForEntity(scene, entity.id)}
      dragging={draggingItemId === mainlineLayoutItemForEntity(scene, entity.id)}
      onStartLayoutDrag={startLayoutDrag}
      onSelectLayoutItem={setSelectedLayoutItemId}
      onInteract={onInteract}
      breathingAnimationDelay={synchronizedBreathingDelay}
      sharedBreathingClock={entity.visualProfile === 'incense' && incenseLit}
      registerBreathingNode={registerBreathingNode}
      suppressLabel={isMainlineSeatLabelSuppressed(entity, occupiedSeatIds)}
      prompted={isMainlineSeatPrompted(entity, promptedSeatId, playerSeatId)}
      debugRuntimeEvidence={debugRuntimeEvidence}
      interiorPresentationActive={presentationActive}
      presentationDurationMs={focusGroup ? focusFrames.motionDurationMs(focusGroup) : sceneFrameDefaultMotionMs}
      readingProtected={readingPresentationPhase !== 'inactive' && readingOcclusionProtectedEntityIds.has(entity.id)}
    />
  }
  return (
    <section className="scene-wrap" aria-label={`${scene.title}可探索场景`}>
      <div ref={stageRef} className={`scene-stage mainline-scene-stage ${layoutMode ? 'is-layout-editing' : ''} ${readingMode ? 'is-scene-dialogue-active' : ''}`} style={{ '--scene-mainline-object-font-size': `${mainlineEntityFontSizePx(null, renderScreenMetrics)}px` } as CSSProperties} onClick={walkToEmptySpace} onPointerUp={walkFromTouch} onPointerDownCapture={focusFrames.onPointerDownCapture} onPointerOverCapture={focusFrames.onPointerOverCapture} onPointerOutCapture={focusFrames.onPointerOutCapture} onClickCapture={focusFrames.onClickCapture} data-layout-mode={layoutMode ? 'edit' : 'play'} data-mainline-scene={scene.id} data-camera-offset-x={debugRuntimeEvidence ? cameraOffset.x : undefined} data-camera-offset-y={debugRuntimeEvidence ? cameraOffset.y : undefined} data-scene-dialogue-state={dialoguePhase} data-scene-dialogue-unresolved-speakers={dialogueParticipantResolution.unresolvedSpeakers.join('|') || undefined}>
        {layoutMode && <div className="scene-layout-grid" aria-hidden="true" />}
        <span ref={stableViewportRef} className="scene-mainline-stable-viewport" aria-hidden="true" />

        <div
          className={`scene-mainline-world ${suppressWorldEnterAnimation ? 'is-local-slide-handoff' : ''}`}
          data-commercial-street-grid={scene.id === 'commercial-street' ? 'equal-pitch' : undefined}
          data-commercial-street-grid-scale={scene.id === 'commercial-street' ? horizontalGridScale : undefined}
          data-world-projection-scale={worldScale}
          data-world-projection-policy={(viewportMetrics as MainlineViewportMetrics).projectionPolicy}
          style={worldProjectionStyle}
        >
          <>
          {retainedOcclusionSnapshot && <MainlineReadingOcclusionMask
            id={readingOcclusionMaskId}
            readingRect={retainedOcclusionSnapshot.rect}
            region={retainedOcclusionSnapshot.region}
            active={readingOcclusionActive}
          />}
          <div className="scene-spatial-labels scene-spatial-labels--wall scene-mainline-wall-labels" data-reading-occlusion-layer="wall">
            {activeSwitchableStorefronts.map(slot => {
              const cells = switchCells.get(slot.id)!
              const portalBoxes = cells.map(cell => cellGlyphWorldBounds({ ...cell, kind: cell.role === 'door' ? 'door' : 'storefront' } as MainlineSceneGeometryUnit['visual']['cells'][number], horizontalGridScale))
              const portalBounds = unionWorldBounds(portalBoxes, 8)
              return <MainlineReadingIdentityPlane key={`portal:${slot.id}`} identityKey={`portal:${slot.id}`} entityId={slot.id} relatedEntityIds={slot.portalId ? [slot.portalId] : []} protectedEntityIds={readingOcclusionProtectedEntityIds} worldBounds={portalBounds} readingRect={retainedOcclusionSnapshot?.rect} maskBaseId={readingOcclusionMaskId} active={readingOcclusionActive} className="scene-mainline-reading-identity-plane scene-mainline-reading-identity-plane--wall">
                <PortalStorefrontCharacters scene={scene} storefront={slot}
                  cells={cells} coordinateBounds={portalBounds} phase={storefrontPresentation.get(slot.id) ?? 'baseline'}
                  doorPhase={doorPhases.get(slot.portalId!) ?? 'closed'} screenMetrics={renderScreenMetrics} renderFrame={focusFrames.renderFrame}
                  onInteract={onInteract} onStorefrontInteract={onStorefrontInteract} onDoorTransitionComplete={onDoorTransitionComplete}
                  frameRetracting={sceneFrameExit.phase === 'retracting' && sceneFrameExit.passageEntityId === slot.portalId}
                  onMotionComplete={phase => {
                    if (phase === 'revealing') {
                      onStorefrontRevealMotionComplete?.(slot.id)
                      focusFrames.remeasureGroup(`door:${slot.portalId}`)
                    } else onStorefrontRestoreMotionComplete?.(slot.id)
                  }} />
              </MainlineReadingIdentityPlane>
            })}
            {renderedGeometryCells.map(({ unit, cell }) => {
              const sourceEntityId = cell.entityId ?? unit.entityId
              const cellFocusTarget = mainlineCellFocusTarget(scene, cell, sourceEntityId, unit.variant)
              const sourceFocusEntries = cellFocusTarget ? focusGroupCells.get(cellFocusTarget.group) : undefined
              const groupedFocus = Boolean(cellFocusTarget && sourceFocusEntries && (sourceFocusEntries.length > 1 || cell.kind === 'storefront' && cell.storefrontRole === 'sign'))
              const boundsEntries = groupedFocus ? sourceFocusEntries! : [{ unit, cell } as MainlineGeometryCellEntry]
              const visualBoxes = boundsEntries.map(entry => cellGlyphWorldBounds(entry.cell, horizontalGridScale))
              const cellStorefront = (cell.storefrontId ?? unit.storefrontId) ? scene.storefronts.find(candidate => candidate.id === (cell.storefrontId ?? unit.storefrontId)) : undefined
              const storefrontVisual = cellStorefront ? storefrontLabelGeometry.get(cellStorefront.id) : undefined
              if (groupedFocus && storefrontVisual) visualBoxes.push(mainlineReadingWorldBox(storefrontVisual.visualBounds))
              const cellWorldBounds = unionWorldBounds(visualBoxes, groupedFocus ? 3 : 0)
              const localCellStyle = (targetCell: MainlineGeometryCellEntry['cell']) => {
                const local = localPointInWorldBounds({ x: targetCell.x, y: targetCell.y }, cellWorldBounds)
                return { left: `${local.x}%`, top: `${local.y}%` }
              }
              const localAxisValue = (value: number, vertical: boolean) => {
                const world = value / 100 * (vertical ? sceneDesignReferenceMetrics.height : sceneDesignReferenceMetrics.width)
                const origin = vertical ? cellWorldBounds.y : cellWorldBounds.x
                const extent = vertical ? cellWorldBounds.height : cellWorldBounds.width
                return extent > 0 ? (world - origin) / extent * 100 : 50
              }
              const localizedFocusEntries = sourceFocusEntries?.map(entry => {
                const local = localCellStyle(entry.cell)
                const vertical = entry.cell.layoutOrientation
                  ? entry.cell.layoutOrientation === 'vertical'
                  : entry.cell.orientation === 'vertical'
                return { ...entry, cell: { ...entry.cell, x: Number.parseFloat(local.left), y: Number.parseFloat(local.top),
                  ...(entry.cell.cellStart === undefined ? {} : { cellStart: localAxisValue(entry.cell.cellStart, vertical) }),
                  ...(entry.cell.cellEnd === undefined ? {} : { cellEnd: localAxisValue(entry.cell.cellEnd, vertical) }),
                } }
              })
              const renderCell = () => {
              const featureFlank = cell.kind === 'feature' && cell.featureCellRole === 'flank'
              if (cell.glyph === '' && !featureFlank) return null
              const readingStyle = {}
              const shellRoomId = unit.sourceWallId?.endsWith('-shell') ? unit.sourceWallId.slice(0, -'-shell'.length) : undefined
              const visibilityClass = mainlineWallCellVisibility(scene, cell, unit)
              const portalGlyphStyle = {}
              const portalGlyphAttributes = {}
              const entityId = cell.entityId ?? unit.entityId
              // A menu can replace a shared boundary cell owned geometrically
              // by the neighboring shell. Its display still belongs to the
              // shop named by the wall feature entity.
              const featureEntity = cell.kind === 'feature' && entityId
                ? scene.objects.find((candidate) => candidate.id === entityId)
                : undefined
              const interiorWallRoomId = featureEntity?.roomId ?? shellRoomId
              const featureRoomOwner = cell.kind === 'feature' ? interiorRoomOwner(interiorWallRoomId) : undefined
              const interiorWallActive = interiorRoomIsVisuallyActive(interiorWallRoomId)
              if (featureFlank) {
                // Flanks are ordinary wall cells and keep their baseline styling.
                return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall ${visibilityClass}`} style={localCellStyle(cell)} aria-hidden="true"><SceneCharacters>{cell.baselineGlyph ?? '墙'}</SceneCharacters></span>
              }
              // A multi-glyph menu is rendered as one focus group, but each
              // occupied wall cell must independently restore its glyph when
              // its room is not visible. Do this before collapsing the group.
              if (cell.kind === 'feature' && cell.featureCellRole === 'content' && interiorWallRoomId && !visibleInteriorRoomIds.has(interiorWallRoomId)) {
                return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall ${visibilityClass}`} style={localCellStyle(cell)} aria-hidden="true"><SceneCharacters>{cell.baselineGlyph ?? '\u5899'}</SceneCharacters></span>
              }
              const focusTarget = cellFocusTarget
              const focusEntries = localizedFocusEntries
      if (focusTarget && focusEntries && (focusEntries.length > 1 || cell.kind === 'storefront' && cell.storefrontRole === 'sign')) {
                if (focusEntries[0]?.cell.id !== cell.id) return null
                const groupVisibilityClass = focusEntries.some((entry) => mainlineWallCellVisibility(scene, entry.cell, entry.unit) === 'is-near')
                  ? 'is-near'
                  : focusEntries.some((entry) => mainlineWallCellVisibility(scene, entry.cell, entry.unit) === 'is-baseline')
                  ? 'is-baseline'
                  : 'is-hidden'
                const firstEntry = focusEntries[0]
                if (cell.kind === 'storefront') {
                  const storefront = (cell.storefrontId ?? unit.storefrontId) ? scene.storefronts.find((candidate) => candidate.id === (cell.storefrontId ?? unit.storefrontId)) : undefined
                  const storefrontRole = cell.storefrontRole ?? 'sign'
                  const storefrontState = storefrontCellVisualState(storefront, firstEntry.unit.variant, storefrontRole)
                  const storefrontPassageEntityId = storefront?.portalId
                    ? scene.passages.find((passage) => passage.portalId === storefront.portalId)?.entityId
                    : undefined
                  const storefrontPhase = storefrontPassageEntityId ? doorPhases.get(storefrontPassageEntityId) ?? 'closed' : 'closed'
                  const groupClass = `scene-mainline-storefront ${storefrontMaterialClass(scene.id, cell.storefrontStyle, storefrontRole)} scene-mainline-storefront--${storefrontRole} scene-mainline-storefront--${cell.orientation ?? 'horizontal'} ${storefront?.portalId ? 'scene-mainline-storefront--portal' : ''} is-${storefrontState}`
                  return extractProtectedWallNode(storefront?.id ?? entityId ?? cell.id, focusTarget.group, <MainlineFocusGroup
                    key={`focus-${focusTarget.group}`}
                    entries={focusEntries}
                    className={groupClass}
                    visibilityClass={groupVisibilityClass}
                    renderFrame={focusFrames.renderFrame}
                    onStorefrontInteract={onStorefrontInteract}
                    storefrontInteractionId={storefront?.portalId ? undefined : commercialStreetStorefrontInteractionFor(storefront?.id ?? '') ? storefront?.id : undefined}
                    storefrontId={storefrontRole === 'sign' ? storefront?.id : undefined}
                    storefrontSpan={storefront ? storefront.end - storefront.start : undefined}
                    storefrontCenter={storefront ? mainlineStorefrontAnchor(scene, storefront) : undefined}
                    storefrontLabel={storefrontRole === 'sign' && storefront && !storefront.composition?.fixedCellCount ? storefront.label : undefined}
                    storefrontGeometry={storefrontRole === 'sign' && storefront && !storefront.composition?.fixedCellCount ? (geometrySnapshot.storefronts.get(storefront.id) ?? storefrontLabelGeometry.get(storefront.id)) : undefined}
                    storefrontPresentationPhase={storefront ? storefrontPresentation.get(storefront.id) ?? 'baseline' : 'baseline'}
                    passagePhase={storefrontPhase}
                    frameRetracting={sceneFrameExit.phase === 'retracting' && sceneFrameExit.passageEntityId === storefrontPassageEntityId}
                    active={activeObjectId === storefront?.id && Boolean(commercialStreetStorefrontInteractionFor(storefront.id)) && !readingMode}
                    suppressInteractionEmphasis={Boolean(readingMode && readingProtectedEntityIds.has(storefront?.id ?? ''))}
                  />)
                }
                if (cell.kind === 'feature' && entityId) {
                  const entity = featureEntity
                  if (entity) {
                    const menuFeature = entity.id.toLowerCase().includes('menu')
                    const readingProtected = readingPresentationPhase !== 'inactive' && readingOcclusionProtectedEntityIds.has(entityId)
                    const featureOpacity = storefrontInteriorFeatureOpacity(featureRoomOwner ?? null, visibleInteriorStorefrontIds, paintedInteriorStorefrontId)
                    const featureMotionMs = focusFrames.motionDurationMs(focusTarget.group)
                    const renderedFeature = <Fragment key={`focus-${focusTarget.group}`}>
                      {featureRoomOwner && focusEntries.map(entry => <span key={`wall-${entry.cell.id}`} className={`scene-spatial-glyph scene-mainline-wall ${groupVisibilityClass}`} style={{ left: `${entry.cell.x}%`, top: `${entry.cell.y}%`, opacity: featureOpacity.wall === 0 ? 0 : undefined, transition: `opacity ${featureMotionMs}ms ease-in-out` }} aria-hidden="true"><SceneCharacters>{'\u5899'}</SceneCharacters></span>)}
                      <MainlineFocusGroup entries={focusEntries} className={`scene-mainline-wall scene-mainline-wall-feature scene-mainline-wall-feature--interaction scene-mainline-exploration--steady ${menuFeature ? 'scene-mainline-menu-feature' : ''}`} visibilityClass={groupVisibilityClass} renderFrame={focusFrames.renderFrame} onInteract={onInteract} interactionEntityId={entityId} ariaLabel={`${entity.label}，点击让主角前往互动`} active={isCurrentInteractionSource(entityId) && !readingMode} explored={exploredObjectIds.has(entityId)} suppressInteractionEmphasis={menuFeature || readingProtected} interiorPresentationActive={interiorRoomPresentationActive(interiorWallRoomId)} presentationDurationMs={focusFrames.motionDurationMs(focusTarget.group)} />
                    </Fragment>
                    if (readingProtected) {
                      return extractProtectedWallNode(entityId, focusTarget.group, renderedFeature)
                    }
                    return renderedFeature
                  }
                }
              }
              if (cell.kind === 'storefront') {
                const storefrontRole = cell.storefrontRole ?? 'wall'
                const storefront = (cell.storefrontId ?? unit.storefrontId) ? scene.storefronts.find((candidate) => candidate.id === (cell.storefrontId ?? unit.storefrontId)) : undefined
                const storefrontState = storefrontCellVisualState(storefront, unit.variant, storefrontRole)
                const storefrontStateClass = `is-${storefrontState}`
                const storefrontPresentationPhase = storefront ? storefrontPresentation.get(storefront.id) ?? 'baseline' : 'baseline'
                const portalClass = storefront?.portalId ? 'scene-mainline-storefront--portal' : ''
                const storefrontClass = `scene-spatial-glyph scene-mainline-storefront-cell scene-mainline-wall scene-mainline-storefront ${storefrontMaterialClass(scene.id, cell.storefrontStyle, storefrontRole)} scene-mainline-storefront--${storefrontRole} scene-mainline-storefront--${cell.orientation ?? 'horizontal'} ${portalClass} ${storefrontRole === 'door' ? 'scene-spatial-glyph--door' : ''} ${storefrontStateClass}`
                const storefrontGlyphAttributes = portalGlyphAttributes
                const storefrontPassageEntityId = storefront?.portalId
                  ? scene.passages.find((passage) => passage.portalId === storefront.portalId)?.entityId
                  : undefined
                const focusGroup = cell.storefrontRole === 'sign' && unit.variant !== 'near'
                  ? storefrontFocusGroup(cell, unit.variant)
                  : cell.storefrontRole === 'door' && entityId
                    ? storefrontDoorFocusGroup(cell, unit.variant)
                    : undefined
                if (cell.storefrontRole === 'door' && entityId) {
                  const passageFocusGroup = focusGroup ?? `storefront:${cell.storefrontId ?? cell.id}`
                  const doorLabel = cell.label ?? cell.glyph ?? '门'
                  const doorPhase = doorPhases.get(entityId) ?? 'closed'
                  const closeHint = cell.access === 'locked' ? (cell.lockedText ?? '当前权限不足') : '接近时自动开门，进入门洞后继续路线'
                  return extractProtectedWallNode(entityId, cell.id, <MainlineDoorButton key={cell.id} cell={cell} entityId={entityId} className={storefrontClass} style={{ ...localCellStyle(cell), ...portalGlyphStyle }} doorLabel={doorLabel} glyph={cell.glyph ?? '门'} doorPhase={doorPhase} focusGroup={passageFocusGroup} focusPolicy="passage" gateTriggered={gateTriggered} frameRetracting={sceneFrameExit.passageEntityId === entityId} active={activeObjectId === entityId && !readingMode} closeHint={closeHint} ariaLabel={`${doorLabel}，点击门后目标会在接近时自动开门并穿过`} renderFocusFrame={focusFrames.renderFrame} onInteract={onInteract} onDoorTransitionComplete={onDoorTransitionComplete} dataAttributes={{ 'data-storefront-cell-id': cell.id, 'data-storefront-state': storefrontState, 'data-storefront-presentation-phase': storefrontPresentationPhase, ...storefrontGlyphAttributes }} />)
                }
                const storefrontPhase = storefrontPassageEntityId ? doorPhases.get(storefrontPassageEntityId) ?? 'closed' : 'closed'
                return <span key={cell.id} className={storefrontClass} style={{ ...localCellStyle(cell), ...portalGlyphStyle }} data-storefront-cell-id={cell.id} data-storefront-state={storefrontState} data-storefront-presentation-phase={storefrontPresentationPhase} {...storefrontGlyphAttributes} data-focus-target-id={focusGroup ? cell.id : undefined} data-focus-target-group={focusGroup} data-focus-target-policy={focusGroup ? 'passage' : undefined} data-focus-passage-phase={focusGroup ? storefrontPhase : undefined} data-focus-passage-retracting={focusGroup && storefrontPassageEntityId && sceneFrameExit.phase === 'retracting' && sceneFrameExit.passageEntityId === storefrontPassageEntityId ? 'true' : undefined} aria-hidden="true">{cell.glyph}{focusGroup && focusFrames.renderFrame(focusGroup)}</span>
              }
              if (cell.kind === 'door' && entityId) {
                const doorLabel = cell.displayLabel ?? cell.label ?? '门'
                const doorPhase = doorPhases.get(entityId) ?? 'closed'
                const closeHint = cell.access === 'locked' ? (cell.lockedText ?? '当前权限不足') : '接近时自动开门，进入门洞后继续路线'
                const yardGatePart = cell.doorLabelPart
                const focusGroup = yardGatePart ? `gate:${entityId}:${yardGatePart}` : `door:${entityId}`
                const focusPolicy = yardGatePart ? 'gate' : 'passage' as const
                const doorPresentationActive = interiorRoomPresentationActive(interiorWallRoomId)
                return extractProtectedWallNode(entityId, cell.id, <MainlineDoorButton key={cell.id} cell={cell} entityId={entityId} className={`scene-spatial-glyph scene-mainline-wall scene-mainline-wall-door ${visibilityClass}`} style={{ ...localCellStyle(cell), ...portalGlyphStyle }} doorLabel={doorLabel} glyph={cell.doorLabelPart ?? doorLabel} doorPhase={doorPhase} focusGroup={focusGroup} focusPolicy={focusPolicy} gateTriggered={gateTriggered} frameRetracting={sceneFrameExit.phase === 'retracting' && sceneFrameExit.passageEntityId === entityId} active={activeObjectId === entityId && !readingMode} closeHint={closeHint} ariaLabel={`${doorLabel}，点击门后目标会在接近时自动开门并穿过`} renderFocusFrame={focusFrames.renderFrame} presentationActive={doorPresentationActive} presentationDurationMs={focusFrames.motionDurationMs(focusGroup)} onInteract={onInteract} onDoorTransitionComplete={onDoorTransitionComplete} dataAttributes={portalGlyphAttributes} />)
              }
              if (cell.kind === 'opening') {
                return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall scene-mainline-wall-opening ${visibilityClass}`} style={{ ...localCellStyle(cell), ...readingStyle }} aria-hidden="true"><SceneCharacters>{cell.label ?? cell.glyph}</SceneCharacters></span>
              }
              if (cell.kind === 'feature' && entityId) {
                const entity = featureEntity
                const featureRoomOwner = interiorRoomOwner(interiorWallRoomId)
                if (featureRoomOwner && !visibleInteriorRoomIds.has(interiorWallRoomId!)) {
                  return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall ${visibilityClass}`} style={{ ...localCellStyle(cell), ...readingStyle }} aria-hidden="true"><SceneCharacters>墙</SceneCharacters></span>
                }
                const directWallFeature = entity?.interactionBehavior === 'direct-wall'
                if (entity && (entity.interactive !== false || directWallFeature)) {
                  const focusGroup = `interactive:${cell.featureId ?? entityId}`
                  const featureOpacity = storefrontInteriorFeatureOpacity(featureRoomOwner, visibleInteriorStorefrontIds, paintedInteriorStorefrontId)
                  const presentationDurationMs = focusFrames.motionDurationMs(focusGroup)
              const readingProtected = readingPresentationPhase !== 'inactive' && readingOcclusionProtectedEntityIds.has(entityId)
                  const featureVisualState = resolveMainlineInteractionVisualState({
                    active: isCurrentInteractionSource(entityId) && !readingMode,
                    explored: exploredObjectIds.has(entityId) && !readingProtected,
                    tutorialCompleted: true,
                    tutorialEligible: false,
                  })
                  const feature = <button className={`scene-spatial-glyph scene-spatial-glyph--feature scene-mainline-wall scene-mainline-wall-feature ${visibilityClass} scene-mainline-interaction--${featureVisualState}`} type="button" style={{ ...localCellStyle(cell), pointerEvents: featureRoomOwner && featureOpacity.feature === 0 ? 'none' : 'auto' }} data-interior-active={interiorWallActive ? 'true' : 'false'} onClick={(event) => { event.stopPropagation(); onInteract(entityId) }} aria-label={`${entity.label}，点击让主角前往互动`} data-focus-target-id={cell.id} data-focus-target-group={focusGroup} data-focus-target-policy="interactive" data-focus-interaction-busy={activeObjectId === entityId && moving ? 'true' : undefined}>
                    <SceneCharacters style={{ opacity: featureRoomOwner ? featureOpacity.feature : 1, transition: featureRoomOwner ? `opacity ${presentationDurationMs}ms ease-in-out` : undefined }} data-focus-visual-group={focusGroup}>{cell.glyph}</SceneCharacters>
                    {focusFrames.renderFrame(focusGroup, interiorRoomPresentationActive(interiorWallRoomId))}
                  </button>
                  if (!featureRoomOwner) return extractProtectedWallNode(entityId, cell.id, <Fragment key={cell.id}>{feature}</Fragment>)
                  return <Fragment key={cell.id}>
                    <span className={`scene-spatial-glyph scene-mainline-wall ${visibilityClass}`} style={{ ...localCellStyle(cell), opacity: featureOpacity.wall, transition: `opacity ${sceneFrameDefaultMotionMs}ms ease-in-out` }} aria-hidden="true"><SceneCharacters>墙</SceneCharacters></span>
                    {feature}
                  </Fragment>
                }
              }
              if (cell.kind === 'feature') {
                const featureRoomOwner = interiorRoomOwner(interiorWallRoomId)
                if (featureRoomOwner && !visibleInteriorRoomIds.has(interiorWallRoomId!)) {
                  return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall ${visibilityClass}`} style={{ ...localCellStyle(cell), ...readingStyle }} aria-hidden="true"><SceneCharacters>{'\u5899'}</SceneCharacters></span>
                }
                const featureOpacity = storefrontInteriorFeatureOpacity(featureRoomOwner, visibleInteriorStorefrontIds, paintedInteriorStorefrontId)
                const feature = <span className={`scene-spatial-glyph scene-mainline-wall scene-mainline-wall-feature ${unit.sourceWallId === 'mining-industrial-edge' ? 'scene-mainline-industrial-facility' : ''} ${visibilityClass}`} style={{ ...localCellStyle(cell), opacity: featureRoomOwner ? featureOpacity.feature : 1, transition: `opacity ${sceneFrameDefaultMotionMs}ms ease-in-out` }} data-interior-active={interiorWallActive ? 'true' : 'false'} aria-hidden="true"><SceneCharacters>{cell.glyph}</SceneCharacters></span>
                if (!featureRoomOwner) return <Fragment key={cell.id}>{feature}</Fragment>
                return <Fragment key={cell.id}>
                  <span className={`scene-spatial-glyph scene-mainline-wall ${visibilityClass}`} style={{ ...localCellStyle(cell), opacity: featureOpacity.wall, transition: `opacity ${sceneFrameDefaultMotionMs}ms ease-in-out` }} aria-hidden="true"><SceneCharacters>{'\u5899'}</SceneCharacters></span>
                  {feature}
                </Fragment>
              }
              return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall ${visibilityClass}`} style={{ ...localCellStyle(cell), ...portalGlyphStyle }} {...portalGlyphAttributes} aria-hidden="true"><SceneCharacters>{cell.glyph ?? '墙'}</SceneCharacters></span>
              }
              const node = renderCell()
              if (!node) return null
              const entityId = cell.kind === 'feature' && cell.featureCellRole === 'flank'
                ? `wall-cell:${cell.id}`
                : cell.entityId ?? unit.entityId ?? cell.storefrontId ?? unit.storefrontId ?? cell.id
              const relatedEntityIds = [cell.storefrontId ?? unit.storefrontId, cell.entityId ?? unit.entityId].filter((id): id is string => Boolean(id) && id !== entityId)
              const storefront = cellStorefront
              return <MainlineReadingIdentityPlane key={`cell:${cell.id}`} identityKey={cell.id} entityId={entityId} relatedEntityIds={relatedEntityIds} protectedEntityIds={readingOcclusionProtectedEntityIds} worldBounds={cellWorldBounds} readingRect={retainedOcclusionSnapshot?.rect} maskBaseId={readingOcclusionMaskId} active={readingOcclusionActive} className="scene-mainline-reading-identity-plane scene-mainline-reading-identity-plane--wall">{node}</MainlineReadingIdentityPlane>
            })}
          </div>
          <div className="scene-mainline-counter-layer" data-reading-occlusion-layer="counter">
          {(() => {
            const visibleCounterSurfaces = counterSurfaces.filter(parts => !parts[0].counterSurface?.roomId || visibleInteriorRoomIds.has(parts[0].counterSurface.roomId))
            const renderCounter = (parts: typeof counterSurfaces[number]) => {
            const meta = parts[0].counterSurface!
            const entityId = meta.interactionEntityId
            const boxes = parts.map(part => {
              const outline = part.counterSurface?.outlineBounds
              const bounds = outline ?? { x: part.x, y: part.y, width: part.width, height: part.height }
              return { x: bounds.x * 19.2, y: bounds.y * 10.8, width: bounds.width * 19.2, height: bounds.height * 10.8 }
            })
            const labelBoxes = parts.map(part => {
              const label = part.counterSurface!.label ?? '柜台'
              const vertical = part.counterSurface!.orientation === 'vertical'
              const width = (vertical ? 1 : Array.from(label).length) * 16
              const height = (vertical ? Array.from(label).length : 1) * 16
              const centerX = (part.x + part.width / 2) * 19.2
              const centerY = (part.y + part.height / 2) * 10.8
              return { x: centerX - width / 2, y: centerY - height / 2, width, height }
            })
            const counterBounds = unionWorldBounds([...boxes, ...labelBoxes], 1)
            return <MainlineReadingIdentityPlane key={meta.groupId} identityKey={`counter:${meta.groupId}`} entityId={entityId} protectedEntityIds={readingOcclusionProtectedEntityIds} worldBounds={counterBounds} readingRect={retainedOcclusionSnapshot?.rect} maskBaseId={readingOcclusionMaskId} active={readingOcclusionActive} className="scene-mainline-reading-identity-plane scene-mainline-reading-identity-plane--counter"><MainlineCounterSurface boundedWrapper coordinateBounds={counterBounds} parts={parts} objects={scene.objects} onInteract={onInteract} presentationActive={interiorRoomPresentationActive(meta.roomId)}/></MainlineReadingIdentityPlane>
            }
            return visibleCounterSurfaces.map(renderCounter)
          })()}
          </div>
          {/* Street lane objects stay rendered for the visual fade; their current-space targets and collisions remain unchanged. */}
          <div className="scene-mainline-object-layer" data-reading-occlusion-layer="object">
            {visibleObjectEntities.map(entity => {
              const object = geometrySnapshot.objects.get(entity.id)
              const normalizedBounds = object?.visualBounds ?? mainlineEntityVisualBounds(scene, entity, geometrySnapshot.layout, renderScreenMetrics)
                ?? mainlineLabelFootprint(entity.label, object?.position ?? entity.position, renderScreenMetrics, { vertical: entity.textLayout === 'vertical', visualScale: entity.visualScale, lineHeight: 1.2 })
              const objectBounds = mainlineReadingWorldBox(normalizedBounds, value => value, entity.focusFrame === 'interactive' ? 5 : 0)
              return <MainlineReadingIdentityPlane key={entity.id} identityKey={`object:${entity.id}`} entityId={entity.id} protectedEntityIds={readingOcclusionProtectedEntityIds} worldBounds={objectBounds} readingRect={retainedOcclusionSnapshot?.rect} maskBaseId={readingOcclusionMaskId} active={readingOcclusionActive} className="scene-mainline-reading-identity-plane scene-mainline-reading-identity-plane--object">{renderMainlineObject(entity, objectBounds)}</MainlineReadingIdentityPlane>
            })}
          </div>

          {scene.npcs.map((npc) => {
            if (scene.ambientNpcRoutes.some((schedule) => schedule.npcId === npc.id)) return null
            if (hiddenNpcIds?.has(npc.id)) return null
            if (npc.roomId && !renderedRoomIds.has(npc.roomId)) return null
            const npcPosition = npcPositions?.get(npc.id) ?? resolveMainlineNpcPosition(scene, npc.id, layout, { geometrySnapshot, screenMetrics: renderScreenMetrics })
            const streetNpc = streetSpaceContentRetained && !npc.roomId
            const npcSnapshot = npcRuntimeSnapshots?.get(npc.id)
            const npcSeatId = mainlineNpcVisualSeatId(scene, npc.id, npcSnapshot)
            return <MemoMainlineNpcActor
              key={npc.id}
              sceneId={scene.id}
              npc={npc}
              position={npcPosition}
              snapshot={npcSnapshot}
              seatId={npcSeatId}
              seatPosition={npcSeatId ? geometrySnapshot.objects.get(npcSeatId)?.position : undefined}
              screenMetrics={renderScreenMetrics}
              interactive={npc.interactive !== false}
              presentationActive={streetNpc ? streetPresentationActive : interiorRoomIsVisuallyActive(npc.roomId)}
              readingOpacity={mainlineReadingOpacityForActor(npc.id, dialogueParticipantNpcIds, actorReadingOpacity(npcPosition))}
              readingProtected={Boolean(readingMode && (dialogueParticipantNpcIds.has(npc.id) || readingProtectedEntityIds.has(npc.id)))}
              debugRuntimeEvidence={debugRuntimeEvidence}
              onInteract={onNpcInteract}
            />
          })}

          {ambientNpcActorLayer && (streetSpaceContentRetained
            ? <div
                className="scene-mainline-street-ambient-layer"
                aria-hidden={!streetPresentationActive}
                style={{ position: 'absolute', inset: 0, opacity: streetPresentationActive ? 1 : 0, pointerEvents: 'none', transition: `opacity ${sceneFrameDefaultMotionMs}ms ease-in-out` }}
              >{ambientNpcActorLayer}</div>
            : ambientNpcActorLayer)}

          {cafeSpatialQa && <div className="scene-spatial-qa" aria-hidden="true">
            <svg className="scene-spatial-qa__geometry" viewBox="0 0 100 100" preserveAspectRatio="none">
              {cafeQaStaffArea && <rect className="scene-spatial-qa__staff" x={cafeQaStaffArea.x} y={cafeQaStaffArea.y} width={cafeQaStaffArea.width} height={cafeQaStaffArea.height} />}
              {cafeQaCounter && <rect className="scene-spatial-qa__counter" x={cafeQaCounter.x} y={cafeQaCounter.y} width={cafeQaCounter.width} height={cafeQaCounter.height} />}
              {cafeQaAccessBoundary && <line className="scene-spatial-qa__boundary" x1={cafeQaAccessBoundary.start.x} y1={cafeQaAccessBoundary.start.y} x2={cafeQaAccessBoundary.end.x} y2={cafeQaAccessBoundary.end.y} />}
              {cafeQaBackDoor && <rect className="scene-spatial-qa__door" x={cafeQaBackDoor.collision.x} y={cafeQaBackDoor.collision.y} width={cafeQaBackDoor.collision.width} height={cafeQaBackDoor.collision.height} />}
              {cafeQaBackDoor && <rect className="scene-spatial-qa__doorway" x={cafeQaBackDoor.doorway.x} y={cafeQaBackDoor.doorway.y} width={cafeQaBackDoor.doorway.width} height={cafeQaBackDoor.doorway.height} />}
              {debugCafeSpatialQa?.path.length && debugCafeSpatialQa.path.length > 1 && <polyline className="scene-spatial-qa__path" points={debugCafeSpatialQa.path.map((point) => `${point.x},${point.y}`).join(' ')} />}
              {debugCafeSpatialQa && <circle className="scene-spatial-qa__requested" cx={debugCafeSpatialQa.requestedTarget.x} cy={debugCafeSpatialQa.requestedTarget.y} r=".65" />}
              {debugCafeSpatialQa && <circle className="scene-spatial-qa__resolved" cx={debugCafeSpatialQa.resolvedNavigableTarget.x} cy={debugCafeSpatialQa.resolvedNavigableTarget.y} r=".65" />}
            </svg>
            <div className="scene-spatial-qa__legend">
              <strong>CAFÉ QA</strong>
              <span>cyan staff · red counter · orange back door · violet boundary</span>
              <span>{debugCafeSpatialQa ? `route: ${debugCafeSpatialQa.reachedRequestedTarget ? 'raw target' : 'projected'}${debugCafeSpatialQa.deniedAccessRegionId ? ' · staff intent' : ''}` : 'tap open ground to show raw / resolved / route'}</span>
            </div>
          </div>}
          {destination && <div className={`scene-walk-target ${moving ? 'is-active' : ''}`} style={{ left: `${destination.x}%`, top: `${destination.y}%` }} aria-hidden="true" />}
          {showProtagonist && <div className={`scene-protagonist ${moving ? 'is-moving' : ''} ${readingMode ? 'is-reading-protected' : ''}`} style={{ left: `${protagonistVisualPosition.x}%`, top: `${protagonistVisualPosition.y}%`, '--scene-mainline-object-font-size': `${mainlineEntityFontSizePx(null, renderScreenMetrics)}px` } as CSSProperties} data-actor-id="protagonist" data-runtime-x={debugRuntimeEvidence ? position.x : undefined} data-runtime-y={debugRuntimeEvidence ? position.y : undefined} data-rendered-x={debugRuntimeEvidence ? scene.id === 'commercial-street' ? projectCommercialStreetX(protagonistVisualPosition.x, renderScreenMetrics) : protagonistVisualPosition.x : undefined} data-rendered-y={debugRuntimeEvidence ? protagonistVisualPosition.y : undefined} data-seat-entity-id={playerSeatId ?? undefined}>
            <span className="scene-protagonist__grid-content">
            {protagonistPresentation.kind === 'dot'
              ? <span className="scene-protagonist__dot" aria-label="修杰所在位置" />
              : <span className="scene-protagonist__seat-label" aria-label="修杰，已坐下">{protagonistPresentation.label}</span>}
            </span>
            {carriedMilkTea && !playerSeatId && <button type="button" className="scene-protagonist__drink-icon scene-protagonist__drink-icon--milk-tea" aria-label="修杰带着奶茶，点击饮用" onClick={(event) => { event.stopPropagation(); onMilkTeaInteract?.() }} />}
          </div>}
          {worldQuestionMark?.visible && <span
            className="scene-commercial-question-mark"
            style={{ left: `${worldQuestionMark.anchor.x}%`, top: `${worldQuestionMark.anchor.y}%` }}
            data-commercial-question-mark="true"
            data-world-anchor-x={worldQuestionMark.anchor.x}
            data-world-anchor-y={worldQuestionMark.anchor.y}
            aria-hidden="true"
          ><span className="scene-commercial-question-mark__visual">?</span></span>}
          </>
        <div className="scene-mainline-reading-layer">
          {(sceneEcho || (dialogue && dialogueLine && dialoguePosition)) && (() => {
            const isDialogue = !sceneEcho && Boolean(dialogue && dialogueLine && dialoguePosition)
            const isLeaving = sceneEcho?.phase === 'leaving' || (isDialogue && dialoguePhase === 'leaving')
            const text = displayReadingText
            const sourcePosition = sceneEcho?.position ?? dialoguePosition!
            const position = readingDisplayPosition ?? sourcePosition
            const group = sceneEcho ? `echo:${sceneEcho.id}` : `dialogue:${dialogueLine!.id}`
            const hasNextSegment = sceneEcho
              ? sceneEcho.segmentIndex + 1 < sceneEcho.segments.length
              : dialogueSegmentIndex + 1 < dialogueSegmentCount || Boolean(dialogue && dialogueLineIndex! + 1 < dialogue.lines.length)
            const echoLayout = presentedReadingLayout ?? mainlineEchoLayout(text, readingMetrics, {
              speaker: isDialogue ? dialogueLine!.speaker : undefined,
              maxWidthPx: displayReadingMaxWidthPx,
            })
            if (isDialogue) {
              const session = `${scene.id}:${dialogue!.triggerEntityId}`
              const metrics = `${readingMetrics.width}:${readingMetrics.height}:${readingMetrics.viewportWidth}:${worldScale}:${displayReadingMaxWidthPx}`
              if (speakerPlacementRef.current?.session !== session || speakerPlacementRef.current.metrics !== metrics) {
                speakerPlacementRef.current = { session, metrics, anchor: mainlineSpeakerAnchor(dialogue!.lines, readingMetrics, { x: projectReadingX(sourcePosition.x), y: sourcePosition.y }, { x: 0, y: 0 }, worldScale, displayReadingMaxWidthPx) }
              }
            }
            const baseSpeakerAnchor = isDialogue ? speakerPlacementRef.current!.anchor : null
            const speakerAnchor = baseSpeakerAnchor ? { ...baseSpeakerAnchor, left: baseSpeakerAnchor.left + readingDisplayShift.x, top: baseSpeakerAnchor.top + readingDisplayShift.y } : null
            return <Fragment>
            {isDialogue && speakerAnchor && <div
              key={`speaker:${scene.id}:${dialogue!.triggerEntityId}`}
              className={`scene-mainline-speaker-anchor ${isLeaving ? 'is-leaving' : ''}`}
              aria-live="polite"
              style={{ left: `${speakerAnchor.left}%`, top: `${speakerAnchor.top}%`, width: `${speakerAnchor.worldWidthPx}px`, minHeight: `${echoLayout.heightPx / worldScale}px`, fontSize: `${echoLayout.fontSizePx / worldScale}px` }}
            ><DialogueSpeaker speaker={dialogueLine!.speaker} /></div>}
            <div
              key={readingLayoutContinuityKey ?? sceneEcho?.id ?? dialogueLine!.id}
              className={`scene-mainline-text scene-mainline-text--${isDialogue ? 'dialogue' : 'observation'} ${isLeaving ? 'is-leaving' : ''}`}
              style={{
                left: `${speakerAnchor
                  ? speakerAnchor.left + speakerAnchor.worldWidthPx / sceneDesignReferenceMetrics.width * 50
                  : projectReadingX(position.x)}%`,
                top: `${speakerAnchor?.top ?? position.y}%`,
                '--scene-mainline-text-width': `${echoLayout.widthPx / worldScale}px`,
                '--scene-mainline-text-height': `${echoLayout.heightPx / worldScale}px`,
                fontSize: `${echoLayout.fontSizePx / worldScale}px`,
                maxWidth: `${Math.max(1, displayReadingMaxWidthPx / worldScale)}px`,
                overflow: 'hidden',
              } as CSSProperties}
              aria-live="polite"
              data-scene-interaction-text={sceneEcho?.entityId ?? dialogue?.triggerEntityId ?? 'scene'}
              data-scene-echo={sceneEcho ? sceneEcho.entityId ?? 'scene' : undefined}
              data-scene-observation-typing={sceneEcho ? String(sceneEcho.typing) : undefined}
              data-scene-dialogue={isDialogue ? dialogue?.triggerEntityId : undefined}
              data-dialogue-line-id={isDialogue ? dialogueLine?.id : undefined}
              data-dialogue-speaker={isDialogue ? dialogueLine?.speaker : undefined}
              data-scene-segment-index={(sceneEcho?.segmentIndex ?? dialogueSegmentIndex) + displayOverflowIndex}
              data-scene-segment-count={(sceneEcho?.segments.length ?? dialogueSegmentCount) + fittedReadingSegments.length - 1}
              data-scene-segment-advance={hasNextSegment || displayOverflowIndex + 1 < fittedReadingSegments.length ? 'available' : 'complete'}
              data-scene-reading-page-fit={readingFit?.fits === false ? 'false' : 'true'}
              data-scene-reading-layout-width={echoLayout.widthPx}
              data-scene-reading-layout-height={echoLayout.heightPx}
              data-scene-reading-layout-transitioning={String(readingLayoutTransitioning)}
              data-scene-reading-world-scale={worldScale}
              data-scene-reading-page-key={readingLayoutPageKey ?? undefined}
              data-scene-reading-page-index={displayOverflowIndex}
              data-scene-reading-position-x={readingDisplayPosition?.x}
              data-scene-reading-position-y={readingDisplayPosition?.y}
              data-scene-reading-occlusion-width={readingOcclusionRect?.width}
              data-scene-reading-occlusion-height={readingOcclusionRect?.height}
              data-scene-dialogue-ready={isDialogue ? String(dialogueReady) : undefined}
              onAnimationEnd={(event) => {
                if (!isLeaving || event.target !== event.currentTarget) return
                if (sceneEcho) onSceneEchoExitComplete?.(sceneEcho.id, readingDisplayPosition ?? position, renderCameraOffset)
                else onDialogueExitComplete?.()
              }}
            >
              {isDialogue && <span className="scene-mainline-text__speaker scene-mainline-text__speaker-space" aria-hidden="true">&nbsp;</span>}
              {isDialogue
                ? <DialogueText group={`${group}:${dialogueSegmentIndex}:fit:${displayOverflowIndex}`} pageKey={readingLayoutPageKey ?? group} text={text} onReadyChange={updateDialogueReady} onFlipComplete={releaseReadingPageAdvance} />
                : <ObservationText echoId={sceneEcho!.id} pageKey={`${sceneEcho!.id}:${sceneEcho!.segmentIndex}:${displayOverflowIndex}`} text={text} typing={sceneEcho!.typing} onTypingComplete={onSceneEchoTypingComplete} onFlipComplete={releaseReadingPageAdvance} />}
            </div>
            </Fragment>
          })()}
          {sceneAction && <div
            ref={sceneActionRef}
            className="scene-mainline-action scene-mainline-action--reading"
            style={{
              left: `${(scene.id === 'commercial-street' ? projectCommercialStreetX(sceneActionPlacement?.position.x ?? sceneAction.position.x, renderScreenMetrics) : sceneActionPlacement?.position.x ?? sceneAction.position.x) + sceneActionCameraOffset.x}%`,
              top: `${(sceneActionPlacement?.position.y ?? sceneAction.position.y) + sceneActionCameraOffset.y}%`,
              maxWidth: `${Math.max(1, Math.min(sceneActionMaxWidthPx, sceneActionPlacement?.availableWidthPx ?? sceneActionMaxWidthPx) / worldScale)}px`,
              maxHeight: sceneActionPlacement ? `${Math.max(1, sceneActionPlacement.availableHeightPx / worldScale)}px` : undefined,
              overflowY: sceneActionPlacement?.overflowY ? 'auto' : 'visible',
              visibility: matchingSceneActionSize && sceneActionPlacement ? 'visible' : 'hidden',
              pointerEvents: matchingSceneActionSize && sceneActionPlacement ? undefined : 'none',
            }}
            data-scene-action={sceneAction.entityId ?? 'scene'}
            data-scene-action-position-x={sceneAction.position.x}
            data-scene-action-position-y={sceneAction.position.y}
            data-scene-action-rendered-x={sceneActionPlacement?.position.x ?? sceneAction.position.x}
            data-scene-action-rendered-y={sceneActionPlacement?.position.y ?? sceneAction.position.y}
            data-scene-action-measured-width={matchingSceneActionSize?.width}
            data-scene-action-measured-height={matchingSceneActionSize?.height}
            data-scene-action-max-height={sceneActionPlacement?.availableHeightPx}
            data-scene-action-overflow-y={String(sceneActionPlacement?.overflowY ?? false)}
            onClick={(event) => event.stopPropagation()}
          >
            {sceneAction.options.map((option, index) => (
              <EntryButtonSurface
                key={option}
                visible
                entryId={`scene-action:${sceneAction.entityId ?? 'scene'}:${option}`}
                label={option}
                contentSized
                materialMode="world"
                worldLayer="surface"
                disabled={sceneAction.phase === 'committing'}
                onActionStart={() => onSceneActionStart?.(index)}
                onActionComplete={() => onSceneActionChoice?.(index)}
              />
            ))}
          </div>}
        </div>
          {readingMaskRects.length > 0 && <svg className="scene-dialogue-dimmer-mask-defs" aria-hidden="true" data-reading-protection-count={readingMaskRects.length}>
            <defs>
              <mask id={readingMaskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1">
                <rect x="0" y="0" width="1" height="1" fill="white" />
                {readingMaskRects.map((rect, index) => <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="black" data-reading-protection-hole="true" />)}
              </mask>
            </defs>
          </svg>}
          <div ref={dimmerRef} className={`scene-dialogue-dimmer${readingMode ? ` scene-dialogue-dimmer--${readingMode}` : ''}`} style={{ opacity: 0, left: `${sceneRenderBounds.x}%`, top: `${sceneRenderBounds.y}%`, width: `${sceneRenderBounds.width}%`, height: `${sceneRenderBounds.height}%`, mask: readingMaskRects.length ? `url(#${readingMaskId})` : undefined, WebkitMaskImage: readingMaskRects.length ? `url(#${readingMaskId})` : undefined }} aria-hidden="true" />
        </div>
          {readingMode && <>
            <button
              type="button"
              className="scene-dialogue-shield"
              aria-label="继续阅读"
              data-scene-dialogue-shield="true"
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                if (readingPageAdvanceLockedRef.current) return
                if (readingPresentationMode === 'observation' && sceneEcho?.typing) {
                  typingCompletionLockRef.current = true
                  lockReadingPageAdvance()
                  onSceneEchoAdvance?.()
                  return
                }
                if (displayOverflowIndex + 1 < fittedReadingSegments.length) {
                  lockReadingPageAdvance()
                  if (readingSessionKey) setReadingOverflowPage({ sessionKey: readingSessionKey, key: readingOverflowKey, index: displayOverflowIndex + 1 })
                  return
                }
                setReadingOverflowPage(null)
                if (readingMode === 'dialogue') {
                  if (currentDialogueGroupRef.current !== null
                    && dialogueAdvanceConsumedGroupRef.current !== currentDialogueGroupRef.current
                    && dialogueReadyGroupRef.current === currentDialogueGroupRef.current) {
                    lockReadingPageAdvance()
                    dialogueAdvanceConsumedGroupRef.current = currentDialogueGroupRef.current
                    dialogueReadyGroupRef.current = null
                    setDialogueReady(false)
                    onDialogueAdvance?.()
                  }
                  return
                }
                lockReadingPageAdvance()
                onSceneEchoAdvance?.()
              }}
            />
          </>}
        {(debugInput || debugNpcMovement) && <div className="scene-input-debug" aria-live="polite">
          {debugNpcMovement && <button type="button" onClick={(event) => { event.stopPropagation(); onDebugNpcMovement?.() }}>演示店员移动</button>}
          <div>输入诊断（不改变寻路）</div>
          {!inputDiagnostic && <div>尚未收到空白区域输入</div>}
          {inputDiagnostic && <>
            <div>来源：{inputDiagnostic.source} / pointer：{inputDiagnostic.pointerType} / target：{inputDiagnostic.target}</div>
            <div>client：{inputDiagnostic.client.x.toFixed(1)}, {inputDiagnostic.client.y.toFixed(1)}</div>
            <div>stage：left {inputDiagnostic.rect.left.toFixed(1)} / top {inputDiagnostic.rect.top.toFixed(1)} / {inputDiagnostic.rect.width.toFixed(1)}×{inputDiagnostic.rect.height.toFixed(1)}</div>
            <div>screen：{inputDiagnostic.screenPoint.x.toFixed(2)}%, {inputDiagnostic.screenPoint.y.toFixed(2)}%</div>
            <div>mapped：{inputDiagnostic.mappedPoint.x.toFixed(2)}%, {inputDiagnostic.mappedPoint.y.toFixed(2)}%</div>
          </>}
        </div>}
      </div>
    </section>
  )
}
