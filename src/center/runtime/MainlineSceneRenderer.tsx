'use client'

import { Fragment, memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { MainlineCounterSurface } from './MainlineCounterSurface'
import EntryButtonSurface from '../../components/EntryButtonSurface'
import EntryButtonFrame from '../../components/EntryButtonFrame'
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
import { mainlineEchoLayout, mainlineSpeakerAnchor, mainlineSpeakerPageAnchor, type MainlineEchoLayout } from './mainlineEchoLayout'
import { interpolateMainlineReadingPageLayout, mainlineReadingPageFlipDurationMs, mainlineReadingPageRollEnvelope, mainlineReadingRollOffsets, previousMainlineReadingPageForFlip, settleMainlineReadingPageFlip, snapshotMainlineReadingPage, type MainlineReadingPageSnapshot } from './mainlineReadingPageFlip'
import { interpolateMainlineReadingLayout, mainlineReadingPageTransitionDurationMs, mainlineReadingLayoutTransitionProgress, mainlineReadingLayoutsHaveSameSize } from './mainlineReadingLayoutTransition'
import { mainlineDialogueReadingSessionKey, mainlineReadingAnchorContextKey as createReadingAnchorContextKey, mainlineReadingAnchorForSession, mainlineReadingPresentationForPhase, type MainlineReadingPresentationSnapshot } from './mainlineReadingPresentation'
import { mainlineReadingPageKey } from './mainlineReadingPageKey'
import { mainlineObservationPageIsSettled } from './mainlineObservationTyping'
import { mainlineReadingTextMotionCanAnimate, startMainlineReadingTextMotion, type MainlineReadingTextMotion } from './mainlineReadingTextMotion'
import { mainlineReadingPageAdvanceResumeGraceMs, mainlineReadingPageAdvanceStartupWatchdogMs, mainlineReadingPageAdvanceTokenIsCurrent, mainlineReadingPageAdvanceWatchdogMayRelease } from './mainlineReadingPageAdvance'
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
import { currentMainlineReadingTargetIds, mainlinePlaceReadingAction, mainlinePlaceReadingBox, mainlineReadingActionLayerPosition, mainlineReadingMaskRects, mainlineReadingOverflowPageForSession, mainlineReadingOverflowPageIndex, mainlineReadingPageIndexForSourceOffset } from './mainlineReadingProtection'
import { createMainlineReadingSessionLayoutCache, mainlineReadingMeasurementKey, type MainlineReadingSessionLayoutCache, type MainlineReadingSessionTextEntry } from './mainlineReadingLayoutSession'
import { useMainlineReadingFontRevision } from './useMainlineReadingFontRevision'
import { MainlineReadingIdentityPlane } from './MainlineReadingIdentityPlane'
import { mainlineDialogueStageActorOpacity, mainlineDialogueTurnAllowsOptions } from './mainlineDialogueStage'
import { mainlineReadingLocalPercent, mainlineReadingOcclusionCellIdentity, mainlineReadingOcclusionFadeWorldPx, mainlineReadingOcclusionIntersects, mainlineReadingOcclusionRect, mainlineReadingOccludedIdentityKeys, mainlineReadingWorldBox, retainMainlineReadingOcclusionSnapshot, type MainlineReadingOcclusionCandidate } from './mainlineReadingOcclusion'

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
  readingSessionLayoutCache?: MainlineReadingSessionLayoutCache | null
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
  dialogueTextSessionId?: number
  dialogueTextMotion?: MainlineReadingTextMotion
  dialogueStage?: { roomId: string; speakerActorId: string | null; participantActorIds: ReadonlySet<string>; hiddenEntityIds: ReadonlySet<string> } | null
  dialogueHandoffActive?: boolean
  dialogueHandoffFadeDurationMs?: number
  readingMode?: 'observation' | 'dialogue' | null
  onDialogueExitComplete?: () => void
  onDialogueAdvance?: () => void
  onDialogueTypingSkip?: (sessionId: number) => void
  onDialogueTextMotionComplete?: (sessionId: number, motion: MainlineReadingTextMotion) => void
  sceneEcho?: { id: number; entityId?: string; text: string; segments: readonly string[]; segmentIndex: number; position: Point; options?: readonly string[]; textMotion: MainlineReadingTextMotion; phase?: 'leaving' } | null
  onSceneEchoAdvance?: () => void
  onSceneEchoTextMotionComplete?: (echoId: number, sessionKey: string, motion: MainlineReadingTextMotion) => void
  onSceneEchoExitComplete?: (echoId: number, displayPosition: Point, displayCameraOffset: Point) => void
  sceneAction?: { id: number; entityId?: string; options: readonly string[]; position: Point; cameraOffset?: Point; phase?: 'active' | 'committing' | 'exiting' } | null
  onSceneActionStart?: (actionId: number, index: number) => void
  onSceneActionChoice?: (actionId: number, index: number) => void
  onSceneActionExitComplete?: (actionId: number, index: number) => void
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
  contextKey: string
  rect: CollisionBox
  protectedEntityIds: ReadonlySet<string>
  hiddenIdentityKeys: ReadonlySet<string>
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
  readingStageBrightness?: boolean
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

function ReadingPageFlip({ pageKey, continuityKey, visibleText, layout, worldScale, children, mode, lockToken, onFlipStart, onFlipComplete, onFlipCancel, onSettled }: { pageKey: string; continuityKey: string; visibleText: string; layout: MainlineEchoLayout; worldScale: number; children: React.ReactNode; mode: 'observation' | 'dialogue'; lockToken: number; onFlipStart?: (token: number) => void; onFlipComplete?: (token: number) => void; onFlipCancel?: (token: number) => void; onSettled?: (pageKey: string) => void }) {
  const [page, setPage] = useState<{ key: string; continuityKey: string; previous: MainlineReadingPageSnapshot | null; flipping: boolean }>({ key: pageKey, continuityKey, previous: null, flipping: false })
  const latestPageSnapshotRef = useRef<MainlineReadingPageSnapshot | null>(null)
  // Derive the incoming state during render. Waiting for the layout effect to
  // copy new props into state paints the next sentence once at y=0 first.
  const presentedPage = page.key === pageKey
    ? page
    : {
      key: pageKey,
      continuityKey,
      previous: page.continuityKey === continuityKey
        ? previousMainlineReadingPageForFlip(latestPageSnapshotRef.current, { continuityKey, pageKey })
        : null,
      flipping: page.continuityKey === continuityKey,
    }
  const stackRef = useRef<HTMLSpanElement>(null)
  const activeFlipTokenRef = useRef<number | null>(null)
  const onFlipStartRef = useRef(onFlipStart)
  onFlipStartRef.current = onFlipStart
  const onFlipCompleteRef = useRef(onFlipComplete)
  onFlipCompleteRef.current = onFlipComplete
  const onFlipCancelRef = useRef(onFlipCancel)
  onFlipCancelRef.current = onFlipCancel
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled
  useEffect(() => () => {
    const token = activeFlipTokenRef.current
    activeFlipTokenRef.current = null
    if (token !== null) onFlipCancelRef.current?.(token)
  }, [])
  useIsomorphicLayoutEffect(() => {
    if (page.key !== pageKey) {
      setPage({
        key: pageKey,
        continuityKey,
        previous: presentedPage.previous,
        flipping: presentedPage.flipping,
      })
    }
    latestPageSnapshotRef.current = snapshotMainlineReadingPage({ continuityKey, pageKey, visibleText, layout, worldScale })
  }, [continuityKey, layout.fontSizePx, layout.heightPx, layout.widthPx, page.key, pageKey, presentedPage.flipping, presentedPage.previous, visibleText, worldScale])
  const contentWidth = Math.max(layout.widthPx, presentedPage.previous?.layout.widthPx ?? 0) / Math.max(.001, worldScale)
  const contentInset = mode === 'dialogue' ? 7 + Math.max(19.44, 1.1988 * layout.fontSizePx / Math.max(.001, worldScale)) : 4
  const contentHeight = Math.max(1, Math.max(layout.heightPx, presentedPage.previous?.layout.heightPx ?? 0) / Math.max(.001, worldScale) - contentInset)
  useEffect(() => {
    const node = stackRef.current
    if (!presentedPage.flipping || !node || presentedPage.key !== pageKey) return
    const setProgress = (progress: number) => {
      // Match the Cafe storefront (bottom edge): the old glyph leaves down
      // and the new glyph enters from above.
      const offsets = mainlineReadingRollOffsets(contentHeight, progress)
      node.style.setProperty('--reading-page-out-y', `${offsets.outgoing}px`)
      node.style.setProperty('--reading-page-in-y', `${offsets.incoming}px`)
      node.dataset.flipProgress = progress.toFixed(4)
    }
    setProgress(0)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1)
      onFlipCompleteRef.current?.(lockToken)
      setPage(current => settleMainlineReadingPageFlip(current, pageKey))
      return
    }
    const startedAt = performance.now()
    activeFlipTokenRef.current = lockToken
    onFlipStartRef.current?.(lockToken)
    let frame = 0
    const advance = (now: number) => {
      const elapsed = Math.max(0, now - startedAt)
      const progress = storefrontCharacterProgress(0, 1, elapsed, mainlineReadingPageFlipDurationMs)
      setProgress(progress)
      if (elapsed >= mainlineReadingPageFlipDurationMs) {
        if (activeFlipTokenRef.current === lockToken) activeFlipTokenRef.current = null
        onFlipCompleteRef.current?.(lockToken)
        setPage(current => settleMainlineReadingPageFlip(current, pageKey))
        return
      }
      frame = window.requestAnimationFrame(advance)
    }
    frame = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frame)
  }, [contentHeight, lockToken, presentedPage.flipping, presentedPage.key, pageKey])
  useEffect(() => {
    if (!presentedPage.flipping && presentedPage.key === pageKey) onSettledRef.current?.(pageKey)
  }, [presentedPage.flipping, presentedPage.key, pageKey])

  return <span ref={stackRef} className={`scene-mainline-page-stack scene-mainline-page-stack--${mode}`} data-page-flip={presentedPage.flipping ? 'running' : 'settled'} style={{ width: `${contentWidth}px`, height: `${contentHeight}px`, '--reading-page-out-y': '0px', '--reading-page-in-y': presentedPage.flipping ? `${-contentHeight}px` : '0px' } as CSSProperties}>
    {presentedPage.flipping && presentedPage.previous !== null && <span className="scene-mainline-page scene-mainline-page--outgoing" data-reading-page-role="outgoing" data-reading-page-outgoing-key={presentedPage.previous.pageKey} data-reading-page-outgoing-width={presentedPage.previous.layout.widthPx} data-reading-page-outgoing-height={presentedPage.previous.layout.heightPx} style={{ width: `${presentedPage.previous.layout.widthPx / Math.max(.001, worldScale)}px`, height: '100%', fontSize: `${presentedPage.previous.layout.fontSizePx / Math.max(.001, worldScale)}px` }} aria-hidden="true">{presentedPage.previous.visibleText}</span>}
    <span
      className={`scene-mainline-page ${presentedPage.flipping ? 'scene-mainline-page--incoming' : 'scene-mainline-page--current'}`}
      data-reading-page-role={presentedPage.flipping ? 'incoming' : 'current'}
      style={{ width: `${layout.widthPx / Math.max(.001, worldScale)}px` }}
    >{children}</span>
  </span>
}

function useReadingTextMotion({ sessionKey, pageKey, text, motion, paused = false, onComplete }: { sessionKey: string; pageKey: string; text: string; motion: MainlineReadingTextMotion; paused?: boolean; onComplete?: (sessionKey: string, motion: MainlineReadingTextMotion) => void }) {
  const characters = useMemo(() => Array.from(mainlineVisiblePresentationText(text)), [text])
  const [settledPageKey, setSettledPageKey] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ key: string; count: number } | null>(null)
  const pageSettled = mainlineObservationPageIsSettled(pageKey, settledPageKey)
  const animationKey = `${sessionKey}\u0000${motion}`
  const progressRef = useRef<{ key: string; count: number } | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const visibleCount = progress?.key === animationKey
    ? progress.count
    : motion === 'deleting' ? characters.length : 0
  const visibleText = motion === 'static'
    ? characters.join('')
    : motion === 'deleted'
      ? ''
      : motion === 'deleting' && !pageSettled
        ? characters.join('')
        : characters.slice(0, visibleCount).join('')

  useEffect(() => {
    if (paused || (motion !== 'typing' && motion !== 'deleting') || !mainlineReadingTextMotionCanAnimate(motion, pageSettled)) return
    const previous = progressRef.current?.key === animationKey ? progressRef.current.count : motion === 'deleting' ? characters.length : 0
    return startMainlineReadingTextMotion({
      motion,
      textLength: characters.length,
      visibleCount: previous,
      intervalMs: mainlineObservationTypingIntervalMs,
      request: callback => window.requestAnimationFrame(callback),
      cancel: id => window.cancelAnimationFrame(id),
      isPaused: () => pausedRef.current,
      onProgress: next => {
        progressRef.current = { key: animationKey, count: next }
        setProgress(current => current?.key === animationKey && current.count === next ? current : { key: animationKey, count: next })
      },
      onComplete: () => onComplete?.(sessionKey, motion),
    })
  }, [animationKey, characters, motion, onComplete, pageSettled, paused, sessionKey])

  return { visibleText, onSettled: (settledKey: string) => {
    if (settledKey === pageKey) setSettledPageKey(settledKey)
  } }
}

function ObservationText({ echoId, continuityKey, pageKey, text, motion, paused, layout, worldScale, lockToken, onMotionComplete, onFlipStart, onFlipComplete, onFlipCancel, onSettled }: { echoId: number; continuityKey: string; pageKey: string; text: string; motion: MainlineReadingTextMotion; paused: boolean; layout: MainlineEchoLayout; worldScale: number; lockToken: number; onMotionComplete?: (echoId: number, sessionKey: string, motion: MainlineReadingTextMotion) => void; onFlipStart?: (token: number) => void; onFlipComplete?: (token: number) => void; onFlipCancel?: (token: number) => void; onSettled?: (pageKey: string) => void }) {
  const sessionKey = `echo:${echoId}`
  const completeMotion = useCallback((key: string, completedMotion: MainlineReadingTextMotion) => onMotionComplete?.(echoId, key, completedMotion), [echoId, onMotionComplete])
  const textMotion = useReadingTextMotion({ sessionKey, pageKey, text, motion, paused, onComplete: completeMotion })
  return <span className="scene-mainline-text__observation" data-scene-text-mode="observation">
    <ReadingPageFlip pageKey={pageKey} continuityKey={continuityKey} visibleText={textMotion.visibleText} layout={layout} worldScale={worldScale} mode="observation" lockToken={lockToken} onFlipStart={onFlipStart} onFlipComplete={onFlipComplete} onFlipCancel={onFlipCancel} onSettled={(settledKey) => { textMotion.onSettled(settledKey); onSettled?.(settledKey) }}>
      {textMotion.visibleText}
    </ReadingPageFlip>
  </span>
}

function DialogueText({ group, continuityKey, pageKey, text, sessionId, motion, layout, worldScale, lockToken, onMotionComplete, onReadyChange, onFlipStart, onFlipComplete, onFlipCancel, onSettled }: { group: string; continuityKey: string; pageKey: string; text: string; sessionId: number; motion: MainlineReadingTextMotion; layout: MainlineEchoLayout; worldScale: number; lockToken: number; onMotionComplete?: (sessionId: number, motion: MainlineReadingTextMotion) => void; onReadyChange?: (group: string, ready: boolean) => void; onFlipStart?: (token: number) => void; onFlipComplete?: (token: number) => void; onFlipCancel?: (token: number) => void; onSettled?: (pageKey: string) => void }) {
  const sessionKey = `dialogue:${sessionId}`
  const completeMotion = useCallback((_sessionKey: string, completedMotion: MainlineReadingTextMotion) => onMotionComplete?.(sessionId, completedMotion), [onMotionComplete, sessionId])
  const textMotion = useReadingTextMotion({ sessionKey, pageKey, text, motion, onComplete: completeMotion })
  useIsomorphicLayoutEffect(() => onReadyChange?.(group, false), [group, pageKey, onReadyChange])
  return <span className="scene-mainline-text__dialogue" data-scene-text-mode="dialogue">
    <ReadingPageFlip pageKey={pageKey} continuityKey={continuityKey} visibleText={textMotion.visibleText} layout={layout} worldScale={worldScale} mode="dialogue" lockToken={lockToken} onFlipStart={onFlipStart} onFlipComplete={onFlipComplete} onFlipCancel={onFlipCancel} onSettled={(settledKey) => { textMotion.onSettled(settledKey); onSettled?.(settledKey); onReadyChange?.(group, true) }}>
      {textMotion.visibleText}
    </ReadingPageFlip>
  </span>
}

type ReadingLayoutTransitionMode = 'active' | 'leaving' | 'inactive'

function useMainlineReadingLayoutTransition(
  mode: ReadingLayoutTransitionMode,
  continuityKey: string | null,
  pageKey: string | null,
  settledPageKey: string | null,
  target: MainlineEchoLayout | null,
) {
  const [displayedLayout, setDisplayedLayout] = useState<MainlineEchoLayout | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const frameRef = useRef<number | null>(null)
  const currentRef = useRef<{ mode: ReadingLayoutTransitionMode; continuityKey: string; pageKey: string; layout: MainlineEchoLayout; phase: 'steady' | 'rolling' | 'awaiting-settle' | 'settling' } | null>(null)

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
      currentRef.current = { mode: 'active', continuityKey, pageKey, layout: target, phase: 'steady' }
      setDisplayedLayout(target)
      setTransitioning(false)
      return
    }

    const animate = (from: MainlineEchoLayout, to: MainlineEchoLayout, durationMs: number, phase: 'rolling' | 'settling', onComplete: () => void) => {
      if (mainlineReadingLayoutsHaveSameSize(from, to)) {
        setDisplayedLayout(to)
        onComplete()
        return
      }
      setDisplayedLayout(from)
      setTransitioning(true)
      const startedAt = performance.now()
      const advance = (now: number) => {
        const elapsed = Math.max(0, now - startedAt)
        const progress = storefrontCharacterProgress(0, 1, elapsed, durationMs)
        const next = interpolateMainlineReadingPageLayout(from, to, progress)
        currentRef.current = { mode: 'active', continuityKey, pageKey, layout: next, phase }
        setDisplayedLayout(next)
        if (elapsed >= durationMs) {
          frameRef.current = null
          onComplete()
          return
        }
        frameRef.current = window.requestAnimationFrame(advance)
      }
      frameRef.current = window.requestAnimationFrame(advance)
    }

    if (previous.phase === 'awaiting-settle' && previous.pageKey === pageKey && settledPageKey === pageKey) {
      const from = previous.layout
      currentRef.current = { mode: 'active', continuityKey, pageKey, layout: from, phase: 'settling' }
      animate(from, target, mainlineReadingPageTransitionDurationMs, 'settling', () => {
        currentRef.current = { mode: 'active', continuityKey, pageKey, layout: target, phase: 'steady' }
        setDisplayedLayout(target)
        setTransitioning(false)
      })
      return
    }

    if (previous.pageKey !== pageKey) {
      const envelope = mainlineReadingPageRollEnvelope(previous.layout, target)
      currentRef.current = { mode: 'active', continuityKey, pageKey, layout: previous.layout, phase: 'rolling' }
      animate(previous.layout, envelope, mainlineReadingPageFlipDurationMs, 'rolling', () => {
        currentRef.current = { mode: 'active', continuityKey, pageKey, layout: envelope, phase: 'awaiting-settle' }
        setDisplayedLayout(envelope)
        setTransitioning(true)
      })
      return
    }

    const from = previous.layout
    if (previous.phase === 'rolling' || previous.phase === 'settling') return
    if (previous.phase === 'awaiting-settle') {
      setDisplayedLayout(previous.layout)
      setTransitioning(true)
      return
    }
    currentRef.current = { mode: 'active', continuityKey, pageKey, layout: from, phase: 'steady' }
    if (mainlineReadingLayoutsHaveSameSize(from, target)) {
      currentRef.current = { mode: 'active', continuityKey, pageKey, layout: target, phase: 'steady' }
      setDisplayedLayout(target)
      setTransitioning(false)
      return
    }
    animate(from, target, mainlineReadingPageTransitionDurationMs, 'settling', () => {
      currentRef.current = { mode: 'active', continuityKey, pageKey, layout: target, phase: 'steady' }
      setDisplayedLayout(target)
      setTransitioning(false)
    })
  }, [continuityKey, mode, pageKey, settledPageKey, target?.fontSizePx, target?.heightPx, target?.widthPx])

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
  readingStageBrightness?: boolean
  readingProtected?: boolean
  debugRuntimeEvidence: boolean
  onInteract?: (npcId: string) => void
}

function MainlineNpcActor({ sceneId, npc, position, snapshot, seatId, seatPosition, screenMetrics, interactive, presentationActive = true, readingOpacity = 1, readingProtected = false, readingStageBrightness = false, debugRuntimeEvidence, onInteract }: MainlineNpcActorProps) {
  const visualPosition = mainlineSeatedActorVisualPosition(position, seatId, seatPosition)
  const visualFootprint = mainlineLabelFootprint(npc.label, visualPosition, screenMetrics, { lineHeight: 1 })
  const effectiveReadingOpacity = readingProtected ? 1 : readingOpacity
  const className = `scene-mainline-npc ${interactive ? '' : 'scene-mainline-npc--ambient'} ${effectiveReadingOpacity < 1 ? 'is-reading-through' : ''} ${readingProtected ? 'is-reading-protected' : ''}`
  const style = {
    left: `${visualPosition.x}%`,
    top: `${visualPosition.y}%`,
    opacity: presentationActive ? 1 : 0,
    pointerEvents: presentationActive ? undefined : 'none',
    filter: effectiveReadingOpacity < 1 ? `${readingStageBrightness ? 'brightness' : 'opacity'}(${effectiveReadingOpacity})` : undefined,
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
  readingSessionLayoutCache: sharedReadingSessionLayoutCache = null,
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
  dialogueTextSessionId = 0,
  dialogueTextMotion = 'static',
  dialogueStage = null,
  dialogueHandoffActive = false,
  dialogueHandoffFadeDurationMs = 300,
  readingMode = null,
  onDialogueExitComplete,
  onDialogueAdvance,
  onDialogueTypingSkip,
  onDialogueTextMotionComplete,
  sceneEcho = null,
  onSceneEchoAdvance,
  onSceneEchoTextMotionComplete,
  onSceneEchoExitComplete,
  sceneAction = null,
  onSceneActionStart,
  onSceneActionChoice,
  onSceneActionExitComplete,
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
  const [dialogueReady, setDialogueReady] = useState(false)
  const [readingOverflowPage, setReadingOverflowPage] = useState<import('./mainlineReadingProtection').MainlineReadingOverflowPageState>(null)
  const [settledReadingPageKey, setSettledReadingPageKey] = useState<string | null>(null)
  const readingLayoutSessionCacheRef = useRef<MainlineReadingSessionLayoutCache | null>(null)
  const readingPageAdvanceLockedRef = useRef(false)
  const readingPageAdvanceLockTimerRef = useRef<number | null>(null)
  const readingPageAdvanceLockTokenRef = useRef(0)
  const readingPageAdvanceFlipStartedTokenRef = useRef<number | null>(null)
  const readingPageAdvanceVisibilityListenerRef = useRef<(() => void) | null>(null)
  const typingCompletionLockRef = useRef(false)
  const typingCompletionLockTokenRef = useRef<number | null>(null)
  const releaseReadingPageAdvance = useCallback((token?: number) => {
    if (token !== undefined && (!mainlineReadingPageAdvanceTokenIsCurrent(readingPageAdvanceLockTokenRef.current, token) || !readingPageAdvanceLockedRef.current)) return
    readingPageAdvanceLockTokenRef.current += 1
    readingPageAdvanceLockedRef.current = false
    readingPageAdvanceFlipStartedTokenRef.current = null
    if (readingPageAdvanceLockTimerRef.current !== null) window.clearTimeout(readingPageAdvanceLockTimerRef.current)
    readingPageAdvanceLockTimerRef.current = null
    if (readingPageAdvanceVisibilityListenerRef.current) {
      document.removeEventListener('visibilitychange', readingPageAdvanceVisibilityListenerRef.current)
      readingPageAdvanceVisibilityListenerRef.current = null
    }
  }, [])
  const scheduleReadingPageAdvanceFallback = useCallback((token: number, delayMs: number) => {
    if (readingPageAdvanceLockTimerRef.current !== null) window.clearTimeout(readingPageAdvanceLockTimerRef.current)
    readingPageAdvanceLockTimerRef.current = null

    const waitForVisible = () => {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') return
        document.removeEventListener('visibilitychange', onVisibilityChange)
        readingPageAdvanceVisibilityListenerRef.current = null
        readingPageAdvanceLockTimerRef.current = window.setTimeout(() => {
          readingPageAdvanceLockTimerRef.current = null
          if (!mainlineReadingPageAdvanceWatchdogMayRelease(readingPageAdvanceLockTokenRef.current, token, readingPageAdvanceFlipStartedTokenRef.current) || !readingPageAdvanceLockedRef.current) return
          if (document.visibilityState === 'hidden') {
            waitForVisible()
            return
          }
          releaseReadingPageAdvance(token)
        }, mainlineReadingPageAdvanceResumeGraceMs)
      }
      if (readingPageAdvanceVisibilityListenerRef.current) document.removeEventListener('visibilitychange', readingPageAdvanceVisibilityListenerRef.current)
      readingPageAdvanceVisibilityListenerRef.current = onVisibilityChange
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    readingPageAdvanceLockTimerRef.current = window.setTimeout(() => {
      readingPageAdvanceLockTimerRef.current = null
      if (!mainlineReadingPageAdvanceWatchdogMayRelease(readingPageAdvanceLockTokenRef.current, token, readingPageAdvanceFlipStartedTokenRef.current) || !readingPageAdvanceLockedRef.current) return
      if (document.visibilityState === 'hidden') {
        waitForVisible()
        return
      }
      releaseReadingPageAdvance(token)
    }, delayMs)
  }, [releaseReadingPageAdvance])
  const lockReadingPageAdvance = useCallback(() => {
    const token = ++readingPageAdvanceLockTokenRef.current
    readingPageAdvanceFlipStartedTokenRef.current = null
    readingPageAdvanceLockedRef.current = true
    scheduleReadingPageAdvanceFallback(token, mainlineReadingPageAdvanceStartupWatchdogMs)
    return token
  }, [scheduleReadingPageAdvanceFallback])
  const startReadingPageAdvanceFlip = useCallback((token: number) => {
    if (!mainlineReadingPageAdvanceTokenIsCurrent(readingPageAdvanceLockTokenRef.current, token) || !readingPageAdvanceLockedRef.current) return
    readingPageAdvanceFlipStartedTokenRef.current = token
    if (readingPageAdvanceLockTimerRef.current !== null) window.clearTimeout(readingPageAdvanceLockTimerRef.current)
    readingPageAdvanceLockTimerRef.current = null
    if (readingPageAdvanceVisibilityListenerRef.current) {
      document.removeEventListener('visibilitychange', readingPageAdvanceVisibilityListenerRef.current)
      readingPageAdvanceVisibilityListenerRef.current = null
    }
  }, [])
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
    const targetOpacity = readingMode === 'observation' ? centerReadingDimmerTargets.observation : dialogueStage ? 0 : readingMode ? centerReadingDimmerTargets.dialogue : 0
    dimmer.getAnimations().forEach((animation) => animation.cancel())
    dimmer.style.opacity = String(currentOpacity)
    const duration = centerReadingDimmerTransitionDurationMs(
      currentOpacity,
      targetOpacity,
      readingMode === 'observation' ? centerReadingDimmerTargets.observation : dialogueStage ? 0 : readingMode ? centerReadingDimmerTargets.dialogue : currentOpacity,
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
  }, [dialogueStage, readingMode])
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
      typingCompletionLockTokenRef.current = null
      releaseReadingPageAdvance()
    }
  }, [readingPresentationPhase, releaseReadingPageAdvance])
  useEffect(() => {
    if (!typingCompletionLockRef.current || sceneEcho?.textMotion === 'typing' || dialogueTextMotion === 'typing') return
    typingCompletionLockRef.current = false
    const token = typingCompletionLockTokenRef.current
    typingCompletionLockTokenRef.current = null
    releaseReadingPageAdvance(token ?? undefined)
  }, [dialogueTextMotion, releaseReadingPageAdvance, sceneEcho?.textMotion])
  const readingPresentationMode = readingMode ?? (sceneEcho ? 'observation' : readingIsLeaving ? 'dialogue' : null)
  const readingSessionKey = !readingPresentationMode ? null : sceneEcho
    ? `${scene.id}:observation:echo:${sceneEcho.id}:${sceneEcho.entityId ?? ''}`
    : mainlineDialogueReadingSessionKey(scene.id, dialogue?.triggerEntityId, dialogueLine?.id, dialogueLineIndex)
  const readingOcclusionSessionKey = !readingPresentationMode ? null : sceneEcho
    ? `${scene.id}:observation:echo:${sceneEcho.id}`
    : `${scene.id}:dialogue:${dialogue?.triggerEntityId ?? ''}`
  const readingAnchorSessionKey = readingOcclusionSessionKey
  const readingTextDeleting = sceneEcho
    ? sceneEcho.textMotion === 'deleting' || sceneEcho.textMotion === 'deleted'
    : dialogueTextMotion === 'deleting' || dialogueTextMotion === 'deleted'
  const retainedReadingPresentation = (readingPresentationPhase === 'leaving' || readingTextDeleting)
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
  const readingEnvelopeEntries = useMemo<readonly MainlineReadingSessionTextEntry[]>(() => sceneEcho
    ? (sceneEcho.segments.length ? sceneEcho.segments : [sceneEcho.text]).map(text => ({ text }))
    : dialogue ? dialogue.lines.map(line => ({ text: line.text, speaker: line.speaker }))
      : dialogueLine ? [{ text: dialogueLine.text, speaker: dialogueLine.speaker }]
        : [{ text: activeReadingText }],
  [activeReadingText, dialogue?.lines, dialogueLine?.speaker, dialogueLine?.text, sceneEcho?.segments, sceneEcho?.text])
  const readingLayoutFontFaceKey = useMainlineReadingFontRevision(readingOcclusionSessionKey)
  const readingMeasurementKey = mainlineReadingMeasurementKey(readingMetrics, worldScale)
  let readingLayoutSessionCache = readingLayoutSessionCacheRef.current
  if (!readingOcclusionSessionKey) {
    readingLayoutSessionCacheRef.current = null
    readingLayoutSessionCache = null
  } else if (activeReadingPosition) {
    const sessionTextEntries = [...readingEnvelopeEntries, { text: activeReadingText, speaker: sceneEcho ? undefined : dialogueLine?.speaker }]
    if (sharedReadingSessionLayoutCache?.sessionKey === readingOcclusionSessionKey
      && sharedReadingSessionLayoutCache.fontKey === readingLayoutFontFaceKey
      && sharedReadingSessionLayoutCache.measurementKey === readingMeasurementKey) {
      readingLayoutSessionCache = sharedReadingSessionLayoutCache
      readingLayoutSessionCache.addEntries(sessionTextEntries)
      readingLayoutSessionCacheRef.current = readingLayoutSessionCache
    } else if (!readingLayoutSessionCache
      || readingLayoutSessionCache.sessionKey !== readingOcclusionSessionKey
      || readingLayoutSessionCache.fontKey !== readingLayoutFontFaceKey
      || readingLayoutSessionCache.measurementKey !== readingMeasurementKey) {
      const frozenMetrics = readingMetrics
      const frozenMaximumWidth = maximumReadingWidthPx
      readingLayoutSessionCache = createMainlineReadingSessionLayoutCache({
        sessionKey: readingOcclusionSessionKey,
        entries: sessionTextEntries,
        metrics: frozenMetrics,
        maximumWidthPx: frozenMaximumWidth,
        fontKey: readingLayoutFontFaceKey,
        worldScale,
        preferWholeText: Boolean(sceneEcho),
      })
      readingLayoutSessionCacheRef.current = readingLayoutSessionCache
    } else {
      readingLayoutSessionCache.addEntries(sessionTextEntries)
    }
  }
  const maximumReadingLayout = activeReadingPosition && readingLayoutSessionCache
    ? readingLayoutSessionCache.envelopeAtOrBelow(maximumReadingWidthPx)
    : null
  const dialogueSpeakerEnvelope = readingMode === 'dialogue' && dialogue && activeReadingPosition
    ? mainlineSpeakerAnchor(dialogue.lines, readingMetrics, {
      x: scene.id === 'commercial-street' ? projectCommercialStreetX(activeReadingPosition.x, readingMetrics) : activeReadingPosition.x,
      y: activeReadingPosition.y,
    }, { x: 0, y: 0 }, worldScale, maximumReadingWidthPx, readingLayoutSessionCache?.speakerWidthAtOrBelow(maximumReadingWidthPx))
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
    ? mainlineAvailableReadingWidthPx(scene, sceneAction.position, viewportMetrics, worldScale, sceneActionCameraOffset)
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
    if (!sceneActionMeasureKey || !node || sceneAction?.phase !== 'active') {
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
  }, [sceneActionMeasureKey, sceneAction?.phase, worldScale])
  const matchingSceneActionSize = sceneActionMeasureKey && sceneActionMeasuredSize?.key === sceneActionMeasureKey
    ? sceneActionMeasuredSize
    : null
  const sceneActionPlacement = sceneAction && matchingSceneActionSize
    ? mainlinePlaceReadingAction(scene, sceneAction.position, matchingSceneActionSize, viewportMetrics, worldScale, sceneActionCameraOffset)
    : null
  const sceneActionPosition = sceneActionPlacement?.position ?? sceneAction?.position
  const sceneActionLayerPosition = sceneActionPosition && sceneAction
    ? mainlineReadingActionLayerPosition({
      ...sceneActionPosition,
      x: scene.id === 'commercial-street' ? projectCommercialStreetX(sceneActionPosition.x, renderScreenMetrics) : sceneActionPosition.x,
    }, sceneActionCameraOffset, renderCameraOffset)
    : null
  // Capture the last painted placement in world-layer coordinates. Once exit
  // starts, live camera transforms still apply, but measurements and clamping
  // can no longer drag the departing action around.
  const actionExitPlacementRef = useRef<{ id: number; position: Point; maxWidth: number; maxHeight: number; overflowY: boolean } | null>(null)
  useLayoutEffect(() => {
    if (!sceneAction) {
      actionExitPlacementRef.current = null
      return
    }
    if (sceneAction.phase !== 'active' || !sceneActionLayerPosition || !sceneActionPlacement || !matchingSceneActionSize) return
    actionExitPlacementRef.current = {
      id: sceneAction.id,
      position: { ...sceneActionLayerPosition },
      maxWidth: Math.max(1, Math.min(sceneActionMaxWidthPx, sceneActionPlacement.availableWidthPx) / worldScale),
      maxHeight: Math.max(1, sceneActionPlacement.availableHeightPx / worldScale),
      overflowY: sceneActionPlacement.overflowY,
    }
  }, [sceneAction, sceneActionLayerPosition?.x, sceneActionLayerPosition?.y, sceneActionPlacement, matchingSceneActionSize, sceneActionMaxWidthPx, worldScale])
  const frozenActionPlacement = sceneAction && sceneAction.phase !== 'active' && actionExitPlacementRef.current?.id === sceneAction.id
    ? actionExitPlacementRef.current : null
  const activeReadingWidthPx = activeReadingPosition ? mainlineAvailableReadingWidthPx(scene, activeReadingPosition, readingMetrics, worldScale, renderCameraOffset) : readingMetrics.width - 24
  const activeReadingLayout = activeReadingPosition
    ? readingLayoutSessionCache?.pageLayoutAtOrBelow(activeReadingText, sceneEcho ? undefined : dialogueLine?.speaker, activeReadingWidthPx)
      ?? mainlineEchoLayout(activeReadingText, readingMetrics, { speaker: !sceneEcho ? dialogueLine?.speaker : undefined, maxWidthPx: activeReadingWidthPx })
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
  const visibleInteriorRoomIdsKey = [...visibleInteriorRoomIds].sort().join('|')
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
    ? readingLayoutSessionCache?.fit({
      scene,
      source: activeReadingPosition,
      text: activeReadingText,
      speaker: sceneEcho ? undefined : dialogueLine?.speaker,
      maximumWidthPx: activeReadingWidthPx,
      protectedVisuals: readingProtectedVisuals,
      metrics: readingMetrics,
      worldScale,
      cameraOffset: renderCameraOffset,
      sourceOffset: sceneEcho && readingOverflowPage?.sessionKey === readingSessionKey && readingOverflowPage.key === readingOverflowKey ? readingOverflowPage.sourceOffset : undefined,
    }) ?? null
    : null
  const fittedReadingSegments = readingFit?.segments ?? [activeReadingText]
  const activeDisplayOverflowIndex = sceneEcho && readingOverflowPage?.sessionKey === readingSessionKey && readingOverflowPage.key === readingOverflowKey && readingOverflowPage.sourceOffset !== undefined
    ? mainlineReadingPageIndexForSourceOffset(fittedReadingSegments, readingOverflowPage.sourceOffset)
    : Math.min(readingOverflowIndex, Math.max(0, fittedReadingSegments.length - 1))
  const activeDisplayReadingText = fittedReadingSegments[activeDisplayOverflowIndex] ?? activeReadingText
  const activeDisplayReadingLayout = readingFit
    ? readingFit.pageLayouts[activeDisplayOverflowIndex] ?? readingFit.layout
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
    ? readingAnchorSessionKey
      ? mainlineReadingAnchorForSession(readingAnchorSessionKey, readingAnchorContextKey, candidateReadingPosition!, retainedReadingPresentationRef.current)
      : candidateReadingPosition
    : activeReadingPosition
  const currentReadingPresentation: MainlineReadingPresentationSnapshot | null = readingMode && readingSessionKey && activeDisplayReadingPosition && activeDisplayReadingLayout
    ? { sessionKey: readingSessionKey, anchorSessionKey: readingAnchorSessionKey ?? undefined, anchorContextKey: readingAnchorContextKey, position: activeDisplayReadingPosition, cameraOffset: renderCameraOffset, layout: activeDisplayReadingLayout, maxWidthPx: readingFit?.maxWidthPx ?? activeReadingWidthPx, text: activeDisplayReadingText, overflowIndex: activeDisplayOverflowIndex }
    : null
  const readingPresentation = mainlineReadingPresentationForPhase(readingTextDeleting ? 'deleting' : readingPresentationPhase, readingSessionKey, currentReadingPresentation, retainedReadingPresentation)
  useIsomorphicLayoutEffect(() => {
    if (readingPresentationPhase === 'active' && !readingTextDeleting && currentReadingPresentation) retainedReadingPresentationRef.current = currentReadingPresentation
    else if (readingPresentationPhase === 'inactive') retainedReadingPresentationRef.current = null
  }, [currentReadingPresentation, readingPresentationPhase, readingTextDeleting])
  const displayOverflowIndex = readingPresentation?.overflowIndex ?? activeDisplayOverflowIndex
  const displayReadingText = readingPresentation?.text ?? activeDisplayReadingText
  const displayReadingLayout = readingPresentation?.layout ?? activeDisplayReadingLayout
  const displayReadingMaxWidthPx = readingPresentation?.maxWidthPx ?? activeReadingWidthPx
  const readingLayoutContinuityKey = !readingSessionKey ? null : sceneEcho
    ? `echo:${scene.id}:${sceneEcho.id}`
    : `dialogue:${scene.id}:${dialogue?.triggerEntityId ?? dialogueLine?.id ?? ''}`
  const readingLayoutPageKey = readingSessionKey && displayReadingLayout
    ? mainlineReadingPageKey({ sessionKey: readingSessionKey, segmentIndex: sceneEcho?.segmentIndex ?? dialogueSegmentIndex, overflowIndex: displayOverflowIndex, text: displayReadingText })
    : null
  const readingLayoutTransition = useMainlineReadingLayoutTransition(
    readingPresentationPhase,
    readingLayoutContinuityKey,
    readingLayoutPageKey,
    settledReadingPageKey,
    displayReadingLayout,
  )
  const presentedReadingLayout = readingLayoutTransition.layout ?? displayReadingLayout
  const readingLayoutTransitioning = readingLayoutTransition.transitioning
  const dialogueOptionsAllowed = mainlineDialogueTurnAllowsOptions({
    hasDialogue: Boolean(dialogue && dialogueLine && readingMode === 'dialogue'),
    ready: dialogueReady,
    motion: dialogueTextMotion,
    handoffActive: dialogueHandoffActive,
    currentSegmentIndex: dialogueSegmentIndex,
    segmentCount: dialogueSegmentCount,
    currentOverflowPageIndex: displayOverflowIndex,
    overflowPageCount: fittedReadingSegments.length,
    layoutTransitioning: readingLayoutTransitioning,
  })
  const actionVisible = Boolean(frozenActionPlacement || (matchingSceneActionSize && sceneActionPlacement && (sceneAction?.phase !== 'active' || dialogueOptionsAllowed)))
  const currentDialogueGroup = dialogue && dialogueLine
    ? `dialogue:${dialogueLine.id}:${dialogueSegmentIndex}:fit:${displayOverflowIndex}`
    : null
  currentDialogueGroupRef.current = currentDialogueGroup
  const readingVisualActive = Boolean(readingPresentation && activeReadingPosition && displayReadingLayout)
  const readingMaskRects = useMemo(() => mainlineReadingMaskRects(sceneRenderBounds, readingProtectedVisuals), [readingProtectedVisuals, sceneRenderBounds])
  const readingDisplayPosition = readingPresentation?.position ?? activeReadingPosition
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
  const renderedRoomIdsKey = [...renderedRoomIds].sort().join('|')
  const visibleObjectEntities = useMemo(() => scene.objects.filter(entity => entity.visible !== false
    && !entity.counterSurfaceId
    && entity.kind !== 'door'
    && !wallFeatureEntityIds.has(entity.id)
    && (mainlineEntityMatchesCurrentPresentation(entity, renderedRoomIds, activeSpatialSpaceId)
      || (streetSpaceContentRetained && mainlineEntityIsPublicStreetContent(scene.id, entity)))),
  [activeSpatialSpaceId, renderedRoomIdsKey, scene, streetSpaceContentRetained, wallFeatureEntityIds])
  const visibleCounterSurfaces = useMemo(() => counterSurfaces.filter(parts => !parts[0].counterSurface?.roomId || visibleInteriorRoomIds.has(parts[0].counterSurface.roomId)),
    [counterSurfaces, visibleInteriorRoomIdsKey])
  const readingOcclusionRect = useMemo(() => readingVisualActive && readingDisplayPosition && maximumReadingLayout
    ? mainlineReadingOcclusionRect(readingDisplayPosition, maximumReadingLayout, worldScale, projectReadingX)
    : null, [maximumReadingLayout, projectReadingX, readingDisplayPosition, readingVisualActive, worldScale])
  const readingOcclusionContextKey = JSON.stringify([scene.id, viewportMetrics.width, viewportMetrics.height, viewportMetrics.viewportWidth ?? null, worldScale, renderScreenMetrics.width, renderScreenMetrics.height, activeSpatialSpaceId ?? null])
  const readingOcclusionSnapshotFrozen = Boolean(retainedReadingOcclusion
    && retainedReadingOcclusion.sessionKey === readingOcclusionSessionKey
    && retainedReadingOcclusion.contextKey === readingOcclusionContextKey)
  const readingOcclusionCandidates = useMemo<MainlineReadingOcclusionCandidate[]>(() => {
    if (!readingVisualActive || !readingOcclusionSessionKey || !readingOcclusionRect || readingOcclusionSnapshotFrozen) return []
    const candidates: MainlineReadingOcclusionCandidate[] = []
    const add = (identityKey: string, entityId: string | undefined, bounds: CollisionBox, spaceId?: string, relatedEntityIds?: readonly string[]) => {
      candidates.push({ identityKey, entityId, relatedEntityIds, bounds, spaceId })
    }
    for (const slot of activeSwitchableStorefronts) {
      const cells = switchCells.get(slot.id) ?? []
      if (!cells.length) continue
      const portalBoxes = cells.map(cell => cellGlyphWorldBounds({ ...cell, kind: cell.role === 'door' ? 'door' : 'storefront' } as MainlineSceneGeometryUnit['visual']['cells'][number], horizontalGridScale))
      const bounds = unionWorldBounds(portalBoxes, 8)
      const portalEntity = scene.objects.find(object => object.id === slot.portalId)
      add(`portal:${slot.id}`, slot.id, bounds, portalEntity ? mainlineActiveSpatialSpaceId(scene, portalEntity.position) : undefined, slot.portalId ? [slot.portalId] : undefined)
    }
    for (const { unit, cell } of geometryCells) {
      if (sceneEcho && (cell.kind === 'wall' || cell.kind === 'door' || cell.kind === 'opening')) continue
      const sourceEntityId = cell.entityId ?? unit.entityId
      const target = mainlineCellFocusTarget(scene, cell, sourceEntityId, unit.variant)
      const entries = target ? focusGroupCells.get(target.group) : undefined
      const groupedFocus = Boolean(target && entries && (entries.length > 1 || cell.kind === 'storefront' && cell.storefrontRole === 'sign'))
      if (groupedFocus && entries?.[0]?.cell.id !== cell.id) continue
      if (cell.glyph === '' && !(cell.kind === 'feature' && cell.featureCellRole === 'flank')) continue
      const entityId = cell.kind === 'feature' && cell.featureCellRole === 'flank'
        ? `wall-cell:${cell.id}`
        : cell.entityId ?? unit.entityId ?? cell.storefrontId ?? unit.storefrontId ?? cell.id
      const featureOwner = cell.kind === 'feature' && entityId
        ? scene.objects.find(candidate => candidate.id === entityId)
        : undefined
      const spaceId = featureOwner?.roomId ?? mainlineActiveSpatialSpaceId(scene, { x: cell.x, y: cell.y })
      const groupedOcclusion = Boolean(groupedFocus && entries?.every(entry => {
        const entryEntityId = entry.cell.entityId ?? entry.unit.entityId
        const entryRoomId = entry.cell.kind === 'feature' && entryEntityId
          ? scene.objects.find(candidate => candidate.id === entryEntityId)?.roomId
          : undefined
        return (entryRoomId ?? mainlineActiveSpatialSpaceId(scene, { x: entry.cell.x, y: entry.cell.y })) === spaceId
      }))
      // A rendered focus group is one DOM visual. If its cells span spaces,
      // do not let one room's reading envelope hide the combined visual.
      if (groupedFocus && !groupedOcclusion) continue
      const boundsEntries = groupedOcclusion ? entries! : [{ unit, cell } as MainlineGeometryCellEntry]
      const visualBoxes = boundsEntries.map(entry => cellGlyphWorldBounds(entry.cell, horizontalGridScale))
      const cellStorefrontId = cell.storefrontId ?? unit.storefrontId
      const cellStorefront = cellStorefrontId ? scene.storefronts.find(candidate => candidate.id === cellStorefrontId) : undefined
      const storefrontVisual = cellStorefront ? storefrontLabelGeometry.get(cellStorefront.id) : undefined
      if (groupedOcclusion && storefrontVisual) visualBoxes.push(mainlineReadingWorldBox(storefrontVisual.visualBounds))
      const bounds = unionWorldBounds(visualBoxes, groupedOcclusion ? 3 : 0)
      add(mainlineReadingOcclusionCellIdentity(cell.id, groupedOcclusion ? target?.group : undefined, spaceId), entityId, bounds, spaceId)
    }
    for (const parts of visibleCounterSurfaces) {
      const meta = parts[0].counterSurface!
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
      const bounds = unionWorldBounds([...boxes, ...labelBoxes], 1)
      const first = parts[0]
      const spaceId = meta.roomId ?? mainlineActiveSpatialSpaceId(scene, { x: first.x + first.width / 2, y: first.y + first.height / 2 })
      add(`counter:${meta.groupId}`, meta.interactionEntityId, bounds, spaceId)
    }
    for (const entity of visibleObjectEntities) {
      const object = geometrySnapshot.objects.get(entity.id)
      const normalizedBounds = object?.visualBounds ?? mainlineEntityVisualBounds(scene, entity, geometrySnapshot.layout, renderScreenMetrics)
        ?? mainlineLabelFootprint(entity.label, object?.position ?? entity.position, renderScreenMetrics, { vertical: entity.textLayout === 'vertical', visualScale: entity.visualScale, lineHeight: 1.2 })
      const bounds = mainlineReadingWorldBox(normalizedBounds, value => value, entity.focusFrame === 'interactive' ? 5 : 0)
      const entityPosition = object?.position ?? entity.position
      add(`object:${entity.id}`, entity.id, bounds, entity.spaceId ?? entity.roomId ?? mainlineActiveSpatialSpaceId(scene, entityPosition))
    }
    return candidates
  }, [activeSwitchableStorefronts, focusGroupCells, geometryCells, geometrySnapshot, horizontalGridScale, readingOcclusionRect, readingOcclusionSessionKey, readingOcclusionSnapshotFrozen, readingVisualActive, renderScreenMetrics, scene, sceneEcho, storefrontLabelGeometry, switchCells, visibleCounterSurfaces, visibleObjectEntities])
  const currentReadingOcclusion = useMemo<RetainedReadingOcclusion | null>(() => {
    if (!readingVisualActive || !readingOcclusionSessionKey || !readingOcclusionRect) return null
    if (readingOcclusionSnapshotFrozen && retainedReadingOcclusion) return retainedReadingOcclusion
    return {
      sessionKey: readingOcclusionSessionKey,
      contextKey: readingOcclusionContextKey,
      rect: readingOcclusionRect,
      protectedEntityIds: readingProtectedEntityIds,
      hiddenIdentityKeys: mainlineReadingOccludedIdentityKeys(readingOcclusionCandidates, readingOcclusionRect, readingProtectedEntityIds, activeSpatialSpaceId),
    }
  }, [activeSpatialSpaceId, readingOcclusionCandidates, readingOcclusionContextKey, readingOcclusionRect, readingOcclusionSessionKey, readingOcclusionSnapshotFrozen, readingProtectedEntityIds, readingVisualActive, retainedReadingOcclusion])
  useEffect(() => {
    if (readingPresentationPhase !== 'active' || !currentReadingOcclusion) return
    setRetainedReadingOcclusion(current => retainMainlineReadingOcclusionSnapshot(current, currentReadingOcclusion))
  }, [currentReadingOcclusion, readingPresentationPhase])
  useEffect(() => {
    if (readingPresentationPhase !== 'active' || !readingVisualActive || !readingOcclusionSessionKey) return
    if (activeReadingOcclusionSession === readingOcclusionSessionKey) return
    setActiveReadingOcclusionSession(null)
    readingOcclusionEntryRafRef.current = window.requestAnimationFrame(() => {
      readingOcclusionEntryRafRef.current = null
      setActiveReadingOcclusionSession(readingOcclusionSessionKey)
    })
    return () => {
      if (readingOcclusionEntryRafRef.current !== null) window.cancelAnimationFrame(readingOcclusionEntryRafRef.current)
      readingOcclusionEntryRafRef.current = null
    }
  }, [activeReadingOcclusionSession, readingPresentationPhase, readingOcclusionSessionKey, readingVisualActive])
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
  const retainedOcclusionSnapshot = readingVisualActive && currentReadingOcclusion
    ? retainMainlineReadingOcclusionSnapshot(retainedReadingOcclusion, currentReadingOcclusion)
    : retainedReadingOcclusion
  const readingOcclusionActive = readingPresentationPhase === 'active' && readingVisualActive && activeReadingOcclusionSession === readingOcclusionSessionKey
  const observationFade = sceneEcho && retainedOcclusionSnapshot?.rect
    ? { rect: retainedOcclusionSnapshot.rect, innerMarginWorldPx: mainlineReadingOcclusionFadeWorldPx * 2, featherWorldPx: mainlineReadingOcclusionFadeWorldPx * 3 }
    : undefined
  const readingOcclusionProtectedEntityIds = readingPresentationPhase === 'inactive'
    ? retainedReadingOcclusion?.protectedEntityIds ?? readingProtectedEntityIds
    : readingProtectedEntityIds
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
      <div ref={stageRef} className={`scene-stage mainline-scene-stage ${layoutMode ? 'is-layout-editing' : ''} ${readingMode ? 'is-scene-dialogue-active' : ''}`} style={{ '--scene-mainline-object-font-size': `${mainlineEntityFontSizePx(null, renderScreenMetrics)}px` } as CSSProperties} onClick={walkToEmptySpace} onPointerUp={walkFromTouch} onPointerDownCapture={focusFrames.onPointerDownCapture} onPointerOverCapture={focusFrames.onPointerOverCapture} onPointerOutCapture={focusFrames.onPointerOutCapture} onClickCapture={focusFrames.onClickCapture} data-layout-mode={layoutMode ? 'edit' : 'play'} data-mainline-scene={scene.id} data-camera-offset-x={debugRuntimeEvidence ? cameraOffset.x : undefined} data-camera-offset-y={debugRuntimeEvidence ? cameraOffset.y : undefined} data-reading-layout-fit-calls={debugRuntimeEvidence ? readingLayoutSessionCache?.counts.fitCalls : undefined} data-reading-layout-split-calls={debugRuntimeEvidence ? readingLayoutSessionCache?.counts.splitCalls : undefined} data-reading-layout-layout-calls={debugRuntimeEvidence ? readingLayoutSessionCache?.counts.layoutCalls : undefined} data-reading-layout-measure-calls={debugRuntimeEvidence ? readingLayoutSessionCache?.counts.textMeasureCalls : undefined} data-scene-dialogue-state={dialoguePhase} data-scene-dialogue-unresolved-speakers={dialogueParticipantResolution.unresolvedSpeakers.join('|') || undefined}>
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
          <div className="scene-spatial-labels scene-spatial-labels--wall scene-mainline-wall-labels" data-reading-occlusion-layer="wall">
            {activeSwitchableStorefronts.map(slot => {
              const cells = switchCells.get(slot.id)!
              const portalBoxes = cells.map(cell => cellGlyphWorldBounds({ ...cell, kind: cell.role === 'door' ? 'door' : 'storefront' } as MainlineSceneGeometryUnit['visual']['cells'][number], horizontalGridScale))
              const portalBounds = unionWorldBounds(portalBoxes, 8)
              return <MainlineReadingIdentityPlane key={`portal:${slot.id}`} identityKey={`portal:${slot.id}`} entityId={slot.id} relatedEntityIds={slot.portalId ? [slot.portalId] : []} protectedEntityIds={readingOcclusionProtectedEntityIds} hiddenIdentityKeys={sceneEcho ? undefined : retainedOcclusionSnapshot?.hiddenIdentityKeys} worldBounds={portalBounds} active={readingOcclusionActive && !sceneEcho} className="scene-mainline-reading-identity-plane scene-mainline-reading-identity-plane--wall">
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
              const featureSpaceId = cell.kind === 'feature' && entityId ? scene.objects.find(candidate => candidate.id === entityId)?.roomId : undefined
              const occlusionSpaceId = featureSpaceId ?? mainlineActiveSpatialSpaceId(scene, { x: cell.x, y: cell.y })
              const sameSpaceFocusGroup = Boolean(groupedFocus && sourceFocusEntries?.every(entry => {
                const entryEntityId = entry.cell.entityId ?? entry.unit.entityId
                const entryRoomId = entry.cell.kind === 'feature' && entryEntityId
                  ? scene.objects.find(candidate => candidate.id === entryEntityId)?.roomId
                  : undefined
                return (entryRoomId ?? mainlineActiveSpatialSpaceId(scene, { x: entry.cell.x, y: entry.cell.y })) === occlusionSpaceId
              }))
              const occlusionIdentityKey = mainlineReadingOcclusionCellIdentity(cell.id, sameSpaceFocusGroup ? cellFocusTarget?.group : undefined, occlusionSpaceId)
              const cellEntity = scene.objects.find(candidate => candidate.id === entityId)
              const preserveBoundary = cell.kind === 'wall' || cell.kind === 'door' || cell.kind === 'opening'
                || unit.surface === 'wall' || unit.surface === 'door'
              const canFadeFeature = Boolean(observationFade && !preserveBoundary && cellEntity && cellEntity.kind !== 'door' && cellEntity.surface !== 'wall')
              return <MainlineReadingIdentityPlane key={`cell:${cell.id}`} identityKey={occlusionIdentityKey} entityId={entityId} relatedEntityIds={relatedEntityIds} protectedEntityIds={readingOcclusionProtectedEntityIds} hiddenIdentityKeys={sceneEcho ? undefined : retainedOcclusionSnapshot?.hiddenIdentityKeys} worldBounds={cellWorldBounds} observationFade={canFadeFeature ? observationFade : undefined} active={readingOcclusionActive && (!sceneEcho || canFadeFeature)} className="scene-mainline-reading-identity-plane scene-mainline-reading-identity-plane--wall">{node}</MainlineReadingIdentityPlane>
            })}
          </div>
          <div className="scene-mainline-counter-layer" data-reading-occlusion-layer="counter">
          {(() => {
            const renderCounter = (parts: typeof counterSurfaces[number]) => {
            const meta = parts[0].counterSurface!
            const entityId = meta.interactionEntityId
            const stageHidden = Boolean(dialogueStage?.hiddenEntityIds.has(entityId))
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
            return <MainlineReadingIdentityPlane key={meta.groupId} identityKey={`counter:${meta.groupId}`} entityId={entityId} protectedEntityIds={readingOcclusionProtectedEntityIds} hiddenIdentityKeys={sceneEcho ? undefined : retainedOcclusionSnapshot?.hiddenIdentityKeys} worldBounds={counterBounds} observationFade={observationFade} active={readingOcclusionActive} className={`scene-mainline-reading-identity-plane scene-mainline-reading-identity-plane--counter${dialogueStage ? ' scene-mainline-dialogue-stage-object' : ''}${stageHidden ? ' is-stage-faded' : ''}`}><MainlineCounterSurface boundedWrapper coordinateBounds={counterBounds} parts={parts} objects={scene.objects} onInteract={onInteract} presentationActive={interiorRoomPresentationActive(meta.roomId)}/></MainlineReadingIdentityPlane>
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
              const stageHidden = Boolean(dialogueStage?.hiddenEntityIds.has(entity.id))
              const canFadeObject = Boolean(observationFade && entity.kind !== 'door' && entity.surface !== 'wall')
              return <MainlineReadingIdentityPlane key={entity.id} identityKey={`object:${entity.id}`} entityId={entity.id} protectedEntityIds={readingOcclusionProtectedEntityIds} hiddenIdentityKeys={sceneEcho ? undefined : retainedOcclusionSnapshot?.hiddenIdentityKeys} worldBounds={objectBounds} observationFade={canFadeObject ? observationFade : undefined} active={readingOcclusionActive} className={`scene-mainline-reading-identity-plane scene-mainline-reading-identity-plane--object${dialogueStage ? ' scene-mainline-dialogue-stage-object' : ''}${stageHidden ? ' is-stage-faded' : ''}`}>{renderMainlineObject(entity, objectBounds)}</MainlineReadingIdentityPlane>
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
              readingOpacity={dialogueStage
                ? mainlineDialogueStageActorOpacity({ active: true, actorId: npc.id, currentSpeakerActorId: dialogueStage.speakerActorId, participantActorIds: dialogueStage.participantActorIds, actorRoomId: npc.roomId, stageRoomId: dialogueStage.roomId })
                : mainlineReadingOpacityForActor(npc.id, dialogueParticipantNpcIds, actorReadingOpacity(npcPosition))}
              readingStageBrightness={Boolean(dialogueStage)}
              readingProtected={Boolean(readingMode && !dialogueStage && (dialogueParticipantNpcIds.has(npc.id) || readingProtectedEntityIds.has(npc.id)))}
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
          {showProtagonist && <div className={`scene-protagonist ${moving ? 'is-moving' : ''} ${readingMode ? 'is-reading-protected' : ''}`} style={{ left: `${protagonistVisualPosition.x}%`, top: `${protagonistVisualPosition.y}%`, filter: dialogueStage ? `brightness(${mainlineDialogueStageActorOpacity({ active: true, actorId: 'protagonist', currentSpeakerActorId: dialogueStage.speakerActorId, participantActorIds: dialogueStage.participantActorIds, actorRoomId: dialogueStage.roomId, stageRoomId: dialogueStage.roomId })})` : undefined, transition: dialogueStage ? 'filter 380ms ease-in-out' : undefined, '--scene-mainline-object-font-size': `${mainlineEntityFontSizePx(null, renderScreenMetrics)}px` } as CSSProperties} data-actor-id="protagonist" data-runtime-x={debugRuntimeEvidence ? position.x : undefined} data-runtime-y={debugRuntimeEvidence ? position.y : undefined} data-rendered-x={debugRuntimeEvidence ? scene.id === 'commercial-street' ? projectCommercialStreetX(protagonistVisualPosition.x, renderScreenMetrics) : protagonistVisualPosition.x : undefined} data-rendered-y={debugRuntimeEvidence ? protagonistVisualPosition.y : undefined} data-seat-entity-id={playerSeatId ?? undefined}>
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
            const stageDialogue = Boolean(isDialogue && dialogueStage)
            const hasNextSegment = sceneEcho
              ? sceneEcho.segmentIndex + 1 < sceneEcho.segments.length
              : dialogueSegmentIndex + 1 < dialogueSegmentCount || Boolean(dialogue && dialogueLineIndex! + 1 < dialogue.lines.length)
            const echoLayout = presentedReadingLayout ?? mainlineEchoLayout(text, readingMetrics, {
              speaker: isDialogue && !stageDialogue ? dialogueLine!.speaker : undefined,
              maxWidthPx: displayReadingMaxWidthPx,
            })
            if (isDialogue && !stageDialogue) {
              const session = `${scene.id}:${dialogue!.triggerEntityId}`
              const metrics = `${readingMetrics.width}:${readingMetrics.height}:${readingMetrics.viewportWidth}:${worldScale}:${displayReadingMaxWidthPx}`
              if (speakerPlacementRef.current?.session !== session || speakerPlacementRef.current.metrics !== metrics) {
                speakerPlacementRef.current = { session, metrics, anchor: mainlineSpeakerAnchor(dialogue!.lines, readingMetrics, { x: projectReadingX(sourcePosition.x), y: sourcePosition.y }, { x: 0, y: 0 }, worldScale, displayReadingMaxWidthPx, readingLayoutSessionCache?.speakerWidthAtOrBelow(displayReadingMaxWidthPx)) }
              }
            }
            const baseSpeakerAnchor = isDialogue && !stageDialogue ? speakerPlacementRef.current!.anchor : null
            const speakerPageAnchor = baseSpeakerAnchor ? mainlineSpeakerPageAnchor(baseSpeakerAnchor, echoLayout, worldScale) : null
            const speakerAnchor = speakerPageAnchor ? { ...speakerPageAnchor, left: speakerPageAnchor.left + readingDisplayShift.x, top: speakerPageAnchor.top + readingDisplayShift.y } : null
            return <Fragment>
            {isDialogue && speakerAnchor && <div
              key={`speaker:${scene.id}:${dialogue!.triggerEntityId}`}
              className={`scene-mainline-speaker-anchor ${isLeaving ? 'is-leaving' : ''}`}
              aria-live="polite"
              style={{ left: `${speakerAnchor.left}%`, top: `${speakerAnchor.top}%`, width: `${speakerAnchor.worldWidthPx}px`, minHeight: `${echoLayout.heightPx / worldScale}px`, fontSize: `${echoLayout.fontSizePx / worldScale}px` }}
            ><DialogueSpeaker speaker={dialogueLine!.speaker} /></div>}
            <div
              key={readingLayoutContinuityKey ?? sceneEcho?.id ?? dialogueLine!.id}
              className={`scene-mainline-text scene-mainline-text--${isDialogue ? 'dialogue' : 'observation'} ${stageDialogue ? 'scene-mainline-text--stage-dialogue' : ''} ${isLeaving ? 'is-leaving' : ''}`}
              style={{
                left: `${speakerAnchor
                  ? speakerAnchor.left + speakerAnchor.worldWidthPx / sceneDesignReferenceMetrics.width * 50
                  : projectReadingX(position.x)}%`,
                top: `${speakerAnchor?.top ?? position.y}%`,
                '--scene-mainline-text-width': `${echoLayout.widthPx / worldScale}px`,
                '--scene-mainline-text-height': `${echoLayout.heightPx / worldScale}px`,
                fontSize: `${echoLayout.fontSizePx / worldScale}px`,
                maxWidth: `${Math.max(1, displayReadingMaxWidthPx / worldScale)}px`,
                overflow: 'visible',
                visibility: sceneEcho && readingFit?.fits === false ? 'hidden' : undefined,
                opacity: stageDialogue && dialogueHandoffActive ? 0 : undefined,
                transition: stageDialogue && dialogueHandoffActive ? `opacity ${dialogueHandoffFadeDurationMs}ms linear` : undefined,
              } as CSSProperties}
              aria-live="polite"
              data-scene-interaction-text={sceneEcho?.entityId ?? dialogue?.triggerEntityId ?? 'scene'}
              data-scene-echo={sceneEcho ? sceneEcho.entityId ?? 'scene' : undefined}
              data-scene-observation-typing={sceneEcho ? String(sceneEcho.textMotion === 'typing') : undefined}
              data-scene-dialogue={isDialogue ? dialogue?.triggerEntityId : undefined}
              data-dialogue-line-id={isDialogue ? dialogueLine?.id : undefined}
              data-dialogue-speaker={isDialogue ? dialogueLine?.speaker : undefined}
              data-dialogue-stage-handoff={stageDialogue ? String(dialogueHandoffActive) : undefined}
              data-dialogue-stage-fade-duration-ms={stageDialogue ? dialogueHandoffFadeDurationMs : undefined}
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
              {isDialogue && !stageDialogue && <span className="scene-mainline-text__speaker scene-mainline-text__speaker-space" aria-hidden="true">&nbsp;</span>}
              {isDialogue
                ? <DialogueText group={`${group}:${dialogueSegmentIndex}:fit:${displayOverflowIndex}`} continuityKey={readingLayoutContinuityKey ?? group} pageKey={readingLayoutPageKey ?? group} text={text} sessionId={dialogueTextSessionId} motion={dialogueTextMotion} layout={displayReadingLayout ?? echoLayout} worldScale={worldScale} lockToken={readingPageAdvanceLockTokenRef.current} onMotionComplete={onDialogueTextMotionComplete} onReadyChange={updateDialogueReady} onFlipStart={startReadingPageAdvanceFlip} onFlipComplete={releaseReadingPageAdvance} onFlipCancel={releaseReadingPageAdvance} onSettled={setSettledReadingPageKey} />
                : <ObservationText echoId={sceneEcho!.id} continuityKey={readingLayoutContinuityKey ?? group} pageKey={readingLayoutPageKey ?? group} text={text} motion={sceneEcho!.textMotion} paused={readingFit?.fits === false} layout={displayReadingLayout ?? echoLayout} worldScale={worldScale} lockToken={readingPageAdvanceLockTokenRef.current} onMotionComplete={onSceneEchoTextMotionComplete} onFlipStart={startReadingPageAdvanceFlip} onFlipComplete={releaseReadingPageAdvance} onFlipCancel={releaseReadingPageAdvance} onSettled={setSettledReadingPageKey} />}
            </div>
            </Fragment>
          })()}
          {sceneAction && <div
            ref={sceneActionRef}
            className="scene-mainline-action scene-mainline-action--reading"
            style={{
              left: `${frozenActionPlacement?.position.x ?? sceneActionLayerPosition?.x ?? sceneAction.position.x}%`,
              top: `${frozenActionPlacement?.position.y ?? sceneActionLayerPosition?.y ?? sceneAction.position.y}%`,
              maxWidth: `${frozenActionPlacement?.maxWidth ?? Math.max(1, Math.min(sceneActionMaxWidthPx, sceneActionPlacement?.availableWidthPx ?? sceneActionMaxWidthPx) / worldScale)}px`,
              maxHeight: frozenActionPlacement ? `${frozenActionPlacement.maxHeight}px` : sceneActionPlacement ? `${Math.max(1, sceneActionPlacement.availableHeightPx / worldScale)}px` : undefined,
              overflowY: (frozenActionPlacement?.overflowY ?? sceneActionPlacement?.overflowY) ? 'auto' : 'visible',
              visibility: actionVisible ? 'visible' : 'hidden',
              pointerEvents: actionVisible ? undefined : 'none',
            }}
            data-scene-action={sceneAction.entityId ?? 'scene'}
            data-scene-action-phase={sceneAction.phase ?? 'active'}
            data-scene-action-waiting-for-dialogue={sceneAction.phase === 'active' && !dialogueOptionsAllowed ? 'true' : 'false'}
            data-scene-action-position-x={sceneAction.position.x}
            data-scene-action-position-y={sceneAction.position.y}
            data-scene-action-rendered-x={sceneActionPlacement?.position.x ?? sceneAction.position.x}
            data-scene-action-rendered-y={sceneActionPlacement?.position.y ?? sceneAction.position.y}
            data-scene-action-measured-width={matchingSceneActionSize?.width}
            data-scene-action-measured-height={matchingSceneActionSize?.height}
            data-scene-action-max-height={sceneActionPlacement?.availableHeightPx}
            data-scene-action-overflow-y={String(sceneActionPlacement?.overflowY ?? false)}
            onPointerUp={(event) => event.stopPropagation()}
            onPointerCancel={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {sceneAction.options.map((option, index) => (
              <EntryButtonSurface
                key={option}
                visible={sceneAction.phase === 'active'}
                entryId={`scene-action:${sceneAction.entityId ?? 'scene'}:${option}`}
                actionScopeId={sceneAction.id}
                label={option}
                contentSized
                materialMode="world"
                worldLayer="surface"
                disabled={sceneAction.phase !== 'active'}
                dataAttributes={{ 'data-scene-action-option-index': index }}
                onActionStart={(event: { actionScopeId?: number }) => onSceneActionStart?.(event.actionScopeId as number, index)}
                onActionComplete={(event: { actionScopeId?: number }) => onSceneActionChoice?.(event.actionScopeId as number, index)}
                onExitComplete={(event: { actionScopeId?: number }) => onSceneActionExitComplete?.(event.actionScopeId as number, index)}
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
                if (readingPageAdvanceLockedRef.current || (sceneEcho && readingFit?.fits === false)) return
                if (sceneEcho?.textMotion === 'deleting' || sceneEcho?.textMotion === 'deleted' || dialogueTextMotion === 'deleting' || dialogueTextMotion === 'deleted') return
                if (readingPresentationMode === 'observation' && sceneEcho?.textMotion === 'typing') {
                  typingCompletionLockRef.current = true
                  typingCompletionLockTokenRef.current = lockReadingPageAdvance()
                  onSceneEchoAdvance?.()
                  return
                }
                if (readingPresentationMode === 'dialogue' && dialogueTextMotion === 'typing') {
                  typingCompletionLockRef.current = true
                  typingCompletionLockTokenRef.current = lockReadingPageAdvance()
                  onDialogueTypingSkip?.(dialogueTextSessionId)
                  return
                }
                if (displayOverflowIndex + 1 < fittedReadingSegments.length) {
                  lockReadingPageAdvance()
                  if (readingSessionKey) setReadingOverflowPage({ sessionKey: readingSessionKey, key: readingOverflowKey, index: displayOverflowIndex + 1, sourceOffset: sceneEcho ? fittedReadingSegments.slice(0, displayOverflowIndex + 1).join('').length : undefined })
                  return
                }
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
            >{sceneEcho && readingFit?.fits === false && <span role="status" style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', color: 'white', background: '#222', padding: '8px 12px' }}>空间不足，请调整窗口大小</span>}</button>
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
