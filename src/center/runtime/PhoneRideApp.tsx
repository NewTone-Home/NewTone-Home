import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PhoneMapCanvas } from './PhoneMapCanvas'
import { mainlineScenes, type MainlineSceneId } from './mainlineScenes'
import { phoneRideMapTargetZones } from './phoneRideMapModel'
import { mainlineRideNavigationGoal, type MainlineRideOrder, type MainlineRideVehicle, type MainlineRideRequestResult } from './mainlineRide'
import { type PhoneMapRegion, type PhoneMapZoomLevel } from './phoneMapModel'
import type { PhoneDevice } from './phoneState'
import type { MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import type { MainlineStoryClock } from './mainlineStoryClock'
import { phoneDriverDistanceLabel, phoneDriverEtaLabel, phoneRideTripEstimate } from './phoneRidePresentation'
type Point={x:number;y:number}
export function PhoneRideApp({regions,device,currentLandmark,currentSceneId,order,clock,storyClock,available,online,destinationId,onDestination,onConfirm,getPosition,getRideMapSnapshot}:{
 regions:readonly PhoneMapRegion[];device:PhoneDevice;currentLandmark:{device:PhoneDevice;id:string}|null;currentSceneId:MainlineSceneId;order:MainlineRideOrder|null;clock:number;storyClock:MainlineStoryClock;available:boolean;online:boolean;destinationId:string|null;onDestination:(id:string)=>void;onConfirm:(sceneId:MainlineSceneId,presentation:{vehicle:MainlineRideVehicle;arrivalLabel?:string})=>MainlineRideRequestResult|void;getPosition?:()=>Point|null;getRideMapSnapshot?:()=>MainlineSceneGeometrySnapshot|null
}) {
 const destinations=regions.filter(region=>region.sceneId && region.id!==currentLandmark?.id)
 const destination=destinations.find(region=>region.id===destinationId) ?? null
 const estimate = phoneRideTripEstimate(currentLandmark?.id, destination?.id ?? null, storyClock)
 const [zoom,setZoom]=useState<PhoneMapZoomLevel>(1)
 const [pan,setPan]=useState<readonly [number,number]>([0,0])
 const [sheetExpanded,setSheetExpanded]=useState(false)
 const sheetRef=useRef<HTMLDivElement>(null)
 const [sheetHeight,setSheetHeight]=useState(0)
 useLayoutEffect(()=>{
  const sheet=sheetRef.current
  if(!sheet)return
  const observer=new ResizeObserver(()=>setSheetHeight(sheet.offsetHeight))
  observer.observe(sheet)
  return()=>observer.disconnect()
 },[])
 const sheetDragStart=useRef<number|null>(null)
 const sheetDragged=useRef(false)
 const [vehicle,setVehicle]=useState<MainlineRideVehicle|null>(null)
 const [error,setError]=useState('')
 const onConfirmRef=useRef(onConfirm)
 useEffect(()=>{onConfirmRef.current=onConfirm},[onConfirm])
 const [request,setRequest]=useState<{sceneId:MainlineSceneId;vehicle:MainlineRideVehicle;arrivalLabel?:string}|null>(null)
 useEffect(()=>{
  if (!request) return
  const timer=window.setTimeout(()=>{const {sceneId,...presentation}=request;const result=onConfirmRef.current(sceneId,presentation);if(!result?.ok)setError(result?.reason ?? '叫车未成功，请重试');setRequest(null)},1000)
  return ()=>window.clearTimeout(timer)
 },[request])
 return <section className="world-phone__ride-page" aria-label="叫车">
  <div className="world-phone__ride-map-stage" data-ride-map-stage={order ? 'order' : 'selection'} key={order ? 'ride-order-map' : 'ride-selection-map'}>
   {order ? <PhoneRideLocalMap waitingSceneId={order.sourceSceneId} sceneId={currentSceneId} getPosition={getPosition} getSnapshot={getRideMapSnapshot} coveredHeight={sheetHeight} /> : <PhoneMapCanvas mapRegions={regions} displayDevice={device} currentLandmark={currentLandmark} selectedMapPlaceId={destinationId} onSelect={id=>{if(destinations.some(d=>d.id===id)) {onDestination(id);setVehicle(null)}}} mapZoom={zoom} setMapZoom={setZoom} mapPan={pan} setMapPan={setPan} focusId={destinationId} coveredHeight={sheetHeight} regionsOnly slowDestinationTravel />}
  </div>
  <div ref={sheetRef} className="world-phone__ride-sheet" data-expanded={sheetExpanded}>
   <button className="world-phone__sheet-handle" aria-label={sheetExpanded?'收起叫车面板':'展开叫车面板'} aria-expanded={sheetExpanded}
    onPointerDown={event=>{sheetDragStart.current=event.clientY;sheetDragged.current=false;event.currentTarget.setPointerCapture(event.pointerId)}}
    onPointerUp={event=>{const start=sheetDragStart.current;sheetDragStart.current=null;if(start!==null && Math.abs(event.clientY-start)>24){sheetDragged.current=true;setSheetExpanded(event.clientY<start)}if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}}
    onPointerCancel={()=>{sheetDragStart.current=null;sheetDragged.current=false}}
    onClick={()=>{if(sheetDragged.current){sheetDragged.current=false;return}setSheetExpanded(value=>!value)}}><span className="world-phone__sheet-grip" /></button>
   {order ? <div data-ride-order="true" aria-live="polite"><div className="world-phone__ride-order-state" key={clock<order.driverArrivesAt?'driver-enroute':'driver-arrived'}><h3>{clock<order.driverArrivesAt?'司机正在路上':'司机已到达'}</h3><dl className="world-phone__ride-summary">
    {clock<order.driverArrivesAt && <><div><dt>司机预计到达</dt><dd>{phoneDriverEtaLabel(order.driverArrivesAt,clock)}</dd></div><div><dt>距离</dt><dd>{phoneDriverDistanceLabel(order.driverArrivesAt,clock)}</dd></div></>}
    <div><dt>车型</dt><dd>{order.vehicle ?? '未记录'}</dd></div><div><dt>目的地</dt><dd>{regions.find(r=>r.sceneId===order.targetSceneId)?.label ?? '目的地'}</dd></div><div><dt>预计抵达目的地</dt><dd>{order.arrivalLabel ? `${order.arrivalLabel} 左右` : '未记录'}</dd></div></dl></div></div> : !online ? <p>当前无网络，无法叫车</p> : !available ? <p>服务暂未开通</p> : <>
    <h3>{destination?`前往${destination.label}`:'选择目的地'}</h3>
    {!destination ? destinations.map(d=><button className="world-phone__ride-destination" key={d.id} onClick={()=>{onDestination(d.id);setVehicle(null)}}><span><strong>{d.label}</strong><small>从当前位置出发</small></span><span>›</span></button>) : <>
     {estimate && <p className="world-phone__ride-estimate" data-trip-minutes={estimate.minutes}><strong>预计 {estimate.arrivalLabel} 左右到达</strong><span>车程约 {estimate.minutes} 分钟</span></p>}
     <button className="world-phone__ride-change" disabled={Boolean(request)} onClick={()=>{onDestination('');setVehicle(null);setError('')}}><span aria-hidden="true">⇄ </span>更换目的地</button>
     <div className="world-phone__vehicles">{(['快车','舒适型','商务型'] as const).map(name=><button key={name} disabled={Boolean(request)} aria-pressed={vehicle===name} onClick={()=>{setVehicle(name);setError('')}}><svg viewBox="0 0 60 30" aria-hidden="true"><path d="M5 22v-9h8l7-8h23l7 8h6v9h-6a5 5 0 0 1-10 0H20a5 5 0 0 1-10 0Z M18 13h29" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="15" cy="22" r="3" fill="currentColor"/><circle cx="45" cy="22" r="3" fill="currentColor"/></svg><strong>{name}</strong><small>{estimate ? `车程约 ${estimate.minutes} 分钟` : '车程待确认'}</small><small>预计费用 --</small></button>)}</div>
     {error && <p role="alert" className="world-phone__ride-error">{error}</p>}
     <button className="world-phone__list-action" disabled={!vehicle || Boolean(request)} onClick={()=>{if(destination.sceneId && vehicle){setError('');setRequest({sceneId:destination.sceneId,vehicle,...(estimate?{arrivalLabel:estimate.arrivalLabel}:{})})}}}>{request?'正在叫车…':'确认叫车'}</button>
    </>}
   </>}
  </div>
 </section>
}
function PhoneRideLocalMap({sceneId,waitingSceneId,getPosition,getSnapshot,coveredHeight}:{sceneId:MainlineSceneId;waitingSceneId:MainlineSceneId;getPosition?:()=>Point|null;getSnapshot?:()=>MainlineSceneGeometrySnapshot|null;coveredHeight:number}) {
 const scene=mainlineScenes[sceneId]
 const pickup=mainlineRideNavigationGoal(sceneId,waitingSceneId) ?? undefined
 const [position,setPosition]=useState(()=>getPosition?.() ?? scene.initialPlayerPosition)
 const [zoom,setZoom]=useState<PhoneMapZoomLevel>(sceneId==='commercial-cafe'?1.15:2)
 const [pan,setPan]=useState<readonly [number,number]>([0,0])
 const viewportRef=useRef<HTMLDivElement>(null)
 const [viewportSize,setViewportSize]=useState({width:0,height:0})
 const [snapshot,setSnapshot]=useState(()=>getSnapshot?.() ?? null)
 const previousSceneId=useRef(sceneId)
 const positionRef=useRef(position)
 useEffect(()=>{if(previousSceneId.current===sceneId)return;previousSceneId.current=sceneId;const next=getPosition?.() ?? mainlineScenes[sceneId].initialPlayerPosition;positionRef.current=next;setPosition(next);setZoom(sceneId==='commercial-cafe'?1.15:2);setPan([0,0])},[sceneId,getPosition])
 useEffect(()=>{const next=getSnapshot?.();if(next?.sceneId===sceneId)setSnapshot(next)},[getSnapshot,sceneId,viewportSize.width,viewportSize.height])
 useEffect(()=>{let frame=0;const paint=()=>{const next=getPosition?.();if(next&&(positionRef.current.x!==next.x||positionRef.current.y!==next.y)){positionRef.current=next;setPosition(next);const updated=getSnapshot?.();if(updated?.sceneId===sceneId)setSnapshot(updated)}frame=requestAnimationFrame(paint)};frame=requestAnimationFrame(paint);return()=>cancelAnimationFrame(frame)},[getPosition,getSnapshot,sceneId])
 useLayoutEffect(()=>{const viewport=viewportRef.current;if(!viewport)return;const update=()=>setViewportSize({width:viewport.clientWidth,height:viewport.clientHeight});update();const observer=new ResizeObserver(update);observer.observe(viewport);return()=>observer.disconnect()},[])
 const bounds=snapshot?.sceneId===sceneId?snapshot.walkBounds:scene.walkBounds
 const regions:PhoneMapRegion[]=[{id:'player',glyph:'●',label:'',position:[position.x,position.y],detail:'',pois:[]}]
 const scale=Math.min(viewportSize.width/bounds.width,viewportSize.height/bounds.height)
 const dx=pickup?(pickup.x-position.x)*scale*zoom:0,dy=pickup?(pickup.y-position.y)*scale*zoom:0
 const centerY=(viewportSize.height-coveredHeight)/2
 const safeX=Math.max(16,viewportSize.width/2-14),safeY=Math.max(16,(viewportSize.height-coveredHeight)/2-18)
 const ray=Math.max(Math.abs(dx)/Math.max(1,safeX),Math.abs(dy)/Math.max(1,safeY))
 const edge=pickup&&ray>1?{x:viewportSize.width/2+dx/ray,y:centerY+dy/ray,angle:Math.atan2(dy,dx)*180/Math.PI+90}:null
 const mapGeometry=snapshot?.sceneId===sceneId?snapshot.units:scene.geometry
 const targetZones=phoneRideMapTargetZones(scene,sceneId,waitingSceneId,bounds)
 return <div ref={viewportRef} className="world-phone__ride-local-map" data-ride-map-scene={sceneId}>
  <div className="world-phone__ride-map-scene" key={sceneId}>
   <PhoneMapCanvas mapRegions={regions} displayDevice="inner" currentLandmark={{device:'inner',id:'player'}} selectedMapPlaceId={null} onSelect={()=>{}} mapZoom={zoom} setMapZoom={setZoom} mapPan={pan} setMapPan={setPan} localViewBox={bounds.x+' '+bounds.y+' '+bounds.width+' '+bounds.height} geometry={mapGeometry} localMapObjects={[]} localMapPassages={[]} localMapZones={targetZones} focusId="player" coveredHeight={coveredHeight} regionsOnly followFocus hideMarkerLabels={['player']} />
  </div>
  {edge&&<span className="world-phone__ride-map-edge" aria-label="Ride target direction" style={{left:edge.x,top:edge.y,transform:'translate(-50%,-50%) rotate('+edge.angle+'deg)'}}>↑</span>}
 </div>
}
