'use client'

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import EntryButtonSurface from '../../components/EntryButtonSurface'
import type { CollisionBox, Point } from './sceneGeometry'
import { mainlineStorefrontAnchor, type MainlineSceneDefinition, type MainlineSceneEntity, type MainlineSceneGeometryUnit } from './mainlineScenes'
import type { MainlineSceneDialogueLine, MainlineSceneDialoguePresentation } from './mainlineSceneModel'
import { clampMainlineLayoutAnchor, mainlineEntityFontSizePx, mainlineLabelFootprint, mainlineLayoutAnchor, mainlineLayoutItemForEntity, snapDelta, snapPoint, type LayoutItemId, type SceneLayout } from './sceneLayout'
import type { MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { SceneDoor, type SceneDoorTransitionCompletion } from './SceneDoor'
import { sceneDoorIsVisuallyOpen, type SceneDoorRuntimePhase } from './sceneDoorConfig'
import { readSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { useSceneFocusFrameController } from './SceneFocusFrames'
import type { SceneFrameTarget } from './sceneFrameLifecycle'
import type { SceneFocusFrameMotionProfile } from './sceneFrameExitSchedule'
import { mainlineEchoLayout, mainlineSpeakerAnchor } from './mainlineEchoLayout'
import { DialogueSpeaker } from './DialogueSpeaker'
import { mainlineVisiblePresentationText } from './dialoguePresentation'
import { resolveMainlineNpcPosition } from './mainlineNavigation'
import { isMainlineSeatLabelSuppressed, isMainlineSeatPrompted, mainlineProtagonistPresentation, mainlineSceneOccupiedSeatIds, mainlineSeatedActorVisualPosition } from './mainlineSeating'
import { mainlineNpcStagedSeatId } from './mainlineNpcStaging'
import type { NpcRuntimeSnapshot } from './npcCore'
import { resolveMainlineInteractionVisualState } from './mainlineInteractionVisualState'
import { storefrontLabelRollDurationMs, storefrontPresentationLabelSlots, storefrontPresentationRetractsFrame, type StorefrontPresentationPhase } from './storefrontPresentation'
import { commercialStreetStorefrontInteractionFor } from './commercialStreetStorefrontInteractions'
import type { StorefrontContactGeometry } from './storefrontContactGeometry'

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
  onStorefrontRevealMotionComplete?: (storefrontId: string) => void
  onStorefrontLingerAnimationComplete?: (storefrontId: string) => void
  onStorefrontRestoreMotionComplete?: (storefrontId: string) => void
  gateTriggered?: boolean
  geometrySnapshot: MainlineSceneGeometrySnapshot
  freezeFrameMeasurements?: boolean
  onScreenMetricsChange?: (metrics: SceneScreenMetrics) => void
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
  onSceneEchoExitComplete?: (echoId: number) => void
  sceneAction?: { entityId?: string; options: readonly string[]; position: Point; phase?: 'active' | 'committing' } | null
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

function isAltarEntity(scene: MainlineSceneDefinition, entityId: string) {
  return scene.altars.some((altar) => altar.incenseBurnerId === entityId)
    || scene.furnitureGroups.some((group) => group.layout === 'altar-ring' && group.entityIds.includes(entityId))
}

export function mainlineEntityUsesBreathing(scene: MainlineSceneDefinition, entity: MainlineSceneEntity) {
  const isOfferingTable = entity.kind === 'table' && scene.furnitureGroups.some((group) => group.layout === 'altar-ring' && group.entityIds.includes(entity.id))
  const isIncense = entity.visualProfile === 'incense'
  return (entity.visualProfile === 'tree-ring' && entity.interactive !== false)
    || isIncense
    || isOfferingTable
    || entity.animationGroup === 'office-breathing'
}

function objectClass(scene: MainlineSceneDefinition, entity: MainlineSceneEntity, visibility: string, active: boolean, explored: boolean, tutorialCompleted: boolean, underPlayer: boolean, selected: boolean, dragging: boolean, incenseLit: boolean) {
  const isOfferingTable = entity.kind === 'table' && scene.furnitureGroups.some((group) => group.layout === 'altar-ring' && group.entityIds.includes(entity.id))
  const isIncense = entity.visualProfile === 'incense'
  const tutorialEligible = mainlineEntityUsesBreathing(scene, entity)
  const interactionVisualState = entity.interactive === false
    ? null
    : resolveMainlineInteractionVisualState({
      active,
      dynamic: isIncense && incenseLit,
      explored,
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
    active ? 'is-active' : '',
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

type MainlineDoorButtonProps = {
  cell: MainlineGeometryCellEntry['cell']
  entityId: string
  className: string
  style: CSSProperties
  doorLabel: string
  glyph: string
  doorPhase: SceneDoorRuntimePhase
  focusGroup: string
  focusPolicy: Exclude<MainlineFocusPolicy, 'interactive'>
  gateTriggered: boolean
  frameRetracting: boolean
  active: boolean
  closeHint: string
  ariaLabel: string
  renderFocusFrame: (group: string) => ReactNode
  onInteract: (id: string) => void
  onDoorTransitionComplete?: (entityId: string, completion: SceneDoorTransitionCompletion) => void
  dataAttributes?: Record<string, string | undefined>
}

type MainlineAmbientNpcActorProps = {
  npc: MainlineSceneDefinition['npcs'][number]
  position: Point
  snapshot: NpcRuntimeSnapshot
  screenMetrics: SceneScreenMetrics
  debugRuntimeEvidence: boolean
}

/** Ambient locomotion owns its live point; this component only projects it into the scene. */
function MainlineAmbientNpcActorView({ npc, position, snapshot, screenMetrics, debugRuntimeEvidence }: MainlineAmbientNpcActorProps) {
  const visualFootprint = mainlineLabelFootprint(npc.label, position, screenMetrics, { lineHeight: 1 })
  return <span
    className="scene-mainline-npc scene-mainline-npc--ambient"
    style={{
      left: `${position.x}%`,
      top: `${position.y}%`,
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
    data-rendered-x={debugRuntimeEvidence ? position.x : undefined}
    data-rendered-y={debugRuntimeEvidence ? position.y : undefined}
    data-visual-x={debugRuntimeEvidence ? visualFootprint.x : undefined}
    data-visual-y={debugRuntimeEvidence ? visualFootprint.y : undefined}
    data-visual-width={debugRuntimeEvidence ? visualFootprint.width : undefined}
    data-visual-height={debugRuntimeEvidence ? visualFootprint.height : undefined}
    aria-hidden="true"
  >{npc.label}</span>
}

export const MainlineAmbientNpcActor = memo(MainlineAmbientNpcActorView)

function ObservationText({ echoId, text, typing, onTypingComplete }: { echoId: number; text: string; typing: boolean; onTypingComplete?: (echoId: number) => void }) {
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
      const next = Math.min(characters.length, Math.floor((now - startedAt) / 28) + 1)
      setVisibleCount((current) => current === next ? current : next)
      if (next < characters.length) frame = window.requestAnimationFrame(advance)
      else onTypingComplete?.(echoId)
    }
    frame = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frame)
  }, [characters, echoId, onTypingComplete, typing])

  return <span className="scene-mainline-text__observation" data-scene-text-mode="observation">{characters.slice(0, visibleCount).join('')}</span>
}

function DialogueText({ group, text, onReadyChange }: { group: string; text: string; onReadyChange?: (group: string, ready: boolean) => void }) {
  useIsomorphicLayoutEffect(() => onReadyChange?.(group, false), [group, onReadyChange])
  return <span
    className="scene-mainline-text__dialogue"
    data-scene-text-mode="dialogue"
  >
    <span key={group} onAnimationEnd={(event) => {
      if (event.target === event.currentTarget) onReadyChange?.(group, true)
    }}>{mainlineVisiblePresentationText(text)}</span>
  </span>
}

function MainlineDoorButton({ cell, entityId, className, style, doorLabel, glyph, doorPhase, focusGroup, focusPolicy, gateTriggered, frameRetracting, active, closeHint, ariaLabel, renderFocusFrame, onInteract, onDoorTransitionComplete, dataAttributes }: MainlineDoorButtonProps) {
  const visualOpen = sceneDoorIsVisuallyOpen(cell.doorBehavior, doorPhase)
  return (
    <button
      className={`${className} scene-mainline-door-button ${visualOpen ? 'is-open' : ''} ${active ? 'is-active' : ''}`}
      type="button"
      style={style}
      onClick={(event) => { event.stopPropagation(); onInteract(entityId) }}
      aria-label={`${ariaLabel}；${closeHint}`}
      data-focus-target-id={cell.id}
      data-focus-target-group={focusGroup}
      data-focus-target-policy={focusPolicy}
      data-focus-passage-phase={focusPolicy === 'passage' ? doorPhase : undefined}
      data-focus-passage-retracting={frameRetracting ? 'true' : undefined}
      data-focus-gate-triggered={focusPolicy === 'gate' ? gateTriggered : undefined}
      {...dataAttributes}
    >
      <SceneDoor phase={doorPhase} behavior={cell.doorBehavior} label={doorLabel} glyph={glyph} onTransitionComplete={(completion) => onDoorTransitionComplete?.(entityId, completion)} />
      {renderFocusFrame(focusGroup)}
    </button>
  )
}

function storefrontFocusGroup(cell: MainlineGeometryCellEntry['cell'], variant?: MainlineSceneGeometryUnit['variant']) {
  const variantSuffix = variant ? `:${variant}` : ''
  return `storefront:${cell.storefrontId ?? cell.id}${variantSuffix}`
}

function storefrontDoorFocusGroup(cell: MainlineGeometryCellEntry['cell'], variant?: MainlineSceneGeometryUnit['variant']) {
  const variantSuffix = variant ? `:${variant}` : ''
  return `storefront-door:${cell.storefrontId ?? cell.id}${variantSuffix}`
}

function mainlineCellFocusTarget(scene: MainlineSceneDefinition, cell: MainlineGeometryCellEntry['cell'], entityId?: string, variant?: MainlineSceneGeometryUnit['variant']) {
  if (cell.kind === 'storefront' && cell.storefrontRole === 'sign') {
    return {
      group: storefrontFocusGroup(cell, variant),
      policy: commercialStreetStorefrontInteractionFor(cell.storefrontId ?? '') ? 'interactive' as const : 'passage' as const,
      storefrontInteractionId: commercialStreetStorefrontInteractionFor(cell.storefrontId ?? '') ? cell.storefrontId : undefined,
    }
  }
  if (cell.kind === 'storefront' && cell.storefrontRole === 'door' && entityId) {
    return { group: storefrontDoorFocusGroup(cell, variant), policy: 'passage' as const }
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

function mainlineWallCellVisibility(cell: MainlineGeometryCellEntry['cell'], unit: MainlineSceneGeometryUnit) {
  if (cell.kind === 'wall') return 'is-baseline'
  if (cell.kind === 'storefront') return unit.variant === 'near' ? 'is-near' : 'is-baseline'
  return (cell.baselineVisible ?? cell.baseline ?? true) ? 'is-baseline' : 'is-hidden'
}

export function MainlineFocusGroup({ entries, className, visibilityClass, renderFrame, onInteract, onStorefrontInteract, interactionEntityId, storefrontInteractionId, ariaLabel, passagePhase, gateTriggered, frameRetracting = false, hideGlyphs = false, storefrontId, storefrontSpan, storefrontCenter, storefrontLabel, storefrontGeometry, storefrontPresentationPhase = 'baseline', onStorefrontPresentationMotionComplete, active = false, explored = false }: {
  entries: readonly MainlineGeometryCellEntry[]
  className: string
  visibilityClass: string
  renderFrame: (group: string) => ReactNode
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
  onStorefrontPresentationMotionComplete?: (phase: 'revealing' | 'lingering' | 'restoring') => void
  active?: boolean
  explored?: boolean
}) {
  const first = entries[0]
  if (!first) return null
  const xs = entries.map(({ cell }) => cell.x)
  const ys = entries.map(({ cell }) => cell.y)
  const vertical = first.cell.orientation === 'vertical'
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
  const style = vertical
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
    <span className="scene-mainline-storefront__label-slot" data-storefront-label-slot="true" data-storefront-id={storefrontId} style={{ '--storefront-label-length': Array.from(storefrontLabel).length * 1.08 } as CSSProperties}>
      {storefrontPresentationLabelSlots(storefrontLabel).map((label) => (
        <span
          key={label}
          className="scene-mainline-storefront__label-track"
          data-storefront-label-phase={storefrontPresentationPhase}
          style={{ '--storefront-label-roll-duration': `${storefrontLabelRollDurationMs}ms` } as CSSProperties}
          onTransitionEnd={(event) => {
            if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
            if (storefrontPresentationPhase === 'revealing') onStorefrontPresentationMotionComplete?.('revealing')
          }}
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget) return
            if (storefrontPresentationPhase === 'lingering' || storefrontPresentationPhase === 'restoring') onStorefrontPresentationMotionComplete?.(storefrontPresentationPhase)
          }}
        ><span className="scene-mainline-storefront__label-text">{label}</span></span>
      ))}
    </span>
  ) : glyphs.map((glyph, index) => {
    const cell = entries[index]?.cell
    if (!cell) return null
    const offset = vertical
      ? ((cell.y - centerY) / Math.max(.001, span)) * 100 + 50
      : ((cell.x - centerX) / Math.max(.001, span)) * 100 + 50
    return <span key={entries[index]?.cell.id} className="scene-mainline-focus-group__glyph" style={{ left: vertical ? '50%' : `${offset}%`, top: vertical ? `${offset}%` : '50%' }} aria-hidden="true">{glyph}</span>
  })
  const commonProps = {
    className: `scene-mainline-focus-group ${className} ${visibilityClass} scene-mainline-interaction--${resolveMainlineInteractionVisualState({ active, explored, tutorialCompleted: true, tutorialEligible: false })}`,
    style,
    'data-focus-target-id': first.cell.id,
    'data-focus-target-group': first.focusGroup,
    'data-focus-target-policy': first.focusPolicy,
    'data-focus-passage-phase': first.focusPolicy === 'passage' ? passagePhase : undefined,
    'data-focus-passage-retracting': frameRetracting ? 'true' : undefined,
    'data-focus-gate-triggered': first.focusPolicy === 'gate' ? gateTriggered : undefined,
  }
  if (first.focusPolicy === 'interactive' && interactionEntityId && onInteract) {
    return <button {...commonProps} type="button" onClick={(event) => { event.stopPropagation(); onInteract(interactionEntityId) }} aria-label={ariaLabel}>{content}{renderFrame(first.focusGroup)}</button>
  }
  if (first.focusPolicy === 'interactive' && storefrontInteractionId && onStorefrontInteract) {
    return <button {...commonProps} type="button" onClick={(event) => { event.stopPropagation(); onStorefrontInteract(storefrontInteractionId) }} aria-label={ariaLabel}>{content}{renderFrame(first.focusGroup)}</button>
  }
  return <span {...commonProps} aria-hidden="true">{content}{renderFrame(first.focusGroup)}</span>
}

function MainlineObject({ entity, scene, position, collision, visualBounds, focusGroup, renderFrame, visibility, active, explored, tutorialCompleted, underPlayer, layoutMode, selected, dragging, screenMetrics, incenseLit, incenseBurnRemainingMs, onIncenseBurnComplete, onStartLayoutDrag, onSelectLayoutItem, onInteract, breathingAnimationDelay, sharedBreathingClock, registerBreathingNode, suppressLabel = false, prompted = false, debugRuntimeEvidence = false }: {
  entity: MainlineSceneEntity
  scene: MainlineSceneDefinition
  position: Point
  collision?: CollisionBox
  visualBounds?: CollisionBox | null
  focusGroup?: string
  renderFrame?: (group: string) => ReactNode
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
}) {
  const layoutItemId = mainlineLayoutItemForEntity(scene, entity.id)
  const className = objectClass(scene, entity, visibility, active, explored, tutorialCompleted, underPlayer, selected, dragging, incenseLit)
  const visualScale = entity.visualScale ?? 1
  // Focus emphasis follows the visible label/glyph's typography, never the
  // object's collision or authored spatial envelope.
  const focusContent = Boolean(focusGroup && visualBounds)
  const renderedPosition = position
  const commonProps = {
    className: `${className} ${layoutItemId ? 'scene-object--layout-draggable' : ''} ${suppressLabel ? 'is-occupied' : ''} ${prompted ? 'is-story-prompted' : ''}`,
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
    } as CSSProperties,
    'data-object-id': entity.id,
    'data-focus-target-id': focusGroup ? entity.id : undefined,
    'data-focus-target-group': focusGroup,
    'data-focus-target-policy': focusGroup ? 'interactive' : undefined,
    'data-layout-item-id': layoutItemId ?? undefined,
    'data-story-seat-prompt': prompted ? 'true' : undefined,
    'data-rendered-x': debugRuntimeEvidence ? position.x : undefined,
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
    transform: visualScale === 1 ? undefined : `scale(${visualScale})`,
  } as CSSProperties
  const labelRef = useCallback((node: HTMLSpanElement | null) => {
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
          }}
          aria-hidden="true"
        ><span className="scene-mainline-object__focus-measure">{entity.label}</span>{renderFrame(focusGroup)}</span>
      : renderFrame(focusGroup)
    : null

  if (entity.interactive === false) {
    return <>{focusContent && frame}<span {...commonProps} aria-hidden="true">{!suppressLabel && <span className="scene-mainline-object__label" ref={labelRef} style={labelStyle}>{entity.label}</span>}{!focusContent && frame}</span></>
  }

  return (
    <>
      {focusContent && frame}
      <button
      {...commonProps}
      type="button"
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
      {!suppressLabel && <span className="scene-mainline-object__label" ref={labelRef} style={labelStyle}>{entity.label}</span>}
      {!focusContent && frame}
      </button>
    </>
  )
}

const MemoMainlineObject = memo(MainlineObject)

type MainlineNpcActorProps = {
  npc: MainlineSceneDefinition['npcs'][number]
  position: Point
  snapshot?: NpcRuntimeSnapshot
  seatId?: string
  seatPosition?: Point
  screenMetrics: SceneScreenMetrics
  interactive: boolean
  debugRuntimeEvidence: boolean
  onInteract?: (npcId: string) => void
}

function MainlineNpcActor({ npc, position, snapshot, seatId, seatPosition, screenMetrics, interactive, debugRuntimeEvidence, onInteract }: MainlineNpcActorProps) {
  const visualPosition = mainlineSeatedActorVisualPosition(position, seatId, seatPosition)
  const visualFootprint = mainlineLabelFootprint(npc.label, visualPosition, screenMetrics, { lineHeight: 1 })
  const className = `scene-mainline-npc ${interactive ? '' : 'scene-mainline-npc--ambient'}`
  const style = {
    left: `${visualPosition.x}%`,
    top: `${visualPosition.y}%`,
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
    'data-rendered-x': debugRuntimeEvidence ? visualPosition.x : undefined,
    'data-rendered-y': debugRuntimeEvidence ? visualPosition.y : undefined,
    'data-visual-x': debugRuntimeEvidence ? visualFootprint.x : undefined,
    'data-visual-y': debugRuntimeEvidence ? visualFootprint.y : undefined,
    'data-visual-width': debugRuntimeEvidence ? visualFootprint.width : undefined,
    'data-visual-height': debugRuntimeEvidence ? visualFootprint.height : undefined,
  }
  return interactive
    ? <button {...attributes} type="button" onClick={(event) => { event.stopPropagation(); onInteract?.(npc.id) }} aria-label={`${npc.label}，点击让主角前往互动`}><span>{npc.label}</span></button>
    : <span {...attributes} aria-hidden="true">{npc.label}</span>
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
  onStorefrontRevealMotionComplete,
  onStorefrontLingerAnimationComplete,
  onStorefrontRestoreMotionComplete,
  onScreenMetricsChange,
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
  const [dialogueReady, setDialogueReady] = useState(false)
  const speakerPlacementRef = useRef<{ session: string; metrics: string; anchor: ReturnType<typeof mainlineSpeakerAnchor> } | null>(null)
  if (!dialogue || !dialogueLine || !dialoguePosition || sceneEcho) speakerPlacementRef.current = null
  const dialogueReadyGroupRef = useRef<string | null>(null)
  const currentDialogueGroupRef = useRef<string | null>(null)
  const dialogueAdvanceConsumedGroupRef = useRef<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const altarBreathingNodesRef = useRef(new Map<string, HTMLSpanElement>())
  const registerBreathingNode = useCallback((entityId: string, node: HTMLSpanElement | null) => {
    if (node) altarBreathingNodesRef.current.set(entityId, node)
    else altarBreathingNodesRef.current.delete(entityId)
  }, [])
  const altarLeaderIds = useMemo(() => new Set(scene.altars.map((altar) => altar.incenseBurnerId)), [scene.altars])
  const occupiedSeatIds = useMemo(() => runtimeOccupiedSeatIds ?? mainlineSceneOccupiedSeatIds(scene), [runtimeOccupiedSeatIds, scene])
  const protagonistPresentation = mainlineProtagonistPresentation(playerSeatId)
  const currentDialogueGroup = dialogue && dialogueLine
    ? `dialogue:${dialogueLine.id}:${dialogueSegmentIndex}`
    : null
  currentDialogueGroupRef.current = currentDialogueGroup
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
  const hasAltarBreathing = scene.objects.some((entity) => isAltarEntity(scene, entity.id))
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
    if (!stage) return undefined
    const reportMetrics = () => {
      const metrics = readSceneScreenMetrics(stage)
      if (!metrics) return
      onScreenMetricsChange?.(metrics)
    }
    reportMetrics()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(reportMetrics)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [onScreenMetricsChange])

  // The page owns the stage measurement and passes the same snapshot to
  // navigation and rendering. Keeping one authority prevents a responsive
  // stage from projecting visible cells with one size while navigation tests
  // collision against another.
  const renderScreenMetrics = geometrySnapshot.screenMetrics
  const geometryUnits = geometrySnapshot.units
  const geometryCells = useMemo(() => geometryUnits.flatMap((unit) => unit.visual.cells.map((cell) => ({
    unit,
    // The compiled geometry unit owns storefront identity. Carry it into
    // every visual cell so a vertical label cannot split into one focus group
    // per glyph when a cell omitted its local copy of the id.
    cell: cell.kind === 'storefront' && unit.storefrontId
      ? { ...cell, storefrontId: unit.storefrontId }
      : cell,
  }))), [geometryUnits])
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
      const storefront = cell.storefrontId ? scene.storefronts.find((candidate) => candidate.id === cell.storefrontId) : undefined
      const storefrontPresentationPhase = storefront ? storefrontPresentation.get(storefront.id) ?? 'baseline' : 'baseline'
      const storefrontPassageEntityId = storefront?.portalId
        ? scene.passages.find((passage) => passage.portalId === storefront.portalId)?.entityId
        : undefined
      const passageEntityId = storefrontPassageEntityId ?? entityId
      const interactionId = target.storefrontInteractionId ?? entityId
      const sceneExitMatchesTarget = sceneFrameExit.scope === 'scene'
        || (target.policy === 'passage' && sceneFrameExit.passageEntityId === passageEntityId)
      const retractRequested = sceneFrameExit.phase === 'retracting'
        && sceneExitMatchesTarget
        && (!sceneFrameExit.requestedGroups || sceneFrameExit.requestedGroups.includes(target.group))
      addTarget({
        group: target.group,
        policy: target.policy,
        phase: target.policy === 'passage' ? doorPhases.get(passageEntityId ?? '') ?? 'closed' : 'closed',
        gateTriggered: target.policy === 'gate' && gateTriggered,
        interactionBusy: target.policy === 'interactive' && activeObjectId === interactionId && moving,
        interactionActive: target.policy === 'interactive' && (activeObjectId === interactionId || sceneEcho?.entityId === interactionId),
        retractRequested: retractRequested
          || (cell.kind === 'storefront' && cell.storefrontRole === 'sign' && storefrontPresentationRetractsFrame(storefrontPresentationPhase)),
        suppressed: false,
      })
    })
    scene.objects.forEach((entity) => {
      if (entity.focusFrame !== 'interactive' || entity.visible === false) return
      const group = `interactive:${entity.id}`
      addTarget({
        group,
        policy: 'interactive',
        phase: 'closed',
        gateTriggered: false,
        interactionBusy: activeObjectId === entity.id && moving,
        interactionActive: activeObjectId === entity.id || sceneEcho?.entityId === entity.id,
        retractRequested: false,
        suppressed: false,
      })
    })
    return [...targetMap.values()]
  }, [activeObjectId, doorPhases, gateTriggered, geometryCells, layoutMode, moving, scene, sceneEcho, sceneFrameExit, storefrontPresentation])
  const focusFrames = useSceneFocusFrameController({
    targets: focusFrameTargets,
    freezeMeasurements: freezeFrameMeasurements,
  })
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
    return {
      x: ((clientX - rect.left) / rect.width) * 100 - cameraOffset.x,
      y: ((clientY - rect.top) / rect.height) * 100 - cameraOffset.y,
    }
  }, [cameraOffset.x, cameraOffset.y])

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
    const point = { x: screenPoint.x - cameraOffset.x, y: screenPoint.y - cameraOffset.y }
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
  }, [cameraOffset.x, cameraOffset.y, layoutMode, onInputDiagnostic, onLayoutChange, onWalk, scene, selectedLayoutItemId])

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

  return (
    <section className="scene-wrap" aria-label={`${scene.title}可探索场景`}>
      <div ref={stageRef} className={`scene-stage mainline-scene-stage ${layoutMode ? 'is-layout-editing' : ''} ${readingMode ? 'is-scene-dialogue-active' : ''}`} style={{ '--scene-mainline-object-font-size': `${mainlineEntityFontSizePx(null, renderScreenMetrics)}px` } as CSSProperties} onClick={walkToEmptySpace} onPointerUp={walkFromTouch} onPointerDownCapture={focusFrames.onPointerDownCapture} onPointerOverCapture={focusFrames.onPointerOverCapture} onPointerOutCapture={focusFrames.onPointerOutCapture} onClickCapture={focusFrames.onClickCapture} data-layout-mode={layoutMode ? 'edit' : 'play'} data-mainline-scene={scene.id} data-camera-offset-x={debugRuntimeEvidence ? cameraOffset.x : undefined} data-camera-offset-y={debugRuntimeEvidence ? cameraOffset.y : undefined} data-scene-dialogue-state={dialoguePhase}>
        {layoutMode && <div className="scene-layout-grid" aria-hidden="true" />}

        <div className={`scene-mainline-world ${suppressWorldEnterAnimation ? 'is-local-slide-handoff' : ''}`} style={{ transform: `translate(${cameraOffset.x}%, ${cameraOffset.y}%)` }}>
          <>
          <div className="scene-spatial-labels scene-spatial-labels--wall scene-mainline-wall-labels">
            {geometryCells.map(({ unit, cell }) => {
              if (cell.glyph === '') return null
              const visibilityClass = mainlineWallCellVisibility(cell, unit)
              const entityId = cell.entityId ?? unit.entityId
              const focusTarget = mainlineCellFocusTarget(scene, cell, entityId, unit.variant)
              const focusEntries = focusTarget ? focusGroupCells.get(focusTarget.group) : undefined
      if (focusTarget && focusEntries && (focusEntries.length > 1 || cell.kind === 'storefront' && cell.storefrontRole === 'sign')) {
                if (focusEntries[0]?.cell.id !== cell.id) return null
                const groupVisibilityClass = focusEntries.some((entry) => mainlineWallCellVisibility(entry.cell, entry.unit) === 'is-near')
                  ? 'is-near'
                  : focusEntries.some((entry) => mainlineWallCellVisibility(entry.cell, entry.unit) === 'is-baseline')
                  ? 'is-baseline'
                  : 'is-hidden'
                const firstEntry = focusEntries[0]
                if (cell.kind === 'storefront') {
                  const storefront = cell.storefrontId ? scene.storefronts.find((candidate) => candidate.id === cell.storefrontId) : undefined
                  const storefrontPresentationPhase = storefront ? storefrontPresentation.get(storefront.id) ?? 'baseline' : 'baseline'
                  const storefrontState = firstEntry.unit.variant === 'near' ? 'near' : 'baseline'
                  const storefrontRole = cell.storefrontRole ?? 'sign'
                  const storefrontPassageEntityId = storefront?.portalId
                    ? scene.passages.find((passage) => passage.portalId === storefront.portalId)?.entityId
                    : undefined
                  const storefrontPhase = storefrontPassageEntityId ? doorPhases.get(storefrontPassageEntityId) ?? 'closed' : 'closed'
                  const groupClass = `scene-mainline-storefront scene-mainline-storefront--${cell.storefrontStyle ?? 'modern'} scene-mainline-storefront--${storefrontRole} scene-mainline-storefront--${cell.orientation ?? 'horizontal'} ${storefront?.portalId ? 'scene-mainline-storefront--portal' : ''} is-${storefrontState}`
                  return <MainlineFocusGroup
                    key={`focus-${focusTarget.group}`}
                    entries={focusEntries}
                    className={`${groupClass} is-storefront-${storefrontPresentationPhase}`}
                    visibilityClass={groupVisibilityClass}
                    renderFrame={focusFrames.renderFrame}
                    onStorefrontInteract={onStorefrontInteract}
                    storefrontInteractionId={commercialStreetStorefrontInteractionFor(storefront?.id ?? '') ? storefront?.id : undefined}
                    storefrontId={storefrontRole === 'sign' ? storefront?.id : undefined}
                    storefrontSpan={storefront ? storefront.end - storefront.start : undefined}
                    storefrontCenter={storefront ? mainlineStorefrontAnchor(scene, storefront) : undefined}
                    storefrontLabel={storefrontRole === 'sign' ? storefront?.label : undefined}
                    storefrontGeometry={storefrontRole === 'sign' && storefront ? geometrySnapshot.storefronts.get(storefront.id) : undefined}
                    storefrontPresentationPhase={storefrontPresentationPhase}
                    onStorefrontPresentationMotionComplete={(phase) => {
                      if (!storefront) return
                      if (phase === 'revealing') onStorefrontRevealMotionComplete?.(storefront.id)
                      else if (phase === 'lingering') onStorefrontLingerAnimationComplete?.(storefront.id)
                      else onStorefrontRestoreMotionComplete?.(storefront.id)
                    }}
                    passagePhase={storefrontPhase}
                    frameRetracting={sceneFrameExit.phase === 'retracting' && sceneFrameExit.passageEntityId === storefrontPassageEntityId}
                    active={activeObjectId === storefront?.id && Boolean(commercialStreetStorefrontInteractionFor(storefront.id))}
                  />
                }
                if (cell.kind === 'feature' && entityId) {
                  const entity = scene.objects.find((candidate) => candidate.id === entityId)
                  if (entity) {
                    return <Fragment key={`feature-${focusTarget.group}`}>
                      <MainlineFocusGroup key={`focus-${focusTarget.group}`} entries={focusEntries} className="scene-mainline-wall scene-mainline-wall-feature scene-mainline-wall-feature--interaction scene-mainline-exploration--steady" visibilityClass={groupVisibilityClass} renderFrame={focusFrames.renderFrame} onInteract={onInteract} interactionEntityId={entityId} ariaLabel={`${entity.label}，点击让主角前往互动`} active={isCurrentInteractionSource(entityId)} explored={exploredObjectIds.has(entityId)} />
                    </Fragment>
                  }
                }
              }
              if (cell.kind === 'storefront') {
                const storefrontState = unit.variant === 'near' ? 'near' : 'baseline'
                const storefrontStateClass = `is-${storefrontState}`
                const storefrontRole = cell.storefrontRole ?? 'wall'
                const storefrontClass = `scene-spatial-glyph scene-mainline-storefront-cell scene-mainline-wall scene-mainline-storefront scene-mainline-storefront--${cell.storefrontStyle ?? 'modern'} scene-mainline-storefront--${storefrontRole} scene-mainline-storefront--${cell.orientation ?? 'horizontal'} ${storefrontRole === 'door' ? 'scene-spatial-glyph--door' : ''} ${storefrontStateClass}`
                const storefront = cell.storefrontId ? scene.storefronts.find((candidate) => candidate.id === cell.storefrontId) : undefined
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
                  return <MainlineDoorButton key={cell.id} cell={cell} entityId={entityId} className={storefrontClass} style={{ left: `${cell.x}%`, top: `${cell.y}%` }} doorLabel={doorLabel} glyph={cell.glyph ?? '门'} doorPhase={doorPhase} focusGroup={passageFocusGroup} focusPolicy="passage" gateTriggered={gateTriggered} frameRetracting={sceneFrameExit.passageEntityId === entityId} active={activeObjectId === entityId} closeHint={closeHint} ariaLabel={`${doorLabel}，点击门后目标会在接近时自动开门并穿过`} renderFocusFrame={focusFrames.renderFrame} onInteract={onInteract} onDoorTransitionComplete={onDoorTransitionComplete} dataAttributes={{ 'data-storefront-cell-id': cell.id, 'data-storefront-state': storefrontState }} />
                }
                const storefrontPhase = storefrontPassageEntityId ? doorPhases.get(storefrontPassageEntityId) ?? 'closed' : 'closed'
                return <span key={cell.id} className={storefrontClass} style={{ left: `${cell.x}%`, top: `${cell.y}%` }} data-storefront-cell-id={cell.id} data-storefront-state={storefrontState} data-focus-target-id={focusGroup ? cell.id : undefined} data-focus-target-group={focusGroup} data-focus-target-policy={focusGroup ? 'passage' : undefined} data-focus-passage-phase={focusGroup ? storefrontPhase : undefined} data-focus-passage-retracting={focusGroup && storefrontPassageEntityId && sceneFrameExit.phase === 'retracting' && sceneFrameExit.passageEntityId === storefrontPassageEntityId ? 'true' : undefined} aria-hidden="true">{cell.glyph}{focusGroup && focusFrames.renderFrame(focusGroup)}</span>
              }
              if (cell.kind === 'door' && entityId) {
                const doorLabel = cell.displayLabel ?? cell.label ?? '门'
                const doorPhase = doorPhases.get(entityId) ?? 'closed'
                const closeHint = cell.access === 'locked' ? (cell.lockedText ?? '当前权限不足') : '接近时自动开门，进入门洞后继续路线'
                const yardGatePart = cell.doorLabelPart
                const focusGroup = yardGatePart ? `gate:${entityId}:${yardGatePart}` : `door:${entityId}`
                const focusPolicy = yardGatePart ? 'gate' : 'passage' as const
                return <MainlineDoorButton key={cell.id} cell={cell} entityId={entityId} className={`scene-spatial-glyph scene-mainline-wall scene-mainline-wall-door ${visibilityClass}`} style={{ left: `${cell.x}%`, top: `${cell.y}%` }} doorLabel={doorLabel} glyph={cell.doorLabelPart ?? doorLabel} doorPhase={doorPhase} focusGroup={focusGroup} focusPolicy={focusPolicy} gateTriggered={gateTriggered} frameRetracting={sceneFrameExit.phase === 'retracting' && sceneFrameExit.passageEntityId === entityId} active={activeObjectId === entityId} closeHint={closeHint} ariaLabel={`${doorLabel}，点击门后目标会在接近时自动开门并穿过`} renderFocusFrame={focusFrames.renderFrame} onInteract={onInteract} onDoorTransitionComplete={onDoorTransitionComplete} />
              }
              if (cell.kind === 'opening') {
                return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall scene-mainline-wall-opening ${visibilityClass}`} style={{ left: `${cell.x}%`, top: `${cell.y}%` }} aria-hidden="true">{cell.label ?? cell.glyph}</span>
              }
              if (cell.kind === 'feature' && entityId) {
                const entity = scene.objects.find((candidate) => candidate.id === entityId)
                const directWallFeature = entity?.interactionBehavior === 'direct-wall'
                if (entity && (entity.interactive !== false || directWallFeature)) {
                  const focusGroup = `interactive:${cell.featureId ?? entityId}`
                  const featureVisualState = resolveMainlineInteractionVisualState({
                    active: isCurrentInteractionSource(entityId),
                    explored: exploredObjectIds.has(entityId),
                    tutorialCompleted: true,
                    tutorialEligible: false,
                  })
                  return <button key={cell.id} className={`scene-spatial-glyph scene-spatial-glyph--feature scene-mainline-wall scene-mainline-wall-feature ${visibilityClass} scene-mainline-interaction--${featureVisualState}`} type="button" style={{ left: `${cell.x}%`, top: `${cell.y}%` }} onClick={(event) => { event.stopPropagation(); onInteract(entityId) }} aria-label={`${entity.label}，点击让主角前往互动`} data-focus-target-id={cell.id} data-focus-target-group={focusGroup} data-focus-target-policy="interactive" data-focus-interaction-busy={activeObjectId === entityId && moving ? 'true' : undefined}>
                    {cell.glyph}
                    {focusFrames.renderFrame(focusGroup)}
                  </button>
                }
              }
              if (cell.kind === 'feature') {
                return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall scene-mainline-wall-feature ${visibilityClass}`} style={{ left: `${cell.x}%`, top: `${cell.y}%` }} aria-hidden="true">{cell.glyph}</span>
              }
              return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall ${visibilityClass}`} style={{ left: `${cell.x}%`, top: `${cell.y}%` }} aria-hidden="true">{cell.glyph ?? '墙'}</span>
            })}
          </div>

          {scene.objects.filter((entity) => entity.visible !== false && entity.kind !== 'door' && !wallFeatureEntityIds.has(entity.id)).map((entity) => {
            const entityPosition = geometrySnapshot.objects.get(entity.id)?.position ?? entity.position
            const focusGroup = !layoutMode && entity.focusFrame === 'interactive' ? `interactive:${entity.id}` : undefined
            const underPlayer = entity.visualProfile === 'tree-ring' && entity.interactive === false && Math.hypot(position.x - entityPosition.x, position.y - entityPosition.y) <= 2.8
            return <MemoMainlineObject
              key={entity.id}
              entity={entity}
              scene={scene}
              position={entityPosition}
              collision={geometrySnapshot.objects.get(entity.id)?.collision ?? undefined}
              visualBounds={geometrySnapshot.objects.get(entity.id)?.visualBounds}
              focusGroup={focusGroup}
              renderFrame={focusFrames.renderFrame}
              visibility={objectVisibility(entity, layoutMode)}
              active={isCurrentInteractionSource(entity.id)}
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
              sharedBreathingClock={isAltarEntity(scene, entity.id)}
              registerBreathingNode={registerBreathingNode}
              suppressLabel={isMainlineSeatLabelSuppressed(entity, occupiedSeatIds)}
              prompted={isMainlineSeatPrompted(entity, promptedSeatId, playerSeatId)}
              debugRuntimeEvidence={debugRuntimeEvidence}
            />
          })}

          {scene.npcs.map((npc) => {
            if (scene.ambientNpcRoutes.some((schedule) => schedule.npcId === npc.id)) return null
            if (hiddenNpcIds?.has(npc.id)) return null
            const npcPosition = npcPositions?.get(npc.id) ?? resolveMainlineNpcPosition(scene, npc.id, layout, { geometrySnapshot, screenMetrics: renderScreenMetrics })
            const npcSnapshot = npcRuntimeSnapshots?.get(npc.id)
            const npcSeatId = mainlineNpcStagedSeatId(scene, npc.id)
            return <MemoMainlineNpcActor
              key={npc.id}
              npc={npc}
              position={npcPosition}
              snapshot={npcSnapshot}
              seatId={npcSeatId}
              seatPosition={npcSeatId ? geometrySnapshot.objects.get(npcSeatId)?.position : undefined}
              screenMetrics={renderScreenMetrics}
              interactive={npc.interactive !== false}
              debugRuntimeEvidence={debugRuntimeEvidence}
              onInteract={onNpcInteract}
            />
          })}

          {ambientNpcActorLayer}

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
          {showProtagonist && <div className={`scene-protagonist ${moving ? 'is-moving' : ''}`} style={{ left: `${protagonistVisualPosition.x}%`, top: `${protagonistVisualPosition.y}%`, '--scene-mainline-object-font-size': `${mainlineEntityFontSizePx(null, renderScreenMetrics)}px` } as CSSProperties} data-actor-id="protagonist" data-runtime-x={debugRuntimeEvidence ? position.x : undefined} data-runtime-y={debugRuntimeEvidence ? position.y : undefined} data-rendered-x={debugRuntimeEvidence ? protagonistVisualPosition.x : undefined} data-rendered-y={debugRuntimeEvidence ? protagonistVisualPosition.y : undefined} data-seat-entity-id={playerSeatId ?? undefined}>
            {protagonistPresentation.kind === 'dot'
              ? <span className="scene-protagonist__dot" aria-label="修杰所在位置" />
              : <span className="scene-protagonist__seat-label" aria-label="修杰，已坐下">{protagonistPresentation.label}</span>}
            {carriedMilkTea && !playerSeatId && <button type="button" className="scene-protagonist__drink-icon scene-protagonist__drink-icon--milk-tea" aria-label="修杰带着奶茶，点击饮用" onClick={(event) => { event.stopPropagation(); onMilkTeaInteract?.() }} />}
          </div>}
          {worldQuestionMark?.visible && <span
            className="scene-commercial-question-mark"
            style={{ left: `${worldQuestionMark.anchor.x}%`, top: `${worldQuestionMark.anchor.y}%` }}
            data-commercial-question-mark="true"
            data-world-anchor-x={worldQuestionMark.anchor.x}
            data-world-anchor-y={worldQuestionMark.anchor.y}
            aria-hidden="true"
          >?</span>}
          </>
        </div>
        <div className="scene-mainline-reading-layer">
          {(sceneEcho || (dialogue && dialogueLine && dialoguePosition)) && (() => {
            const isDialogue = !sceneEcho && Boolean(dialogue && dialogueLine && dialoguePosition)
            const isLeaving = sceneEcho?.phase === 'leaving' || (isDialogue && dialoguePhase === 'leaving')
            const text = sceneEcho?.text ?? dialogueText ?? dialogueLine?.text ?? ''
            const position = sceneEcho?.position ?? dialoguePosition!
            const group = sceneEcho ? `echo:${sceneEcho.id}` : `dialogue:${dialogueLine!.id}`
            const hasNextSegment = sceneEcho
              ? sceneEcho.segmentIndex + 1 < sceneEcho.segments.length
              : dialogueSegmentIndex + 1 < dialogueSegmentCount || Boolean(dialogue && dialogueLineIndex! + 1 < dialogue.lines.length)
            const echoLayout = mainlineEchoLayout(text, renderScreenMetrics, {
              speaker: isDialogue ? dialogueLine!.speaker : undefined,
            })
            if (isDialogue) {
              const session = `${scene.id}:${dialogue!.triggerEntityId}`
              const metrics = `${renderScreenMetrics.width}:${renderScreenMetrics.height}:${renderScreenMetrics.viewportWidth}`
              if (speakerPlacementRef.current?.session !== session || speakerPlacementRef.current.metrics !== metrics) {
                speakerPlacementRef.current = { session, metrics, anchor: mainlineSpeakerAnchor(dialogue!.lines, renderScreenMetrics, position, cameraOffset) }
              }
            }
            const speakerAnchor = isDialogue ? speakerPlacementRef.current!.anchor : null
            return <Fragment>
            {isDialogue && speakerAnchor && <div
              key={`speaker:${scene.id}:${dialogue!.triggerEntityId}`}
              className={`scene-mainline-speaker-anchor ${isLeaving ? 'is-leaving' : ''}`}
              aria-live="polite"
              style={{ left: `${speakerAnchor.left}%`, top: `${speakerAnchor.top}%`, width: `${speakerAnchor.widthPx}px`, minHeight: `${echoLayout.heightPx}px` }}
            ><DialogueSpeaker speaker={dialogueLine!.speaker} /></div>}
            <div
              key={sceneEcho?.id ?? dialogueLine!.id}
              className={`scene-mainline-text scene-mainline-text--${isDialogue ? 'dialogue' : 'observation'} ${isLeaving ? 'is-leaving' : ''}`}
              style={{
                left: `${speakerAnchor ? speakerAnchor.left + (speakerAnchor.widthPx / renderScreenMetrics.width) * 50 : Math.max((echoLayout.widthPx / renderScreenMetrics.width) * 50 + 2, Math.min(98 - (echoLayout.widthPx / renderScreenMetrics.width) * 50, position.x + cameraOffset.x))}%`,
                top: `${speakerAnchor?.top ?? Math.max(10, Math.min(85, position.y + cameraOffset.y))}%`,
                '--scene-mainline-text-width': `${echoLayout.widthPx}px`,
                '--scene-mainline-text-height': `${echoLayout.heightPx}px`,
              } as CSSProperties}
              aria-live="polite"
              data-scene-interaction-text={sceneEcho?.entityId ?? dialogue?.triggerEntityId ?? 'scene'}
              data-scene-echo={sceneEcho ? sceneEcho.entityId ?? 'scene' : undefined}
              data-scene-observation-typing={sceneEcho ? String(sceneEcho.typing) : undefined}
              data-scene-dialogue={isDialogue ? dialogue?.triggerEntityId : undefined}
              data-dialogue-line-id={isDialogue ? dialogueLine?.id : undefined}
              data-dialogue-speaker={isDialogue ? dialogueLine?.speaker : undefined}
              data-scene-segment-index={sceneEcho?.segmentIndex ?? dialogueSegmentIndex}
              data-scene-segment-count={sceneEcho?.segments.length ?? dialogueSegmentCount}
              data-scene-segment-advance={hasNextSegment ? 'available' : 'complete'}
              data-scene-dialogue-ready={isDialogue ? String(dialogueReady) : undefined}
              onAnimationEnd={(event) => {
                if (!isLeaving || event.target !== event.currentTarget) return
                if (sceneEcho) onSceneEchoExitComplete?.(sceneEcho.id)
                else onDialogueExitComplete?.()
              }}
            >
              {isDialogue && <span className="scene-mainline-text__speaker scene-mainline-text__speaker-space" aria-hidden="true">&nbsp;</span>}
              {isDialogue
                ? <DialogueText group={`${group}:${dialogueSegmentIndex}`} text={text} onReadyChange={updateDialogueReady} />
                : <ObservationText echoId={sceneEcho!.id} text={text} typing={sceneEcho!.typing} onTypingComplete={onSceneEchoTypingComplete} />}
            </div>
            </Fragment>
          })()}
          {sceneAction && <div
            className="scene-mainline-action"
            style={{ left: `${Math.max(12, Math.min(88, sceneAction.position.x + cameraOffset.x))}%`, top: `${Math.max(10, Math.min(85, sceneAction.position.y + cameraOffset.y))}%` }}
            data-scene-action={sceneAction.entityId ?? 'scene'}
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
          {readingMode && <>
            <div className={`scene-dialogue-dimmer scene-dialogue-dimmer--${readingMode}`} aria-hidden="true" />
            <button
              type="button"
              className="scene-dialogue-shield"
              aria-label="继续阅读"
              data-scene-dialogue-shield="true"
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                if (readingMode === 'dialogue') {
                  if (currentDialogueGroupRef.current !== null
                    && dialogueAdvanceConsumedGroupRef.current !== currentDialogueGroupRef.current
                    && dialogueReadyGroupRef.current === currentDialogueGroupRef.current) {
                    dialogueAdvanceConsumedGroupRef.current = currentDialogueGroupRef.current
                    dialogueReadyGroupRef.current = null
                    setDialogueReady(false)
                    onDialogueAdvance?.()
                  }
                  return
                }
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
