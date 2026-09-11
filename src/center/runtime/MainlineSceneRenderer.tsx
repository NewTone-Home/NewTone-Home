'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Point } from './sceneGeometry'
import { mainlineSceneGeometryUnits, type MainlineSceneDefinition, type MainlineSceneDialogue, type MainlineSceneDialogueLine, type MainlineSceneEntity, type MainlineSceneGeometryUnit } from './mainlineScenes'
import { clampMainlineLayoutAnchor, mainlineEntityInteractionBounds, mainlineEntityPosition, mainlineLayoutAnchor, mainlineLayoutItemForEntity, snapDelta, snapPoint, type LayoutItemId, type SceneLayout } from './sceneLayout'
import { SceneDoor, type SceneDoorTransitionCompletion } from './SceneDoor'
import { sceneDoorIsVisuallyOpen, type SceneDoorRuntimePhase } from './sceneDoorConfig'
import { readSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { useSceneFocusFrameController } from './SceneFocusFrames'
import type { SceneFrameTarget } from './sceneFrameLifecycle'

type MainlineSceneRendererProps = {
  scene: MainlineSceneDefinition
  position: Point
  moving: boolean
  destination: Point | null
  layoutMode: boolean
  layout: SceneLayout
  activeObjectId: string | null
  doorPhases?: ReadonlyMap<string, SceneDoorRuntimePhase>
  sceneFrameExit?: { phase: 'idle' | 'retracting'; passageEntityId?: string; scope?: 'passage' | 'scene' }
  gateTriggered?: boolean
  screenMetrics: SceneScreenMetrics
  onScreenMetricsChange?: (metrics: SceneScreenMetrics) => void
  cameraOffset: Point
  showProtagonist?: boolean
  onLayoutChange: (itemId: LayoutItemId, point: Point) => void
  onInteract: (id: string) => void
  onDoorTransitionComplete?: (entityId: string, completion: SceneDoorTransitionCompletion) => void
  onWalk: (point: Point) => void
  dialogue?: MainlineSceneDialogue
  dialogueLine?: MainlineSceneDialogueLine | null
  dialogueLineIndex?: number | null
  dialoguePosition?: Point | null
  onDialogueAdvance?: () => void
  sceneEcho?: { id: number; entityId?: string; text: string; position: Point; options?: readonly string[]; phase?: 'leaving' } | null
  onSceneEchoChoice?: (index: number) => void
  onSceneEchoExitComplete?: () => void
  exploredObjectIds?: ReadonlySet<string>
  debugInput?: boolean
  debugFeedback?: string | null
  inputDiagnostic?: MainlineInputDiagnostic | null
  onInputDiagnostic?: (diagnostic: MainlineInputDiagnostic) => void
  incenseLit?: boolean
  incenseBurnRemainingMs?: number
  onIncenseBurnComplete?: () => void
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

function objectClass(entity: MainlineSceneEntity, visibility: string, active: boolean, explored: boolean, underPlayer: boolean, selected: boolean, dragging: boolean, incenseLit: boolean) {
  const isOfferingTable = entity.id.startsWith('jijia-offering-table-')
  const isOfficeExploration = [
    'zhongshuyuan-office-desk',
    'zhongshuyuan-office-chair',
    'zhongshuyuan-office-plant',
    'zhongshuyuan-office-rack',
  ].includes(entity.id)
  const isBreathing = entity.id === 'jijia-old-tree' || entity.id === 'jijia-incense-burner' || isOfferingTable || isOfficeExploration
  return [
    'scene-object',
    'scene-mainline-object',
    `scene-mainline-object--${entity.kind}`,
    entity.facing ? `scene-mainline-object--facing-${entity.facing}` : '',
    `scene-object--${entity.weight}`,
    entity.id === 'jijia-old-tree' || entity.id.startsWith('jijia-old-tree-stone-') ? 'scene-mainline-yard-tree-ring' : '',
    isBreathing ? 'scene-mainline-exploration--breathing' : '',
    explored && isBreathing ? 'scene-mainline-exploration--explored' : '',
    entity.kind === 'table' ? 'scene-mainline-exploration--steady' : '',
    isOfferingTable ? 'scene-mainline-altar-table' : '',
    entity.id === 'jijia-incense-burner' && incenseLit ? 'scene-mainline-incense--lit' : '',
    entity.id === 'jijia-incense-burner' && incenseLit ? 'scene-mainline-incense--burning' : '',
    entity.id === 'jijia-incense-burner' && !incenseLit ? 'scene-mainline-incense--unlit' : '',
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

function MainlineDoorButton({ cell, entityId, className, style, doorLabel, glyph, doorPhase, focusGroup, focusPolicy, gateTriggered, frameRetracting, active, closeHint, ariaLabel, renderFocusFrame, onInteract, onDoorTransitionComplete, dataAttributes }: MainlineDoorButtonProps) {
  const visualOpen = sceneDoorIsVisuallyOpen(cell.doorBehavior, doorPhase)
  return (
    <button
      className={`${className} ${visualOpen ? 'is-open' : ''} ${active ? 'is-active' : ''}`}
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
  if (cell.kind === 'storefront' && cell.storefrontRole === 'sign' && variant !== 'near') {
    return { group: storefrontFocusGroup(cell, variant), policy: 'passage' as const }
  }
  if (cell.kind === 'storefront' && cell.storefrontRole === 'door' && entityId) {
    return { group: storefrontDoorFocusGroup(cell, variant), policy: 'passage' as const }
  }
  if (cell.kind === 'door' && entityId) {
    const gatePart = entityId === 'jijia-yard-gate' ? cell.doorLabelPart : undefined
    return gatePart
      ? { group: `gate:${entityId}:${gatePart}`, policy: 'gate' as const }
      : { group: `door:${entityId}`, policy: 'passage' as const }
  }
  if (cell.kind !== 'feature' || !entityId) return undefined
  const entity = scene.objects.find((candidate) => candidate.id === entityId)
  const portraitFeature = Boolean(cell.featureId?.includes('portrait'))
  if (!entity || (entity.interactive === false && !portraitFeature)) return undefined
  return { group: `interactive:${cell.featureId ?? entityId}`, policy: 'interactive' as const }
}

function mainlineWallCellVisibility(cell: MainlineGeometryCellEntry['cell'], unit: MainlineSceneGeometryUnit) {
  if (cell.kind === 'wall') return 'is-baseline'
  if (cell.kind === 'storefront') return unit.variant === 'near' ? 'is-near' : 'is-baseline'
  return (cell.baselineVisible ?? cell.baseline ?? true) ? 'is-baseline' : 'is-hidden'
}

function mainlineRenderableGeometryUnits(scene: MainlineSceneDefinition, position: Point, screenMetrics: SceneScreenMetrics) {
  // The compiled storefront variant is already the single visual source of
  // truth. Far away it contains the café sign; near the entrance it contains
  // the glass-wall-door-wall-glass cells, including the real door button.
  // Replacing the near variant with baseline geometry would remove that door
  // from the rendered tree while navigation still expected the same passage.
  return mainlineSceneGeometryUnits(scene, position, screenMetrics)
}

function MainlineFocusGroup({ entries, className, visibilityClass, renderFrame, onInteract, interactionEntityId, ariaLabel, passagePhase, gateTriggered, frameRetracting = false, hideGlyphs = false }: {
  entries: readonly MainlineGeometryCellEntry[]
  className: string
  visibilityClass: string
  renderFrame: (group: string) => ReactNode
  onInteract?: (id: string) => void
  interactionEntityId?: string
  ariaLabel?: string
  passagePhase?: string
  gateTriggered?: boolean
  frameRetracting?: boolean
  hideGlyphs?: boolean
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
  const glyphs = entries.map(({ cell }) => cell.glyph ?? '')
  const content = hideGlyphs ? null : glyphs.map((glyph, index) => {
    const cell = entries[index]?.cell
    if (!cell) return null
    const offset = vertical
      ? ((cell.y - centerY) / Math.max(.001, span)) * 100 + 50
      : ((cell.x - centerX) / Math.max(.001, span)) * 100 + 50
    return <span key={entries[index]?.cell.id} className="scene-mainline-focus-group__glyph" style={{ left: vertical ? '50%' : `${offset}%`, top: vertical ? `${offset}%` : '50%' }} aria-hidden="true">{glyph}</span>
  })
  const commonProps = {
    className: `scene-mainline-focus-group ${className} ${visibilityClass}`,
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
  return <span {...commonProps} aria-hidden="true">{content}{renderFrame(first.focusGroup)}</span>
}

function MainlineObject({ entity, scene, position, visibility, active, explored, underPlayer, layoutMode, selected, dragging, layout, screenMetrics, incenseLit, incenseBurnRemainingMs, onIncenseBurnComplete, onStartLayoutDrag, onSelectLayoutItem, onInteract, renderFrame, breathingAnimationDelay }: {
  entity: MainlineSceneEntity
  scene: MainlineSceneDefinition
  position: Point
  visibility: string
  active: boolean
  explored: boolean
  underPlayer: boolean
  layoutMode: boolean
  selected: boolean
  dragging: boolean
  layout: SceneLayout
  screenMetrics: SceneScreenMetrics
  incenseLit: boolean
  incenseBurnRemainingMs: number
  onIncenseBurnComplete?: () => void
  onStartLayoutDrag: (itemId: LayoutItemId, event: React.PointerEvent<HTMLElement>) => void
  onSelectLayoutItem: (itemId: LayoutItemId) => void
  onInteract: (id: string) => void
  renderFrame: (group: string) => ReactNode
  breathingAnimationDelay?: string
}) {
  const layoutItemId = mainlineLayoutItemForEntity(scene, entity.id)
  const className = objectClass(entity, visibility, active, explored, underPlayer, selected, dragging, incenseLit)
  const interactionBounds = mainlineEntityInteractionBounds(scene, entity, layout, screenMetrics)
  const visualScale = entity.visualScale ?? 1
  const focusGroup = `exploration:${entity.id}`
  const commonProps = {
    className: `${className} ${layoutItemId ? 'scene-object--layout-draggable' : ''}`,
    style: {
      left: `${position.x}%`,
      top: `${position.y}%`,
      boxSizing: 'border-box',
      width: interactionBounds ? `${interactionBounds.width}%` : undefined,
      height: interactionBounds ? `${interactionBounds.height}%` : undefined,
      '--incense-burn-remaining': `${incenseBurnRemainingMs}ms`,
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: 'translate(-50%, -50%)',
    } as CSSProperties,
    'data-object-id': entity.id,
    'data-layout-item-id': layoutItemId ?? undefined,
    'data-focus-target-id': !layoutMode && entity.interactive !== false ? entity.id : undefined,
    'data-focus-target-group': !layoutMode && entity.interactive !== false ? focusGroup : undefined,
    'data-focus-target-policy': !layoutMode && entity.interactive !== false ? 'exploration' : undefined,
    'data-focus-interaction-active': !layoutMode && entity.interactive !== false && active ? 'true' : undefined,
  }
  const labelStyle = {
    ...(visualScale === 1 ? {} : { display: 'inline-block', transform: `scale(${visualScale})` }),
    ...(breathingAnimationDelay ? { '--scene-exploration-animation-delay': breathingAnimationDelay } : {}),
  } as CSSProperties

  if (entity.interactive === false) {
    return <span {...commonProps} aria-hidden="true"><span style={labelStyle}>{entity.label}</span></span>
  }

  return (
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
      <span style={labelStyle}>{entity.label}</span>
      {renderFrame(focusGroup)}
    </button>
  )
}

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
  onScreenMetricsChange,
  cameraOffset,
  gateTriggered = false,
  showProtagonist = true,
  onLayoutChange,
  onInteract,
  onDoorTransitionComplete,
  onWalk,
  dialogue,
  dialogueLine = null,
  dialogueLineIndex = null,
  dialoguePosition = null,
  onDialogueAdvance,
  sceneEcho = null,
  onSceneEchoChoice,
  onSceneEchoExitComplete,
  exploredObjectIds = new Set(),
  screenMetrics,
  debugInput = false,
  debugFeedback = null,
  inputDiagnostic = null,
  onInputDiagnostic,
  incenseLit = false,
  incenseBurnRemainingMs = 0,
  onIncenseBurnComplete,
}: MainlineSceneRendererProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const synchronizedBreathingDelay = useMemo(() => {
    if (scene.id !== 'zhongshuyuan-office') return undefined
    const now = typeof performance === 'undefined' ? 0 : performance.now()
    return `${-(now % 2800)}ms`
  }, [scene.id])
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
  const renderScreenMetrics = screenMetrics
  const geometryUnits = useMemo(() => mainlineRenderableGeometryUnits(scene, position, renderScreenMetrics), [position, renderScreenMetrics, scene])
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
      entries.push({ unit, cell, entityId, focusGroup: target.group, focusPolicy: target.policy })
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
      const storefrontPassageEntityId = storefront?.portalId
        ? scene.passages.find((passage) => passage.portalId === storefront.portalId)?.entityId
        : undefined
      const passageEntityId = storefrontPassageEntityId ?? entityId
      const retractRequested = sceneFrameExit.phase === 'retracting' && (
        sceneFrameExit.scope === 'scene'
        || (target.policy === 'passage' && sceneFrameExit.passageEntityId === passageEntityId)
      )
      addTarget({
        group: target.group,
        policy: target.policy,
        phase: target.policy === 'passage' ? doorPhases.get(passageEntityId ?? '') ?? 'closed' : 'closed',
        gateTriggered: target.policy === 'gate' && gateTriggered,
        interactionBusy: target.policy === 'interactive' && activeObjectId === entityId && moving,
        interactionActive: target.policy === 'interactive' && (activeObjectId === entityId || sceneEcho?.entityId === entityId),
        retractRequested,
        suppressed: target.policy === 'interactive' && (exploredObjectIds.has(entityId ?? '') || sceneEcho?.entityId === entityId),
      })
    })
    scene.objects.forEach((entity) => {
      if (entity.visible === false || entity.kind === 'door' || wallFeatureEntityIds.has(entity.id) || entity.interactive === false) return
      addTarget({
        group: `exploration:${entity.id}`,
        policy: 'exploration',
        phase: 'closed',
        gateTriggered: false,
        interactionBusy: activeObjectId === entity.id && moving,
        interactionActive: activeObjectId === entity.id || sceneEcho?.entityId === entity.id,
        retractRequested: false,
        suppressed: exploredObjectIds.has(entity.id) || sceneEcho?.entityId === entity.id,
      })
    })
    if (dialogue && dialogueLine && dialogueLineIndex !== null && dialoguePosition) {
      addTarget({
        group: `dialogue:${dialogueLine.id}`,
        policy: 'exploration',
        phase: 'closed',
        gateTriggered: false,
        interactionBusy: false,
        interactionActive: true,
        retractRequested: false,
        suppressed: false,
      })
    }
    if (sceneEcho) {
      addTarget({
        group: `echo:${sceneEcho.id}`,
        policy: 'exploration',
        phase: 'closed',
        gateTriggered: false,
        interactionBusy: false,
        interactionActive: true,
        retractRequested: false,
        suppressed: false,
      })
    }
    return [...targetMap.values()]
  }, [activeObjectId, dialogue, dialogueLine, dialogueLineIndex, dialoguePosition, doorPhases, exploredObjectIds, gateTriggered, geometryCells, layoutMode, moving, scene, sceneEcho, sceneFrameExit, wallFeatureEntityIds])
  const focusFrames = useSceneFocusFrameController({
    targets: focusFrameTargets,
  })
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
    if (target?.closest('button, a, input, textarea, select, [role="button"], [data-focus-target-id]')) return
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
      <div ref={stageRef} className={`scene-stage mainline-scene-stage ${layoutMode ? 'is-layout-editing' : ''}`} onClick={walkToEmptySpace} onPointerUp={walkFromTouch} onPointerDownCapture={focusFrames.onPointerDownCapture} onPointerOverCapture={focusFrames.onPointerOverCapture} onPointerOutCapture={focusFrames.onPointerOutCapture} onClickCapture={focusFrames.onClickCapture} data-layout-mode={layoutMode ? 'edit' : 'play'} data-mainline-scene={scene.id}>
        {layoutMode && <div className="scene-layout-grid" aria-hidden="true" />}

        <div className="scene-mainline-world" style={{ transform: `translate(${cameraOffset.x}%, ${cameraOffset.y}%)` }}>
          <>
          <div className="scene-spatial-labels scene-spatial-labels--wall scene-mainline-wall-labels">
            {geometryCells.map(({ unit, cell }) => {
              if (cell.glyph === '') return null
              const visibilityClass = mainlineWallCellVisibility(cell, unit)
              const entityId = cell.entityId ?? unit.entityId
              const focusTarget = mainlineCellFocusTarget(scene, cell, entityId, unit.variant)
              const focusEntries = focusTarget ? focusGroupCells.get(focusTarget.group) : undefined
              if (focusTarget && focusEntries && focusEntries.length > 1) {
                if (focusEntries[0]?.cell.id !== cell.id) return null
                const groupVisibilityClass = focusEntries.some((entry) => mainlineWallCellVisibility(entry.cell, entry.unit) === 'is-near')
                  ? 'is-near'
                  : focusEntries.some((entry) => mainlineWallCellVisibility(entry.cell, entry.unit) === 'is-baseline')
                  ? 'is-baseline'
                  : 'is-hidden'
                const firstEntry = focusEntries[0]
                if (cell.kind === 'storefront') {
                  const storefront = cell.storefrontId ? scene.storefronts.find((candidate) => candidate.id === cell.storefrontId) : undefined
                  const storefrontState = firstEntry.unit.variant === 'near' ? 'near' : 'baseline'
                  const storefrontRole = cell.storefrontRole ?? 'sign'
                  const storefrontPassageEntityId = storefront?.portalId
                    ? scene.passages.find((passage) => passage.portalId === storefront.portalId)?.entityId
                    : undefined
                  const storefrontPhase = storefrontPassageEntityId ? doorPhases.get(storefrontPassageEntityId) ?? 'closed' : 'closed'
                  const groupClass = `scene-mainline-storefront scene-mainline-storefront--${cell.storefrontStyle ?? 'modern'} scene-mainline-storefront--${storefrontRole} scene-mainline-storefront--${cell.orientation ?? 'horizontal'} is-${storefrontState}`
                  return <MainlineFocusGroup key={`focus-${focusTarget.group}`} entries={focusEntries} className={groupClass} visibilityClass={groupVisibilityClass} renderFrame={focusFrames.renderFrame} passagePhase={storefrontPhase} frameRetracting={sceneFrameExit.phase === 'retracting' && sceneFrameExit.passageEntityId === storefrontPassageEntityId} />
                }
                if (cell.kind === 'feature' && entityId) {
                  const entity = scene.objects.find((candidate) => candidate.id === entityId)
                  if (entity) {
                    return <Fragment key={`feature-${focusTarget.group}`}>
                      <MainlineFocusGroup key={`focus-${focusTarget.group}`} entries={focusEntries} className={`scene-mainline-wall scene-mainline-wall-feature scene-mainline-wall-feature--interaction scene-mainline-exploration--steady ${activeObjectId === entityId || sceneEcho?.entityId === entityId ? 'is-active' : ''}`} visibilityClass={groupVisibilityClass} renderFrame={focusFrames.renderFrame} onInteract={onInteract} interactionEntityId={entityId} ariaLabel={`${entity.label}，点击让主角前往互动`} />
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
                const yardGatePart = entityId === 'jijia-yard-gate' ? cell.doorLabelPart : undefined
                const focusGroup = yardGatePart ? `gate:${entityId}:${yardGatePart}` : `door:${entityId}`
                const focusPolicy = yardGatePart ? 'gate' : 'passage' as const
                return <MainlineDoorButton key={cell.id} cell={cell} entityId={entityId} className={`scene-spatial-glyph scene-mainline-wall scene-mainline-wall-door ${visibilityClass}`} style={{ left: `${cell.x}%`, top: `${cell.y}%` }} doorLabel={doorLabel} glyph={cell.doorLabelPart ?? doorLabel} doorPhase={doorPhase} focusGroup={focusGroup} focusPolicy={focusPolicy} gateTriggered={gateTriggered} frameRetracting={sceneFrameExit.phase === 'retracting' && sceneFrameExit.passageEntityId === entityId} active={activeObjectId === entityId} closeHint={closeHint} ariaLabel={`${doorLabel}，点击门后目标会在接近时自动开门并穿过`} renderFocusFrame={focusFrames.renderFrame} onInteract={onInteract} onDoorTransitionComplete={onDoorTransitionComplete} />
              }
              if (cell.kind === 'opening') {
                return <span key={cell.id} className={`scene-spatial-glyph scene-mainline-wall scene-mainline-wall-opening ${visibilityClass}`} style={{ left: `${cell.x}%`, top: `${cell.y}%` }} aria-hidden="true">{cell.label ?? cell.glyph}</span>
              }
              if (cell.kind === 'feature' && entityId) {
                const entity = scene.objects.find((candidate) => candidate.id === entityId)
                const portraitFeature = Boolean(cell.featureId?.includes('portrait'))
                if (entity && (entity.interactive !== false || portraitFeature)) {
                  const focusGroup = `interactive:${cell.featureId ?? entityId}`
                  return <button key={cell.id} className={`scene-spatial-glyph scene-spatial-glyph--feature scene-mainline-wall scene-mainline-wall-feature ${visibilityClass} ${activeObjectId === entityId ? 'is-active' : ''}`} type="button" style={{ left: `${cell.x}%`, top: `${cell.y}%` }} onClick={(event) => { event.stopPropagation(); onInteract(entityId) }} aria-label={`${entity.label}，点击让主角前往互动`} data-focus-target-id={cell.id} data-focus-target-group={focusGroup} data-focus-target-policy="interactive" data-focus-interaction-busy={activeObjectId === entityId && moving ? 'true' : undefined}>
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
            const entityPosition = mainlineEntityPosition(scene, entity, layout, renderScreenMetrics)
            const underPlayer = entity.id.startsWith('jijia-old-tree-stone-') && Math.hypot(position.x - entityPosition.x, position.y - entityPosition.y) <= 2.8
            return <MainlineObject
              key={entity.id}
              entity={entity}
              scene={scene}
              position={entityPosition}
              visibility={objectVisibility(entity, layoutMode)}
              active={activeObjectId === entity.id || sceneEcho?.entityId === entity.id}
              explored={exploredObjectIds.has(entity.id)}
              underPlayer={underPlayer}
              layoutMode={layoutMode}
              layout={layout}
              screenMetrics={renderScreenMetrics}
              incenseLit={incenseLit}
              incenseBurnRemainingMs={incenseBurnRemainingMs}
              onIncenseBurnComplete={onIncenseBurnComplete}
              selected={selectedLayoutItemId === mainlineLayoutItemForEntity(scene, entity.id)}
              dragging={draggingItemId === mainlineLayoutItemForEntity(scene, entity.id)}
              onStartLayoutDrag={startLayoutDrag}
              onSelectLayoutItem={setSelectedLayoutItemId}
              onInteract={onInteract}
              renderFrame={focusFrames.renderFrame}
              breathingAnimationDelay={synchronizedBreathingDelay}
            />
          })}

          {destination && <div className={`scene-walk-target ${moving ? 'is-active' : ''}`} style={{ left: `${destination.x}%`, top: `${destination.y}%` }} aria-hidden="true" />}
          {showProtagonist && <div className={`scene-protagonist ${moving ? 'is-moving' : ''}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} data-actor-id="protagonist">
            <span className="scene-protagonist__dot" aria-label="修杰所在位置" />
          </div>}
          {(sceneEcho || (dialogue && dialogueLine && dialogueLineIndex !== null && dialoguePosition)) && (() => {
            const isDialogue = !sceneEcho && Boolean(dialogue && dialogueLine && dialoguePosition)
            const text = sceneEcho?.text ?? dialogueLine?.text ?? ''
            const position = sceneEcho?.position ?? dialoguePosition!
            const group = sceneEcho ? `echo:${sceneEcho.id}` : `dialogue:${dialogueLine!.id}`
            return <div
              key={sceneEcho?.id ?? dialogueLine!.id}
              className={`scene-mainline-echo ${sceneEcho?.phase === 'leaving' ? 'is-leaving' : ''}`}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              aria-live="polite"
              data-scene-interaction-text={sceneEcho?.entityId ?? dialogue?.triggerEntityId ?? 'scene'}
              data-scene-echo={sceneEcho?.entityId}
              data-scene-dialogue={isDialogue ? dialogue?.triggerEntityId : undefined}
              data-dialogue-line-id={isDialogue ? dialogueLine?.id : undefined}
              data-dialogue-speaker={isDialogue ? dialogueLine?.speaker : undefined}
              data-focus-target-id={isDialogue ? group : undefined}
              data-focus-target-group={isDialogue ? group : undefined}
              data-focus-target-policy={isDialogue ? 'exploration' : undefined}
              data-focus-interaction-active={isDialogue ? 'true' : undefined}
            >
              {isDialogue && <span className="scene-mainline-echo__speaker">{dialogueLine!.speaker}</span>}
              <span
                className="scene-mainline-echo__text"
                onAnimationEnd={(event) => {
                  if (sceneEcho && event.animationName === 'mainline-echo-text-leave') onSceneEchoExitComplete?.()
                }}
              >{text}</span>
              {sceneEcho?.options && sceneEcho.options.length > 0 && <div className="scene-mainline-echo__choices">
                {sceneEcho.options.map((option, index) => (
                  <button key={option} type="button" onClick={(event) => { event.stopPropagation(); onSceneEchoChoice?.(index) }}>
                    {option}
                  </button>
                ))}
              </div>}
              {isDialogue && <button type="button" onClick={(event) => { event.stopPropagation(); onDialogueAdvance?.() }}>
                {dialogueLineIndex! + 1 < dialogue!.lines.length ? '继续' : '结束'}
              </button>}
              {focusFrames.renderFrame(group)}
            </div>
          })()}
          </>
        </div>
        {debugInput && <div className="scene-input-debug" aria-live="polite">
          <div>输入诊断（不改变寻路）</div>
          {!inputDiagnostic && <div>尚未收到空白区域输入</div>}
          {inputDiagnostic && <>
            <div>来源：{inputDiagnostic.source} / pointer：{inputDiagnostic.pointerType} / target：{inputDiagnostic.target}</div>
            <div>client：{inputDiagnostic.client.x.toFixed(1)}, {inputDiagnostic.client.y.toFixed(1)}</div>
            <div>stage：left {inputDiagnostic.rect.left.toFixed(1)} / top {inputDiagnostic.rect.top.toFixed(1)} / {inputDiagnostic.rect.width.toFixed(1)}×{inputDiagnostic.rect.height.toFixed(1)}</div>
            <div>screen：{inputDiagnostic.screenPoint.x.toFixed(2)}%, {inputDiagnostic.screenPoint.y.toFixed(2)}%</div>
            <div>mapped：{inputDiagnostic.mappedPoint.x.toFixed(2)}%, {inputDiagnostic.mappedPoint.y.toFixed(2)}%</div>
          </>}
          {debugFeedback && <div>反馈：{debugFeedback}</div>}
        </div>}
      </div>
    </section>
  )
}
