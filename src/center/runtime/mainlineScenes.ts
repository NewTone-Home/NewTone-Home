import { mainlineWallThickness, type CollisionBox, type Point } from './sceneGeometry'
import { mainlineSceneBlueprints } from './mainlineSceneModel'
import { boundaryGridCellRange, boundaryGridStepsFromScreenSpacing, compileSharedFrame, defaultSceneScreenMetrics, sharedBoundaryScreenSpacingPx, type SceneScreenMetrics, type SharedBoundaryCell, type SharedBoundaryFrame, type SharedBoundaryOpening } from './sceneBoundaryGrid'
import type { SceneDoorBehavior } from './sceneDoorConfig'
import type {
  MainlineFurnitureGroup,
  MainlineSceneBlueprint,
  MainlineSceneEntity,
  MainlineSceneId,
  MainlineScenePassage,
  MainlineAirWall,
  MainlineWallCollision,
  MainlineWallDensity,
  MainlineWallFeature,
  MainlineWallOpening,
  MainlineSceneData,
  MainlineSceneExternalExit,
  MainlineScenePortalBlueprint,
  MainlineSceneCurve,
  MainlineSceneViewport,
  MainlineSceneRoom,
  MainlineSceneDialogue,
  MainlineSceneAttachedProp,
  MainlineSceneNpc,
  MainlineStorefrontRole,
  MainlineStorefrontComposition,
  MainlineStorefrontMode,
  MainlineStorefrontSlot,
  MainlineAltarBlueprint,
} from './mainlineSceneModel'

export type {
  MainlineDoorBehavior,
  MainlineEntityKind,
  MainlineEntitySurface,
  MainlineEntityWeight,
  MainlineFurnitureGroup,
  MainlineSceneBlueprint,
  MainlineSceneEntity,
  MainlineSceneId,
  MainlineScenePassage,
  MainlineAirWall,
  MainlineWallDensity,
  MainlineWallFeature,
  MainlineWallOpening,
  MainlineFacing,
  MainlineStorefrontRole,
  MainlineStorefrontComposition,
  MainlineStorefrontStyle,
  MainlineStorefrontMode,
  MainlineStorefrontSlotBlueprint,
  MainlineStorefrontSlot,
  MainlineAltarBlueprint,
  MainlineSceneData,
  MainlineSceneExternalExit,
  MainlineScenePortalBlueprint,
  MainlineScenePortalEndpointBlueprint,
  MainlineSceneCurve,
  MainlineSceneViewport,
  MainlineSceneRoom,
  MainlineSceneDialogue,
  MainlineSceneDialogueLine,
  MainlineSceneDialogueSpeaker,
  MainlineSceneAttachedProp,
  MainlineSceneNpc,
} from './mainlineSceneModel'

export type MainlineStructure = {
  id: string
  type: 'frame' | 'room' | 'lane' | 'alley' | 'divider' | 'line' | 'connection'
  bounds?: CollisionBox
  start?: Point
  length?: number
  orientation?: 'horizontal' | 'vertical'
  label?: string
  variant?: string
  boundaryGeometrySource?: 'anchor' | 'cell-range'
  boundaryCoordinateCount?: { horizontal?: number; vertical?: number }
  /** Refit fixed boundary coordinates to the measured stage spacing. */
  boundaryProjection?: 'screen-spacing'
  boundaryVisualEndpoints?: {
    horizontal?: { start?: 'omit'; end?: 'omit' }
    vertical?: { start?: 'omit'; end?: 'omit' }
  }
  wallGlyphs?: readonly string[]
  wallGlyph?: '墙'
  openings?: readonly MainlineWallOpening[]
  features?: readonly MainlineWallFeature[]
  wallEdges?: readonly MainlineWallOpening['edge'][]
}

export type MainlineSceneVisualCell = {
  id: string
  x: number
  y: number
  kind: 'wall' | 'door' | 'opening' | 'feature' | 'storefront'
  glyph?: string
  label?: string
  displayLabel?: string
  doorLabelPart?: string
  entityId?: string
  doorBehavior?: SceneDoorBehavior
  access?: MainlineScenePassage['access']
  lockedText?: string
  storefrontId?: string
  storefrontStyle?: MainlineStorefrontSlot['style']
  storefrontRole?: MainlineStorefrontRole
  orientation?: 'horizontal' | 'vertical'
  baseline?: boolean
  baselineVisible?: boolean
  featureId?: string
  featureCellRole?: 'content' | 'flank'
  cellStart?: number
  cellEnd?: number
}

/**
 * One compiled boundary fact owns its rectangle, visible cells and navigation
 * rule. Renderer and navigation must consume this same unit; neither is
 * allowed to reconstruct a second wall geometry from the source blueprint.
 */
export type MainlineSceneGeometryUnit = CollisionBox & {
  id: string
  ownerId: string
  sourceWallId?: string
  edge?: MainlineWallOpening['edge']
  geometryKind: 'boundary' | 'air-wall' | 'blocker'
  surface: 'wall' | 'storefront' | 'door' | 'feature' | 'opening' | 'air-wall' | 'blocker'
  /** A visual overlay only; it never contributes collision or navigation. */
  visualOnly?: boolean
  visual: {
    kind: 'wall' | 'storefront' | 'door' | 'opening' | 'feature' | 'none'
    cells: readonly MainlineSceneVisualCell[]
  }
  navigation: {
    blocked: boolean
    passageId?: string
    opensWithPassageId?: string
  }
  entityId?: string
  storefrontId?: string
  variant?: 'baseline' | 'near'
}

export type MainlineWallVisualUnit = {
  id: string
  ownerId: string
  x: number
  y: number
  baseline: boolean
  kind: 'wall' | 'door' | 'opening' | 'feature' | 'storefront'
  glyph?: string
  entityId?: string
  label?: string
  displayLabel?: string
  doorBehavior?: SceneDoorBehavior
  access?: MainlineScenePassage['access']
  lockedText?: string
  storefrontId?: string
  storefrontStyle?: MainlineStorefrontSlot['style']
  storefrontRole?: MainlineStorefrontRole
  storefrontNear?: boolean
  orientation?: 'horizontal' | 'vertical'
}

export type MainlineSceneDefinition = {
  id: MainlineSceneId
  title: string
  subtitle: string
  statusLabel: string
  hint: string
  entryFeedback?: string
  areaLabel?: string | ((position: Point) => string)
  walkBounds: CollisionBox
  viewport: MainlineSceneViewport
  externalExit?: MainlineSceneExternalExit
  externalExits: readonly MainlineSceneExternalExit[]
  rooms: readonly MainlineSceneRoom[]
  structures: readonly MainlineStructure[]
  storefronts: readonly MainlineStorefrontSlot[]
  altars: readonly MainlineAltarBlueprint[]
  geometry: readonly MainlineSceneGeometryUnit[]
  wallCollisions: readonly MainlineWallCollision[]
  curves: readonly MainlineSceneCurve[]
  airWalls?: readonly MainlineAirWall[]
  blockers: readonly (CollisionBox & { id: string })[]
  wallDensity?: MainlineWallDensity
  objects: readonly MainlineSceneEntity[]
  npcs: readonly MainlineSceneNpc[]
  attachedProps: readonly MainlineSceneAttachedProp[]
  furnitureGroups: readonly MainlineFurnitureGroup[]
  passages: readonly MainlineScenePassage[]
  initialPlayerPosition: Point
  rideArrivalPosition: Point
  portals: readonly MainlineScenePortalBlueprint[]
  interactionText: Readonly<Record<string, string>>
  explorationText?: Readonly<Record<string, readonly string[]>>
  explorationChoices?: Readonly<Record<string, { text: string; options: readonly string[] }>>
  echoPool?: readonly string[]
  dialogue?: MainlineSceneDialogue
}

export type MainlineSceneSliceDefinition = {
  id: string
  objectIds: readonly string[]
  furnitureGroupIds: readonly string[]
  actorIds: readonly string[]
}

export function mainlineEntityDisplayLabel(entity: MainlineSceneEntity) {
  return entity.displayLabel ?? entity.label
}

export function sampleMainlineCurve(curve: MainlineSceneCurve, steps = curve.sampleCount ?? 26): Point[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps
    const inverse = 1 - progress
    return {
      x: inverse * inverse * curve.start.x + 2 * inverse * progress * curve.control.x + progress * progress * curve.end.x,
      y: inverse * inverse * curve.start.y + 2 * inverse * progress * curve.control.y + progress * progress * curve.end.y,
    }
  })
}

function structureEdgePoint(bounds: { x: number; y: number; width: number; height: number }, edge: MainlineWallOpening['edge'], coordinate: number): Point {
  if (edge === 'left') return { x: bounds.x, y: coordinate }
  if (edge === 'right') return { x: bounds.x + bounds.width, y: coordinate }
  if (edge === 'top') return { x: coordinate, y: bounds.y }
  return { x: coordinate, y: bounds.y + bounds.height }
}

export function mainlineWallVisualUnits(scene: MainlineSceneDefinition, position: Point, screenMetrics?: SceneScreenMetrics): MainlineWallVisualUnit[] {
  return mainlineSceneGeometryUnits(scene, position, screenMetrics).flatMap((unit) => unit.visual.cells.map((cell) => ({
    id: cell.id,
    ownerId: cell.kind === 'feature' ? (cell.featureId ?? unit.ownerId) : unit.ownerId,
    x: cell.x,
    y: cell.y,
    baseline: unit.variant !== 'near',
    kind: cell.kind,
    glyph: cell.glyph,
    entityId: cell.entityId ?? unit.entityId,
    label: cell.label ?? (cell.kind === 'door' ? cell.glyph : undefined),
    displayLabel: cell.displayLabel,
    doorBehavior: cell.doorBehavior,
    access: cell.access,
    lockedText: cell.lockedText,
    storefrontId: cell.storefrontId ?? unit.storefrontId,
    storefrontStyle: cell.storefrontStyle,
    storefrontRole: cell.storefrontRole,
    storefrontNear: unit.variant === 'near',
    orientation: cell.orientation,
  })))
}

function edgeGeometryRect(bounds: CollisionBox, edge: MainlineWallOpening['edge'], start: number, end: number, thickness = mainlineWallThickness): CollisionBox {
  const halfThickness = thickness / 2
  if (edge === 'top') return { x: start, y: bounds.y - halfThickness, width: end - start, height: thickness }
  if (edge === 'right') return { x: bounds.x + bounds.width - halfThickness, y: start, width: thickness, height: end - start }
  if (edge === 'bottom') return { x: start, y: bounds.y + bounds.height - halfThickness, width: end - start, height: thickness }
  return { x: bounds.x - halfThickness, y: start, width: thickness, height: end - start }
}

function edgeGeometryCenter(bounds: CollisionBox, edge: MainlineWallOpening['edge'], start: number, end: number): Point {
  return structureEdgePoint(bounds, edge, (start + end) / 2)
}

type MainlinePassageGeometry = Pick<MainlineScenePassage, 'id' | 'portalId' | 'entityId' | 'access' | 'lockedText' | 'lockedTextPool' | 'routeThrough' | 'frameBehavior' | 'fromRoomId' | 'toRoomId'>

function mainlineBoundaryCell(cell: SharedBoundaryCell, structure: MainlineStructure): MainlineSceneVisualCell {
  const kind = cell.role === 'door' ? 'door' : cell.role === 'opening' ? 'opening' : cell.role === 'feature' ? 'feature' : 'wall'
  const glyph = kind === 'wall' && structure.wallGlyphs?.length
    ? structure.wallGlyphs[cell.gridIndex % structure.wallGlyphs.length]
    : cell.glyph
  return {
    id: `${structure.id}-${cell.boundaryId}-${cell.gridIndex}`,
    x: cell.x,
    y: cell.y,
    kind,
    glyph,
    label: kind === 'door' ? (cell.label ?? cell.glyph) : undefined,
    displayLabel: kind === 'door' ? cell.displayLabel : undefined,
    doorLabelPart: kind === 'door' ? cell.doorLabelPart : undefined,
    entityId: cell.featureCellRole === 'flank' ? cell.doorId : cell.interactionId ?? cell.doorId,
    doorBehavior: cell.doorBehavior,
    access: cell.access,
    lockedText: cell.lockedText,
    orientation: cell.glyphOrientation,
    baseline: cell.baseline,
    baselineVisible: cell.baselineVisible,
    featureId: cell.role === 'feature' ? cell.featureId : undefined,
    featureCellRole: cell.role === 'feature' ? cell.featureCellRole : undefined,
    cellStart: cell.cellStart,
    cellEnd: cell.cellEnd,
  }
}

type MainlineFrameEdgeConfig = {
  structure: MainlineStructure
  edge: MainlineWallOpening['edge']
  baselineEvery: number
  openings: readonly MainlineWallOpening[]
  features: readonly MainlineWallFeature[]
  storefronts: readonly MainlineStorefrontSlot[]
}

/**
 * Compile every boundary component for one scene in a single frame
 * transaction. The edge loop only projects cells after the frame has
 * allocated the full fixed role map.
 */
function compileMainlineFrameUnits(
  edgeConfigs: readonly MainlineFrameEdgeConfig[],
  steps: { horizontal: number; vertical: number },
  passages: readonly MainlinePassageGeometry[],
  objects: readonly MainlineSceneEntity[],
): MainlineSceneGeometryUnit[] {
  if (edgeConfigs.length === 0) return []

  const frame: SharedBoundaryFrame = {
    id: 'scene-frame',
    steps,
    edges: edgeConfigs.map((config) => {
      const structure = config.structure
      if (!structure.bounds) return null
      const { edge } = config
      const horizontal = edge === 'top' || edge === 'bottom'
      const axisStart = horizontal ? structure.bounds.x : structure.bounds.y
      const axisEnd = horizontal ? structure.bounds.x + structure.bounds.width : structure.bounds.y + structure.bounds.height
      const orientation = horizontal ? 'horizontal' : 'vertical'
      const sharedOpenings: SharedBoundaryOpening[] = [
        ...config.openings.map((opening) => {
          const passage = opening.doorId ? passages.find((candidate) => candidate.entityId === opening.doorId) : undefined
          const door = opening.doorId ? objects.find((entity) => entity.id === opening.doorId) : undefined
          return {
            id: `${structure.id}-${edge}-${opening.doorId ?? 'opening'}-${opening.start}-${opening.end}`,
            start: opening.start,
            end: opening.end,
            kind: opening.transitionOnly ? 'opening' as const : opening.doorId ? 'door' as const : 'opening' as const,
            transitionOnly: opening.transitionOnly,
            doorFlankCount: opening.doorFlankCount,
            doorId: opening.doorId,
            doorBehavior: door?.doorBehavior ?? opening.doorBehavior,
            label: door?.label ?? opening.label,
            displayLabel: door?.displayLabel ?? opening.displayLabel,
            glyphs: opening.labelLayout === 'split' && opening.label ? Array.from(opening.label) : opening.label ? [opening.label] : [],
            labelLayout: opening.labelLayout,
            labelGapCells: opening.labelGapCells,
            afterFeatureId: opening.afterFeatureId,
            gapCells: opening.gapCells,
            passageId: passage?.id,
            access: passage?.access,
            lockedText: passage?.lockedText,
          }
        }),
        ...config.storefronts.map((storefront) => ({
          id: storefront.id,
          start: storefront.start,
          end: storefront.end,
          kind: 'reserved' as const,
          cellCount: storefrontFixedCellCount(storefront),
        })),
      ]
      return {
        id: `${structure.id}-${edge}`,
        orientation: horizontal ? 'horizontal' as const : 'vertical' as const,
        start: structureEdgePoint(structure.bounds!, edge, axisStart),
        length: axisEnd - axisStart,
        geometrySource: structure.boundaryGeometrySource ?? 'anchor',
        coordinateCount: structure.boundaryCoordinateCount?.[orientation],
        visualEndpoints: structure.boundaryVisualEndpoints?.[orientation],
        baselineEvery: config.baselineEvery,
        openings: sharedOpenings,
        features: config.features.map((feature) => ({
          id: feature.id,
          center: (feature.start + feature.end) / 2,
          glyphs: feature.glyphs,
          layout: feature.layout,
          interactionId: feature.entityId,
        })),
      }
    }).filter((edge): edge is NonNullable<typeof edge> => edge !== null),
  }
  const frameCompilation = compileSharedFrame(frame)

  return edgeConfigs.flatMap((config) => {
    const structure = config.structure
    if (!structure.bounds) return []
    const edge = config.edge
    const edgeCompilation = frameCompilation.edges.find((candidate) => candidate.edge.id === `${structure.id}-${edge}`)
    if (!edgeCompilation) return []
    const units: MainlineSceneGeometryUnit[] = []
    const labelToCell = (cell: SharedBoundaryCell) => mainlineBoundaryCell(cell, structure)
    const labelIsInsideOpening = (label: SharedBoundaryCell, opening: SharedBoundaryOpening & { resolvedStart?: number; resolvedEnd?: number }) => (
      label.axis >= (opening.resolvedStart ?? opening.start) - .001 && label.axis <= (opening.resolvedEnd ?? opening.end) + .001
    )
    const visibleLabelIds = new Set(edgeCompilation.labels.map((label) => label.id))
    const freeCells = edgeCompilation.cells.filter((cell) => (
      !cell.openingId
      && (!cell.structuralOpeningId || !edgeCompilation.openings.some((opening) => (
        opening.id === cell.structuralOpeningId && labelIsInsideOpening(cell, opening)
      )))
    ))

    edgeCompilation.geometryRanges.filter((range) => range.kind === 'wall').forEach((segment) => {
      const cells = freeCells
        .filter((cell) => cell.axis >= segment.start - .001 && cell.axis <= segment.end + .001)
        .map((cell) => labelToCell(visibleLabelIds.has(cell.id) ? cell : { ...cell, glyph: '' }))
      units.push({
        ...edgeGeometryRect(structure.bounds!, edge, segment.start, segment.end),
        id: segment.id,
        ownerId: structure.id,
        sourceWallId: structure.id,
        edge,
        geometryKind: 'boundary',
        surface: 'wall',
        visual: { kind: 'wall', cells },
        navigation: { blocked: true },
      })
    })

    edgeCompilation.openings.filter((opening) => opening.kind !== 'reserved').forEach((opening) => {
      const geometryRange = edgeCompilation.geometryRanges.find((range) => range.kind === 'replacement' && range.replacementId === opening.id)
      if (!geometryRange) return
      const cells = edgeCompilation.labels
        .filter((label) => label.openingId === opening.id || (
          label.structuralOpeningId === opening.id && labelIsInsideOpening(label, opening)
        ))
        .map(labelToCell)
      const passage = passages.find((candidate) => candidate.id === opening.passageId)
      const door = opening.doorId ? objects.find((entity) => entity.id === opening.doorId) : undefined
      const isDoor = Boolean(opening.doorId && door && !opening.transitionOnly)
      units.push({
        ...edgeGeometryRect(structure.bounds!, edge, geometryRange.start, geometryRange.end),
        id: opening.id,
        ownerId: structure.id,
        sourceWallId: structure.id,
        edge,
        geometryKind: 'boundary',
        surface: isDoor ? 'door' : 'opening',
        visual: { kind: isDoor ? 'door' : 'opening', cells },
        navigation: { blocked: isDoor, ...(passage ? { passageId: passage.id } : {}) },
        ...(door && (isDoor || opening.transitionOnly) ? { entityId: door.id } : {}),
      })
    })

    config.storefronts.forEach((storefront) => {
      const placement = edgeCompilation.openings.find((opening) => opening.id === storefront.id && opening.kind === 'reserved')
      if (!placement) return
      const passageId = storefront.portalId
      const passage = passageId
        ? passages.find((candidate) => candidate.id === passageId || candidate.portalId === passageId)
        : undefined
      const door = passageId ? objects.find((entity) => entity.id === passageId) : undefined
      const vertical = edge === 'left' || edge === 'right'
      const canonicalStorefrontCells = placement.gridIndices
        .map((gridIndex) => {
          const cellRange = boundaryGridCellRange(edgeCompilation.coordinates, gridIndex)
          if (!cellRange) return null
          return {
            gridIndex,
            cellRange,
            center: edgeGeometryCenter(structure.bounds!, edge, cellRange.start, cellRange.end),
          }
        })
        .filter((cell): cell is NonNullable<typeof cell> => cell !== null)
      if (canonicalStorefrontCells.length === 0) return
      const hasNearProjection = storefrontHasNearProjection(storefront)

      // A storefront portal owns one real wall-door-wall base. The distant
      // shop sign is only painted over that base; it must never replace the
      // door or become a second navigation/collision source.
      if (hasNearProjection && door && passageId) {
        const baseRoles: readonly MainlineStorefrontRole[] = ['wall', 'door', 'wall']
        baseRoles.forEach((role, index) => {
          const canonicalCell = canonicalStorefrontCells[index]
          if (!canonicalCell) return
          const cell = {
            id: `${storefront.id}-base-cell-${index}`,
            x: canonicalCell.center.x,
            y: canonicalCell.center.y,
            kind: role === 'door' ? 'door' as const : 'wall' as const,
            glyph: role === 'door' ? '门' : '墙',
            ...(role === 'door' ? { entityId: door.id, doorBehavior: door.doorBehavior, access: passage?.access, lockedText: passage?.lockedText } : {}),
            orientation: vertical ? 'vertical' as const : 'horizontal' as const,
            cellStart: canonicalCell.cellRange.start,
            cellEnd: canonicalCell.cellRange.end,
          }
          units.push({
            ...edgeGeometryRect(structure.bounds!, edge, canonicalCell.cellRange.start, canonicalCell.cellRange.end),
            id: `${storefront.id}-base-${index}`,
            ownerId: storefront.id,
            sourceWallId: structure.id,
            edge,
            geometryKind: 'boundary',
            surface: role === 'door' ? 'door' : 'wall',
            visual: { kind: role === 'door' ? 'door' : 'wall', cells: [cell] },
            navigation: { blocked: true, passageId },
            ...(role === 'door' ? { entityId: door.id } : {}),
            storefrontId: storefront.id,
          })
        })
      }

      const variants: Array<'baseline' | 'near'> = hasNearProjection ? ['baseline', 'near'] : ['baseline']
      variants.forEach((variant) => {
        const roles = fitStorefrontRoles(storefrontRolesForVariant(storefront, variant), canonicalStorefrontCells.length)
        roles.forEach((role, index) => {
          const canonicalCell = canonicalStorefrontCells[index]
          if (!canonicalCell) return
          const overlayHidden = hasNearProjection && variant === 'near'
          const glyph = storefrontGlyph(role, storefront.label, roles, index)
          const cell = {
            id: `${storefront.id}-cell-${index}`,
            x: canonicalCell.center.x,
            y: canonicalCell.center.y,
            kind: 'storefront' as const,
            ...(glyph ? { glyph } : {}),
            ...(role === 'door' ? { label: storefront.label } : {}),
            ...(role === 'door' && !hasNearProjection && door
              ? { entityId: door.id, doorBehavior: door.doorBehavior, access: passage?.access, lockedText: passage?.lockedText }
              : {}),
            storefrontId: storefront.id,
            storefrontStyle: storefront.style,
            storefrontRole: role,
            orientation: vertical ? 'vertical' as const : 'horizontal' as const,
            cellStart: canonicalCell.cellRange.start,
            cellEnd: canonicalCell.cellRange.end,
          }
          units.push({
            ...edgeGeometryRect(structure.bounds!, edge, canonicalCell.cellRange.start, canonicalCell.cellRange.end),
            id: `${storefront.id}-${variant}-${index}`,
            ownerId: storefront.id,
            sourceWallId: structure.id,
            edge,
            geometryKind: 'boundary',
            surface: hasNearProjection ? 'storefront' : role === 'door' ? 'door' : 'storefront',
            ...(hasNearProjection ? { visualOnly: true } : {}),
            visual: overlayHidden
              ? { kind: 'none', cells: [] }
              : { kind: hasNearProjection ? 'storefront' : role === 'door' ? 'door' : 'storefront', cells: [cell] },
            ...(hasNearProjection
              ? { navigation: { blocked: false } }
              : { navigation: { blocked: true, ...(passage ? { passageId: passage.id } : {}) } }),
            ...(!hasNearProjection && role === 'door' && door ? { entityId: door.id } : {}),
            storefrontId: storefront.id,
            variant,
          })
        })
      })
    })
    return units
  })
}

const defaultStorefrontComposition: MainlineStorefrontComposition = {
  baseline: ['glass', 'sign', 'glass'],
  near: ['glass', 'wall', 'door', 'wall', 'glass'],
}

function expandStorefrontRoles(roles: readonly MainlineStorefrontRole[], label: string): MainlineStorefrontRole[] {
  return roles.flatMap((role) => {
    if (role === 'sign') return Array.from(label, () => 'sign' as const)
    if (role === 'glass') return ['glass', 'glass'] as const
    return [role]
  })
}

function storefrontRolesForVariant(storefront: MainlineStorefrontSlot, variant: 'baseline' | 'near'): MainlineStorefrontRole[] {
  const mode: MainlineStorefrontMode = storefront.mode ?? 'commercial'
  if (mode === 'content') return ['blank', ...Array.from(storefront.label, () => 'sign' as const), 'blank']
  if (mode === 'door') return ['wall', 'door', 'wall']
  const composition = storefront.composition ?? defaultStorefrontComposition
  const baseline = expandStorefrontRoles(composition.baseline, storefront.label)
  if (variant === 'baseline') return baseline
  const near = expandStorefrontRoles(composition.near ?? composition.baseline, storefront.label)
  if (near.length >= baseline.length) return near
  const paddingCount = baseline.length - near.length
  const leftPadding = Math.floor(paddingCount / 2)
  return [
    ...Array.from({ length: leftPadding }, () => 'wall' as const),
    ...near,
    ...Array.from({ length: paddingCount - leftPadding }, () => 'wall' as const),
  ]
}

function storefrontHasNearProjection(storefront: MainlineStorefrontSlot) {
  const composition = storefront.composition ?? defaultStorefrontComposition
  return (storefront.mode ?? 'commercial') === 'commercial'
    && Boolean(storefront.portalId && (composition.near ?? defaultStorefrontComposition.near)?.length)
}

function storefrontFixedCellCount(storefront: MainlineStorefrontSlot) {
  const baselineCount = storefrontRolesForVariant(storefront, 'baseline').length
  return storefrontHasNearProjection(storefront)
    ? Math.max(baselineCount, storefrontRolesForVariant(storefront, 'near').length)
    : baselineCount
}

function fitStorefrontRoles(roles: readonly MainlineStorefrontRole[], cellCount: number): MainlineStorefrontRole[] {
  if (roles.length >= cellCount) return roles.slice(0, cellCount)
  const paddingCount = cellCount - roles.length
  const leftPadding = Math.floor(paddingCount / 2)
  return [
    ...Array.from({ length: leftPadding }, () => 'blank' as const),
    ...roles,
    ...Array.from({ length: paddingCount - leftPadding }, () => 'blank' as const),
  ]
}

function storefrontGlyph(role: MainlineStorefrontRole, label: string, roles: readonly MainlineStorefrontRole[], index: number) {
  if (role === 'sign') {
    const signIndex = roles.slice(0, index).filter((candidate) => candidate === 'sign').length
    return Array.from(label)[signIndex]
  }
  if (role === 'door') return '门'
  if (role === 'wall') return '墙'
  if (role === 'glass') {
    const glassIndex = roles.slice(0, index).filter((candidate) => candidate === 'glass').length
    return ['玻', '璃'][glassIndex % 2]
  }
  return undefined
}

function curveGeometryUnits(curves: readonly MainlineSceneCurve[]): MainlineSceneGeometryUnit[] {
  return curves.flatMap((curve) => {
    if (!curve.blocksPlayer) return []
    const points = sampleMainlineCurve(curve)
    return points.slice(0, -1).map((start, index) => {
      const end = points[index + 1]
      const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      return {
        id: `${curve.id}-${index}`,
        ownerId: curve.id,
        x: Math.min(start.x, end.x) - .2,
        y: Math.min(start.y, end.y) - .2,
        width: Math.max(.4, Math.abs(end.x - start.x) + .4),
        height: Math.max(.4, Math.abs(end.y - start.y) + .4),
        geometryKind: 'boundary' as const,
        surface: 'wall' as const,
        visual: {
          kind: 'wall' as const,
          cells: [{
            id: `${curve.id}-${index}-cell`,
            x: center.x,
            y: center.y,
            kind: 'wall' as const,
            glyph: curve.glyph ?? '窗',
            baseline: true,
          }],
        },
        navigation: { blocked: true },
      }
    })
  })
}

function compileMainlineGeometry(
  structures: readonly MainlineStructure[],
  storefronts: readonly MainlineStorefrontSlot[],
  objects: readonly MainlineSceneEntity[],
  wallDensity: MainlineWallDensity | undefined,
  airWalls: readonly MainlineAirWall[] | undefined,
  blockers: readonly (CollisionBox & { id: string })[],
  curves: readonly MainlineSceneCurve[],
  passages: readonly MainlinePassageGeometry[],
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): MainlineSceneGeometryUnit[] {
  const steps = boundaryGridStepsFromScreenSpacing(sharedBoundaryScreenSpacingPx, screenMetrics)
  const projectedStructures = structures.map((structure) => {
    if (structure.boundaryProjection !== 'screen-spacing' || !structure.bounds) return structure
    const verticalCoordinateCount = structure.boundaryCoordinateCount?.vertical
    if (!verticalCoordinateCount || verticalCoordinateCount < 2) return structure
    const height = steps.vertical * (verticalCoordinateCount - 1)
    const centerY = structure.bounds.y + structure.bounds.height / 2
    return {
      ...structure,
      bounds: {
        ...structure.bounds,
        y: centerY - height / 2,
        height,
      },
    }
  })
  const units: MainlineSceneGeometryUnit[] = []
  const storefrontByWall = new Map<string, MainlineStorefrontSlot[]>()
  storefronts.forEach((storefront) => {
    const list = storefrontByWall.get(storefront.wallId) ?? []
    list.push(storefront)
    storefrontByWall.set(storefront.wallId, list)
  })

  const frameEdgeConfigs: MainlineFrameEdgeConfig[] = []
  projectedStructures.forEach((structure) => {
    if (!structure.bounds || !['frame', 'room', 'alley'].includes(structure.type)) return
    const edges = structure.wallEdges ?? ['top', 'right', 'bottom', 'left']
    edges.forEach((edge) => {
      const edgeOpenings = (structure.openings ?? []).filter((opening) => opening.edge === edge)
      const edgeFeatures = (structure.features ?? []).filter((feature) => feature.edge === edge)
      const edgeStorefronts = (storefrontByWall.get(structure.id) ?? []).filter((storefront) => storefront.edge === edge)
      const storefrontPortalIds = new Set(edgeStorefronts.flatMap((storefront) => storefront.portalId ? [storefront.portalId] : []))
      const effectiveOpenings = edgeOpenings.filter((opening) => !opening.doorId || !storefrontPortalIds.has(opening.doorId))
      const baselineEvery = edge === 'top' || edge === 'bottom'
        ? wallDensity?.horizontalBaselineEvery ?? 1
        : wallDensity?.verticalBaselineEvery ?? 1
      frameEdgeConfigs.push({
        structure,
        edge,
        baselineEvery,
        openings: effectiveOpenings,
        features: edgeFeatures,
        storefronts: edgeStorefronts,
      })
    })
  })
  units.push(...compileMainlineFrameUnits(frameEdgeConfigs, steps, passages, objects))

  airWalls?.forEach((airWall) => units.push({
    ...airWall,
    ownerId: airWall.id,
    geometryKind: 'air-wall',
    surface: 'air-wall',
    visual: { kind: 'none', cells: [] },
    navigation: { blocked: true, ...(airWall.opensWithPassageId ? { opensWithPassageId: airWall.opensWithPassageId } : {}) },
  }))
  blockers.forEach((blocker) => units.push({
    ...blocker,
    ownerId: blocker.id,
    geometryKind: 'blocker',
    surface: 'blocker',
    visual: { kind: 'none', cells: [] },
    navigation: { blocked: true },
  }))
  units.push(...curveGeometryUnits(curves))
  return units
}

function geometryCollisionForPassage(units: readonly MainlineSceneGeometryUnit[], passageId: string): CollisionBox {
  const passageUnits = units.filter((unit) => unit.navigation.passageId === passageId)
  if (passageUnits.length === 0) throw new Error(`Passage ${passageId} has no canonical geometry unit`)
  const left = Math.min(...passageUnits.map((unit) => unit.x))
  const top = Math.min(...passageUnits.map((unit) => unit.y))
  const right = Math.max(...passageUnits.map((unit) => unit.x + unit.width))
  const bottom = Math.max(...passageUnits.map((unit) => unit.y + unit.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function geometryDoorwayForPassage(units: readonly MainlineSceneGeometryUnit[], passage: MainlinePassageGeometry): CollisionBox {
  const doorwayUnits = units.filter((unit) => unit.navigation.passageId === passage.id && unit.entityId === passage.entityId)
  if (doorwayUnits.length === 0) throw new Error(`Passage ${passage.id} has no canonical door cell`)
  return geometryUnion(doorwayUnits)
}

/**
 * Passage endpoints describe approach depth, while the compiled opening owns
 * the fitted lattice center. Align only the tangent axis to that canonical
 * center so a click on the rendered door row resolves to the same region.
 */
function alignPassageEndpointsToCollision<T extends { thresholds: readonly [Point, Point]; crossingTargets: readonly [Point, Point] }>(passage: T, collision: CollisionBox): T {
  const normalAxis = Math.abs(passage.crossingTargets[0].x - passage.thresholds[0].x)
    >= Math.abs(passage.crossingTargets[0].y - passage.thresholds[0].y)
    ? 'x'
    : 'y'
  const center = {
    x: collision.x + collision.width / 2,
    y: collision.y + collision.height / 2,
  }
  const align = (point: Point) => normalAxis === 'x'
    ? { ...point, y: center.y }
    : { ...point, x: center.x }
  return {
    ...passage,
    thresholds: passage.thresholds.map(align) as unknown as T['thresholds'],
    crossingTargets: passage.crossingTargets.map(align) as unknown as T['crossingTargets'],
  }
}

function sameCollisionBox(first: CollisionBox, second: CollisionBox) {
  const epsilon = 0.0001
  return Math.abs(first.x - second.x) <= epsilon
    && Math.abs(first.y - second.y) <= epsilon
    && Math.abs(first.width - second.width) <= epsilon
    && Math.abs(first.height - second.height) <= epsilon
}

function positiveGeometryOverlap(first: CollisionBox, second: CollisionBox) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

function geometryUnion(units: readonly MainlineSceneGeometryUnit[]): CollisionBox {
  const left = Math.min(...units.map((unit) => unit.x))
  const top = Math.min(...units.map((unit) => unit.y))
  const right = Math.max(...units.map((unit) => unit.x + unit.width))
  const bottom = Math.max(...units.map((unit) => unit.y + unit.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Enforce the scene data contract at compile time. A wall collision, passage
 * collision, air wall, or blocker must be the same rectangle that the active
 * geometry projection exposes to the renderer and navigation.
 */
export function validateMainlineSceneGeometry(scene: Pick<MainlineSceneDefinition, 'geometry' | 'passages' | 'wallCollisions' | 'airWalls' | 'blockers'>): readonly string[] {
  const issues: string[] = []
  const canonicalBoundaryUnits = scene.geometry.filter((unit) => unit.geometryKind === 'boundary' && unit.variant !== 'near' && !unit.visualOnly)

  scene.geometry.forEach((unit) => {
    if (unit.width <= 0 || unit.height <= 0) issues.push(`${unit.id}: geometry must have positive dimensions`)
    if (unit.visual.kind !== 'none' && unit.visual.cells.length === 0) issues.push(`${unit.id}: visual geometry has no cells`)
    unit.visual.cells.forEach((cell) => {
      if (cell.x < unit.x || cell.x > unit.x + unit.width || cell.y < unit.y || cell.y > unit.y + unit.height) {
        issues.push(`${unit.id}: visual cell ${cell.id} is outside its collision rectangle`)
      }
    })
    if (unit.navigation.passageId && !scene.passages.some((passage) => passage.id === unit.navigation.passageId)) {
      issues.push(`${unit.id}: navigation references an unknown passage`)
    }
  })

  canonicalBoundaryUnits.forEach((unit) => {
    if (!unit.navigation.blocked && unit.visual.kind !== 'opening') {
      issues.push(`${unit.id}: visible boundary is not represented as blocked or opening`)
    }
    if (!unit.navigation.blocked || !unit.sourceWallId) return
    const collision = scene.wallCollisions.find((candidate) => candidate.id === unit.id)
    if (!collision || !sameCollisionBox(collision, unit)) {
      issues.push(`${unit.id}: wall collision diverges from canonical geometry`)
    }
  })

  scene.geometry.forEach((unit, index) => {
    if (unit.geometryKind !== 'boundary' || unit.variant === 'near' || !unit.sourceWallId || !unit.edge) return
    scene.geometry.slice(index + 1).forEach((other) => {
      if (other.geometryKind !== 'boundary' || other.variant === 'near' || other.visualOnly || other.sourceWallId !== unit.sourceWallId || other.edge !== unit.edge) return
      if (positiveGeometryOverlap(unit, other)) issues.push(`${unit.sourceWallId}:${unit.edge}: canonical wall geometry overlaps`)
    })
  })

  ;(scene.airWalls ?? []).forEach((airWall) => {
    const unit = scene.geometry.find((candidate) => candidate.geometryKind === 'air-wall' && candidate.id === airWall.id)
    if (!unit || !sameCollisionBox(unit, airWall)) issues.push(`${airWall.id}: air wall diverges from canonical geometry`)
  })
  scene.blockers.forEach((blocker) => {
    const unit = scene.geometry.find((candidate) => candidate.geometryKind === 'blocker' && candidate.id === blocker.id)
    if (!unit || !sameCollisionBox(unit, blocker)) issues.push(`${blocker.id}: blocker diverges from canonical geometry`)
  })

  scene.passages.forEach((passage) => {
    const passageUnits = scene.geometry.filter((unit) => unit.navigation.passageId === passage.id)
    if (passageUnits.length === 0 || !sameCollisionBox(geometryUnion(passageUnits), passage.collision)) {
      issues.push(`${passage.id}: passage collision diverges from canonical geometry`)
    }
    const doorwayUnits = passageUnits.filter((unit) => unit.entityId === passage.entityId)
    if (doorwayUnits.length === 0 || !sameCollisionBox(geometryUnion(doorwayUnits), passage.doorway)) {
      issues.push(`${passage.id}: doorway diverges from canonical door cell`)
    }
    if (passage.access === 'locked' && !passageUnits.some((unit) => unit.visual.cells.some((cell) => cell.access === 'locked'))) {
      issues.push(`${passage.id}: locked passage has no locked visual state`)
    }
  })

  return issues
}

function compileMainlineSceneData(data: MainlineSceneData, portals: readonly MainlineScenePortalBlueprint[]): Omit<MainlineSceneDefinition, 'id' | 'title' | 'subtitle' | 'statusLabel' | 'hint' | 'portals' | 'interactionText'> {
  const portalOpeningsByWall = new Map<string, MainlineWallOpening[]>()
  const addPortalOpening = (wallId: string, opening: MainlineWallOpening) => {
    const openings = portalOpeningsByWall.get(wallId) ?? []
    if (!openings.some((candidate) => candidate.edge === opening.edge && candidate.start === opening.start && candidate.end === opening.end && candidate.doorId === opening.doorId)) {
      openings.push(opening)
    }
    portalOpeningsByWall.set(wallId, openings)
  }
  portals.forEach((portal) => {
    portal.wallOpenings?.forEach(({ wallId, opening }) => addPortalOpening(wallId, opening))
  })
  data.storefronts?.forEach((storefront) => {
    if (!storefront.portalId) return
    addPortalOpening(storefront.wallId, {
      edge: storefront.edge,
      start: storefront.start,
      end: storefront.end,
      doorId: storefront.portalId,
      label: storefront.label,
    })
  })

  const allOpeningsByWall = new Map<string, MainlineWallOpening[]>()
  data.walls.forEach((wall) => {
    const openings = [...(wall.openings ?? []), ...(portalOpeningsByWall.get(wall.id) ?? [])]
    allOpeningsByWall.set(wall.id, openings.filter((opening, index, candidates) => (
      candidates.findIndex((candidate) => candidate.edge === opening.edge && candidate.start === opening.start && candidate.end === opening.end && candidate.doorId === opening.doorId) === index
    )))
  })

  const storefronts = (data.storefronts ?? []).map((storefront): MainlineStorefrontSlot => ({
    ...storefront,
    mode: storefront.mode ?? 'commercial',
  }))

  const structures = data.walls.map((wall): MainlineStructure => {
    const openings = allOpeningsByWall.get(wall.id) ?? []
    const features = (wall.features ?? []).map(({ entity, ...feature }) => ({
      ...feature,
      ...(entity ? { entityId: entity.id } : {}),
    }))
    return {
      id: wall.id,
      type: wall.type,
      bounds: wall.bounds,
      variant: wall.variant,
       boundaryGeometrySource: wall.boundaryGeometrySource,
       boundaryCoordinateCount: wall.boundaryCoordinateCount,
       boundaryProjection: wall.boundaryProjection,
      boundaryVisualEndpoints: wall.boundaryVisualEndpoints,
      wallGlyphs: wall.wallGlyphs,
      wallGlyph: '墙',
      wallEdges: wall.edges,
      openings,
      features,
    }
  })

  const objectById = new Map<string, MainlineSceneEntity>()
  data.walls.forEach((wall) => {
    wall.features?.forEach(({ entity }) => {
      if (entity) objectById.set(entity.id, entity)
    })
  })
  data.floorEntities.forEach((entity) => objectById.set(entity.id, entity))
  portals.forEach((portal) => {
    objectById.set(portal.entity.id, {
      ...portal.entity,
      position: portal.endpoint.doorPosition,
    })
  })

  const passageGeometry = portals.flatMap((portal): (MainlinePassageGeometry & Omit<MainlineScenePassage, keyof MainlinePassageGeometry | 'collision' | 'doorway'>)[] => {
    const endpoint = portal.endpoint
    return [{
      id: portal.id,
      portalId: portal.id,
      entityId: portal.entity.id,
      targetSceneId: portal.targetSceneId,
      routeThrough: portal.routeThrough,
      frameBehavior: portal.frameBehavior,
      fromRoomId: portal.fromRoomId,
      toRoomId: portal.toRoomId,
      thresholds: [endpoint.threshold, endpoint.crossingTarget],
      crossingTargets: [endpoint.crossingTarget, endpoint.threshold],
      transitionText: portal.transitionText,
      access: portal.access,
      lockedText: portal.lockedText,
      lockedTextPool: portal.lockedTextPool,
      entryPosition: endpoint.entryPosition,
    }]
  })

  const geometry = compileMainlineGeometry(
    structures,
    storefronts,
    [...objectById.values()],
    data.wallDensity,
    data.airWalls,
    data.blockers,
    data.curves ?? [],
    passageGeometry,
  )
  const passages: MainlineScenePassage[] = passageGeometry.map((passage) => {
    const collision = geometryCollisionForPassage(geometry, passage.id)
    const doorway = geometryDoorwayForPassage(geometry, passage)
    return {
      ...alignPassageEndpointsToCollision(passage, collision),
      doorway,
      collision,
    }
  })

  const compiledScene = {
    walkBounds: data.walkBounds,
    viewport: data.viewport ?? 'follow-player',
    externalExit: data.externalExit,
    externalExits: data.externalExits ?? (data.externalExit ? [data.externalExit] : []),
    rooms: data.rooms ?? [],
    structures,
    storefronts,
    altars: data.altars ?? [],
    geometry,
    wallCollisions: geometry
      .filter((unit) => unit.geometryKind === 'boundary' && unit.navigation.blocked && unit.sourceWallId && unit.variant !== 'near' && !unit.visualOnly)
      .map((unit) => ({
        x: unit.x,
        y: unit.y,
        width: unit.width,
        height: unit.height,
        id: unit.id,
        sourceWallId: unit.sourceWallId!,
        edge: unit.edge!,
      })),
    curves: data.curves ?? [],
    airWalls: data.airWalls,
    blockers: data.blockers,
    wallDensity: data.wallDensity,
    objects: [...objectById.values()],
    npcs: data.npcs ?? [],
    attachedProps: data.attachedProps ?? [],
    furnitureGroups: data.furnitureGroups,
    passages,
    initialPlayerPosition: data.initialPlayerPosition,
    rideArrivalPosition: data.rideArrivalPosition ?? data.initialPlayerPosition,
  }
  const geometryIssues = validateMainlineSceneGeometry(compiledScene)
  if (geometryIssues.length > 0) throw new Error(`Invalid geometry for mainline scene: ${geometryIssues.join('; ')}`)
  return compiledScene
}

function passageGeometryForScene(scene: MainlineSceneDefinition): MainlinePassageGeometry[] {
  return scene.passages.map((passage) => ({
    id: passage.id,
    portalId: passage.portalId,
    entityId: passage.entityId,
    access: passage.access,
    lockedText: passage.lockedText,
    routeThrough: passage.routeThrough,
    frameBehavior: passage.frameBehavior,
    fromRoomId: passage.fromRoomId,
    toRoomId: passage.toRoomId,
  }))
}

const projectedGeometryCache = new WeakMap<MainlineSceneDefinition, Map<string, readonly MainlineSceneGeometryUnit[]>>()

function projectedBoundaryStructure(structure: MainlineStructure, screenMetrics: SceneScreenMetrics) {
  if (structure.boundaryProjection !== 'screen-spacing' || !structure.bounds) return structure
  const verticalCoordinateCount = structure.boundaryCoordinateCount?.vertical
  if (!verticalCoordinateCount || verticalCoordinateCount < 2) return structure
  const steps = boundaryGridStepsFromScreenSpacing(sharedBoundaryScreenSpacingPx, screenMetrics)
  const height = steps.vertical * (verticalCoordinateCount - 1)
  const centerY = structure.bounds.y + structure.bounds.height / 2
  return {
    ...structure,
    bounds: {
      ...structure.bounds,
      y: centerY - height / 2,
      height,
    },
  }
}

/** Return the same projected walk rectangle used by the screen geometry. */
export function mainlineSceneWalkBounds(scene: MainlineSceneDefinition, screenMetrics?: SceneScreenMetrics): CollisionBox {
  if (!screenMetrics) return scene.walkBounds
  const source = scene.structures.find((structure) => structure.boundaryProjection === 'screen-spacing' && structure.bounds)
  if (!source?.bounds) return scene.walkBounds
  const projected = projectedBoundaryStructure(source, screenMetrics)
  if (!projected.bounds) return scene.walkBounds
  const heightDelta = projected.bounds.height - source.bounds.height
  return {
    ...scene.walkBounds,
    y: scene.walkBounds.y - heightDelta / 2,
    height: scene.walkBounds.height + heightDelta,
  }
}

function projectedSceneGeometry(scene: MainlineSceneDefinition, screenMetrics: SceneScreenMetrics): readonly MainlineSceneGeometryUnit[] {
  const key = `${screenMetrics.width.toFixed(2)}x${screenMetrics.height.toFixed(2)}`
  const sceneCache = projectedGeometryCache.get(scene) ?? new Map<string, readonly MainlineSceneGeometryUnit[]>()
  const cached = sceneCache.get(key)
  if (cached) return cached
  const geometry = compileMainlineGeometry(
    scene.structures,
    scene.storefronts,
    scene.objects,
    scene.wallDensity,
    scene.airWalls,
    scene.blockers,
    scene.curves,
    passageGeometryForScene(scene),
    screenMetrics,
  )
  sceneCache.set(key, geometry)
  projectedGeometryCache.set(scene, sceneCache)
  return geometry
}

function compileMainlineScene(blueprint: MainlineSceneBlueprint): MainlineSceneDefinition {
  const compiledScene = compileMainlineSceneData(blueprint.scene, blueprint.portals)

  return {
    id: blueprint.id,
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    statusLabel: blueprint.statusLabel,
    hint: blueprint.hint,
    entryFeedback: blueprint.entryFeedback,
    areaLabel: blueprint.areaLabel,
    portals: blueprint.portals,
    interactionText: blueprint.interactionText,
    explorationText: blueprint.explorationText,
    explorationChoices: blueprint.explorationChoices,
    echoPool: blueprint.echoPool,
    dialogue: blueprint.dialogue,
    ...compiledScene,
  }
}

export const mainlineScenes: Record<MainlineSceneId, MainlineSceneDefinition> = Object.fromEntries(
  Object.entries(mainlineSceneBlueprints).map(([id, blueprint]) => [id, compileMainlineScene(blueprint)]),
) as Record<MainlineSceneId, MainlineSceneDefinition>

export function mainlineSceneAreaLabel(scene: MainlineSceneDefinition, position: Point) {
  if (typeof scene.areaLabel === 'function') return scene.areaLabel(position)
  return scene.areaLabel ?? scene.statusLabel
}

/**
 * Return the compiled geometry for the scene. Wall cells are complete
 * here; the renderer only resolves their visibility from the shared label
 * position, so storefront proximity never creates a second geometry projection.
 */
export function mainlineSceneGeometryUnits(scene: MainlineSceneDefinition, position: Point, screenMetrics?: SceneScreenMetrics): MainlineSceneGeometryUnit[] {
  const geometry = screenMetrics ? projectedSceneGeometry(scene, screenMetrics) : scene.geometry
  return geometry.flatMap((unit) => {
    if (!unit.storefrontId) return [unit]
    const storefront = scene.storefronts.find((candidate) => candidate.id === unit.storefrontId)
    if (!storefront) return []
    const hasNearProjection = scene.geometry.some((candidate) => (
      candidate.storefrontId === unit.storefrontId && candidate.variant === 'near'
    ))
    if (!hasNearProjection) return unit.variant === 'baseline' ? [unit] : []
    const near = storefront.portalId ? isMainlineStorefrontNear(scene, storefront, position) : false
    if (unit.variant) return unit.variant === (near ? 'near' : 'baseline') ? [unit] : []
    // Keep the canonical wall/door rectangle for collision and navigation,
    // but switch only its visual projection. Far away, the storefront label
    // covers this location; near the portal, the real wall-door-wall cells
    // become visible again.
    return near ? [unit] : [{ ...unit, visual: { kind: 'none' as const, cells: [] } }]
  })
}

/**
 * Resolve a passage opening from the same projected frame that the renderer
 * and obstacle compiler use. The canonical scene geometry remains the fallback
 * for non-screen callers; a measured stage must never leave navigation on a
 * different lattice than the visible door row.
 */
export function mainlineScenePassageCollision(scene: MainlineSceneDefinition, passageId: string, screenMetrics?: SceneScreenMetrics): CollisionBox | undefined {
  const geometry = mainlineSceneGeometryUnits(scene, scene.initialPlayerPosition, screenMetrics)
  const passageUnits = geometry.filter((unit) => unit.navigation.passageId === passageId)
  if (passageUnits.length === 0) return undefined
  return geometryUnion(passageUnits)
}

export function mainlineScenePassageDoorway(scene: MainlineSceneDefinition, passageId: string, screenMetrics?: SceneScreenMetrics): CollisionBox | undefined {
  const geometry = mainlineSceneGeometryUnits(scene, scene.initialPlayerPosition, screenMetrics)
  const passage = scene.passages.find((candidate) => candidate.id === passageId)
  if (!passage) return undefined
  const doorwayUnits = geometry.filter((unit) => unit.navigation.passageId === passageId && unit.entityId === passage.entityId)
  return doorwayUnits.length > 0 ? geometryUnion(doorwayUnits) : passage.doorway
}

export function getMainlineScenePortal(scene: MainlineSceneDefinition, portalId: string) {
  return scene.portals.find((portal) => portal.id === portalId)
}

export function mainlineStorefrontAnchor(scene: MainlineSceneDefinition, storefront: MainlineStorefrontSlot): Point {
  const portalEntity = storefront.portalId ? scene.objects.find((entity) => entity.id === storefront.portalId) : undefined
  if (portalEntity) return portalEntity.position
  const structure = scene.structures.find((candidate) => candidate.id === storefront.wallId)
  if (!structure?.bounds) return { x: storefront.start, y: storefront.start }
  if (storefront.edge === 'top') return { x: (storefront.start + storefront.end) / 2, y: structure.bounds.y }
  if (storefront.edge === 'right') return { x: structure.bounds.x + structure.bounds.width, y: (storefront.start + storefront.end) / 2 }
  if (storefront.edge === 'bottom') return { x: (storefront.start + storefront.end) / 2, y: structure.bounds.y + structure.bounds.height }
  return { x: structure.bounds.x, y: (storefront.start + storefront.end) / 2 }
}

export function mainlineStorefrontApproach(scene: MainlineSceneDefinition, storefront: MainlineStorefrontSlot): Point {
  if (storefront.approach) return storefront.approach
  const anchor = mainlineStorefrontAnchor(scene, storefront)
  const approachDistance = 6
  if (storefront.edge === 'top') return { x: anchor.x, y: anchor.y - approachDistance }
  if (storefront.edge === 'right') return { x: anchor.x + approachDistance, y: anchor.y }
  if (storefront.edge === 'bottom') return { x: anchor.x, y: anchor.y + approachDistance }
  return { x: anchor.x - approachDistance, y: anchor.y }
}

export function mainlineStorefrontAtPoint(scene: MainlineSceneDefinition, point: Point): MainlineStorefrontSlot | undefined {
  return scene.storefronts.find((storefront) => {
    const anchor = mainlineStorefrontAnchor(scene, storefront)
    const withinHorizontalSpan = point.x >= storefront.start - 2 && point.x <= storefront.end + 2
    const withinVerticalSpan = point.y >= storefront.start - 2 && point.y <= storefront.end + 2
    if (storefront.edge === 'top' || storefront.edge === 'bottom') {
      return withinHorizontalSpan && Math.abs(point.y - anchor.y) <= 3
    }
    return withinVerticalSpan && Math.abs(point.x - anchor.x) <= 3
  })
}

export function isMainlineStorefrontNear(scene: MainlineSceneDefinition, storefront: MainlineStorefrontSlot, position: Point) {
  const anchor = mainlineStorefrontAnchor(scene, storefront)
  return Math.hypot(position.x - anchor.x, position.y - anchor.y) <= (storefront.nearRadius ?? 10)
}

function createMainlineSceneSlice(scene: MainlineSceneDefinition): MainlineSceneSliceDefinition {
  return {
    id: `${scene.id}-slice`,
    objectIds: scene.objects.map((object) => object.id),
    furnitureGroupIds: scene.furnitureGroups.map((group) => group.id),
    actorIds: scene.npcs.map((npc) => npc.id),
  }
}

export const mainlineSceneSlices: Record<MainlineSceneId, MainlineSceneSliceDefinition> = {
  'jijia-ancestral-home': createMainlineSceneSlice(mainlineScenes['jijia-ancestral-home']),
  'jijia-ancestral-interior': { ...createMainlineSceneSlice(mainlineScenes['jijia-ancestral-interior']), id: 'jijia-ancestral-interior-slice' },
  'commercial-street': createMainlineSceneSlice(mainlineScenes['commercial-street']),
  'commercial-cafe': createMainlineSceneSlice(mainlineScenes['commercial-cafe']),
  'yonghe-mining-perimeter': createMainlineSceneSlice(mainlineScenes['yonghe-mining-perimeter']),
  'yonghe-eatery': createMainlineSceneSlice(mainlineScenes['yonghe-eatery']),
  'zhongshuyuan-passage': createMainlineSceneSlice(mainlineScenes['zhongshuyuan-passage']),
  'zhongshuyuan-office': createMainlineSceneSlice(mainlineScenes['zhongshuyuan-office']),
}

/**
 * The world map has one canonical destination for each playable landmark.
 * The internal Jijia entry remains addressable for authored scene tests, but
 * the map always returns to the yard so a map jump never respawns inside a
 * building.
 */
export const mainlineRespawnSceneId: MainlineSceneId = 'jijia-ancestral-home'

export type MainlineMapWorld = 'surface' | 'inner'

export const mainlineMapLayout = {
  viewBox: '0 0 100 78',
  gridPath: 'M0 13H100M0 26H100M0 39H100M0 52H100M0 65H100M10 0V78M25 0V78M40 0V78M55 0V78M70 0V78M85 0V78',
  routePoints: '18,66 34,66 34,45 50,45 66,45 66,25 82,25',
  landmarkPositions: {
    commercial: [18, 66],
    jijia: [30, 26],
    zhongshuyuan: [66, 50],
    mine: [82, 25],
  },
} as const

export type MainlineMapLandmark = {
  id: string
  /** A map-only landmark intentionally has no playable scene id. */
  sceneId?: MainlineSceneId
  label: string
  glyph: string
  position: readonly [number, number]
}

/** One map shell receives one world-specific landmark dataset. */
export const mainlineMapLandmarksByWorld: Record<MainlineMapWorld, readonly MainlineMapLandmark[]> = {
  surface: [
    { id: 'jijia', sceneId: 'jijia-ancestral-home', label: '姬家祖宅', glyph: '宅', position: mainlineMapLayout.landmarkPositions.jijia },
    { id: 'zhongshuyuan', label: '中枢院', glyph: '院', position: mainlineMapLayout.landmarkPositions.zhongshuyuan },
  ],
  inner: [
    { id: 'commercial', sceneId: 'commercial-street', label: '商业街', glyph: '街', position: mainlineMapLayout.landmarkPositions.commercial },
    { id: 'zhongshuyuan', sceneId: 'zhongshuyuan-office', label: '中枢院', glyph: '院', position: mainlineMapLayout.landmarkPositions.zhongshuyuan },
    { id: 'mine', sceneId: 'yonghe-mining-perimeter', label: '矿区', glyph: '矿', position: mainlineMapLayout.landmarkPositions.mine },
  ],
}

export type MainlineSpawnMode = 'resume' | 'ride'

export function mainlineSceneRoute(sceneId: MainlineSceneId, entryPosition?: Point, spawnMode?: MainlineSpawnMode) {
  const route = '/?scene=' + sceneId
  const entry = entryPosition ? '&entryX=' + entryPosition.x + '&entryY=' + entryPosition.y : ''
  const spawn = spawnMode === 'ride' ? '&spawn=ride' : ''
  return route + entry + spawn
}

export function resolveMainlineSceneId(search?: string): MainlineSceneId | null {
  const query = new URLSearchParams(search ?? (typeof window === 'undefined' ? '' : window.location.search))
  const value = query.get('scene')
  return value && value in mainlineScenes ? value as MainlineSceneId : null
}

export function getMainlineSceneEntity(scene: MainlineSceneDefinition, id: string) {
  const entity = scene.objects.find((object) => object.id === id)
  if (!entity) throw new Error(`Unknown ${scene.id} scene entity: ${id}`)
  return entity
}

export { mainlineSceneBlueprints }
