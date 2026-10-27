import type {MainlineSceneDefinition,MainlineSceneGeometryUnit} from '../../src/center/runtime/mainlineScenes'
/** Full edge coverage: no min/max distance filter that can hide missing cells. */
export function wallVisualCoverage(scene:MainlineSceneDefinition,units:readonly MainlineSceneGeometryUnit[]){
 const groups=new Map<string,{owner:string;edge:string;axis:'x'|'y';normal?:number;start:number;end:number;nodes:{axis:number;wall:boolean;door?:string}[]}>()
 for(const u of units){if(u.geometryKind!=='boundary'||!u.edge||u.variant==='near'||u.visualOnly)continue
  const axis=u.edge==='top'||u.edge==='bottom'?'x':'y',dimension=axis==='x'?1920:1080,key=`${u.ownerId}:${u.edge}`
  const group=groups.get(key)??{owner:u.ownerId,edge:u.edge,axis,start:Infinity,end:-Infinity,nodes:[]}
  group.start=Math.min(group.start,u[axis]*dimension/100);group.end=Math.max(group.end,(u[axis]+u[axis==='x'?'width':'height'])*dimension/100)
  for(const c of u.visual.cells){const hiddenGlyph=c.baselineGlyph??c.glyph;if(!hiddenGlyph)continue;group.normal??=c[axis==='x'?'y':'x'];group.nodes.push({axis:c[axis]*dimension/100,wall:c.kind==='wall'||c.storefrontRole==='wall'||Boolean(c.baselineGlyph),door:c.kind==='door'||c.storefrontRole==='door'?c.entityId??u.entityId:undefined})}
  group.normal??=u.edge==='left'?u.x:u.edge==='right'?u.x+u.width:u.edge==='top'?u.y:u.y+u.height
  groups.set(key,group)
 }
 // Storefront composition replaces the parent facade cells with visual-only
 // baseline glyph units. They are still visible wall/sign coverage; omitting
 // them incorrectly measures the whole widened shop frontage as an empty gap.
 // Keep the physical-owner groups and add these glyphs to their actual facade.
 for(const u of units){if(!u.visualOnly||u.variant!=='baseline'||!u.sourceWallId||!u.edge)continue
  const group=groups.get(`${u.sourceWallId}:${u.edge}`);if(!group)continue
  const dimension=group.axis==='x'?1920:1080
  for(const c of u.visual.cells){const hiddenGlyph=c.baselineGlyph??c.glyph;if(!hiddenGlyph)continue;group.nodes.push({axis:c[group.axis]*dimension/100,wall:c.kind==='wall'||c.storefrontRole==='wall'||Boolean(c.baselineGlyph),door:c.kind==='door'||c.storefrontRole==='door'?c.entityId??u.entityId:undefined})}
 }
 // A shared corner can be painted by the neighboring edge or adjacent frame.
 // Count it only at the exact normal coordinate, never a remote glyph on that
 // other edge. This preserves a strict zero-distance corner-cap check.
 for(const group of groups.values()){if(group.normal===undefined)continue
  const other=group.axis==='x'?'y':'x',dimension=group.axis==='x'?1920:1080
  for(const unit of units){if(unit.geometryKind!=='boundary'||unit.variant==='near')continue
   for(const cell of unit.visual.cells){if(!(cell.baselineGlyph??cell.glyph)||Math.abs(cell[other]-group.normal)>.00001||cell[group.axis]*dimension/100<group.start-.00001||cell[group.axis]*dimension/100>group.end+.00001)continue
    group.nodes.push({axis:cell[group.axis]*dimension/100,wall:cell.kind==='wall'||cell.storefrontRole==='wall',door:cell.kind==='door'||cell.storefrontRole==='door'?cell.entityId??unit.entityId:undefined})
   }
  }
 }
 return [...groups].map(([key,g])=>{
  const coords=[...new Set(g.nodes.map(n=>n.axis))].sort((a,b)=>a-b),walls=g.nodes.filter(n=>n.wall).map(n=>n.axis),doors=new Map<string,number[]>()
  for(const n of g.nodes){if(n.door){const a=doors.get(n.door)??[];a.push(n.axis);doors.set(n.door,a)}}
  const doorNeighbors=Object.fromEntries([...doors].map(([id,a])=>{const first=Math.min(...a),last=Math.max(...a),before=walls.filter(x=>x<first-.001),after=walls.filter(x=>x>last+.001);return[id,{before:before.length?first-Math.max(...before):null,after:after.length?Math.min(...after)-last:null}]}))
  return{key,doorNeighbors,startDistance:coords.length?Math.min(...coords.map(x=>Math.abs(x-g.start))):null,endDistance:coords.length?Math.min(...coords.map(x=>Math.abs(x-g.end))):null,maxGap:coords.length>1?Math.max(...coords.slice(1).map((x,i)=>x-coords[i]!)):0}
 })
}
export function wallCornerCoverage(scene:MainlineSceneDefinition,units:readonly MainlineSceneGeometryUnit[]){
 return scene.structures.flatMap(s=>{if(!s.bounds)return[];const nodes=units.filter(u=>u.ownerId===s.id&&u.geometryKind==='boundary').flatMap(u=>u.visual.cells.filter(c=>c.baselineGlyph??c.glyph));if(!nodes.length)return[];const b=s.bounds;return[{key:s.id,distances:[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}].map(p=>Math.min(...nodes.map(c=>Math.hypot((c.x-p.x)*19.2,(c.y-p.y)*10.8))))}]})
}
