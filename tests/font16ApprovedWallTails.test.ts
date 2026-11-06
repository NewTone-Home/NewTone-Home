import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {mainlineScenes,mainlineCanonicalSceneGeometryUnits} from '../src/center/runtime/mainlineScenes'
const reference=JSON.parse(readFileSync('tests/fixtures/font16-approved-wall-tails.json','utf8')) as {approved:Record<string,number[]>;unchanged:Record<string,string>}
const groups:Record<string,number[]>={}
for(const scene of Object.values(mainlineScenes))for(const unit of mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}))for(const cell of unit.visual.cells){
 const run=cell.id.match(/^(.*-anchored-wall-\d+)-\d+$/)?.[1];if(!run)continue
 const axis=unit.edge==='top'||unit.edge==='bottom'?'x':'y'
 ;(groups[scene.id+'/'+run]??=[]).push(cell[axis]*(axis==='x'?19.2:10.8))
}
for(const[key,values]of Object.entries(groups))groups[key]=values.sort((a,b)=>a-b).map(n=>Number(n.toFixed(7)))
const legacyKey=(key:string)=>key.startsWith('commercial-cafe/')
describe('retired standalone Cafe wall-tail metadata is not a second live world',()=>{
 it('enumerates only active lattice worlds and never renders a retired anchored wall run',()=>{
  expect(Object.keys(mainlineScenes)).not.toContain('commercial-cafe')
  expect(mainlineScenes['commercial-cafe']).toBe(mainlineScenes['commercial-street'])
  expect(Object.keys(groups).filter(legacyKey)).toEqual([])
  for(const scene of Object.values(mainlineScenes))expect(scene.structures.some(s=>s.id==='commercial-cafe-room')).toBe(false)
 })
 it.each(Object.entries(reference.approved).filter(([key])=>legacyKey(key)))('%s is retained as historical evidence but absent from actual geometry',(key,before)=>{
  expect(before.length).toBeGreaterThan(3)
  expect(groups[key]).toBeUndefined()
  expect(mainlineCanonicalSceneGeometryUnits(mainlineScenes['commercial-cafe'],{width:1920,height:1080}).some(u=>u.ownerId==='commercial-cafe-room')).toBe(false)
 })
})
