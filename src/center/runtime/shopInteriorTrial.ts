import type { MainlineSceneBlueprint, MainlineSceneEntity, MainlineFurnitureGroup, MainlineContinuousStructure } from './mainlineSceneModel'
import type { CollisionBox, Point } from './sceneGeometry'
import { continuousCafeRoomId, cafeConversationSeatId, cafeStoryTableId } from './continuousCafe'

type WallFeature = NonNullable<MainlineSceneBlueprint['scene']['walls'][number]['features']>[number]

/** Replace real boundary cells, including a side painted by the adjacent shell.
 * The feature is not an opening: the underlying wall remains collision-solid. */
function embedCustomerWallText(blueprint: MainlineSceneBlueprint, roomId: string, labels: readonly { id: string; label: string; y: number; edge: 'left' | 'right'; publicX?: number }[]) {
  const room = blueprint.scene.rooms!.find(candidate => candidate.id === roomId)!
  const walls = blueprint.scene.walls.map(wall => ({ ...wall, features: [...(wall.features ?? [])] }))
  for (const label of labels) {
    const x = room.bounds.x + (label.edge === 'right' ? room.bounds.width : 0)
    const y = room.bounds.y + label.y / 1080 * 100
    const candidates = walls.flatMap(wall => (['left', 'right'] as const).filter(edge => (wall.edges ?? ['left', 'right', 'top', 'bottom']).includes(edge)
      && Math.abs(wall.bounds.x + (edge === 'right' ? wall.bounds.width : 0) - x) < .001
      && y > wall.bounds.y && y < wall.bounds.y + wall.bounds.height).map(edge => ({ wall, edge })))
    if (candidates.length !== 1) throw new Error(`Wall text ${label.id} needs one real boundary owner, got ${candidates.length}`)
    const { wall, edge } = candidates[0]!
    const entity: MainlineSceneEntity = {
      id: label.id, label: label.label, kind: 'fixture', weight: 'fixture', surface: 'wall', roomId,
      position: { x, y }, interactive: true, visualVisibility: 'static',
      interactionContactAnchor: { x: label.publicX === undefined ? x + (label.edge === 'right' ? -1 : 1) * 28 / 1920 * 100 : room.bounds.x + label.publicX / 1920 * 100, y },
    }
    const feature: WallFeature = { id: `${label.id}-wall`, edge, start: y - 14 / 1080 * 100, end: y + 14 / 1080 * 100, glyphs: Array.from(label.label), layout: 'inline', entity }
    wall.features.push(feature)
  }
  return { ...blueprint, scene: { ...blueprint.scene, walls } }
}

/** Move the one existing rear passage and its one opening together. */
function employeeRearDoor(blueprint: MainlineSceneBlueprint, roomId: string, localX: number) {
  const room = blueprint.scene.rooms!.find(candidate => candidate.id === roomId)!
  const id = `${roomId}-rear-door`
  const x = room.bounds.x + localX / 1920 * 100
  return { ...blueprint, portals: blueprint.portals.map(portal => {
    if (portal.id !== id) return portal
    const dx = x - portal.endpoint.doorPosition.x
    const shift = (point: Point) => ({ ...point, x: point.x + dx })
    return { ...portal, endpoint: { doorPosition: shift(portal.endpoint.doorPosition), threshold: shift(portal.endpoint.threshold), crossingTarget: shift(portal.endpoint.crossingTarget) },
      wallOpenings: portal.wallOpenings?.map(entry => ({ ...entry, opening: { ...entry.opening, start: entry.opening.start + dx, end: entry.opening.end + dx } })),
    }
  }) }
}


/** One real body per leg, one exterior contour per connected counter. */
function addCounterSurface(entities: MainlineSceneEntity[], structures: MainlineContinuousStructure[], point: (x: number, y: number) => Point, roomId: string, spec: {
  id: string; groupId: string; bounds: CollisionBox; orientation: 'horizontal' | 'vertical'; publicSide: 'top' | 'bottom' | 'left' | 'right'
  services?: readonly { id: string; x: number; y: number; order?: boolean }[]
}) {
  const { bounds } = spec, bodyId = `${spec.id}-body`, genericId = `${spec.id}-0`
  structures.push({ id: bodyId, kind: 'counter', ...point(bounds.x, bounds.y), width: bounds.width / 19.2, height: bounds.height / 10.8,
    counterSurface: { groupId: spec.groupId, roomId, interactionEntityId: genericId, labelEntityId: spec.services?.[0]?.id ?? genericId, orientation: spec.orientation } })
  const anchor = (id: string, x: number, y: number, service = false, order = false): MainlineSceneEntity => ({
    id, label: '柜台', kind: 'fixture', weight: 'fixture', surface: 'floor', roomId, position: point(x, y),
    interactive: true, visualVisibility: 'static', interactionStructureId: bodyId, interactionContactSides: [spec.publicSide],
    counterSurfaceId: spec.groupId, counterService: service, ...(order ? { interactionBehavior: 'cafe-order' as const } : {}),
  })
  entities.push(anchor(genericId, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))
  spec.services?.forEach(service => entities.push(anchor(service.id, service.x, service.y, true, service.order)))
}

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

  //16px text +3px reference-world padding on both transverse sides.
  //Join both legs at the same bottom edge instead of retaining the old4px step.
  const lowerGroup = 'cafe-trial-L-counter'
  addCounterSurface(entities, structures, point, room.id, { id: 'cafe-trial-counter-long', groupId: lowerGroup, bounds: { x: 185, y: 72, width: 22, height: 416 }, orientation: 'vertical', publicSide: 'right', services: [
    { id: 'commercial-cafe-counter', x: 196, y: 336, order: true }, { id: 'cafe-trial-pickup', x: 196, y: 224 }, { id: 'cafe-trial-order', x: 196, y: 432 },
  ] })
  addCounterSurface(entities, structures, point, room.id, { id: 'cafe-trial-counter-front', groupId: lowerGroup, bounds: { x: 8, y: 466, width: 177, height: 22 }, orientation: 'horizontal', publicSide: 'bottom' })
  // This is physically separate above the32px employee exit: never bridge it.
  addCounterSurface(entities, structures, point, room.id, { id: 'cafe-trial-counter-upper', groupId: 'cafe-trial-counter-upper', bounds: { x: 185, y: 8, width: 22, height: 32 }, orientation: 'vertical', publicSide: 'right' })
  entities.push(
    { ...fixture('cafe-trial-coffee-machine', '咖啡机', 24, 224), collision: footprint(24, 224, 16, 48), textLayout: 'vertical', focusFrame: 'interactive' },
    { ...fixture('cafe-trial-prep-table', '备餐台', 24, 336), collision: footprint(24, 336, 16, 48), textLayout: 'vertical', focusFrame: 'interactive' },
    { ...fixture('cafe-trial-wash', '清洗台', 24, 432), collision: footprint(24, 432, 16, 48), textLayout: 'vertical', focusFrame: 'interactive' },
    { ...fixture('cafe-trial-cold', '冷藏', 24, 168), collision: footprint(24, 168, 16, 32), textLayout: 'vertical', focusFrame: 'interactive' },
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
  const result: MainlineSceneBlueprint = { ...blueprint,
    portals: [...blueprint.portals, toilet],
    interactionText: { ...blueprint.interactionText, ...Object.fromEntries(entities.filter(e=>e.interactionStructureId&&!e.interactionBehavior).map(e=>[e.id,'柜台。'])), 'commercial-cafe-menu': '菜单嵌在柜台侧墙里。', 'commercial-cafe-blackboard': '黑板嵌在柜台侧墙里。' },
    explorationText: { ...blueprint.explorationText, ...Object.fromEntries(entities.filter(e=>e.interactionStructureId&&!e.interactionBehavior).map(e=>[e.id,['柜台。']])),
      'commercial-cafe-menu': ['菜单嵌在柜台侧墙里。'], 'commercial-cafe-blackboard': ['黑板嵌在柜台侧墙里。'],
      'cafe-trial-order': ['这里仍是原柜台的点单接触位置。'], 'cafe-trial-pickup': ['这里是柜台交付饮品的一侧。'],
      'cafe-trial-coffee-machine': ['咖啡机放在员工工作线上。'], 'cafe-trial-prep-table': ['备餐台与咖啡机共用员工侧通道。'],
      'cafe-trial-wash': ['清洗台在柜台里面。'], 'cafe-trial-cold': ['冷藏设备在后方准备区。'],
    },
    scene: { ...data,
      floorEntities: [...data.floorEntities.filter(entity => !oldIds.has(entity.id)), ...entities],
      furnitureGroups: [...data.furnitureGroups.filter(group => !group.entityIds.some(id => oldIds.has(id))), ...groups],
      continuousStructures: [...(data.continuousStructures ?? []).filter(body => !body.id.startsWith('commercial-north-cafe-')), ...structures],
      navigationBarriers: data.navigationBarriers?.filter(relation => !oldIds.has(relation.firstEntityId) && !oldIds.has(relation.secondEntityId)),
      // These are role permissions inside the actual counter, not extra physical collision.
      accessRegions: [...(data.accessRegions ?? []).filter(region => region.id !== 'commercial-cafe-staff-area' && region.id !== 'cafe-trial-rear-work-area'),
        { id: 'commercial-cafe-staff-area', ...point(0, 0), width: 196 / 1920 * 100, height: 480 / 1080 * 100, requiredAccess: 'staff' as const, deniedText: '这里是柜台员工区。' }],
      // One finite work strip owns the counter and its independent employee opening.
      accessBoundaries: [...(data.accessBoundaries ?? []).filter(boundary => boundary.regionId !== 'commercial-cafe-staff-area' && boundary.regionId !== 'cafe-trial-rear-work-area'),
        { id: 'commercial-cafe-staff-right-access-boundary', regionId: 'commercial-cafe-staff-area', edge: 'right' as const }],
      npcBehaviorTargets: [...(data.npcBehaviorTargets ?? []).filter(target => !targets.some(next => next.id === target.id)), ...targets],
      npcs: data.npcs?.map(npc => npc.roomId === room.id ? { ...npc, label: '人' } : npc),
    },
  }
  return embedCustomerWallText(employeeRearDoor(result, room.id, 84), room.id, [
    { id: 'commercial-cafe-menu', label: '菜单', y: 392, edge: 'left', publicX: 224 },
    { id: 'commercial-cafe-blackboard', label: '黑板', y: 252, edge: 'left', publicX: 224 },
  ])
}

type TakeawayTrial = {
  roomId: string
  prefix: string
  oldStructurePrefix: string
  runs: readonly { id: string; bounds: CollisionBox; orientation: 'horizontal' | 'vertical'; publicSide: 'top' | 'bottom' | 'left' | 'right' }[]
  stations: readonly { id: string; x: number; y: number }[]
  menu: { id: string; y: number; edge: 'left' | 'right'; publicX: number }
  publicSide: 'left' | 'right'
  rearX: number
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
  trial.runs.forEach((run, index) => addCounterSurface(entities, structures, point, room.id, {
    id: `${trial.prefix}-${run.id}`, groupId: `${trial.prefix}-L-counter`, bounds: run.bounds, orientation: run.orientation, publicSide: run.publicSide,
    services: index === 0 ? trial.stations : undefined,
  }))
  trial.equipment.forEach(({ label, x, y }, index) => entities.push({
    id: `${trial.prefix}-equipment-${index + 1}`, label, kind: 'fixture', weight: 'fixture', surface: 'floor', roomId: room.id,
    position: point(x, y), visualVisibility: 'static', interactive: true, textLayout: 'vertical', focusFrame: 'interactive',
    collision: { ...point(x - 8, y - Array.from(label).length * 8), width: 16 / 1920 * 100, height: Array.from(label).length * 16 / 1080 * 100 },
  }))
  const text: Record<string, string> = Object.fromEntries(entities.filter(e=>e.interactionStructureId).map(e=>[e.id,'柜台。']))
  text[trial.menu.id] = '菜单嵌在柜台侧墙里，进门可以先看。'
  trial.stations.forEach(({ id }, index) => { text[id] = index === 0 ? '这里是原柜台的点单接触位置。' : '这里是原柜台的取货接触位置。' })
  trial.equipment.forEach(({ label }, index) => { text[`${trial.prefix}-equipment-${index + 1}`] = `${label}位于员工工作线上。当前可查看，制作操作尚未开放。` })
  const workerId = `${trial.prefix}-worker`
  const result: MainlineSceneBlueprint = { ...blueprint, interactionText: { ...blueprint.interactionText, ...text },
    explorationText: { ...blueprint.explorationText, ...Object.fromEntries(Object.entries(text).map(([id, value]) => [id, [value]])) },
    scene: { ...data,
    floorEntities: [...data.floorEntities.filter(entity => !oldIds.has(entity.id)), ...entities],
    furnitureGroups: data.furnitureGroups.filter(group => !group.entityIds.some(id => oldIds.has(id))),
    continuousStructures: [...(data.continuousStructures ?? []).filter(body => !body.id.startsWith(trial.oldStructurePrefix)), ...structures],
    blockers: data.blockers.filter(body => !body.id.startsWith(trial.oldStructurePrefix)),
    navigationBarriers: data.navigationBarriers?.filter(relation => !oldIds.has(relation.firstEntityId) && !oldIds.has(relation.secondEntityId)),
    accessRegions: [...(data.accessRegions ?? []), ...trial.regions.map((region, index) => ({ id: `${trial.prefix}-staff-${index}`, ...point(region.x, region.y), width: region.width / 1920 * 100, height: region.height / 1080 * 100, requiredAccess: 'staff' as const, deniedText: '这里是柜台员工区。' }))],
    accessBoundaries: [...(data.accessBoundaries ?? []), ...trial.regions.map((_, index) => ({ id: `${trial.prefix}-staff-boundary-${index}`, regionId: `${trial.prefix}-staff-${index}`, edge: trial.publicSide }))],
    actorAccess: { ...data.actorAccess, [workerId]: ['public', 'staff'] },
    // A stationary anonymous layout occupant, with no new dialogue or commerce duty.
    npcs: [...(data.npcs ?? []), { id: workerId, roleId: 'pedestrian', label: '人', roomId: room.id, interactive: false }],
    npcPlacements: [...(data.npcPlacements ?? []), { npcId: workerId, position: point(...trial.worker) }],
  } }
  return embedCustomerWallText(employeeRearDoor(result, room.id, trial.rearX), room.id, [{ ...trial.menu, label: '菜单' }])
}

export function trialTakeawayInteriors(blueprint: MainlineSceneBlueprint): MainlineSceneBlueprint {
  const milkTea = buildTakeawayTrial(blueprint, {
    roomId: 'commercial-south-s5-interior', prefix: 'milk-tea-trial', oldStructurePrefix: 'commercial-s5-milk-tea-',
    // Front is at y0. A long right counter separates ordering and collection along the shop.
    runs: [
      { id: 'long-counter', bounds: { x: 213, y: 101, width: 22, height: 591 }, orientation: 'vertical', publicSide: 'left' },
      { id: 'front-return', bounds: { x: 235, y: 101, width: 93, height: 22 }, orientation: 'horizontal', publicSide: 'top' },
    ],
    stations: [
      { id: 'commercial-s5-milk-tea-order-service-label', x: 224, y: 224 },
      { id: 'commercial-s5-milk-tea-pickup-service-label', x: 224, y: 432 },
    ],
    publicSide: 'left', menu: { id: 'commercial-s5-milk-tea-menu-service-label', y: 168, edge: 'right', publicX: 176 }, rearX: 280,
    equipment: [{ label: '制茶机', x: 312, y: 336 }, { label: '封口机', x: 312, y: 448 }, { label: '清洗台', x: 312, y: 560 }, { label: '煮料台', x: 312, y: 224 }],
    worker: [248, 392],
    // The right work lane continues to its one locked rear door. There is no
    // interior warehouse or public-side employee exit: the long end meets the rear wall.
    regions: [{ x: 224, y: 112, width: 112, height: 588 }],
  })
  return buildTakeawayTrial(milkTea, {
    roomId: 'commercial-north-n1-interior', prefix: 'fruit-tea-trial', oldStructurePrefix: 'commercial-retail-n1-fruit-tea-',
    // Front is at y700. The left work line closes into the wall at its front
    // end; the other terminal now meets the rear wall too.
    runs: [
      { id: 'long-counter', bounds: { x: 101, y: 8, width: 22, height: 563 }, orientation: 'vertical', publicSide: 'right' },
      { id: 'front-return', bounds: { x: 8, y: 549, width: 93, height: 22 }, orientation: 'horizontal', publicSide: 'bottom' },
    ],
    stations: [
      { id: 'fruit-tea-trial-order', x: 112, y: 432 },
      { id: 'fruit-tea-trial-pickup', x: 112, y: 336 },
    ],
    publicSide: 'right', menu: { id: 'fruit-tea-trial-menu', y: 616, edge: 'left', publicX: 160 }, rearX: 56,
    equipment: [{ label: '清洗台', x: 24, y: 308 }, { label: '切果台', x: 24, y: 392 }, { label: '打包台', x: 24, y: 476 }, { label: '冷藏', x: 24, y: 140 }, { label: '煮料台', x: 24, y: 224 }],
    worker: [88, 252], regions: [{ x: 0, y: 0, width: 112, height: 560 }],
  })
}
