import type { MainlineSceneId } from './mainlineSceneModel'
import type { Point, CollisionBox } from './sceneGeometry'
import { mainlineScenes, type MainlineSceneDefinition } from './mainlineScenes'
import { migratePreGridPosition } from './sceneGridRollout'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import { createMainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { findMainlinePath, isWalkableMainlinePoint } from './mainlineNavigation'
import { mainlineProtagonistDotFootprint } from './sceneLayout'

export const currentMiningLayoutVersion = 3
export type MiningSceneId = 'yonghe-mining-perimeter' | 'yonghe-eatery'
export type MiningPositionRooms = { current?: string; scenes?: Partial<Record<MiningSceneId, string>> }
type MiningPositionSnapshot = { current?: { sceneId: MiningSceneId; position: Point }; scenes?: Partial<Record<MiningSceneId, Point>> }
export type MiningPositionBackup = MiningPositionSnapshot & { sourceLayout: 'grid-v1' | 'grid-v2' | 'unknown-legacy'; layout2?: MiningPositionSnapshot }
export const isMiningSceneId = (id: string): id is MiningSceneId => id === 'yonghe-mining-perimeter' || id === 'yonghe-eatery'

/** Frozen geometry metadata from published bae6afb, not a second scene implementation. */
export const legacyMiningGridRooms = [
  { id: 'mining-shop-1-interior', bounds: { x:25.417133333333332,y:8.000085185185185,width:14.583333333333336,height:12.962962962962965 } },
  { id: 'mining-shop-2-interior', bounds: { x:19.5838,y:20.96304814814815,width:20.416666666666668,height:18.14814814814815 } },
  { id: 'mining-shop-3-interior', bounds: { x:25.417133333333332,y:39.1111962962963,width:14.583333333333336,height:12.962962962962962 } },
  { id: 'mining-shop-4-interior', bounds: { x:22.500466666666668,y:52.07415925925926,width:17.5,height:15.555555555555543 } },
  { id: 'mining-shop-5-interior', bounds: { x:25.417133333333332,y:67.6297148148148,width:14.583333333333336,height:12.962962962962962 } },
  { id: 'mining-shop-6-interior', bounds: { x:25.417133333333332,y:80.59267777777777,width:14.583333333333336,height:12.962962962962962 } },
  { id: 'mining-shop-7-interior', bounds: { x:25.417133333333332,y:93.55564074074073,width:14.583333333333336,height:12.962962962962962 } },
  { id: 'mining-shop-8-interior', bounds: { x:25.417133333333332,y:106.51860370370369,width:14.583333333333336,height:12.962962962962976 } },
] as const
const laneId = 'mining-street-public-lane'
const legacyLane = { x:40.00046666666667,y:2.8148,width:8.749999999999993,height:124.44434445015857 }
/** Frozen version2/4217 metadata. It must not be inferred from the new rooms:
 * a version2 position needs its old owner before any coordinate recovery. */
export const expandedMiningGridRooms = [
  [8.000085185185185,23.333333333333336],
  [31.33341851851852,28.51851851851852],
  [59.85193703703704,23.33333333333332],
  [83.18527037037036,25.925925925925924],
  [109.11119629629628,23.33333333333333],
  [132.4445296296296,23.333333333333343],
  [155.77786296296296,23.333333333333343],
  [179.1111962962963,23.333333333333314],
].map(([y,height],index)=>({id:`mining-shop-${index+1}-interior`,bounds:{x:3.542133333333336,y:y!,width:36.45833333333333,height:height!}}))
const expandedLane = { ...legacyLane, height:207.40754444444454 }
const ownedRoomIds = new Set<string>([laneId, ...legacyMiningGridRooms.map(room => room.id)])
const inside = (p:Point,b:CollisionBox) => p.x>=b.x&&p.x<=b.x+b.width&&p.y>b.y+.000001&&p.y<b.y+b.height-.000001
const closedInside = (p:Point,b:CollisionBox) => p.x>=b.x-.000001&&p.x<=b.x+b.width+.000001&&p.y>=b.y-.000001&&p.y<=b.y+b.height+.000001
const fraction = (v:number,start:number,size:number) => Math.max(0,Math.min(1,(v-start)/size))
const validPoint = (v:unknown):v is Point => !!v&&typeof v==='object'&&Number.isFinite((v as Point).x)&&Number.isFinite((v as Point).y)

export function cleanMiningPositionRooms(value:unknown):MiningPositionRooms|undefined {
  if(!value||typeof value!=='object')return undefined
  const source=value as MiningPositionRooms,scenes=Object.fromEntries(Object.entries(source.scenes??{}).filter(([id,room])=>isMiningSceneId(id)&&typeof room==='string'&&ownedRoomIds.has(room)))
  const current=typeof source.current==='string'&&ownedRoomIds.has(source.current)?source.current:undefined
  return current||Object.keys(scenes).length?{...(current?{current}:{}),...(Object.keys(scenes).length?{scenes}:{})}:undefined
}
export function cleanMiningPositionBackup(value:unknown):MiningPositionBackup|undefined {
  if(!value||typeof value!=='object')return undefined
  const source=value as MiningPositionBackup
  if(source.sourceLayout!=='grid-v1'&&source.sourceLayout!=='grid-v2'&&source.sourceLayout!=='unknown-legacy')return undefined
  const current=source.current&&isMiningSceneId(source.current.sceneId)&&validPoint(source.current.position)?{sceneId:source.current.sceneId,position:{...source.current.position}}:undefined
  const scenes=Object.fromEntries(Object.entries(source.scenes??{}).filter(([id,p])=>isMiningSceneId(id)&&validPoint(p)).map(([id,p])=>[id,{...p!}]))
  const layout2=source.layout2&&typeof source.layout2==='object'?source.layout2:undefined
  const layout2Current=layout2?.current&&isMiningSceneId(layout2.current.sceneId)&&validPoint(layout2.current.position)?{sceneId:layout2.current.sceneId,position:{...layout2.current.position}}:undefined
  const layout2Scenes=Object.fromEntries(Object.entries(layout2?.scenes??{}).filter(([id,p])=>isMiningSceneId(id)&&validPoint(p)).map(([id,p])=>[id,{...p!}]))
  const snapshot=layout2Current||Object.keys(layout2Scenes).length?{...(layout2Current?{current:layout2Current}:{}),...(Object.keys(layout2Scenes).length?{scenes:layout2Scenes}:{})}:undefined
  return {sourceLayout:source.sourceLayout,...(current?{current}:{}),...(Object.keys(scenes).length?{scenes}:{}),...(snapshot?{layout2:snapshot}:{})}
}

export function currentMiningRoomId(id:MiningSceneId,p:Point):string|undefined {
  const rooms=mainlineScenes[id].rooms,lane=rooms.find(room=>room.id===laneId)!
  if(closedInside(p,lane.bounds))return laneId
  return rooms.find(room=>room.id!==laneId&&inside(p,room.bounds))?.id
}

/** Recovery is constrained to the named room and a route from its public
 * front-side component. No global nearest-point or locked-door traversal. */
function recoverOwned(scene:MainlineSceneDefinition,owner:string,preferred:Point):Point {
  const room=scene.rooms.find(room=>room.id===owner)!,lane=owner===laneId
  const front=lane?undefined:scene.passages.find(p=>p.toRoomId===owner&&p.access==='open')!
  const seed=lane?scene.initialPlayerPosition:front!.crossingTargets[0]
  const body=mainlineProtagonistDotFootprint(seed,sceneDesignReferenceMetrics,scene.id)
  const options={screenMetrics:sceneDesignReferenceMetrics,actorId:'protagonist',actorFootprint:{width:body.width,height:body.height},openPassageIds:new Set<string>(),geometrySnapshot:createMainlineSceneGeometrySnapshot(scene,seed,{},sceneDesignReferenceMetrics)}
  const legal=(p:Point)=>closedInside(p,room.bounds)&&isWalkableMainlinePoint(p,scene,{},options)
  if(!legal(seed))throw new Error(`Mining migration has no legal public recovery seed: ${owner}`)
  const connected=(p:Point)=>legal(p)&&findMainlinePath(seed,p,scene,{},options)!==null
  if(connected(preferred))return {...preferred}
  const candidates:Point[]=[],stepX=14/19.2,stepY=14/10.8
  for(let x=room.bounds.x+stepX;x<room.bounds.x+room.bounds.width;x+=stepX)for(let y=room.bounds.y+stepY;y<room.bounds.y+room.bounds.height;y+=stepY)candidates.push({x,y})
  candidates.sort((a,b)=>Math.hypot((a.x-preferred.x)*19.2,(a.y-preferred.y)*10.8)-Math.hypot((b.x-preferred.x)*19.2,(b.y-preferred.y)*10.8))
  let attempted=0
  for(const candidate of candidates){if(!legal(candidate))continue;if(++attempted>16)break;if(connected(candidate))return candidate}
  return {...seed}
}

function mapLanePosition(scene:MainlineSceneDefinition,p:Point,sourceLane:CollisionBox):Point {
  const nextLane=scene.rooms.find(room=>room.id===laneId)!.bounds
  return {
    x: nextLane.x + (1 - fraction(p.y,sourceLane.y,sourceLane.height)) * nextLane.width,
    y: nextLane.y + fraction(p.x,sourceLane.x,sourceLane.width) * nextLane.height,
  }
}
export function migrateMiningPositions({layoutVersion,worldGridVersion,currentSceneId,currentPosition,scenePositions,rooms:previousRooms,backup:previousBackup}:{layoutVersion:unknown;worldGridVersion:unknown;currentSceneId:MainlineSceneId;currentPosition:Point|null;scenePositions:Partial<Record<MainlineSceneId,Point>>;rooms?:MiningPositionRooms;backup?:MiningPositionBackup}) {
  const version=typeof layoutVersion==='number'&&Number.isInteger(layoutVersion)&&layoutVersion>=currentMiningLayoutVersion?layoutVersion:currentMiningLayoutVersion
  const currentSchema=typeof layoutVersion==='number'&&Number.isInteger(layoutVersion)&&layoutVersion>=currentMiningLayoutVersion
  const fromLayout2=layoutVersion===2
  const knownGridLegacy=fromLayout2||layoutVersion===1||worldGridVersion===1
  const sourceRooms=fromLayout2?expandedMiningGridRooms:legacyMiningGridRooms
  const sourceLane=fromLayout2?expandedLane:legacyLane
  const scenes={...scenePositions},owners:MiningPositionRooms={scenes:{...previousRooms?.scenes}},memo=new Map<string,{point:Point;owner:string}>()
  const backup:MiningPositionBackup|undefined=currentSchema?previousBackup:{sourceLayout:fromLayout2?'grid-v2':knownGridLegacy?'grid-v1':'unknown-legacy',...previousBackup,...(previousBackup?.scenes?{scenes:{...previousBackup.scenes}}:{}),...(fromLayout2?{layout2:{...previousBackup?.layout2,...(previousBackup?.layout2?.scenes?{scenes:{...previousBackup.layout2.scenes}}:{})}}:{})}
  const migrate=(id:MiningSceneId,source:Point,hint?:string)=>{
    const key=`${id}:${source.x}:${source.y}:${hint??''}`,cached=memo.get(key);if(cached)return cached
    const scene=mainlineScenes[id]
    if(currentSchema){const result={point:{...source},owner:currentMiningRoomId(id,source)??hint??laneId};memo.set(key,result);return result}
    let owner:string,mapped:Point
    if(!knownGridLegacy){
      // No reliable coordinate epoch: use the named scene/explicit ownership,
      // never infer an arbitrary room from ambiguous numbers.
      owner=hint&&ownedRoomIds.has(hint)?hint:id==='yonghe-eatery'?'mining-shop-2-interior':laneId
      const entrance=scene.passages.find(p=>p.toRoomId===owner)
      if(owner!==laneId&&entrance?.access!=='open'){owner=laneId;mapped=entrance?.thresholds[0]??scene.initialPlayerPosition}
      else mapped=owner===laneId?scene.initialPlayerPosition:entrance!.crossingTargets[0]
    }else{
      const old=fromLayout2||worldGridVersion===1?source:migratePreGridPosition(id,source)
      const hinted=sourceRooms.find(room=>room.id===hint&&closedInside(old,room.bounds))
      const room=hinted??(old.x<sourceLane.x?sourceRooms.find(room=>inside(old,room.bounds)):undefined)
      if(room){const next=scene.rooms.find(candidate=>candidate.id===room.id)!.bounds;const entrance=scene.passages.find(p=>p.toRoomId===room.id);if(entrance?.access!=='open'){owner=laneId;mapped=entrance?.thresholds[0]??scene.initialPlayerPosition}else{owner=room.id;mapped={x:next.x+(1-fraction(old.y,room.bounds.y,room.bounds.height))*next.width,y:next.y+fraction(old.x,room.bounds.x,room.bounds.width)*next.height}}}
      else{owner=laneId;mapped=mapLanePosition(scene,old,sourceLane)}
    }
    const result={point:recoverOwned(scene,owner,mapped),owner};memo.set(key,result);return result
  }
  for(const id of ['yonghe-mining-perimeter','yonghe-eatery'] as const){const source=scenes[id];if(!source)continue;const result=migrate(id,source,previousRooms?.scenes?.[id]);scenes[id]=result.point;owners.scenes![id]=result.owner;if(!currentSchema){backup!.scenes??={};backup!.scenes[id]??={...source};if(fromLayout2){backup!.layout2??={};backup!.layout2!.scenes??={};backup!.layout2!.scenes![id]??={...source}}}}
  let current=currentPosition
  if(isMiningSceneId(currentSceneId)&&current){const result=migrate(currentSceneId,current,previousRooms?.current);owners.current=result.owner;if(!currentSchema){backup!.current??={sceneId:currentSceneId,position:{...current}};if(fromLayout2)backup!.layout2!.current??={sceneId:currentSceneId,position:{...current}}};current=result.point}
  const hasOwners=!!owners.current||Object.keys(owners.scenes??{}).length>0
  const hasBackup=!!backup?.current||Object.keys(backup?.scenes??{}).length>0
  return {version,currentPosition:current,scenePositions:scenes,rooms:hasOwners?owners:undefined,backup:hasBackup?backup:undefined}
}
