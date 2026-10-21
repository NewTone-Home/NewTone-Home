import {describe,it,expect} from 'vitest'
import {createInitialPlayerSave,loadPlayerSave,sanitizePlayerSave,savePlayerSave,PLAYER_SAVE_STORAGE_KEY,PLAYER_SAVE_VERSION} from '../src/center/runtime/playerSave'
const storage=()=>{const data=new Map([['newtone-public-release-cutover-v1','center-v1']]);return{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)}}}
describe('one-time legacy street phone compatibility without restarting progress',()=>{
 it.each([undefined,1])('repairs old version %s while retaining every other save field',version=>{
  const source={...createInitialPlayerSave(),_version:version,currentSceneId:'commercial-street',phoneDevice:'surface',currentPosition:{x:135,y:-20},scenePositions:{'commercial-street':{x:135,y:-20},'jijia-ancestral-home':{x:25,y:50},'commercial-cafe':{x:58,y:68}},sceneState:{'commercial-street':{milkTeaHeld:true,orderStatus:'ready'},'commercial-cafe':{commercialCafeStoryStatus:'complete',narrativeCursor:7}},phoneContactNotes:{'lao-zhou':'kept'},updatedAt:1234}
  expect(sanitizePlayerSave(source,'commercial-cafe')).toEqual({...source,_version:PLAYER_SAVE_VERSION,phoneDevice:'inner'})
 })
 it('persists the repair and does not rewrite subsequent intentional surface-phone choices',()=>{
  const store=storage();store.setItem(PLAYER_SAVE_STORAGE_KEY,JSON.stringify({...createInitialPlayerSave(),_version:1,phoneDevice:'surface',currentPosition:{x:34,y:50}}))
  const repaired=loadPlayerSave(store);expect(repaired.phoneDevice).toBe('inner');savePlayerSave(repaired,store,100)
  expect(loadPlayerSave(store).phoneDevice).toBe('inner')
  savePlayerSave({...repaired,phoneDevice:'surface'},store,200)
  expect(loadPlayerSave(store)).toMatchObject({_version:2,phoneDevice:'surface',currentPosition:{x:34,y:50}})
 })
 it('preserves valid surface-world and office journeys regardless of their old phone',()=>{
  for(const currentSceneId of ['jijia-ancestral-home','zhongshuyuan-office']as const){const source={...createInitialPlayerSave(),_version:1,currentSceneId,phoneDevice:'surface',currentPosition:{x:25,y:50}};expect(sanitizePlayerSave(source,'commercial-street')).toEqual({...source,_version:2})}
 })
 it('also repairs the identifiable pre-unified street position format',()=>{
  const store=storage();store.setItem('newtone.mainline.carried-phone.v2',JSON.stringify('surface'));store.setItem('newtone.mainline.scene-positions.v2',JSON.stringify({'commercial-street':{x:135,y:-20},'jijia-ancestral-home':{x:25,y:50}}))
  expect(loadPlayerSave(store)).toMatchObject({_version:2,currentSceneId:'commercial-street',currentPosition:{x:135,y:-20},phoneDevice:'inner',scenePositions:{'jijia-ancestral-home':{x:25,y:50}}})
 })
})
