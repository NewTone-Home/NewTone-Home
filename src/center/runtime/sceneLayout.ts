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
  if (entity.surface !== 'floor') return authoredPosition
  const altar = scene.furnitureGroups.find(group => group.id === entity.groupId && group.layout === 'altar-ring')
  if (altar) {
    const anchor = sceneLayoutAnchor(scene, altar.id, layout) ?? altar.anchor
    const burner = scene.objects.find(member => member.groupId === altar.id && member.kind !== 'table')
    const verticalTable = scene.objects.find(member => member.groupId === altar.id && member.kind === 'table' && Math.abs(member.position.x - altar.anchor.x) < .001)
    if (burner && verticalTable && Math.abs(authoredPosition.x - anchor.x) > .001) {
      const vertical = mainlineEntityTextFootprint(verticalTable, verticalTable.position, screenMetrics)
      const vessel = mainlineEntityTextFootprint(burner, burner.position, screenMetrics)
      const horizontal = mainlineEntityTextFootprint(entity, authoredPosition, screenMetrics)
      const gapPx = Math.abs(verticalTable.position.y - altar.anchor.y) * screenMetrics.height / 100 - (vertical.height + vessel.height) * screenMetrics.height / 200
      const distance = (gapPx + (horizontal.width + vessel.width) * screenMetrics.width / 200) * 100 / screenMetrics.width
      return { x: anchor.x + Math.sign(authoredPosition.x - anchor.x) * distance, y: authoredPosition.y }
    }
    return authoredPosition
  }
  return authoredPosition
}

function mainlineEntityUsesVerticalText(entity: MainlineSceneEntity) {
  return (entity.kind === 'table' || entity.kind === 'seat') && (entity.facing === 'east' || entity.facing === 'west')
}

export function mainlineEntityFontSizePx(_entity: MainlineSceneEntity | null, screenMetrics: SceneScreenMetrics) {
  // Keep the interaction footprint in lockstep with the mainline object CSS.
  // The rendered object consumes the same measured stage-width basis through
  // a CSS custom property. This keeps the footprint and focus frame aligned
  // on responsive landscape tablet layouts as well as portrait layouts.
  return Math.max(9, Math.min(16, screenMetrics.width * .0115))
}

/**
 * The renderer-facing source of truth for one text label. Phase 0 deliberately
 * keeps this separate from movement collision so each later migration can
 * replace an old collision owner with a measured visual footprint explicitly.
 */
export function mainlineLabelFootprint(
  label: string,
  position: Point,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
  options: { vertical?: boolean; visualScale?: number; lineHeight?: number } = {},
): CollisionBox {
  const glyphCount = Math.max(1, Array.from(label).length)
  const fontSizePx = mainlineEntityFontSizePx(null, screenMetrics)
  const vertical = options.vertical ?? false
  const lineHeight = options.lineHeight ?? (vertical ? 1 : 1.2)
  const scale = Number.isFinite(options.visualScale) && (options.visualScale ?? 0) > 0 ? options.visualScale! : 1
  const widthPx = vertical ? fontSizePx : glyphCount * fontSizePx
  const heightPx = vertical ? glyphCount * fontSizePx : fontSizePx * lineHeight
  const width = Number(((widthPx * scale / screenMetrics.width) * 100).toFixed(4))
  const height = Number(((heightPx * scale / screenMetrics.height) * 100).toFixed(4))
  return {
    x: Number((position.x - width / 2).toFixed(4)),
    y: Number((position.y - height / 2).toFixed(4)),
    width,
    height,
  }
}

/** The walking marker is a real 11px square, not a hidden navigation radius. */
export function mainlineProtagonistDotFootprint(
  position: Point,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): CollisionBox {
  const sizePx = 11
  const width = Number(((sizePx / screenMetrics.width) * 100).toFixed(4))
  const height = Number(((sizePx / screenMetrics.height) * 100).toFixed(4))
  return { x: position.x - width / 2, y: position.y - height / 2, width, height }
}

export function mainlineEntityTextFootprint(
  entity: MainlineSceneEntity,
  position: Point,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): CollisionBox {
  return mainlineLabelFootprint(entity.label, position, screenMetrics, {
    vertical: mainlineEntityUsesVerticalText(entity),
    visualScale: entity.visualScale,
    lineHeight: entity.kind === 'table' || entity.kind === 'seat' ? 1 : 1.2,
  })
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
