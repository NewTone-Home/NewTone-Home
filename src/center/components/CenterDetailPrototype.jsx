import { centerText, getCenterEntity } from '../data/centerScene'
import { resolveEntityVisualState } from '../interaction/centerInteraction'
import {
  LOCAL_DETAIL_SCENE,
  LOCAL_DETAIL_VIEWBOX,
} from '../geometry/localDetailScene'

function entityKeyDown(event, entityId, onSelect) {
  if (!entityId || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  onSelect(entityId, 'keyboard')
}

function DetailTerrain() {
  const { terrain } = LOCAL_DETAIL_SCENE
  return (
    <g className="center-local-detail-layer center-local-detail-terrain" aria-hidden="true">
      <path className="center-local-detail-terrain__surface" d={terrain.boundaryPath} />
      <g className="center-local-detail-lod--overview">
        <path className="center-local-detail-terrain__background-contours" d={terrain.backgroundContours} />
        <path className="center-local-detail-terrain__slope-lines" d={terrain.slopeLines} />
      </g>
      <g className="center-local-detail-terrain__mountains">
        {terrain.mountains.map(mountain => (
          <g key={mountain.id} className={`center-local-detail-mountain center-local-detail-mountain--${mountain.tone}`}>
            <path className="center-local-detail-mountain__facets" d={mountain.facets} />
            <path className="center-local-detail-mountain__contours" d={mountain.contours} />
            <path className="center-local-detail-mountain__ribs" d={mountain.ribs} />
            <circle className="center-local-detail-mountain__summit" cx={mountain.summit[0]} cy={mountain.summit[1]} r="2" />
          </g>
        ))}
      </g>
      <g className="center-local-detail-terrain__ridge-lines">
        {terrain.ridges.map(ridge => (
          <g key={ridge.id} className={`center-local-detail-ridge center-local-detail-ridge--${ridge.tone}`}>
            <path className="center-local-detail-ridge__primary" d={ridge.d} />
            <path className="center-local-detail-ridge__secondary" d={ridge.secondary} />
          </g>
        ))}
      </g>
      <g className="center-local-detail-terrain__plateau">
        <path className="center-local-detail-plateau__primary" d={terrain.plateau.primary} />
        <path className="center-local-detail-plateau__secondary" d={terrain.plateau.secondary} />
      </g>
      <g className="center-local-detail-terrain__river">
        <path className="center-local-detail-river__banks" d={terrain.river.banks} />
        <path className="center-local-detail-river__water" d={terrain.river.water} />
        <path className="center-local-detail-river__micro" d={terrain.river.micro} />
        <path className="center-local-detail-river__tributaries" d={terrain.river.tributaries} />
      </g>
      <path className="center-local-detail-terrain__boundary" d={terrain.boundaryPath} />
    </g>
  )
}

function DetailRoads() {
  return (
    <g className="center-local-detail-layer center-local-detail-roads" aria-hidden="true">
      {LOCAL_DETAIL_SCENE.terrain.roads.map(road => (
        <g key={road.id} className={`center-local-detail-road center-local-detail-road--${road.type}`}>
          <path className="center-local-detail-road__surface" d={road.surface} />
          <path className="center-local-detail-road__edge" d={road.edge} />
          <path className="center-local-detail-road__edge center-local-detail-road__edge--secondary" d={road.edgeSecondary} />
        </g>
      ))}
    </g>
  )
}

function DetailCells() {
  return (
    <g className="center-local-detail-layer center-local-detail-cells center-local-detail-lod--secondary" aria-hidden="true">
      {LOCAL_DETAIL_SCENE.terrain.cells.map(cell => <path key={cell.id} className="center-local-detail-cell" d={cell.d} />)}
    </g>
  )
}

function BuildingGeometry({ geometry }) {
  const { layers } = geometry
  return (
    <g className="center-local-detail-building__geometry" aria-hidden="true">
      <path className="center-local-detail-building__fill" d={layers.fill} />
      <path className="center-local-detail-building__primary" d={layers.primary} />
      <g className="center-local-detail-lod--secondary">
        <path className="center-local-detail-building__secondary" d={layers.secondary} />
        <path className="center-local-detail-building__connection" d={layers.connection} />
      </g>
      <g className="center-local-detail-lod--fine">
        <path className="center-local-detail-building__tertiary" d={layers.tertiary} />
      </g>
    </g>
  )
}

function InteractiveLandmark({ landmark, interaction, language, onFocus, onBlur, onSelect }) {
  const entity = getCenterEntity(landmark.id)
  const state = resolveEntityVisualState(interaction, landmark.id)
  const label = entity ? centerText(entity.name, language) : landmark.id
  const anchor = landmark.anchor
  const labelAnchor = landmark.labelAnchor

  return (
    <g
      className={`center-local-detail-landmark center-local-detail-landmark--${landmark.tone}`}
      data-center-entity-id={landmark.id}
      data-center-entity-interactive="true"
      data-entity-state={state}
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerEnter={event => event.pointerType !== 'touch' && onFocus(landmark.id)}
      onPointerLeave={() => onBlur(landmark.id)}
      onFocus={() => onFocus(landmark.id)}
      onBlur={() => onBlur(landmark.id)}
      onClick={event => { event.stopPropagation(); onSelect(landmark.id, event.detail === 0 ? 'keyboard' : 'pointer') }}
      onKeyDown={event => entityKeyDown(event, landmark.id, onSelect)}
    >
      <BuildingGeometry geometry={landmark.geometry} />
      <path className="center-local-detail-landmark__hit" d={landmark.geometry.hitPath} />
      <path className="center-local-detail-landmark__leader" d={`M${anchor[0]} ${anchor[1]} L${labelAnchor[0]} ${labelAnchor[1]}`} />
      <circle className="center-local-detail-landmark__anchor" cx={anchor[0]} cy={anchor[1]} r="8" />
      <circle className="center-local-detail-landmark__dot" cx={anchor[0]} cy={anchor[1]} r="2.2" />
      <text className="center-local-detail-landmark__label" x={labelAnchor[0]} y={labelAnchor[1] - 7} textAnchor={labelAnchor[0] < anchor[0] ? 'end' : 'start'}>{label}</text>
    </g>
  )
}

function DetailHud() {
  return (
    <g className="center-local-detail-hud" aria-hidden="true">
      <text x="82" y="132">LOCAL DETAIL / 01</text>
      <path d="M82 144 H230" />
      <text x="82" y="168">STRUCTURED TERRAIN STUDY</text>
      <g transform="translate(1322 138)">
        <text x="0" y="0">LINE HIERARCHY</text>
        <path className="center-local-detail-hud__primary" d="M0 18 H38" />
        <path className="center-local-detail-hud__secondary" d="M0 42 H38" />
        <path className="center-local-detail-hud__tertiary" d="M0 66 H38" />
        <text x="52" y="22">SILHOUETTE</text>
        <text x="52" y="46">STRUCTURE</text>
        <text x="52" y="70">DETAIL</text>
      </g>
    </g>
  )
}

function CenterDetailPrototype({ canvasRef, sceneRef, interaction, language, label, onFocus, onBlur, onSelect, onClear }) {
  return (
    <svg
      ref={canvasRef}
      className="center-map center-local-detail-map"
      viewBox={`0 0 ${LOCAL_DETAIL_VIEWBOX.width} ${LOCAL_DETAIL_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${label} — local structured detail`}
      onClick={onClear}
    >
      <title>{`${label} — local structured detail`}</title>
      <defs>
        <radialGradient id="center-local-detail-vignette" cx="50%" cy="44%" r="74%">
          <stop offset="0" stopColor="#162021" stopOpacity=".04" />
          <stop offset=".7" stopColor="#071012" stopOpacity=".2" />
          <stop offset="1" stopColor="#040809" stopOpacity=".94" />
        </radialGradient>
        <filter id="center-local-detail-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="center-local-detail-clip"><path d={LOCAL_DETAIL_SCENE.terrain.boundaryPath} /></clipPath>
      </defs>
      <rect className="center-local-detail-map__backdrop" width={LOCAL_DETAIL_VIEWBOX.width} height={LOCAL_DETAIL_VIEWBOX.height} />
      <rect className="center-local-detail-map__vignette" width={LOCAL_DETAIL_VIEWBOX.width} height={LOCAL_DETAIL_VIEWBOX.height} />
      <g ref={sceneRef} className="center-scene center-local-detail-scene" data-detail-level="standard" data-center-scene="local-structured-detail-01">
        <g clipPath="url(#center-local-detail-clip)">
          <DetailTerrain />
          <DetailRoads />
          <DetailCells />
          <g className="center-local-detail-layer center-local-detail-landmarks">
            {LOCAL_DETAIL_SCENE.landmarks.map(landmark => (
              <InteractiveLandmark
                key={landmark.id}
                landmark={landmark}
                interaction={interaction}
                language={language}
                onFocus={onFocus}
                onBlur={onBlur}
                onSelect={onSelect}
              />
            ))}
          </g>
        </g>
      </g>
      <DetailHud />
    </svg>
  )
}

export default CenterDetailPrototype
