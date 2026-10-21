import {describe,it,expect} from 'vitest'
import {mainlineScenes,validateMainlineSceneGeometry} from '../src/center/runtime/mainlineScenes'
import {mainlineSceneBlueprints,type MainlineSceneId} from '../src/center/runtime/mainlineSceneModel'
import {migratePreGridPosition,sceneGridTransform} from '../src/center/runtime/sceneGridRollout'
import {officeGrid} from '../src/center/runtime/officeGrid'
import {sanitizePlayerSave} from '../src/center/runtime/playerSave'
import {resolveMainlineSafeSpawnPosition,isWalkableMainlinePoint,findMainlineRoomPassageSequence} from '../src/center/runtime/mainlineNavigation'
import {sceneDesignReferenceMetrics} from '../src/center/runtime/sceneBoundaryGrid'
import {readFileSync} from 'node:fs'
import {gridSemanticContract} from './helpers/gridSemanticContract'

const ids=Object.keys(mainlineScenes).filter(id=>id!=='commercial-cafe') as MainlineSceneId[]
describe('one world lattice per active continuous space',()=>{
 it('preserves pre-grid semantics outside the explicitly authorized Cafe, tea and Yonghe layout trials',()=>{
 const baseline=JSON.parse(readFileSync('tests/fixtures/pre-grid-semantic-027f31.json','utf8'))
 const trialRooms=new Set(['commercial-north-cafe-interior','commercial-north-n1-interior','commercial-south-s5-interior','mining-shop-2-interior'])
 for(const id of ids){
  const before=baseline[id],now=JSON.parse(JSON.stringify(gridSemanticContract(mainlineScenes[id])))
  const changedIds=new Set([...before.objects,...now.objects].filter(o=>trialRooms.has(o.roomId)||o.id.startsWith('yonghe-outdoor-')).map(o=>o.id))
  for(const key of ['cafe-trial-customer-toilet-door','street-cafe-entry','yonghe-menu','yonghe-back-door','yonghe-survey-central-lane'])changedIds.add(key)
  const originalNpcIds=new Set(before.npcs.map(n=>n.id))
  const omitTrial=(contract)=>({...contract,
   objects:contract.objects.filter(o=>!changedIds.has(o.id)),
   portals:contract.portals.filter(p=>p.id!=='cafe-trial-customer-toilet-door').map(p=>p.id==='yonghe-street-entry'?{...p,transitionText:undefined}:p.id==='yonghe-back-door'?{...p,lockedText:undefined}:p),
   npcs:contract.npcs.filter(n=>originalNpcIds.has(n.id)),
   npcBehaviors:contract.npcBehaviors.filter(n=>originalNpcIds.has(n.npcId)),
   interactionText:Object.fromEntries(Object.entries(contract.interactionText??{}).filter(([id])=>!changedIds.has(id))),
   explorationText:Object.fromEntries(Object.entries(contract.explorationText??{}).filter(([id])=>!changedIds.has(id))),
  })
  expect(omitTrial(now),id).toEqual(omitTrial(before))
 }
})
 for(const id of ids)it(`${id}: walls and corners use its single 28px lattice`,()=>{
  const s=mainlineScenes[id],g=sceneGridTransform(id)?.grid??officeGrid
  expect(validateMainlineSceneGeometry(s)).toEqual([])
  for(const w of s.structures){
   if(!w.wallEdges?.length)continue
   expect(w.boundaryWorldGrid).toEqual({origin:g.origin,pitchPx:28})
   if(!w.bounds)continue
   for(const p of [w.bounds,{x:w.bounds.x+w.bounds.width,y:w.bounds.y+w.bounds.height}]){
    expect((p.x-g.origin.x)/g.step.x).toBeCloseTo(Math.round((p.x-g.origin.x)/g.step.x),8)
    expect((p.y-g.origin.y)/g.step.y).toBeCloseTo(Math.round((p.y-g.origin.y)/g.step.y),8)
   }
  }
 })
 it('resolves every cross-scene entry from the destination side of the same door',()=>{
  for(const id of ids)for(const p of mainlineSceneBlueprints[id].portals){
   if(!p.targetSceneId||!p.endpoint.entryPosition)continue
   const reverse=mainlineSceneBlueprints[p.targetSceneId].portals.find(q=>q.id===p.id&&q.targetSceneId===id)
   if(reverse)expect(p.endpoint.entryPosition).toEqual(reverse.endpoint.threshold)
  }
 })
 it('keeps all 14 fronts open, all 14 rear doors locked and no new door IDs',()=>{
  const s=mainlineScenes['commercial-street']
  expect(s.passages.filter(p=>p.routeThrough)).toHaveLength(14)
  expect(s.passages.filter(p=>p.id.endsWith('-rear-door'))).toHaveLength(14)
  expect(s.passages.filter(p=>p.routeThrough).every(p=>p.access==='open')).toBe(true)
  expect(s.passages.filter(p=>p.id.endsWith('-rear-door')).every(p=>p.access==='locked')).toBe(true)
 })
 it('keeps only the continuous Cafe lattice when the old scene alias is requested',()=>{
 expect(sceneGridTransform('commercial-cafe')).toBeNull()
 expect(mainlineScenes['commercial-cafe']).toBe(mainlineScenes['commercial-street'])
 expect(mainlineScenes['commercial-cafe'].structures.some(w=>w.id==='commercial-cafe-room')).toBe(false)
 expect(Object.keys(mainlineScenes)).not.toContain('commercial-cafe')
})
 it('migrates old office positions within the same room once and preserves progression',()=>{
  const old={_version:2,currentSceneId:'zhongshuyuan-office',currentPosition:{x:17,y:20},scenePositions:{'zhongshuyuan-office':{x:17,y:20}},phoneDevice:'inner',sceneState:{'zhongshuyuan-office':{fixtureExplored:true}},phoneContactNotes:{a:'retained'}}
  const migrated=sanitizePlayerSave(old,'commercial-street')
  expect(migrated.currentPosition).toEqual(migratePreGridPosition('zhongshuyuan-office',old.currentPosition))
  expect(migrated.sceneState).toEqual(old.sceneState)
  expect(migrated.phoneContactNotes).toEqual(old.phoneContactNotes)
  expect(sanitizePlayerSave(migrated,'commercial-street')).toEqual(migrated)
 })
 it('keeps a restored locked-room occupant there, without requiring a route through a locked door',()=>{
  const s=mainlineScenes['zhongshuyuan-office'],room=s.rooms.find(r=>r.id.includes('north'))!
  const p={x:room.bounds.x+room.bounds.width/2,y:room.bounds.y+room.bounds.height/2}
  const options={screenMetrics:sceneDesignReferenceMetrics}
  expect(isWalkableMainlinePoint(p,s,{},options)).toBe(true)
  expect(findMainlineRoomPassageSequence(s,s.initialPlayerPosition,p,{},options)?.passages.some(p=>p.access==='locked')).toBe(true)
  expect(resolveMainlineSafeSpawnPosition(s,p,{},options)).toEqual(p)
 })
})
