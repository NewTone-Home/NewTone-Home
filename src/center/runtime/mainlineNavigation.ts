import { defaultEdgeContactDirection, mainlineWallThickness, type CollisionBox, type Point } from './sceneGeometry'
import { mainlineScenePassageCollision, mainlineScenePassageDoorway, type MainlineSceneAccessRegion, type MainlineSceneDefinition, type MainlineSceneId, type MainlineScenePassage } from './mainlineScenes'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineEntityCollision, mainlineLayoutOffsetForEntity, type SceneLayout } from './sceneLayout'
import { createMainlineSceneGeometrySnapshot, type MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { edgeContactPoint, findNavigationPath, type NavigationRuntime } from './navigationCore'
import { containsDoorRegion, doorRegionSide, doorwayBoundaryPoint, isDoorTargetBehind, type DoorPassageRegion, type DoorRegionNormal } from './doorPassageModel'
import { sharedFurnitureGeometry } from './twoSeatFurniture'

export type MainlineNavigationOptions = {
  actorRadius?: number
  actorId?: string
  /** Optional shared registry for NPC/protagonist dynamic occupancy. */
  navigationRuntime?: NavigationRuntime
  /** The canonical lifecycle set; entity ids are only renderer-facing data. */
  openPassageIds?: ReadonlySet<string>
  /** The measured stage dimensions used by the shared scene projection. */
  screenMetrics?: SceneScreenMetrics
  /** One screen-specific geometry transaction shared by render and navigation. */
  geometrySnapshot?: MainlineSceneGeometrySnapshot
}

const defaultActorRadius = .2

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

export type MainlineAccessRegionBoundaryTarget = {
  region: MainlineSceneAccessRegion
  target: Point
}

/**
 * Preserve a denied world-click as a normal movement command to the nearest
 * legal edge, rather than reducing it to an unexplained no-path result.
 */
export function resolveMainlineAccessRegionBoundaryTarget(
  scene: MainlineSceneDefinition,
  requestedTarget: Point,
  from: Point,
  options: MainlineNavigationOptions = {},
): MainlineAccessRegionBoundaryTarget | null {
  const region = scene.accessRegions.find((candidate) => (
    !actorCanEnterRegion(scene, options.actorId, candidate) && containsPoint(candidate, requestedTarget)
  ))
  if (!region) return null
  return {
    region,
    target: edgeContactPoint(
      { x: region.x + region.width / 2, y: region.y + region.height / 2 },
      region,
      from,
      options.actorRadius ?? defaultActorRadius,
    ),
  }
}

function collisionBoxes(scene: MainlineSceneDefinition, layout: SceneLayout, options: MainlineNavigationOptions, includeClosedPassages: boolean) {
  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  const openPassageIds = options.openPassageIds
    ? new Set(scene.passages.filter((passage) => options.openPassageIds!.has(passage.id)).map((passage) => passage.id))
    : new Set<string>()
  // One collision compiler supplies both route geometry and physical
  // occupancy. The route query omits passage cells; only the movement check
  // adds a closed passage back as a temporary physical gate.
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
        if (includeClosedPassages) return !passageOpen
        if (unit.navigation.passageId || unit.navigation.opensWithPassageId) return !doorwayUnit
        return true
      })
      .map((unit) => ({ x: unit.x, y: unit.y, width: unit.width, height: unit.height })),
    ...scene.objects
      .filter((entity) => entity.visible !== false)
      .map((entity) => snapshot.objects.get(entity.id)?.collision ?? mainlineEntityCollision(scene, entity, layout, options.screenMetrics))
      .filter((collision): collision is NonNullable<typeof collision> => Boolean(collision)),
    ...scene.accessRegions
      .filter((region) => !actorCanEnterRegion(scene, options.actorId, region))
      .map((region) => ({ x: region.x, y: region.y, width: region.width, height: region.height })),
  ]
  const dynamicBoxes = options.navigationRuntime?.dynamicObstaclesFor(options.actorId) ?? []
  return [...staticBoxes, ...dynamicBoxes]
}

export function mainlineNavigationCollisionBoxes(scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}, includeClosedPassages = false) {
  return collisionBoxes(scene, layout, options, includeClosedPassages)
}

export function isWalkableMainlinePoint(point: Point, scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const actorRadius = options.actorRadius ?? defaultActorRadius
  const bounds = expanded(sceneGeometrySnapshot(scene, layout, options).walkBounds, -actorRadius)
  if (point.x < bounds.x || point.x > bounds.x + bounds.width || point.y < bounds.y || point.y > bounds.y + bounds.height) return false
  const actorBox = { x: point.x - actorRadius, y: point.y - actorRadius, width: actorRadius * 2, height: actorRadius * 2 }
  return collisionBoxes(scene, layout, options, true).every((collision) => !overlaps(actorBox, expanded(collision, 0)))
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

export function clampMainlineWalkTarget(point: Point, scene: MainlineSceneDefinition, actorRadius = defaultActorRadius): Point {
  const bounds = expanded(scene.walkBounds, -actorRadius)
  return {
    x: clamp(point.x, bounds.x, bounds.x + bounds.width),
    y: clamp(point.y, bounds.y, bounds.y + bounds.height),
  }
}

function mainlineDoorThreshold(scene: MainlineSceneDefinition, position: Point, actorRadius: number): Point {
  const bounds = expanded(scene.walkBounds, -actorRadius)
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
  tangentPadding = defaultActorRadius + .24,
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
  actorRadius: number,
  collision = passage.collision,
  doorway = passage.doorway,
) {
  const side = passageSide(passage, from, collision, doorway)
  return doorwayBoundaryPoint(mainlinePassageDoorRegion(passage, collision, doorway), from, target, actorRadius, passage.thresholds[side])
}

/**
 * Resolve the first physically clear point on the far side of an opened
 * doorway. This is derived from the compiled collision rectangle, not from
 * an authored target and never becomes the player's destination marker.
 */
export function mainlinePassageExitPoint(passage: MainlineScenePassage, from: Point, actorRadius = defaultActorRadius, collision = passage.collision, doorway = passage.doorway) {
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
  const depth = halfDepth + actorRadius + .12
  return normal.axis === 'x'
    ? { x: center.x + targetDirection * depth, y: center.y }
    : { x: center.x, y: center.y + targetDirection * depth }
}

function passageInteriorPoint(passage: MainlineScenePassage, doorway: CollisionBox, actorRadius: number) {
  const region = mainlinePassageDoorRegion(passage, doorway, doorway)
  const center = {
    x: doorway.x + doorway.width / 2,
    y: doorway.y + doorway.height / 2,
  }
  const halfDepth = region.normal.axis === 'x' ? doorway.width / 2 : doorway.height / 2
  const depth = halfDepth + actorRadius + .12
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
function wallFeatureInteractionTarget(scene: MainlineSceneDefinition, entityId: string, from: Point, actorRadius: number, snapshot?: MainlineSceneGeometrySnapshot) {
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
    const clearance = mainlineWallThickness / 2 + actorRadius + sharedFurnitureGeometry.actorContactGap
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
  const clearance = mainlineWallThickness / 2 + actorRadius + sharedFurnitureGeometry.actorContactGap
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
    const targetOptions = targetGeometry?.sceneId === targetScene.id ? { ...options, geometrySnapshot: targetGeometry } : options
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
    const interiorAnchor = passageInteriorPoint(passage, doorway, options.actorRadius ?? defaultActorRadius)
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
  actorRadius = defaultActorRadius,
): DoorPassageRegion {
  return {
    doorway,
    detection: mainlinePassageDetectionArea(passage, mainlinePassageDetectionDepth, doorway, actorRadius + .24),
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
export function isMainlinePassageInTransitZone(passage: MainlineScenePassage, point: Point, actorRadius = defaultActorRadius, doorway = passage.doorway) {
  return containsPoint(expanded(doorway, actorRadius + .12), point)
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
 * office doors are graph edges; a locked edge is never part of a usable plan.
 */
export function findMainlineRoomPassageSequence(scene: MainlineSceneDefinition, from: Point, target: Point) {
  const startRoom = roomForPoint(scene, from)
  const targetRoom = roomForPoint(scene, target)
  if (!startRoom || !targetRoom || startRoom.id === targetRoom.id) return null

  const edges = scene.passages
    .filter((passage) => passage.routeThrough && !passage.targetSceneId && passage.access === 'open' && passage.fromRoomId && passage.toRoomId)
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
  if (storefront.edge === 'left') return target.x <= bounds.x && target.y >= bounds.y && target.y <= bounds.y + bounds.height
  if (storefront.edge === 'right') return target.x >= bounds.x + bounds.width && target.y >= bounds.y && target.y <= bounds.y + bounds.height
  if (storefront.edge === 'top') return target.y <= bounds.y && target.x >= bounds.x && target.x <= bounds.x + bounds.width
  return target.y >= bounds.y + bounds.height && target.x >= bounds.x && target.x <= bounds.x + bounds.width
}

function routePassageCrossingDistance(scene: MainlineSceneDefinition, path: Point[] | null, passage: MainlineScenePassage, target: Point, options: MainlineNavigationOptions) {
  // Passage selection must be evidence from the route that will actually be
  // walked. A path constructed solely to approach this candidate door is not
  // evidence that the player's click crosses it; using that path here makes a
  // boundary click on the left side falsely select the unrelated secret door.
  if (!path) return null
  const collision = mainlinePassageCollisionForNavigation(scene, passage, options)
  const doorway = mainlinePassageDoorwayForNavigation(scene, passage, options)
  const region = mainlinePassageDoorRegion(passage, collision, doorway)
  const start = path[0]
  const targetBehindThisPassage = start ? isDoorTargetBehind(region, start, target) : false
  if (!targetBehindThisPassage) return null
  const routeDoorway = expanded(region.doorway, defaultActorRadius + .24)
  // A target can be diagonally beyond a door without intending to cross that
  // door. The planned segment must enter the compiled doorway itself; the
  // target's tangent coordinate is not a substitute for that route evidence.
  return pathBoxEntryDistance(path, routeDoorway)
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
  const actorRadius = options.actorRadius ?? defaultActorRadius
  const walkableBounds = expanded(snapshot.walkBounds, -actorRadius)
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
      const region = mainlinePassageDoorRegion(candidate, collision, doorway, options.actorRadius ?? defaultActorRadius)
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
        const region = mainlinePassageDoorRegion(candidate, collision, doorway, options.actorRadius ?? defaultActorRadius)
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

export function findMainlinePathThroughPassage(scene: MainlineSceneDefinition, passageId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const passage = mainlinePassageForId(scene, passageId)
  if (!passage) return { passage: undefined, target: from, path: null }
  const collision = mainlinePassageCollisionForNavigation(scene, passage, options)
  const doorway = mainlinePassageDoorwayForNavigation(scene, passage, options)
  const side = passageSide(passage, from, collision, doorway)
  const target = passageBoundaryPoint(passage, from, passage.crossingTargets[side], options.actorRadius ?? defaultActorRadius, collision, doorway)
  return {
    passage,
    target,
    path: findMainlinePath(from, target, scene, layout, options),
  }
}

export function findMainlinePath(start: Point, target: Point, scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): Point[] | null {
  if (!isWalkableMainlinePoint(start, scene, layout, options)) return null
  if (!isWalkableMainlinePoint(target, scene, layout, options)) return null
  const actorRadius = options.actorRadius ?? defaultActorRadius
  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  return findNavigationPath(start, target, {
    bounds: expanded(snapshot.walkBounds, -actorRadius),
    obstacles: collisionBoxes(scene, layout, options, false),
    obstacleClearance: actorRadius,
  })
}

export function mainlineInteractionTarget(scene: MainlineSceneDefinition, entityId: string, from: Point, layout: SceneLayout = {}, actorRadius = defaultActorRadius, options: MainlineNavigationOptions = {}): Point {
  const entity = scene.objects.find((candidate) => candidate.id === entityId)
  if (!entity) return from
  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  const offset = mainlineLayoutOffsetForEntity(scene, entityId, layout)
  const position = snapshot.objects.get(entityId)?.position ?? { x: entity.position.x + offset.x, y: entity.position.y + offset.y }
  if (entity.kind === 'door') {
    const passage = scene.passages.find((candidate) => candidate.entityId === entityId)
    if (passage) {
      const collision = mainlinePassageCollisionForNavigation(scene, passage, { ...options, geometrySnapshot: snapshot })
      const doorway = mainlinePassageDoorwayForNavigation(scene, passage, { ...options, geometrySnapshot: snapshot })
      const side = passageSide(passage, from, collision, doorway)
      return passageBoundaryPoint(passage, from, passage.crossingTargets[side], actorRadius, collision, doorway)
    }
    return mainlineDoorThreshold(scene, position, actorRadius)
  }
  // Wall-mounted interactive features resolve a contact point along their
  // shared wall edge from the actor's current tangent. Their interaction
  // target is not the wall glyph itself, so the actor stays on the walkable
  // side of the boundary before interacting.
  if (entity.surface === 'wall') {
    const featureTarget = wallFeatureInteractionTarget(scene, entityId, from, actorRadius, snapshot)
    if (featureTarget) return { x: featureTarget.x + offset.x, y: featureTarget.y + offset.y }
    if (options.geometrySnapshot?.sceneId === scene.id) return from
    if (entity.approach) return { x: entity.approach.x + offset.x, y: entity.approach.y + offset.y }
  }
  const collision = snapshot.objects.get(entityId)?.collision ?? mainlineEntityCollision(scene, entity, layout, options.screenMetrics)
  if (!collision) return position

  // Floor furniture may author a front-of-object contact point. Resolve that
  // point through the same screen-specific position projection as the object
  // itself, then accept it only when the shared collision compiler considers
  // it walkable. The edge fallback keeps older floor entities safe.
  if (entity.approach) {
    const authoredPosition = {
      x: entity.position.x + offset.x,
      y: entity.position.y + offset.y,
    }
    const responsiveDelta = {
      x: position.x - authoredPosition.x,
      y: position.y - authoredPosition.y,
    }
    const approach = {
      x: entity.approach.x + offset.x + responsiveDelta.x,
      y: entity.approach.y + offset.y + responsiveDelta.y,
    }
    if (isWalkableMainlinePoint(approach, scene, layout, { ...options, geometrySnapshot: snapshot })) return approach
  }

  return edgeContactPoint(position, collision, from, actorRadius)
}

/** Resolve an authored seat sit point through the shared layout projection. */
export function resolveMainlineSeatSitPosition(scene: MainlineSceneDefinition, seatId: string, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): Point | null {
  const seat = scene.objects.find((candidate) => candidate.id === seatId)
  if (!seat?.seat) return null

  const snapshot = sceneGeometrySnapshot(scene, layout, options)
  const offset = mainlineLayoutOffsetForEntity(scene, seat.id, layout)
  const authoredPosition = { x: seat.position.x + offset.x, y: seat.position.y + offset.y }
  const renderedPosition = snapshot.objects.get(seat.id)?.position ?? authoredPosition
  return {
    x: seat.seat.sit.x + offset.x + (renderedPosition.x - authoredPosition.x),
    y: seat.seat.sit.y + offset.y + (renderedPosition.y - authoredPosition.y),
  }
}

/** Resolve one NPC from its current scene placement, not from NPC identity. */
export function resolveMainlineNpcPosition(scene: MainlineSceneDefinition, npcId: string, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): Point {
  const placement = scene.npcPlacements.find((candidate) => candidate.npcId === npcId)
  if (!placement) return scene.initialPlayerPosition
  if (placement.seatId) return resolveMainlineSeatSitPosition(scene, placement.seatId, layout, options) ?? placement.position ?? scene.initialPlayerPosition
  return placement.position ?? scene.initialPlayerPosition
}

function mainlineNpcInteractionCandidates(scene: MainlineSceneDefinition, npcId: string, from: Point, layout: SceneLayout, actorRadius: number, options: MainlineNavigationOptions) {
  const placement = scene.npcPlacements.find((candidate) => candidate.npcId === npcId)
  const npcPosition = resolveMainlineNpcPosition(scene, npcId, layout, options)
  const npcRadius = sharedFurnitureGeometry.playerRadius
  const collision = {
    x: npcPosition.x - npcRadius,
    y: npcPosition.y - npcRadius,
    width: npcRadius * 2,
    height: npcRadius * 2,
  }
  const dx = from.x - npcPosition.x
  const dy = from.y - npcPosition.y
  const length = Math.hypot(dx, dy)
  const primary = length > .001 ? { x: dx / length, y: dy / length } : defaultEdgeContactDirection
  const clockwise = { x: -primary.y, y: primary.x }
  const counterclockwise = { x: primary.y, y: -primary.x }
  const opposite = { x: -primary.x, y: -primary.y }
  const defaultClockwise = { x: -defaultEdgeContactDirection.y, y: defaultEdgeContactDirection.x }
  const defaultCounterclockwise = { x: defaultEdgeContactDirection.y, y: -defaultEdgeContactDirection.x }
  const defaultOpposite = { x: -defaultEdgeContactDirection.x, y: -defaultEdgeContactDirection.y }
  const directions = [
    primary,
    clockwise,
    counterclockwise,
    opposite,
    defaultEdgeContactDirection,
    defaultOpposite,
    defaultClockwise,
    defaultCounterclockwise,
  ]
  const physicalCandidates = directions.map((direction) => edgeContactPoint(npcPosition, collision, {
    x: npcPosition.x + direction.x,
    y: npcPosition.y + direction.y,
  }, actorRadius))
  // A worker behind a real counter still has one physical customer-side contact
  // point. This belongs to the current scene placement, never NPC identity.
  return placement?.interactionApproach
    ? [placement.interactionApproach, ...physicalCandidates]
    : physicalCandidates
}

/** Keep an interacting protagonist outside the NPC actor footprint and nearby furniture. */
export function mainlineNpcInteractionTarget(scene: MainlineSceneDefinition, npcId: string, from: Point, layout: SceneLayout = {}, actorRadius = defaultActorRadius, options: MainlineNavigationOptions = {}): Point {
  const candidates = mainlineNpcInteractionCandidates(scene, npcId, from, layout, actorRadius, options)
  return candidates.find((candidate) => isWalkableMainlinePoint(candidate, scene, layout, options)) ?? candidates[0] ?? from
}

export function findMainlinePathToNpc(scene: MainlineSceneDefinition, npcId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const actorRadius = options.actorRadius ?? defaultActorRadius
  const candidates = mainlineNpcInteractionCandidates(scene, npcId, from, layout, actorRadius, options)
  for (const target of candidates) {
    if (!isWalkableMainlinePoint(target, scene, layout, options)) continue
    const path = findMainlinePath(from, target, scene, layout, options)
    if (path) return { target, path }
  }
  return { target: candidates[0] ?? from, path: null }
}

export function isMainlineNpcWithinInteractionRange(scene: MainlineSceneDefinition, npcId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const target = mainlineNpcInteractionTarget(scene, npcId, from, layout, options.actorRadius ?? defaultActorRadius, options)
  return Math.hypot(from.x - target.x, from.y - target.y) <= .25
}

export function isMainlineEntityWithinInteractionRange(scene: MainlineSceneDefinition, entityId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const entity = scene.objects.find((candidate) => candidate.id === entityId)
  if (!entity?.interactionRange || entity.surface !== 'wall') return true
  const target = mainlineInteractionTarget(scene, entityId, from, layout, options.actorRadius ?? defaultActorRadius, options)
  return Math.hypot(from.x - target.x, from.y - target.y) <= entity.interactionRange
}

export function findMainlinePathToEntity(scene: MainlineSceneDefinition, entityId: string, from: Point, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
  const target = mainlineInteractionTarget(scene, entityId, from, layout, options.actorRadius ?? defaultActorRadius, options)
  return { target, path: findMainlinePath(from, target, scene, layout, options) }
}
