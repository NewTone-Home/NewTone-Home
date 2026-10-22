import {describe,it,expect} from 'vitest'
import {readFileSync,writeFileSync} from 'node:fs'
import {mainlineScenes,mainlineCanonicalSceneGeometryUnits} from '../src/center/runtime/mainlineScenes'
import {wallVisualCoverage,wallCornerCoverage} from './helpers/wallVisualCoverage'
const baseline=JSON.parse(readFileSync('tests/fixtures/wall-visual-coverage-0906541.json','utf8'))
const measured=Object.fromEntries(Object.values(mainlineScenes).map(scene=>{const units=mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080});return[scene.id,{edges:wallVisualCoverage(scene,units),corners:wallCornerCoverage(scene,units)}]}))
writeFileSync('.tmp/wall-current-visual-coverage.json',JSON.stringify(measured,null,2))
const miningExpectedEdges=[
 'mining-street-facade:bottom',
 ...Array.from({length:8},(_,i)=>[`mining-shop-${i+1}-interior-shell:top`,`mining-shop-${i+1}-interior-shell:right`]).flat(),
 'mining-shop-8-interior-shell:left','mining-industrial-edge:top',
]
const miningExpectedCoverageKeys=[...miningExpectedEdges,...Array.from({length:8},(_,i)=>`yonghe-slot-${i+1}:bottom`)]
// Keep the original full-coverage bounds after fixing rejected11c06. The
// approved short tail is tested separately; no distance-band filtering here.
describe('all door neighbors, complete edge gaps and corner coverage',()=>{
 it.each(Object.values(mainlineScenes))('$id retains complete door-adjacent and endpoint coverage',scene=>{
  const units=mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}),actual=wallVisualCoverage(scene,units)
  if(scene.id==='yonghe-mining-perimeter'||scene.id==='yonghe-eatery'){
   // This literal set is the authored perimeter: facade, eight shop shells,
   // and the industrial edge. Completeness is never inferred from actual data.
   expect(actual.map(edge=>edge.key).sort()).toEqual([...miningExpectedCoverageKeys].sort())
   const boundaryEdges=actual.filter(edge=>miningExpectedEdges.includes(edge.key))
   expect(boundaryEdges.map(edge=>edge.key).sort()).toEqual([...miningExpectedEdges].sort())
   for(const key of miningExpectedEdges){
    const edge=boundaryEdges.find(candidate=>candidate.key===key)!
    // The Yonghe menu's one blank panel cell lies on its right wall. This
    // exact 56px interval is allowed only there; every other boundary stays 28.
    const allowedMaxGap=key==='mining-shop-2-interior-shell:right'?56.01:28.01
    expect(edge.maxGap,`${key} maximum visual interval`).toBeLessThanOrEqual(allowedMaxGap)
    expect(edge.startDistance,`${key} first endpoint cap`).toBeLessThanOrEqual(28.01)
    expect(edge.endDistance,`${key} last endpoint cap`).toBeLessThanOrEqual(28.01)
   }
   const yongheRight=units.filter(unit=>unit.ownerId==='mining-shop-2-interior-shell'&&unit.edge==='right'&&unit.geometryKind==='boundary')
   expect(yongheRight.flatMap(unit=>unit.visual.cells).some(cell=>cell.entityId==='yonghe-menu'&&cell.glyph),'Yonghe wall menu remains mounted on its right wall').toBe(true)
   expect(yongheRight.flatMap(unit=>unit.visual.cells).some(cell=>cell.kind==='feature'&&!cell.glyph&&Math.abs(cell.y-34.8148148148)<.01),'the known menu panel cell accounts for the sole 56px visual interval').toBe(true)
   for(const storefront of scene.storefronts){
    const nearCells=units.filter(unit=>unit.storefrontId===storefront.id&&unit.variant==='near').flatMap(unit=>unit.visual.cells)
    const doors=nearCells.filter(cell=>cell.storefrontRole==='door')
    expect(doors,`${storefront.id} revealed facade has one door`).toHaveLength(1)
    const door=doors[0]!
    const doorIndex=storefront.composition!.near.findIndex(role=>role==='door')
    expect(storefront.composition!.near[doorIndex-1],`${storefront.id} before-door role`).toBe('wall')
    expect(storefront.composition!.near[doorIndex+1],`${storefront.id} after-door role`).toBe('wall')
    const wallXs=nearCells.filter(cell=>cell.storefrontRole==='wall').map(cell=>cell.x)
    expect(wallXs.some(x=>Math.abs(x-(door.x-28/19.2))<.001)).toBe(true)
    expect(wallXs.some(x=>Math.abs(x-(door.x+28/19.2))<.001)).toBe(true)
   }
   const backDoorEdge=actual.find(edge=>edge.key==='mining-shop-2-interior-shell:top')!
   expect(backDoorEdge.doorNeighbors['yonghe-back-door']?.before).toBeCloseTo(28,3)
   expect(backDoorEdge.doorNeighbors['yonghe-back-door']?.after).toBeCloseTo(28,3)
   return
  }
  for(const before of baseline[scene.id].edges){const now=actual.find(e=>e.key===before.key);expect.soft(now, before.key).toBeDefined();if(!now)continue
   const maximum=scene.id==='commercial-cafe'?before.maxGap+1:Math.ceil((before.maxGap-.04)/28)*28+.04
   expect.soft(now!.maxGap,`${before.key} maximum gap, including split labels`).toBeLessThanOrEqual(maximum)
   if(before.startDistance!==null)expect.soft(now!.startDistance,`${before.key} start cap`).toBeLessThanOrEqual(before.startDistance+1)
   if(before.endDistance!==null)expect.soft(now!.endDistance,`${before.key} end cap`).toBeLessThanOrEqual(before.endDistance+1)
   for(const [id,sides]of Object.entries(before.doorNeighbors) as [string,{before:number|null;after:number|null}][]){for(const side of ['before','after']as const){if(sides[side]===null)continue;const measured=now!.doorNeighbors[id]?.[side];expect.soft(measured,`${id} ${side} wall must exist`).not.toBeNull();expect.soft(measured,`${id} ${side} wall distance`).toBeLessThanOrEqual(sides[side]!+1);expect.soft(measured,`${id} ${side} wall overlap`).toBeGreaterThanOrEqual(Math.max(0,sides[side]!-1))}}
  }
 })
 it.each(Object.values(mainlineScenes))('$id retains every physical corner visual cap',scene=>{
  const units=mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}),actual=wallCornerCoverage(scene,units)
  if(scene.id!=='commercial-cafe'){
   // A one-cell-thick wall rectangle's unpainted side is not a second wall.
   // Check endpoints of its owned edges against the complete shared frame.
   const cells=units.flatMap(u=>u.visual.cells).filter(c=>c.glyph)
   for(const wall of scene.structures){if(!wall.bounds)continue;const b=wall.bounds
    for(const edge of wall.wallEdges??[]){const horizontal=edge==='top'||edge==='bottom'
     const ends=horizontal?[{x:b.x,y:b.y+(edge==='bottom'?b.height:0)},{x:b.x+b.width,y:b.y+(edge==='bottom'?b.height:0)}]:[{x:b.x+(edge==='right'?b.width:0),y:b.y},{x:b.x+(edge==='right'?b.width:0),y:b.y+b.height}]
     for(const p of ends)expect(Math.min(...cells.map(c=>Math.hypot((c.x-p.x)*19.2,(c.y-p.y)*10.8))),`${wall.id}:${edge} endpoint cap`).toBeLessThanOrEqual(28.01)
    }
   }
   return
  }
  for(const before of baseline[scene.id].corners){const now=actual.find(e=>e.key===before.key);expect.soft(now,before.key).toBeDefined();if(!now)continue;before.distances.forEach((distance:number,index:number)=>expect.soft(now!.distances[index],`${before.key} corner${index}`).toBeLessThanOrEqual(distance+1))}
 })
 it.each(Object.values(mainlineScenes))('$id has a wall exactly one reference pitch outside each door group',scene=>{
  const edges=wallVisualCoverage(scene,mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}))
  for(const edge of edges)for(const[id,sides]of Object.entries(edge.doorNeighbors))for(const side of ['before','after']as const){
   expect(sides[side],`${id} ${side} wall exists`).not.toBeNull()
   expect(Math.abs(sides[side]!-28),`${id} ${side} reference pitch`).toBeLessThan(.04)
  }
 })
})
