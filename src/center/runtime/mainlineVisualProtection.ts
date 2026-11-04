import type { MainlineContinuousStructure, MainlineSceneEntity, MainlineSceneNpc } from './mainlineSceneModel'

type ProtectedGeometryUnit = {
  id: string
  ownerId: string
  x: number
  y: number
  width: number
  height: number
  sourceWallId?: string
  entityId?: string
  storefrontId?: string
  readingProtection?: 'preserve'
  visual: { cells: readonly { id: string; entityId?: string; storefrontId?: string }[] }
}

/** Resolve protected scene metadata to every semantic and physical identity a renderer may wrap. */
export function mainlineProtectedVisualIdentityIds(input: {
  entities: readonly MainlineSceneEntity[]
  npcs?: readonly MainlineSceneNpc[]
  structures?: readonly MainlineContinuousStructure[]
  geometry?: readonly ProtectedGeometryUnit[]
  rooms?: readonly { id: string; bounds: { x: number; y: number; width: number; height: number } }[]
  seedIds?: Iterable<string>
  roomId?: string | null
  includeAuthoredMetadata?: boolean
}) {
  const ids = new Set(input.seedIds ?? [])
  const entities = input.entities.filter(entity => !input.roomId || !entity.roomId || entity.roomId === input.roomId)
  const npcs = (input.npcs ?? []).filter(npc => !input.roomId || !npc.roomId || npc.roomId === input.roomId)
  const structures = (input.structures ?? []).filter(structure => !input.roomId || !structure.counterSurface?.roomId || structure.counterSurface.roomId === input.roomId)
  const roomBounds = input.roomId ? input.rooms?.find(room => room.id === input.roomId)?.bounds : undefined
  for (const unit of input.geometry ?? []) {
    if (unit.readingProtection !== 'preserve') continue
    if (roomBounds && !(unit.x < roomBounds.x + roomBounds.width && unit.x + unit.width > roomBounds.x && unit.y < roomBounds.y + roomBounds.height && unit.y + unit.height > roomBounds.y)) continue
    for (const id of [unit.id, unit.ownerId, unit.sourceWallId, unit.entityId, unit.storefrontId]) if (id) ids.add(id)
    for (const cell of unit.visual.cells) for (const id of [cell.id, cell.entityId, cell.storefrontId]) if (id) ids.add(id)
  }
  if (input.includeAuthoredMetadata !== false) {
    for (const entity of entities) if (entity.readingProtection === 'preserve') ids.add(entity.id)
    for (const npc of npcs) if (npc.readingProtection === 'preserve') ids.add(npc.id)
    for (const structure of structures) if (structure.readingProtection === 'preserve') ids.add(structure.id)
    for (const structure of structures) {
      const surface = structure.counterSurface
      if (!surface || surface.roomId !== input.roomId || structure.readingProtection !== 'preserve') continue
      ids.add(surface.groupId)
      ids.add(surface.interactionEntityId)
      ids.add(surface.labelEntityId)
      surface.services?.forEach(service => ids.add(service.id))
    }
  }
  let changed = true
  while (changed) {
    changed = false
    const add = (id: string | undefined) => {
      if (!id || ids.has(id)) return
      ids.add(id)
      changed = true
    }
    for (const entity of entities) {
      const related = [entity.id, entity.groupId, entity.interactionAliasId, entity.interactionStructureId, entity.counterSurfaceId]
      if (related.some(id => id && ids.has(id))) related.forEach(add)
    }
    for (const structure of structures) {
      const surface = structure.counterSurface
      const related = [structure.id, surface?.groupId, surface?.interactionEntityId, surface?.labelEntityId, ...(surface?.services ?? []).map(service => service.id)]
      if (related.some(id => id && ids.has(id))) related.forEach(add)
    }
  }
  return ids
}
