import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { mainlineMapLayout, type MainlineSceneGeometryUnit } from './mainlineScenes'
import { phoneMapZoomScales, stepPhoneMapZoom, type PhoneMapRegion, type PhoneMapZoomLevel } from './phoneMapModel'
import type { PhoneDevice } from './phoneState'
type MapPoint = readonly [number, number]
type MapDragState = { active: boolean; moved: boolean; pointerId: number; start: MapPoint | null; origin: MapPoint | null }
export function PhoneMapCanvas({ mapRegions, displayDevice, currentLandmark, selectedMapPlaceId, onSelect, mapZoom, setMapZoom, mapPan, setMapPan, localViewBox, geometry, focusId }: {
 focusId?:string|null; localViewBox?:string; geometry?:readonly MainlineSceneGeometryUnit[];
 mapRegions: readonly PhoneMapRegion[]; displayDevice: PhoneDevice; currentLandmark: { device: PhoneDevice; id:string } | null; selectedMapPlaceId:string|null; onSelect:(id:string)=>void;
 mapZoom:PhoneMapZoomLevel; setMapZoom:React.Dispatch<React.SetStateAction<PhoneMapZoomLevel>>; mapPan:MapPoint; setMapPan:React.Dispatch<React.SetStateAction<MapPoint>>
}) {
 const viewportRef=useRef<HTMLDivElement>(null)
 const focusPoint=mapRegions.flatMap(r=>[r,...r.pois]).find(p=>p.id===focusId)?.position
 useLayoutEffect(()=>{
  const viewport=viewportRef.current
  if (!focusId || !focusPoint || !viewport) return
  const centerFocus=()=>{
   // Layout dimensions exclude the App opening transform. Refit when the
   // details sheet changes the space available to the shared map viewport.
   const pixelScale=Math.min(viewport.clientWidth/100,viewport.clientHeight/78)
   setMapPan([(50-focusPoint[0])*pixelScale*phoneMapZoomScales[mapZoom],(39-focusPoint[1])*pixelScale*phoneMapZoomScales[mapZoom]])
  }
  centerFocus()
  const observer=new ResizeObserver(centerFocus)
  observer.observe(viewport)
  return ()=>observer.disconnect()
 },[focusId,focusPoint?.[0],focusPoint?.[1],mapZoom,setMapPan])
 useLayoutEffect(()=>{ if(mapZoom===0 && !focusId)setMapPan([0,0]) },[mapZoom,focusId,setMapPan])
 useEffect(()=>{
  const viewport=viewportRef.current
  if(!viewport)return
  const wheel=(event:WheelEvent)=>{event.preventDefault();if(Math.abs(event.deltaY)>=1)setMapZoom(current=>stepPhoneMapZoom(current,event.deltaY<0?1:-1))}
  viewport.addEventListener('wheel',wheel,{passive:false})
  return ()=>viewport.removeEventListener('wheel',wheel)
 },[setMapZoom])
 const mapDragRef = useRef<MapDragState>({ active:false,moved:false,pointerId:-1,start:null,origin:null })
 const mapPointersRef = useRef(new Map<number,MapPoint>())
 const mapPinchRef = useRef<{distance:number;zoom:PhoneMapZoomLevel}|null>(null)
  const handleMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0) return
    mapPointersRef.current.set(event.pointerId, [event.clientX, event.clientY])
    if (mapPointersRef.current.size >= 2) {
      const [first, second] = [...mapPointersRef.current.values()]
      mapPinchRef.current = { distance: Math.hypot(first[0] - second[0], first[1] - second[1]), zoom: mapZoom }
      mapDragRef.current.active = false
      return
    }
    mapDragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      start: [event.clientX, event.clientY],
      origin: mapPan,
    }
  }

  const handleMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mapPointersRef.current.has(event.pointerId)) mapPointersRef.current.set(event.pointerId, [event.clientX, event.clientY])
    if (mapPointersRef.current.size >= 2 && mapPinchRef.current) {
      mapDragRef.current.moved = true
      const [first, second] = [...mapPointersRef.current.values()]
      const start = mapPinchRef.current
      const distance = Math.hypot(first[0] - second[0], first[1] - second[1])
      const ratio = distance / Math.max(1, start.distance)
      if (ratio > 1.18) setMapZoom(stepPhoneMapZoom(start.zoom, 1))
      else if (ratio < .82) setMapZoom(stepPhoneMapZoom(start.zoom, -1))
      return
    }
    const drag = mapDragRef.current
    if (!drag.active || drag.pointerId !== event.pointerId || !drag.start || !drag.origin) return
    const deltaX = event.clientX - drag.start[0]
    const deltaY = event.clientY - drag.start[1]
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) { drag.moved = true; event.currentTarget.setPointerCapture(event.pointerId) }
    setMapPan([drag.origin[0] + deltaX, drag.origin[1] + deltaY])
  }

  const handleMapPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    mapPointersRef.current.delete(event.pointerId)
    if (mapPointersRef.current.size < 2) mapPinchRef.current = null
    const drag = mapDragRef.current
    if (drag.pointerId !== event.pointerId) return
    drag.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (drag.moved) window.requestAnimationFrame(() => { drag.moved = false })
  }

  const handleMapLandmarkClick = (landmarkId: string) => {
    if (mapDragRef.current.moved) {
      mapDragRef.current.moved = false
      return
    }
    onSelect(landmarkId)
  }




return <>
    <div
      className="world-phone__map-viewport" ref={viewportRef}
      onPointerDown={handleMapPointerDown}
      onPointerMove={handleMapPointerMove}
      onPointerUp={handleMapPointerUp}
      onPointerCancel={handleMapPointerUp}

    >
    <svg className="world-phone__map" viewBox={localViewBox ?? mainlineMapLayout.viewBox} role="group" aria-label="世界地图，拖动查看，滚轮、双指或按钮缩放，点击区域和地点查看详情" data-map-world={displayDevice} data-map-zoom-level={mapZoom} style={{ transform: `translate(${mapPan[0]}px, ${mapPan[1]}px) scale(${phoneMapZoomScales[mapZoom]})` }}>
      {geometry?.filter(unit=>unit.visual.kind!=="none").map(unit=><rect key={unit.id} x={unit.x} y={unit.y} width={unit.width} height={unit.height} fill="#ffffff10" stroke="#ffffff35" strokeWidth=".15" />)}
      {mapRegions.map((region) => {
        const active = currentLandmark?.device === displayDevice && region.id === currentLandmark.id
        const [x, y] = region.position
        const selected = selectedMapPlaceId === region.id
        return (
          <g key={region.id}>
            {!localViewBox && <rect className={`world-phone__map-region-field world-phone__map-region-field--${region.id} ${active ? 'is-active' : ''}`} x={x - 9} y={y - 6} width="18" height="12" rx="1.5" />}
            <g
              className={`world-phone__map-region ${active ? 'is-active' : ''} ${selected ? 'is-selected' : ''}`}
              data-map-region={region.id}
              data-scene-id={region.sceneId}
              data-map-interactive="true"
              role="button"
              tabIndex={0}
              aria-label={`${region.label}区域，点击查看详情`}
              onClick={() => handleMapLandmarkClick(region.id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleMapLandmarkClick(region.id) } }}
            >
              <rect x={x-7} y={y-7} width="14" height="16" fill="transparent" />
              <circle className="world-phone__map-region-dot" cx={x} cy={y} r={localViewBox ? .8 : 1.6} />
              <text className="world-phone__map-region-label" x={x} y={y + 5} textAnchor="middle">{region.label}</text>
            </g>
            {mapZoom > 0 && region.pois.map((poi) => {
              const [poiX, poiY] = poi.position
              const poiActive = selectedMapPlaceId === poi.id
              return (
                <g key={poi.id}>
                <line className="world-phone__map-region-link" x1={x} y1={y} x2={poiX} y2={poiY} />
                <g
                  className={`world-phone__map-poi ${poiActive ? 'is-selected' : ''}`}
                  data-map-poi={poi.id}
                  data-map-poi-region={region.id}
                  data-scene-id={poi.sceneId}
                  data-map-interactive="true"
                  role="button"
                  tabIndex={0}
                  aria-label={`${poi.label}，位于${region.label}，点击查看详情`}
                  onClick={() => handleMapLandmarkClick(poi.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleMapLandmarkClick(poi.id) } }}
                >
                  <circle className="world-phone__map-poi-halo" cx={poiX} cy={poiY} r="2.7" />
                  <circle className="world-phone__map-poi-dot" cx={poiX} cy={poiY} r="1.25" />
                  <text className="world-phone__map-poi-label" x={poiX} y={poiY - 3.8} textAnchor="middle">{poi.label}</text>
                </g>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
    </div>
    <div className="world-phone__map-controls" role="group" aria-label="地图缩放">
      <button type="button" aria-label="放大地图" onClick={() => setMapZoom((current) => stepPhoneMapZoom(current, 1))}>+</button>
      <span>{mapZoom === 0 ? '区域' : mapZoom === 1 ? '地点' : '近看'}</span>
      <button type="button" aria-label="缩小地图" onClick={() => setMapZoom((current) => stepPhoneMapZoom(current, -1))}>−</button>
    </div>

</>
}
