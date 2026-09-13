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
import type { CollisionBox, Point } from './sceneGeometry'
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
): MainlineSceneGeometrySnapshot {
  const units = mainlineSceneGeometryUnits(scene, position, screenMetrics)
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
  }
}
