import {describe,it,expect} from 'vitest'
import {readFileSync,writeFileSync} from 'node:fs'
import {mainlineScenes,mainlineCanonicalSceneGeometryUnits} from '../src/center/runtime/mainlineScenes'
import {wallVisualCoverage,wallCornerCoverage} from './helpers/wallVisualCoverage'
const baseline=JSON.parse(readFileSync('tests/fixtures/wall-visual-coverage-0906541.json','utf8'))
const measured=Object.fromEntries(Object.values(mainlineScenes).map(scene=>{const units=mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080});return[scene.id,{edges:wallVisualCoverage(scene,units),corners:wallCornerCoverage(scene,units)}]}))
writeFileSync('.tmp/wall-current-visual-coverage.json',JSON.stringify(measured,null,2))
// This intentionally fails against rejected11c06 until the anchored layout is
// fixed. Do not relax the bounds or filter out large/small distances.
describe('all door neighbors, complete edge gaps and corner coverage',()=>{
 it.each(Object.values(mainlineScenes))('$id retains complete door-adjacent and endpoint coverage',scene=>{
  const units=mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}),actual=wallVisualCoverage(scene,units)
  for(const before of baseline[scene.id].edges){const now=actual.find(e=>e.key===before.key);expect.soft(now, before.key).toBeDefined();if(!now)continue
   expect.soft(now!.maxGap,`${before.key} maximum gap`).toBeLessThanOrEqual(before.maxGap+1)
   if(before.startDistance!==null)expect.soft(now!.startDistance,`${before.key} start cap`).toBeLessThanOrEqual(before.startDistance+1)
   if(before.endDistance!==null)expect.soft(now!.endDistance,`${before.key} end cap`).toBeLessThanOrEqual(before.endDistance+1)
   for(const [id,sides]of Object.entries(before.doorNeighbors) as [string,{before:number|null;after:number|null}][]){for(const side of ['before','after']as const){if(sides[side]===null)continue;const measured=now!.doorNeighbors[id]?.[side];expect.soft(measured,`${id} ${side} wall must exist`).not.toBeNull();expect.soft(measured,`${id} ${side} wall distance`).toBeLessThanOrEqual(sides[side]!+1);expect.soft(measured,`${id} ${side} wall overlap`).toBeGreaterThanOrEqual(Math.max(0,sides[side]!-1))}}
  }
 })
 it.each(Object.values(mainlineScenes))('$id retains every physical corner visual cap',scene=>{
  const units=mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}),actual=wallCornerCoverage(scene,units)
  for(const before of baseline[scene.id].corners){const now=actual.find(e=>e.key===before.key);expect.soft(now,before.key).toBeDefined();if(!now)continue;before.distances.forEach((distance:number,index:number)=>expect.soft(now!.distances[index],`${before.key} corner${index}`).toBeLessThanOrEqual(distance+1))}
 })
})
