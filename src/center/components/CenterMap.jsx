import {
  CENTER_BUILDINGS,
  CENTER_PARCELS,
  CENTER_POINTS,
  CENTER_REGIONS,
  CENTER_ROUTES,
  CENTER_STATIC_MASSINGS,
  CENTER_URBAN_DETAILS,
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
import {
  buildingFacadeGeometry,
  buildingGroundGeometry,
  buildingRoofGeometry,
  buildingStepsGeometry,
  detailAnchor,
} from '../geometry/scenePrimitives'
import { resolveEntityVisualState } from '../interaction/centerInteraction'

const GRID_VALUES = Array.from({ length: 8 }, (_, index) => index * 2)
const ORDERED_STRUCTURES = [
  ...CENTER_STATIC_MASSINGS.map(structure => ({ ...structure, kind: 'massing', interactive: false })),
  ...CENTER_BUILDINGS,
].sort((left, right) => {
  const leftDepth = left.geometry.x + left.geometry.y + left.geometry.depth * .5
  const rightDepth = right.geometry.x + right.geometry.y + right.geometry.depth * .5
  return leftDepth - rightDepth
})

function entityKeyDown(event, entity, onSelect) {
  if (!entity.interactive || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  onSelect(entity.id, 'keyboard')
}

function lineFrom([start, end]) {
  return `M${start[0]} ${start[1]} L${end[0]} ${end[1]}`
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

function ParcelLayer() {
  return CENTER_PARCELS.map(parcel => {
    const points = projectGroundPolygon(parcel.geometry.points)
    return (
      <g key={parcel.id} className="center-parcel" data-parcel-use={parcel.use} aria-hidden="true">
        <path className="center-parcel__surface" d={polygonPath(points)} />
        <path className="center-parcel__edge" d={polygonPath(points)} />
      </g>
    )
  })
}

function StreetLayer() {
  return CENTER_ROUTES.map(route => {
    const points = pointsAttribute(projectGroundLine(route.geometry.points))
    return (
      <g key={route.id} className="center-route" data-route-status={route.status} aria-hidden="true">
        <polyline className="center-route__curb" points={points} />
        <polyline className="center-route__bed" points={points} />
        <polyline className="center-route__edge" points={points} />
        <polyline className="center-route__line" points={points} />
      </g>
    )
  })
}

function facadePaths(facade) {
  return [
    ...facade.east.vertical.map((path, index) => ({ id: `east-v-${index}`, path, face: 'east' })),
    ...facade.east.horizontal.map((path, index) => ({ id: `east-h-${index}`, path, face: 'east' })),
    ...facade.west.vertical.map((path, index) => ({ id: `west-v-${index}`, path, face: 'west' })),
    ...facade.west.horizontal.map((path, index) => ({ id: `west-h-${index}`, path, face: 'west' })),
  ]
}

function getAnnexGeometries(building) {
  return (building.visual?.annexes || []).map(annex => buildingGeometry({ geometry: annex }))
}

function AuxiliaryVolumes({ building, geometries }) {
  return geometries.map((geometry, index) => {
    return (
      <g className="center-building__annex" key={`${building.id}-annex-${index}`}>
        <path className="center-building__annex-face center-building__annex-face--east" d={geometry.eastFace} />
        <path className="center-building__annex-face center-building__annex-face--west" d={geometry.westFace} />
        <path className="center-building__annex-roof" d={geometry.roof} />
        <path className="center-building__annex-trace" d={geometry.trace} />
      </g>
    )
  })
}

function ArchetypeDetail({ building, geometry }) {
  const { x, y, width, depth, height } = building.geometry
  const archetype = building.visual?.archetype

  if (archetype === 'archive') {
    const left = projectPoint(x + width * .36, y + depth, height * .14)
    const right = projectPoint(x + width * .64, y + depth, height * .14)
    const top = projectPoint(x + width * .5, y + depth, height * .68)
    return <path className="center-building__entrance" d={`M${left[0]} ${left[1]} L${top[0]} ${top[1]} L${right[0]} ${right[1]}`} />
  }

  if (archetype === 'observatory') {
    const center = projectPoint(x + width / 2, y + depth / 2, height + .12)
    return (
      <g className="center-building__observatory-detail">
        <ellipse cx={center[0]} cy={center[1]} rx={width * 21} ry={depth * 9} />
        <path d={`M${center[0] - width * 18} ${center[1]} Q${center[0]} ${center[1] - 30} ${center[0] + width * 18} ${center[1]}`} />
        <path d={lineFrom([projectPoint(x + width * .22, y + depth, height), projectPoint(x + width * .22, y + depth, 0)])} />
      </g>
    )
  }

  if (archetype === 'assembly') {
    return (
      <g className="center-building__assembly-colonnade">
        {[.16, .36, .56, .76].map((amount, index) => {
          const top = projectPoint(x + width * amount, y + depth, height)
          const bottom = projectPoint(x + width * amount, y + depth, height * .08)
          return <path key={index} d={lineFrom([top, bottom])} />
        })}
      </g>
    )
  }

  if (archetype === 'market') {
    return (
      <g className="center-building__market-canopies">
        {[.14, .34, .54, .74, .94].map((amount, index) => {
          const top = projectPoint(x + width * amount, y + depth + .12, height * .78)
          const bottom = projectPoint(x + width * amount, y + depth + .12, height * .1)
          return <path key={index} d={lineFrom([top, bottom])} />
        })}
      </g>
    )
  }

  if (archetype === 'station') {
    const railA = [projectPoint(x - .12, y + depth + .25), projectPoint(x + width + .38, y + depth + .25)]
    const railB = [projectPoint(x - .12, y + depth + .48), projectPoint(x + width + .38, y + depth + .48)]
    return (
      <g className="center-building__platform-detail">
        <path d={lineFrom(railA)} />
        <path d={lineFrom(railB)} />
        {[.12, .3, .48, .66, .84].map((amount, index) => {
          const railX = x + width * amount
          return <path key={index} d={lineFrom([projectPoint(railX, y + depth + .14), projectPoint(railX, y + depth + .58)])} />
        })}
        {[.16, .4, .64, .88].map((amount, index) => {
          const columnX = x + width * amount
          return <path className="center-building__platform-column" key={`column-${index}`} d={lineFrom([projectPoint(columnX, y + depth, height), projectPoint(columnX, y + depth, .06)])} />
        })}
      </g>
    )
  }

  if (archetype === 'tower') {
    const [eastTop, eastBase] = [geometry.top[1], geometry.ground[1]]
    const [westTop, westBase] = [geometry.top[2], geometry.ground[2]]
    return (
      <g className="center-building__tower-lattice">
        <path d={lineFrom([eastTop, westBase])} />
        <path d={lineFrom([westTop, eastBase])} />
        <path d={lineFrom([geometry.top[3], geometry.ground[1]])} />
      </g>
    )
  }

  if (archetype === 'residences') {
    return (
      <g className="center-building__residence-divisions">
        {[.2, .4, .6, .8].map((amount, index) => {
          const top = projectPoint(x + width * amount, y + depth, height)
          const bottom = projectPoint(x + width * amount, y + depth)
          return <path key={index} d={lineFrom([top, bottom])} />
        })}
      </g>
    )
  }

  if (archetype === 'clinic') {
    const center = projectPoint(x + width * .76, y + depth + .02, height * .75)
    return <path className="center-building__clinic-mark" d={`M${center[0] - 7} ${center[1]} h14 M${center[0]} ${center[1] - 7} v14`} />
  }

  return null
}

function StructureVolume({ building, interaction, language, onFocus, onBlur, onSelect }) {
  const geometry = buildingGeometry(building)
  const facade = buildingFacadeGeometry(building)
  const roof = buildingRoofGeometry(building)
  const steps = buildingStepsGeometry(building)
  const annexGeometries = getAnnexGeometries(building)
  const selectionTrace = [geometry.trace, ...annexGeometries.map(annex => annex.trace)].join(' ')
  const interactionShape = [
    geometry.roof,
    geometry.eastFace,
    geometry.westFace,
    ...annexGeometries.flatMap(annex => [annex.roof, annex.eastFace, annex.westFace]),
  ].join(' ')
  const interactive = Boolean(building.interactive)
  const state = interactive ? resolveEntityVisualState(interaction, building.id) : 'idle'

  return (
    <g
      className={`center-building${interactive ? ' center-building--interactive' : ' center-building--static'}`}
      data-center-entity-id={interactive ? building.id : undefined}
      data-center-entity-interactive={interactive ? 'true' : undefined}
      data-entity-state={state}
      data-entity-type={building.entityType || 'Structure'}
      data-archetype={building.visual?.archetype || 'support'}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? centerText(building.name, language) : undefined}
      aria-hidden={interactive ? undefined : true}
      onPointerEnter={event => interactive && event.pointerType !== 'touch' && onFocus(building.id)}
      onPointerLeave={() => interactive && onBlur(building.id)}
      onFocus={() => interactive && onFocus(building.id)}
      onBlur={() => interactive && onBlur(building.id)}
      onClick={event => { if (!interactive) return; event.stopPropagation(); onSelect(building.id, event.detail === 0 ? 'keyboard' : 'pointer') }}
      onKeyDown={event => entityKeyDown(event, building, onSelect)}
    >
      <path className="center-building__ground" d={buildingGroundGeometry(building)} />
      {steps.map((path, index) => <path className="center-building__step" d={path} key={`${building.id}-step-${index}`} />)}
      <path className="center-building__face center-building__face--east" d={geometry.eastFace} />
      <path className="center-building__face center-building__face--west" d={geometry.westFace} />
      <path className="center-building__roof" d={geometry.roof} />
      {roof.faces.map((path, index) => <path className="center-building__roof-plane" d={path} key={`${building.id}-roof-plane-${index}`} />)}
      <path className="center-building__structure" d={geometry.trace} />
      <g className="center-building__facade-detail">
        {facadePaths(facade).map(item => <path className={`center-building__facade center-building__facade--${item.face}`} d={item.path} key={`${building.id}-${item.id}`} />)}
      </g>
      <g className="center-building__roof-detail">
        {roof.lines.map((path, index) => <path d={path} key={`${building.id}-roof-line-${index}`} />)}
        {roof.special?.dome && <path className="center-building__dome" d={roof.special.dome} />}
        {roof.special?.spire?.map((path, index) => <path className="center-building__spire" d={path} key={`${building.id}-spire-${index}`} />)}
      </g>
      <AuxiliaryVolumes building={building} geometries={annexGeometries} />
      <ArchetypeDetail building={building} geometry={geometry} />
      {building.id === 'signal-tower' && <path className="center-building__signal" d={`M${geometry.anchor[0]} ${geometry.anchor[1]} v-76 m-24 23 q24 -22 48 0 m-36 11 q12 -11 24 0`} />}
      {interactive && <>
        <path className="center-building__trace" pathLength="1" d={selectionTrace} />
        <path className="center-building__hit" d={interactionShape} />
        <text className="center-building__label" x={geometry.anchor[0]} y={geometry.anchor[1] - 16}>{centerText(building.name, language)}</text>
      </>}
    </g>
  )
}

function StructureLayer({ interaction, language, onFocus, onBlur, onSelect }) {
  return ORDERED_STRUCTURES.map(building => (
    <StructureVolume
      building={building}
      interaction={interaction}
      language={language}
      onFocus={onFocus}
      onBlur={onBlur}
      onSelect={onSelect}
      key={building.id}
    />
  ))
}

function UrbanDetail({ detail }) {
  const [x, y] = detailAnchor(detail)

  if (detail.kind === 'tree') {
    const crown = projectPoint(detail.point[0], detail.point[1], detail.height)
    const spread = 12 * detail.scale
    return (
      <g className="center-urban-detail center-urban-detail--tree" aria-hidden="true">
        <path className="center-urban-detail__trunk" d={`M${x} ${y} L${crown[0]} ${crown[1]}`} />
        <path className="center-urban-detail__crown" d={`M${crown[0]} ${crown[1] - spread} L${crown[0] + spread} ${crown[1]} L${crown[0]} ${crown[1] + spread} L${crown[0] - spread} ${crown[1]} Z`} />
      </g>
    )
  }

  if (detail.kind === 'lamp') {
    const top = projectPoint(detail.point[0], detail.point[1], detail.height)
    return (
      <g className="center-urban-detail center-urban-detail--lamp" aria-hidden="true">
        <path d={`M${x} ${y} L${top[0]} ${top[1]}`} />
        <circle cx={top[0]} cy={top[1]} r="2.2" />
      </g>
    )
  }

  if (detail.kind === 'crosswalk') {
    const stripes = Array.from({ length: 5 }, (_, index) => {
      const offset = (index - 2) * .1
      return detail.axis === 'x'
        ? lineFrom([projectPoint(detail.point[0] + offset, detail.point[1] - .22), projectPoint(detail.point[0] + offset, detail.point[1] + .22)])
        : lineFrom([projectPoint(detail.point[0] - .22, detail.point[1] + offset), projectPoint(detail.point[0] + .22, detail.point[1] + offset)])
    })
    return <g className="center-urban-detail center-urban-detail--crosswalk" aria-hidden="true">{stripes.map((path, index) => <path d={path} key={index} />)}</g>
  }

  if (detail.kind === 'kiosk') {
    const geometry = buildingGeometry({ geometry: { x: detail.point[0], y: detail.point[1], width: detail.width, depth: detail.depth, height: detail.height } })
    return (
      <g className="center-urban-detail center-urban-detail--kiosk" aria-hidden="true">
        <path d={geometry.eastFace} />
        <path d={geometry.westFace} />
        <path d={geometry.roof} />
      </g>
    )
  }

  const marker = [
    projectPoint(detail.point[0] - .16, detail.point[1]),
    projectPoint(detail.point[0], detail.point[1] - .16),
    projectPoint(detail.point[0] + .16, detail.point[1]),
    projectPoint(detail.point[0], detail.point[1] + .16),
  ]
  return <path className="center-urban-detail center-urban-detail--marker" d={polygonPath(marker)} aria-hidden="true" />
}

function UrbanDetailLayer() {
  return CENTER_URBAN_DETAILS.map(detail => <UrbanDetail detail={detail} key={detail.id} />)
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
      {GRID_VALUES.map(value => <path key={`grid-x-${value}`} d={`M${projectPoint(value, 0).join(' ')} L${projectPoint(value, 14).join(' ')}`} />)}
      {GRID_VALUES.map(value => <path key={`grid-y-${value}`} d={`M${projectPoint(0, value).join(' ')} L${projectPoint(14, value).join(' ')}`} />)}
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
        <pattern id="center-field-dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" /></pattern>
      </defs>
      <rect className="center-map__field" width="1600" height="1000" />
      <g ref={sceneRef} className="center-scene" data-center-scene="district-01" data-detail-level="standard">
        <TerrainGrid />
        <g className="center-layer center-layer--regions"><RegionLayer interaction={interaction} language={language} onFocus={onFocus} onBlur={onBlur} onSelect={onSelect} /></g>
        <g className="center-layer center-layer--parcels"><ParcelLayer /></g>
        <g className="center-layer center-layer--routes"><StreetLayer /></g>
        <g className="center-layer center-layer--structures"><StructureLayer interaction={interaction} language={language} onFocus={onFocus} onBlur={onBlur} onSelect={onSelect} /></g>
        <g className="center-layer center-layer--urban"><UrbanDetailLayer /></g>
        <g className="center-layer center-layer--points"><PointLayer interaction={interaction} language={language} onFocus={onFocus} onBlur={onBlur} onSelect={onSelect} /></g>
      </g>
    </svg>
  )
}

export default CenterMap
