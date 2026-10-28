import type { MainlineSceneBlueprint, MainlineSceneEntity, MainlineFurnitureGroup, MainlineContinuousStructure } from './mainlineSceneModel'
import type { CollisionBox, Point } from './sceneGeometry'
import { attachCafeRestroom } from './cafeRestroom'
import { continuousCafeRoomId, cafeConversationSeatId, cafeStoryTableId } from './continuousCafe'
import { commercialStreetDrinkMenuText } from './commercialStreetDrinkCatalog'

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
  label?: string; hideLabel?: boolean; role?: 'counter' | 'worktop'; entryId?: string; outlineBounds?: CollisionBox
  services?: readonly { id: string; x: number; y: number; label?: string; order?: boolean; visual?: 'app-square' }[]
}) {
  const { bounds } = spec, bodyId = `${spec.id}-body`, genericId = `${spec.id}-0`
  structures.push({ id: bodyId, kind: 'counter', ...point(bounds.x, bounds.y), width: bounds.width / 19.2, height: bounds.height / 10.8,
    counterSurface: { groupId: spec.groupId, roomId, interactionEntityId: genericId, labelEntityId: genericId, orientation: spec.orientation, label: spec.label, hideLabel: spec.hideLabel, role: spec.role,
      services: spec.services?.map(service => ({ id: service.id, label: service.label ?? '', position: point(service.x, service.y), visual: service.visual })),
      outlineBounds: spec.outlineBounds ? { ...point(spec.outlineBounds.x, spec.outlineBounds.y), width: spec.outlineBounds.width / 19.2, height: spec.outlineBounds.height / 10.8 } : undefined } })
  const anchor = (id: string, x: number, y: number, service = false, order = false): MainlineSceneEntity => ({
    id, label: spec.label ?? '柜台', kind: 'fixture', weight: 'fixture', surface: 'floor', roomId, position: point(x, y),
    interactive: true, visualVisibility: 'static', interactionStructureId: bodyId, interactionContactSides: [spec.publicSide],
    counterSurfaceId: spec.groupId, counterService: service, ...(order ? { interactionBehavior: 'cafe-order' as const } : {}),
  })
  entities.push({ ...anchor(genericId, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2), interactionAliasId: spec.entryId })
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
  addCounterSurface(entities, structures, point, room.id, { id: 'cafe-trial-counter-long', groupId: lowerGroup, bounds: { x: 185, y: 72, width: 22, height: 416 }, orientation: 'vertical', publicSide: 'right', entryId: 'commercial-cafe-counter', services: [
    { id: 'commercial-cafe-counter', x: 196, y: 336, order: true },
  ] })
  addCounterSurface(entities, structures, point, room.id, { id: 'cafe-trial-counter-front', groupId: lowerGroup, bounds: { x: 8, y: 466, width: 177, height: 22 }, outlineBounds: { x: -14, y: 466, width: 199, height: 22 }, orientation: 'horizontal', publicSide: 'bottom', entryId: 'commercial-cafe-counter' })
  // This is physically separate above the32px employee exit: never bridge it.
  addCounterSurface(entities, structures, point, room.id, { id: 'cafe-trial-counter-upper', groupId: 'cafe-trial-counter-upper', bounds: { x: 185, y: 8, width: 22, height: 32 }, outlineBounds: { x: 185, y: -14, width: 22, height: 54 }, orientation: 'vertical', publicSide: 'right', hideLabel: true, entryId: 'commercial-cafe-counter' })
  addCounterSurface(entities, structures, point, room.id, { id: 'cafe-trial-worktop', groupId: 'cafe-trial-worktop', bounds: { x: 16, y: 144, width: 24, height: 280 }, orientation: 'vertical', publicSide: 'right', label: '工作台', role: 'worktop' })
  for (const id of ['cafe-trial-coffee-machine', 'cafe-trial-prep-table', 'cafe-trial-wash', 'cafe-trial-cold']) entities.push({ ...fixture(id, '工作台', 28, 284, false), counterSurfaceId: 'cafe-trial-worktop', interactionStructureId: 'cafe-trial-worktop-body', interactionContactSides: ['right'], interactionAliasId: 'cafe-trial-worktop-0' })
  const tables = [[448, 196], [588, 196], [448, 448], [588, 448], [448, 322], [588, 322]] as const
  tables.forEach(([x, y], index) => {
    const story = index === 2
    const groupId = story ? 'commercial-cafe-right-window-upper-group' : `cafe-trial-table-group-${index + 1}`
    const tableId = story ? cafeStoryTableId : `${groupId}-table`
    const table: MainlineSceneEntity = { ...fixture(tableId, '桌子', x, y), kind: 'table', weight: 'anchor', groupId, focusFrame: 'interactive', approach: point(x - 44, y), shape: footprint(x, y, 32, 16) }
    entities.push(table)
    const chairIds = story ? ['commercial-cafe-right-window-upper-group-chair-top', cafeConversationSeatId] : [`${groupId}-chair-top`, `${groupId}-chair-bottom`]
    chairIds.forEach((id, sideIndex) => {
      const direction = sideIndex === 0 ? -1 : 1
      const rest = point(x, y + direction * 30)
      const pulled = point(x, y + direction * 52)
      entities.push({ ...fixture(id, '椅子', x, y + direction * 30), kind: 'seat', weight: 'minor', groupId,
        approach: pulled, shape: footprint(x, y + direction * 30, 32, 16),
        seat: { id, tableId, side: sideIndex === 0 ? 'top' : 'bottom', rest, pulled, sit: rest },
      })
    })
    groups.push({ id: groupId, anchor: table.position, entityIds: [table.id, ...chairIds] })
  })

  // Sparse corner plants: no watering system, only the existing view interaction.
    entities.push(
      { ...fixture('cafe-trial-corner-plant-rear', '绿植', 644, 28), focusFrame: 'interactive' },
      { ...fixture('cafe-trial-corner-plant-front', '绿植', 644, 616), focusFrame: 'interactive' },
    )

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
    interactionText: { ...blueprint.interactionText, ...Object.fromEntries(entities.filter(e=>e.interactionStructureId&&!e.interactionBehavior).map(e=>[e.id,e.label+'。'])), 'commercial-cafe-menu': '美式 3\n拿铁 4\n澳白 4\n焦糖玛奇朵 5\n海盐焦糖拿铁 5', 'commercial-cafe-blackboard': '新品｜海盐焦糖拿铁 — 5' },
    explorationText: { ...blueprint.explorationText, ...Object.fromEntries(entities.filter(e=>e.interactionStructureId&&!e.interactionBehavior).map(e=>[e.id,[e.label+'。']])),
      'commercial-cafe-menu': ['美式 3\n拿铁 4\n澳白 4\n焦糖玛奇朵 5\n海盐焦糖拿铁 5'], 'commercial-cafe-blackboard': ['新品｜海盐焦糖拿铁 — 5'],
      'cafe-trial-corner-plant-rear': ['这是店内的装饰，最好不要碰。'],
      'cafe-trial-corner-plant-front': ['叶片层层叠在一起，把墙边的一小块地方遮住了。'],
      'cafe-trial-coffee-machine': ['咖啡机放在员工工作线上。'], 'cafe-trial-prep-table': ['备餐台与咖啡机共用员工侧通道。'],
      'cafe-trial-wash': ['清洗台在柜台里面。'], 'cafe-trial-cold': ['冷藏设备在后方准备区。'],
    },
    scene: { ...data,
      floorEntities: [...data.floorEntities.filter(entity => !oldIds.has(entity.id)), ...entities],
      furnitureGroups: [...data.furnitureGroups.filter(group => !group.entityIds.some(id => oldIds.has(id))), ...groups],
      continuousStructures: [...(data.continuousStructures ?? []).filter(body => !body.id.startsWith('commercial-north-cafe-')), ...structures],
      navigationBarriers: [...(data.navigationBarriers ?? []).filter(relation => !oldIds.has(relation.firstEntityId) && !oldIds.has(relation.secondEntityId)),
        ...groups.flatMap(group => group.entityIds.slice(1).map(id => ({ id: `${id}-table-gap`, firstEntityId: group.entityIds[0], secondEntityId: id })))],
      // These are role permissions inside the actual counter, not extra physical collision.
      accessRegions: [...(data.accessRegions ?? []).filter(region => region.id !== 'commercial-cafe-staff-area' && region.id !== 'cafe-trial-rear-work-area'),
        { id: 'commercial-cafe-staff-area', ...point(0, 0), width: 196 / 1920 * 100, height: 480 / 1080 * 100, requiredAccess: 'staff' as const, deniedText: '这里是柜台员工区。' }],
      // One finite work strip owns the counter and its independent employee opening.
      accessBoundaries: [...(data.accessBoundaries ?? []).filter(boundary => boundary.regionId !== 'commercial-cafe-staff-area' && boundary.regionId !== 'cafe-trial-rear-work-area'),
        { id: 'commercial-cafe-staff-right-access-boundary', regionId: 'commercial-cafe-staff-area', edge: 'right' as const }],
      npcBehaviorTargets: [...(data.npcBehaviorTargets ?? []).filter(target => !targets.some(next => next.id === target.id)), ...targets],
    },
  }
  return attachCafeRestroom(embedCustomerWallText(employeeRearDoor(result, room.id, 84), room.id, [
    { id: 'commercial-cafe-menu', label: '菜单', y: 392, edge: 'left', publicX: 224 },
    { id: 'commercial-cafe-blackboard', label: '黑板', y: 252, edge: 'left', publicX: 224 },
  ]))
}

type TakeawayTrial = {
  roomId: string
  prefix: string
  oldStructurePrefix: string
  runs: readonly { id: string; bounds: CollisionBox; outlineBounds?: CollisionBox; orientation: 'horizontal' | 'vertical'; publicSide: 'top' | 'bottom' | 'left' | 'right' }[]
  stations: readonly { id: string; x: number; y: number; label: string; visual?: 'app-square'; order?: boolean }[]
  menu: { id: string; storeId: string; y: number; edge: 'left' | 'right'; publicX?: number }
  publicSide: 'left' | 'right'
  rearX: number
  /** Legacy device names retain IDs only; they no longer author separate bodies. */
  equipment: readonly string[]
  worktop: CollisionBox
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
    id: `${trial.prefix}-${run.id}`, groupId: `${trial.prefix}-L-counter`, bounds: run.bounds, outlineBounds: run.outlineBounds, orientation: run.orientation, publicSide: run.publicSide,
    services: index === 0 ? trial.stations : undefined, entryId: trial.stations[0].id,
  }))
  const worktopId = `${trial.prefix}-worktop`
  addCounterSurface(entities, structures, point, room.id, { id: worktopId, groupId: worktopId, bounds: trial.worktop, orientation: 'vertical', publicSide: trial.publicSide === 'left' ? 'left' : 'right', label: '工作台', role: 'worktop' })
  trial.equipment.forEach((label, index) => entities.push({
    id: `${trial.prefix}-equipment-${index + 1}`, label, kind: 'fixture', weight: 'fixture', surface: 'floor', roomId: room.id,
    position: point(trial.worktop.x + trial.worktop.width / 2, trial.worktop.y + trial.worktop.height / 2), visualVisibility: 'static', interactive: true,
    counterSurfaceId: worktopId, interactionStructureId: `${worktopId}-body`, interactionContactSides: [trial.publicSide], interactionAliasId: `${worktopId}-0`,
  }))
  const text: Record<string, string> = Object.fromEntries(entities.filter(e=>e.interactionStructureId).map(e=>[e.id,e.label+'。']))
  text[trial.menu.id] = commercialStreetDrinkMenuText(trial.menu.storeId)
  trial.stations.forEach(({ id }) => { text[id] = '点单、查看订单状态和领取都在这里。' })
  trial.equipment.forEach((label, index) => { text[`${trial.prefix}-equipment-${index + 1}`] = `${label}位于员工工作线上。当前可查看，制作操作尚未开放。` })
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
    // The existing counter worker is now the human ordering and recommendation contact.
    npcs: [...(data.npcs ?? []), { id: workerId, roleId: 'pedestrian', label: '店员', roomId: room.id, interactive: true }],
    npcPlacements: [...(data.npcPlacements ?? []), { npcId: workerId, position: point(...trial.worker) }],
  } }
  return embedCustomerWallText(employeeRearDoor(result, room.id, trial.rearX), room.id, [{ ...trial.menu, label: '菜单' }])
}

export function trialTakeawayInteriors(blueprint: MainlineSceneBlueprint): MainlineSceneBlueprint {
  const milkTea = buildTakeawayTrial(blueprint, {
    roomId: 'commercial-south-s5-interior', prefix: 'milk-tea-trial', oldStructurePrefix: 'commercial-s5-milk-tea-',
    // Align the return/frame center with the adjacent shared-wall glyph at y168.
    // The entrance clearance is 149px (140px + 9px alignment); the worktop gaps
    // remain 28px at the counter and 56px at the rear wall.
    runs: [
      { id: 'long-counter', bounds: { x: 157, y: 157, width: 22, height: 479 }, outlineBounds: { x: 157, y: 157, width: 22, height: 501 }, orientation: 'vertical', publicSide: 'left' },
      { id: 'front-return', bounds: { x: 179, y: 157, width: 149, height: 22 }, outlineBounds: { x: 179, y: 157, width: 171, height: 22 }, orientation: 'horizontal', publicSide: 'top' },
    ],
    stations: [
      { id: 'commercial-s5-milk-tea-order-service-label', x: 168, y: 224, label: '\u67dc\u53f0', order: true },
      { id: 'commercial-s5-milk-tea-app-square', x: 168, y: 320, label: 'Open drink ordering', visual: 'app-square' },
    ],
    publicSide: 'left', menu: { id: 'commercial-s5-milk-tea-menu-service-label', storeId: 'commercial-south-slot-5', y: 56, edge: 'left' }, rearX: 280,
    equipment: ['制茶机', '封口机', '清洗台', '煮料台'],
    worktop: { x: 296, y: 207, width: 24, height: 373 }, worker: [216, 392],
    // The right work lane continues to its one locked rear door. There is no
    // interior warehouse or public-side employee exit: the long end meets the rear wall.
    regions: [{ x: 168, y: 179, width: 168, height: 465 }],
  })
  return buildTakeawayTrial(milkTea, {
    roomId: 'commercial-north-n1-interior', prefix: 'fruit-tea-trial', oldStructurePrefix: 'commercial-retail-n1-fruit-tea-',
    // Align the return/frame center with the wall glyph at y476. The entrance
    // clearance is 149px (140px + 9px alignment); worktop gaps remain 28/56px.
    runs: [
      { id: 'long-counter', bounds: { x: 157, y: 8, width: 22, height: 479 }, outlineBounds: { x: 157, y: -14, width: 22, height: 501 }, orientation: 'vertical', publicSide: 'right' },
      { id: 'front-return', bounds: { x: 8, y: 465, width: 149, height: 22 }, outlineBounds: { x: -14, y: 465, width: 171, height: 22 }, orientation: 'horizontal', publicSide: 'bottom' },
    ],
    stations: [
      { id: 'fruit-tea-trial-order', x: 168, y: 432, label: '\u67dc\u53f0', order: true },
      { id: 'fruit-tea-trial-app-square', x: 168, y: 240, label: 'Open drink ordering', visual: 'app-square' },
    ],
    publicSide: 'right', menu: { id: 'fruit-tea-trial-menu', storeId: 'commercial-north-slot-1', y: 588, edge: 'right' }, rearX: 56,
    equipment: ['清洗台', '切果台', '打包台', '冷藏', '煮料台'],
    worktop: { x: 16, y: 64, width: 24, height: 373 }, worker: [112, 252], regions: [{ x: 0, y: 0, width: 168, height: 465 }],
  })
}
