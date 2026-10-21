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
 it('preserves the pre-grid story, object identities, door permissions and room graph',()=>{
  const baseline=JSON.parse(readFileSync('tests/fixtures/pre-grid-semantic-027f31.json','utf8'))
  for(const id of ids)expect(JSON.parse(JSON.stringify(gridSemanticContract(mainlineScenes[id]))),id).toEqual(baseline[id])
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
 it('does not move the excluded legacy Cafe geometry in the grid batch',()=>{
  expect(sceneGridTransform('commercial-cafe')).toBeNull()
  expect(mainlineScenes['commercial-cafe'].structures[0]!.bounds).toEqual({x:8,y:7,width:80,height:86})
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
