import type { CollisionBox, Point } from './sceneGeometry'

type Room = { id: string; bounds: CollisionBox }
export const currentCommercialDepthVersion = 1
export type CommercialDepthBackup = { currentPosition?: Point; rememberedPosition?: Point }

/** Old25-interval rooms become23-interval rooms. Keep rear-relative furniture
 * coordinates, clipping only the removed front/back strip to a safe42px inset.
 * Rooms are identified in the old layout before any move; the public lane and
 * unrelated scenes are never relocated. No progress/state is stored here. */
export function migrateCommercialDepthPoint(position: Point | null, rooms: readonly Room[]): Point | null {
  if (!position) return position
  const shift = 56 / 10.8
  const ordered = [...rooms.filter(room => room.id === 'cafe-single-restroom-interior'), ...rooms.filter(room => room.id.startsWith('commercial-') && room.id.endsWith('-interior'))]
  for (const room of ordered) {
    const north = room.id.includes('-north-') || room.id === 'cafe-single-restroom-interior'
    const oldY = room.bounds.y - (north ? shift : 0)
    const oldHeight = room.id === 'cafe-single-restroom-interior' ? room.bounds.height : 700 / 10.8
    if (position.x <= room.bounds.x || position.x >= room.bounds.x + room.bounds.width || position.y <= oldY || position.y >= oldY + oldHeight) continue
    const localY = position.y - oldY
    const inset = 42 / 10.8
    return { x: position.x, y: room.bounds.y + Math.max(inset, Math.min(room.bounds.height - inset, localY)) }
  }
  return position
}
