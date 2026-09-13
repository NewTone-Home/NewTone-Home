import type { CollisionBox, Point } from './sceneGeometry'
import type { MainlineSceneDefinition, MainlineSceneEntity } from './mainlineScenes'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'

export type LayoutItemId = string
export type SceneLayout = Readonly<Record<LayoutItemId, Point>>
export type LayoutSceneEntity = {
  id: string
  position: Point
  groupId?: string
  layoutItemId?: string | null
  interactive?: boolean
  collision?: CollisionBox
}
export type LayoutSceneGroup = {
  id: string
  anchor: Point
  entityIds: readonly string[]
}
export type LayoutSceneDefinition = {
  objects: readonly LayoutSceneEntity[]
  furnitureGroups: readonly LayoutSceneGroup[]
}

export const layoutGridSize = 4
const layoutBounds = { minX: 8, maxX: 92, minY: 8, maxY: 84 }

function subtractPoint(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y }
}

export function snapPoint(point: Point, grid = layoutGridSize): Point {
  return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid }
}

export function snapDelta(delta: Point, grid = layoutGridSize): Point {
  return { x: Math.round(delta.x / grid) * grid, y: Math.round(delta.y / grid) * grid }
}

export function clampLayoutAnchor(point: Point): Point {
  return {
    x: Math.max(layoutBounds.minX, Math.min(layoutBounds.maxX, point.x)),
    y: Math.max(layoutBounds.minY, Math.min(layoutBounds.maxY, point.y)),
  }
}

export function snapLayoutAnchor(point: Point): Point {
  return clampLayoutAnchor(snapPoint(point))
}

/**
 * Scene-agnostic layout contract. Mainline scenery exposes an absolute group
 * anchor and derives every member from that anchor.
 */
export function layoutItemForSceneEntity(scene: LayoutSceneDefinition, entityId: string): LayoutItemId | null {
  const entity = scene.objects.find((candidate) => candidate.id === entityId)
  if (!entity || entity.interactive === false) return null
  if (entity.layoutItemId !== undefined) return entity.layoutItemId
  return entity.groupId ?? scene.furnitureGroups.find((group) => group.entityIds.includes(entityId))?.id ?? entity.id
}

export function sceneLayoutBaseAnchor(scene: LayoutSceneDefinition, itemId: LayoutItemId): Point | null {
  return scene.furnitureGroups.find((group) => group.id === itemId)?.anchor
    ?? scene.objects.find((entity) => entity.id === itemId)?.position
    ?? null
}

export function sceneLayoutAnchor(scene: LayoutSceneDefinition, itemId: LayoutItemId, layout: SceneLayout): Point | null {
  return layout[itemId] ?? sceneLayoutBaseAnchor(scene, itemId)
}

export function sceneLayoutOffsetForItem(scene: LayoutSceneDefinition, itemId: LayoutItemId, layout: SceneLayout): Point {
  const anchor = sceneLayoutAnchor(scene, itemId, layout)
  const base = sceneLayoutBaseAnchor(scene, itemId)
  return anchor && base ? subtractPoint(anchor, base) : { x: 0, y: 0 }
}

export function sceneLayoutOffsetForEntity(scene: LayoutSceneDefinition, entityId: string, layout: SceneLayout): Point {
  const itemId = layoutItemForSceneEntity(scene, entityId)
  return itemId ? sceneLayoutOffsetForItem(scene, itemId, layout) : { x: 0, y: 0 }
}

export function sceneLayoutEntityPosition(scene: LayoutSceneDefinition, entity: LayoutSceneEntity, layout: SceneLayout): Point {
  const offset = sceneLayoutOffsetForEntity(scene, entity.id, layout)
  return { x: entity.position.x + offset.x, y: entity.position.y + offset.y }
}

export function sceneLayoutEntityCollision(scene: LayoutSceneDefinition, entity: LayoutSceneEntity & { collision?: CollisionBox }, layout: SceneLayout): CollisionBox | null {
  if (!entity.collision) return null
  const offset = sceneLayoutOffsetForEntity(scene, entity.id, layout)
  return { ...entity.collision, x: entity.collision.x + offset.x, y: entity.collision.y + offset.y }
}

export function mainlineLayoutItemForEntity(scene: MainlineSceneDefinition, entityId: string): LayoutItemId | null {
  return layoutItemForSceneEntity(scene, entityId)
}

export function mainlineBaseLayoutAnchor(scene: MainlineSceneDefinition, itemId: LayoutItemId): Point | null {
  return sceneLayoutBaseAnchor(scene, itemId)
}

export function mainlineLayoutAnchor(scene: MainlineSceneDefinition, itemId: LayoutItemId, layout: SceneLayout): Point | null {
  return sceneLayoutAnchor(scene, itemId, layout)
}

export function clampMainlineLayoutAnchor(scene: MainlineSceneDefinition, point: Point): Point {
  const bounds = scene.walkBounds
  return {
    x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, point.x)),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, point.y)),
  }
}

export function mainlineLayoutOffsetForItem(scene: MainlineSceneDefinition, itemId: LayoutItemId, layout: SceneLayout): Point {
  return sceneLayoutOffsetForItem(scene, itemId, layout)
}

export function mainlineLayoutOffsetForEntity(scene: MainlineSceneDefinition, entityId: string, layout: SceneLayout): Point {
  return sceneLayoutOffsetForEntity(scene, entityId, layout)
}

export function mainlineEntityPosition(
  scene: MainlineSceneDefinition,
  entity: MainlineSceneEntity,
  layout: SceneLayout,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): Point {
  const authoredPosition = sceneLayoutEntityPosition(scene, entity, layout)
  if (entity.surface !== 'floor' || !isNarrowMainlineViewport(screenMetrics)) return authoredPosition

  const groupId = entity.groupId
  if (groupId) {
    const group = scene.furnitureGroups.find((candidate) => candidate.id === groupId)
    const members = scene.objects.filter((candidate) => candidate.surface === 'floor' && candidate.groupId === groupId)
    if (group && members.length > 1) {
      const anchor = sceneLayoutAnchor(scene, groupId, layout) ?? group.anchor
      const scale = responsiveFurnitureScale(members, scene, layout, anchor, screenMetrics)
      return {
        x: anchor.x + (authoredPosition.x - anchor.x) * scale.x,
        y: anchor.y + (authoredPosition.y - anchor.y) * scale.y,
      }
    }
  }

  const sameRowCounters = scene.objects
    .filter((candidate) => candidate.surface === 'floor' && candidate.kind === 'fixture' && candidate.label === entity.label)
    .map((candidate) => ({ entity: candidate, position: sceneLayoutEntityPosition(scene, candidate, layout) }))
    .filter(({ position }) => Math.abs(position.y - authoredPosition.y) < .001)
    .sort((first, second) => first.position.x - second.position.x)

  if (sameRowCounters.length > 1 && entity.label === '柜台') {
    const index = sameRowCounters.findIndex(({ entity: candidate }) => candidate.id === entity.id)
    if (index >= 0) return responsiveRowPosition(sameRowCounters, index, scene, screenMetrics)
  }

  return authoredPosition
}

function mainlineEntityUsesVerticalText(entity: MainlineSceneEntity) {
  return (entity.kind === 'table' || entity.kind === 'seat') && (entity.facing === 'east' || entity.facing === 'west')
}

export function mainlineEntityFontSizePx(_entity: MainlineSceneEntity, screenMetrics: SceneScreenMetrics) {
  // Keep the interaction footprint in lockstep with the mainline object CSS.
  // The rendered object consumes the same measured stage-width basis through
  // a CSS custom property. This keeps the footprint and focus frame aligned
  // on responsive landscape tablet layouts as well as portrait layouts.
  return Math.max(9, Math.min(16, screenMetrics.width * .0115))
}

function isNarrowMainlineViewport(screenMetrics: SceneScreenMetrics) {
  return Math.min(screenMetrics.width, screenMetrics.height) <= 600
}

function responsiveFloorGapPercent(screenMetrics: SceneScreenMetrics, axis: 'x' | 'y') {
  const axisSize = axis === 'x' ? screenMetrics.width : screenMetrics.height
  return 200 / Math.max(1, axisSize)
}

function responsiveFurnitureScale(
  members: readonly MainlineSceneEntity[],
  scene: MainlineSceneDefinition,
  layout: SceneLayout,
  anchor: Point,
  screenMetrics: SceneScreenMetrics,
) {
  const positions = members.map((member) => ({
    entity: member,
    position: sceneLayoutEntityPosition(scene, member, layout),
  }))
  const gapX = responsiveFloorGapPercent(screenMetrics, 'x')
  const gapY = responsiveFloorGapPercent(screenMetrics, 'y')
  let scaleX = 1
  let scaleY = 1

  for (let firstIndex = 0; firstIndex < positions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < positions.length; secondIndex += 1) {
      const first = positions[firstIndex]
      const second = positions[secondIndex]
      const firstFootprint = mainlineEntityTextFootprint(first.entity, first.position, screenMetrics)
      const secondFootprint = mainlineEntityTextFootprint(second.entity, second.position, screenMetrics)
      const xDistance = Math.abs(second.position.x - first.position.x)
      const yDistance = Math.abs(second.position.y - first.position.y)
      if (xDistance > .001) {
        const yOverlap = yDistance < (firstFootprint.height + secondFootprint.height) / 2
        if (yOverlap) scaleX = Math.max(scaleX, (firstFootprint.width + secondFootprint.width + gapX) / (xDistance * 2))
      }
      if (yDistance > .001) {
        const xOverlap = xDistance < (firstFootprint.width + secondFootprint.width) / 2
        if (xOverlap) scaleY = Math.max(scaleY, (firstFootprint.height + secondFootprint.height + gapY) / (yDistance * 2))
      }
    }
  }

  return { x: scaleX, y: scaleY }
}

function responsiveRowPosition(
  row: readonly { entity: MainlineSceneEntity; position: Point }[],
  index: number,
  scene: MainlineSceneDefinition,
  screenMetrics: SceneScreenMetrics,
) {
  const footprint = mainlineEntityTextFootprint(row[index].entity, row[index].position, screenMetrics)
  const gap = responsiveFloorGapPercent(screenMetrics, 'x')
  const minPitch = footprint.width + gap
  const bounds = scene.walkBounds
  const availableSpan = Math.max(0, bounds.width - footprint.width)
  const authoredSpan = row[row.length - 1].position.x - row[0].position.x
  const span = Math.min(availableSpan, Math.max(authoredSpan, minPitch * (row.length - 1)))
  const firstX = Math.max(bounds.x + footprint.width / 2, Math.min(
    bounds.x + bounds.width - footprint.width / 2 - span,
    (row[0].position.x + row[row.length - 1].position.x) / 2 - span / 2,
  ))
  return { x: firstX + (span / Math.max(1, row.length - 1)) * index, y: row[index].position.y }
}

/**
 * Floor interaction stays anchored to the visible characters. Most scenery
 * uses that same footprint for navigation, while authored furniture can opt
 * into its physical collision for locomotion. Wall entities stay on the
 * canonical boundary path.
 */
export function mainlineEntityTextFootprint(
  entity: MainlineSceneEntity,
  position: Point,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): CollisionBox {
  const glyphCount = Math.max(1, Array.from(entity.label).length)
  const fontSizePx = mainlineEntityFontSizePx(entity, screenMetrics)
  const vertical = mainlineEntityUsesVerticalText(entity)
  const letterSpacingPx = 0
  const widthPx = vertical ? fontSizePx : glyphCount * fontSizePx + Math.max(0, glyphCount - 1) * letterSpacingPx
  const heightPx = vertical ? glyphCount * fontSizePx : fontSizePx * (entity.kind === 'table' || entity.kind === 'seat' ? 1 : 1.2)
  const scale = Number.isFinite(entity.visualScale) && (entity.visualScale ?? 0) > 0 ? entity.visualScale! : 1
  const width = Number(((widthPx * scale / screenMetrics.width) * 100).toFixed(4))
  const height = Number(((heightPx * scale / screenMetrics.height) * 100).toFixed(4))
  return {
    x: Number((position.x - width / 2).toFixed(4)),
    y: Number((position.y - height / 2).toFixed(4)),
    width,
    height,
  }
}

export function mainlineEntityCollision(
  scene: MainlineSceneDefinition,
  entity: MainlineSceneEntity,
  layout: SceneLayout,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): CollisionBox | null {
  if (!entity.collision) return null
  if (entity.surface === 'floor') {
    if (entity.movementCollision === 'physical') {
      const layoutOffset = mainlineLayoutOffsetForEntity(scene, entity.id, layout)
      const authoredPosition = {
        x: entity.position.x + layoutOffset.x,
        y: entity.position.y + layoutOffset.y,
      }
      const actualPosition = mainlineEntityPosition(scene, entity, layout, screenMetrics)
      const collision = sceneLayoutEntityCollision(scene, entity, layout)
      if (!collision) return null
      return {
        ...collision,
        x: collision.x + actualPosition.x - authoredPosition.x,
        y: collision.y + actualPosition.y - authoredPosition.y,
      }
    }
    return mainlineEntityTextFootprint(entity, mainlineEntityPosition(scene, entity, layout, screenMetrics), screenMetrics)
  }
  return sceneLayoutEntityCollision(scene, entity, layout)
}

export function mainlineEntityInteractionBounds(
  scene: MainlineSceneDefinition,
  entity: MainlineSceneEntity,
  layout: SceneLayout,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): CollisionBox | null {
  if (entity.surface !== 'floor' || entity.interactive === false) return null
  return mainlineEntityTextFootprint(entity, mainlineEntityPosition(scene, entity, layout, screenMetrics), screenMetrics)
}

/**
 * Visual occupancy is intentionally separate from movement collision. A prop
 * can remain walk-through while still reserving the pixels it occupies for
 * scene-anchored text.
 */
export function mainlineEntityVisualBounds(
  scene: MainlineSceneDefinition,
  entity: MainlineSceneEntity,
  layout: SceneLayout,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): CollisionBox | null {
  if (entity.surface !== 'floor' || entity.visible === false) return null
  const offset = mainlineLayoutOffsetForEntity(scene, entity.id, layout)
  if (entity.visualBounds) {
    return {
      ...entity.visualBounds,
      x: entity.visualBounds.x + offset.x,
      y: entity.visualBounds.y + offset.y,
    }
  }
  return mainlineEntityTextFootprint(entity, mainlineEntityPosition(scene, entity, layout, screenMetrics), screenMetrics)
}

export function mainlineEntityShape(
  scene: MainlineSceneDefinition,
  entity: MainlineSceneEntity,
  layout: SceneLayout,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): CollisionBox | null {
  if (!entity.shape) return null
  if (entity.surface === 'floor') return mainlineEntityCollision(scene, entity, layout, screenMetrics)
  const offset = mainlineLayoutOffsetForEntity(scene, entity.id, layout)
  return { ...entity.shape, x: entity.shape.x + offset.x, y: entity.shape.y + offset.y }
}
