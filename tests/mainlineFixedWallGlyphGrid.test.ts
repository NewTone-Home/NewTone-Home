import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {mainlineScenes,mainlineCanonicalSceneGeometryUnits,validateMainlineSceneGeometry} from '../src/center/runtime/mainlineScenes'
const baseline=JSON.parse(readFileSync('tests/fixtures/mainline-wall-physical-contract-0906541.json','utf8'))
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const metrics={width:1920,height:1080}
describe('fixed wall glyph pitch with unchanged physical/story anchors',()=>{
 it.each(Object.values(mainlineScenes))('$id retains every physical unit, door, feature and story object',scene=>{
  const units=mainlineCanonicalSceneGeometryUnits(scene,metrics),saved=baseline[scene.id]
  expect(digest(units.map(({visual,...u})=>u))).toBe(saved.physical)
  expect(digest(units.flatMap(u=>u.visual.cells.filter(c=>c.kind!=='wall')))).toBe(saved.doorAndFeature)
  expect(digest(scene.passages)).toBe(saved.passages)
  expect(digest(scene.walkBounds)).toBe(saved.bounds)
  expect(digest(scene.objects)).toBe(saved.objects)
  expect(validateMainlineSceneGeometry(scene)).toEqual([])
 })
 it.each(Object.values(mainlineScenes))('$id uses 28 reference px between ordinary wall centers, without fitted remainder',scene=>{
  const units=mainlineCanonicalSceneGeometryUnits(scene,metrics)
  const groups=new Map<string,number[]>()
  for(const u of units){if(u.geometryKind!=='boundary'||!u.edge)continue;const axis=u.edge==='top'||u.edge==='bottom'?'x':'y',other=axis==='x'?'y':'x',dimension=axis==='x'?1920:1080
   for(const c of u.visual.cells){if(c.kind!=='wall'||!c.glyph)continue;const key=`${u.ownerId}:${axis}:${c[other].toFixed(6)}`;const values=groups.get(key)??[];values.push(c[axis]*dimension/100);groups.set(key,values)}
  }
  let checked=0
  for(const [key,values] of groups){const ordered=[...new Set(values)].sort((a,b)=>a-b);for(let i=1;i<ordered.length;i++){const gap=ordered[i]!-ordered[i-1]!;expect(Math.abs(gap-Math.round(gap/28)*28),`${key} gap=${gap}`).toBeLessThan(.04);checked++}}
  expect(checked).toBeGreaterThan(10)
 })
})
