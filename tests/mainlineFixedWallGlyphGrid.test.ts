import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {mainlineScenes,mainlineCanonicalSceneGeometryUnits,validateMainlineSceneGeometry} from '../src/center/runtime/mainlineScenes'
const baseline=JSON.parse(readFileSync('tests/fixtures/mainline-wall-physical-contract-0906541.json','utf8'))
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const metrics={width:1920,height:1080}
describe('fixed wall glyph pitch with unchanged physical/story anchors',()=>{
 // Physical immutability applied to the old visual-only tail patch. Active
 // spaces now intentionally migrate geometry; their semantic contract and
 // exact lattice are checked in sceneGridRollout.test.ts. Cafe is excluded.
 it('resolves the retired Cafe alias to the same physical world rather than retaining its old immutable room',()=>{
  const alias=mainlineScenes['commercial-cafe'],street=mainlineScenes['commercial-street']
  expect(alias).toBe(street)
  expect(mainlineCanonicalSceneGeometryUnits(alias,metrics)).toEqual(mainlineCanonicalSceneGeometryUnits(street,metrics))
  expect(alias.structures.some(s=>s.id==='commercial-cafe-room')).toBe(false)
  expect(validateMainlineSceneGeometry(alias)).toEqual([])
 })
 it.each(Object.values(mainlineScenes))('$id keeps 28 reference px except its approved local tail',scene=>{
  const units=mainlineCanonicalSceneGeometryUnits(scene,metrics)
  const groups=new Map<string,number[]>()
  for(const u of units){if(u.geometryKind!=='boundary'||!u.edge)continue;const axis=u.edge==='top'||u.edge==='bottom'?'x':'y',other=axis==='x'?'y':'x',dimension=axis==='x'?1920:1080
   for(const c of u.visual.cells){if(c.kind!=='wall'||!c.glyph)continue;const run=c.id.match(/^(.*-anchored-wall-\d+)-\d+$/)?.[1];const key=run??`${u.ownerId}:${axis}:${c[other].toFixed(6)}`;const values=groups.get(key)??[];values.push(c[axis]*dimension/100);groups.set(key,values)}
  }
  let checked=0
  for(const [key,values] of groups){const ordered=[...new Set(values)].sort((a,b)=>a-b);const short:{index:number;gap:number}[]=[];for(let i=1;i<ordered.length;i++){const gap=ordered[i]!-ordered[i-1]!;
   if(key.includes('-anchored-wall-')){
    expect(gap,`${key} gap=${gap}`).toBeLessThanOrEqual(28.04)
    expect(gap,`${key} glyphs must not squeeze below their 16px base size`).toBeGreaterThanOrEqual(15.99)
    if(gap<27.96)short.push({index:i,gap})
   }else expect(Math.abs(gap-Math.round(gap/28)*28),`${key} gap=${gap}`).toBeLessThan(.04)
   checked++}
   expect(short.length,`${key} must not distribute remainder through the run`).toBeLessThanOrEqual(3)
   if(short.length===1)expect(short[0]!.index===1||short[0]!.index===ordered.length-1,`${key} single cap stays at a tail`).toBe(true)
   if(short.length>=2){const n=short.length;expect(short.every((v,i)=>v.index===i+1)||short.every((v,i)=>v.index===ordered.length-n+i),`${key} only the final intervals may share`).toBe(true);expect(Math.max(...short.map(v=>v.gap))-Math.min(...short.map(v=>v.gap)),`${key} shares the remainder equally`).toBeLessThan(.04);expect(short.reduce((sum,v)=>sum+v.gap,0),`${key} only a necessary tail may expand`).toBeLessThan(n===2?44.04:60.04)}
  }
  expect(checked).toBeGreaterThan(10)
 })
})
