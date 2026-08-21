import {
  WORLD_MAP_CITIES,
  WORLD_MAP_INTERACTIVE_IDS,
  WORLD_MAP_LOCATIONS,
  WORLD_MAP_NODES,
  WORLD_MAP_REGIONS,
  WORLD_MAP_ROUTES,
  WORLD_MAP_VIEWBOX,
} from '../data/centerWorldMap'
import { centerText, getCenterEntity } from '../data/centerScene'
import {
  resolveEntityVisualState,
} from '../interaction/centerInteraction'
import {
  PROCEDURAL_TERRAIN,
  worldLinePath,
  worldPathFromPoints,
  worldRingPath,
  worldTerrainPoint,
} from '../geometry/worldMap'

const TONE_CLASS = {
  warm: 'center-data-tone--warm',
  cool: 'center-data-tone--cool',
  neutral: 'center-data-tone--neutral',
}

function entityKeyDown(event, entityId, onSelect) {
  if (!entityId || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  onSelect(entityId, 'keyboard')
}

function TerrainLayer() {
  const {
    boundary,
    contours,
    network,
    detailNetwork,
    mountainRelief,
    hydrology,
    ridgeLines,
    flowLines,
    points,
  } = PROCEDURAL_TERRAIN
  return (
    <g className="center-data-layer center-data-terrain center-procedural-terrain" aria-hidden="true">
      <path className="center-data-terrain__surface" d={worldPathFromPoints(boundary, -.02, true)} />
      <g className="center-procedural-terrain__network">
        {network.map(layer => <path key={`terrain-network-${layer.level}`} className={`center-procedural-terrain__network-path center-procedural-terrain__network-path--${layer.level}`} d={layer.d} />)}
      </g>
      <path className="center-procedural-terrain__detail-network" d={detailNetwork} />
      <g className="center-procedural-terrain__contours">
        {contours.map(contour => (
          <path
            key={contour.id}
            className={`center-procedural-terrain__contour${contour.major ? ' center-procedural-terrain__contour--major' : ''}`}
            d={contour.d}
          />
        ))}
      </g>
      <path className="center-procedural-terrain__mountain-relief" d={mountainRelief} />
      <g className="center-procedural-terrain__hydrology">
        {hydrology.banks.map((d, index) => <path key={`terrain-bank-${index}`} d={d} />)}
        {hydrology.tributaries.map((d, index) => <path key={`terrain-tributary-${index}`} d={d} />)}
      </g>
      <g className="center-procedural-terrain__ridges">
        {ridgeLines.map((d, index) => <path key={`terrain-ridge-${index}`} d={d} />)}
      </g>
      <g className="center-procedural-terrain__flows">
        {flowLines.map((d, index) => <path key={`terrain-flow-${index}`} d={d} />)}
      </g>
      <g className="center-procedural-terrain__points">
        {points.map((point, index) => <circle key={`terrain-point-${index}`} cx={point.x.toFixed(2)} cy={point.y.toFixed(2)} r={point.radius.toFixed(2)} />)}
      </g>
      <path className="center-data-terrain__boundary" d={worldPathFromPoints(boundary, .16, true)} />
    </g>
  )
}

function RegionLayer({ interaction, language, onFocus, onBlur, onSelect }) {
  return (
    <g className="center-data-layer center-data-regions">
      {WORLD_MAP_REGIONS.map(region => {
        const state = resolveEntityVisualState(interaction, region.entityId)
        return (
          <g
            key={region.id}
            className={`center-data-region ${TONE_CLASS[region.tone]}`}
            data-center-entity-id={region.entityId}
            data-entity-state={state}
            role="button"
            tabIndex={0}
            aria-label={centerText(region.label, language)}
            onPointerEnter={event => event.pointerType !== 'touch' && onFocus(region.entityId)}
            onPointerLeave={() => onBlur(region.entityId)}
            onFocus={() => onFocus(region.entityId)}
            onBlur={() => onBlur(region.entityId)}
            onClick={event => { event.stopPropagation(); onSelect(region.entityId, event.detail === 0 ? 'keyboard' : 'pointer') }}
            onKeyDown={event => entityKeyDown(event, region.entityId, onSelect)}
          >
            <path className="center-data-region__surface" d={worldPathFromPoints(region.points, .03, true)} />
            <path className="center-data-region__trace" d={worldPathFromPoints(region.points, .22, true)} />
            <text className="center-data-region__label" x={worldTerrainPoint(...region.points[2])[0]} y={worldTerrainPoint(...region.points[2])[1] + 26}>{centerText(region.label, language)}</text>
          </g>
        )
      })}
    </g>
  )
}

function RouteLayer() {
  const nodeById = new Map(WORLD_MAP_NODES.map(node => [node.id, node]))
  const edges = []
  const seen = new Set()
  WORLD_MAP_NODES.forEach(node => {
    node.connections.forEach(connectionId => {
      const key = [node.id, connectionId].sort().join('::')
      if (seen.has(key)) return
      const target = nodeById.get(connectionId)
      if (!target) return
      seen.add(key)
      edges.push({ id: key, points: [node.point, target.point] })
    })
  })

  return (
    <g className="center-data-layer center-data-routes" aria-hidden="true">
      <g className="center-data-graph">
        {edges.map(edge => <path key={edge.id} className="center-data-graph__edge" d={worldPathFromPoints(edge.points, .19)} />)}
      </g>
      {WORLD_MAP_ROUTES.map(route => (
        <g key={route.id} className={`center-data-route center-data-route--${route.type}`} data-route-status={route.status}>
          <path className="center-data-route__underlay" d={worldPathFromPoints(route.points, .11)} />
          <path className="center-data-route__line" d={worldPathFromPoints(route.points, route.type === 'river' ? .28 : .2)} />
          <path className="center-data-route__signal" d={worldPathFromPoints(route.points, .34)} />
        </g>
      ))}
    </g>
  )
}

function deterministicUnit(value) {
  const sample = Math.sin((value * 127.1) + 31.7) * 43758.5453
  return sample - Math.floor(sample)
}

function buildCityWireframe(city, cityIndex) {
  const structures = []
  const streets = []
  const count = 82
  for (let index = 0; index < count; index += 1) {
    const angle = deterministicUnit(index + cityIndex * 71) * Math.PI * 2
    const distance = Math.sqrt(deterministicUnit(index * 3.7 + cityIndex * 13.1)) * city.radius * .98
    const x = city.center[0] + Math.cos(angle) * distance
    const y = city.center[1] + Math.sin(angle) * distance
    const width = .028 + deterministicUnit(index * 5.3 + cityIndex) * .12
    const depth = .025 + deterministicUnit(index * 7.1 + cityIndex * 3) * .1
    const height = city.heights[index % city.heights.length] * (.34 + deterministicUnit(index * 9.9 + cityIndex * 5) * 1.18)
    const ground = worldTerrainPoint(x, y, .08)
    const roof = worldTerrainPoint(x, y, height)
    const groundA = worldTerrainPoint(x - width, y - depth, .08)
    const groundB = worldTerrainPoint(x + width, y + depth, .08)
    const groundC = worldTerrainPoint(x - width, y + depth, .08)
    const groundD = worldTerrainPoint(x + width, y - depth, .08)
    const roofA = worldTerrainPoint(x - width * .72, y - depth * .72, height)
    const roofB = worldTerrainPoint(x + width * .72, y + depth * .72, height)

    structures.push(
      `M${groundA[0].toFixed(2)} ${groundA[1].toFixed(2)} L${groundB[0].toFixed(2)} ${groundB[1].toFixed(2)}`,
      `M${groundC[0].toFixed(2)} ${groundC[1].toFixed(2)} L${groundD[0].toFixed(2)} ${groundD[1].toFixed(2)}`,
      `M${groundA[0].toFixed(2)} ${groundA[1].toFixed(2)} L${roofA[0].toFixed(2)} ${roofA[1].toFixed(2)}`,
      `M${groundB[0].toFixed(2)} ${groundB[1].toFixed(2)} L${roofB[0].toFixed(2)} ${roofB[1].toFixed(2)}`,
      `M${ground[0].toFixed(2)} ${ground[1].toFixed(2)} L${roof[0].toFixed(2)} ${roof[1].toFixed(2)}`,
      `M${roofA[0].toFixed(2)} ${roofA[1].toFixed(2)} L${roof[0].toFixed(2)} ${roof[1].toFixed(2)} L${roofB[0].toFixed(2)} ${roofB[1].toFixed(2)}`,
    )

    const floorCount = height > 1.2 ? 2 + (index % 3) : 1
    for (let floor = 1; floor < floorCount; floor += 1) {
      const floorHeight = (height * floor) / floorCount
      const floorA = worldTerrainPoint(x - width * .86, y - depth * .86, floorHeight)
      const floorB = worldTerrainPoint(x + width * .86, y + depth * .86, floorHeight)
      structures.push(`M${floorA[0].toFixed(2)} ${floorA[1].toFixed(2)} L${floorB[0].toFixed(2)} ${floorB[1].toFixed(2)}`)
    }

    if (index % 6 === 0) {
      const antenna = worldTerrainPoint(x, y, height + .42)
      structures.push(`M${roof[0].toFixed(2)} ${roof[1].toFixed(2)} L${antenna[0].toFixed(2)} ${antenna[1].toFixed(2)}`)
    }
  }

  for (let index = 0; index < 26; index += 1) {
    const angle = (Math.PI * 2 * index) / 26 + .08
    const end = [
      city.center[0] + Math.cos(angle) * city.radius * (.28 + (index % 4) * .16),
      city.center[1] + Math.sin(angle) * city.radius * (.28 + (index % 4) * .16),
    ]
    streets.push(worldLinePath([city.center, end], .16))
  }

  return { structures: structures.join(' '), streets: streets.join(' ') }
}

const CITY_WIREFRAMES = new Map(WORLD_MAP_CITIES.map((city, index) => [city.id, buildCityWireframe(city, index)]))

function CityLayer() {
  return (
    <g className="center-data-layer center-data-cities" aria-hidden="true">
      {WORLD_MAP_CITIES.map(city => {
        const center = worldTerrainPoint(...city.center, .32)
        const wireframe = CITY_WIREFRAMES.get(city.id)
        return (
          <g key={city.id} className={`center-data-city ${TONE_CLASS[city.tone]}`}>
            <path className="center-data-city__orbit" d={worldRingPath(city.center, city.radius * 1.28, 1, 30, .3)} />
            <path className="center-data-city__orbit center-data-city__orbit--inner" d={worldRingPath(city.center, city.radius * .62, 1, 24, .36)} />
            <circle className="center-data-city__core" cx={center[0]} cy={center[1]} r="2.2" />
            <path className="center-data-city__streets" d={wireframe?.streets} />
            <path className="center-data-city__structure" d={wireframe?.structures} />
          </g>
        )
      })}
    </g>
  )
}

function LocationLayer({ language }) {
  return (
    <g className="center-data-layer center-data-locations" aria-hidden="true">
      {WORLD_MAP_LOCATIONS.map(location => {
        const anchor = worldTerrainPoint(...location.anchor, .44)
        const label = worldTerrainPoint(...location.point, .44)
        const elbowX = label[0] + (anchor[0] > label[0] ? 12 : -12)
        return (
          <g key={location.id} className={`center-data-location ${TONE_CLASS[location.tone]}`}>
            <path className="center-data-location__leader" d={`M${anchor[0]} ${anchor[1]} L${elbowX} ${label[1]} L${label[0]} ${label[1]}`} />
            <circle className="center-data-location__pin" cx={anchor[0]} cy={anchor[1]} r="2.4" />
            <text className="center-data-location__label" x={label[0]} y={label[1] - 5} textAnchor={anchor[0] > label[0] ? 'end' : 'start'}>{centerText(location.label, language)}</text>
          </g>
        )
      })}
    </g>
  )
}

function WorldNode({ node, interaction, language, onFocus, onBlur, onSelect }) {
  const entityId = node.entityId
  const entity = entityId ? getCenterEntity(entityId) : null
  const state = entityId ? resolveEntityVisualState(interaction, entityId) : 'idle'
  const point = worldTerrainPoint(...node.point, .62)
  const interactive = WORLD_MAP_INTERACTIVE_IDS.includes(entityId)
  const label = entity ? centerText(entity.name, language) : null
  const nodeClass = `center-data-node ${interactive ? 'center-data-node--interactive' : 'center-data-node--static'} ${TONE_CLASS[node.role === 'ridge' ? 'cool' : entityId ? 'warm' : 'neutral']}`

  return (
    <g
      className={nodeClass}
      data-center-entity-id={entityId || undefined}
      data-center-entity-interactive={interactive ? 'true' : 'false'}
      data-entity-state={state}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      onPointerEnter={event => interactive && event.pointerType !== 'touch' && onFocus(entityId)}
      onPointerLeave={() => interactive && onBlur(entityId)}
      onFocus={() => interactive && onFocus(entityId)}
      onBlur={() => interactive && onBlur(entityId)}
      onClick={event => {
        if (!interactive) return
        event.stopPropagation()
        onSelect(entityId, event.detail === 0 ? 'keyboard' : 'pointer')
      }}
      onKeyDown={event => interactive && entityKeyDown(event, entityId, onSelect)}
    >
      <circle className="center-data-node__hit" cx={point[0]} cy={point[1]} r="28" />
      <circle className="center-data-node__ring" cx={point[0]} cy={point[1]} r={interactive ? 13 : 7} />
      <circle className="center-data-node__halo" cx={point[0]} cy={point[1]} r={interactive ? 4.6 : 2.7} />
      <circle className="center-data-node__dot" cx={point[0]} cy={point[1]} r={interactive ? 2.6 : 1.4} />
      {interactive && <path className="center-data-node__cross" d={`M${point[0] - 21} ${point[1]} H${point[0] + 21} M${point[0]} ${point[1] - 21} V${point[1] + 21}`} />}
      {label && <text className="center-data-node__label" x={point[0] + 18} y={point[1] - 18}>{label}</text>}
    </g>
  )
}

function FixedHud() {
  return (
    <g className="center-data-fixed-hud" aria-hidden="true">
      <g className="center-data-compass" transform="translate(82 190)">
        <circle r="27" />
        <path d="M0 -38 V38 M-38 0 H38" />
        <path className="center-data-compass__diamond" d="M0 -24 L24 0 L0 24 L-24 0 Z" />
        <circle r="4" />
        <text x="0" y="-48" textAnchor="middle">N</text>
      </g>
      <g className="center-data-legend" transform="translate(1310 154)">
        <text className="center-data-legend__title" x="0" y="0">WORLD 01 / LIVE FIELD</text>
        <path d="M0 18 H50" />
        <circle cx="5" cy="18" r="3" />
        <text x="64" y="22">ACTIVE NODE</text>
        <path className="center-data-legend__cool" d="M0 43 H50" />
        <circle className="center-data-legend__cool" cx="5" cy="43" r="3" />
        <text x="64" y="47">SIGNAL LINK</text>
        <path className="center-data-legend__muted" d="M0 68 H50" />
        <text x="64" y="72">UNMAPPED</text>
        <text className="center-data-legend__coordinates" x="0" y="108">[ 23.641 N, 112.734 E ]</text>
      </g>
    </g>
  )
}

function CenterDataMap({ canvasRef, sceneRef, interaction, language, label, onFocus, onBlur, onSelect, onClear }) {
  return (
    <svg
      ref={canvasRef}
      className="center-map center-data-map"
      viewBox={`0 0 ${WORLD_MAP_VIEWBOX.width} ${WORLD_MAP_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label}
      onClick={onClear}
    >
      <title>{label}</title>
      <defs>
        <radialGradient id="center-data-vignette" cx="50%" cy="42%" r="70%">
          <stop offset="0" stopColor="#121a1b" stopOpacity=".12" />
          <stop offset="1" stopColor="#05090b" stopOpacity=".82" />
        </radialGradient>
        <pattern id="center-data-stars" width="44" height="44" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="11" r=".7" fill="#9da9aa" opacity=".14" />
          <circle cx="33" cy="28" r=".45" fill="#c1a878" opacity=".18" />
          <path d="M21 2 V7 M18.5 4.5 H23.5" stroke="#8ea0a1" strokeWidth=".45" opacity=".12" />
        </pattern>
        <clipPath id="center-data-world-clip"><path d={worldPathFromPoints(PROCEDURAL_TERRAIN.boundary, 0, true)} /></clipPath>
      </defs>
      <rect className="center-data-map__backdrop" width={WORLD_MAP_VIEWBOX.width} height={WORLD_MAP_VIEWBOX.height} />
      <rect className="center-data-map__stars" width={WORLD_MAP_VIEWBOX.width} height={WORLD_MAP_VIEWBOX.height} />
      <rect className="center-data-map__vignette" width={WORLD_MAP_VIEWBOX.width} height={WORLD_MAP_VIEWBOX.height} />
      <g ref={sceneRef} className="center-scene center-data-scene" data-detail-level="standard" data-center-scene="world-01">
        <g clipPath="url(#center-data-world-clip)">
          <TerrainLayer />
          <RegionLayer interaction={interaction} language={language} onFocus={onFocus} onBlur={onBlur} onSelect={onSelect} />
          <RouteLayer />
          <CityLayer />
          <LocationLayer language={language} />
          <g className="center-data-layer center-data-nodes">
            {WORLD_MAP_NODES.map(node => <WorldNode key={node.id} node={node} interaction={interaction} language={language} onFocus={onFocus} onBlur={onBlur} onSelect={onSelect} />)}
          </g>
        </g>
      </g>
      <FixedHud />
    </svg>
  )
}

export default CenterDataMap
