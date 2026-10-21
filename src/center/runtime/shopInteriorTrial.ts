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
      npcBehaviorTargets: [...(data.npcBehaviorTargets ?? []).filter(target => !targets.some(next => next.id === target.id)), ...targets],
      npcs: data.npcs?.map(npc => npc.roomId === room.id ? { ...npc, label: '人' } : npc),
    },
  }
}
