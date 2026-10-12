import { useEffect, useLayoutEffect, useRef, useState, useId, type Dispatch, type SetStateAction, type PointerEvent } from 'react'
import { mainlineMapLayout, type MainlineSceneGeometryUnit } from './mainlineScenes'
import { clampPhoneMapZoom, phoneMapZoomBounds, phoneMapTransitLinks, phoneMapRegionContours, phoneMapVisiblePlaces, stepPhoneMapZoom, type PhoneMapPoint, type PhoneMapRegion } from './phoneMapModel'
import type { PhoneDevice } from './phoneState'
import { phoneRideMapTargetGradient } from './phoneRideMapModel'

type Point = PhoneMapPoint
type LocalMapShape = { id: string; kind?: string; bounds: { x: number; y: number; width: number; height: number }; fillBounds?: { x: number; y: number; width: number; height: number }; fadeTowardTarget?: boolean }
type Props = {
  mapRegions: readonly PhoneMapRegion[]; displayDevice: PhoneDevice
  currentLandmark: { device: PhoneDevice; id: string } | null
  selectedMapPlaceId: string | null; onSelect: (id: string) => void
  mapZoom: number; setMapZoom: Dispatch<SetStateAction<number>>
  mapPan: Point; setMapPan: Dispatch<SetStateAction<Point>>
  localViewBox?: string; geometry?: readonly MainlineSceneGeometryUnit[]
  localMapObjects?: readonly LocalMapShape[]; localMapPassages?: readonly LocalMapShape[]; localMapZones?: readonly LocalMapShape[]
  focusId?: string | null; coveredHeight?: number; onBlank?: () => void
  restoreOnBlank?: boolean; regionsOnly?: boolean; slowDestinationTravel?: boolean
  followFocus?: boolean
  unhideMarkerLabels?: readonly string[]
  hideMarkerLabels?: readonly string[]
}
export function PhoneMapCanvas({ mapRegions, displayDevice, currentLandmark, selectedMapPlaceId, onSelect, mapZoom, setMapZoom, mapPan, setMapPan, localViewBox, geometry, localMapObjects = [], localMapPassages = [], localMapZones = [], focusId, coveredHeight = 0, onBlank, restoreOnBlank = false, regionsOnly = false, slowDestinationTravel = false, followFocus = false, unhideMarkerLabels = [], hideMarkerLabels = [] }: Props) {
  const mapId = useId().replace(/:/g, '')
  const viewportRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const [controlBounds,setControlBounds]=useState({left:Infinity,top:0,bottom:0})
  const [size, setSize] = useState({ width: 1, height: 1 })
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<{ start: Point; pan: Point; distance?: number; zoom: number } | null>(null)
  const suppressClick = useRef(false)
  const [dragging,setDragging]=useState(false)
  const [vx, vy, vw, vh] = (localViewBox ?? mainlineMapLayout.viewBox).split(' ').map(Number)
  const scale = Math.min(size.width / vw, size.height / vh)
  const focusPoint = mapRegions.flatMap(r => [r, ...r.pois]).find(p => p.id === focusId)?.position
  const coveredHeightRef=useRef(coveredHeight)
  coveredHeightRef.current=coveredHeight
  const cameraFrame=useRef(0)
  const previousFocus=useRef<string|null>(null)
  const beforeFocus=useRef<{zoom:number;pan:Point}|null>(null)
  const restorePending=useRef(false)
  const manualView=useRef(false)
  const [cameraMoving,setCameraMoving]=useState(false)
  const cancelCamera=()=>{cancelAnimationFrame(cameraFrame.current);setCameraMoving(false)}
  const manualCamera=()=>{cancelCamera();beforeFocus.current=null;restorePending.current=false;manualView.current=true}
  const zoomRef = useRef(mapZoom)
  zoomRef.current = mapZoom
  const project = ([x, y]: Point): Point => [size.width / 2 + (x - vx - vw / 2) * scale * mapZoom + mapPan[0], size.height / 2 + (y - vy - vh / 2) * scale * mapZoom + mapPan[1]]
  const boundPan = (pan: Point, zoom: number): Point => {
    const lx = Math.max(0, size.width / 2 + vw * scale * zoom / 2 - 44), ly = Math.max(0, size.height / 2 + vh * scale * zoom / 2 - 44)
    return [Math.max(-lx, Math.min(lx, pan[0])), Math.max(-ly, Math.min(ly, pan[1]))]
  }
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const update = () => {
      setSize({ width: viewport.clientWidth, height: viewport.clientHeight })
      const controls=controlsRef.current
      if(controls)setControlBounds({left:controls.offsetLeft-viewport.offsetLeft,top:controls.offsetTop-viewport.offsetTop,bottom:controls.offsetTop+controls.offsetHeight-viewport.offsetTop})
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (size.width <= 1) return
    if (followFocus && focusPoint) {
      cancelAnimationFrame(cameraFrame.current)
      manualView.current = false
      previousFocus.current = focusId ?? null
      const zoom = Math.max(1, Math.min(1.6, zoomRef.current))
      setMapZoom(zoom)
      setMapPan(boundPan([(vx + vw / 2 - focusPoint[0]) * scale * zoom, (vy + vh / 2 - focusPoint[1]) * scale * zoom - coveredHeightRef.current / 2], zoom))
      setCameraMoving(false)
      return
    }
    const restore = !focusId && restorePending.current ? beforeFocus.current : null
    restorePending.current=false
    if (!focusPoint || !focusId) {
      if (restoreOnBlank) previousFocus.current=null
      if (!restore) { cancelCamera(); return }
    } else {
      if (restoreOnBlank && !beforeFocus.current) beforeFocus.current={zoom:zoomRef.current,pan:mapPan}
      manualView.current=false
    }
    cancelAnimationFrame(cameraFrame.current)
    const zoom=restore?.zoom ?? Math.max(zoomRef.current,phoneMapZoomBounds.poi+.2)
    const panFor=(z:number):Point=>restore?.pan ?? boundPan([(vx+vw/2-focusPoint![0])*scale*z,(vy+vh/2-focusPoint![1])*scale*z-coveredHeightRef.current/2],z)
    const switching=previousFocus.current!==null && previousFocus.current!==focusId && !localViewBox
    previousFocus.current=focusId ?? null
    if (restore) beforeFocus.current=null
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setMapZoom(zoom);setMapPan(panFor(zoom));setCameraMoving(false);return}
    const overview=Math.min(zoomRef.current,1.05),ratio=overview/zoomRef.current
    const phases=switching?[
      {zoom:overview,pan:boundPan([mapPan[0]*ratio,mapPan[1]*ratio],overview),duration:slowDestinationTravel?320:180},
      {zoom:overview,pan:panFor(overview),duration:slowDestinationTravel?650:300},
      {zoom,pan:panFor(zoom),duration:slowDestinationTravel?350:220}
    ]:[{zoom,pan:panFor(zoom),duration:restore?350:220}]
    let origin={zoom:zoomRef.current,pan:mapPan},index=0,started:number|null=null
    setCameraMoving(true)
    const tick=(now:number)=>{
      if(started===null)started=now
      const phase=phases[index]; if(index>0 || !switching)phase.pan=panFor(phase.zoom)
      const t=Math.min(1,(now-started)/phase.duration),e=t*t*(3-2*t)
      setMapZoom(origin.zoom+(phase.zoom-origin.zoom)*e)
      setMapPan([origin.pan[0]+(phase.pan[0]-origin.pan[0])*e,origin.pan[1]+(phase.pan[1]-origin.pan[1])*e])
      if(t===1){origin=phase;index++;started=null}
      if(index<phases.length)cameraFrame.current=requestAnimationFrame(tick)
      else setCameraMoving(false)
    }
    cameraFrame.current=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(cameraFrame.current)
  },[focusId,focusPoint?.[0],focusPoint?.[1],size.width,size.height,vx,vy,vw,vh,scale,setMapZoom,setMapPan,followFocus])
  // Sheet resizing only adjusts the visible-area offset, never restarts a destination journey.
  useLayoutEffect(() => {
    if (!focusPoint || size.width <= 1 || cameraMoving) return
    setMapPan(boundPan([(vx+vw/2-focusPoint[0])*scale*zoomRef.current,(vy+vh/2-focusPoint[1])*scale*zoomRef.current-coveredHeight/2],zoomRef.current))
  },[coveredHeight])
  useEffect(() => {
    if (size.width <= 1) return
    setMapPan(current => {
      const bounded = boundPan(current, mapZoom)
      return bounded[0] === current[0] && bounded[1] === current[1] ? current : bounded
    })
  }, [mapZoom, size.width, size.height, scale, vw, vh, setMapPan])
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const wheel = (event: WheelEvent) => { event.preventDefault(); event.stopPropagation(); manualCamera(); setMapZoom(current => clampPhoneMapZoom(current * Math.exp(-event.deltaY * .002))) }
    viewport.addEventListener('wheel', wheel, { passive: false })
    return () => viewport.removeEventListener('wheel', wheel)
  }, [setMapZoom])
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0) return
    suppressClick.current = false
    pointers.current.set(event.pointerId, [event.clientX, event.clientY])
    const p = [...pointers.current.values()]
    gesture.current = { start: p.length === 2 ? [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2] : p[0], pan: mapPan, zoom: mapZoom, ...(p.length === 2 ? { distance: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) } : {}) }
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    pointers.current.set(event.pointerId, [event.clientX, event.clientY])
    const p = [...pointers.current.values()], start = gesture.current
    const center: Point = p.length === 2 ? [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2] : p[0]
    const dx = center[0] - start.start[0], dy = center[1] - start.start[1]
    if (Math.abs(dx) + Math.abs(dy) > 5 || p.length === 2) { manualCamera(); suppressClick.current = true; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId) }
    else return
    const zoom = start.distance && p.length === 2 ? clampPhoneMapZoom(start.zoom * Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) / Math.max(1, start.distance)) : mapZoom
    if (start.distance) setMapZoom(zoom)
    setMapPan(boundPan([start.pan[0] + dx, start.pan[1] + dy], zoom))
  }
  const up = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if(!pointers.current.size)setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const remaining = [...pointers.current.values()]
    gesture.current = remaining.length === 1 ? { start: remaining[0], pan: mapPan, zoom: mapZoom } : null
  }
  const labels: { x: number; y: number; width: number }[] = []
  const marker = (place: PhoneMapRegion | PhoneMapRegion['pois'][number], parent?: PhoneMapRegion) => {
    const [x, y] = project(place.position), poi = Boolean(parent), selected = selectedMapPlaceId === place.id
    const width = Math.max(44, place.label.length * 12 + 14)
    const labelRight = y >= controlBounds.top-25 && y <= controlBounds.bottom+25 ? Math.min(size.width-8,controlBounds.left-8) : size.width-8
    const labelX = x < 0 || x > size.width ? x : Math.max(width/2+8,Math.min(labelRight-width/2,x))
    const collision = !selected && !unhideMarkerLabels.includes(place.id) && labels.some(l => Math.abs(labelX - l.x) < (width + l.width) / 2 && Math.abs(y - l.y) < 38)
    const hideLabel = hideMarkerLabels.includes(place.id) || collision
    if (!hideLabel) labels.push({ x:labelX, y, width })
    return <button key={place.id} type="button" className={`world-phone__map-marker ${poi ? 'world-phone__map-poi' : 'world-phone__map-region'} ${selected ? 'is-selected' : ''} ${currentLandmark?.device === displayDevice && currentLandmark.id === place.id ? 'is-active' : ''}`}
      {...(poi ? { 'data-map-poi': place.id, 'data-map-poi-region': parent!.id } : { 'data-map-region': place.id })}
      data-scene-id={place.sceneId} data-map-interactive="true" aria-label={`${place.label}${poi ? `，位于${parent!.label}` : '区域'}，点击查看详情`}
      style={{ left: x, top: y }} onClick={() => { if (!suppressClick.current) onSelect(place.id) }}><i aria-hidden="true" />{!hideLabel && <span style={{transform:`translateX(${labelX-x}px)`}}>{place.label}</span>}</button>
  }
  const center:Point=[vx+vw/2-mapPan[0]/(scale*mapZoom),vy+vh/2-(mapPan[1]+coveredHeight/2)/(scale*mapZoom)]
  const places = phoneMapVisiblePlaces(mapRegions,mapZoom,center,manualView.current?null:focusId,regionsOnly || Boolean(localViewBox))
    .sort((a, b) => Number(b.place.id === selectedMapPlaceId) - Number(a.place.id === selectedMapPlaceId))
  return <>
    <div className="world-phone__map-viewport" data-dragging={dragging} data-camera-moving={cameraMoving} data-camera-follow={followFocus} ref={viewportRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={event => { if (!(event.target instanceof Element) || !event.target.closest('[data-map-interactive]')) { if (!suppressClick.current) { restorePending.current=restoreOnBlank && beforeFocus.current!==null;onBlank?.() } } }}>
      <svg className="world-phone__map" viewBox={localViewBox ?? mainlineMapLayout.viewBox} role="group" aria-label="世界地图，拖动查看，滚轮、双指或按钮缩放，点击区域和地点查看详情" data-map-world={displayDevice} data-map-zoom={mapZoom.toFixed(3)} style={{ transform: `translate(${mapPan[0]}px, ${mapPan[1]}px) scale(${mapZoom})` }}>
        {localMapZones.length > 0 && <defs>
          <clipPath id={`${mapId}-ride-map-frame`}>
            <rect x={vx} y={vy} width={vw} height={vh} />
          </clipPath>
          {localMapZones.map(zone => {
            const safeId = zone.id.replace(/[^a-zA-Z0-9_-]/g, '-')
            const floor = zone.fillBounds ?? zone.bounds
            const gradient = phoneRideMapTargetGradient(zone.bounds, floor)
            const blocked = geometry?.filter(unit => unit.navigation.blocked && !unit.visualOnly) ?? []
            const gradientFill = zone.fadeTowardTarget
              ? <linearGradient id={`${mapId}-${safeId}-gradient`} data-ride-target-gradient="true" gradientUnits="userSpaceOnUse" x1={gradient.x1} y1={gradient.y1} x2={gradient.x2} y2={gradient.y2}>
                  <stop offset="0%" stopColor="#52d99a" stopOpacity="0.34" />
                  <stop offset="52%" stopColor="#52d99a" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#52d99a" stopOpacity="0" />
                </linearGradient>
              : <radialGradient id={`${mapId}-${safeId}-gradient`} data-ride-target-gradient="true" gradientUnits="userSpaceOnUse" cx={zone.bounds.x + zone.bounds.width / 2} cy={zone.bounds.y + zone.bounds.height / 2} r={Math.max(1, Math.hypot(floor.width, floor.height) * .55)}>
                  <stop offset="0%" stopColor="#52d99a" stopOpacity="0.34" />
                  <stop offset="52%" stopColor="#52d99a" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#52d99a" stopOpacity="0" />
                </radialGradient>
            return <g key={`${zone.id}-defs`}>
              {gradientFill}
              <mask id={`${mapId}-${safeId}-floor-mask`} data-ride-target-floor-mask="true" maskUnits="userSpaceOnUse" x={floor.x} y={floor.y} width={floor.width} height={floor.height}>
                <rect x={floor.x} y={floor.y} width={floor.width} height={floor.height} fill="white" />
                {blocked.map(unit => <rect key={unit.id} x={unit.x} y={unit.y} width={unit.width} height={unit.height} fill="black" />)}
              </mask>
            </g>
          })}
        </defs>}
        {geometry?.filter(unit => unit.visual.kind !== 'none').map(unit => <rect key={unit.id} className={`world-phone__map-geometry world-phone__map-geometry--${unit.surface}`} data-map-geometry={unit.id} x={unit.x} y={unit.y} width={unit.width} height={unit.height} />)}
        {localMapPassages.map(passage => <rect key={passage.id} className="world-phone__map-passage" data-map-passage={passage.id} x={passage.bounds.x} y={passage.bounds.y} width={passage.bounds.width} height={passage.bounds.height} />)}
        {localMapZones.length > 0 && <g className="world-phone__map-zones" clipPath={`url(#${mapId}-ride-map-frame)`}>
          {localMapZones.map(zone => {
            const safeId = zone.id.replace(/[^a-zA-Z0-9_-]/g, '-')
            const floor = zone.fillBounds ?? zone.bounds
            return <rect key={zone.id} className="world-phone__map-zone" data-map-zone={zone.id} data-map-zone-fill="true" x={floor.x} y={floor.y} width={floor.width} height={floor.height} fill={`url(#${mapId}-${safeId}-gradient)`} mask={`url(#${mapId}-${safeId}-floor-mask)`} stroke="none" />
          })}
        </g>}
        {localMapObjects.map(object => <rect key={object.id} className={`world-phone__map-object world-phone__map-object--${object.kind ?? 'fixture'}`} data-map-object={object.id} x={object.bounds.x} y={object.bounds.y} width={object.bounds.width} height={object.bounds.height} />)}
        {!localViewBox && <>
          {displayDevice === 'inner' && phoneMapTransitLinks.map(([from, to]) => { const a = mapRegions.find(r => r.id === from), b = mapRegions.find(r => r.id === to); return a && b ? <line key={`${from}-${to}`} className="world-phone__map-transit" data-map-transit={`${from}-${to}`} x1={a.position[0]} y1={a.position[1]} x2={b.position[0]} y2={b.position[1]} /> : null })}
          {mapRegions.map(region => <g key={region.id} transform={`translate(${region.position.join(' ')})`}><path className="world-phone__map-region-field" d={phoneMapRegionContours[region.id]} /><path className="world-phone__map-contour" d={phoneMapRegionContours[region.id]} transform="scale(.74)" /></g>)}
        </>}
      </svg>
      <div className="world-phone__map-labels">{places.map(({ place, parent }) => marker(place, parent))}</div>
    </div>
    <div className="world-phone__map-controls" ref={controlsRef} role="group" aria-label="地图缩放"><button type="button" aria-label="放大地图" onClick={() => {manualCamera();setMapZoom(current => stepPhoneMapZoom(current, 1))}}>+</button><button type="button" aria-label="缩小地图" onClick={() => {manualCamera();setMapZoom(current => stepPhoneMapZoom(current, -1))}}>−</button><button type="button" aria-label="回到地图概览" onClick={() => { manualCamera();setMapZoom(1); setMapPan([0, 0]) }}>⌖</button></div>
  </>
}
