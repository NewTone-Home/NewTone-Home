import type { MainlineSceneBlueprint, MainlineSceneEntity, MainlineFurnitureGroup, MainlineContinuousStructure } from './mainlineSceneModel'
import type { Point } from './sceneGeometry'
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
      const serviceId = id === 'cafe-trial-counter-long' ? ({ 7: 'cafe-trial-pickup', 20: 'cafe-trial-order' } as Record<number, string>)[index] : undefined
      const entity = fixture(index === orderIndex ? 'commercial-cafe-counter' : serviceId ?? `${id}-${index}`, index % 2 ? '台' : '柜', x, y, false)
      entity.interactionStructureId = bodyId
      entity.interactionContactSides = ['right']
      entity.interactive = true
      entity.focusFrame = 'interactive'
      entity.focusFrameGroup = bodyId
      if (index === orderIndex) entity.interactionBehavior = 'cafe-order'
      entities.push(entity)
    })
  }
  counterRun('cafe-trial-counter-long', Array.from({ length: 25 }, (_, index) => [176, 112 + index * 16] as [number, number]), 14)
  // Both L terminals meet real walls. A separate32px opening at y72..104
  // admits the16px employee; no invisible blocker closes any counter end.
  counterRun('cafe-trial-counter-upper', Array.from({ length: 4 }, (_, index) => [176, 16 + index * 16] as [number, number]))
  counterRun('cafe-trial-counter-front', Array.from({ length: 10 }, (_, index) => [160 - index * 16, 496] as [number, number]))
  entities.push(
    { ...fixture('cafe-trial-coffee-machine', '咖啡机', 48, 224), collision: footprint(48, 224, 16, 48), textLayout: 'vertical', focusFrame: 'interactive' },
    { ...fixture('cafe-trial-prep-table', '备餐台', 48, 336), collision: footprint(48, 336, 16, 48), textLayout: 'vertical', focusFrame: 'interactive' },
    { ...fixture('cafe-trial-wash', '清洗台', 48, 448), collision: footprint(48, 448, 16, 48), textLayout: 'vertical', focusFrame: 'interactive' },
    { ...fixture('cafe-trial-cold', '冷藏', 48, 168), collision: footprint(48, 168, 16, 32), textLayout: 'vertical', focusFrame: 'interactive' },
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
        { id: 'commercial-cafe-staff-area', ...point(0, 0), width: 176 / 1920 * 100, height: 496 / 1080 * 100, requiredAccess: 'staff' as const, deniedText: '这里是柜台员工区。' }],
      // One finite work strip owns the counter and its independent employee opening.
      accessBoundaries: [...(data.accessBoundaries ?? []).filter(boundary => boundary.regionId !== 'commercial-cafe-staff-area' && boundary.regionId !== 'cafe-trial-rear-work-area'),
        { id: 'commercial-cafe-staff-right-access-boundary', regionId: 'commercial-cafe-staff-area', edge: 'right' as const }],
      npcBehaviorTargets: [...(data.npcBehaviorTargets ?? []).filter(target => !targets.some(next => next.id === target.id)), ...targets],
      npcs: data.npcs?.map(npc => npc.roomId === room.id ? { ...npc, label: '人' } : npc),
    },
  }
  return embedCustomerWallText(employeeRearDoor(result, room.id, 84), room.id, [
    { id: 'commercial-cafe-menu', label: '菜单', y: 560, edge: 'left', publicX: 208 },
    { id: 'commercial-cafe-blackboard', label: '黑板', y: 252, edge: 'left', publicX: 208 },
  ])
}

type TakeawayTrial = {
  roomId: string
  prefix: string
  oldStructurePrefix: string
  runs: readonly { id: string; cells: readonly [number, number][]; glyphOffset?: 0 | 1 }[]
  stations: readonly { id: string; cell: number }[]
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
  trial.runs.forEach(run => {
    const xs = run.cells.map(([x]) => x), ys = run.cells.map(([, y]) => y)
    const x = Math.min(...xs) - 8, y = Math.min(...ys) - 8
    const bodyId = `${trial.prefix}-${run.id}-body`
    structures.push({ id: bodyId, kind: 'counter', ...point(x, y), width: (Math.max(...xs) + 8 - x) / 1920 * 100, height: (Math.max(...ys) + 8 - y) / 1080 * 100 })
    run.cells.forEach(([x, y], index) => {
      const station = run.id === trial.runs[0]!.id ? trial.stations.find(candidate => candidate.cell === index) : undefined
      entities.push({ id: station?.id ?? `${trial.prefix}-${run.id}-${index}`, label: (index + (run.glyphOffset ?? 0)) % 2 ? '台' : '柜', kind: 'fixture', weight: 'fixture', surface: 'floor', roomId: room.id, position: point(x, y), visualVisibility: 'static', interactive: true, focusFrame: 'interactive', focusFrameGroup: bodyId, interactionStructureId: bodyId, interactionContactSides: [trial.publicSide] })
    })
  })
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
      { id: 'long-counter', cells: Array.from({ length: 37 }, (_, i) => [208, 112 + i * 16] as [number, number]) },
      { id: 'front-return', cells: Array.from({ length: 7 }, (_, i) => [224 + i * 16, 112] as [number, number]), glyphOffset: 1 },
    ],
    stations: [
      { id: 'commercial-s5-milk-tea-order-service-label', cell: 7 },
      { id: 'commercial-s5-milk-tea-pickup-service-label', cell: 20 },
    ],
    publicSide: 'left', menu: { id: 'commercial-s5-milk-tea-menu-service-label', y: 168, edge: 'right', publicX: 176 }, rearX: 280,
    equipment: [{ label: '制茶机', x: 280, y: 336 }, { label: '封口机', x: 280, y: 448 }, { label: '清洗台', x: 280, y: 560 }, { label: '煮料台', x: 280, y: 224 }],
    worker: [240, 392],
    // The right work lane continues to its one locked rear door. There is no
    // interior warehouse or public-side employee exit: the long end meets the rear wall.
    regions: [{ x: 208, y: 112, width: 128, height: 588 }],
  })
  return buildTakeawayTrial(milkTea, {
    roomId: 'commercial-north-n1-interior', prefix: 'fruit-tea-trial', oldStructurePrefix: 'commercial-retail-n1-fruit-tea-',
    // Front is at y700. The left work line closes into the wall at its front
    // end; the other terminal now meets the rear wall too.
    runs: [
      { id: 'long-counter', cells: Array.from({ length: 35 }, (_, i) => [128, 16 + i * 16] as [number, number]) },
      { id: 'front-return', cells: Array.from({ length: 7 }, (_, i) => [112 - i * 16, 560] as [number, number]), glyphOffset: 1 },
    ],
    stations: [
      { id: 'fruit-tea-trial-order', cell: 26 },
      { id: 'fruit-tea-trial-pickup', cell: 20 },
    ],
    publicSide: 'right', menu: { id: 'fruit-tea-trial-menu', y: 560, edge: 'left', publicX: 160 }, rearX: 56,
    equipment: [{ label: '清洗台', x: 48, y: 308 }, { label: '切果台', x: 48, y: 392 }, { label: '打包台', x: 48, y: 476 }, { label: '冷藏', x: 48, y: 140 }, { label: '煮料台', x: 48, y: 224 }],
    worker: [96, 252], regions: [{ x: 0, y: 0, width: 128, height: 560 }],
  })
}
