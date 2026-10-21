import { mainlineScenes } from '../../src/center/runtime/mainlineScenes'
import { continuousCafeRoomId } from '../../src/center/runtime/continuousCafe'
import { sceneDesignReferenceMetrics } from '../../src/center/runtime/sceneBoundaryGrid'

// Tests of current Cafe behavior start inside the continuous room, not at
// the commercial world's new-game fruit-tea entrance or retired room coords.
export const currentCafe = mainlineScenes['commercial-street']
export const currentCafeRoom = currentCafe.rooms.find(room => room.id === continuousCafeRoomId)!
export const currentCafeFront = currentCafe.passages.find(p => p.toRoomId === continuousCafeRoomId && p.routeThrough)!
export const currentCafeStart = currentCafeFront.crossingTargets[0]
export const cafePoint = (x: number, y: number) => ({ x: currentCafeRoom.bounds.x + x / 1920 * 100, y: currentCafeRoom.bounds.y + y / 1080 * 100 })
export const currentCafeOptions = { screenMetrics: sceneDesignReferenceMetrics, actorId: 'protagonist', actorFootprint: { width: 11 / 19.2, height: 11 / 10.8 } }
