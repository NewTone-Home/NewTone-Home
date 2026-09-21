import { mainlineWallThickness, type CollisionBox, type Point } from './sceneGeometry'
import type { SceneDoorBehavior } from './sceneDoorConfig'
import { boundaryGridStepsFromScreenSpacing, defaultSceneScreenMetrics } from './sceneBoundaryGrid'
import { createFourSeatFurniture, createSeatGeometry, createTableGeometry, sharedFurnitureGeometry, createTwoSeatFurniture, type SharedSeatDefinition } from './twoSeatFurniture'
import { npcRoles, type NpcRoleDefinition } from './npcRoles'
import type { CommercialCafeStoryStage } from './commercialCafeStory'

export type MainlineSceneId = 'jijia-ancestral-home' | 'jijia-ancestral-interior' | 'commercial-street' | 'commercial-cafe' | 'yonghe-mining-perimeter' | 'yonghe-eatery' | 'zhongshuyuan-passage' | 'zhongshuyuan-office'
export type MainlineEntityKind = 'door' | 'landmark' | 'table' | 'seat' | 'direction' | 'trace' | 'fixture'
export type MainlineEntityWeight = 'gateway' | 'fixture' | 'anchor' | 'minor'
export type MainlineEntitySurface = 'wall' | 'floor'
export type MainlineInteractionBehavior = 'echo-pool' | 'incense' | 'desk-device' | 'blinds-toggle' | 'plant-choice' | 'cafe-order' | 'direct-wall'
export type MainlineVisualProfile = 'tree-ring' | 'incense'
export type MainlineAnimationGroup = 'office-breathing'
export type MainlineSceneExternalExit = {
  id?: string
  axis: 'x' | 'y'
  direction: -1 | 1
  threshold: number
  /** Whether entering this endpoint retracts every scene frame. */
  frameBehavior?: 'none' | 'scene-retract'
  /** Endpoint transitions are owned by the phone, never by the scene itself. */
  transitionBehavior?: 'phone' | 'scene'
  /** Optional canonical boundary entity that owns the exit trigger span. */
  triggerEntityId?: string
  /** Optional tangent-axis span for an opening without an interactive entity. */
  triggerSpan?: { start: number; end: number }
}
export type MainlineSceneDialogueSpeaker = '修杰' | '老周'
export type MainlineSceneDialogueLine = {
  id: string
  speaker: MainlineSceneDialogueSpeaker
  text: string
}
export type MainlineSceneDialogue = {
  /** The scene entity that starts this authored exchange after arrival. */
  triggerEntityId: string
  /** Position and width are authored in the same scene coordinate system as objects. */
  position: Point
  width: number
  lines: readonly MainlineSceneDialogueLine[]
}

/** The existing dialogue surface only needs an interaction owner and ordered lines. */
export type MainlineSceneDialoguePresentation = Pick<MainlineSceneDialogue, 'triggerEntityId' | 'lines'>
export type MainlineFacing = 'north' | 'east' | 'south' | 'west'
export type MainlineStorefrontStyle = 'modern' | 'worn'
export type MainlineStorefrontMode = 'commercial' | 'content' | 'door'
export type MainlineStorefrontRole = 'wall' | 'glass' | 'sign' | 'door' | 'blank'
export type MainlineStorefrontComposition = {
  baseline: readonly MainlineStorefrontRole[]
  near?: readonly MainlineStorefrontRole[]
}
export type MainlineDoorBehavior = SceneDoorBehavior

/** A non-rectangular boundary owned by the same mainline scene contract. */
export type MainlineSceneCurve = {
  id: string
  start: Point
  control: Point
  end: Point
  role: 'glass'
  glyph?: string
  sampleCount?: number
  blocksPlayer?: boolean
}

export type MainlineSceneEntity = {
  id: string
  label: string
  /** Initial visibility follows the original scene story snapshot. */
  visible?: boolean
  /** Stable semantic name; user-facing rendering may provide a shorter display label. */
  displayLabel?: string
  kind: MainlineEntityKind
  weight: MainlineEntityWeight
  surface: MainlineEntitySurface
  position: Point
  approach?: Point
  interactive?: boolean
  collision?: CollisionBox
  /** Use authored furniture occupancy for locomotion instead of the text footprint. */
  movementCollision?: 'text' | 'physical'
  shape?: CollisionBox
  /** Visual occupancy used by scene-anchored text without changing locomotion. */
  visualBounds?: CollisionBox
  visualScale?: number
  /** Maximum authored distance for direct exploration of a wall feature. */
  interactionRange?: number
  /** A small set of authored interaction behaviors used by the generic page flow. */
  interactionBehavior?: MainlineInteractionBehavior
  /** Semantic visual treatment; keeps the renderer independent of authored IDs. */
  visualProfile?: MainlineVisualProfile
  /** Shared presentation timing for a group of authored entities. */
  animationGroup?: MainlineAnimationGroup
  /** Keep furniture at one authored visual state instead of distance-revealing it. */
  visualVisibility?: 'distance' | 'distance-baseline' | 'baseline' | 'static'
  groupId?: string
  facing?: MainlineFacing
  seat?: SharedSeatDefinition
  doorBehavior?: MainlineDoorBehavior
}

/** A scene resident with an NPC role; NPCs are not spatial furniture entities. */
export type MainlineSceneNpc = {
  id: string
  roleId: NpcRoleDefinition['id']
  label: string
  /** Fallback only when this NPC is not seated. */
  position?: Point
  /** An existing seat that owns this static NPC's rendered and navigable position. */
  seatEntityId?: string
  /** Semantic context for future story resolution; never a physical movement target. */
  interactionTargetEntityId: string
}

/** A display-only item anchored to an existing spatial entity. */
export type MainlineSceneAttachedProp = {
  id: string
  label: string
  parentEntityId: string
  offset: Point
  /** A future interaction resolves through this spatial parent, never the prop itself. */
  interactionTargetEntityId: string
  /** Currently used by commercial-cafe to reveal a prop after its story beat. */
  visibleFromStage?: CommercialCafeStoryStage
}

export type MainlineWallOpening = {
  edge: 'top' | 'right' | 'bottom' | 'left'
  start: number
  end: number
  doorId?: string
  /** Number of neighbouring frame cells reserved around a door. */
  doorFlankCount?: number
  /** Keep the passage geometry without rendering a door at this opening. */
  transitionOnly?: boolean
  label?: string
  displayLabel?: string
  labelLayout?: 'center' | 'split'
  labelGapCells?: number
  /** Allocate this opening after a feature on the same complete frame. */
  afterFeatureId?: string
  /** Number of frame cells left between the feature content and this opening. */
  gapCells?: number
  doorBehavior?: SceneDoorBehavior
}

export type MainlineWallCollision = CollisionBox & {
  id: string
  sourceWallId: string
  edge: MainlineWallOpening['edge']
}

export type MainlineWallFeature = {
  id: string
  edge: MainlineWallOpening['edge']
  start: number
  end: number
  glyphs: readonly string[]
  layout?: 'inline' | 'content'
  entityId?: string
}

export type MainlineStorefrontSlotBlueprint = {
  id: string
  wallId: string
  edge: MainlineWallOpening['edge']
  start: number
  end: number
  label: string
  style: MainlineStorefrontStyle
  mode?: MainlineStorefrontMode
  composition?: MainlineStorefrontComposition
  portalId?: string
  nearRadius?: number
  approach?: Point
}

export type MainlineStorefrontSlot = Omit<MainlineStorefrontSlotBlueprint, 'mode'> & {
  mode: MainlineStorefrontMode
}

type MainlineWallFeatureBlueprint = Omit<MainlineWallFeature, 'entityId'> & {
  entity?: MainlineSceneEntity
}

export type MainlineWallDensity = {
  horizontalBaselineEvery: number
  verticalBaselineEvery: number
}

export type MainlineFurnitureGroup = {
  id: string
  anchor: Point
  entityIds: readonly string[]
  layout?: 'free' | 'altar-ring'
  facing?: MainlineFacing
}

export type MainlineAltarBlueprint = {
  id: string
  anchor: Point
  facing: MainlineFacing
  offeringTableIds: readonly [string, string, string, string]
  incenseBurnerId: string
  tableDistance?: number
  /** Scene-specific clear space between the offering tables and burner. */
  tableGap?: number
  tableWidth?: number
  tableDepth?: number
  burnerSize?: number
}

export type MainlineScenePassage = {
  id: string
  portalId: string
  entityId: string
  /** Optional destination scene for a true cross-scene passage. */
  targetSceneId?: MainlineSceneId
  /** Allow a same-scene route to enter this passage's shared door lifecycle. */
  routeThrough?: boolean
  /** Whether this passage retracts only its own frame or the whole scene. */
  frameBehavior?: 'independent' | 'scene-retract'
  /** Optional room graph endpoints for same-scene multi-door planning. */
  fromRoomId?: string
  toRoomId?: string
  thresholds: readonly [Point, Point]
  crossingTargets: readonly [Point, Point]
  /** The physical door cell used by lifecycle occupancy and detection. */
  doorway: CollisionBox
  /** The full compiled replacement cleared when this passage is open. */
  collision: CollisionBox
  transitionText: string
  access: 'open' | 'locked'
  lockedText?: string
  lockedTextPool?: readonly string[]
  entryPosition?: Point
}

export type MainlineAirWall = CollisionBox & {
  id: string
  opensWithPassageId?: string
}

/**
 * Fixed rooms and long maps share the same scene contract, but not the same
 * camera behaviour. Keeping the policy on scene data prevents renderer-side
 * scene-id exceptions from moving one room independently of another.
 */
export type MainlineSceneViewport = 'fixed-frame' | 'follow-player'

type MainlineWallBlueprint = {
  id: string
  type: 'frame' | 'room' | 'lane' | 'alley'
  bounds: CollisionBox
  variant?: string
  boundaryGeometrySource?: 'anchor' | 'cell-range'
  boundaryCoordinateCount?: { horizontal?: number; vertical?: number }
  /** Refit fixed boundary coordinates to the measured stage spacing. */
  boundaryProjection?: 'screen-spacing'
  boundaryVisualEndpoints?: {
    horizontal?: { start?: 'omit'; end?: 'omit' }
    vertical?: { start?: 'omit'; end?: 'omit' }
  }
  /** Glyph cycle for a wall strip that uses the same shared collision lattice. */
  wallGlyphs?: readonly string[]
  edges?: readonly MainlineWallOpening['edge'][]
  openings?: readonly MainlineWallOpening[]
  features?: readonly MainlineWallFeatureBlueprint[]
}

export type MainlineSceneData = {
  walkBounds: CollisionBox
  viewport?: MainlineSceneViewport
  externalExit?: MainlineSceneExternalExit
  externalExits?: readonly MainlineSceneExternalExit[]
  rooms?: readonly MainlineSceneRoom[]
  wallDensity?: MainlineWallDensity
  walls: readonly MainlineWallBlueprint[]
  storefronts?: readonly MainlineStorefrontSlotBlueprint[]
  altars?: readonly MainlineAltarBlueprint[]
  floorEntities: readonly MainlineSceneEntity[]
  npcs?: readonly MainlineSceneNpc[]
  attachedProps?: readonly MainlineSceneAttachedProp[]
  curves?: readonly MainlineSceneCurve[]
  airWalls?: readonly MainlineAirWall[]
  blockers: readonly (CollisionBox & { id: string })[]
  furnitureGroups: readonly MainlineFurnitureGroup[]
  initialPlayerPosition: Point
  /** Explicit arrival point for a ride/map jump; never reused as a door return point. */
  rideArrivalPosition?: Point
}

export type MainlineScenePortalEndpointBlueprint = {
  doorPosition: Point
  threshold: Point
  crossingTarget: Point
  entryPosition?: Point
}

export type MainlineScenePortalBlueprint = {
  id: string
  entity: Omit<MainlineSceneEntity, 'position'>
  endpoint: MainlineScenePortalEndpointBlueprint
  /** Optional destination scene for a true cross-scene passage. */
  targetSceneId?: MainlineSceneId
  /** Allow a same-scene route to enter this passage's shared door lifecycle. */
  routeThrough?: boolean
  frameBehavior?: 'independent' | 'scene-retract'
  fromRoomId?: string
  toRoomId?: string
  wallOpenings?: readonly {
    wallId: string
    opening: MainlineWallOpening
  }[]
  transitionText: string
  access: 'open' | 'locked'
  lockedText?: string
  lockedTextPool?: readonly string[]
}

export type MainlineSceneRoom = {
  id: string
  bounds: CollisionBox
  kind?: 'room' | 'corridor' | 'boundary'
}

export type MainlineSceneBlueprint = {
  id: MainlineSceneId
  title: string
  subtitle: string
  statusLabel: string
  hint: string
  entryFeedback?: string
  areaLabel?: string | ((position: Point) => string)
  scene: MainlineSceneData
  portals: readonly MainlineScenePortalBlueprint[]
  interactionText: Readonly<Record<string, string>>
  explorationText?: Readonly<Record<string, readonly string[]>>
  explorationChoices?: Readonly<Record<string, { text: string; options: readonly string[] }>>
  echoPool?: readonly string[]
  dialogue?: MainlineSceneDialogue
}

const box = (x: number, y: number, width: number, height: number): CollisionBox => ({ x, y, width, height })
const authoredPoint = (x: number, y: number): Point => ({ x, y })

const floor = (entity: Omit<MainlineSceneEntity, 'surface'>): MainlineSceneEntity => ({
  ...entity,
  surface: 'floor',
})
const wallEntity = (entity: Omit<MainlineSceneEntity, 'surface'>): MainlineSceneEntity => ({ ...entity, surface: 'wall' })

type MainlineFurnitureGeometryOverrides = {
  seatGap?: number
  pulledSeatGap?: number
  sitSeatGap?: number
  tablePairOffset?: number
  seatPairOffset?: number
}

function mainlineTwoSeatFurniture(
  groupId: string,
  anchor: Point,
  tableApproach: Point,
  ids: { tableId?: string; seatIds?: readonly [string, string] } = {},
  geometry: MainlineFurnitureGeometryOverrides = {},
) {
  const tableId = ids.tableId ?? `${groupId}-table`
  const seatIds = ids.seatIds ?? [`${groupId}-chair-top`, `${groupId}-chair-bottom`] as [string, string]
  const furniture = createTwoSeatFurniture({
    groupId,
    anchor,
    tableId,
    seatIds,
    tableApproach,
    ...geometry,
  })
  const table = floor({
    id: furniture.table.id,
    label: '桌子',
    kind: 'table',
    weight: 'anchor',
    position: furniture.table.position,
    approach: furniture.table.approach,
    collision: furniture.table.collision,
    shape: furniture.table.collision,
    groupId,
  })
  const chairs = furniture.seats.map((seat) => floor({
    id: seat.id,
    label: '椅子',
    kind: 'seat',
    weight: 'minor',
    position: seat.rest,
    approach: seat.sit,
    collision: seat.collision,
    shape: seat.collision,
    groupId,
    seat,
  }))
  return {
    group: { id: groupId, anchor, entityIds: [table.id, ...chairs.map((chair) => chair.id)] },
    entities: [table, ...chairs],
  }
}

function mainlineFourSeatFurniture(
  groupId: string,
  anchor: Point,
  tableApproach: Point,
  ids: { tableId?: string; seatIds?: readonly [string, string, string, string] } = {},
  geometry: MainlineFurnitureGeometryOverrides = {},
) {
  const tableId = ids.tableId ?? `${groupId}-table`
  const seatIds = ids.seatIds ?? [`${groupId}-chair-top`, `${groupId}-chair-right`, `${groupId}-chair-bottom`, `${groupId}-chair-left`] as [string, string, string, string]
 const furniture = createFourSeatFurniture({ groupId, anchor, tableId, seatIds, tableApproach, ...geometry })
  const tables = furniture.tables.map((table) => floor({
    id: table.id,
    label: '桌子',
    kind: 'table',
    weight: 'anchor',
    position: table.position,
    approach: table.approach,
    collision: table.collision,
    shape: table.collision,
    groupId,
  }))
  const chairs = furniture.seats.map((seat) => floor({
    id: seat.id,
    label: '椅子',
    kind: 'seat',
    weight: 'minor',
    position: seat.rest,
    approach: seat.sit,
    collision: seat.collision,
    shape: seat.collision,
    groupId,
    seat,
  }))
  return {
    group: { id: groupId, anchor, entityIds: [...tables.map((table) => table.id), ...chairs.map((chair) => chair.id)] },
    entities: [...tables, ...chairs],
  }
}

const commercialStorefrontStarts = [14, 36, 58, 80, 102, 124, 146, 168] as const

function storefrontRow(
  prefix: string,
  wallId: string,
  edge: MainlineWallOpening['edge'],
  labels: readonly string[],
  style: MainlineStorefrontStyle,
  starts: readonly number[],
  span: number,
  portal?: { index: number; portalId: string; nearRadius?: number; mode?: MainlineStorefrontMode },
  composition?: MainlineStorefrontComposition,
  mode: MainlineStorefrontMode = 'commercial',
): MainlineStorefrontSlotBlueprint[] {
  return labels.map((label, index) => ({
    id: `${prefix}-slot-${index + 1}`,
    wallId,
    edge,
    start: starts[index],
    end: starts[index] + span,
    label,
    style,
    mode: portal?.index === index ? portal.mode ?? mode : mode,
    ...(composition ? { composition } : {}),
    ...(portal?.index === index ? { portalId: portal.portalId, nearRadius: portal.nearRadius } : {}),
  }))
}

function quarterTurnOffset(offset: Point, facing: MainlineFacing): Point {
  if (facing === 'east') return { x: -offset.y, y: offset.x }
  if (facing === 'south') return { x: -offset.x, y: -offset.y }
  if (facing === 'west') return { x: offset.y, y: -offset.x }
  return offset
}

const facingOrder: readonly MainlineFacing[] = ['north', 'east', 'south', 'west']

function rotatedFacing(base: MainlineFacing, groupFacing: MainlineFacing): MainlineFacing {
  const baseIndex = facingOrder.indexOf(base)
  const groupIndex = facingOrder.indexOf(groupFacing)
  return facingOrder[(baseIndex + groupIndex) % facingOrder.length]
}

function altarTableEntity(
  altar: MainlineAltarBlueprint,
  index: number,
  base: { id: string; offset: Point; facing: MainlineFacing },
  tableWidth: number,
  tableDepth: number,
  burnerSize: number,
): MainlineSceneEntity {
  const isHorizontal = Math.abs(base.offset.x) >= Math.abs(base.offset.y)
  const direction = isHorizontal ? Math.sign(base.offset.x) : Math.sign(base.offset.y)
  const configuredDistance = altar.tableDistance ?? Math.hypot(base.offset.x, base.offset.y)
  const gridSteps = boundaryGridStepsFromScreenSpacing()
  const gridStep = isHorizontal ? gridSteps.horizontal : gridSteps.vertical
  const clearanceDistance = tableDepth / 2 + burnerSize / 2 + (altar.tableGap ?? gridStep)
  const distance = Math.max(configuredDistance, clearanceDistance)
  const offset = isHorizontal
    ? { x: direction * distance, y: base.offset.y }
    : { x: base.offset.x, y: direction * distance }
  const center = {
    x: altar.anchor.x + quarterTurnOffset(offset, altar.facing).x,
    y: altar.anchor.y + quarterTurnOffset(offset, altar.facing).y,
  }
  const facing = rotatedFacing(base.facing, altar.facing)
  const swapDimensions = facing === 'east' || facing === 'west'
  const width = swapDimensions ? tableDepth : tableWidth
  const height = swapDimensions ? tableWidth : tableDepth
  const collision = box(center.x - width / 2, center.y - height / 2, width, height)
  return floor({
    id: altar.offeringTableIds[index],
    label: '供桌',
    kind: 'table',
    weight: 'anchor',
    position: center,
    collision,
    movementCollision: 'physical',
    shape: collision,
    visualVisibility: 'distance',
    groupId: altar.id,
    facing,
  })
}

function createAltarFurniture(altar: MainlineAltarBlueprint) {
  const tableDistance = altar.tableDistance ?? 9
  const tableWidth = altar.tableWidth ?? 14
  const tableDepth = altar.tableDepth ?? 4
  const burnerSize = altar.burnerSize ?? 4
  const tableBases = [
    { id: 'north', offset: { x: 0, y: -tableDistance }, facing: 'south' as const },
    { id: 'east', offset: { x: tableDistance, y: 0 }, facing: 'west' as const },
    { id: 'south', offset: { x: 0, y: tableDistance }, facing: 'north' as const },
    { id: 'west', offset: { x: -tableDistance, y: 0 }, facing: 'east' as const },
  ]
  const tables = tableBases.map((base, index) => altarTableEntity(altar, index, base, tableWidth, tableDepth, burnerSize))
  const burnerCollision = box(altar.anchor.x - burnerSize / 2, altar.anchor.y - burnerSize / 2, burnerSize, burnerSize)
  const burner = floor({
    id: altar.incenseBurnerId,
    label: '香炉',
    kind: 'fixture',
    weight: 'fixture',
    position: altar.anchor,
    collision: burnerCollision,
    movementCollision: 'physical',
    shape: burnerCollision,
    groupId: altar.id,
    facing: altar.facing,
    interactionBehavior: 'incense',
    visualProfile: 'incense',
  })
  return {
    group: {
      id: altar.id,
      anchor: altar.anchor,
      entityIds: [...tables.map((table) => table.id), burner.id],
      layout: 'altar-ring' as const,
      facing: altar.facing,
    },
    entities: [...tables, burner],
  }
}

function wallEdgePoint(bounds: CollisionBox, edge: MainlineWallOpening['edge'], axis: number): Point {
  if (edge === 'left') return { x: bounds.x, y: axis }
  if (edge === 'right') return { x: bounds.x + bounds.width, y: axis }
  if (edge === 'top') return { x: axis, y: bounds.y }
  return { x: axis, y: bounds.y + bounds.height }
}

function evenlySpacedWallAxes(start: number, end: number, count: number) {
  const safeCount = Math.max(0, Math.floor(count))
  if (safeCount === 0) return []
  if (safeCount === 1) return [(start + end) / 2]
  return Array.from({ length: safeCount }, (_, index) => (
    start + ((end - start) * (index + 1)) / (safeCount + 1)
  ))
}

function inlinePortraitFeature(
  id: string,
  bounds: CollisionBox,
  edge: MainlineWallOpening['edge'],
  axis: number,
): MainlineWallFeatureBlueprint {
  const position = wallEdgePoint(bounds, edge, axis)
  return {
    id,
    edge,
    start: axis - .5,
    end: axis + .5,
    glyphs: ['画', '像'],
    layout: 'inline',
    entity: wallEntity({ id, label: '画像', kind: 'landmark', weight: 'minor', position, interactive: false, interactionRange: 7, interactionBehavior: 'direct-wall' }),
  }
}

// One authored café layout owns every floor zone and furniture anchor. The
// renderer consumes this shared scene data; it does not arrange a second café
// layout in screen coordinates.
const commercialCafeLayout = {
  bounds: box(8, 7, 90, 86),
  straightFrameBounds: box(8, 7, 80, 86),
  entranceY: 68,
  centralWaitingFloor: box(35, 38, 33, 31),
  entranceCorridor: box(8, 64, 20, 18),
  service: {
    // Keep the service zone visually attached to the rear wall instead of
    // leaving the counter floating in the upper half of the room.
    staff: authoredPoint(35, 25),
    staffApproach: authoredPoint(43, 31),
    staffOnly: box(11, 17, 35, 8.5),
  },
  glass: {
    start: authoredPoint(88, 7),
    control: authoredPoint(98, 50),
    end: authoredPoint(88, 93),
  },
  bottomFourSeatTables: [
    { id: 'commercial-cafe-bottom-left-group', anchor: authoredPoint(24, 72), approach: authoredPoint(24, 63) },
    { id: 'commercial-cafe-bottom-center-group', anchor: authoredPoint(42, 72), approach: authoredPoint(42, 63) },
    { id: 'commercial-cafe-bottom-right-group', anchor: authoredPoint(60, 72), approach: authoredPoint(60, 63) },
  ],
  rightTwoSeatTables: [
    { id: 'commercial-cafe-right-inner-upper-group', anchor: authoredPoint(72, 26), approach: authoredPoint(64, 26) },
    { id: 'commercial-cafe-right-inner-middle-group', anchor: authoredPoint(72, 50), approach: authoredPoint(64, 50) },
    { id: 'commercial-cafe-right-inner-lower-group', anchor: authoredPoint(72, 74), approach: authoredPoint(64, 74) },
    { id: 'commercial-cafe-right-window-upper-group', anchor: authoredPoint(84, 26), approach: authoredPoint(76, 26) },
    { id: 'commercial-cafe-right-window-lower-group', anchor: authoredPoint(84, 74), approach: authoredPoint(76, 74) },
  ],
  plants: {
    upper: { position: authoredPoint(84, 14), approach: authoredPoint(81, 14), collision: box(82.8, 13, 2.4, 2) },
    lower: { position: authoredPoint(84, 86), approach: authoredPoint(81, 86), collision: box(82.8, 85, 2.4, 2) },
  },
} as const

const commercialCafeFurnitureGeometry = {
  seatGap: 4.4,
  tablePairOffset: 3.15,
  seatPairOffset: 3.15,
} as const

const commercialCafeBounds = commercialCafeLayout.bounds
const commercialCafeStraightFrameBounds = commercialCafeLayout.straightFrameBounds
const commercialCafeDoorY = commercialCafeLayout.entranceY
// Keep both a cold start and a street-to-café arrival safely inside the room.
// The door glyph occupies the outer wall cell; spawning on that same cell
// places the protagonist inside the door hit area before navigation begins.
const commercialCafeEntryX = 18
const commercialCafeEntryPosition = authoredPoint(commercialCafeEntryX, commercialCafeDoorY)
// The street storefront is a separate boundary from the café interior. Keep
// its doorway on the commercial-street lane center; the interior entrance
// remains owned by commercialCafeLayout above.
const commercialStreetCafeDoorY = 50
const commercialStreetCafeDoorStart = commercialStreetCafeDoorY - 4.5
const commercialStreetCafeDoorEnd = commercialStreetCafeDoorY + 4.5
// Return to the commercial-street lane just before the café terminal. This
// must remain separate from commercialCafeEntryPosition, which is authored
// inside the café and is not walkable in the street scene.
const commercialStreetCafeEntryPosition = authoredPoint(184, commercialStreetCafeDoorY)
const commercialCafeMenu = wallEntity({ id: 'commercial-cafe-menu', label: '菜单', kind: 'fixture', weight: 'fixture', position: authoredPoint(18, 7), approach: authoredPoint(18, 10), interactive: true })
const commercialCafeBlackboard = wallEntity({ id: 'commercial-cafe-blackboard', label: '黑板', kind: 'fixture', weight: 'fixture', position: authoredPoint(32, 7), approach: authoredPoint(32, 10), interactive: true })
const commercialCafeFurniture = [
  ...commercialCafeLayout.bottomFourSeatTables.map(({ id, anchor, approach }) => mainlineFourSeatFurniture(id, anchor, approach, {}, commercialCafeFurnitureGeometry)),
  ...commercialCafeLayout.rightTwoSeatTables.map(({ id, anchor, approach }) => mainlineTwoSeatFurniture(id, anchor, approach, {}, commercialCafeFurnitureGeometry)),
]
const commercialCafeFurnitureEntities = commercialCafeFurniture
  .flatMap(({ entities }) => entities)
  .map((entity) => ({ ...entity, visualVisibility: 'baseline' as const }))
const commercialCafeCounterY = 20
const commercialCafeCounterReferencePositions = [12, 16, 20, 24, 28, 32, 36, 40, 44, 48] as const
// Counter segments follow the same horizontal pitch as the wall lattice. The
// counter remains a continuous authored span, but it must not be denser than
// the surrounding wall glyphs.
const commercialCafeCounterFixtureFontPx = Math.max(9, Math.min(16, defaultSceneScreenMetrics.width * .0115))
const commercialCafeCounterLabelWidth = (commercialCafeCounterFixtureFontPx * 2 / defaultSceneScreenMetrics.width) * 100
// A counter cell carries the two-character label and a small visual seam. Its
// authored pitch is therefore wider than one wall glyph cell, while the
// collision span remains the same continuous cell geometry.
const commercialCafeCounterCellWidth = Number(Math.max(
  boundaryGridStepsFromScreenSpacing().horizontal,
  commercialCafeCounterLabelWidth + .1,
).toFixed(4))
const commercialCafeCounterWallInset = mainlineWallThickness / 2
const commercialCafeCounterStart = commercialCafeStraightFrameBounds.x + commercialCafeCounterWallInset + commercialCafeCounterCellWidth / 2
const commercialCafeCounterEnd = commercialCafeCounterReferencePositions[commercialCafeCounterReferencePositions.length - 1] + (commercialCafeCounterReferencePositions[1] - commercialCafeCounterReferencePositions[0]) / 2 + commercialCafeCounterWallInset
const commercialCafeCounterPositions = Array.from(
  { length: Math.round((commercialCafeCounterEnd - commercialCafeCounterStart) / commercialCafeCounterCellWidth) },
  (_, index) => commercialCafeCounterStart + index * commercialCafeCounterCellWidth,
)
const commercialCafeCounterEntities = commercialCafeCounterPositions.map((x, index) => floor({
  id: index === 4 ? 'commercial-cafe-counter' : `commercial-cafe-counter-${index + 1}`,
  label: '柜台',
  kind: 'fixture',
  weight: 'fixture',
  position: authoredPoint(x, commercialCafeCounterY),
  approach: authoredPoint(x, 34),
  collision: box(x - commercialCafeCounterCellWidth / 2, 29.65, commercialCafeCounterCellWidth, 2.7),
  shape: box(x - commercialCafeCounterCellWidth / 2, 29.65, commercialCafeCounterCellWidth, 2.7),
  interactionBehavior: 'cafe-order',
  visualVisibility: 'baseline',
}))
const commercialCafeStoryTableId = 'commercial-cafe-right-window-upper-group-table'
const commercialCafeNpcs = [
  {
    id: npcRoles.laoZhou.id,
    roleId: npcRoles.laoZhou.id,
    label: npcRoles.laoZhou.label,
    // The upper seat of the existing window-side two-seat table.
    seatEntityId: 'commercial-cafe-right-window-upper-group-chair-top',
    interactionTargetEntityId: commercialCafeStoryTableId,
  },
  {
    id: npcRoles.server.id,
    roleId: npcRoles.server.id,
    label: npcRoles.server.label,
    position: commercialCafeLayout.service.staff,
    interactionTargetEntityId: 'commercial-cafe-counter',
  },
] as const satisfies readonly MainlineSceneNpc[]
const commercialCafeAttachedProps = [
  {
    id: 'commercial-cafe-coffee',
    label: '咖啡',
    parentEntityId: commercialCafeStoryTableId,
    offset: authoredPoint(-.8, .4),
    interactionTargetEntityId: commercialCafeStoryTableId,
    visibleFromStage: 'coffee-delivered',
  },
] as const satisfies readonly MainlineSceneAttachedProp[]
const commercialCafeWindow: MainlineSceneCurve = { id: 'commercial-cafe-glass-front', ...commercialCafeLayout.glass, role: 'glass', glyph: '窗', sampleCount: 26, blocksPlayer: true }

// The storefront rows are visible boundary lines, but the space behind those
// lines is still part of the scene's click surface. Compile that hidden side
// as air walls so a click behind a facade walks to the facade and stops. The
// only deliberate gap is the terminal's cafe doorway corridor.
const commercialStreetFacadeAirWalls: readonly MainlineAirWall[] = [
  { id: 'commercial-north-facade-air-wall', ...box(8, 10, 192, 25.3) },
  { id: 'commercial-south-facade-air-wall-left', ...box(8, 64.7, 180, 25.3) },
]

const commercialStreetBlueprint: MainlineSceneBlueprint = {
  id: 'commercial-street',
  title: '第一章 · 商业街',
  subtitle: '两侧连续的现代临街店面夹出一条主通道，尽头接入独立的咖啡馆场景。',
  statusLabel: '里世界',
  hint: '沿中间主通道前进；右侧尾端的咖啡馆是独立场景，门只在路线真正通过时打开。',
  entryFeedback: '从商业街右侧尾端进入，咖啡馆店面就在右侧。',
  areaLabel: (position) => position.x >= 140 ? '商业街尾端' : '里世界',
  scene: {
    walkBounds: box(8, 10, 192, 80),
    externalExit: { axis: 'x', direction: -1, threshold: 12 },
    wallDensity: { horizontalBaselineEvery: 1, verticalBaselineEvery: 1 },
    walls: [
      { id: 'commercial-north-facade', type: 'room', bounds: box(12, 14, 180, 22), variant: 'shop-row', edges: ['bottom'] },
      { id: 'commercial-main-lane', type: 'lane', bounds: box(12, 36, 176, 28), edges: [] },
      { id: 'commercial-south-facade', type: 'room', bounds: box(12, 64, 180, 22), variant: 'shop-row', edges: ['top'] },
      { id: 'commercial-cafe-terminal', type: 'frame', bounds: box(188, 36, 4, 28), variant: 'terminal', edges: ['right'] },
    ],
    storefronts: [
      ...storefrontRow('commercial-north', 'commercial-north-facade', 'bottom', ['服装店', '服装店', '鞋包店', '服装店', '饰品店', '服装店', '定制店', '书店'], 'modern', commercialStorefrontStarts, 18),
      ...storefrontRow('commercial-south', 'commercial-south-facade', 'top', ['服装店', '鞋包店', '服装店', '服装店', '服装店', '珠宝店', '服装店', '服装店'], 'modern', commercialStorefrontStarts, 18),
      { id: 'commercial-cafe-slot', wallId: 'commercial-cafe-terminal', edge: 'right', label: '咖啡馆', style: 'modern', composition: { baseline: ['sign'], near: ['wall', 'door', 'wall'] }, portalId: 'street-cafe-entry', nearRadius: 10, start: commercialStreetCafeDoorStart, end: commercialStreetCafeDoorEnd, approach: authoredPoint(186, commercialStreetCafeDoorY) },
    ],
    floorEntities: [], airWalls: commercialStreetFacadeAirWalls, blockers: [], furnitureGroups: [], initialPlayerPosition: authoredPoint(34, 50),
  },
  portals: [{
    id: 'street-cafe-entry',
    entity: { id: 'street-cafe-entry', label: '门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'double', openLeaves: 'both' } },
    endpoint: { doorPosition: authoredPoint(192, commercialStreetCafeDoorY), threshold: authoredPoint(188, commercialStreetCafeDoorY), crossingTarget: authoredPoint(190, commercialStreetCafeDoorY), entryPosition: authoredPoint(14, commercialCafeDoorY) },
    targetSceneId: 'commercial-cafe', wallOpenings: [], transitionText: '修杰穿过商业街尾端的门，进入咖啡馆。', access: 'open',
  }],
  interactionText: { 'street-cafe-entry': '咖啡馆是独立场景，入口沿用主线门和寻路契约。' },
}

const commercialCafeBlueprint: MainlineSceneBlueprint = {
  id: 'commercial-cafe', title: '第二章 · 咖啡馆',
  subtitle: '独立的咖啡馆室内；墙、曲线窗格、菜单、黑板、柜台和桌椅都由主线场景契约直接编译。',
  statusLabel: '商业街 / 咖啡馆', hint: '入口在左侧；右侧弧形玻璃是窗边界，菜单和黑板在后墙，后门暂时受权限控制。',
  entryFeedback: '进入咖啡馆，商业街在身后。',
  areaLabel: '咖啡馆',
  scene: {
    walkBounds: commercialCafeBounds, wallDensity: { horizontalBaselineEvery: 1, verticalBaselineEvery: 1 },
    viewport: 'fixed-frame',
    walls: [{ id: 'commercial-cafe-room', type: 'room', bounds: commercialCafeStraightFrameBounds, variant: 'cafe', edges: ['top', 'bottom', 'left'], features: [
      { id: 'commercial-cafe-menu-feature', edge: 'top', start: 15, end: 21, glyphs: ['菜', '单'], layout: 'inline', entity: commercialCafeMenu },
      { id: 'commercial-cafe-blackboard-feature', edge: 'top', start: 29, end: 35, glyphs: ['黑', '板'], layout: 'inline', entity: commercialCafeBlackboard },
    ] }],
    floorEntities: [
      ...commercialCafeCounterEntities,
      floor({ id: 'commercial-cafe-plant-upper', label: '绿植', kind: 'fixture', weight: 'minor', position: commercialCafeLayout.plants.upper.position, approach: commercialCafeLayout.plants.upper.approach, collision: commercialCafeLayout.plants.upper.collision, shape: commercialCafeLayout.plants.upper.collision, visualVisibility: 'baseline' }),
      floor({ id: 'commercial-cafe-plant-lower', label: '绿植', kind: 'fixture', weight: 'minor', position: commercialCafeLayout.plants.lower.position, approach: commercialCafeLayout.plants.lower.approach, collision: commercialCafeLayout.plants.lower.collision, shape: commercialCafeLayout.plants.lower.collision, visualVisibility: 'baseline' }),
      ...commercialCafeFurnitureEntities,
    ],
    npcs: commercialCafeNpcs,
    attachedProps: commercialCafeAttachedProps,
    curves: [commercialCafeWindow], blockers: [{ id: 'commercial-cafe-staff-only', ...commercialCafeLayout.service.staffOnly }], furnitureGroups: commercialCafeFurniture.map(({ group }) => group), initialPlayerPosition: commercialCafeEntryPosition,
  },
  portals: [{
    id: 'street-cafe-entry',
    entity: { id: 'street-cafe-entry', label: '门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'double', openLeaves: 'both' } },
    endpoint: { doorPosition: authoredPoint(8, commercialCafeDoorY), threshold: authoredPoint(12, commercialCafeDoorY), crossingTarget: authoredPoint(10, commercialCafeDoorY), entryPosition: commercialStreetCafeEntryPosition },
    targetSceneId: 'commercial-street', wallOpenings: [{ wallId: 'commercial-cafe-room', opening: { edge: 'left', start: 63.5, end: 72.5, doorId: 'street-cafe-entry', label: '门', displayLabel: '门', labelLayout: 'center' } }], transitionText: '修杰从咖啡馆返回商业街。', access: 'open',
  }, {
    id: 'cafe-back-door',
    entity: { id: 'cafe-back-door', label: '后门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'double', openLeaves: 'both' } },
    endpoint: { doorPosition: authoredPoint(48, 7), threshold: authoredPoint(48, 12), crossingTarget: authoredPoint(48, 9) },
    wallOpenings: [{ wallId: 'commercial-cafe-room', opening: { edge: 'top', start: 46, end: 50, doorId: 'cafe-back-door', label: '后门', displayLabel: '门', labelLayout: 'center' } }], transitionText: '后门暂时没有开放的去处。', access: 'locked', lockedText: '后门暂未开启，当前权限不足。',
  }],
  interactionText: {
    'street-cafe-entry': '入口已经接入商业街，咖啡馆内部和主线使用同一套空间规则。', 'commercial-cafe-counter': '柜台位于店内前侧。', 'commercial-cafe-server': '店员在柜台附近工作。', 'commercial-cafe-menu': '菜单挂在后墙上。', 'commercial-cafe-blackboard': '黑板挂在菜单旁边。', 'commercial-cafe-plant-upper': '靠窗的绿植留在通道边缘。', 'commercial-cafe-plant-lower': '另一盆绿植靠着玻璃边。', 'cafe-back-door': '后门暂未开启，当前权限不足。',
  },
}

const jijiaAltarBlueprint: MainlineAltarBlueprint = {
  id: 'jijia-altar-group',
  anchor: { x: 55, y: 50 },
  facing: 'north',
  offeringTableIds: [
    'jijia-offering-table-north',
    'jijia-offering-table-east',
    'jijia-offering-table-south',
    'jijia-offering-table-west',
  ],
  incenseBurnerId: 'jijia-incense-burner',
  tableDistance: 4,
  // Keep the burner reachable from the diagonal side positions without
  // leaving a straight walkable lane between it and the offering tables.
  tableGap: 0,
  tableWidth: 6,
  tableDepth: 4,
  burnerSize: 4,
}

const jijiaAltarFurniture = createAltarFurniture(jijiaAltarBlueprint)

const jijiaYardBounds = box(10, 18, 90, 64)
const jijiaYardCenter = {
  x: jijiaYardBounds.x + jijiaYardBounds.width / 2,
  y: jijiaYardBounds.y + jijiaYardBounds.height / 2,
}
const jijiaOldTreeCollision = box(jijiaYardCenter.x - 2, jijiaYardCenter.y - 2, 4, 4)
const jijiaYardWallSteps = boundaryGridStepsFromScreenSpacing()
const jijiaOldTreeStoneOffsets = ([
  ['n-2', -2, -1], ['n-1', -1, -1], ['n', 0, -1], ['n+1', 1, -1], ['n+2', 2, -1],
  ['e', 2, 0],
  ['s-2', 2, 1], ['s-1', 1, 1], ['s', 0, 1], ['s+1', -1, 1], ['s+2', -2, 1],
  ['w', -2, 0],
] as const)
const jijiaOldTreeStoneRing: readonly MainlineSceneEntity[] = jijiaOldTreeStoneOffsets.map(([side, x, y]) => floor({
  id: `jijia-old-tree-stone-${side}`,
  label: '石',
  kind: 'fixture',
  weight: 'minor',
  position: { x: jijiaYardCenter.x + x * jijiaYardWallSteps.horizontal, y: jijiaYardCenter.y + y * jijiaYardWallSteps.vertical },
  interactive: false,
  visualProfile: 'tree-ring',
  visualBounds: box(
    jijiaYardCenter.x + x * jijiaYardWallSteps.horizontal - 1.25,
    jijiaYardCenter.y + y * jijiaYardWallSteps.vertical - 1.25,
    2.5,
    2.5,
  ),
  visualVisibility: 'baseline',
}))
const jijiaYardGroupAnchor = {
  x: jijiaYardCenter.x - 23,
  y: jijiaYardCenter.y + 1,
}
const jijiaInnerHouseBounds = box(10, 18, 90, 64)
const jijiaInnerHouseCenter = {
  x: jijiaInnerHouseBounds.x + jijiaInnerHouseBounds.width / 2,
  y: jijiaInnerHouseBounds.y + jijiaInnerHouseBounds.height / 2,
}
const jijiaInnerMainDoorOpening = { start: 45, end: 55 }
const jijiaInnerSideDoorOpening = {
  start: jijiaInnerHouseCenter.y + 8,
  end: jijiaInnerHouseCenter.y + 20,
}
const jijiaInnerHorizontalPortraitAxes = evenlySpacedWallAxes(
  jijiaInnerHouseBounds.x + 4,
  jijiaInnerHouseBounds.x + jijiaInnerHouseBounds.width - 4,
  2,
)
const jijiaInnerPortraitFeatures: readonly MainlineWallFeatureBlueprint[] = [
  ...jijiaInnerHorizontalPortraitAxes.map((axis, index) => (
    inlinePortraitFeature(`jijia-portrait-top-${index + 1}`, jijiaInnerHouseBounds, 'top', axis)
  )),
  ...jijiaInnerHorizontalPortraitAxes.map((axis, index) => (
    inlinePortraitFeature(`jijia-portrait-bottom-${index + 1}`, jijiaInnerHouseBounds, 'bottom', axis)
  )),
  inlinePortraitFeature(
    'jijia-portrait-right-center',
    jijiaInnerHouseBounds,
    'right',
    jijiaAltarBlueprint.anchor.y,
  ),
]

const jijiaPortraitExplorationPool = [
  '画像上的人，修杰都从没见过，只听家里人提起过。',
  '画像上有些色块已经掉了，木板上还出现了一些细微的裂缝。',
  '画像太高了，阳光根本照不到上半身，但是眼睛却格外有神，像是在盯着修杰看。',
  '以前爷爷讲过这些先祖的故事，但是从没提起过名字。',
  '妹妹小时候每次进来，都会被吓到嚎啕大哭。',
] as const

const jijiaYardBlueprint: MainlineSceneBlueprint = {
  id: 'jijia-ancestral-home',
  title: '第一章 · 姬家祖宅',
  subtitle: '姬家祖宅前院是一个独立场景，右侧正门通向祖宅内堂。',
  statusLabel: '姬家祖宅 / 前院',
  hint: '从前院右侧正门进入祖宅；左侧院门是前院的固定边界出口。',
  entryFeedback: '从姬家祖宅入口进入。',
  areaLabel: '前院',
  scene: {
    walkBounds: jijiaYardBounds,
    viewport: 'fixed-frame',
    externalExit: { axis: 'x', direction: -1, threshold: 14, triggerEntityId: 'jijia-yard-gate' },
    wallDensity: { horizontalBaselineEvery: 2, verticalBaselineEvery: 2 },
    walls: [{
      id: 'jijia-yard', type: 'room', bounds: jijiaYardBounds, variant: 'yard', edges: ['top', 'right', 'bottom', 'left'],
      openings: [{ edge: 'left', start: 40, end: 55, doorId: 'jijia-yard-gate', label: '院门', labelLayout: 'split', labelGapCells: 2 }, { edge: 'right', start: 45, end: 55, doorId: 'jijia-main-door', label: '正门', displayLabel: '门', labelLayout: 'center' }],
    }],
    floorEntities: [
      ...jijiaOldTreeStoneRing,
      floor({ id: 'jijia-old-tree', label: '老槐树', kind: 'landmark', weight: 'minor', position: jijiaYardCenter, collision: jijiaOldTreeCollision, shape: jijiaOldTreeCollision, visualBounds: box(jijiaYardCenter.x - 4.5, jijiaYardCenter.y - 4.5, 9, 9), visualScale: 1.12, visualVisibility: 'distance-baseline', groupId: 'jijia-yard-group', interactionBehavior: 'echo-pool', visualProfile: 'tree-ring' }),
      wallEntity({ id: 'jijia-yard-gate', label: '院门', kind: 'door', weight: 'gateway', position: { x: 10, y: 47.5 }, doorBehavior: { leafCount: 'double', openLeaves: 'both', visualMode: 'static' } }),
    ],
    blockers: [], furnitureGroups: [{ id: 'jijia-yard-group', anchor: jijiaYardGroupAnchor, entityIds: ['jijia-old-tree'] }], initialPlayerPosition: { x: 25, y: 50 },
  },
  portals: [{
    id: 'jijia-main-door',
    entity: { id: 'jijia-main-door', label: '正门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'double', openLeaves: 'both' } },
    endpoint: { doorPosition: authoredPoint(100, 50), threshold: authoredPoint(96, 50), crossingTarget: authoredPoint(98, 50), entryPosition: authoredPoint(14, 50) },
    targetSceneId: 'jijia-ancestral-interior',
    wallOpenings: [], transitionText: '修杰穿过正门，进入祖宅内堂。', access: 'open',
  }, {
    id: 'jijia-yard-gate',
    entity: { id: 'jijia-yard-gate', label: '院门', displayLabel: '院门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'double', openLeaves: 'both', visualMode: 'static' } },
    endpoint: { doorPosition: authoredPoint(10, 47.5), threshold: authoredPoint(14, 47.5), crossingTarget: authoredPoint(12, 47.5) },
    wallOpenings: [], transitionText: '修杰走到院门边，前院出口被触发。', access: 'open',
  }],
  interactionText: { 'jijia-main-door': '正门通向独立的祖宅内堂。', 'jijia-yard-gate': '院门是前院的固定边界出口。', 'jijia-old-tree': '老槐树的影子落在石砖地面上。' },
  echoPool: [
    '树上刻着某些痕迹，岁月磨去了不少。',
    '树下的土还带着点湿润。',
    '树荫底下非常阴凉，老槐树把太阳遮挡了大半。',
    '妹妹总说，为什么不能砍树呀，这样多亮堂。',
    '树下的石块已经失去了大半棱角，变得光滑了许多。',
  ],
}

const jijiaAncestralInteriorBlueprint: MainlineSceneBlueprint = {
  id: 'jijia-ancestral-interior',
  title: '第一章 · 姬家祖宅内堂',
  subtitle: '祖宅内堂是独立场景，正门在左侧，右侧后门通向窄暗道。',
  statusLabel: '姬家祖宅 / 内堂',
  hint: '正门在左侧；内堂上下各有两幅画像，右墙中线另有一幅，后门通向中枢院窄暗道。',
  entryFeedback: '进入祖宅内堂，前院在身后。',
  areaLabel: '祖宅内堂',
  scene: {
    walkBounds: jijiaInnerHouseBounds,
    viewport: 'fixed-frame',
    wallDensity: { horizontalBaselineEvery: 2, verticalBaselineEvery: 2 },
    walls: [{ id: 'jijia-inner-house', type: 'room', bounds: jijiaInnerHouseBounds, variant: 'interior', edges: ['top', 'right', 'bottom', 'left'], features: jijiaInnerPortraitFeatures,
      openings: [{ edge: 'left', ...jijiaInnerMainDoorOpening, doorId: 'jijia-main-door', label: '正门', displayLabel: '门', labelLayout: 'center' }, { edge: 'right', ...jijiaInnerSideDoorOpening, doorId: 'jijia-secret-door', label: '后门', displayLabel: '门', labelLayout: 'center' }] }],
    altars: [jijiaAltarBlueprint], floorEntities: jijiaAltarFurniture.entities, blockers: [], furnitureGroups: [jijiaAltarFurniture.group], initialPlayerPosition: { x: 18, y: jijiaInnerHouseCenter.y },
  },
  portals: [{
    id: 'jijia-main-door',
    entity: { id: 'jijia-main-door', label: '正门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'double', openLeaves: 'both' } },
    endpoint: { doorPosition: authoredPoint(10, 50), threshold: authoredPoint(14, 50), crossingTarget: authoredPoint(12, 50), entryPosition: authoredPoint(96, 50) },
    targetSceneId: 'jijia-ancestral-home', wallOpenings: [], transitionText: '修杰从祖宅内堂穿过正门，回到前院。', access: 'open',
  }, {
    id: 'jijia-secret-door',
    entity: { id: 'jijia-secret-door', label: '后门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'single', openLeaves: 'both' } },
    endpoint: { doorPosition: authoredPoint(100, 64), threshold: authoredPoint(96, 64), crossingTarget: authoredPoint(98, 64), entryPosition: authoredPoint(7, 50) },
    targetSceneId: 'zhongshuyuan-passage', wallOpenings: [], transitionText: '修杰穿过祖宅后门，进入中枢院窄暗道。', access: 'open',
  }],
  interactionText: {
    'jijia-main-door': '正门通向前院。', 'jijia-secret-door': '后门通向中枢院的窄暗道。',
    'jijia-offering-table-north': '桌子上摆放着不少的牌位。', 'jijia-offering-table-south': '桌子上摆放着不少的牌位。', 'jijia-offering-table-west': '桌子上摆放着一些瓜果。', 'jijia-offering-table-east': '桌子上只摆放着一个牌位，上面写着“姬家家主”。',
  },
  explorationText: {
    ...Object.fromEntries(jijiaInnerPortraitFeatures.map((feature) => [feature.id, jijiaPortraitExplorationPool])),
    'jijia-offering-table-north': ['桌子上摆放着不少的牌位。'],
    'jijia-offering-table-south': ['桌子上摆放着不少的牌位。'],
    'jijia-offering-table-west': ['桌子上摆放着一些瓜果。'],
    'jijia-offering-table-east': ['桌子上只摆放着一个牌位，上面写着“姬家家主”。'],
  },
  explorationChoices: {
    'jijia-incense-burner': {
      text: '香早就烧完了，只剩根部伫立在里面。',
      options: ['重新点香', '置之不理'],
    },
  },
}

const zhongshuyuanPassageWallSteps = boundaryGridStepsFromScreenSpacing()
// The complete vertical boundary has five fixed positions, including its two
// corner endpoints. The shared frame renderer assigns those endpoints to the
// horizontal edges, so the complete side still reads: wall, wall, door, wall,
// wall without generating a seventh position.
export const zhongshuyuanPassageVerticalVisibleCellCount = 5
export const zhongshuyuanPassageVerticalCoordinateCount = zhongshuyuanPassageVerticalVisibleCellCount
const zhongshuyuanPassageHeight = zhongshuyuanPassageWallSteps.vertical * (zhongshuyuanPassageVerticalCoordinateCount - 1)
const zhongshuyuanPassageBounds = box(3, 50 - zhongshuyuanPassageHeight / 2, 94, zhongshuyuanPassageHeight)
const zhongshuyuanPassageWalkInset = 1.4
const zhongshuyuanPassageHorizontalWalkInset = .7
const zhongshuyuanPassageWalkBounds = box(
  zhongshuyuanPassageBounds.x + zhongshuyuanPassageHorizontalWalkInset,
  zhongshuyuanPassageBounds.y + zhongshuyuanPassageWalkInset,
  zhongshuyuanPassageBounds.width - zhongshuyuanPassageHorizontalWalkInset * 2,
  zhongshuyuanPassageBounds.height - zhongshuyuanPassageWalkInset * 2,
)
const zhongshuyuanPassageDoorStart = 50 - zhongshuyuanPassageWallSteps.vertical / 2
const zhongshuyuanPassageDoorEnd = 50 + zhongshuyuanPassageWallSteps.vertical / 2
// Arrive just inside the office doorway, clear of the workstation row. This
// authored point is shared by every viewport instead of being screen-tuned.
const zhongshuyuanOfficePassageEntryPosition = authoredPoint(8.5, 76.5)
const zhongshuyuanPassageBlueprint: MainlineSceneBlueprint = {
  id: 'zhongshuyuan-passage',
  title: '里世界·中枢院窄暗道',
  subtitle: '祖宅后门之后的独立窄暗道，前后各有一扇门。',
  entryFeedback: '进入祖宅后方的窄暗道。',
  areaLabel: '中枢院窄暗道',
  statusLabel: '中枢院 / 窄暗道',
  hint: '沿窄暗道向右进入中枢院办公室；左侧门回到祖宅内堂。',
  scene: {
    walkBounds: zhongshuyuanPassageWalkBounds,
    viewport: 'fixed-frame',
    wallDensity: { horizontalBaselineEvery: 1, verticalBaselineEvery: 1 },
    walls: [{ id: 'zhongshuyuan-passage-frame', type: 'alley', bounds: zhongshuyuanPassageBounds, variant: 'narrow-corridor', boundaryGeometrySource: 'cell-range', boundaryCoordinateCount: { vertical: zhongshuyuanPassageVerticalCoordinateCount }, boundaryProjection: 'screen-spacing', boundaryVisualEndpoints: { vertical: { start: 'omit', end: 'omit' } }, edges: ['top', 'right', 'bottom', 'left'], openings: [
      { edge: 'left', start: zhongshuyuanPassageDoorStart, end: zhongshuyuanPassageDoorEnd, doorId: 'jijia-secret-door', label: '门', displayLabel: '门', labelLayout: 'center' },
      { edge: 'right', start: zhongshuyuanPassageDoorStart, end: zhongshuyuanPassageDoorEnd, doorId: 'zhongshuyuan-office-entry', label: '门', displayLabel: '门', labelLayout: 'center' },
    ] }],
    floorEntities: [], blockers: [], furnitureGroups: [], initialPlayerPosition: authoredPoint(30, 50),
  },
  portals: [{
    id: 'jijia-secret-door',
    entity: { id: 'jijia-secret-door', label: '门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'single', openLeaves: 'both' } },
    endpoint: { doorPosition: authoredPoint(3, 50), threshold: authoredPoint(7, 50), crossingTarget: authoredPoint(5, 50), entryPosition: authoredPoint(96, 64) },
    targetSceneId: 'jijia-ancestral-interior', wallOpenings: [], transitionText: '修杰从暗道回到祖宅内堂。', access: 'open',
  }, {
    id: 'zhongshuyuan-office-entry',
    entity: { id: 'zhongshuyuan-office-entry', label: '门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'single', openLeaves: 'both' } },
    endpoint: { doorPosition: authoredPoint(97, 50), threshold: authoredPoint(93, 50), crossingTarget: authoredPoint(95, 50), entryPosition: zhongshuyuanOfficePassageEntryPosition },
    targetSceneId: 'zhongshuyuan-office', wallOpenings: [], transitionText: '修杰穿过暗道尽头的门，进入中枢院办公室。', access: 'open',
  }],
  interactionText: { 'jijia-secret-door': '这扇门回到祖宅内堂。', 'zhongshuyuan-office-entry': '这扇门通向中枢院办公室。' },
}

const zhongshuyuanOfficeFloorBounds = box(6, 8, 88, 84)
const zhongshuyuanOfficeCorridor = box(8, 39, 86, 22)
const zhongshuyuanOfficeCorridorEndOpenings = [
  { edge: 'left' as const, start: 39, end: 61 },
  { edge: 'right' as const, start: 39, end: 61 },
] as const
const zhongshuyuanOfficeNorthGlassWall = box(7, 39, 86, 1)
const zhongshuyuanOfficeSouthGlassWall = box(7, 60, 86, 1)
const zhongshuyuanOfficeNorthDividerBounds = [
  box(28, 8, 1, 31),
  box(50, 8, 1, 31),
  box(72, 8, 1, 31),
] as const
const zhongshuyuanOfficeSouthDividerBounds = [
  box(28, 61, 1, 31),
  box(50, 61, 1, 31),
  box(72, 61, 1, 31),
] as const
const zhongshuyuanOfficeNorthCells = [
  box(6, 8, 22, 31),
  box(28, 8, 22, 31),
  box(50, 8, 22, 31),
  box(72, 8, 22, 31),
] as const
const zhongshuyuanOfficeSouthCells = [
  box(6, 61, 22, 31),
  box(28, 61, 22, 31),
  box(50, 61, 22, 31),
  box(72, 61, 22, 31),
] as const
const zhongshuyuanOfficeRooms = [
  { id: 'zhongshuyuan-office-corridor', bounds: zhongshuyuanOfficeCorridor, kind: 'corridor' as const },
  ...zhongshuyuanOfficeNorthCells.map((bounds, index) => ({ id: `zhongshuyuan-office-north-room-${index + 1}`, bounds, kind: 'room' as const })),
  ...zhongshuyuanOfficeSouthCells.map((bounds, index) => ({ id: `zhongshuyuan-office-south-room-${index + 1}`, bounds, kind: 'room' as const })),
] as const
const zhongshuyuanOfficeProtagonistRoom = zhongshuyuanOfficeSouthCells[0]
const zhongshuyuanOfficeProtagonistRoomCenterY = zhongshuyuanOfficeProtagonistRoom.y + zhongshuyuanOfficeProtagonistRoom.height / 2
const zhongshuyuanOfficeWallSteps = boundaryGridStepsFromScreenSpacing()
const zhongshuyuanOfficeWallCellStep = zhongshuyuanOfficeWallSteps.horizontal
const zhongshuyuanOfficeChairX = zhongshuyuanOfficeProtagonistRoom.x + zhongshuyuanOfficeWallCellStep * 2
const zhongshuyuanOfficeDeskX = zhongshuyuanOfficeChairX
  + sharedFurnitureGeometry.textFootprint.height / 2
  + sharedFurnitureGeometry.tableFootprint.height / 2
  + sharedFurnitureGeometry.actorContactGap
const zhongshuyuanOfficeWindowX = zhongshuyuanOfficeProtagonistRoom.x + zhongshuyuanOfficeProtagonistRoom.width / 2
const zhongshuyuanOfficeCornerInset = 1.5
const zhongshuyuanOfficeFixtureX = zhongshuyuanOfficeProtagonistRoom.x + zhongshuyuanOfficeProtagonistRoom.width - zhongshuyuanOfficeCornerInset
const zhongshuyuanOfficeProtagonistDoorX = zhongshuyuanOfficeProtagonistRoom.x + zhongshuyuanOfficeProtagonistRoom.width - zhongshuyuanOfficeWallCellStep * 2
// The plant sits just inside the glass, to the left-rear of the room door;
// keep its collision out of the doorway approach.
const zhongshuyuanOfficePlantPosition = authoredPoint(
  zhongshuyuanOfficeProtagonistDoorX - zhongshuyuanOfficeWallCellStep * 2,
  zhongshuyuanOfficeProtagonistRoom.y + zhongshuyuanOfficeWallSteps.vertical * .75,
)
const zhongshuyuanOfficeRackPosition = authoredPoint(zhongshuyuanOfficeFixtureX, zhongshuyuanOfficeProtagonistRoom.y + zhongshuyuanOfficeProtagonistRoom.height - zhongshuyuanOfficeCornerInset - 1)
const zhongshuyuanOfficeWindow = wallEntity({
  id: 'zhongshuyuan-office-window',
  label: '窗户',
  kind: 'fixture',
  weight: 'minor',
  position: wallEdgePoint(zhongshuyuanOfficeFloorBounds, 'bottom', zhongshuyuanOfficeWindowX),
  approach: authoredPoint(zhongshuyuanOfficeWindowX, zhongshuyuanOfficeFloorBounds.y + zhongshuyuanOfficeFloorBounds.height - 4),
  interactive: true,
  interactionBehavior: 'blinds-toggle',
})
const zhongshuyuanOfficeWindowFeature: MainlineWallFeatureBlueprint = {
  id: 'zhongshuyuan-office-window-feature',
  edge: 'bottom',
  start: zhongshuyuanOfficeWindowX - 1,
  end: zhongshuyuanOfficeWindowX + 1,
  glyphs: ['窗', '户'],
  layout: 'inline',
  entity: zhongshuyuanOfficeWindow,
}
const zhongshuyuanOfficeDeskGeometry = createTableGeometry(
  'zhongshuyuan-office-desk',
  authoredPoint(zhongshuyuanOfficeDeskX, zhongshuyuanOfficeProtagonistRoomCenterY),
  4,
  authoredPoint(zhongshuyuanOfficeDeskX, zhongshuyuanOfficeProtagonistRoomCenterY + 5),
  'vertical',
)
const zhongshuyuanOfficeDesk = floor({
  id: 'zhongshuyuan-office-desk',
  label: '办公桌',
  kind: 'table',
  weight: 'anchor',
  facing: 'east',
  position: zhongshuyuanOfficeDeskGeometry.position,
  approach: zhongshuyuanOfficeDeskGeometry.approach,
  collision: zhongshuyuanOfficeDeskGeometry.collision,
  shape: zhongshuyuanOfficeDeskGeometry.collision,
  visualVisibility: 'baseline',
  groupId: 'zhongshuyuan-office-workstation',
  animationGroup: 'office-breathing',
  interactionBehavior: 'desk-device',
})

const zhongshuyuanOfficeChairGeometry = createSeatGeometry({
  id: 'zhongshuyuan-office-chair',
  tableId: 'zhongshuyuan-office-desk',
  side: 'top',
  rest: authoredPoint(zhongshuyuanOfficeChairX, zhongshuyuanOfficeProtagonistRoomCenterY),
  pulled: authoredPoint(zhongshuyuanOfficeChairX, zhongshuyuanOfficeProtagonistRoomCenterY - 3),
  sit: authoredPoint(zhongshuyuanOfficeChairX, zhongshuyuanOfficeProtagonistRoomCenterY - 4),
}, 'vertical')
const zhongshuyuanOfficeChair = floor({
  id: 'zhongshuyuan-office-chair',
  label: '椅子',
  kind: 'seat',
  weight: 'minor',
  facing: 'east',
  position: zhongshuyuanOfficeChairGeometry.rest,
  approach: zhongshuyuanOfficeChairGeometry.sit,
  collision: zhongshuyuanOfficeChairGeometry.collision,
  shape: zhongshuyuanOfficeChairGeometry.collision,
  visualVisibility: 'baseline',
  groupId: 'zhongshuyuan-office-workstation',
  seat: zhongshuyuanOfficeChairGeometry,
  animationGroup: 'office-breathing',
})

const zhongshuyuanOfficePlant = floor({
  id: 'zhongshuyuan-office-plant',
  label: '绿植',
  kind: 'fixture',
  weight: 'minor',
  position: zhongshuyuanOfficePlantPosition,
  approach: authoredPoint(zhongshuyuanOfficePlantPosition.x - 4, zhongshuyuanOfficePlantPosition.y),
  collision: box(zhongshuyuanOfficePlantPosition.x - 1.5, zhongshuyuanOfficePlantPosition.y - 1.5, 3, 3),
  shape: box(zhongshuyuanOfficePlantPosition.x - 1.5, zhongshuyuanOfficePlantPosition.y - 1.5, 3, 3),
  visualVisibility: 'baseline',
  animationGroup: 'office-breathing',
  interactionBehavior: 'plant-choice',
})

// Paired, non-interactive plants mark the two external corridor openings.
// They sit inside the corridor, close to the left/right side walls rather
// than in front of the north/south glass; they are visual landmarks, not
// blockers.
const zhongshuyuanOfficePortMarkerPositions = [
  ['left-top', zhongshuyuanOfficeFloorBounds.x + 1.5, zhongshuyuanOfficeCorridor.y + 4],
  ['left-bottom', zhongshuyuanOfficeFloorBounds.x + 1.5, zhongshuyuanOfficeCorridor.y + zhongshuyuanOfficeCorridor.height - 4],
  ['right-top', zhongshuyuanOfficeFloorBounds.x + zhongshuyuanOfficeFloorBounds.width - 1.5, zhongshuyuanOfficeCorridor.y + 4],
  ['right-bottom', zhongshuyuanOfficeFloorBounds.x + zhongshuyuanOfficeFloorBounds.width - 1.5, zhongshuyuanOfficeCorridor.y + zhongshuyuanOfficeCorridor.height - 4],
] as const
const zhongshuyuanOfficePortMarkers = zhongshuyuanOfficePortMarkerPositions.map(([side, x, y]) => floor({
  id: `zhongshuyuan-office-port-plant-${side}`,
  label: '绿植',
  kind: 'fixture',
  weight: 'minor',
  position: authoredPoint(x, y),
  interactive: false,
  visualVisibility: 'baseline',
}))

const zhongshuyuanOfficeRack = floor({
  id: 'zhongshuyuan-office-rack',
  label: '衣架',
  kind: 'fixture',
  weight: 'minor',
  position: zhongshuyuanOfficeRackPosition,
  approach: authoredPoint(zhongshuyuanOfficeRackPosition.x - 4, zhongshuyuanOfficeRackPosition.y),
  collision: box(zhongshuyuanOfficeRackPosition.x - 1.5, zhongshuyuanOfficeRackPosition.y - 2.5, 3, 5),
  shape: box(zhongshuyuanOfficeRackPosition.x - 1.5, zhongshuyuanOfficeRackPosition.y - 2.5, 3, 5),
  visualVisibility: 'baseline',
  animationGroup: 'office-breathing',
})

const zhongshuyuanOfficeDoorXs = [24, 32, 68, 76] as const
const zhongshuyuanOfficeDoorBehavior = { leafCount: 'single', openLeaves: 'both' } as const
const zhongshuyuanOfficeLockedDoorTextPool = ['这道门锁上了。', '周末没有人在办公室。'] as const
const zhongshuyuanOfficeLockedDoorText = zhongshuyuanOfficeLockedDoorTextPool[0]
const zhongshuyuanOfficeProtagonistSecretDoorY = zhongshuyuanOfficeProtagonistRoomCenterY
const zhongshuyuanOfficeDoorPortals: readonly MainlineScenePortalBlueprint[] = [
  ...zhongshuyuanOfficeDoorXs.map((x, index) => {
    const id = `zhongshuyuan-office-north-door-${index + 1}`
    return {
      id,
      entity: {
        id,
        label: '门',
        displayLabel: '门',
        kind: 'door' as const,
        weight: 'gateway' as const,
        surface: 'wall' as const,
        doorBehavior: zhongshuyuanOfficeDoorBehavior,
      },
      endpoint: {
        doorPosition: authoredPoint(x, 39),
        threshold: authoredPoint(x, 43),
        crossingTarget: authoredPoint(x, 37),
      },
      routeThrough: true,
      frameBehavior: 'independent' as const,
      fromRoomId: 'zhongshuyuan-office-corridor',
      toRoomId: `zhongshuyuan-office-north-room-${index + 1}`,
      wallOpenings: [{
        wallId: 'zhongshuyuan-office-glass-north',
        opening: {
          edge: 'top' as const,
          start: x - 1,
          end: x + 1,
          doorId: id,
          label: '门',
          displayLabel: '门',
          labelLayout: 'center' as const,
          doorFlankCount: 0,
          doorBehavior: zhongshuyuanOfficeDoorBehavior,
        },
      }],
      transitionText: '门打开了，办公室与中央长廊连通。',
      access: 'locked' as const,
      lockedText: zhongshuyuanOfficeLockedDoorText,
      lockedTextPool: zhongshuyuanOfficeLockedDoorTextPool,
    }
  }),
  ...zhongshuyuanOfficeDoorXs.map((x, index) => {
    const id = `zhongshuyuan-office-south-door-${index + 1}`
    return {
      id,
      entity: {
        id,
        label: '门',
        displayLabel: '门',
        kind: 'door' as const,
        weight: 'gateway' as const,
        surface: 'wall' as const,
        doorBehavior: zhongshuyuanOfficeDoorBehavior,
      },
      endpoint: {
        doorPosition: authoredPoint(x, 60),
        threshold: authoredPoint(x, 56),
        crossingTarget: authoredPoint(x, 64),
      },
      routeThrough: true,
      frameBehavior: 'independent' as const,
      fromRoomId: 'zhongshuyuan-office-corridor',
      toRoomId: `zhongshuyuan-office-south-room-${index + 1}`,
      wallOpenings: [{
        wallId: 'zhongshuyuan-office-glass-south',
        opening: {
          edge: 'bottom' as const,
          start: x - 1,
          end: x + 1,
          doorId: id,
          label: '门',
          displayLabel: '门',
          labelLayout: 'center' as const,
          doorFlankCount: 0,
          doorBehavior: zhongshuyuanOfficeDoorBehavior,
        },
      }],
      transitionText: '门打开了，办公室与中央长廊连通。',
      access: index === 0 ? 'open' as const : 'locked' as const,
      ...(index === 0 ? {} : { lockedText: zhongshuyuanOfficeLockedDoorText, lockedTextPool: zhongshuyuanOfficeLockedDoorTextPool }),
    }
  }),
  {
    id: 'zhongshuyuan-office-secret-door',
    entity: {
      id: 'zhongshuyuan-office-secret-door',
      label: '暗道门',
      displayLabel: '门',
      kind: 'door',
      weight: 'gateway',
      surface: 'wall',
      doorBehavior: zhongshuyuanOfficeDoorBehavior,
    },
    endpoint: {
      doorPosition: authoredPoint(zhongshuyuanOfficeFloorBounds.x, zhongshuyuanOfficeProtagonistSecretDoorY),
      threshold: authoredPoint(zhongshuyuanOfficeFloorBounds.x + 4, zhongshuyuanOfficeProtagonistSecretDoorY),
      crossingTarget: authoredPoint(zhongshuyuanOfficeFloorBounds.x - 2, zhongshuyuanOfficeProtagonistSecretDoorY),
    },
    wallOpenings: [{
      wallId: 'zhongshuyuan-office-floor-frame',
      opening: {
        edge: 'left',
        start: zhongshuyuanOfficeProtagonistSecretDoorY - 1,
        end: zhongshuyuanOfficeProtagonistSecretDoorY + 1,
        doorId: 'zhongshuyuan-office-secret-door',
        label: '门',
        displayLabel: '门',
        labelLayout: 'center',
        doorFlankCount: 1,
        doorBehavior: zhongshuyuanOfficeDoorBehavior,
      },
    }],
    targetSceneId: 'zhongshuyuan-passage',
    routeThrough: true,
    frameBehavior: 'scene-retract',
    fromRoomId: 'zhongshuyuan-office-south-room-1',
    transitionText: '暗道门打开了，修杰进入中枢院窄暗道。',
    access: 'open',
  },
]

const zhongshuyuanOfficeBlueprint: MainlineSceneBlueprint = {
  id: 'zhongshuyuan-office',
  title: '里世界·中枢院内部楼层',
  subtitle: '中枢院内部的一层办公区，中央长廊连接数间办公室。',
  statusLabel: '中枢院 / 内部楼层',
  hint: '左下办公室是当前办公点；玻璃门通向中央长廊，实体墙上的暗道门通向中枢院窄暗道。中央长廊左右两端都是外部出口，走到任一端手机都会弹出。',
  entryFeedback: '进入里世界·中枢院内部楼层，暗道入口在左侧。',
  areaLabel: '中枢院办公室',
  scene: {
      walkBounds: zhongshuyuanOfficeFloorBounds,
      viewport: 'fixed-frame',
      externalExits: [
        { id: 'zhongshuyuan-office-left-endpoint', axis: 'x', direction: -1, threshold: zhongshuyuanOfficeFloorBounds.x + 4, frameBehavior: 'scene-retract', transitionBehavior: 'phone', triggerSpan: { start: zhongshuyuanOfficeCorridorEndOpenings[0].start, end: zhongshuyuanOfficeCorridorEndOpenings[0].end } },
        { id: 'zhongshuyuan-office-right-endpoint', axis: 'x', direction: 1, threshold: zhongshuyuanOfficeFloorBounds.x + zhongshuyuanOfficeFloorBounds.width - 4, frameBehavior: 'scene-retract', transitionBehavior: 'phone', triggerSpan: { start: zhongshuyuanOfficeCorridorEndOpenings[1].start, end: zhongshuyuanOfficeCorridorEndOpenings[1].end } },
      ],
      rooms: zhongshuyuanOfficeRooms,
      wallDensity: { horizontalBaselineEvery: 1, verticalBaselineEvery: 1 },
      walls: [
        {
          id: 'zhongshuyuan-office-floor-frame',
          type: 'frame',
          bounds: zhongshuyuanOfficeFloorBounds,
          variant: 'zhongshuyuan-office',
          edges: ['top', 'right', 'bottom', 'left'],
          features: [zhongshuyuanOfficeWindowFeature],
          openings: [
            { ...zhongshuyuanOfficeCorridorEndOpenings[0], transitionOnly: true },
            { ...zhongshuyuanOfficeCorridorEndOpenings[1], transitionOnly: true },
          ],
        },
        { id: 'zhongshuyuan-office-corridor', type: 'lane', bounds: zhongshuyuanOfficeCorridor, variant: 'central-corridor', edges: [] },
        {
          id: 'zhongshuyuan-office-glass-north',
          type: 'room',
          bounds: zhongshuyuanOfficeNorthGlassWall,
          variant: 'corridor-glass',
          boundaryGeometrySource: 'cell-range',
          wallGlyphs: ['玻', '璃'],
          edges: ['top'],
        },
        {
          id: 'zhongshuyuan-office-glass-south',
          type: 'room',
          bounds: zhongshuyuanOfficeSouthGlassWall,
          variant: 'corridor-glass',
          boundaryGeometrySource: 'cell-range',
          wallGlyphs: ['玻', '璃'],
          edges: ['bottom'],
        },
        ...zhongshuyuanOfficeNorthDividerBounds.map((bounds, index) => ({
          id: `zhongshuyuan-office-divider-north-${index + 1}`,
          type: 'room' as const,
          bounds,
          variant: 'office-partition',
          boundaryVisualEndpoints: { vertical: { end: 'omit' as const } },
          edges: ['left' as const],
        })),
        ...zhongshuyuanOfficeSouthDividerBounds.map((bounds, index) => ({
          id: `zhongshuyuan-office-divider-south-${index + 1}`,
          type: 'room' as const,
          bounds,
          variant: 'office-partition',
          boundaryVisualEndpoints: { vertical: { start: 'omit' as const } },
          edges: ['left' as const],
        })),
        ...zhongshuyuanOfficeNorthCells.map((bounds, index) => ({
          id: `zhongshuyuan-office-cell-north-${index + 1}`,
          type: 'lane' as const,
          bounds,
          variant: 'office-cell',
          edges: [] as const,
        })),
        ...zhongshuyuanOfficeSouthCells.map((bounds, index) => ({
          id: `zhongshuyuan-office-cell-south-${index + 1}`,
          type: 'lane' as const,
          bounds,
          variant: 'office-cell',
          edges: [] as const,
        })),
      ],
      floorEntities: [
        zhongshuyuanOfficeDesk,
        zhongshuyuanOfficeChair,
        zhongshuyuanOfficePlant,
        zhongshuyuanOfficeRack,
        ...zhongshuyuanOfficePortMarkers,
      ],
      blockers: [],
      furnitureGroups: [{
        id: 'zhongshuyuan-office-workstation',
        anchor: authoredPoint((zhongshuyuanOfficeChairX + zhongshuyuanOfficeDeskX) / 2, zhongshuyuanOfficeProtagonistRoomCenterY),
        entityIds: [zhongshuyuanOfficeDesk.id, zhongshuyuanOfficeChair.id],
      }],
      initialPlayerPosition: authoredPoint(16, 82),
    },
  portals: zhongshuyuanOfficeDoorPortals,
  interactionText: {
    'zhongshuyuan-office-desk': '左下办公室的办公桌上留着一份尚未归档的材料。',
    'zhongshuyuan-office-chair': '椅子靠近左下办公格的通道一侧，正对着办公桌。',
    'zhongshuyuan-office-plant': '角落里摆着一盆绿植。',
    'zhongshuyuan-office-rack': '衣架靠在办公室角落。',
    'zhongshuyuan-office-window': '底墙的窗户可以查看中枢院外侧。',
    'zhongshuyuan-office-secret-door': '墙里的暗道门通向中枢院窄暗道。',
  },
  explorationText: {
    'zhongshuyuan-office-desk': ['左下办公室的办公桌上留着一份尚未归档的材料。'],
    'zhongshuyuan-office-chair': ['这椅子有些年头了，坐上去并不是很舒服。'],
    'zhongshuyuan-office-plant': ['有段时间没浇水了，不那么精神了。'],
    'zhongshuyuan-office-rack': ['看起来有点老派的衣架。'],
    'zhongshuyuan-office-window': ['外面的阳光白的有些刺眼。', '外面看起来跟表世界没什么区别。'],
  },
  explorationChoices: {
    'zhongshuyuan-office-plant': {
      text: '有段时间没浇水了，不那么精神了。',
      options: ['浇水', '无视'],
    },
  },
}

const yongheStorefrontStarts = [10, 32, 54, 76, 98, 120, 142, 164] as const
const yongheStreetEntryPosition: Point = { x: 36, y: yongheStorefrontStarts[1] + 9 }
const yongheOutdoorTableX = yongheStreetEntryPosition.x + 4
const yongheOutdoorApproachX = yongheStreetEntryPosition.x + 11

const yongheFacadeAirWalls: readonly MainlineAirWall[] = [
  { id: 'yonghe-left-shop-air-wall-top', ...box(8, 8, 27.3, 23.3) },
  { id: 'yonghe-left-shop-air-wall-bottom', ...box(8, 50.7, 27.3, 141.3) },
  { id: 'yonghe-industrial-edge-air-wall', ...box(64.7, 8, 27.3, 184) },
]

const yongheDiningFurniture = [
  mainlineTwoSeatFurniture('yonghe-upper-left-group', { x: 35, y: 50 }, { x: 27, y: 50 }),
  mainlineTwoSeatFurniture('yonghe-upper-right-group', { x: 55, y: 50 }, { x: 63, y: 50 }),
  mainlineTwoSeatFurniture('yonghe-lower-left-group', { x: 35, y: 70 }, { x: 27, y: 70 }),
  mainlineTwoSeatFurniture('yonghe-lower-right-group', { x: 55, y: 70 }, { x: 63, y: 70 }),
]

const yongheOutdoorFurniture = [
  mainlineTwoSeatFurniture(
    'yonghe-outdoor-group-1',
    { x: yongheOutdoorTableX, y: yongheStreetEntryPosition.y },
    { x: yongheOutdoorApproachX, y: yongheStreetEntryPosition.y },
    { tableId: 'yonghe-outdoor-table-1', seatIds: ['yonghe-outdoor-chair-1-top', 'yonghe-outdoor-chair-1-bottom'] },
  ),
  mainlineTwoSeatFurniture(
    'yonghe-outdoor-group-2',
    { x: yongheOutdoorTableX, y: yongheStreetEntryPosition.y + 20 },
    { x: yongheOutdoorApproachX, y: yongheStreetEntryPosition.y + 20 },
    { tableId: 'yonghe-outdoor-table-2', seatIds: ['yonghe-outdoor-chair-2-top', 'yonghe-outdoor-chair-2-bottom'] },
  ),
]

const yongheMiningPerimeterBlueprint: MainlineSceneBlueprint = {
  id: 'yonghe-mining-perimeter',
  title: '第三章 · 矿区外围',
  subtitle: '矿区外围沿纵向老街展开，左侧是一排旧店面；永和小馆是其中一个独立场景。',
  statusLabel: '矿区外围老街',
  hint: '从画面下方进入，沿中间通道向上；左侧是八个窄小的生活店面，永和小馆入口在较深处，右侧是少量铁片、管线和围栏组成的矿区边缘。',
  entryFeedback: '从画面下方进入矿区外围，沿中央通道向上，左侧店面深处是永和小馆。',
  areaLabel: (position) => position.y >= 150
    ? '矿区'
    : position.y >= 100
      ? '矿区外围'
      : position.y <= 70
        ? '永和小馆门口'
        : '矿区外围老街',
  scene: {
      walkBounds: box(8, 8, 84, 184),
      externalExit: { axis: 'y', direction: 1, threshold: 186 },
      wallDensity: { horizontalBaselineEvery: 2, verticalBaselineEvery: 2 },
      walls: [
        {
          id: 'yonghe-left-shop-row',
          type: 'room',
          bounds: box(10, 8, 26, 184),
          variant: 'worn-shop-row',
          edges: ['right'],
        },
        {
          id: 'yonghe-industrial-edge',
          type: 'room',
          bounds: box(64, 8, 28, 184),
          variant: 'industrial-mine-edge',
          edges: ['left'],
          features: [
            { id: 'yonghe-pipe-feature', edge: 'left', start: 18, end: 30, glyphs: ['管', '线'] },
            { id: 'yonghe-fence-feature', edge: 'left', start: 52, end: 66, glyphs: ['围', '栏'] },
            { id: 'yonghe-metal-feature', edge: 'left', start: 88, end: 102, glyphs: ['铁', '片'] },
            { id: 'yonghe-steel-feature', edge: 'left', start: 122, end: 136, glyphs: ['钢', '架'] },
            { id: 'yonghe-scrap-feature', edge: 'left', start: 158, end: 172, glyphs: ['废', '料'] },
          ],
        },
        {
          id: 'yonghe-main-lane',
          type: 'lane',
          bounds: box(36, 8, 28, 184),
          variant: 'main-lane',
          edges: [],
        },
      ],
      storefronts: [
        ...storefrontRow(
          'yonghe',
          'yonghe-left-shop-row',
          'right',
          ['修鞋', '永和小馆', '药品', '五金', '小吃', '面馆', '修理', '早点'],
          'worn',
          yongheStorefrontStarts,
          18,
          { index: 1, portalId: 'yonghe-street-entry', mode: 'door' },
          undefined,
          'content',
        ),
      ],
      floorEntities: yongheOutdoorFurniture.flatMap(({ entities }) => entities),
      airWalls: yongheFacadeAirWalls,
      blockers: [],
      furnitureGroups: yongheOutdoorFurniture.map(({ group }) => group),
      initialPlayerPosition: { x: 50, y: 180 },
    },
  portals: [
    {
      id: 'yonghe-street-entry',
      entity: {
        id: 'yonghe-street-entry',
        label: '永和小馆',
        kind: 'door',
        weight: 'gateway',
        surface: 'wall',
        doorBehavior: { leafCount: 'single', openLeaves: 'both' },
      },
      endpoint: { doorPosition: yongheStreetEntryPosition, threshold: { x: 39.5, y: yongheStreetEntryPosition.y }, crossingTarget: { x: 37.5, y: yongheStreetEntryPosition.y }, entryPosition: { x: 20, y: 56 } },
      targetSceneId: 'yonghe-eatery',
      wallOpenings: [],
      transitionText: '修杰从矿区外围老街走进永和小馆，店里仍按平常的节奏营业。',
      access: 'open',
    },
  ],
  interactionText: {
    'yonghe-street-entry': '走到旧店面较深处，才看见永和小馆的招牌和入口。',
    'yonghe-outdoor-table-1': '小桌摆在永和小馆门外，主通道仍然留着。',
    'yonghe-outdoor-table-2': '另一张门外小桌靠着旧店面，行人可以从侧边绕过。',
  },
}

const yongheEateryBlueprint: MainlineSceneBlueprint = {
  id: 'yonghe-eatery',
  title: '第三章 · 永和小馆',
  subtitle: '永和小馆是独立场景；门、墙、桌椅和后门都直接由主线场景契约编译。',
  statusLabel: '永和小馆',
  hint: '入口在左侧，店内中央留出通道；柜台和灶台在右侧，后门暂未开放。',
  entryFeedback: '进入永和小馆，矿区外围老街在身后。',
  areaLabel: '永和小馆',
  scene: {
      walkBounds: box(8, 26, 88, 60),
      viewport: 'fixed-frame',
      wallDensity: { horizontalBaselineEvery: 2, verticalBaselineEvery: 2 },
      walls: [{
        id: 'yonghe-room',
        type: 'room',
        bounds: box(10, 28, 84, 56),
        variant: 'eatery',
        edges: ['top', 'right', 'bottom', 'left'],
      }],
      floorEntities: [
        ...yongheDiningFurniture.flatMap(({ entities }) => entities),
        floor({ id: 'yonghe-counter', label: '柜台', kind: 'fixture', weight: 'fixture', position: { x: 78, y: 38 }, collision: box(68, 34, 20, 7), shape: box(68, 34, 20, 7), groupId: 'yonghe-service-group' }),
        floor({ id: 'yonghe-stove', label: '灶台', kind: 'fixture', weight: 'fixture', position: { x: 84, y: 46 }, collision: box(80, 43, 8, 6), shape: box(80, 43, 8, 6), groupId: 'yonghe-service-group' }),
      ],
      airWalls: [{ id: 'yonghe-back-door-air-wall', ...box(70, 26, 16, 1.4), opensWithPassageId: 'yonghe-back-door' }],
      blockers: [],
      furnitureGroups: [
        ...yongheDiningFurniture.map(({ group }) => group),
        { id: 'yonghe-service-group', anchor: { x: 82, y: 42 }, entityIds: ['yonghe-counter', 'yonghe-stove'] },
      ],
      initialPlayerPosition: { x: 20, y: 56 },
    },
  portals: [
    {
      id: 'yonghe-street-entry',
      entity: {
        id: 'yonghe-street-entry',
        label: '永和小馆',
        kind: 'door',
        weight: 'gateway',
        surface: 'wall',
        doorBehavior: { leafCount: 'single', openLeaves: 'both' },
      },
      endpoint: { doorPosition: { x: 10, y: 56 }, threshold: { x: 14, y: 56 }, crossingTarget: { x: 8, y: 56 }, entryPosition: { x: yongheStreetEntryPosition.x + 6, y: yongheStreetEntryPosition.y } },
      targetSceneId: 'yonghe-mining-perimeter',
      wallOpenings: [{ wallId: 'yonghe-room', opening: { edge: 'left', start: 50, end: 62, doorId: 'yonghe-street-entry', label: '出馆' } }],
      transitionText: '修杰从矿区外围老街走进永和小馆，店里仍按平常的节奏营业。',
      access: 'open',
    },
    {
      id: 'yonghe-back-door',
      entity: {
        id: 'yonghe-back-door',
        label: '后门',
        kind: 'door',
        weight: 'gateway',
        surface: 'wall',
        doorBehavior: { leafCount: 'single', openLeaves: 'both' },
      },
      endpoint: { doorPosition: { x: 78, y: 28 }, threshold: { x: 78, y: 32 }, crossingTarget: { x: 78, y: 25 } },
      wallOpenings: [{ wallId: 'yonghe-room', opening: { edge: 'top', start: 70, end: 86, doorId: 'yonghe-back-door', label: '后门' } }],
      transitionText: '后门的通路尚未开放。',
      access: 'locked',
      lockedText: '后门暂未开启，当前权限不足。',
    },
  ],
  interactionText: {
    'yonghe-street-entry': '走到旧店面较深处，才看见永和小馆的招牌和入口。',
    ...Object.fromEntries(yongheDiningFurniture.flatMap(({ group }) => {
      const [tableId, topChairId, bottomChairId] = group.entityIds
      return [
        [tableId, '两人桌靠在小馆内部，桌边留出进出通道。'],
        [topChairId, '椅子贴着桌边摆放，旁边留有侧身通过的空隙。'],
        [bottomChairId, '椅子贴着桌边摆放，保持着小馆紧凑但可通行的布局。'],
      ]
    })),
    'yonghe-counter': '柜台靠在店内后侧，灶台就在旁边，热气和声音都从这里出来。',
    'yonghe-stove': '灶台在柜台旁边，留在小馆内部，不占用门外通道。',
    'yonghe-back-door': '后门暂未开启，当前权限不足。',
    'yonghe-outdoor-table-1': '小桌摆在永和小馆门外，主通道仍然留着。',
    'yonghe-outdoor-table-2': '另一张门外小桌靠着旧店面，行人可以从侧边绕过。',
  },
}

export const mainlineSceneBlueprints: Record<MainlineSceneId, MainlineSceneBlueprint> = {
  'jijia-ancestral-home': jijiaYardBlueprint,
  'jijia-ancestral-interior': jijiaAncestralInteriorBlueprint,
  'commercial-street': commercialStreetBlueprint,
  'commercial-cafe': commercialCafeBlueprint,
  'yonghe-mining-perimeter': yongheMiningPerimeterBlueprint,
  'yonghe-eatery': yongheEateryBlueprint,
  'zhongshuyuan-passage': zhongshuyuanPassageBlueprint,
  'zhongshuyuan-office': zhongshuyuanOfficeBlueprint,
}
