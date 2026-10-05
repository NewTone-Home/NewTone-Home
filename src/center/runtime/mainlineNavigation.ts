import { createPoint, defaultEdgeContactDirection, mainlineWallThickness, type CollisionBox, type Point } from './sceneGeometry'
import { mainlineScenePassageCollision, mainlineScenePassageDoorway, mainlineStorefrontInteractionCandidates, mainlineStorefrontInteractionRegion, type MainlineStorefrontSlot, type MainlineSceneAccessRegion, type MainlineSceneDefinition, type MainlineSceneId, type MainlineScenePassage } from './mainlineScenes'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineEntityCollision, mainlineLabelFootprint, mainlineLayoutOffsetForEntity, mainlineProtagonistDotFootprint, type SceneLayout } from './sceneLayout'
import { createMainlineSceneGeometrySnapshot, type MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { canTravelAlongSegment, edgeContactPoint, findNavigationPath, navigationActorBox, resolveNavigationPath, sharedNavigationTraversalStep, type NavigationActorFootprint, type NavigationRuntime } from './navigationCore'
import { createPolygonNavigationMesh, navigationBarriersAllowTravel, type PolygonNavigationMesh } from './scenePathfinding'
import { containsDoorRegion, doorRegionSide, doorwayBoundaryPoint, doorwayLegalTangent, isDoorTargetBehind, type DoorPassageRegion, type DoorRegionNormal } from './doorPassageModel'
import { sharedFurnitureGeometry } from './twoSeatFurniture'
import { mainlineNpcStagedInteractionContactEntityId, mainlineNpcStagedPoint, mainlineNpcStagedSeatId } from './mainlineNpcStaging'

export type MainlineNavigationOptions = {
  actorRadius?: number
  /** Current rendered actor dimensions, shared by occupancy and path planning. */
  actorFootprint?: NavigationActorFootprint
  actorId?: string
  /** Optional shared registry for NPC/protagonist dynamic occupancy. */
  navigationRuntime?: NavigationRuntime
  /** The canonical lifecycle set; entity ids are only renderer-facing data. */
  openPassageIds?: ReadonlySet<string>
  /** The measured stage dimensions used by the shared scene projection. */
  screenMetrics?: SceneScreenMetrics
  /** One screen-specific geometry transaction shared by render and navigation. */
  geometrySnapshot?: MainlineSceneGeometrySnapshot
  /** Live NPC positions override their authored staging placements. */
  npcRuntimePositions?: ReadonlyMap<string, Point>
  /** Hidden occupied chairs do not remain a second static obstacle. */
  occupiedSeatIds?: ReadonlySet<string>
}

function footprintFromBox(box: CollisionBox): NavigationActorFootprint {
  return { width: box.width, height: box.height }
}

type CachedNavigationMesh = {
  key: string
  mesh: PolygonNavigationMesh
}

// Geometry snapshots are immutable render/navigation transactions. Reusing
// their static mesh keeps multiple contact candidates in one interaction from
// recompiling the same scene, without caching dynamic actor occupancy.
const physicalIntentMeshCache = new WeakMap<PolygonNavigationMesh, PolygonNavigationMesh>()
const staticNavigationMeshCache = new WeakMap<MainlineSceneGeometrySnapshot, Map<string, CachedNavigationMesh>>()

function cacheStaticNavigationMesh(snapshot: MainlineSceneGeometrySnapshot, key: string, mesh: PolygonNavigationMesh) {
  const meshes = staticNavigationMeshCache.get(snapshot) ?? new Map<string, CachedNavigationMesh>()
  meshes.set(key, { key, mesh })
  staticNavigationMeshCache.set(snapshot, meshes)
}

// Compatibility-only default for non-Page callers: it is the renderer's
// default walking-dot footprint, not a second navigation radius.
const defaultActorFootprint = footprintFromBox(mainlineProtagonistDotFootprint(createPoint(0, 0)))

function mainlineActorFootprint(scene: MainlineSceneDefinition, options: MainlineNavigationOptions, position: Point): NavigationActorFootprint {
  if (options.actorFootprint) return options.actorFootprint
  // Compatibility callers may still provide a scalar. It is immediately
  // converted to the same rectangular footprint used by every route check.
  if (options.actorRadius !== undefined) return { width: options.actorRadius * 2, height: options.actorRadius * 2 }
  const metrics = options.screenMetrics
  const npc = options.actorId ? scene.npcs.find((candidate) => candidate.id === options.actorId) : undefined
  if (npc) return footprintFromBox(mainlineLabelFootprint(npc.label, position, metrics, { lineHeight: 1 }))
  return footprintFromBox(mainlineProtagonistDotFootprint(position, metrics))
}

function normalClearance(footprint: NavigationActorFootprint, axis: 'x' | 'y') {
  return axis === 'x' ? footprint.width / 2 : footprint.height / 2
}

function tangentClearance(footprint: NavigationActorFootprint, axis: 'x' | 'y') {
  return axis === 'x' ? footprint.height / 2 : footprint.width / 2
}

function insetBounds(bounds: CollisionBox, footprint: NavigationActorFootprint): CollisionBox {
  return {
    x: bounds.x + footprint.width / 2,
    y: bounds.y + footprint.height / 2,
    width: bounds.width - footprint.width,
    height: bounds.height - footprint.height,
  }
}

export function mainlinePassageCollisionForNavigation(scene: MainlineSceneDefinition, passage: MainlineScenePassage, options: MainlineNavigationOptions = {}) {
  const snapshot = options.geometrySnapshot?.sceneId === scene.id ? options.geometrySnapshot : undefined
  if (snapshot) return snapshot.passages.get(passage.id)?.collision ?? passage.collision
  return mainlineScenePassageCollision(scene, passage.id, options.screenMetrics) ?? passage.collision
}

export function mainlinePassageDoorwayForNavigation(scene: MainlineSceneDefinition, passage: MainlineScenePassage, options: MainlineNavigationOptions = {}) {
  const snapshot = options.geometrySnapshot?.sceneId === scene.id ? options.geometrySnapshot : undefined
  if (snapshot) return snapshot.passages.get(passage.id)?.doorway ?? passage.doorway
  return mainlineScenePassageDoorway(scene, passage.id, options.screenMetrics) ?? passage.doorway
}

function sceneGeometrySnapshot(scene: MainlineSceneDefinition, layout: SceneLayout, options: MainlineNavigationOptions) {
  return options.geometrySnapshot?.sceneId === scene.id
    ? options.geometrySnapshot
    : createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition, layout, options.screenMetrics)
}

/** Current snapshot-owned relation barriers; they never become collision boxes. */
export function mainlineNavigationBarriers(scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const departureSeat = options.actorId ? mainlineNpcStagedSeatId(scene, options.actorId) : undefined
  const ownSeatOccupied = departureSeat && occupiedSeatIdsForNavigation(scene, options).has(departureSeat)
  return sceneGeometrySnapshot(scene, layout, options).navigationBarriers.filter((barrier) => {
    const relation = scene.navigationBarriers.find(candidate => candidate.id === barrier.id)
    // A seated actor owns departure from its own occupied chair. Other actors
    // retain the furniture relation, and a released chair is static again.
    if (ownSeatOccupied && relation && (relation.firstEntityId === departureSeat || relation.secondEntityId === departureSeat)) return false
    return barrier.kind !== 'access-boundary' || !barrier.requiredAccess || !actorAccessFor(scene, options.actorId).has(barrier.requiredAccess)
  })
}

/** Shared crossing legality for planning, contact resolution and live movement. */
export function isMainlineNavigationBarrierClear(
  start: Point,
  end: Point,
  scene: MainlineSceneDefinition,
  layout: SceneLayout = {},
  options: MainlineNavigationOptions = {},
) {
  return navigationBarriersAllowTravel(start, end, mainlineNavigationBarriers(scene, layout, options), mainlineActorFootprint(scene, options, start))
}

export function canTravelAlongMainlineSegment(
  start: Point,
  end: Point,
  scene: MainlineSceneDefinition,
  layout: SceneLayout = {},
  options: MainlineNavigationOptions = {},
  maxStep = sharedNavigationTraversalStep,
) {
  return isMainlineNavigationBarrierClear(start, end, scene, layout, options)
    && canTravelAlongSegment(start, end, (point) => isWalkableMainlinePoint(point, scene, layout, options), maxStep)
}

function overlaps(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

function expanded(box: { x: number; y: number; width: number; height: number }, radius: number) {
  return { x: box.x - radius, y: box.y - radius, width: box.width + radius * 2, height: box.height + radius * 2 }
}

function actorAccessFor(scene: MainlineSceneDefinition, actorId?: string) {
  return new Set(scene.actorAccess[actorId ?? 'protagonist'] ?? ['public'])
}

function actorCanEnterRegion(scene: MainlineSceneDefinition, actorId: string | undefined, region: MainlineSceneAccessRegion) {
  return actorAccessFor(scene, actorId).has(region.requiredAccess)
}

function occupiedSeatIdsForNavigation(scene: MainlineSceneDefinition, options: MainlineNavigationOptions) {
  if (options.occupiedSeatIds) return options.occupiedSeatIds
  return new Set(scene.npcs.flatMap((npc) => {
    const seatId = mainlineNpcStagedSeatId(scene, npc.id)
    return seatId ? [seatId] : []
  }))
}

function collisionBoxes(scene: MainlineSceneDefinition, layout: SceneLayout, options: MainlineNavigationOptions, includeDynamicActors = true) {
  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  const openPassageIds = options.openPassageIds
    ? new Set(scene.passages.filter((passage) => options.openPassageIds!.has(passage.id)).map((passage) => passage.id))
    : new Set<string>()
  // One collision compiler supplies route geometry and physical occupancy.
  // A closed passage stays a physical gate until its lifecycle marks it open;
  // planning may approach its boundary, but cannot plan through the doorway.
  const geometry = snapshot.units
  const staticBoxes = [
    ...geometry
      .filter((unit) => {
        if (!unit.navigation.blocked) return false
        const passageOpen = unit.navigation.passageId
          ? openPassageIds.has(unit.navigation.passageId)
          : unit.navigation.opensWithPassageId
            ? openPassageIds.has(unit.navigation.opensWithPassageId)
            : false
        const doorwayUnit = Boolean(unit.navigation.passageId && unit.entityId)
        // Storefront flanks stay walls in both visual variants. Only the
        // actual door cell is a portal; otherwise the route could bypass the
        // door through the whole five-cell near replacement.
        if (unit.navigation.passageId && !doorwayUnit) return true
        if (unit.navigation.passageId || unit.navigation.opensWithPassageId) return !passageOpen
        return true
      })
      .map((unit) => ({ x: unit.x, y: unit.y, width: unit.width, height: unit.height })),
    ...scene.objects
      .filter((entity) => entity.visible !== false && !(entity.kind === 'seat' && occupiedSeatIdsForNavigation(scene, options).has(entity.id)))
      .map((entity) => snapshot.objects.get(entity.id)?.collision ?? mainlineEntityCollision(scene, entity, layout, options.screenMetrics))
      .filter((collision): collision is NonNullable<typeof collision> => Boolean(collision)),
  ]
  const dynamicBoxes = includeDynamicActors ? options.navigationRuntime?.dynamicObstaclesFor(options.actorId) ?? [] : []
  return [...staticBoxes, ...dynamicBoxes]
}

export function mainlineNavigationCollisionBoxes(scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  return collisionBoxes(scene, layout, options)
}

export function isWalkableMainlinePoint(point: Point, scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const footprint = mainlineActorFootprint(scene, options, point)
  const bounds = insetBounds(sceneGeometrySnapshot(scene, layout, options).walkBounds, footprint)
  if (point.x < bounds.x || point.x > bounds.x + bounds.width || point.y < bounds.y || point.y > bounds.y + bounds.height) return false
  // Access is a semantic occupancy policy, never a physical scene obstacle.
  if (scene.accessRegions.some(region => !actorCanEnterRegion(scene, options.actorId, region) && containsPoint(region, point))) return false
  for (const boundary of scene.accessBoundaries) {
    const region = scene.accessRegions.find(candidate => candidate.id === boundary.regionId)
    if (!region || actorCanEnterRegion(scene, options.actorId, region)) continue
    const contact = accessBoundaryGeometry(region, boundary.edge, footprint)
    const tangent = point[contact.tangentAxis]
    if (tangent >= contact.min && tangent <= contact.max && (point[contact.axis] - contact.line) * contact.direction <= contact.clearance) return false
  }
  const actorBox = navigationActorBox(point, footprint)
  return collisionBoxes(scene, layout, options).every((collision) => !overlaps(actorBox, expanded(collision, 0)))
}

function distance(first: Point, second: Point) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function containsPoint(box: CollisionBox, point: Point) {
  return point.x >= box.x
    && point.x <= box.x + box.width
    && point.y >= box.y
    && point.y <= box.y + box.height
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

export function clampMainlineWalkTarget(point: Point, scene: MainlineSceneDefinition, actorFootprint: NavigationActorFootprint = defaultActorFootprint): Point {
  const bounds = insetBounds(scene.walkBounds, actorFootprint)
  return {
    x: clamp(point.x, bounds.x, bounds.x + bounds.width),
    y: clamp(point.y, bounds.y, bounds.y + bounds.height),
  }
}

function mainlineDoorThreshold(scene: MainlineSceneDefinition, position: Point, actorFootprint: NavigationActorFootprint): Point {
  const bounds = insetBounds(scene.walkBounds, actorFootprint)
  const insideBounds = position.x >= bounds.x
    && position.x <= bounds.x + bounds.width
    && position.y >= bounds.y
    && position.y <= bounds.y + bounds.height
  if (insideBounds) return position
  const candidates = [
    { x: bounds.x, y: clamp(position.y, bounds.y, bounds.y + bounds.height) },
    { x: bounds.x + bounds.width, y: clamp(position.y, bounds.y, bounds.y + bounds.height) },
    { x: clamp(position.x, bounds.x, bounds.x + bounds.width), y: bounds.y },
    { x: clamp(position.x, bounds.x, bounds.x + bounds.width), y: bounds.y + bounds.height },
  ]
  return candidates.reduce((closest, candidate) => distance(candidate, position) < distance(closest, position) ? candidate : closest)
}

function passageSide(passage: MainlineScenePassage, from: Point, collision = passage.collision, doorway = passage.doorway) {
  return doorRegionSide(mainlinePassageDoorRegion(passage, collision, doorway), from)
}

function passageNormalAxis(passage: MainlineScenePassage) {
  const threshold = passage.thresholds[0]
  const crossing = passage.crossingTargets[0]
  return Math.abs(crossing.x - threshold.x) >= Math.abs(crossing.y - threshold.y) ? 'x' as const : 'y' as const
}

function passageNormal(passage: MainlineScenePassage): DoorRegionNormal {
  const threshold = passage.thresholds[0]
  const crossing = passage.crossingTargets[0]
  const delta = passageNormalAxis(passage) === 'x'
    ? crossing.x - threshold.x
    : crossing.y - threshold.y
  return {
    axis: passageNormalAxis(passage),
    direction: delta >= 0 ? 1 : -1,
  }
}

/**
 * The collision rectangle is the canonical door opening. A passage sensor is
 * an area around that opening, expanded along the door normal while keeping
 * the opening's full span. It must not be reconstructed from the endpoint
 * points, because those points are movement references rather than a door
 * shape.
 */
/**
 * The detection corridor follows the complete doorway span and includes the
 * actor's lateral clearance. This lets a diagonal route enter the same door
 * without requiring the actor to hit the rendered glyph's centre pixel.
 */
export function mainlinePassageDetectionArea(
  passage: MainlineScenePassage,
  normalDepth = mainlinePassageDetectionDepth,
  collision = passage.collision,
  tangentPadding = tangentClearance(defaultActorFootprint, passageNormalAxis(passage)) + .24,
): CollisionBox {
  if (passageNormalAxis(passage) === 'x') {
    return {
      x: collision.x - normalDepth,
      y: collision.y - tangentPadding,
      width: collision.width + normalDepth * 2,
      height: collision.height + tangentPadding * 2,
    }
  }
  return {
    x: collision.x - tangentPadding,
    y: collision.y - normalDepth,
    width: collision.width + tangentPadding * 2,
    height: collision.height + normalDepth * 2,
  }
}

function passageBoundaryPoint(
  passage: MainlineScenePassage,
  from: Point,
  target: Point,
  actorFootprint: NavigationActorFootprint,
  collision = passage.collision,
  doorway = passage.doorway,
) {
  return doorwayBoundaryPoint(mainlinePassageDoorRegion(passage, collision, doorway, actorFootprint), from, target, actorFootprint)
}

/**
 * Resolve the first physically clear point on the far side of an opened
 * doorway. This is derived from the compiled collision rectangle, not from
 * an authored target and never becomes the player's destination marker.
 */
export function mainlinePassageExitPoint(passage: MainlineScenePassage, from: Point, actorFootprint: NavigationActorFootprint = defaultActorFootprint, collision = passage.collision, doorway = passage.doorway) {
  const side = passageSide(passage, from, collision, doorway)
  const normal = passageNormal(passage)
  const targetDirection = side === 1 ? -normal.direction : normal.direction
  const center = {
    x: doorway.x + doorway.width / 2,
    y: doorway.y + doorway.height / 2,
  }
  // The exit point belongs to the rendered doorway, not to the surrounding
  // passage collision union. The larger union could leave the target inside
  // the doorway on narrow responsive layouts.
  const halfDepth = normal.axis === 'x' ? doorway.width / 2 : doorway.height / 2
  const depth = halfDepth + normalClearance(actorFootprint, normal.axis) + .12
  const incoming = containsDoorRegion(from, mainlinePassageDoorRegion(passage, collision, doorway, actorFootprint).detection) ? from : center
  return normal.axis === 'x'
    ? { x: center.x + targetDirection * depth, y: doorwayLegalTangent(doorway, normal.axis, actorFootprint, incoming) }
    : { x: doorwayLegalTangent(doorway, normal.axis, actorFootprint, incoming), y: center.y + targetDirection * depth }
}

function passageInteriorPoint(passage: MainlineScenePassage, doorway: CollisionBox, actorFootprint: NavigationActorFootprint) {
  const region = mainlinePassageDoorRegion(passage, doorway, doorway)
  const center = {
    x: doorway.x + doorway.width / 2,
    y: doorway.y + doorway.height / 2,
  }
  const halfDepth = region.normal.axis === 'x' ? doorway.width / 2 : doorway.height / 2
  const depth = halfDepth + normalClearance(actorFootprint, region.normal.axis) + .12
  const inward = -region.normal.direction
  return region.normal.axis === 'x'
    ? { x: center.x + inward * depth, y: center.y }
    : { x: center.x, y: center.y + inward * depth }
}

function wallFeatureForEntity(scene: MainlineSceneDefinition, entityId: string) {
  for (const structure of scene.structures) {
    const feature = structure.features?.find((candidate) => candidate.entityId === entityId)
    if (feature && structure.bounds) return { structure, feature }
  }
  return null
}

/**
 * Wall features should be approached from the player's current side and at
 * the nearest point along the feature, rather than through one authored
 * approach coordinate shared by every direction.
 */
function wallFeatureInteractionTarget(scene: MainlineSceneDefinition, entityId: string, from: Point, actorFootprint: NavigationActorFootprint, snapshot?: MainlineSceneGeometrySnapshot) {
  const resolved = snapshot?.wallFeatures.get(entityId)
  if (resolved) {
    const horizontal = resolved.edge === 'top' || resolved.edge === 'bottom'
    const minimum = horizontal ? resolved.bounds.x : resolved.bounds.y
    const maximum = horizontal ? resolved.bounds.x + resolved.bounds.width : resolved.bounds.y + resolved.bounds.height
    const tangent = horizontal
      ? Math.max(minimum, Math.min(maximum, from.x))
      : Math.max(minimum, Math.min(maximum, from.y))
    const wallPoint = horizontal
      ? { x: tangent, y: resolved.position.y }
      : { x: resolved.position.x, y: tangent }
    const inwardDirection = resolved.edge === 'top' || resolved.edge === 'left' ? 1 : -1
    const clearance = mainlineWallThickness / 2 + normalClearance(actorFootprint, horizontal ? 'y' : 'x') + sharedFurnitureGeometry.actorContactGap
    return horizontal
      ? { x: wallPoint.x, y: wallPoint.y + inwardDirection * clearance }
      : { x: wallPoint.x + inwardDirection * clearance, y: wallPoint.y }
  }
  // A responsive snapshot is authoritative. If this wall feature was not
  // compiled into the current viewport, do not resurrect its authored
  // coordinate as an interaction target.
  if (snapshot) return null
  const located = wallFeatureForEntity(scene, entityId)
  if (!located) return null
  const { structure, feature } = located
  const bounds = structure.bounds!
  const horizontal = feature.edge === 'top' || feature.edge === 'bottom'
  const minimum = horizontal ? bounds.x : bounds.y
  const maximum = horizontal ? bounds.x + bounds.width : bounds.y + bounds.height
  const featureMinimum = Math.max(minimum, Math.min(maximum, feature.start))
  const featureMaximum = Math.max(featureMinimum, Math.min(maximum, feature.end))
  const tangent = horizontal
    ? Math.max(featureMinimum, Math.min(featureMaximum, from.x))
    : Math.max(featureMinimum, Math.min(featureMaximum, from.y))
  const wallPoint = horizontal
    ? { x: tangent, y: feature.edge === 'top' ? bounds.y : bounds.y + bounds.height }
    : { x: feature.edge === 'left' ? bounds.x : bounds.x + bounds.width, y: tangent }
  const inwardDirection = feature.edge === 'top' || feature.edge === 'left' ? 1 : -1
  const clearance = mainlineWallThickness / 2 + normalClearance(actorFootprint, horizontal ? 'y' : 'x') + sharedFurnitureGeometry.actorContactGap
  return horizontal
    ? { x: wallPoint.x, y: wallPoint.y + inwardDirection * clearance }
    : { x: wallPoint.x + inwardDirection * clearance, y: wallPoint.y }
}

function offsetFromPassageInterior(point: Point, normal: DoorRegionNormal, inwardDepth: number, tangentOffset: number): Point {
  if (normal.axis === 'x') return { x: point.x - normal.direction * inwardDepth, y: point.y + tangentOffset }
  return { x: point.x + tangentOffset, y: point.y - normal.direction * inwardDepth }
}

function appendUniquePoint(points: Point[], point: Point) {
  if (!points.some((candidate) => Math.abs(candidate.x - point.x) < .001 && Math.abs(candidate.y - point.y) < .001)) {
    points.push(point)
  }
}

/**
 * Resolve the target side of a cross-scene passage to a physically safe
 * landing point. Authored entryPosition remains the preferred anchor, but it
 * is never trusted without checking the target scene's projected geometry.
 * The resolver is shared by every scene pair so responsive geometry cannot
 * place the actor inside a door, wall, or floor object.
 */
export function resolveMainlineSafeEntryPosition(
  targetScene: MainlineSceneDefinition,
  sourceSceneId: MainlineSceneId,
  preferredEntry: Point | undefined,
  layout: SceneLayout = {},
  options: MainlineNavigationOptions = {},
  targetGeometry?: MainlineSceneGeometrySnapshot,
): Point | null {
  try {
    const targetOptions = { ...options, geometrySnapshot: targetGeometry?.sceneId === targetScene.id ? targetGeometry : sceneGeometrySnapshot(targetScene, layout, options) }
    const reversePassages = targetScene.passages.filter((passage) => passage.targetSceneId === sourceSceneId)
    const targetPassage = reversePassages
      .map((passage) => {
        const doorway = mainlinePassageDoorwayForNavigation(targetScene, passage, targetOptions)
        return { passage, doorway, distance: preferredEntry && doorway ? distance(preferredEntry, { x: doorway.x + doorway.width / 2, y: doorway.y + doorway.height / 2 }) : 0 }
      })
      .filter((candidate): candidate is { passage: MainlineScenePassage; doorway: CollisionBox; distance: number } => Boolean(candidate.doorway))
      .sort((first, second) => first.distance - second.distance)[0]

    if (!targetPassage) {
      return isWalkableMainlinePoint(targetScene.initialPlayerPosition, targetScene, layout, targetOptions)
        ? targetScene.initialPlayerPosition
        : null
    }

    const { passage, doorway } = targetPassage
    const region = mainlinePassageDoorRegion(
      passage,
      mainlinePassageCollisionForNavigation(targetScene, passage, targetOptions),
      doorway,
    )
    const interiorAnchor = passageInteriorPoint(passage, doorway, mainlineActorFootprint(targetScene, targetOptions, targetScene.initialPlayerPosition))
    const seeds = [
      ...(preferredEntry ? [preferredEntry] : []),
      interiorAnchor,
      ...passage.crossingTargets,
    ]
    const inwardDepths = [0, .35, .7, 1.2, 1.8, 2.6, 3.6]
    const tangentOffsets = [0, -.6, .6, -1.2, 1.2, -1.8, 1.8]
    const openedPassages = new Set(options.openPassageIds ?? [])
    openedPassages.add(passage.id)
    const continuationOptions = { ...targetOptions, openPassageIds: openedPassages }
    const candidates: Point[] = []

    for (const seed of seeds) {
      for (const inwardDepth of inwardDepths) {
        for (const tangentOffset of tangentOffsets) {
          appendUniquePoint(candidates, offsetFromPassageInterior(seed, region.normal, inwardDepth, tangentOffset))
        }
      }
    }

    for (const candidate of candidates) {
      if (!isWalkableMainlinePoint(candidate, targetScene, layout, targetOptions)) continue

      const localEscapePoints = inwardDepths.slice(2).map((depth) => offsetFromPassageInterior(candidate, region.normal, depth, 0))
      const hasLocalEscape = localEscapePoints.some((escapePoint) => (
        isWalkableMainlinePoint(escapePoint, targetScene, layout, continuationOptions)
        && Boolean(findMainlinePath(candidate, escapePoint, targetScene, layout, continuationOptions))
      ))
      const canReachScene = Boolean(findMainlinePath(candidate, targetScene.initialPlayerPosition, targetScene, layout, continuationOptions))
      if (hasLocalEscape || canReachScene) return candidate
    }

    return null
  } catch {
    // Geometry compilation errors must not spawn the actor into an unknown
    // location or turn a failed landing into a runtime crash.
    return null
  }
}

export function mainlinePassageForId(scene: MainlineSceneDefinition, passageId: string): MainlineScenePassage | undefined {
  return scene.passages.find((passage) => passage.id === passageId)
}

export function mainlinePassageIsAutomatic(scene: MainlineSceneDefinition, passage: MainlineScenePassage) {
  void scene
  void passage
  return true
}

export const mainlinePassageDetectionDepth = 2.8
/** The lifecycle doorway is the compiled door cell itself; no sensor halo. */
export const mainlinePassageDoorwayDepth = 0

export function mainlinePassageDoorRegion(
  passage: MainlineScenePassage,
  collision = passage.collision,
  doorway = collision === passage.collision ? passage.doorway : collision,
  actorFootprint: NavigationActorFootprint = defaultActorFootprint,
): DoorPassageRegion {
  return {
    doorway,
    detection: mainlinePassageDetectionArea(
      passage,
      mainlinePassageDetectionDepth,
      doorway,
      tangentClearance(actorFootprint, passageNormalAxis(passage)) + .24,
    ),
    normal: passageNormal(passage),
    crossingTargets: passage.crossingTargets,
    // A click is considered "behind" the door as soon as it lands on the
    // opposite side of the compiled doorway centre. The click mapper clamps
    // points to the scene frame, so requiring additional depth would reject a
    // valid target immediately beyond a boundary-mounted door.
    targetDepth: 0,
  }
}

/**
 * Validate any boot-time position, including positions restored from an old
 * URL or localStorage record. A stale doorway position is rejected and the
 * scene falls back to its authored safe point (or a validated doorway-side
 * candidate when the authored point itself is unavailable).
 */
export function resolveMainlineSafeSpawnPosition(
  scene: MainlineSceneDefinition,
  preferred: Point | undefined,
  layout: SceneLayout = {},
  options: MainlineNavigationOptions = {},
): Point | null {
  options = { ...options, geometrySnapshot: sceneGeometrySnapshot(scene, layout, options) }
  const candidates = [
    ...(preferred ? [preferred] : []),
    scene.initialPlayerPosition,
    ...scene.passages.flatMap((passage) => [
      passage.thresholds[0],
      passage.thresholds[1],
      passage.crossingTargets[0],
      passage.crossingTargets[1],
    ]),
  ]

  for (const candidate of candidates) {
    if (!isWalkableMainlinePoint(candidate, scene, layout, options)) continue
    if (candidate === scene.initialPlayerPosition) return candidate
    if (findMainlinePath(candidate, scene.initialPlayerPosition, scene, layout, options)) return candidate
  }

  return null
}

export function isMainlinePassageInDetectionZone(passage: MainlineScenePassage, point: Point, normalDepth = mainlinePassageDetectionDepth, collision = passage.collision, doorway = passage.doorway) {
  return containsDoorRegion(point, normalDepth === mainlinePassageDetectionDepth
    ? mainlinePassageDoorRegion(passage, collision, doorway).detection
    : mainlinePassageDetectionArea(passage, normalDepth, doorway))
}

export function isMainlinePassageInDoorwayZone(passage: MainlineScenePassage, point: Point, normalDepth = mainlinePassageDoorwayDepth, collision = passage.collision, doorway = passage.doorway) {
  return containsDoorRegion(point, normalDepth === mainlinePassageDoorwayDepth
    ? mainlinePassageDoorRegion(passage, collision, doorway).doorway
    : mainlinePassageDetectionArea(passage, normalDepth, doorway))
}

/**
 * True on the first movement segment that enters the actual doorway.
 *
 * Scene transitions use this boundary, not the farther crossing target. A
 * touch click can land only a few pixels beyond a door, especially on a
 * narrow viewport; waiting for the authored crossing target leaves the actor
 * parked inside the doorway when that target is not reachable.
 */
export function mainlinePassageEntersDoorway(
  passage: MainlineScenePassage,
  from: Point,
  to: Point,
  collision = passage.collision,
  doorway = passage.doorway,
) {
  const doorwayBox = mainlinePassageDoorRegion(passage, collision, doorway).doorway
  if (containsDoorRegion(from, doorwayBox)) return false
  if (containsDoorRegion(to, doorwayBox)) return true
  const interval = segmentBoxInterval(from, to, doorwayBox)
  return Boolean(interval && interval.entry <= 1 && interval.exit >= 0)
}

/**
 * Resolve the far-side crossing of a doorway. The approach leg can arrive
 * within movement tolerance already inside the doorway on a responsive
 * viewport, so crossing cannot depend only on an outside-to-inside event.
 */
export function mainlinePassageCrossesToSide(
  passage: MainlineScenePassage,
  from: Point,
  to: Point,
  targetSide: 0 | 1,
  collision = passage.collision,
  doorway = passage.doorway,
) {
  const region = mainlinePassageDoorRegion(passage, collision, doorway)
  if (doorRegionSide(region, to) !== targetSide) return false
  if (containsDoorRegion(from, region.doorway)) return true
  return doorRegionSide(region, from) !== targetSide
}

/**
 * The actor may occupy a short transit corridor while physically crossing an
 * open passage. This is movement-only geometry; lifecycle occupancy continues
 * to use the exact compiled doorway above.
 */
export function isMainlinePassageInTransitZone(passage: MainlineScenePassage, point: Point, actorFootprint: NavigationActorFootprint = defaultActorFootprint, doorway = passage.doorway) {
  const normal = passageNormal(passage)
  const normalInset = normalClearance(actorFootprint, normal.axis) + .12
  const tangentInset = tangentClearance(actorFootprint, normal.axis) + .12
  return containsPoint({
    x: doorway.x - (normal.axis === 'x' ? normalInset : tangentInset),
    y: doorway.y - (normal.axis === 'x' ? tangentInset : normalInset),
    width: doorway.width + (normal.axis === 'x' ? normalInset : tangentInset) * 2,
    height: doorway.height + (normal.axis === 'x' ? tangentInset : normalInset) * 2,
  }, point)
}

export type MainlineWorldRoute = {
  requestedTarget: Point
  /** The final point in the current scene or a destination scene. */
  target: Point
  /** The first movement leg. It ends at the passage boundary when a door event exists. */
  approachPath: Point[] | null
  passage?: MainlineScenePassage
  /**
   * The scene-frame owner for a same-side approach. This is route intent,
   * not a second lifecycle: the page feeds it into the existing movement
   * deadline and sceneFrameExit state.
   */
  framePassage?: MainlineScenePassage
  /** Ordered same-scene doors required to reach the target room. */
  passages: readonly MainlineScenePassage[]
  /** Authored room sequence used to select the door sequence. */
  roomIds?: readonly string[]
  /** The route after the passage, retained as the same plan rather than a new click. */
  continuationPath?: Point[] | null
}

function roomForPoint(scene: MainlineSceneDefinition, point: Point) {
  return scene.rooms.find((room) => pointInsideBounds(point, room.bounds))
}

/**
 * Build the authored room-to-room route before movement starts. Same-scene
 * office doors are graph edges; a locked edge is only usable as a terminal denial.
 */
export function findMainlineRoomPassageSequence(
  scene: MainlineSceneDefinition,
  from: Point,
  target: Point,
  layout: SceneLayout = {},
  options: MainlineNavigationOptions = {},
  requireReachableFirstPassage = false,
) {
  const startRoom = roomForPoint(scene, from)
  const targetRoom = roomForPoint(scene, target)
  if (!startRoom || !targetRoom || startRoom.id === targetRoom.id) return null

  const edges = scene.passages
    .filter((passage) => passage.routeThrough && !passage.targetSceneId && passage.fromRoomId && passage.toRoomId)
    .flatMap((passage) => [
      { from: passage.fromRoomId!, to: passage.toRoomId!, passage },
      { from: passage.toRoomId!, to: passage.fromRoomId!, passage },
    ])
  const queue = [startRoom.id]
  const previous = new Map<string, { roomId: string; passage: MainlineScenePassage }>()
  const visited = new Set(queue)
  while (queue.length > 0) {
    const roomId = queue.shift()!
    if (roomId === targetRoom.id) break
    for (const edge of edges.filter((candidate) => candidate.from === roomId)) {
      // A denied door is meaningful only as the destination's terminal edge.
      if (edge.passage.access !== 'open' && edge.to !== targetRoom.id) continue
      if (visited.has(edge.to)) continue
      visited.add(edge.to)
      previous.set(edge.to, { roomId, passage: edge.passage })
      queue.push(edge.to)
    }
  }
  if (!visited.has(targetRoom.id)) return null

  const passages: MainlineScenePassage[] = []
  const roomIds = [targetRoom.id]
  let cursor = targetRoom.id
  while (cursor !== startRoom.id) {
    const step = previous.get(cursor)
    if (!step) return null
    passages.unshift(step.passage)
    cursor = step.roomId
    roomIds.unshift(cursor)
  }
  // The first door is an actionable route leg, not merely an authored graph
  // edge. Later legs are checked again from their real post-crossing position
  // by the traversal runtime before they begin.
  if (requireReachableFirstPassage && !canActorReachPassageApproach(scene, passages[0]!, from, layout, options)) return null
  return { passages, roomIds }
}

function pointInsideBounds(point: Point, bounds: CollisionBox) {
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height
}

type SegmentBoxInterval = { entry: number; exit: number }

function segmentBoxInterval(start: Point, target: Point, box: CollisionBox): SegmentBoxInterval | null {
  let entry = 0
  let exit = 1
  const axes = [
    [start.x, target.x, box.x, box.x + box.width],
    [start.y, target.y, box.y, box.y + box.height],
  ] as const
  for (const [startValue, targetValue, minimum, maximum] of axes) {
    const delta = targetValue - startValue
    if (Math.abs(delta) <= 0.000001) {
      if (startValue < minimum || startValue > maximum) return null
      continue
    }
    const first = (minimum - startValue) / delta
    const second = (maximum - startValue) / delta
    entry = Math.max(entry, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
    if (entry > exit) return null
  }
  return { entry, exit }
}

/** Return the distance along a path where it first enters a boundary region. */
function pathBoxEntryDistance(path: Point[], box: CollisionBox) {
  let distanceBeforeSegment = 0
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]!
    const target = path[index]!
    const segmentLength = distance(start, target)
    const interval = segmentBoxInterval(start, target, box)
    if (interval) return distanceBeforeSegment + segmentLength * Math.max(0, interval.entry)
    distanceBeforeSegment += segmentLength
  }
  return null
}

function targetIsInsideStorefrontFrame(scene: MainlineSceneDefinition, passage: MainlineScenePassage, target: Point) {
  const storefront = scene.storefronts.find((candidate) => candidate.portalId === passage.portalId)
  if (!storefront) return false
  const structure = scene.structures.find((candidate) => candidate.id === storefront.wallId)
  const bounds = structure?.bounds
  if (!bounds) return false
  const withinStorefrontSpan = storefront.edge === 'left' || storefront.edge === 'right'
    ? target.y >= storefront.start && target.y <= storefront.end
    : target.x >= storefront.start && target.x <= storefront.end
  if (!withinStorefrontSpan) return false
  if (storefront.edge === 'left') return target.x <= bounds.x
  if (storefront.edge === 'right') return target.x >= bounds.x + bounds.width
  if (storefront.edge === 'top') return target.y <= bounds.y
  return target.y >= bounds.y + bounds.height
}

function routePassageCrossingDistance(scene: MainlineSceneDefinition, path: Point[] | null, passage: MainlineScenePassage, target: Point, options: MainlineNavigationOptions) {
  // Passage selection must be evidence from the route that will actually be
  // walked. A path constructed solely to approach this candidate door is not
  // evidence that the player's click crosses it; using that path here makes a
  // boundary click on the left side falsely select the unrelated secret door.
  if (!path) return null
  const collision = mainlinePassageCollisionForNavigation(scene, passage, options)
  const doorway = mainlinePassageDoorwayForNavigation(scene, passage, options)
  const footprint = mainlineActorFootprint(scene, options, path[0] ?? scene.initialPlayerPosition)
  const region = mainlinePassageDoorRegion(passage, collision, doorway, footprint)
  const start = path[0]
  const targetBehindThisPassage = start ? isDoorTargetBehind(region, start, target) : false
  if (!targetBehindThisPassage) return null
  const routeDoorway = {
    x: region.doorway.x - (region.normal.axis === 'x' ? normalClearance(footprint, 'x') : tangentClearance(footprint, 'y')) - .24,
    y: region.doorway.y - (region.normal.axis === 'x' ? tangentClearance(footprint, 'x') : normalClearance(footprint, 'y')) - .24,
    width: region.doorway.width + (region.normal.axis === 'x' ? normalClearance(footprint, 'x') : tangentClearance(footprint, 'y')) * 2 + .48,
    height: region.doorway.height + (region.normal.axis === 'x' ? tangentClearance(footprint, 'x') : normalClearance(footprint, 'y')) * 2 + .48,
  }
  // A target can be diagonally beyond a door without intending to cross that
  // door. The planned segment must enter the compiled doorway itself; the
  // target's tangent coordinate is not a substitute for that route evidence.
  return pathBoxEntryDistance(path, routeDoorway)
}

export type MainlineWorldCommandPlan =
  | {
    kind: 'passage'
    requestedTarget: Point
    passage: MainlineScenePassage
    passages: readonly MainlineScenePassage[]
    roomIds?: readonly string[]
    approachPath: Point[] | null
  }
  | {
    kind: 'ordinary'
    requestedTarget: Point
  }

function targetCrossesCompiledDoorway(region: DoorPassageRegion, from: Point, target: Point, footprint: NavigationActorFootprint) {
  if (!isDoorTargetBehind(region, from, target)) return false
  const doorway = {
    x: region.doorway.x - (region.normal.axis === 'x' ? 0 : footprint.width / 2) - .24,
    y: region.doorway.y - (region.normal.axis === 'x' ? footprint.height / 2 : 0) - .24,
    width: region.doorway.width + (region.normal.axis === 'x' ? 0 : footprint.width) + .48,
    height: region.doorway.height + (region.normal.axis === 'x' ? footprint.height : 0) + .48,
  }
  return pathBoxEntryDistance([from, target], doorway) !== null
}

/**
 * Passage intent owns raw world clicks before ordinary navigation gets a
 * chance to project them. This includes locked non-routeThrough doors: the
 * lifecycle, not an invisible wall projection, supplies the denied feedback.
 */
export function classifyMainlineWorldCommand(
  scene: MainlineSceneDefinition,
  from: Point,
  requestedTarget: Point,
  layout: SceneLayout = {},
  options: MainlineNavigationOptions = {},
): MainlineWorldCommandPlan {
  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  const targetInsideScene = pointInsideBounds(requestedTarget, snapshot.walkBounds)
  const footprint = mainlineActorFootprint(scene, options, from)

  if (targetInsideScene) {
    const roomRoute = findMainlineRoomPassageSequence(scene, from, requestedTarget, layout, options, true)
    if (roomRoute?.passages.length) {
      const passage = roomRoute.passages[0]!
      return {
        kind: 'passage',
        requestedTarget: { ...requestedTarget },
        passage,
        passages: roomRoute.passages,
        roomIds: roomRoute.roomIds,
        approachPath: canActorReachPassageApproach(scene, passage, from, layout, options)?.path ?? null,
      }
    }
  }

  const candidates = scene.passages
    .filter((passage) => passage.targetSceneId || passage.routeThrough || passage.access === 'locked')
    .map((passage) => {
      const collision = mainlinePassageCollisionForNavigation(scene, passage, options)
      const doorway = mainlinePassageDoorwayForNavigation(scene, passage, options)
      const region = mainlinePassageDoorRegion(passage, collision, doorway, footprint)
      const storefrontIntent = Boolean(passage.targetSceneId && targetIsInsideStorefrontFrame(scene, passage, requestedTarget))
      const crossesDoorway = targetCrossesCompiledDoorway(region, from, requestedTarget, footprint)
      if (!storefrontIntent && !crossesDoorway) return null
      const approachPath = canActorReachPassageApproach(scene, passage, from, layout, options)?.path
      if (!approachPath) return null
      return { passage, approachPath, distance: mainlinePathLength(approachPath) }
    })
    .filter((candidate): candidate is { passage: MainlineScenePassage; approachPath: Point[]; distance: number } => Boolean(candidate))
    .sort((first, second) => first.distance - second.distance)
  const selected = candidates[0]
  if (selected) {
    return {
      kind: 'passage',
      requestedTarget: { ...requestedTarget },
      passage: selected.passage,
      passages: [selected.passage],
      approachPath: selected.approachPath,
    }
  }
  return { kind: 'ordinary', requestedTarget: { ...requestedTarget } }
}

/**
 * Plan one global click-to-move command. The planner searches with door state
 * removed from route obstacles, then cuts the route at the first doorway so
 * the existing passage lifecycle can authorize and animate the crossing.
 *
 * This is intentionally different from classifying the click as "behind a
 * door". A door is selected only when the planned route enters its detection
 * region from the correct side while the target lies beyond that doorway.
 * Candidate doors are ordered by cumulative route distance, so the first
 * boundary crossed owns the passage lifecycle.
 */
export function findMainlineWorldRoute(
  scene: MainlineSceneDefinition,
  from: Point,
  requestedTarget: Point,
  layout: SceneLayout = {},
  options: MainlineNavigationOptions = {},
): MainlineWorldRoute {
  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  const targetInsideScene = pointInsideBounds(requestedTarget, snapshot.walkBounds)
  const localPath = targetInsideScene
    ? findMainlinePath(from, requestedTarget, scene, layout, options)
    : null
  const actorFootprint = mainlineActorFootprint(scene, options, from)
  const walkableBounds = insetBounds(snapshot.walkBounds, actorFootprint)
  const boundaryTarget = {
    x: Math.max(walkableBounds.x, Math.min(requestedTarget.x, walkableBounds.x + walkableBounds.width)),
    y: Math.max(walkableBounds.y, Math.min(requestedTarget.y, walkableBounds.y + walkableBounds.height)),
  }
  // Outside clicks still need one route to the clicked boundary. Re-planning
  // independently to every door would make each candidate path pass through
  // its own doorway and falsely select a portal that the click ray missed.
  const boundaryPath = targetInsideScene
    ? null
    : findMainlinePath(from, boundaryTarget, scene, layout, options)
  const plannedPath = localPath ?? boundaryPath

  if (targetInsideScene) {
    const roomRoute = findMainlineRoomPassageSequence(scene, from, requestedTarget)
    if (roomRoute && roomRoute.passages.length > 0) {
      const firstPassage = roomRoute.passages[0]!
      return {
        requestedTarget,
        target: requestedTarget,
        approachPath: findMainlinePathThroughPassage(scene, firstPassage.id, from, layout, options).path,
        passage: firstPassage,
        passages: roomRoute.passages,
        roomIds: roomRoute.roomIds,
        continuationPath: null,
      }
    }
  }

  // A scene can contain an interior corridor while a door in that corridor
  // still belongs to another scene. If the requested route genuinely crosses
  // such a passage, let the passage own the transition even though the click
  // target is still inside this scene's authored frame.
  const passageCrossings = scene.passages
    .filter((candidate) => candidate.targetSceneId || candidate.routeThrough)
    .map((candidate) => {
      const collision = mainlinePassageCollisionForNavigation(scene, candidate, options)
      const doorway = mainlinePassageDoorwayForNavigation(scene, candidate, options)
      const region = mainlinePassageDoorRegion(candidate, collision, doorway, actorFootprint)
      const targetBehindThisPassage = isDoorTargetBehind(region, from, requestedTarget)
      const storefrontIntent = targetIsInsideStorefrontFrame(scene, candidate, requestedTarget)
      const passagePath = !targetInsideScene || storefrontIntent
        ? findMainlinePathThroughPassage(scene, candidate.id, from, layout, options).path
        : targetBehindThisPassage
          ? findMainlinePath(from, requestedTarget, scene, layout, {
            ...options,
            openPassageIds: new Set([...(options.openPassageIds ?? []), candidate.id]),
          })
          : null
      const approachPath = passagePath && targetInsideScene && targetBehindThisPassage
        ? findMainlinePathThroughPassage(scene, candidate.id, from, layout, options).path
        : plannedPath
      return {
        passage: candidate,
        approachPath,
        crossingDistance: routePassageCrossingDistance(scene, plannedPath, candidate, requestedTarget, options),
      }
    })
    .filter((candidate): candidate is { passage: MainlineScenePassage; approachPath: Point[] | null; crossingDistance: number } => candidate.crossingDistance !== null)
    .sort((first, second) => first.crossingDistance - second.crossingDistance)
  const crossScenePassage = passageCrossings[0]?.passage
  if (crossScenePassage) {
    const approachPath = passageCrossings[0]?.approachPath ?? findMainlinePathThroughPassage(scene, crossScenePassage.id, from, layout, options).path
    return { requestedTarget, target: requestedTarget, approachPath, passage: crossScenePassage, passages: [crossScenePassage], continuationPath: null }
  }

  // A click can intentionally stop on the approach side of a scene door.
  // That route must still own the existing scene-frame exit, otherwise the
  // normal-move branch clears it and the frame disappears only on a later
  // scene change. Select only a doorway whose compiled detection corridor is
  // actually entered by this route; do not infer intent from screen
  // coordinates or from a separate proximity lifecycle.
  const framePassage = plannedPath
    ? scene.passages
      .filter((candidate) => candidate.targetSceneId || candidate.frameBehavior === 'scene-retract')
      .map((candidate) => {
        const collision = mainlinePassageCollisionForNavigation(scene, candidate, options)
        const doorway = mainlinePassageDoorwayForNavigation(scene, candidate, options)
        const region = mainlinePassageDoorRegion(candidate, collision, doorway, actorFootprint)
        const entryDistance = pathBoxEntryDistance(plannedPath, region.detection)
        const targetInsideDetection = containsPoint(region.detection, requestedTarget)
        if (!targetInsideDetection && entryDistance === null) return null
        return { passage: candidate, entryDistance: entryDistance ?? Number.POSITIVE_INFINITY }
      })
      .filter((candidate): candidate is { passage: MainlineScenePassage; entryDistance: number } => Boolean(candidate))
      .sort((first, second) => first.entryDistance - second.entryDistance)[0]?.passage
    : undefined

  if (targetInsideScene) {
    return {
      requestedTarget,
      target: requestedTarget,
      approachPath: localPath,
      framePassage,
      passages: [],
    }
  }

  // Keep the click target as the command's destination. The planner may end
  // its movement path at the nearest walkable boundary, but it must not
  // rewrite the player's intent to that boundary. Doors and air walls consume
  // the same route and decide what happens when the actor reaches them.
  return {
    requestedTarget,
    target: requestedTarget,
    approachPath: boundaryPath,
    framePassage,
    passages: [],
  }
}

export function mainlinePassageAtPoint(scene: MainlineSceneDefinition, point: Point, options: MainlineNavigationOptions = {}): MainlineScenePassage | undefined {
  return scene.passages.find((passage) => {
    const collision = mainlinePassageCollisionForNavigation(scene, passage, options)
    const doorway = mainlinePassageDoorwayForNavigation(scene, passage, options)
    return containsPoint(mainlinePassageDoorRegion(passage, collision, doorway).detection, point)
  })
}

export function isMainlinePassageCrossingPoint(point: Point, passage: MainlineScenePassage, from: Point, collision = passage.collision) {
  void from
  return containsPoint(mainlinePassageDetectionArea(passage, .15, collision), point)
}

export function mainlinePassageSide(passage: MainlineScenePassage, from: Point, collision = passage.collision, doorway = passage.doorway) {
  return passageSide(passage, from, collision, doorway)
}

export type MainlinePassageApproach = {
  target: Point
  path: Point[]
}

/**
 * A passage can own an interaction only when this actor can reach the real
 * approach side through the same closed-door, access and barrier geometry
 * used by ordinary movement. It deliberately does not authorize opening or
 * crossing the passage.
 */
export function canActorReachPassageApproach(
  scene: MainlineSceneDefinition,
  passage: MainlineScenePassage,
  from: Point,
  layout: SceneLayout = {},
  options: MainlineNavigationOptions = {},
): MainlinePassageApproach | null {
  const collision = mainlinePassageCollisionForNavigation(scene, passage, options)
  const doorway = mainlinePassageDoorwayForNavigation(scene, passage, options)
  const doorCenter = { x: doorway.x + doorway.width / 2, y: doorway.y + doorway.height / 2 }
  if (scene.accessRegions.some(region => !actorCanEnterRegion(scene, options.actorId, region) && (containsPoint(region, doorCenter) || passage.crossingTargets.some(point => containsPoint(region, point))))) return null
  const side = passageSide(passage, from, collision, doorway)
  const footprint = mainlineActorFootprint(scene, options, from)
  const boundary = passageBoundaryPoint(passage, from, passage.crossingTargets[side], footprint, collision, doorway)
  const directPath = findMainlinePath(from, boundary, scene, layout, options)
  if (directPath) return { target: boundary, path: directPath }
  // If the nearest tangent is obstructed, search the usable doorway span.
  // These are geometry-derived contacts, not authored portal/threshold points.
  const axis = passageNormalAxis(passage)
  const tangentAxis = axis === 'x' ? 'y' : 'x'
  const origin = doorway[tangentAxis]
  const span = axis === 'x' ? doorway.height : doorway.width
  const half = tangentClearance(footprint, axis)
  const min = origin + half + .02
  const max = origin + span - half - .02
  const count = Math.max(1, Math.ceil(Math.max(0, max - min) / sharedNavigationTraversalStep))
  const contacts = Array.from({ length: count + 1 }, (_, index) => {
    const tangent = min > max ? origin + span / 2 : min + (max - min) * index / count
    return { ...boundary, [tangentAxis]: tangent }
  }).sort((a, b) => distance(a, from) - distance(b, from))
  for (const target of contacts) {
    const path = findMainlinePath(from, target, scene, layout, options)
    if (path) return { target, path }
  }
  return null
}

export function findMainlinePathThroughPassage(scene: MainlineSceneDefinition, passageId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const passage = mainlinePassageForId(scene, passageId)
  if (!passage) return { passage: undefined, target: from, path: null }
  const approach = canActorReachPassageApproach(scene, passage, from, layout, options)
  return {
    passage,
    target: approach?.target ?? from,
    path: approach?.path ?? null,
  }
}

export function findMainlinePath(start: Point, target: Point, scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): Point[] | null {
  options = { ...options, geometrySnapshot: sceneGeometrySnapshot(scene, layout, options) }
  if (!isWalkableMainlinePoint(start, scene, layout, options)) return null
  if (!isWalkableMainlinePoint(target, scene, layout, options)) return null
  const actorFootprint = mainlineActorFootprint(scene, options, start)
  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  const barriers = mainlineNavigationBarriers(scene, layout, { ...options, geometrySnapshot: snapshot })
  const canOccupy = (point: Point) => isWalkableMainlinePoint(point, scene, layout, options)
  if (isMainlineNavigationBarrierClear(start, target, scene, layout, options) && canTravelAlongSegment(start, target, canOccupy)) return [start, target]
  const obstacles = collisionBoxes(scene, layout, options)
  const cacheKey = [
    options.actorId ?? 'protagonist',
    actorFootprint.width.toFixed(4),
    actorFootprint.height.toFixed(4),
    [...(options.openPassageIds ?? [])].sort().join(','),
    [...occupiedSeatIdsForNavigation(scene, options)].sort().join(','),
  ].join('|')
  const canReuseStaticMesh = !options.navigationRuntime
  const cached = canReuseStaticMesh ? staticNavigationMeshCache.get(snapshot)?.get(cacheKey) : undefined
  const navigationMesh = cached?.key === cacheKey
    ? cached.mesh
    : createPolygonNavigationMesh({
      bounds: insetBounds(snapshot.walkBounds, actorFootprint),
      obstacles,
      obstacleInset: { x: actorFootprint.width / 2, y: actorFootprint.height / 2 },
      barriers,
      actorFootprint,
    })
  if (canReuseStaticMesh && cached?.key !== cacheKey) cacheStaticNavigationMesh(snapshot, cacheKey, navigationMesh)
  return findNavigationPath(start, target, {
    bounds: insetBounds(snapshot.walkBounds, actorFootprint),
    obstacles,
    actorFootprint,
    barriers,
    navigationMesh,
    canTravel: (segmentStart, segmentEnd) => isMainlineNavigationBarrierClear(segmentStart, segmentEnd, scene, layout, options)
      && canTravelAlongSegment(segmentStart, segmentEnd, canOccupy),
  })
}

export type MainlineWorldNavigationResolution = {
  requestedTarget: Point
  resolvedNavigableTarget: Point
  path: Point[]
  reachedRequestedTarget: boolean
  /** Optional world policy feedback; it does not alter collision geometry. */
  deniedAccessRegion?: MainlineSceneAccessRegion
}

/**
 * Resolve a non-passage world click once against static, actor-specific scene
 * geometry. Dynamic actors remain live route/movement constraints and never
 * permanently rewrite the player click into a different target.
 */
/** Prepare immutable scene navigation when its geometry/door contract changes. */
export function prepareMainlineWorldNavigation(scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const actorFootprint = mainlineActorFootprint(scene, options, scene.initialPlayerPosition)
  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  const barriers = mainlineNavigationBarriers(scene, layout, { ...options, geometrySnapshot: snapshot })
  // The target component belongs to the stable world. Runtime actors are
  // deliberately excluded here: they may block this movement attempt, but
  // cannot turn a raw click into a different permanent destination.
  const obstacles = collisionBoxes(scene, layout, options, false)
  const cacheKey = [
    'world',
    options.actorId ?? 'protagonist',
    actorFootprint.width.toFixed(4),
    actorFootprint.height.toFixed(4),
    [...(options.openPassageIds ?? [])].sort().join(','),
    [...occupiedSeatIdsForNavigation(scene, options)].sort().join(','),
  ].join('|')
  const cached = staticNavigationMeshCache.get(snapshot)?.get(cacheKey)
  const navigationMesh = cached?.key === cacheKey
    ? cached.mesh
    : createPolygonNavigationMesh({
      bounds: insetBounds(snapshot.walkBounds, actorFootprint),
      obstacles,
      obstacleInset: { x: actorFootprint.width / 2, y: actorFootprint.height / 2 },
      barriers,
      actorFootprint,
    })
  if (cached?.key !== cacheKey) cacheStaticNavigationMesh(snapshot, cacheKey, navigationMesh)
  return {
    bounds: insetBounds(snapshot.walkBounds, actorFootprint), obstacles, actorFootprint, barriers, navigationMesh,
  }
}

/** Declared permission edge with a public normal and actor contact clearance. */
function accessBoundaryGeometry(region: MainlineSceneAccessRegion, edge: 'top' | 'right' | 'bottom' | 'left', footprint: NavigationActorFootprint) {
  const axis = edge === 'left' || edge === 'right' ? 'x' : 'y'
  const tangentAxis = axis === 'x' ? 'y' : 'x'
  const direction = edge === 'right' || edge === 'bottom' ? 1 : -1
  const line = axis === 'x' ? region.x + (edge === 'right' ? region.width : 0) : region.y + (edge === 'bottom' ? region.height : 0)
  const tangentHalf = axis === 'x' ? footprint.height / 2 : footprint.width / 2
  return { axis, tangentAxis, direction, line, clearance: axis === 'x' ? footprint.width / 2 : footprint.height / 2,
    min: region[tangentAxis] - tangentHalf, max: region[tangentAxis] + (axis === 'x' ? region.height : region.width) + tangentHalf } as const
}

export function resolveMainlineWorldNavigation(
  scene: MainlineSceneDefinition,
  from: Point,
  requestedTarget: Point,
  layout: SceneLayout = {},
  options: MainlineNavigationOptions = {},
): MainlineWorldNavigationResolution | null {
  if (!isWalkableMainlinePoint(from, scene, layout, options)) return null
  const adapter = prepareMainlineWorldNavigation(scene, layout, options)
  const footprint = adapter.actorFootprint
  const deniedBoundaries = scene.accessBoundaries.flatMap(boundary => {
    const region = scene.accessRegions.find(candidate => candidate.id === boundary.regionId)
    return region && !actorCanEnterRegion(scene, options.actorId, region)
      ? [{ region, geometry: accessBoundaryGeometry(region, boundary.edge, footprint) }] : []
  })
  if (deniedBoundaries.length) {
    // Resolve the attempted physical route with the same mesh owner. This
    // route supplies intent only; it is never handed to the movement controller.
    const physicalBarriers = adapter.barriers.filter(barrier => barrier.kind !== 'access-boundary')
    let physicalMesh = physicalIntentMeshCache.get(adapter.navigationMesh)
    if (!physicalMesh) {
      physicalMesh = createPolygonNavigationMesh({
        bounds: adapter.bounds, obstacles: adapter.obstacles, barriers: physicalBarriers,
        obstacleInset: { x: footprint.width / 2, y: footprint.height / 2 }, actorFootprint: footprint,
      })
      physicalIntentMeshCache.set(adapter.navigationMesh, physicalMesh)
    }
    const attempted = resolveNavigationPath(from, requestedTarget, {
      ...adapter, barriers: physicalBarriers, navigationMesh: physicalMesh,
    })
    if (attempted) for (let index = 1; index < attempted.path.length; index += 1) {
      const start = attempted.path[index - 1]!
      const end = attempted.path[index]!
      const contacts = deniedBoundaries.flatMap(({ region, geometry: g }) => {
        const publicLine = g.line + g.direction * (g.clearance + .02)
        const startDistance = (start[g.axis] - publicLine) * g.direction
        const endDistance = (end[g.axis] - publicLine) * g.direction
        if (startDistance < 0 || endDistance >= 0) return []
        const progress = startDistance / (startDistance - endDistance)
        const target = { x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress }
        if (target[g.tangentAxis] < g.min || target[g.tangentAxis] > g.max) return []
        return [{ region, target, progress }]
      }).sort((a, b) => a.progress - b.progress)
      const contact = contacts[0]
      if (!contact) continue
      const path = findMainlinePath(from, contact.target, scene, layout, options)
      return {
        requestedTarget, resolvedNavigableTarget: path ? contact.target : { ...from },
        path: path ?? [{ ...from }], reachedRequestedTarget: false, deniedAccessRegion: contact.region,
      }
    }
  }
  return resolveNavigationPath(from, requestedTarget, adapter)
}

const contactDirectionForSide = {
  top: createPoint(defaultEdgeContactDirection.y, defaultEdgeContactDirection.x),
  right: createPoint(-defaultEdgeContactDirection.x, -defaultEdgeContactDirection.y),
  bottom: createPoint(-defaultEdgeContactDirection.y, -defaultEdgeContactDirection.x),
  left: defaultEdgeContactDirection,
} as const

function collisionContactCandidates(
  position: Point,
  collision: CollisionBox,
  from: Point,
  actorFootprint: NavigationActorFootprint,
  sides?: readonly ('top' | 'right' | 'bottom' | 'left')[],
  includeDiagonals = false,
): Point[] {
  const dx = from.x - position.x
  const dy = from.y - position.y
  const length = Math.hypot(dx, dy)
  const primary = length > .001 ? { x: dx / length, y: dy / length } : defaultEdgeContactDirection
  const clockwise = { x: -primary.y, y: primary.x }
  const counterclockwise = { x: primary.y, y: -primary.x }
  const opposite = { x: -primary.x, y: -primary.y }
  const directions = sides?.map((side) => contactDirectionForSide[side])
    ?? [primary, clockwise, counterclockwise, opposite, ...(includeDiagonals ? [
      { x: primary.x + clockwise.x, y: primary.y + clockwise.y },
      { x: primary.x + counterclockwise.x, y: primary.y + counterclockwise.y },
      { x: opposite.x + clockwise.x, y: opposite.y + clockwise.y },
      { x: opposite.x + counterclockwise.x, y: opposite.y + counterclockwise.y },
    ] : [])]
  return directions.map((direction) => edgeContactPoint(position, collision, {
    x: position.x + direction.x,
    y: position.y + direction.y,
  }, actorFootprint))
}

export function mainlineEntityInteractionCandidates(scene: MainlineSceneDefinition, entityId: string, from: Point, layout: SceneLayout, actorFootprint: NavigationActorFootprint, options: MainlineNavigationOptions): Point[] {
  const entity = scene.objects.find((candidate) => candidate.id === entityId)
  if (!entity) return [from]
  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  const offset = mainlineLayoutOffsetForEntity(scene, entityId, layout)
  const position = snapshot.objects.get(entityId)?.position ?? { x: entity.position.x + offset.x, y: entity.position.y + offset.y }
  if (entity.kind === 'door') {
    const passage = scene.passages.find((candidate) => candidate.entityId === entityId)
    if (passage) {
      const collision = mainlinePassageCollisionForNavigation(scene, passage, { ...options, geometrySnapshot: snapshot })
      const doorway = mainlinePassageDoorwayForNavigation(scene, passage, { ...options, geometrySnapshot: snapshot })
      const side = passageSide(passage, from, collision, doorway)
      return [passageBoundaryPoint(passage, from, passage.crossingTargets[side], actorFootprint, collision, doorway)]
    }
    return [mainlineDoorThreshold(scene, position, actorFootprint)]
  }
  // Wall-mounted interactive features resolve a contact point along their
  // shared wall edge from the actor's current tangent. Their interaction
  // target is not the wall glyph itself, so the actor stays on the walkable
  // side of the boundary before interacting.
  if (entity.surface === 'wall') {
    if (entity.interactionContactAnchor) {
      return [{
        x: entity.interactionContactAnchor.x + offset.x,
        y: entity.interactionContactAnchor.y + offset.y,
      }]
    }
    const featureTarget = wallFeatureInteractionTarget(scene, entityId, from, actorFootprint, snapshot)
    if (featureTarget) return [{ x: featureTarget.x + offset.x, y: featureTarget.y + offset.y }]
    if (options.geometrySnapshot?.sceneId === scene.id) return [from]
    if (entity.approach) return [{ x: entity.approach.x + offset.x, y: entity.approach.y + offset.y }]
  }
  const continuousStructure = entity.interactionStructureId
    ? scene.continuousStructures.find((structure) => structure.id === entity.interactionStructureId)
    : undefined
  const collision = continuousStructure
    ?? snapshot.objects.get(entityId)?.collision
    ?? mainlineEntityCollision(scene, entity, layout, options.screenMetrics)
  if (!collision) return [position]

  // A visual cell can address a continuous structure without fragmenting its
  // collision. Keep the contact aligned with the clicked cell along the
  // exposed surface, while the body remains one physical obstacle.
  if (continuousStructure) {
    const halfWidth = actorFootprint.width / 2 + sharedFurnitureGeometry.actorContactGap
    const halfHeight = actorFootprint.height / 2 + sharedFurnitureGeometry.actorContactGap
    const directions = entity.interactionContactSides ?? ['top', 'right', 'bottom', 'left']
    return directions.map((side) => {
      if (side === 'top' || side === 'bottom') {
        return {
          x: Math.max(collision.x + halfWidth, Math.min(position.x, collision.x + collision.width - halfWidth)),
          y: side === 'top' ? collision.y - halfHeight : collision.y + collision.height + halfHeight,
        }
      }
      return {
        x: side === 'left' ? collision.x - halfWidth : collision.x + collision.width + halfWidth,
        y: Math.max(collision.y + halfHeight, Math.min(position.y, collision.y + collision.height - halfHeight)),
      }
    })
  }

  // Seats keep their pulled → sit lifecycle, but every edge is a candidate.
  // Furniture relations and shared route legality decide the usable side.
  if (entity.seat) {
    return collisionContactCandidates(position, collision, from, actorFootprint)
  }

  // Ordinary floor objects never own an authored interaction destination.
  // Their current footprint, shared route legality, and the actor's direction
  // decide the contact. Structural wall/door and seat lifecycle branches above
  // retain their separate semantics.
  return collisionContactCandidates(position, collision, from, actorFootprint, entity.interactionContactSides, true)
}

function mainlinePathLength(path: readonly Point[]): number {
  return path.slice(1).reduce((total, point, index) => total + Math.hypot(
    point.x - path[index]!.x,
    point.y - path[index]!.y,
  ), 0)
}

/** Pick the cheapest reachable contact, not the first authored candidate. */
function nearestReachableInteractionPath(scene: MainlineSceneDefinition, from: Point, candidates: readonly Point[], layout: SceneLayout, options: MainlineNavigationOptions) {
  let nearest: { target: Point; path: Point[]; distance: number } | null = null
  const unresolved: Point[] = []
  const canOccupy = (point: Point) => isWalkableMainlinePoint(point, scene, layout, options)
  for (const target of candidates) {
    if (!isWalkableMainlinePoint(target, scene, layout, options)) continue
    if (isMainlineNavigationBarrierClear(from, target, scene, layout, options) && canTravelAlongSegment(from, target, canOccupy)) {
      const path = [from, target]
      const distance = mainlinePathLength(path)
      if (!nearest || distance < nearest.distance) nearest = { target, path, distance }
    } else unresolved.push(target)
  }
  for (const target of unresolved.sort((first, second) => (
    Math.hypot(first.x - from.x, first.y - from.y) - Math.hypot(second.x - from.x, second.y - from.y)
  ))) {
    // A path cannot beat its straight-line lower bound, so avoid compiling a
    // second grid when an already direct contact is strictly closer.
    if (nearest && Math.hypot(target.x - from.x, target.y - from.y) >= nearest.distance) continue
    const path = findMainlinePath(from, target, scene, layout, options)
    if (!path) continue
    const distance = mainlinePathLength(path)
    // Candidates are ordered by their physical straight-line lower bound.
    // The first reachable routed contact is therefore the nearest legal
    // fallback, and avoids compiling the same scene mesh once per side.
    return { target, path, distance }
  }
  return nearest
}

export type MainlineInteractionResolution = {
  target: Point
  path: Point[] | null
  inRange: boolean
}

/**
 * Resolve one semantic interaction against all of its currently legal
 * contacts.  Objects, NPCs and storefronts share this owner so a dynamic
 * actor can occupy one contact without turning the whole interaction into a
 * dead end.
 */
export function resolveMainlineInteractionCandidates(
  scene: MainlineSceneDefinition,
  from: Point,
  candidates: readonly Point[],
  interactionRange: number,
  layout: SceneLayout,
  options: MainlineNavigationOptions,
): MainlineInteractionResolution {
  options = { ...options, geometrySnapshot: sceneGeometrySnapshot(scene, layout, options) }
  const nearby = candidates.find((target) => distance(from, target) <= interactionRange && isWalkableMainlinePoint(from, scene, layout, options) && isMainlineNavigationBarrierClear(from, target, scene, layout, options))
  if (nearby) return { target: from, path: [from], inRange: true }
  const selected = nearestReachableInteractionPath(scene, from, candidates, layout, options)
  const target = selected?.target
    ?? candidates.find((candidate) => isWalkableMainlinePoint(candidate, scene, layout, options))
    ?? candidates[0]
    ?? from
  return {
    target,
    path: selected?.path ?? null,
    inRange: distance(from, target) <= interactionRange,
  }
}

/** Continuous range ownership stays separate from route destination sampling. */
export function resolveMainlineStorefrontInteraction(scene: MainlineSceneDefinition, storefront: MainlineStorefrontSlot, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): MainlineInteractionResolution {
  const { center, outward, radius } = mainlineStorefrontInteractionRegion(scene, storefront)
  const dx = from.x - center.x, dy = from.y - center.y
  if (dx * outward.x + dy * outward.y >= 0 && Math.hypot(dx, dy) <= radius + .001 && isWalkableMainlinePoint(from, scene, layout, options)) return { target: from, path: [from], inRange: true }
  const candidates = mainlineStorefrontInteractionCandidates(scene, storefront, from, mainlineActorFootprint(scene, options, from))
  const resolved = resolveMainlineInteractionCandidates(scene, from, candidates, 0, layout, options)
  return { ...resolved, inRange: false }
}

/** One selected entity contact is shared by proximity, route and arrival. */
export function resolveMainlineEntityInteraction(scene: MainlineSceneDefinition, entityId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): MainlineInteractionResolution {
  const entity = scene.objects.find((candidate) => candidate.id === entityId)
  const candidates = mainlineEntityInteractionCandidates(scene, entityId, from, layout, mainlineActorFootprint(scene, options, from), options)
  const range = entity?.interactionRange ?? .35
  const resolved = resolveMainlineInteractionCandidates(scene, from, candidates, range, layout, options)
  if (resolved.path || entity?.surface !== 'floor' || entity.kind === 'door' || entity.kind === 'seat' || range <= .35) return resolved
  // A neighbouring visible body can occupy a contact without invalidating
  // the object's authored interaction range. Project through shared legality
  // and accept only positions still inside that range; barriers stay intact.
  const legalContacts = candidates.flatMap(contact => {
    const route = resolveMainlineWorldNavigation(scene, from, contact, layout, options)
    return route && distance(route.resolvedNavigableTarget, contact) <= range ? [route.resolvedNavigableTarget] : []
  })
  return resolveMainlineInteractionCandidates(scene, from, legalContacts, range, layout, options)
}

export function mainlineInteractionTarget(scene: MainlineSceneDefinition, entityId: string, from: Point, layout: SceneLayout = {}, actorRadius?: number, options: MainlineNavigationOptions = {}): Point {
  return resolveMainlineEntityInteraction(scene, entityId, from, layout, {
    ...options,
    ...(actorRadius === undefined || options.actorFootprint ? {} : { actorFootprint: { width: actorRadius * 2, height: actorRadius * 2 } }),
  }).target
}

/** Resolve an authored seat sit point through the shared layout projection. */
export function resolveMainlineSeatSitPosition(scene: MainlineSceneDefinition, seatId: string, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): Point | null {
  const seat = scene.objects.find((candidate) => candidate.id === seatId)
  if (!seat?.seat) return null

  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  // `sit` remains transition metadata. A stable occupied seat has exactly one
  // visual and navigation anchor: the rendered seat center.
  return snapshot.objects.get(seat.id)?.position ?? { ...seat.position }
}

/** Resolve one NPC from its current scene placement, not from NPC identity. */
export function resolveMainlineNpcPosition(scene: MainlineSceneDefinition, npcId: string, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): Point {
  const runtimePosition = options.npcRuntimePositions?.get(npcId)
  if (runtimePosition) return { ...runtimePosition }
  const seatId = mainlineNpcStagedSeatId(scene, npcId)
  const point = mainlineNpcStagedPoint(scene, npcId)
  if (seatId) return resolveMainlineSeatSitPosition(scene, seatId, layout, options) ?? point ?? scene.initialPlayerPosition
  return point ?? scene.initialPlayerPosition
}

function mainlineNpcInteractionCandidates(scene: MainlineSceneDefinition, npcId: string, from: Point, layout: SceneLayout, actorFootprint: NavigationActorFootprint, options: MainlineNavigationOptions) {
  const npcPosition = resolveMainlineNpcPosition(scene, npcId, layout, options)
  const npc = scene.npcs.find((candidate) => candidate.id === npcId)
  const collision = navigationActorBox(npcPosition, footprintFromBox(mainlineLabelFootprint(npc?.label ?? '', npcPosition, options.screenMetrics, { lineHeight: 1 })))
  const physicalCandidates = collisionContactCandidates(npcPosition, collision, from, actorFootprint)
  const behaviorContactEntityId = mainlineNpcStagedInteractionContactEntityId(scene, npcId)
  const behaviorContactCandidates = behaviorContactEntityId
    ? mainlineEntityInteractionCandidates(scene, behaviorContactEntityId, from, layout, actorFootprint, options)
    : []
  // Story context never decides physical navigation. A current service surface
  // can only supplement the NPC's own nearby contact candidates.
  return [...physicalCandidates, ...behaviorContactCandidates]
}

/** Keep an interacting protagonist outside the NPC actor footprint and nearby furniture. */
export function mainlineNpcInteractionTarget(scene: MainlineSceneDefinition, npcId: string, from: Point, layout: SceneLayout = {}, actorRadius?: number, options: MainlineNavigationOptions = {}): Point {
  return resolveMainlineNpcInteraction(scene, npcId, from, layout, {
    ...options,
    ...(actorRadius === undefined || options.actorFootprint ? {} : { actorFootprint: { width: actorRadius * 2, height: actorRadius * 2 } }),
  }).target
}

/** NPCs use the same current-footprint contact resolver as ordinary objects. */
export function resolveMainlineNpcInteraction(scene: MainlineSceneDefinition, npcId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): MainlineInteractionResolution {
  const candidates = mainlineNpcInteractionCandidates(scene, npcId, from, layout, mainlineActorFootprint(scene, options, from), options)
  return resolveMainlineInteractionCandidates(scene, from, candidates, .25, layout, options)
}

export function findMainlinePathToNpc(scene: MainlineSceneDefinition, npcId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const resolved = resolveMainlineNpcInteraction(scene, npcId, from, layout, options)
  return { target: resolved.target, path: resolved.path }
}

export function isMainlineNpcWithinInteractionRange(scene: MainlineSceneDefinition, npcId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  return resolveMainlineNpcInteraction(scene, npcId, from, layout, options).inRange
}

export function isMainlineEntityWithinInteractionRange(scene: MainlineSceneDefinition, entityId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const entity = scene.objects.find((candidate) => candidate.id === entityId)
  if (!entity || entity.kind === 'door' || entity.kind === 'seat') return false
  return resolveMainlineEntityInteraction(scene, entityId, from, layout, options).inRange
}

export function findMainlinePathToEntity(scene: MainlineSceneDefinition, entityId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const resolved = resolveMainlineEntityInteraction(scene, entityId, from, layout, options)
  return { target: resolved.target, path: resolved.path }
}
