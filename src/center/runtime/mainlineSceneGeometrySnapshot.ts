import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import {
  mainlineSceneGeometryUnits,
  mainlineScenePassageCollision,
  mainlineScenePassageDoorway,
  mainlineSceneWalkBounds,
  type MainlineSceneDefinition,
  type MainlineSceneGeometryUnit,
  type MainlineScenePassage,
} from './mainlineScenes'
import type { CollisionBox, NavigationBarrierSegment, Point } from './sceneGeometry'
import type { StorefrontPresentationPhase } from './storefrontPresentation'
import {
  mainlineEntityCollision,
  mainlineEntityInteractionBounds,
  mainlineEntityPosition,
  mainlineEntityVisualBounds,
  type SceneLayout,
} from './sceneLayout'

export type MainlineObjectGeometry = {
  entityId: string
  position: Point
  interactionBounds: CollisionBox | null
  visualBounds: CollisionBox | null
  collision: CollisionBox | null
}

export type MainlineWallFeatureGeometry = {
  entityId: string
  featureId: string
  edge: 'top' | 'right' | 'bottom' | 'left'
  bounds: CollisionBox
  position: Point
}

export type MainlinePassageGeometrySnapshot = {
  passage: MainlineScenePassage
  collision: CollisionBox
  doorway: CollisionBox
}

/**
 * One screen-specific geometry transaction. The renderer, interaction layer,
 * route planner, collision checks, and transition landing resolver must all
 * consume this object instead of independently rebuilding geometry.
 */
export type MainlineSceneGeometrySnapshot = {
  sceneId: MainlineSceneDefinition['id']
  position: Point
  layout: SceneLayout
  screenMetrics: SceneScreenMetrics
  walkBounds: CollisionBox
  units: readonly MainlineSceneGeometryUnit[]
  objects: ReadonlyMap<string, MainlineObjectGeometry>
  wallFeatures: ReadonlyMap<string, MainlineWallFeatureGeometry>
  passages: ReadonlyMap<string, MainlinePassageGeometrySnapshot>
  navigationBarriers: readonly NavigationBarrierSegment[]
}

function relationBarrier(
  relation: MainlineSceneDefinition['navigationBarriers'][number],
  first: MainlineObjectGeometry | undefined,
  second: MainlineObjectGeometry | undefined,
): NavigationBarrierSegment | null {
  const firstBox = first?.collision
  const secondBox = second?.collision
  if (!firstBox || !secondBox) return null

  const overlapXStart = Math.max(firstBox.x, secondBox.x)
  const overlapXEnd = Math.min(firstBox.x + firstBox.width, secondBox.x + secondBox.width)
  const overlapYStart = Math.max(firstBox.y, secondBox.y)
  const overlapYEnd = Math.min(firstBox.y + firstBox.height, secondBox.y + secondBox.height)

  if (overlapXEnd > overlapXStart) {
    const upper = first.position.y <= second.position.y ? firstBox : secondBox
    const lower = upper === firstBox ? secondBox : firstBox
    const gapStart = upper.y + upper.height
    const gapEnd = lower.y
    if (gapEnd > gapStart) {
      const y = (gapStart + gapEnd) / 2
      return { id: relation.id, start: { x: overlapXStart, y }, end: { x: overlapXEnd, y } }
    }
  }

  if (overlapYEnd > overlapYStart) {
    const left = first.position.x <= second.position.x ? firstBox : secondBox
    const right = left === firstBox ? secondBox : firstBox
    const gapStart = left.x + left.width
    const gapEnd = right.x
    if (gapEnd > gapStart) {
      const x = (gapStart + gapEnd) / 2
      return { id: relation.id, start: { x, y: overlapYStart }, end: { x, y: overlapYEnd } }
    }
  }

  // Diagonal pairs have no shared axis. Join only their nearest visual
  // corners; do not manufacture an invisible furniture-group rectangle.
  const nearestPoint = (box: CollisionBox, target: Point): Point => ({
    x: Math.max(box.x, Math.min(target.x, box.x + box.width)),
    y: Math.max(box.y, Math.min(target.y, box.y + box.height)),
  })
  const firstPoint = nearestPoint(firstBox, second.position)
  const secondPoint = nearestPoint(secondBox, first.position)
  if (firstPoint.x === secondPoint.x && firstPoint.y === secondPoint.y) return null
  return { id: relation.id, start: firstPoint, end: secondPoint }
}

/** Access regions remain semantic areas; only their declared open edge becomes a route-crossing rule. */
function accessBoundaryBarrier(
  scene: MainlineSceneDefinition,
  boundary: MainlineSceneDefinition['accessBoundaries'][number],
): NavigationBarrierSegment | null {
  const region = scene.accessRegions.find((candidate) => candidate.id === boundary.regionId)
  if (!region) return null
  const start = boundary.edge === 'top'
    ? { x: region.x, y: region.y }
    : boundary.edge === 'right'
      ? { x: region.x + region.width, y: region.y }
      : boundary.edge === 'bottom'
        ? { x: region.x + region.width, y: region.y + region.height }
        : { x: region.x, y: region.y + region.height }
  const end = boundary.edge === 'top'
    ? { x: region.x + region.width, y: region.y }
    : boundary.edge === 'right'
      ? { x: region.x + region.width, y: region.y + region.height }
      : boundary.edge === 'bottom'
        ? { x: region.x, y: region.y + region.height }
        : { x: region.x, y: region.y }
  return {
    id: boundary.id,
    start,
    end,
    kind: 'access-boundary',
    regionId: region.id,
    requiredAccess: region.requiredAccess,
  }
}

function minMax(values: readonly number[], fallback: number) {
  if (values.length === 0) return { min: fallback, max: fallback }
  return { min: Math.min(...values), max: Math.max(...values) }
}

function wallFeatureGeometry(
  scene: MainlineSceneDefinition,
  units: readonly MainlineSceneGeometryUnit[],
  entityId: string,
  featureId: string,
): MainlineWallFeatureGeometry | null {
  const feature = scene.structures
    .flatMap((structure) => (structure.features ?? []).map((candidate) => ({ structure, feature: candidate })))
    .find(({ feature: candidate }) => candidate.id === featureId && candidate.entityId === entityId)
  if (!feature) return null

  const cells = units.flatMap((unit) => unit.visual.cells
    .filter((cell) => cell.kind === 'feature' && cell.featureId === featureId)
    .map((cell) => ({ unit, cell })))
  const edge = feature.feature.edge
  const horizontal = edge === 'top' || edge === 'bottom'
  if (cells.length === 0) return null

  const axisValues = cells.flatMap(({ cell }) => [cell.cellStart ?? cell.x, cell.cellEnd ?? cell.x])
  const axis = minMax(axisValues, (feature.feature.start + feature.feature.end) / 2)
  const start = axis.min
  const end = Math.max(start, axis.max)
  const lineValues = cells.map(({ cell }) => horizontal ? cell.y : cell.x)
  const line = lineValues.reduce((sum, value) => sum + value, 0) / lineValues.length
  const thickness = 1.4
  const bounds = horizontal
    ? { x: start, y: line - thickness / 2, width: Math.max(.001, end - start), height: thickness }
    : { x: line - thickness / 2, y: start, width: thickness, height: Math.max(.001, end - start) }
  const position = horizontal
    ? { x: (start + end) / 2, y: line }
    : { x: line, y: (start + end) / 2 }
  return { entityId, featureId, edge, bounds, position }
}

export function createMainlineSceneGeometrySnapshot(
  scene: MainlineSceneDefinition,
  position: Point,
  layout: SceneLayout = {},
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
  storefrontPresentation?: ReadonlyMap<string, StorefrontPresentationPhase>,
): MainlineSceneGeometrySnapshot {
  const units = mainlineSceneGeometryUnits(scene, position, screenMetrics, storefrontPresentation)
  const objects = new Map<string, MainlineObjectGeometry>()
  scene.objects.forEach((entity) => {
    objects.set(entity.id, {
      entityId: entity.id,
      position: mainlineEntityPosition(scene, entity, layout, screenMetrics),
      interactionBounds: mainlineEntityInteractionBounds(scene, entity, layout, screenMetrics),
      visualBounds: mainlineEntityVisualBounds(scene, entity, layout, screenMetrics),
      collision: mainlineEntityCollision(scene, entity, layout, screenMetrics),
    })
  })

  const wallFeatures = new Map<string, MainlineWallFeatureGeometry>()
  scene.structures.forEach((structure) => {
    structure.features?.forEach((feature) => {
      if (!feature.entityId) return
      const resolved = wallFeatureGeometry(scene, units, feature.entityId, feature.id)
      if (resolved) wallFeatures.set(feature.entityId, resolved)
    })
  })

  const passages = new Map<string, MainlinePassageGeometrySnapshot>()
  scene.passages.forEach((passage) => {
    const collision = mainlineScenePassageCollision(scene, passage.id, screenMetrics) ?? passage.collision
    const doorway = mainlineScenePassageDoorway(scene, passage.id, screenMetrics) ?? passage.doorway
    passages.set(passage.id, { passage, collision, doorway })
  })
  const navigationBarriers = [
    ...scene.navigationBarriers
    .map((relation) => relationBarrier(relation, objects.get(relation.firstEntityId), objects.get(relation.secondEntityId)))
    .filter((barrier): barrier is NavigationBarrierSegment => Boolean(barrier)),
    ...scene.accessBoundaries
      .map((boundary) => accessBoundaryBarrier(scene, boundary))
      .filter((barrier): barrier is NavigationBarrierSegment => Boolean(barrier)),
  ]

  return {
    sceneId: scene.id,
    position,
    layout,
    screenMetrics,
    walkBounds: mainlineSceneWalkBounds(scene, screenMetrics),
    units,
    objects,
    wallFeatures,
    passages,
    navigationBarriers,
  }
}
