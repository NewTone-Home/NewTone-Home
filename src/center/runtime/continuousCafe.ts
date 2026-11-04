import type { MainlineSceneBlueprint, MainlineSceneEntity, MainlineSceneNpc, MainlineSceneNpcBehavior } from './mainlineSceneModel'
import type { Point, CollisionBox } from './sceneGeometry'
import { npcRoles } from './npcRoles'

export const continuousCafeRoomId = 'commercial-north-cafe-interior'
export const cafeStoryNamespace = 'commercial-cafe'
export const cafeStoryTableId = 'commercial-cafe-right-window-upper-group-table'
export const cafeConversationSeatId = 'commercial-cafe-right-window-upper-group-chair-bottom'
export function isCafeWorldId(id: string) { return id === 'commercial-street' || id === 'commercial-cafe' }

export function isPointInContinuousCafe(scene: { rooms: readonly { id: string; bounds: CollisionBox }[] }, point: Point) {
  const bounds = scene.rooms.find(room => room.id === continuousCafeRoomId)?.bounds
  return !!bounds && point.x > bounds.x && point.x < bounds.x + bounds.width && point.y > bounds.y && point.y < bounds.y + bounds.height
}

export function hasContinuousCafe(scene: { id: string; objects: readonly { id: string }[] }) {
  return scene.id === 'commercial-street' && scene.objects.some(entity => entity.id === cafeStoryTableId)
}

/** Legacy keys remain story data; they no longer identify a second room. */
export function isCafeStoryKey(key: string) { return key.startsWith('commercialCafe') }
export function canonicalCafeEntityId(id: string) { return id === 'cafe-back-door' ? `${continuousCafeRoomId}-rear-door` : id }

export function mapLegacyCafePoint(point: Point | null | undefined, bounds: CollisionBox): Point {
  const insetX = 28 / 1920 * 100, insetY = 28 / 1080 * 100
  const fraction = (value: number, start: number, size: number) => Math.max(0, Math.min(1, (value - start) / size))
  if (!point) return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height - insetY * 2 }
  return {
    x: bounds.x + insetX + fraction(point.x, 8, 80) * (bounds.width - insetX * 2),
    y: bounds.y + insetY + fraction(point.y, 7, 86) * (bounds.height - insetY * 2),
  }
}

/** Keep the current continuous-room layout; attach existing story identities. */
export function bindContinuousCafe(blueprint: MainlineSceneBlueprint): MainlineSceneBlueprint {
  const data = blueprint.scene
  const room = data.rooms!.find(room => room.id === continuousCafeRoomId)!
  const replacements = new Map<string, string>([
    ['commercial-north-cafe-table-front', cafeStoryTableId],
    ['commercial-north-cafe-seat-front-a', 'commercial-cafe-right-window-upper-group-chair-top'],
    ['commercial-north-cafe-seat-front-b', cafeConversationSeatId],
    ['commercial-north-cafe-table-group-front', 'commercial-cafe-right-window-upper-group'],
    ['commercial-north-cafe-counter-1-1', 'commercial-cafe-counter'],
  ])
  const rename = (id: string) => replacements.get(id) ?? id
  const entities: MainlineSceneEntity[] = data.floorEntities.map(entity => ({
    ...entity, id: rename(entity.id), groupId: entity.groupId ? rename(entity.groupId) : undefined,
    ...(rename(entity.id) === 'commercial-cafe-counter' ? { readingProtection: 'preserve' as const } : {}),
    seat: entity.seat ? { ...entity.seat, id: rename(entity.seat.id), tableId: rename(entity.seat.tableId) } : undefined,
    ...(entity.id === 'commercial-north-cafe-counter-1-1' ? { interactive: true, interactionBehavior: 'cafe-order' as const, interactionContactSides: ['top'] as const } : {}),
  }))
  const counter = data.continuousStructures!.find(structure => structure.id === 'commercial-north-cafe-counter-1-body')!
  const staffY = (counter.y + counter.height + room.bounds.y + room.bounds.height) / 2
  const staff = { x: counter.x + counter.width / 2, y: staffY }
  const service = { x: counter.x + counter.width + 2, y: counter.y - 3 }
  const menuCells = entities.filter(entity => entity.id.startsWith('commercial-north-cafe-menu-label-'))
  const menuAnchor = { x: menuCells.reduce((sum, entity) => sum + entity.position.x, 0) / menuCells.length, y: menuCells[0]!.position.y }
  const retained = entities.filter(entity => !entity.id.startsWith('commercial-north-cafe-menu-label-'))
  const fixture = (id: string, label: string, position: Point): MainlineSceneEntity => ({ id, label, kind: 'fixture', weight: 'fixture', surface: 'floor', position, roomId: room.id, interactive: true, visualVisibility: 'static' })
  retained.push(fixture('commercial-cafe-menu', '菜单', menuAnchor), fixture('commercial-cafe-blackboard', '黑板', { x: room.bounds.x + 5, y: room.bounds.y + 4 }))
  retained.forEach(entity => {
    if (entity.id === 'commercial-cafe-menu' || entity.id === 'commercial-cafe-blackboard') entity.readingProtection = 'preserve'
  })
  const npcs: MainlineSceneNpc[] = [
    { id: 'lao-zhou', roleId: 'lao-zhou', label: npcRoles.laoZhou.label, roomId: room.id, interactionTargetEntityId: cafeStoryTableId },
    { id: 'cafe-coffee-owner', roleId: 'cafe-coffee-owner', label: npcRoles.cafeCoffeeOwner.label, roomId: room.id, interactionTargetEntityId: 'commercial-cafe-counter', readingProtection: 'preserve' },
    { id: 'cafe-floor-server', roleId: 'cafe-floor-server', label: npcRoles.cafeFloorServer.label, roomId: room.id, readingProtection: 'preserve' },
  ]
  const behaviors: MainlineSceneNpcBehavior[] = [
    { npcId: 'lao-zhou', dutyId: 'lao-zhou.seated', targetId: 'commercial-cafe-right-window-upper-group-chair-top', targetKind: 'seat' },
    { npcId: 'cafe-coffee-owner', dutyId: 'cafe-coffee-owner.counter-service', targetId: 'commercial-cafe-counter-service', targetKind: 'point', interactionContactEntityId: 'commercial-cafe-counter' },
    { npcId: 'cafe-floor-server', dutyId: 'cafe-floor-server.table-service', targetId: 'commercial-cafe-floor-service-staging', targetKind: 'point' },
  ]
  return { ...blueprint, interactionText: { ...blueprint.interactionText, 'street-cafe-entry': '这扇门直接通向商业街。', 'commercial-cafe-menu': '美式 3\n拿铁 4\n澳白 4\n焦糖玛奇朵 5\n海盐焦糖拿铁 5', 'commercial-cafe-blackboard': '新品｜海盐焦糖拿铁 — 5' }, scene: {
    ...data, floorEntities: retained,
    walls: data.walls.map(wall => {
      const overlapsCafeRoom = wall.bounds.x < room.bounds.x + room.bounds.width && wall.bounds.x + wall.bounds.width > room.bounds.x
        && wall.bounds.y < room.bounds.y + room.bounds.height && wall.bounds.y + wall.bounds.height > room.bounds.y
      return overlapsCafeRoom ? { ...wall, readingProtection: 'preserve' as const } : wall
    }),
    continuousStructures: (data.continuousStructures ?? []).map(structure => structure.counterSurface?.roomId === room.id
      ? { ...structure, readingProtection: 'preserve' as const }
      : structure),
    furnitureGroups: data.furnitureGroups.map(group => ({ ...group, id: rename(group.id), entityIds: group.entityIds.map(rename) })),
    npcs: [...(data.npcs ?? []), ...npcs], npcBehaviors: [...(data.npcBehaviors ?? []), ...behaviors],
    accessRegions: [...(data.accessRegions ?? []), { id: 'commercial-cafe-staff-area', x: counter.x, y: counter.y + counter.height, width: counter.width, height: room.bounds.y + room.bounds.height - counter.y - counter.height, requiredAccess: 'staff', deniedText: '柜台里面是员工区，还是别过去了。' }],
    actorAccess: { ...data.actorAccess, protagonist: ['public'], 'lao-zhou': ['public'], 'cafe-coffee-owner': ['public', 'staff'], 'cafe-floor-server': ['public'] },
    npcBehaviorTargets: [...(data.npcBehaviorTargets ?? []),
      { id: 'commercial-cafe-counter-service', position: staff },
      ...[-1, 0, 1].map((offset, index) => ({ id: `commercial-cafe-counter-ambient-${index + 1}`, position: { x: staff.x + offset, y: staff.y } })),
      { id: 'commercial-cafe-prep-station', position: { x: staff.x + 1, y: staff.y } },
      { id: 'commercial-cafe-floor-service-staging', position: service },
    ],
  } }
}
