import type { MainlineSceneBlueprint, MainlineSceneEntity, MainlineStorefrontSlotBlueprint } from './mainlineSceneModel'

export const cafeRestroomRoomId = 'cafe-single-restroom-interior'
export const cafeRestroomDoorId = 'cafe-trial-customer-toilet-door'
export const cafeRestroomToiletId = 'cafe-restroom-toilet'
export const cafeRestroomFaucetId = 'cafe-restroom-sink'
export const cafeRestroomFaucetLabel = '洗手台'
export const cafeRestroomFixtureIds = [cafeRestroomToiletId, cafeRestroomFaucetId] as const
/** Each duration is measured on the shared game clock. */
export const cafeRestroomFixtureUseGameDurationMs = {
  // 1.5 s of real play at the normal-play rate (30x) = 45 game seconds.
  [cafeRestroomToiletId]: 45_000,
  // The sink is a switch: it stays on until pressed again or the restroom is left.
  [cafeRestroomFaucetId]: Number.POSITIVE_INFINITY,
} as const

export function cafeRestroomFixtureUseDurationMs(entityId: string): number | undefined {
  return entityId in cafeRestroomFixtureUseGameDurationMs
    ? cafeRestroomFixtureUseGameDurationMs[entityId as keyof typeof cafeRestroomFixtureUseGameDurationMs]
    : undefined
}

export function isPointInsideCafeRestroom(point: { x: number; y: number }, bounds: { x: number; y: number; width: number; height: number }) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y && point.y <= bounds.y + bounds.height
}

/** A real attached room in the existing continuous world, not a new save scene. */
export function attachCafeRestroom(blueprint: MainlineSceneBlueprint): MainlineSceneBlueprint {
  const cafe = blueprint.scene.rooms!.find(room => room.id === 'commercial-north-cafe-interior')!
  const point = (x: number, y: number) => ({ x: cafe.bounds.x + x / 19.2, y: cafe.bounds.y + y / 10.8 })
  const bounds = { ...point(476, -168), width: 168 / 19.2, height: 168 / 10.8 }
  const original = blueprint.portals.find(portal => portal.id === cafeRestroomDoorId)!
  const wallId = original.wallOpenings![0].wallId
  const center = point(560, 0)
  const slot: MainlineStorefrontSlotBlueprint = {
    id: 'cafe-restroom-sign', wallId, edge: 'top', label: '卫生间', style: 'modern', mode: 'commercial', characterSwitch: true, portalId: cafeRestroomDoorId,
    start: center.x - 1.4995 * 28 / 19.2, end: center.x + 1.4995 * 28 / 19.2,
    composition: { fixedCellCount: 3, baseline: ['sign', 'sign', 'sign'], near: ['wall', 'door', 'wall'] },
    approach: point(560, 42), nearRadius: 4,
  }
  const fixture = (id: string, label: string, x: number, y: number): MainlineSceneEntity => ({
    id, label, roomId: cafeRestroomRoomId, kind: 'fixture', weight: 'fixture', surface: 'floor', position: point(x,y), interactive: true, visualVisibility: 'static', focusFrame: 'interactive',
    interactionBehavior: 'cafe-restroom-use',
    // The toilet faces the open entrance (south); the sink is mounted on the
    // east wall and faces into the room (west). Navigation must approach only
    // those physical front faces, regardless of the player's starting side.
    interactionContactSides: id === cafeRestroomToiletId ? ['bottom'] : ['left'],
    ...(id === 'cafe-restroom-sink' ? { textLayout: 'vertical' as const } : {}),
    collision: id === 'cafe-restroom-sink'
      ? { ...point(x - 8, y - Array.from(label).length * 8), width: 16 / 19.2, height: Array.from(label).length * 16 / 10.8 }
      : { ...point(x - Array.from(label).length * 8, y - 8), width: Array.from(label).length * 16 / 19.2, height: 16 / 10.8 },
  })
  return { ...blueprint,
    portals: blueprint.portals.map(portal => portal.id !== cafeRestroomDoorId ? portal : {
      ...portal, entity: { ...portal.entity, label: '卫生间', displayLabel: '门' },
      endpoint: { doorPosition: center, threshold: point(560, 42), crossingTarget: point(560, -42) },
      fromRoomId: cafe.id, toRoomId: cafeRestroomRoomId, routeThrough: true, access: 'open', lockedText: undefined, transitionText: '进入卫生间。',
    }),
    scene: { ...blueprint.scene,
      rooms: [...blueprint.scene.rooms!, { id: cafeRestroomRoomId, bounds }],
      walls: [...blueprint.scene.walls, { id: 'cafe-single-restroom-shell', type: 'room', bounds, variant: 'commercial-empty-shell', boundaryGeometrySource: 'cell-range', boundaryCoordinateCount: { horizontal: 7, vertical: 7 }, edges: ['left', 'top', 'right'] }],
      storefronts: [...(blueprint.scene.storefronts ?? []), slot],
      floorEntities: [...blueprint.scene.floorEntities, fixture(cafeRestroomToiletId, '马桶', 532, -126), fixture(cafeRestroomFaucetId, cafeRestroomFaucetLabel, 608, -70)],
    },
    explorationText: { ...blueprint.explorationText, [cafeRestroomToiletId]: ['单人卫生间里的马桶。'], [cafeRestroomFaucetId]: ['卫生间里的洗手台。'] },
    interactionText: { ...blueprint.interactionText, [cafeRestroomDoorId]: '卫生间通往咖啡馆。' },
  }
}
