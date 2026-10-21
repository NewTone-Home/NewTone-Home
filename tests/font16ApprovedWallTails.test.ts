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
describe('font16 changes only the eight individually approved wall tails',()=>{
 it('keeps every unapproved run pixel-for-pixel unchanged',()=>{
  expect(Object.keys(groups).sort()).toEqual([...Object.keys(reference.approved),...Object.keys(reference.unchanged)].sort())
  for(const[key,hash]of Object.entries(reference.unchanged))expect(createHash('sha256').update(JSON.stringify(groups[key])).digest('hex'),key).toBe(hash)
 })
 it.each(Object.entries(reference.approved))('%s retains endpoints and count, moves only two tail interiors', (key,before)=>{
  const now=groups[key]!,last=now.length-1;expect(now.length).toBe(before.length);expect(now[0]).toBe(before[0]);expect(now[last]).toBe(before[last])
  const changed=now.flatMap((v,i)=>Math.abs(v-before[i]!)>.000001?[i]:[])
  expect(changed.length).toBe(2)
  expect(JSON.stringify(changed)===JSON.stringify([1,2])||JSON.stringify(changed)===JSON.stringify([last-2,last-1])).toBe(true)
  const first=changed[0]===1?0:last-3,steps=Array.from({length:3},(_,i)=>now[first+i+1]!-now[first+i]!)
  expect(Math.min(...steps)).toBeGreaterThanOrEqual(16);expect(Math.max(...steps)-Math.min(...steps)).toBeLessThan(.000001)
  expect(steps.reduce((a,b)=>a+b,0)).toBeLessThan(60)
 })
})
