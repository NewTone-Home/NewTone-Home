import { describe, it, expect } from 'vitest'
import { commercialCafeFloorServiceTarget } from '../src/center/runtime/commercialCafeBehavior'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityPosition, mainlineEntityCollision } from '../src/center/runtime/sceneLayout'
import { mainlineRideAtPickup, mainlineRidePickupPositions, mainlineRideWaitingGuidance, mainlineRideWalkingEtaMs } from '../src/center/runtime/mainlineRide'
import { resolveCommercialCafeFloorServiceIntent, commercialCafeStoryTableId } from '../src/center/runtime/commercialCafeStory'
import { enqueuePhoneNotification, presentPhoneNotifications, readPhoneNotifications } from '../src/center/runtime/phoneNotifications'
import { createInitialPlayerSave, sanitizePlayerSave } from '../src/center/runtime/playerSave'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { findMainlinePath, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'

describe('follow-up experience contracts', () => {
  it.each([{width:1280,height:720}, {width:1440,height:900}])('projects equal altar edge spacing from actual glyph bodies %j', metrics => {
    const scene=mainlineScenes['jijia-ancestral-interior']
    const boxes=['north','east','south','west'].map(side => mainlineEntityCollision(scene,scene.objects.find(o=>o.id==='jijia-offering-table-'+side)!,{},metrics)!)
    const burner=mainlineEntityCollision(scene,scene.objects.find(o=>o.id==='jijia-incense-burner')!,{},metrics)!
    const gaps=[(burner.y-boxes[0].y-boxes[0].height)*metrics.height/100,(boxes[1].x-burner.x-burner.width)*metrics.width/100,(boxes[2].y-burner.y-burner.height)*metrics.height/100,(burner.x-boxes[3].x-boxes[3].width)*metrics.width/100]
    expect(Math.max(...gaps)-Math.min(...gaps)).toBeLessThan(.02)
    expect(mainlineEntityPosition(scene,scene.objects.find(o=>o.id==='jijia-offering-table-north')!,{},metrics).y).toBe(47.2)
    expect(createMainlineSceneGeometrySnapshot(scene,scene.initialPlayerPosition,{},metrics).navigationBarriers).toHaveLength(4)
  })
  it('uses authored service sides for every ordinary table with legal shared routes', () => {
    const scene=mainlineScenes['commercial-cafe'], metrics={width:1280,height:720}
    let start=scene.initialPlayerPosition
    const tables=scene.objects.filter(o=>o.kind==='table' && o.id!==commercialCafeStoryTableId)
    for(let index=0;index<tables.length;index++){
      const intent=resolveCommercialCafeFloorServiceIntent(scene,index)!
      expect(intent.target).toEqual(tables[index].approach)
      expect(intent.targetEntityId).toBeUndefined()
      const options={screenMetrics:metrics,actorId:'cafe-floor-server'}
      const target=commercialCafeFloorServiceTarget(scene,start,intent,{},options)!
      expect(target).not.toBeNull()
      expect(isWalkableMainlinePoint(target,scene,{},options)).toBe(true)
      expect(findMainlinePath(start,target,scene,{},options)).not.toBeNull()
      if(tables[index].id.startsWith('commercial-cafe-right-')) expect(target.x).toBeLessThan(tables[index].position.x)
      start=target
    }
  })
  it('boards at both Office exits and not at the old room spawn', () => {
    const order={sourceSceneId:'zhongshuyuan-office' as const,targetSceneId:'commercial-street' as const,driverArrivesAt:1000}
    const exits=mainlineRidePickupPositions(order.sourceSceneId)
    expect(exits).toHaveLength(2)
    for(const exit of exits) expect(mainlineRideAtPickup(order,order.sourceSceneId,exit)).toBe(true)
    expect(mainlineRideAtPickup(order,order.sourceSceneId,mainlineScenes[order.sourceSceneId].initialPlayerPosition)).toBe(false)
    for(const sceneId of ['commercial-street','yonghe-mining-perimeter'] as const) expect(mainlineRidePickupPositions(sceneId)[0][sceneId==='commercial-street'?'x':'y']).toBe(mainlineScenes[sceneId].externalExits[0].threshold)
    expect(mainlineRideWalkingEtaMs('commercial-cafe',mainlineScenes['commercial-cafe'].initialPlayerPosition,{layout:{},screenMetrics:{width:1280,height:720}})).toBeGreaterThan(0)
    expect(mainlineRideWaitingGuidance('commercial-cafe').guidanceText).toBe('请回到商业街口等车')
    expect(mainlineRideWaitingGuidance('yonghe-mining-perimeter').guidanceText).toBe('请到矿区入口等车')
    expect(mainlineRideWaitingGuidance('zhongshuyuan-office').guidanceText).toBe('请到办公室出口等车')
    expect(mainlineRideWaitingGuidance('jijia-ancestral-home').guidanceText).toBe('请到院门等车')
  })
  it('persists pending presentation, unread badges and deduplication for both apps', () => {
    let save=createInitialPlayerSave('commercial-street')
    for(const app of ['ride','milk-tea'] as const) save.phoneNotifications=enqueuePhoneNotification(save.phoneNotifications,{id:app+':1',app,title:'完成',body:'等候'})
    save=sanitizePlayerSave(JSON.parse(JSON.stringify(save)),'commercial-street')
    expect(save.phoneNotifications.every(n=>n.unread&&!n.presented)).toBe(true)
    save.phoneNotifications=presentPhoneNotifications(save.phoneNotifications)
    expect(save.phoneNotifications.every(n=>n.unread&&n.presented)).toBe(true)
    save.phoneNotifications=readPhoneNotifications(save.phoneNotifications,'ride')
    save=sanitizePlayerSave(JSON.parse(JSON.stringify(save)),'commercial-street')
    expect(save.phoneNotifications.find(n=>n.app==='ride')?.unread).toBe(false)
    expect(save.phoneNotifications.find(n=>n.app==='milk-tea')?.unread).toBe(true)
    expect(enqueuePhoneNotification(save.phoneNotifications,{id:'ride:1',app:'ride',title:'完成',body:'等候'})).toBe(save.phoneNotifications)
    const renewed=enqueuePhoneNotification(save.phoneNotifications,{id:'ride:2',app:'ride',title:'到达',body:'等候'})
    expect(renewed).toHaveLength(2)
    expect(renewed.find(n=>n.app==='ride')).toMatchObject({id:'ride:2',unread:true,presented:false})
  })
})
