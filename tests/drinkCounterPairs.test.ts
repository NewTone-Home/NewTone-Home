import { describe,expect,it } from 'vitest'
import { mainlineScenes,mainlineCanonicalSceneGeometryUnits } from '../src/center/runtime/mainlineScenes'
import { canTravelAlongMainlineSegment } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
const scene=mainlineScenes['commercial-street'],units=mainlineCanonicalSceneGeometryUnits(scene,sceneDesignReferenceMetrics)
const specs=[['commercial-north-cafe-interior','cafe-trial-counter',196,476,38],['commercial-south-s5-interior','milk-tea-trial',224,112,42],['commercial-north-n1-interior','fruit-tea-trial',112,560,40]] as const

describe('complete local counter pairs at actual28px wall anchors',()=>{
 for(const [roomId,prefix,axis,frontY,count] of specs)it(roomId,()=>{
  const room=scene.rooms.find(r=>r.id===roomId)!,point=(x:number,y:number)=>({x:room.bounds.x+x/19.2,y:room.bounds.y+y/10.8}),local=(p:{x:number;y:number})=>({x:(p.x-room.bounds.x)*19.2,y:(p.y-room.bounds.y)*10.8})
  const bodies=scene.continuousStructures.filter(b=>b.id.startsWith(prefix)),cells=scene.objects.filter(o=>bodies.some(b=>b.id===o.interactionStructureId))
  expect(cells).toHaveLength(count)
  for(const body of bodies){const run=cells.filter(c=>c.interactionStructureId===body.id);expect(run.length%2).toBe(0);for(let i=0;i<run.length;i+=2){expect(run.slice(i,i+2).map(c=>c.label).join('')).toBe('柜台');expect(Math.hypot((run[i+1].position.x-run[i].position.x)*19.2,(run[i+1].position.y-run[i].position.y)*10.8)).toBeCloseTo(16,5)}
   for(let i=2;i<run.length;i+=2){
    const allowed=roomId.includes('cafe')&&body.id.includes('front')&&[2,4].includes(i)?26:roomId.includes('s5')&&body.id.includes('long')&&[32,34].includes(i)?22:roomId.includes('n1')&&body.id.includes('long')&&[30,32].includes(i)?24:16
    expect(Math.hypot((run[i].position.x-run[i-1].position.x)*19.2,(run[i].position.y-run[i-1].position.y)*10.8)).toBeCloseTo(allowed,5)
   }
  }
  const wallCells=units.flatMap(u=>u.visual.cells).filter(c=>c.kind==='wall')
  for(const [x,y] of [[axis,roomId.includes('s5')?700:0],[roomId.includes('s5')?336:0,frontY]])expect(wallCells.some(c=>Math.abs(local(c).x-x)<.02&&Math.abs(local(c).y-y)<.02)).toBe(true)
  // Clear space at each real terminal is16px between centers: both full16px
  // text cells meet at the edge, with no glyph clipped/painted over a wall.
  const rearRun=cells.filter(c=>Math.abs(local(c.position).x-axis)<.001)
  expect(roomId.includes('s5')?700-Math.max(...rearRun.map(c=>local(c.position).y)):Math.min(...rearRun.map(c=>local(c.position).y))).toBeCloseTo(16,5)
  const frontBody=bodies.find(b=>b.id.includes('front'))!,frontCells=cells.filter(c=>c.interactionStructureId===frontBody.id)
  expect(roomId.includes('s5')?336-Math.max(...frontCells.map(c=>local(c.position).x)):Math.min(...frontCells.map(c=>local(c.position).x))).toBeCloseTo(16,5)
  const actorId=roomId.includes('cafe')?'cafe-coffee-owner':roomId.includes('s5')?'milk-tea-trial-worker':'fruit-tea-trial-worker'
  const testGaps=roomId.includes('cafe')?[[45,476,10],[87,478,10]]:roomId.includes('s5')?[[224,619,6],[224,657,6]]:[[112,492,8],[112,532,8]]
  for(const [x,y,clear] of testGaps){expect(clear).toBeLessThan(11);for(const size of [11,16]){const opts={screenMetrics:sceneDesignReferenceMetrics,actorId,actorFootprint:{width:size/19.2,height:size/10.8}};expect(canTravelAlongMainlineSegment(point(x-(roomId.includes('cafe')?0:32),y-(roomId.includes('cafe')?32:0)),point(x+(roomId.includes('cafe')?0:32),y+(roomId.includes('cafe')?32:0)),scene,{},opts)).toBe(false)}}
 })
})
