import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { isMainlineSeatAvailable, mainlineSceneOccupiedSeatIds, nextMainlinePlayerSeatId } from '../src/center/runtime/mainlineSeating'
const scene=mainlineScenes['commercial-street'],seat='commercial-cafe-right-window-upper-group-chair-top'
describe('same runtime occupancy for seat drawing and selection',()=>{
 it('protects the staged NPC seat before release and accepts it after release',()=>{
  const occupied=mainlineSceneOccupiedSeatIds(scene)
  expect(nextMainlinePlayerSeatId(scene,null,seat,occupied)).toBeNull()
  const released=mainlineSceneOccupiedSeatIds(scene,null,new Set(['lao-zhou']))
  expect(released.has(seat)).toBe(false)
  expect(isMainlineSeatAvailable(scene,seat,null,released)).toBe(true)
  expect(nextMainlinePlayerSeatId(scene,null,seat,released)).toBe(seat)
 })
 it('still rejects another live occupant, invalid objects and clears a player seat on standing',()=>{
  const occupied=new Set([seat])
  expect(nextMainlinePlayerSeatId(scene,null,seat,occupied)).toBeNull()
  expect(nextMainlinePlayerSeatId(scene,null,'commercial-cafe-counter',new Set())).toBeNull()
  expect(nextMainlinePlayerSeatId(scene,seat,null,occupied)).toBeNull()
 })
})
