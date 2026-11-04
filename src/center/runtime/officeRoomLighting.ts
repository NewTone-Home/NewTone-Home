import type { MainlineSceneDefinition } from './mainlineScenes'
import type { MainlineSceneRoom } from './mainlineSceneModel'
import type { PlayerSceneState } from './playerSave'

export const officeWindowId = 'zhongshuyuan-office-window'
export const officeBlindsRoomKey = (roomId: string) => `blindsOpen:${roomId}`

/** Resolve a wall-mounted window to its room, including a window on the room edge. */
export function officeWindowRoom(scene: MainlineSceneDefinition, windowId = officeWindowId) {
  if (scene.id !== 'zhongshuyuan-office') return undefined
  const window = scene.objects.find(entity => entity.id === windowId)
  if (!window) return undefined
  return scene.rooms.find(room => room.kind === 'room' && window.position.x >= room.bounds.x - .001
    && window.position.x <= room.bounds.x + room.bounds.width + .001 && window.position.y >= room.bounds.y - .001
    && window.position.y <= room.bounds.y + room.bounds.height + .001)
}
export function officeRoomBlindsOpen(state: PlayerSceneState, roomId: string, legacyRoomId?: string) {
  const roomValue = state[officeBlindsRoomKey(roomId)]
  return typeof roomValue === 'boolean' ? roomValue : roomId === legacyRoomId ? state.blindsOpen !== false : true
}

/** Shared office walls belong visually to the room the player occupies. */
export function officeRoomShadeEdges(room: MainlineSceneRoom, rooms: readonly MainlineSceneRoom[], currentRoomId?: string | null) {
  const b = room.bounds, epsilon = .001
  const overlapping = (a: number, z: number, c: number, d: number) => Math.min(z, d) - Math.max(a, c) > epsilon
  const shared = { left: false, right: false, top: false, bottom: false }
  for (const other of rooms) {
    if (other.id === room.id || other.kind !== 'room') continue
    const o = other.bounds
    if (overlapping(b.y, b.y + b.height, o.y, o.y + o.height)) {
      if (Math.abs(b.x - (o.x + o.width)) < epsilon) shared.left = true
      if (Math.abs(b.x + b.width - o.x) < epsilon) shared.right = true
    }
    if (overlapping(b.x, b.x + b.width, o.x, o.x + o.width)) {
      if (Math.abs(b.y - (o.y + o.height)) < epsilon) shared.top = true
      if (Math.abs(b.y + b.height - o.y) < epsilon) shared.bottom = true
    }
  }
  const margin = (isShared: boolean) => isShared && currentRoomId !== room.id ? -8 : 8
  return { left: margin(shared.left), right: margin(shared.right), top: margin(shared.top), bottom: margin(shared.bottom) }
}
