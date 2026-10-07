import { useEffect, useRef, useState } from 'react'
import { PhoneMapCanvas } from './PhoneMapCanvas'
import { mainlineScenes, type MainlineSceneId } from './mainlineScenes'
import { mainlineRidePickupPositions, mainlineRideWaitingGuidance, type MainlineRideOrder } from './mainlineRide'
import { type PhoneMapRegion, type PhoneMapZoomLevel } from './phoneMapModel'
import type { PhoneDevice } from './phoneState'
type Point={x:number;y:number}
export function PhoneRideApp({regions,device,currentLandmark,currentSceneId,order,clock,available,online,destinationId,onDestination,onConfirm,getPosition,estimateEtaMs}:{
 regions:readonly PhoneMapRegion[];device:PhoneDevice;currentLandmark:{device:PhoneDevice;id:string}|null;currentSceneId:MainlineSceneId;order:MainlineRideOrder|null;clock:number;available:boolean;online:boolean;destinationId:string|null;onDestination:(id:string)=>void;onConfirm:(sceneId:MainlineSceneId)=>void;getPosition?:()=>Point|null;estimateEtaMs?:()=>number|null
}) {
 const destinations=regions.filter(region=>region.sceneId && region.id!==currentLandmark?.id)
 const destination=destinations.find(region=>region.id===destinationId) ?? null
 const [estimatedEtaMs] = useState(() => estimateEtaMs?.() ?? null)
 const [zoom,setZoom]=useState<PhoneMapZoomLevel>(0)
 const [pan,setPan]=useState<readonly [number,number]>([0,0])
 const [sheetExpanded,setSheetExpanded]=useState(false)
 const sheetDragStart=useRef<number|null>(null)
 const sheetDragged=useRef(false)
 const [vehicle,setVehicle]=useState<string|null>(null)
 const onConfirmRef=useRef(onConfirm)
 useEffect(()=>{onConfirmRef.current=onConfirm},[onConfirm])
 const [request,setRequest]=useState<MainlineSceneId|null>(null)
 useEffect(()=>{
  if (!request) return
  const timer=window.setTimeout(()=>{onConfirmRef.current(request);setRequest(null)},1000)
  return ()=>window.clearTimeout(timer)
 },[request])
 return <section className="world-phone__ride-page" aria-label="叫车">
  {order ? <PhoneRideLocalMap waitingSceneId={order.sourceSceneId} sceneId={currentSceneId} getPosition={getPosition} /> : <PhoneMapCanvas mapRegions={regions} displayDevice={device} currentLandmark={currentLandmark} selectedMapPlaceId={destinationId} onSelect={id=>{if(destinations.some(d=>d.id===id)) {onDestination(id);setVehicle(null)}}} mapZoom={zoom} setMapZoom={setZoom} mapPan={pan} setMapPan={setPan} />}
  <div className="world-phone__ride-sheet" data-expanded={sheetExpanded}>
   <button className="world-phone__sheet-handle" aria-label={sheetExpanded?'收起叫车面板':'展开叫车面板'} aria-expanded={sheetExpanded}
    onPointerDown={event=>{sheetDragStart.current=event.clientY;sheetDragged.current=false;event.currentTarget.setPointerCapture(event.pointerId)}}
    onPointerUp={event=>{const start=sheetDragStart.current;sheetDragStart.current=null;if(start!==null && Math.abs(event.clientY-start)>24){sheetDragged.current=true;setSheetExpanded(event.clientY<start)}if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}}
    onPointerCancel={()=>{sheetDragStart.current=null;sheetDragged.current=false}}
    onClick={()=>{if(sheetDragged.current){sheetDragged.current=false;return}setSheetExpanded(value=>!value)}}><span className="world-phone__sheet-grip" /></button>
   {order ? <div data-ride-order="true" aria-live="polite"><strong>{clock<order.driverArrivesAt?`司机预计 ${Math.ceil((order.driverArrivesAt-clock)/1000)} 秒后到达`:`司机已到达，正在${mainlineRideWaitingGuidance(order.sourceSceneId).waitingLabel}等候`}</strong><p>{mainlineRideWaitingGuidance(order.sourceSceneId).guidanceText}</p></div> : !online ? <p>当前无网络，无法叫车</p> : !available ? <p>服务暂未开通</p> : <>
    <h3>{destination?`前往${destination.label}`:'选择目的地'}</h3>
    {!destination ? destinations.map(d=><button className="world-phone__ride-destination" key={d.id} onClick={()=>{onDestination(d.id);setVehicle(null)}}><span><strong>{d.label}</strong><small>从当前位置出发</small></span><span>›</span></button>) : <>
     <button className="world-phone__ride-change" onClick={()=>{onDestination('');setVehicle(null)}}>更换目的地</button>
     <div className="world-phone__vehicles">{['快车','舒适型','商务型'].map(name=><button key={name} aria-pressed={vehicle===name} onClick={()=>setVehicle(name)}><svg viewBox="0 0 60 30" aria-hidden="true"><path d="M5 22v-9h8l7-8h23l7 8h6v9h-6a5 5 0 0 1-10 0H20a5 5 0 0 1-10 0Z M18 13h29" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="15" cy="22" r="3" fill="currentColor"/><circle cx="45" cy="22" r="3" fill="currentColor"/></svg><strong>{name}</strong><small>{estimatedEtaMs === null ? '到达时间待确认' : `预计 ${Math.max(1, Math.ceil(estimatedEtaMs / 60000))} 分钟`}</small><small>预计费用 --</small></button>)}</div>
     <button className="world-phone__list-action" disabled={!vehicle || Boolean(request)} onClick={()=>{if(destination.sceneId)setRequest(destination.sceneId)}}>{request?'正在叫车…':'确认叫车'}</button>
    </>}
   </>}
  </div>
 </section>
}
function PhoneRideLocalMap({sceneId,waitingSceneId,getPosition}:{sceneId:MainlineSceneId;waitingSceneId:MainlineSceneId;getPosition?:()=>Point|null}) {
 const scene=mainlineScenes[sceneId]
 const waitingScene=mainlineScenes[waitingSceneId]
 const offset=sceneId===waitingSceneId?0:scene.walkBounds.x+scene.walkBounds.width+20-waitingScene.walkBounds.x
 const pickups=mainlineRidePickupPositions(waitingSceneId).map(p=>({x:p.x+offset,y:p.y}))
 const geometry=sceneId===waitingSceneId?scene.geometry:[...scene.geometry,...waitingScene.geometry.map(unit=>({...unit,id:`waiting-${unit.id}`,x:unit.x+offset}))]
 const [position,setPosition]=useState(()=>getPosition?.() ?? scene.initialPlayerPosition)
 const [zoom,setZoom]=useState<PhoneMapZoomLevel>(0)
 const [pan,setPan]=useState<readonly [number,number]>([0,0])
 useEffect(()=>{let frame=0;const paint=()=>{const next=getPosition?.();if(next)setPosition(old=>old.x===next.x&&old.y===next.y?old:next);frame=requestAnimationFrame(paint)};frame=requestAnimationFrame(paint);return()=>cancelAnimationFrame(frame)},[getPosition])
 // A geographic inset shares the Phone map gestures. Points come from the actual scene and exit owner.
 const [fitPoints]=useState(()=>[position,...pickups])
 const left=Math.min(...fitPoints.map(p=>p.x))-12,top=Math.min(...fitPoints.map(p=>p.y))-12
 const width=Math.max(35,Math.max(...fitPoints.map(p=>p.x))-left+12),height=Math.max(35,Math.max(...fitPoints.map(p=>p.y))-top+12)
 const regions:PhoneMapRegion[]=[{id:'player',glyph:'●',label:'你',position:[position.x,position.y],detail:'',pois:[]},...pickups.map((p,i)=>({id:`exit-${i}`,glyph:'○',label:mainlineRideWaitingGuidance(waitingSceneId).waitingLabel,position:[p.x,p.y] as const,detail:'',pois:[]}))]
 return <PhoneMapCanvas mapRegions={regions} displayDevice="inner" currentLandmark={{device:'inner',id:'player'}} selectedMapPlaceId={null} onSelect={()=>{}} mapZoom={zoom} setMapZoom={setZoom} mapPan={pan} setMapPan={setPan} localViewBox={`${left} ${top} ${width} ${height}`} geometry={geometry} />
}
