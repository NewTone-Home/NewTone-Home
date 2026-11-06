import { describe, it, expect } from 'vitest'
import { createLocationActivity } from './locationActivity'
import { createSessionActivityTracker } from './sessionActivityTracker'
import { mainlineSceneRoomAtPosition } from '../center/runtime/mainlineSceneModel'
import { mainlineScenes } from '../center/runtime/mainlineScenes'
describe('one automatic real-location ledger',()=>{
 it('separates street and cafe from actual geometry without door-click inference',()=>{
  const scene=mainlineScenes['commercial-street']
  const cafe=scene.rooms.find(room=>room.id==='commercial-north-cafe-interior')
  expect(cafe).toBeDefined()
  const point={x:cafe.bounds.x+cafe.bounds.width/2,y:cafe.bounds.y+cafe.bounds.height/2}
  expect(mainlineSceneRoomAtPosition(scene,point).id).toBe(cafe.id)
 })
 it('pauses background, separates active and idle, and closes visits once',()=>{
  const entered=[],left=[];let seq=0
  const clock=createSessionActivityTracker({startedAt:0,lastAt:0})
  const ledger=createLocationActivity({id:()=>`v${++seq}`,onEnter:l=>entered.push(l),onLeave:l=>left.push(l)})
  ledger.move('commercial-street','public-lane',clock.snapshot(0))
  ledger.move('commercial-street','public-lane',clock.snapshot(1000))
  clock.setVisible(false,10000);clock.setVisible(true,70000)
  ledger.move('commercial-street','cafe',clock.snapshot(80000))
  expect(left[0]).toMatchObject({sceneForegroundMs:20000,sceneEngagedMs:20000,roomId:'public-lane'})
  // Idle after 30 seconds since becoming visible; the remaining 20s is not active.
  expect(ledger.read(clock.snapshot(120000))).toMatchObject({sceneForegroundMs:40000,sceneEngagedMs:20000})
  ledger.end(clock.snapshot(120000));expect(ledger.end(clock.snapshot(120000))).toBe(false)
  expect(entered).toHaveLength(2);expect(left).toHaveLength(2)
 })
})
