import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction, type PointerEvent } from 'react'
import { mainlineMapLayout, type MainlineSceneGeometryUnit } from './mainlineScenes'
import { clampPhoneMapZoom, phoneMapZoomBounds, phoneMapTransitLinks, phoneMapRegionContours, stepPhoneMapZoom, type PhoneMapPoint, type PhoneMapRegion } from './phoneMapModel'
import type { PhoneDevice } from './phoneState'

type Point = PhoneMapPoint
type Props = {
  mapRegions: readonly PhoneMapRegion[]; displayDevice: PhoneDevice
  currentLandmark: { device: PhoneDevice; id: string } | null
  selectedMapPlaceId: string | null; onSelect: (id: string) => void
  mapZoom: number; setMapZoom: Dispatch<SetStateAction<number>>
  mapPan: Point; setMapPan: Dispatch<SetStateAction<Point>>
  localViewBox?: string; geometry?: readonly MainlineSceneGeometryUnit[]
  focusId?: string | null; coveredHeight?: number; onBlank?: () => void
}
export function PhoneMapCanvas({ mapRegions, displayDevice, currentLandmark, selectedMapPlaceId, onSelect, mapZoom, setMapZoom, mapPan, setMapPan, localViewBox, geometry, focusId, coveredHeight = 0, onBlank }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<{ start: Point; pan: Point; distance?: number; zoom: number } | null>(null)
  const suppressClick = useRef(false)
  const [vx, vy, vw, vh] = (localViewBox ?? mainlineMapLayout.viewBox).split(' ').map(Number)
  const scale = Math.min(size.width / vw, size.height / vh)
  const focusPoint = mapRegions.flatMap(r => [r, ...r.pois]).find(p => p.id === focusId)?.position
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
    const update = () => setSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (!focusPoint || !focusId || size.width <= 1) return
    const zoom = Math.max(zoomRef.current, phoneMapZoomBounds.poi + .2)
    setMapZoom(zoom)
    setMapPan([(vx + vw / 2 - focusPoint[0]) * scale * zoom, (vy + vh / 2 - focusPoint[1]) * scale * zoom - coveredHeight / 2])
    // Selection and visible-area changes own focus; wheel and drag remain user controlled.
  }, [focusId, focusPoint?.[0], focusPoint?.[1], coveredHeight, size.width, size.height, vx, vy, vw, vh, scale, setMapZoom, setMapPan])
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
    const wheel = (event: WheelEvent) => { event.preventDefault(); event.stopPropagation(); setMapZoom(current => clampPhoneMapZoom(current * Math.exp(-event.deltaY * .002))) }
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
    if (Math.abs(dx) + Math.abs(dy) > 5 || p.length === 2) { suppressClick.current = true; event.currentTarget.setPointerCapture(event.pointerId) }
    const zoom = start.distance && p.length === 2 ? clampPhoneMapZoom(start.zoom * Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) / Math.max(1, start.distance)) : mapZoom
    if (start.distance) setMapZoom(zoom)
    setMapPan(boundPan([start.pan[0] + dx, start.pan[1] + dy], zoom))
  }
  const up = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const remaining = [...pointers.current.values()]
    gesture.current = remaining.length === 1 ? { start: remaining[0], pan: mapPan, zoom: mapZoom } : null
  }
  const selectedParent = mapRegions.find(r => r.pois.some(p => p.id === selectedMapPlaceId))?.id
  const labels: { x: number; y: number; width: number }[] = []
  const marker = (place: PhoneMapRegion | PhoneMapRegion['pois'][number], parent?: PhoneMapRegion) => {
    const [x, y] = project(place.position), poi = Boolean(parent), selected = selectedMapPlaceId === place.id
    const width = Math.max(44, place.label.length * 12 + 14)
    const collision = !selected && labels.some(l => Math.abs(x - l.x) < (width + l.width) / 2 && Math.abs(y - l.y) < 38)
    const hideLabel = collision || (!poi && selectedParent === place.id)
    if (!hideLabel) labels.push({ x, y, width })
    return <button key={place.id} type="button" className={`world-phone__map-marker ${poi ? 'world-phone__map-poi' : 'world-phone__map-region'} ${selected ? 'is-selected' : ''} ${currentLandmark?.device === displayDevice && currentLandmark.id === place.id ? 'is-active' : ''}`}
      {...(poi ? { 'data-map-poi': place.id, 'data-map-poi-region': parent!.id } : { 'data-map-region': place.id })}
      data-scene-id={place.sceneId} data-map-interactive="true" aria-label={`${place.label}${poi ? `，位于${parent!.label}` : '区域'}，点击查看详情`}
      style={{ left: x, top: y }} onClick={() => { if (!suppressClick.current) onSelect(place.id) }}><i aria-hidden="true" />{!hideLabel && <span>{place.label}</span>}</button>
  }
  const places = mapRegions.flatMap(region => [{ place: region, parent: undefined as PhoneMapRegion | undefined }, ...(localViewBox || mapZoom < phoneMapZoomBounds.poi ? [] : region.pois.map(place => ({ place, parent: region })))])
    .sort((a, b) => Number(b.place.id === selectedMapPlaceId) - Number(a.place.id === selectedMapPlaceId))
  return <>
    <div className="world-phone__map-viewport" ref={viewportRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={event => { if (!(event.target instanceof Element) || !event.target.closest('[data-map-interactive]')) { if (!suppressClick.current) onBlank?.() } }}>
      <svg className="world-phone__map" viewBox={localViewBox ?? mainlineMapLayout.viewBox} role="group" aria-label="世界地图，拖动查看，滚轮、双指或按钮缩放，点击区域和地点查看详情" data-map-world={displayDevice} data-map-zoom={mapZoom.toFixed(3)} style={{ transform: `translate(${mapPan[0]}px, ${mapPan[1]}px) scale(${mapZoom})` }}>
        {geometry?.filter(unit => unit.visual.kind !== 'none').map(unit => <rect key={unit.id} x={unit.x} y={unit.y} width={unit.width} height={unit.height} fill="#ffffff10" stroke="#ffffff35" strokeWidth=".15" />)}
        {!localViewBox && <>
          {displayDevice === 'inner' && phoneMapTransitLinks.map(([from, to]) => { const a = mapRegions.find(r => r.id === from), b = mapRegions.find(r => r.id === to); return a && b ? <line key={`${from}-${to}`} className="world-phone__map-transit" data-map-transit={`${from}-${to}`} x1={a.position[0]} y1={a.position[1]} x2={b.position[0]} y2={b.position[1]} /> : null })}
          {mapRegions.map(region => <g key={region.id} transform={`translate(${region.position.join(' ')})`}><path className="world-phone__map-region-field" d={phoneMapRegionContours[region.id]} /><path className="world-phone__map-contour" d={phoneMapRegionContours[region.id]} transform="scale(.74)" /></g>)}
        </>}
      </svg>
      <div className="world-phone__map-labels">{places.map(({ place, parent }) => marker(place, parent))}</div>
      {!localViewBox && <span className="world-phone__map-caption">区域示意 · 连线表示交通关联</span>}
    </div>
    <div className="world-phone__map-controls" role="group" aria-label="地图缩放"><button type="button" aria-label="放大地图" onClick={() => setMapZoom(current => stepPhoneMapZoom(current, 1))}>+</button><button type="button" aria-label="缩小地图" onClick={() => setMapZoom(current => stepPhoneMapZoom(current, -1))}>−</button><button type="button" aria-label="回到地图概览" onClick={() => { setMapZoom(1); setMapPan([0, 0]) }}>⌖</button></div>
  </>
}
