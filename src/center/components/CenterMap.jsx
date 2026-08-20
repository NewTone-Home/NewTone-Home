import {
  CENTER_BUILDINGS,
  CENTER_POINTS,
  CENTER_REGIONS,
  CENTER_ROUTES,
  centerText,
} from '../data/centerScene'
import {
  CENTER_SCENE_VIEWBOX,
  buildingGeometry,
  pointsAttribute,
  polygonPath,
  projectGroundLine,
  projectGroundPolygon,
  projectPoint,
} from '../geometry/isometric'
import { resolveEntityVisualState } from '../interaction/centerInteraction'

const GRID_VALUES = Array.from({ length: 15 }, (_, index) => index)
const ORDERED_BUILDINGS = [...CENTER_BUILDINGS].sort(
  (left, right) => (left.geometry.x + left.geometry.y) - (right.geometry.x + right.geometry.y),
)

function entityKeyDown(event, entity, onSelect) {
  if (!entity.interactive || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  onSelect(entity.id, 'keyboard')
}

function RegionLayer({ interaction, language, onFocus, onBlur, onSelect }) {
  return CENTER_REGIONS.map(region => {
    const points = projectGroundPolygon(region.geometry.points)
    const state = resolveEntityVisualState(interaction, region.id)
    return (
      <g
        key={region.id}
        className="center-region"
        data-center-entity-id={region.id}
        data-center-entity-interactive={region.interactive ? 'true' : 'false'}
        data-entity-state={state}
        role={region.interactive ? 'button' : undefined}
        tabIndex={region.interactive ? 0 : undefined}
        aria-label={region.interactive ? centerText(region.name, language) : undefined}
        onPointerEnter={event => event.pointerType !== 'touch' && onFocus(region.id)}
        onPointerLeave={() => onBlur(region.id)}
        onFocus={() => onFocus(region.id)}
        onBlur={() => onBlur(region.id)}
        onClick={event => { event.stopPropagation(); onSelect(region.id, event.detail === 0 ? 'keyboard' : 'pointer') }}
        onKeyDown={event => entityKeyDown(event, region, onSelect)}
      >
        <path className="center-region__surface" d={polygonPath(points)} />
        <path className="center-region__trace" pathLength="1" d={polygonPath(points)} />
        <text className="center-region__label" x={points.reduce((sum, point) => sum + point[0], 0) / points.length} y={points.reduce((sum, point) => sum + point[1], 0) / points.length}>
          {centerText(region.name, language)}
        </text>
      </g>
    )
  })
}

function RouteLayer() {
  return CENTER_ROUTES.map(route => {
    const points = pointsAttribute(projectGroundLine(route.geometry.points))
    return (
      <g key={route.id} className="center-route" data-route-status={route.status}>
        <polyline className="center-route__bed" points={points} />
        <polyline className="center-route__line" points={points} />
      </g>
    )
  })
}

function BuildingLayer({ interaction, language, onFocus, onBlur, onSelect }) {
  return ORDERED_BUILDINGS.map(building => {
    const geometry = buildingGeometry(building)
    const state = resolveEntityVisualState(interaction, building.id)
    return (
      <g
        key={building.id}
        className={`center-building${building.interactive ? ' center-building--interactive' : ''}`}
        data-center-entity-id={building.id}
        data-center-entity-interactive={building.interactive ? 'true' : 'false'}
        data-entity-state={state}
        data-entity-type={building.entityType}
        role={building.interactive ? 'button' : undefined}
        tabIndex={building.interactive ? 0 : undefined}
        aria-label={building.interactive ? centerText(building.name, language) : undefined}
        onPointerEnter={event => building.interactive && event.pointerType !== 'touch' && onFocus(building.id)}
        onPointerLeave={() => building.interactive && onBlur(building.id)}
        onFocus={() => building.interactive && onFocus(building.id)}
        onBlur={() => building.interactive && onBlur(building.id)}
        onClick={event => { if (!building.interactive) return; event.stopPropagation(); onSelect(building.id, event.detail === 0 ? 'keyboard' : 'pointer') }}
        onKeyDown={event => entityKeyDown(event, building, onSelect)}
      >
        <path className="center-building__face center-building__face--east" d={geometry.eastFace} />
        <path className="center-building__face center-building__face--west" d={geometry.westFace} />
        <path className="center-building__roof" d={geometry.roof} />
        <path className="center-building__structure" d={geometry.trace} />
        {building.id === 'signal-tower' && (
          <path className="center-building__signal" d={`M${geometry.anchor[0]} ${geometry.anchor[1]} v-62 m-18 18 q18 -18 36 0 m-27 9 q9 -9 18 0`} />
        )}
        <path className="center-building__trace" pathLength="1" d={geometry.trace} />
        <path className="center-building__hit" d={`${geometry.roof} ${geometry.eastFace} ${geometry.westFace}`} />
        <text className="center-building__label" x={geometry.anchor[0]} y={geometry.anchor[1] - 14}>{centerText(building.name, language)}</text>
      </g>
    )
  })
}

function PointLayer({ interaction, language, onFocus, onBlur, onSelect }) {
  return CENTER_POINTS.map(point => {
    const [x, y] = projectPoint(...point.geometry.point)
    const state = resolveEntityVisualState(interaction, point.id)
    return (
      <g
        key={point.id}
        className="center-point"
        data-center-entity-id={point.id}
        data-center-entity-interactive="true"
        data-entity-state={state}
        role="button"
        tabIndex="0"
        aria-label={centerText(point.name, language)}
        transform={`translate(${x} ${y})`}
        onPointerEnter={event => event.pointerType !== 'touch' && onFocus(point.id)}
        onPointerLeave={() => onBlur(point.id)}
        onFocus={() => onFocus(point.id)}
        onBlur={() => onBlur(point.id)}
        onClick={event => { event.stopPropagation(); onSelect(point.id, event.detail === 0 ? 'keyboard' : 'pointer') }}
        onKeyDown={event => entityKeyDown(event, point, onSelect)}
      >
        <circle className="center-point__orbit" r="17" />
        <circle className="center-point__node" r="4" />
        <path className="center-point__cross" d="M-10 0h20M0-10v20" />
        <text className="center-point__label" x="0" y="-25">{centerText(point.name, language)}</text>
      </g>
    )
  })
}

function TerrainGrid() {
  return (
    <g className="center-grid" aria-hidden="true">
      {GRID_VALUES.map(value => (
        <path key={`grid-x-${value}`} d={`M${projectPoint(value, 0).join(' ')} L${projectPoint(value, 14).join(' ')}`} />
      ))}
      {GRID_VALUES.map(value => (
        <path key={`grid-y-${value}`} d={`M${projectPoint(0, value).join(' ')} L${projectPoint(14, value).join(' ')}`} />
      ))}
    </g>
  )
}

function CenterMap({ canvasRef, sceneRef, interaction, language, label, onFocus, onBlur, onSelect, onClear }) {
  return (
    <svg
      ref={canvasRef}
      className="center-map"
      viewBox={`0 0 ${CENTER_SCENE_VIEWBOX.width} ${CENTER_SCENE_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMid slice"
      role="application"
      aria-label={label}
      onClick={onClear}
    >
      <defs>
        <filter id="center-local-glow" x="-80%" y="-80%" width="260%" height="260%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id="center-field-dots" width="36" height="36" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" />
        </pattern>
      </defs>
      <rect className="center-map__field" width="1600" height="1000" />
      <g ref={sceneRef} className="center-scene" data-center-scene="district-01">
        <TerrainGrid />
        <g className="center-layer center-layer--regions"><RegionLayer interaction={interaction} language={language} onFocus={onFocus} onBlur={onBlur} onSelect={onSelect} /></g>
        <g className="center-layer center-layer--routes"><RouteLayer /></g>
        <g className="center-layer center-layer--structures"><BuildingLayer interaction={interaction} language={language} onFocus={onFocus} onBlur={onBlur} onSelect={onSelect} /></g>
        <g className="center-layer center-layer--points"><PointLayer interaction={interaction} language={language} onFocus={onFocus} onBlur={onBlur} onSelect={onSelect} /></g>
      </g>
    </svg>
  )
}

export default CenterMap
