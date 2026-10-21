import type { MainlineSceneBlueprint, MainlineSceneId, MainlineSceneEntity, MainlineWallOpening } from './mainlineSceneModel'
import type { Point, CollisionBox } from './sceneGeometry'
import { createWorldGrid } from './worldGrid'

/** Primary wall planes, measured in reference-world pixels before migration.
 * Small authoring-rounding errors are not treated as new cells. */
const plans: Partial<Record<MainlineSceneId, { x: number[]; y: number[] }>> = {
  'jijia-ancestral-home': { x: [192,1920], y: [194.4,885.6] },
  'jijia-ancestral-interior': { x: [192,1920], y: [194.4,885.6] },
  'zhongshuyuan-passage': { x: [57.6,1862.4], y: [483.99984,596.00016] },
  'commercial-street': { x: [230.4,258.41335968,594.40567968,930.39799968,1266.39031968,1602.38263968,1938.37495968,2274.36727968,2610.35959968,2946.35191968,2974.33728], y: [-339.20208,360.79992,719.20008,1419.20208] },
  'yonghe-mining-perimeter': { x: [376.00896,432.00768,488.0064,768,935.99616], y: [30.40092,86.4,226.4004,422.40096,562.40136,730.40184,870.40224,1010.40264,1150.40304,1290.40344,1374.40584] },
}
plans['yonghe-eatery'] = plans['yonghe-mining-perimeter']

function planeMap(planes: number[], dimension: number, reverse=false) {
  const mapped = [planes[0]!]
  for (let i=1;i<planes.length;i++) mapped.push(mapped[i-1]! + Math.ceil((planes[i]!-planes[i-1]!-.1)/28)*28)
  const from=reverse?mapped:planes, to=reverse?planes:mapped
  return (value: number) => {
    const px=value*dimension/100
    if(px<from[0]!) return (to[0]!+px-from[0]!)/dimension*100
    if(px>from.at(-1)!) return (to.at(-1)!+px-from.at(-1)!)/dimension*100
    const i=Math.min(from.length-2, Math.max(0,from.findIndex((v,index)=>index>0&&px<=v)-1))
    return (to[i]!+(px-from[i]!)/(from[i+1]!-from[i]!)*(to[i+1]!-to[i]!))/dimension*100
  }
}

export function sceneGridTransform(id: MainlineSceneId) {
  const plan=plans[id]
  if(!plan) return null
  const grid=createWorldGrid({x:plan.x[0]!/1920*100,y:plan.y[0]!/1080*100})
  const x=planeMap(plan.x,1920), y=planeMap(plan.y,1080)
  const inverseX=planeMap(plan.x,1920,true), inverseY=planeMap(plan.y,1080,true)
  const inverse=(p:Point):Point=>({x:inverseX(p.x),y:inverseY(p.y)})
  const point=(p:Point):Point=>({x:x(p.x),y:y(p.y)})
  const snap=(p:Point):Point=>{const q=point(p);return grid.point(Math.round((q.x-grid.origin.x)/grid.step.x),Math.round((q.y-grid.origin.y)/grid.step.y))}
  const box=(b:CollisionBox):CollisionBox=>{const p=point(b),e=point({x:b.x+b.width,y:b.y+b.height});return {...p,width:e.x-p.x,height:e.y-p.y}}
  return {grid,x,y,point,snap,box,inverse}
}

/** One-time saved-position migration. Office was authored directly in the
 * pilot, so its old room planes are retained only as migration metadata. */
export function migratePreGridPosition(id:MainlineSceneId,p:Point):Point {
  if(id==='zhongshuyuan-office') {
    const axis=(v:number,old:number[],next:number[])=>{if(v<old[0]!)return next[0]!+v-old[0]!;if(v>old.at(-1)!)return next.at(-1)!+v-old.at(-1)!;const i=Math.min(old.length-2,Math.max(0,old.findIndex((n,index)=>index>0&&v<=n)-1));return next[i]!+(v-old[i]!)/(old[i+1]!-old[i]!)*(next[i+1]!-next[i]!)}
    return {x:axis(p.x,[6,28,50,72,94],[6,6+448/19.2,6+896/19.2,6+1344/19.2,6+1792/19.2]),y:axis(p.y,[8,39,61,92],[8,8+336/10.8,8+588/10.8,8+924/10.8])}
  }
  return sceneGridTransform(id)?.point(p)??{...p}
}

/** Translate complete furniture geometry, including seat approaches, without
 * stretching its glyph pitch, collision footprint or internal relationships. */
function translate<T>(value:T,delta:Point):T {
  if(Array.isArray(value)) return value.map(v=>translate(v,delta)) as T
  if(!value||typeof value!=='object') return value
  const o=value as Record<string,unknown>
  const isPoint=typeof o.x==='number'&&typeof o.y==='number'
  return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,isPoint&&k==='x'?(v as number)+delta.x:isPoint&&k==='y'?(v as number)+delta.y:translate(v,delta)])) as T
}

export function alignSceneBlueprint(source:MainlineSceneBlueprint):MainlineSceneBlueprint {
  const t=sceneGridTransform(source.id)
  if(!t) return source // Office is authored directly; old standalone Cafe is a separate removal batch.
  const {grid}=t
  const opening=(o:MainlineWallOpening):MainlineWallOpening=>{
    const horizontal=o.edge==='top'||o.edge==='bottom', axis=horizontal?'x':'y'
    const map=horizontal?t.x:t.y,step=grid.step[axis],origin=grid.origin[axis]
    const center=origin+Math.round((map((o.start+o.end)/2)-origin)/step)*step
    // A door owns full cell intervals; never round its two edges independently.
    const count=Math.max(1,Math.round((o.end-o.start)/step))
    return {...o,start:center-count*step/2,end:center+count*step/2}
  }
  const walls=source.scene.walls.map(w=>{
    const a=t.snap(w.bounds),b=t.snap({x:w.bounds.x+w.bounds.width,y:w.bounds.y+w.bounds.height})
    return {...w,bounds:{...a,width:b.x-a.x,height:b.y-a.y},boundaryCoordinateCount:undefined,boundaryWorldGrid:{origin:grid.origin,pitchPx:28},
      openings:w.openings?.map(opening),features:w.features?.map(f=>{
        const horizontal=f.edge==='top'||f.edge==='bottom',axis=horizontal?'x':'y',map=horizontal?t.x:t.y,step=grid.step[axis],origin=grid.origin[axis]
        const start=origin+Math.round((map(f.start)-origin)/step)*step,end=origin+Math.round((map(f.end)-origin)/step)*step
        return {...f,start,end,entity:f.entity?translate(f.entity,(()=>{const p=t.point(f.entity.position);return {x:p.x-f.entity.position.x,y:p.y-f.entity.position.y}})()):undefined}
      })}
  })
  const groups=source.scene.furnitureGroups.map(g=>({...g,anchor:t.point(g.anchor)}))
  const entity=(e:MainlineSceneEntity)=>{
    const old=source.scene.furnitureGroups.find(g=>g.id===e.groupId)?.anchor??e.position
    const next=t.point(old)
    return translate(e,{x:next.x-old.x,y:next.y-old.y})
  }
  const portals=source.portals.map(p=>{
    const portalOpening=p.wallOpenings?.find(w=>w.opening.doorId===p.id)
    const wall=walls.find(w=>w.openings?.some(o=>o.doorId===p.id))??walls.find(w=>w.id===portalOpening?.wallId)
    const own=wall?.openings?.find(o=>o.doorId===p.id)??(portalOpening?opening(portalOpening.opening):undefined)
    const originalWall=source.scene.walls.find(w=>w.id===wall?.id)
    const originalOpening=originalWall?.openings?.find(o=>o.doorId===p.id)
    let door=t.snap(p.endpoint.doorPosition)
    if(own&&wall){const horizontal=own.edge==='top'||own.edge==='bottom';door=horizontal?{x:(own.start+own.end)/2,y:wall.bounds.y+(own.edge==='bottom'?wall.bounds.height:0)}:{x:wall.bounds.x+(own.edge==='right'?wall.bounds.width:0),y:(own.start+own.end)/2}}
    // Keep the approach on the door's tangent axis; preserve its normal clearance.
    const tangent=own?.edge??originalOpening?.edge
    const near=(v:Point)=>{const q=t.point(v);return tangent==='top'||tangent==='bottom'?{...q,x:door.x}:tangent==='left'||tangent==='right'?{...q,y:door.y}:q}
    const target=p.targetSceneId?sceneGridTransform(p.targetSceneId):null
    return {...p,endpoint:{...p.endpoint,doorPosition:door,threshold:near(p.endpoint.threshold),crossingTarget:near(p.endpoint.crossingTarget),entryPosition:p.endpoint.entryPosition?(target?.point(p.endpoint.entryPosition)??p.endpoint.entryPosition):undefined},wallOpenings:p.wallOpenings?.map(w=>({...w,opening:opening(w.opening)}))}
  })
  return {...source,presentation:source.presentation.mode==='fixed'?{...source.presentation,anchor:t.point(source.presentation.anchor)}:source.presentation,
    areaLabel:typeof source.areaLabel==='function'?((label)=>(p:Point)=>label(t.inverse(p)))(source.areaLabel):source.areaLabel,
    scene:{...source.scene,walls,walkBounds:t.box(source.scene.walkBounds),rooms:source.scene.rooms?.map(r=>({...r,bounds:walls.find(w=>w.id===`${r.id}-shell`)?.bounds??t.box(r.bounds)})),
      floorEntities:source.scene.floorEntities.map(entity),furnitureGroups:groups,
      blockers:source.scene.blockers.map(b=>({...b,...t.box(b)})),airWalls:source.scene.airWalls?.map(b=>({...b,...t.box(b)})),
      initialPlayerPosition:t.point(source.scene.initialPlayerPosition),rideArrivalPosition:source.scene.rideArrivalPosition?t.point(source.scene.rideArrivalPosition):undefined,
      npcPlacements:source.scene.npcPlacements?.map(p=>({...p,position:p.position?t.point(p.position):undefined,interactionApproach:p.interactionApproach?t.point(p.interactionApproach):undefined})),
      npcBehaviorTargets:source.scene.npcBehaviorTargets?.map(p=>({...p,position:t.point(p.position)})),
      ambientNpcRoutes:source.scene.ambientNpcRoutes?.map(r=>({...r,steps:r.steps.map(s=>({...s,target:t.point(s.target),...('reentry' in s?{reentry:t.point(s.reentry)}:{})}))})),
      altars:source.scene.altars?.map(a=>({...a,anchor:t.point(a.anchor)})),
      accessRegions:source.scene.accessRegions?.map(b=>({...b,...t.box(b)})),
      accessPortals:source.scene.accessPortals?.map(p=>({...p,threshold:t.box(p.threshold),outside:t.point(p.outside),inside:t.point(p.inside)})),
      continuousStructures:source.scene.continuousStructures?.map(b=>({...b,...t.box(b)})),
      externalExit:source.scene.externalExit?{...source.scene.externalExit,threshold:(source.scene.externalExit.axis==='x'?t.x:t.y)(source.scene.externalExit.threshold)}:undefined,
      externalExits:source.scene.externalExits?.map(e=>({...e,threshold:(e.axis==='x'?t.x:t.y)(e.threshold),triggerSpan:e.triggerSpan?{start:(e.axis==='x'?t.y:t.x)(e.triggerSpan.start),end:(e.axis==='x'?t.y:t.x)(e.triggerSpan.end)}:undefined})),
      storefronts:source.scene.storefronts?.map(s=>{const horizontal=s.edge==='top'||s.edge==='bottom',axis=horizontal?'x':'y',map=horizontal?t.x:t.y,step=grid.step[axis],origin=grid.origin[axis];const first=origin+Math.round((map(s.start+step*.4995)-origin)/step)*step;const count=s.composition?.fixedCellCount??Math.round((s.end-s.start)/step);return {...s,start:first-step*.4995,end:first+(count-1+.4995)*step,approach:s.approach?t.point(s.approach):undefined}}),
    },portals}
}
