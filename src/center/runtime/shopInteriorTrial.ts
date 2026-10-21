import type { MainlineSceneBlueprint, MainlineSceneEntity, MainlineFurnitureGroup, MainlineContinuousStructure } from './mainlineSceneModel'
import type { Point } from './sceneGeometry'
import { continuousCafeRoomId, cafeConversationSeatId, cafeStoryTableId } from './continuousCafe'

/** Isolated layout trial: dimensions are reference-world pixels, not viewport pixels. */
export function trialCafeInterior(blueprint: MainlineSceneBlueprint): MainlineSceneBlueprint {
  const data = blueprint.scene
  const room = data.rooms!.find(candidate => candidate.id === continuousCafeRoomId)!
  const point = (x: number, y: number): Point => ({ x: room.bounds.x + x / 1920 * 100, y: room.bounds.y + y / 1080 * 100 })
  const footprint = (x: number, y: number, width: number, height: number) => ({ ...point(x - width / 2, y - height / 2), width: width / 1920 * 100, height: height / 1080 * 100 })
  const oldIds = new Set(data.floorEntities.filter(entity => entity.roomId === room.id).map(entity => entity.id))
  const entities: MainlineSceneEntity[] = []
  const groups: MainlineFurnitureGroup[] = []
  const structures: MainlineContinuousStructure[] = []
  const fixture = (id: string, label: string, x: number, y: number, solid = true): MainlineSceneEntity => ({
    id, label, roomId: room.id, surface: 'floor', kind: 'fixture', weight: 'fixture',
    position: point(x, y), visualVisibility: 'static', interactive: true,
    ...(solid ? { collision: footprint(x, y, Array.from(label).length * 16, 16) } : {}),
  })

  // Counter bodies end at the visible 16px glyph cells; no old 28px anchor body remains.
  const counterRun = (id: string, coordinates: readonly [number, number][], orderIndex = -1) => {
    const xs = coordinates.map(([x]) => x), ys = coordinates.map(([, y]) => y)
    const left = Math.min(...xs) - 8, top = Math.min(...ys) - 8
    const right = Math.max(...xs) + 8, bottom = Math.max(...ys) + 8
    const bodyId = `${id}-body`
    structures.push({ id: bodyId, kind: 'counter', ...point(left, top), width: (right - left) / 1920 * 100, height: (bottom - top) / 1080 * 100 })
    coordinates.forEach(([x, y], index) => {
      const entity = fixture(index === orderIndex ? 'commercial-cafe-counter' : `${id}-${index}`, index % 2 ? '台' : '柜', x, y, false)
      entity.interactionStructureId = bodyId
      entity.interactionContactSides = ['right']
      entity.interactive = index === orderIndex
      if (index === orderIndex) entity.interactionBehavior = 'cafe-order'
      entities.push(entity)
    })
  }
  counterRun('cafe-trial-counter-long', Array.from({ length: 29 }, (_, index) => [168, 112 + index * 16] as [number, number]), 14)
  // The elbow shares one glyph with the long run, so start one cell to its right.
  counterRun('cafe-trial-counter-rear', Array.from({ length: 14 }, (_, index) => [184 + index * 16, 112] as [number, number]))
  entities.push(
    fixture('cafe-trial-coffee-machine', '咖啡机', 56, 168),
    fixture('commercial-cafe-menu', '菜单', 616, 112),
    fixture('commercial-cafe-blackboard', '黑板', 616, 560),
    fixture('cafe-trial-order', '点单', 216, 336, false),
    fixture('cafe-trial-pickup', '取餐', 216, 224, false),
  )
  const tables = [[448, 196], [588, 196], [448, 448], [588, 448]] as const
  tables.forEach(([x, y], index) => {
    const story = index === 2
    const groupId = story ? 'commercial-cafe-right-window-upper-group' : `cafe-trial-table-group-${index + 1}`
    const tableId = story ? cafeStoryTableId : `${groupId}-table`
    const table: MainlineSceneEntity = { ...fixture(tableId, '桌子', x, y), kind: 'table', weight: 'anchor', groupId, approach: point(x - 44, y), shape: footprint(x, y, 32, 16) }
    entities.push(table)
    const chairIds = story ? ['commercial-cafe-right-window-upper-group-chair-top', cafeConversationSeatId] : [`${groupId}-chair-top`, `${groupId}-chair-bottom`]
    chairIds.forEach((id, sideIndex) => {
      const direction = sideIndex === 0 ? -1 : 1
      const rest = point(x, y + direction * 22)
      const pulled = point(x, y + direction * 44)
      entities.push({ ...fixture(id, '椅子', x, y + direction * 22), kind: 'seat', weight: 'minor', groupId,
        approach: pulled, shape: footprint(x, y + direction * 22, 32, 16),
        seat: { id, tableId, side: sideIndex === 0 ? 'top' : 'bottom', rest, pulled, sit: rest },
      })
    })
    groups.push({ id: groupId, anchor: table.position, entityIds: [table.id, ...chairIds] })
  })

  const rear = blueprint.portals.find(portal => portal.id === `${room.id}-rear-door`)!
  const toiletId = 'cafe-trial-customer-toilet-door'
  const toiletX = point(560, 0).x
  const dx = toiletX - rear.endpoint.doorPosition.x
  const shift = (value: Point) => ({ x: value.x + dx, y: value.y })
  const toilet = { ...rear, id: toiletId, entity: { ...rear.entity, id: toiletId, displayLabel: '厕' },
    endpoint: { doorPosition: shift(rear.endpoint.doorPosition), threshold: shift(rear.endpoint.threshold), crossingTarget: shift(rear.endpoint.crossingTarget) },
    wallOpenings: rear.wallOpenings?.map(entry => ({ ...entry, opening: { ...entry.opening, start: entry.opening.start + dx, end: entry.opening.end + dx, doorId: toiletId } })),
    transitionText: '厕所内部尚未展开。', lockedText: '厕所内部尚未展开。',
  }
  const targets = [
    { id: 'commercial-cafe-counter-service', position: point(128, 336) },
    { id: 'commercial-cafe-prep-station', position: point(112, 168) },
    ...[224, 336, 448].map((y, index) => ({ id: `commercial-cafe-counter-ambient-${index + 1}`, position: point(128, y) })),
    { id: 'commercial-cafe-floor-service-staging', position: point(336, 560) },
  ]
  return { ...blueprint,
    portals: [...blueprint.portals, toilet],
    interactionText: { ...blueprint.interactionText, 'commercial-cafe-menu': '菜单在客人区右侧墙边。', 'commercial-cafe-blackboard': '黑板在客人区右侧墙边。' },
    scene: { ...data,
      floorEntities: [...data.floorEntities.filter(entity => !oldIds.has(entity.id)), ...entities],
      furnitureGroups: [...data.furnitureGroups.filter(group => !group.entityIds.some(id => oldIds.has(id))), ...groups],
      continuousStructures: [...(data.continuousStructures ?? []).filter(body => !body.id.startsWith('commercial-north-cafe-')), ...structures],
      navigationBarriers: data.navigationBarriers?.filter(relation => !oldIds.has(relation.firstEntityId) && !oldIds.has(relation.secondEntityId)),
      // These are role permissions inside the actual counter, not extra physical collision.
      accessRegions: [...(data.accessRegions ?? []).filter(region => region.id !== 'commercial-cafe-staff-area'),
        { id: 'commercial-cafe-staff-area', ...point(0, 112), width: 168 / 1920 * 100, height: 448 / 1080 * 100, requiredAccess: 'staff', deniedText: '这里是柜台员工区。' },
        { id: 'cafe-trial-rear-work-area', ...point(0, 0), width: 400 / 1920 * 100, height: 112 / 1080 * 100, requiredAccess: 'staff', deniedText: '这里是柜台员工区。' }],
      // Declare the actual public-facing work openings. The regions already
      // deny public occupation; these edges also retain the attempted click's
      // access reason instead of silently projecting it onto the counter.
      accessBoundaries: [...(data.accessBoundaries ?? []).filter(boundary => boundary.regionId !== 'commercial-cafe-staff-area' && boundary.regionId !== 'cafe-trial-rear-work-area'),
        { id: 'commercial-cafe-staff-bottom-access-boundary', regionId: 'commercial-cafe-staff-area', edge: 'bottom' },
        { id: 'cafe-trial-rear-right-access-boundary', regionId: 'cafe-trial-rear-work-area', edge: 'right' }],
      npcBehaviorTargets: [...(data.npcBehaviorTargets ?? []).filter(target => !targets.some(next => next.id === target.id)), ...targets],
      npcs: data.npcs?.map(npc => npc.roomId === room.id ? { ...npc, label: '人' } : npc),
    },
  }
}

type TakeawayTrial = {
  roomId: string
  prefix: string
  oldStructurePrefix: string
  runs: readonly { id: string; cells: readonly [number, number][]; glyphOffset?: 0 | 1 }[]
  stations: readonly { id: string; label: string; x: number; y: number; bodyId?: string; side?: 'left' | 'bottom' }[]
  equipment: readonly { label: string; x: number; y: number }[]
  worker: readonly [number, number]
  regions: readonly { x: number; y: number; width: number; height: number }[]
}

/** Shared character/body construction; each shop supplies its own work sequence and geometry. */
function buildTakeawayTrial(blueprint: MainlineSceneBlueprint, trial: TakeawayTrial): MainlineSceneBlueprint {
  const data = blueprint.scene, room = data.rooms!.find(candidate => candidate.id === trial.roomId)!
  const point = (x: number, y: number): Point => ({ x: room.bounds.x + x / 1920 * 100, y: room.bounds.y + y / 1080 * 100 })
  const oldIds = new Set(data.floorEntities.filter(entity => entity.roomId === room.id).map(entity => entity.id))
  const entities: MainlineSceneEntity[] = [], structures: MainlineContinuousStructure[] = []
  trial.runs.forEach(run => {
    const xs = run.cells.map(([x]) => x), ys = run.cells.map(([, y]) => y)
    const x = Math.min(...xs) - 8, y = Math.min(...ys) - 8
    const bodyId = `${trial.prefix}-${run.id}-body`
    structures.push({ id: bodyId, kind: 'counter', ...point(x, y), width: (Math.max(...xs) + 8 - x) / 1920 * 100, height: (Math.max(...ys) + 8 - y) / 1080 * 100 })
    run.cells.forEach(([x, y], index) => entities.push({ id: `${trial.prefix}-${run.id}-${index}`, label: (index + (run.glyphOffset ?? 0)) % 2 ? '台' : '柜', kind: 'fixture', weight: 'fixture', surface: 'floor', roomId: room.id, position: point(x, y), visualVisibility: 'static', interactive: false }))
  })
  trial.equipment.forEach(({ label, x, y }, index) => entities.push({
    id: `${trial.prefix}-equipment-${index + 1}`, label, kind: 'fixture', weight: 'fixture', surface: 'floor', roomId: room.id,
    position: point(x, y), visualVisibility: 'static', interactive: false,
    collision: { ...point(x - Array.from(label).length * 8, y - 8), width: Array.from(label).length * 16 / 1920 * 100, height: 16 / 1080 * 100 },
  }))
  const text: Record<string, string> = {}
  trial.stations.forEach(({ id, label, x, y, bodyId, side }) => {
    entities.push({ id, label, kind: 'fixture', weight: 'minor', surface: 'floor', roomId: room.id, position: point(x, y), visualVisibility: 'static', interactive: true,
      ...(bodyId ? { interactionStructureId: `${trial.prefix}-${bodyId}-body`, interactionContactSides: [side!] } : {}),
    })
    text[id] = label === '菜单' ? '菜单在客人侧，进门后可以先看。' : label === '点单' ? '这里是点单位置，制作在柜台里面。' : '这里是取货位置，与点单位置分开。'
  })
  const workerId = `${trial.prefix}-worker`
  return { ...blueprint, interactionText: { ...blueprint.interactionText, ...text },
    explorationText: { ...blueprint.explorationText, ...Object.fromEntries(Object.entries(text).map(([id, value]) => [id, [value]])) },
    scene: { ...data,
    floorEntities: [...data.floorEntities.filter(entity => !oldIds.has(entity.id)), ...entities],
    furnitureGroups: data.furnitureGroups.filter(group => !group.entityIds.some(id => oldIds.has(id))),
    continuousStructures: [...(data.continuousStructures ?? []).filter(body => !body.id.startsWith(trial.oldStructurePrefix)), ...structures],
    blockers: data.blockers.filter(body => !body.id.startsWith(trial.oldStructurePrefix)),
    navigationBarriers: data.navigationBarriers?.filter(relation => !oldIds.has(relation.firstEntityId) && !oldIds.has(relation.secondEntityId)),
    accessRegions: [...(data.accessRegions ?? []), ...trial.regions.map((region, index) => ({ id: `${trial.prefix}-staff-${index}`, ...point(region.x, region.y), width: region.width / 1920 * 100, height: region.height / 1080 * 100, requiredAccess: 'staff' as const, deniedText: '这里是柜台员工区。' }))],
    actorAccess: { ...data.actorAccess, [workerId]: ['public', 'staff'] },
    // A stationary anonymous layout occupant, with no new dialogue or commerce duty.
    npcs: [...(data.npcs ?? []), { id: workerId, roleId: 'pedestrian', label: '人', roomId: room.id, interactive: false }],
    npcPlacements: [...(data.npcPlacements ?? []), { npcId: workerId, position: point(...trial.worker) }],
  } }
}

export function trialTakeawayInteriors(blueprint: MainlineSceneBlueprint): MainlineSceneBlueprint {
  const milkTea = buildTakeawayTrial(blueprint, {
    roomId: 'commercial-south-s5-interior', prefix: 'milk-tea-trial', oldStructurePrefix: 'commercial-s5-milk-tea-',
    // Front is at y0. A long right counter separates ordering and collection along the shop.
    runs: [
      { id: 'long-counter', cells: Array.from({ length: 29 }, (_, i) => [224, 112 + i * 16] as [number, number]) },
      { id: 'rear-return', cells: [[208, 560], [192, 560]], glyphOffset: 1 },
    ],
    stations: [
      { id: 'commercial-s5-milk-tea-menu-service-label', label: '菜单', x: 56, y: 56 },
      { id: 'commercial-s5-milk-tea-order-service-label', label: '点单', x: 176, y: 168, bodyId: 'long-counter', side: 'left' },
      { id: 'commercial-s5-milk-tea-pickup-service-label', label: '取餐', x: 176, y: 528, bodyId: 'long-counter', side: 'left' },
    ],
    equipment: [{ label: '制茶机', x: 280, y: 224 }, { label: '封口机', x: 280, y: 336 }, { label: '清洗台', x: 280, y: 476 }],
    worker: [264, 392],
    // Only the actual right work lane is restricted; the open rear turning floor
    // is not an invisible warehouse partition. The true warehouse door is locked.
    regions: [{ x: 224, y: 112, width: 112, height: 448 }],
  })
  return buildTakeawayTrial(milkTea, {
    roomId: 'commercial-north-n1-interior', prefix: 'fruit-tea-trial', oldStructurePrefix: 'commercial-retail-n1-fruit-tea-',
    // Front is at y700. A shorter left L wraps a rear fruit preparation area,
    // leaving the front half for waiting rather than copying the long milk-tea queue.
    runs: [
      { id: 'left-return', cells: Array.from({ length: 15 }, (_, i) => [112, 112 + i * 16] as [number, number]) },
      { id: 'service-counter', cells: Array.from({ length: 10 }, (_, i) => [128 + i * 16, 336] as [number, number]), glyphOffset: 1 },
    ],
    stations: [
      { id: 'fruit-tea-trial-menu', label: '菜单', x: 280, y: 588 },
      { id: 'fruit-tea-trial-order', label: '点单', x: 144, y: 384, bodyId: 'service-counter', side: 'bottom' },
      { id: 'fruit-tea-trial-pickup', label: '取货', x: 240, y: 384, bodyId: 'service-counter', side: 'bottom' },
    ],
    equipment: [{ label: '清洗台', x: 56, y: 168 }, { label: '切果台', x: 224, y: 224 }, { label: '打包台', x: 224, y: 280 }, { label: '冷藏', x: 252, y: 56 }],
    worker: [168, 252], regions: [{ x: 0, y: 0, width: 336, height: 336 }],
  })
}
