import type { MainlineSceneId } from './mainlineSceneModel'
import type { Point, CollisionBox } from './sceneGeometry'
import { mainlineScenes, type MainlineSceneDefinition } from './mainlineScenes'
import { migratePreGridPosition } from './sceneGridRollout'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import { createMainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { findMainlinePath, isWalkableMainlinePoint } from './mainlineNavigation'
import { mainlineProtagonistDotFootprint } from './sceneLayout'

export const currentMiningLayoutVersion = 2
export type MiningSceneId = 'yonghe-mining-perimeter' | 'yonghe-eatery'
export type MiningPositionRooms = { current?: string; scenes?: Partial<Record<MiningSceneId, string>> }
export type MiningPositionBackup = { sourceLayout: 'grid-v1' | 'unknown-legacy'; current?: { sceneId: MiningSceneId; position: Point }; scenes?: Partial<Record<MiningSceneId, Point>> }
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
  if(source.sourceLayout!=='grid-v1'&&source.sourceLayout!=='unknown-legacy')return undefined
  const current=source.current&&isMiningSceneId(source.current.sceneId)&&validPoint(source.current.position)?{sceneId:source.current.sceneId,position:{...source.current.position}}:undefined
  const scenes=Object.fromEntries(Object.entries(source.scenes??{}).filter(([id,p])=>isMiningSceneId(id)&&validPoint(p)).map(([id,p])=>[id,{...p!}]))
  return {sourceLayout:source.sourceLayout,...(current?{current}:{}),...(Object.keys(scenes).length?{scenes}:{})}
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

function mapLaneY(scene:MainlineSceneDefinition,y:number) {
  const nextLane=scene.rooms.find(room=>room.id===laneId)!.bounds
  const old=[legacyLane.y,legacyMiningGridRooms[0]!.bounds.y,...legacyMiningGridRooms.map(room=>room.bounds.y+room.bounds.height),legacyLane.y+legacyLane.height]
  const next=[nextLane.y,scene.rooms.find(room=>room.id===legacyMiningGridRooms[0]!.id)!.bounds.y,...legacyMiningGridRooms.map(room=>{const b=scene.rooms.find(r=>r.id===room.id)!.bounds;return b.y+b.height}),nextLane.y+nextLane.height]
  const v=Math.max(old[0]!,Math.min(old.at(-1)!,y)),index=Math.max(0,Math.min(old.length-2,old.findIndex((end,i)=>i>0&&v<=end)-1))
  return next[index]!+fraction(v,old[index]!,old[index+1]!-old[index]!)*(next[index+1]!-next[index]!)
}

export function migrateMiningPositions({layoutVersion,worldGridVersion,currentSceneId,currentPosition,scenePositions,rooms:previousRooms,backup:previousBackup}:{layoutVersion:unknown;worldGridVersion:unknown;currentSceneId:MainlineSceneId;currentPosition:Point|null;scenePositions:Partial<Record<MainlineSceneId,Point>>;rooms?:MiningPositionRooms;backup?:MiningPositionBackup}) {
  const version=typeof layoutVersion==='number'&&Number.isInteger(layoutVersion)&&layoutVersion>=currentMiningLayoutVersion?layoutVersion:currentMiningLayoutVersion
  const currentSchema=typeof layoutVersion==='number'&&Number.isInteger(layoutVersion)&&layoutVersion>=currentMiningLayoutVersion
  const knownGridLegacy=layoutVersion===1||worldGridVersion===1
  const scenes={...scenePositions},owners:MiningPositionRooms={scenes:{...previousRooms?.scenes}},memo=new Map<string,{point:Point;owner:string}>()
  const backup:MiningPositionBackup|undefined=currentSchema?previousBackup:{sourceLayout:knownGridLegacy?'grid-v1':'unknown-legacy',...previousBackup,scenes:{...previousBackup?.scenes}}
  const migrate=(id:MiningSceneId,source:Point,hint?:string)=>{
    const key=`${id}:${source.x}:${source.y}:${hint??''}`,cached=memo.get(key);if(cached)return cached
    const scene=mainlineScenes[id]
    if(currentSchema){const result={point:{...source},owner:currentMiningRoomId(id,source)??hint??laneId};memo.set(key,result);return result}
    let owner:string,mapped:Point
    if(!knownGridLegacy){
      // No reliable coordinate epoch: use the named scene/explicit ownership,
      // never infer an arbitrary room from ambiguous numbers.
      owner=hint&&ownedRoomIds.has(hint)?hint:id==='yonghe-eatery'?'mining-shop-2-interior':laneId
      mapped=owner===laneId?scene.initialPlayerPosition:scene.passages.find(p=>p.toRoomId===owner&&p.access==='open')!.crossingTargets[0]
    }else{
      const old=worldGridVersion===1?source:migratePreGridPosition(id,source)
      const hinted=legacyMiningGridRooms.find(room=>room.id===hint&&closedInside(old,room.bounds))
      const room=hinted??(old.x<legacyLane.x?legacyMiningGridRooms.find(room=>inside(old,room.bounds)):undefined)
      if(room){const next=scene.rooms.find(candidate=>candidate.id===room.id)!.bounds;owner=room.id;mapped={x:next.x+fraction(old.x,room.bounds.x,room.bounds.width)*next.width,y:next.y+fraction(old.y,room.bounds.y,room.bounds.height)*next.height}}
      else{owner=laneId;const next=scene.rooms.find(room=>room.id===laneId)!.bounds;mapped={x:next.x+fraction(old.x,legacyLane.x,legacyLane.width)*next.width,y:mapLaneY(scene,old.y)}}
    }
    const result={point:recoverOwned(scene,owner,mapped),owner};memo.set(key,result);return result
  }
  for(const id of ['yonghe-mining-perimeter','yonghe-eatery'] as const){const source=scenes[id];if(!source)continue;const result=migrate(id,source,previousRooms?.scenes?.[id]);scenes[id]=result.point;owners.scenes![id]=result.owner;if(!currentSchema)backup!.scenes![id]??={...source}}
  let current=currentPosition
  if(isMiningSceneId(currentSceneId)&&current){const result=migrate(currentSceneId,current,previousRooms?.current);owners.current=result.owner;if(!currentSchema)backup!.current??={sceneId:currentSceneId,position:{...current}};current=result.point}
  const hasOwners=!!owners.current||Object.keys(owners.scenes??{}).length>0
  const hasBackup=!!backup?.current||Object.keys(backup?.scenes??{}).length>0
  return {version,currentPosition:current,scenePositions:scenes,rooms:hasOwners?owners:undefined,backup:hasBackup?backup:undefined}
}
