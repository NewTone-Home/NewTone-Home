import { centerText, getCenterEntity } from '../data/centerScene'
import { resolveEntityVisualState } from '../interaction/centerInteraction'
import {
  DETAIL_PROTOTYPE,
  DETAIL_PROTOTYPE_VIEWBOX,
  detailHeightAt,
  detailProject,
} from '../geometry/detailPrototype'

function entityKeyDown(event, entityId, onSelect) {
  if (!entityId || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  onSelect(entityId, 'keyboard')
}

function DetailTerrain() {
  const { mesh, boundaryPath, mountains, hydrology, roads } = DETAIL_PROTOTYPE
  return (
    <g className="center-detail-layer center-detail-terrain" aria-hidden="true">
      <path className="center-detail-terrain__surface" d={boundaryPath} />
      <g className="center-detail-terrain__faces">
        {mesh.facePaths.map((d, index) => <path key={`detail-face-${index}`} className={`center-detail-terrain__face center-detail-terrain__face--${index}`} d={d} />)}
      </g>
      <g className="center-detail-terrain__mesh">
        {mesh.edgePaths.map((d, index) => <path key={`detail-mesh-${index}`} className={`center-detail-terrain__mesh-path center-detail-terrain__mesh-path--${index}`} d={d} />)}
      </g>
      <g className="center-detail-terrain__mountains">
        {mountains.map(mountain => (
          <g key={mountain.id} className={`center-detail-mountain center-detail-mountain--${mountain.tone}`}>
            <g className="center-detail-mountain__facets">
              {mountain.facetPaths.map((d, index) => <path key={`${mountain.id}-facet-${index}`} d={d} />)}
            </g>
            {mountain.ringPaths.map((d, index) => <path key={`${mountain.id}-ring-${index}`} className={`center-detail-mountain__ring center-detail-mountain__ring--${index}`} d={d} />)}
            <path className="center-detail-mountain__spokes" d={mountain.spokePath} />
            <circle className="center-detail-mountain__summit" cx={mountain.summit[0]} cy={mountain.summit[1]} r="2.2" />
          </g>
        ))}
      </g>
      <g className="center-detail-terrain__hydrology">
        {hydrology.banks.map((d, index) => <path key={`detail-bank-${index}`} className="center-detail-river__bank" d={d} />)}
        <path className="center-detail-river__water" d={hydrology.water} />
        {hydrology.microLines.map((d, index) => <path key={`detail-water-line-${index}`} className="center-detail-river__micro" d={d} />)}
        {hydrology.tributaries.map((d, index) => <path key={`detail-tributary-${index}`} className="center-detail-river__tributary" d={d} />)}
      </g>
      <path className="center-detail-roads__courtyards" d={roads.courtyards} />
      <path className="center-detail-roads__paths" d={roads.paths} />
      <path className="center-detail-terrain__boundary" d={boundaryPath} />
    </g>
  )
}

function StaticBuildings() {
  const { staticBuildings } = DETAIL_PROTOTYPE
  return (
    <g className="center-detail-layer center-detail-buildings center-detail-buildings--static" aria-hidden="true">
      <path className="center-detail-building__ground" d={staticBuildings.map(building => building.ground).join(' ')} />
      <path className="center-detail-building__silhouette" d={staticBuildings.map(building => building.silhouette).join(' ')} />
      <path className="center-detail-building__detail" d={staticBuildings.map(building => building.detail).join(' ')} />
    </g>
  )
}

function InteractiveBuilding({ building, interaction, language, onFocus, onBlur, onSelect }) {
  const entity = getCenterEntity(building.entityId)
  const state = resolveEntityVisualState(interaction, building.entityId)
  const label = entity ? centerText(entity.name, language) : building.entityId
  const anchor = DETAIL_PROTOTYPE.anchors.find(item => item.entityId === building.entityId)
  const labelPoint = anchor?.labelProjected || detailProject(building.x, building.y, detailHeightAt(building.x, building.y) + .4)
  const point = anchor?.projected || detailProject(building.x, building.y, building.height + .3)

  return (
    <g
      className={`center-detail-building center-detail-building--interactive center-detail-tone--${building.tone}`}
      data-center-entity-id={building.entityId}
      data-center-entity-interactive="true"
      data-entity-state={state}
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerEnter={event => event.pointerType !== 'touch' && onFocus(building.entityId)}
      onPointerLeave={() => onBlur(building.entityId)}
      onFocus={() => onFocus(building.entityId)}
      onBlur={() => onBlur(building.entityId)}
      onClick={event => { event.stopPropagation(); onSelect(building.entityId, event.detail === 0 ? 'keyboard' : 'pointer') }}
      onKeyDown={event => entityKeyDown(event, building.entityId, onSelect)}
    >
      <path className="center-detail-building__ground" d={building.ground} />
      <path className="center-detail-building__silhouette" d={building.silhouette} />
      <path className="center-detail-building__detail" d={building.detail} />
      <path className="center-detail-building__hit" d={building.hit} />
      <path className="center-detail-anchor__leader" d={`M${point[0]} ${point[1]} L${labelPoint[0]} ${labelPoint[1]}`} />
      <circle className="center-detail-anchor__ring" cx={point[0]} cy={point[1]} r="10" />
      <circle className="center-detail-anchor__dot" cx={point[0]} cy={point[1]} r="2.6" />
      <text className="center-detail-anchor__label" x={labelPoint[0]} y={labelPoint[1] - 6} textAnchor={labelPoint[0] < point[0] ? 'end' : 'start'}>{label}</text>
    </g>
  )
}

function DetailLabels() {
  const labels = [
    { text: 'RIDGE FACETS', point: [1.1, 1.28], z: 1.1, anchor: 'start' },
    { text: 'RIVER VALLEY', point: [7.3, 8.55], z: .35, anchor: 'middle' },
    { text: 'LOCAL SETTLEMENT STUDY', point: [8.7, 9.42], z: .25, anchor: 'middle' },
  ]
  return (
    <g className="center-detail-layer center-detail-labels" aria-hidden="true">
      {labels.map(label => {
        const point = detailProject(label.point[0], label.point[1], label.z)
        return <text key={label.text} x={point[0]} y={point[1]} textAnchor={label.anchor}>{label.text}</text>
      })}
    </g>
  )
}

function DetailHud() {
  return (
    <g className="center-detail-hud" aria-hidden="true">
      <text x="92" y="144">LOCAL SECTOR / 01</text>
      <path d="M92 156 H238" />
      <text x="92" y="178">TRIANGULATED RELIEF STUDY</text>
      <g transform="translate(1338 154)">
        <text x="0" y="0">LINE KEY</text>
        <path className="center-detail-hud__warm" d="M0 18 H42" />
        <text x="56" y="22">RIDGE / STRUCTURE</text>
        <path className="center-detail-hud__cool" d="M0 43 H42" />
        <text x="56" y="47">WATER / SIGNAL</text>
        <path className="center-detail-hud__mesh" d="M0 68 H42" />
        <text x="56" y="72">TERRAIN MESH</text>
      </g>
    </g>
  )
}

function CenterDetailPrototype({ canvasRef, sceneRef, interaction, language, label, onFocus, onBlur, onSelect, onClear }) {
  return (
    <svg
      ref={canvasRef}
      className="center-map center-detail-map"
      viewBox={`0 0 ${DETAIL_PROTOTYPE_VIEWBOX.width} ${DETAIL_PROTOTYPE_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${label} — local detail prototype`}
      onClick={onClear}
    >
      <title>{`${label} — local detail prototype`}</title>
      <defs>
        <radialGradient id="center-detail-vignette" cx="50%" cy="44%" r="72%">
          <stop offset="0" stopColor="#162021" stopOpacity=".08" />
          <stop offset=".68" stopColor="#071012" stopOpacity=".18" />
          <stop offset="1" stopColor="#040809" stopOpacity=".9" />
        </radialGradient>
        <linearGradient id="center-detail-wire-gradient" x1="0%" y1="15%" x2="100%" y2="85%">
          <stop offset="0" stopColor="#e5c88e" />
          <stop offset=".52" stopColor="#b7b7a3" />
          <stop offset="1" stopColor="#7daebc" />
        </linearGradient>
        <pattern id="center-detail-grid-pattern" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M56 0 H0 V56" fill="none" stroke="#a6b2ab" strokeOpacity=".055" strokeWidth=".6" />
          <circle cx="7" cy="9" r=".7" fill="#d3bd87" fillOpacity=".18" />
        </pattern>
        <filter id="center-detail-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="center-detail-tile-clip"><path d={DETAIL_PROTOTYPE.boundaryPath} /></clipPath>
      </defs>
      <rect className="center-detail-map__backdrop" width={DETAIL_PROTOTYPE_VIEWBOX.width} height={DETAIL_PROTOTYPE_VIEWBOX.height} />
      <rect className="center-detail-map__grid" width={DETAIL_PROTOTYPE_VIEWBOX.width} height={DETAIL_PROTOTYPE_VIEWBOX.height} />
      <rect className="center-detail-map__vignette" width={DETAIL_PROTOTYPE_VIEWBOX.width} height={DETAIL_PROTOTYPE_VIEWBOX.height} />
      <g ref={sceneRef} className="center-scene center-detail-scene" data-detail-level="prototype" data-center-scene="local-detail-01">
        <g clipPath="url(#center-detail-tile-clip)">
          <DetailTerrain />
          <StaticBuildings />
          <g className="center-detail-layer center-detail-buildings center-detail-buildings--interactive">
            {DETAIL_PROTOTYPE.interactiveBuildings.map(building => (
              <InteractiveBuilding
                key={building.id}
                building={building}
                interaction={interaction}
                language={language}
                onFocus={onFocus}
                onBlur={onBlur}
                onSelect={onSelect}
              />
            ))}
          </g>
          <DetailLabels />
        </g>
      </g>
      <DetailHud />
    </svg>
  )
}

export default CenterDetailPrototype
