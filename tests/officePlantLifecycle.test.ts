import {describe,it,expect,vi} from 'vitest'
import {initializeOfficePlants,plantIsWatered,plantWaterDurationMs,resolveMainlineSceneExploration} from '../src/center/runtime/mainlineSceneInteractions'
import {mainlineScenes} from '../src/center/runtime/mainlineScenes'
const office=mainlineScenes['zhongshuyuan-office']
describe('shared office plant lifecycle',()=>{
 it('persists first health using only shared watering timestamps',()=>{
  const now=1000000;const patch=initializeOfficePlants(office,{},now,()=>.5)
  expect(Object.keys(patch)).toHaveLength(4)
  expect(Object.values(patch).filter(at=>plantIsWatered(at as number,now))).toHaveLength(2)
  expect(initializeOfficePlants(office,patch,now+1000)).toEqual({})
  expect(plantWaterDurationMs).toBe(240000)
  for(const at of Object.values(patch))expect(plantIsWatered(at as number,now+plantWaterDurationMs)).toBe(false)
 })
 it('healthy plants have no Action, thirsty plants have watering Action',()=>{
  const entity=office.objects.find(e=>e.id.startsWith('zhongshuyuan-office-port-plant-'))!
  const base={incensePhase:'unlit' as const,officeBlindsOpen:true,carriedPhoneDevice:'surface' as const}
  expect(resolveMainlineSceneExploration(office,entity,{...base,plantWatered:true,plantHealthyText:'叶子翠绿翠绿的，看起来很有活力'}).choice?.options).toBeUndefined()
  expect(resolveMainlineSceneExploration(office,entity,{...base,plantWatered:false}).choice?.options).toEqual(['浇水'])
 })
})
