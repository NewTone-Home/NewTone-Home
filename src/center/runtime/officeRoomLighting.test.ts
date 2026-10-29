import { describe, expect, it } from 'vitest'
import { mainlineScenes } from './mainlineScenes'
import { officeBlindsRoomKey, officeRoomBlindsOpen, officeRoomShadeEdges, officeWindowRoom } from './officeRoomLighting'

describe('office room blinds and shared walls', () => {
  const scene = mainlineScenes['zhongshuyuan-office']
  const left = scene.rooms.find(room => room.id === 'zhongshuyuan-office-south-room-1')!
  const right = scene.rooms.find(room => room.id === 'zhongshuyuan-office-south-room-2')!
  it('finds the window room and retains legacy state', () => {
    expect(officeWindowRoom(scene)?.id).toBe(left.id)
    expect(officeRoomBlindsOpen({ blindsOpen: false }, left.id, left.id)).toBe(false)
    expect(officeRoomBlindsOpen({ blindsOpen: false }, right.id, left.id)).toBe(true)
    expect(officeRoomBlindsOpen({ blindsOpen: false, [officeBlindsRoomKey(left.id)]: true }, left.id, left.id)).toBe(true)
  })
  it('stores room choices independently and gives the shared wall to the occupied room', () => {
    const state = { [officeBlindsRoomKey(left.id)]: false, [officeBlindsRoomKey(right.id)]: true }
    expect(officeRoomBlindsOpen(state, left.id)).toBe(false)
    expect(officeRoomBlindsOpen(state, right.id)).toBe(true)
    expect(officeRoomShadeEdges(left, scene.rooms, left.id).right).toBe(8)
    expect(officeRoomShadeEdges(left, scene.rooms, right.id).right).toBe(-8)
    expect(officeRoomShadeEdges(right, scene.rooms, right.id).left).toBe(8)
    expect(officeRoomShadeEdges(right, scene.rooms, left.id).left).toBe(-8)
    expect(officeRoomShadeEdges(left, scene.rooms, left.id).left).toBe(8)
  })
})
