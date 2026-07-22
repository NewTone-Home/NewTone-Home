import { centerMiniLandmarks } from '../../data/center/centerWorld'
import { sharedWorldGeometry } from '../../data/center/sharedWorldGeometry'
import SurfaceCouncilFabric from './fabric/SurfaceCouncilFabric'
import SurfaceEstateFabric from './fabric/SurfaceEstateFabric'
import SurfaceEstateMini from './mini/SurfaceEstateMini'

function GeometryPaths({ items, groupName }) {
  return (
    <g className={`center-shared-${groupName}`}>
      {items.map(item => (
        <path
          key={item.id}
          className={`center-shared-path center-shared-path--${item.kind}`}
          data-geometry-id={item.id}
          d={item.d}
        />
      ))}
    </g>
  )
}

function SharedWorldFabric({ world, anchors }) {
  if (world !== 'surface') return null

  return (
    <g
      className={`center-shared-fabric center-shared-fabric--${world}`}
      data-presentation-only="true"
      data-derived-from="sharedWorldGeometry.anchors"
    >
      <SurfaceEstateFabric anchor={anchors.jijia} />
      <SurfaceCouncilFabric anchor={anchors.council} />
    </g>
  )
}

// surface-council mini is now a real art layer (central-council-mini.png) drawn
// in SurfaceWorldSkin, so it is intentionally absent here to avoid a double
// outline. Estate keeps its geometry-derived SVG mini for this batch.
const MINI_LANDMARK_COMPONENTS = {
  'surface-estate': SurfaceEstateMini,
}

function MiniLandmark({ previewNodeId, world, anchors }) {
  const config = previewNodeId ? centerMiniLandmarks[previewNodeId] : null
  if (!config || config.world !== world) return null

  const Landmark = MINI_LANDMARK_COMPONENTS[previewNodeId]
  return Landmark ? <Landmark anchor={anchors[config.anchorId]} /> : null
}

function SharedWorldMap({ world, previewNodeId = null }) {
  const { anchors, districts, infrastructure, roads, viewBox } = sharedWorldGeometry
  const buriedInfrastructure = infrastructure.filter(item => item.kind === 'drainage' || item.kind === 'pipeline')
  const elevatedInfrastructure = infrastructure.filter(item => item.kind !== 'drainage' && item.kind !== 'pipeline')

  return (
    <svg
      className={`center-shared-world center-shared-world--${world}`}
      data-world={world}
      data-viewbox={viewBox}
      viewBox={viewBox}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <GeometryPaths items={districts} groupName="districts" />
      <GeometryPaths items={buriedInfrastructure} groupName="infrastructure center-shared-infrastructure--buried" />
      <GeometryPaths items={roads} groupName="roads" />
      <SharedWorldFabric world={world} anchors={anchors} />
      <GeometryPaths items={elevatedInfrastructure} groupName="infrastructure center-shared-infrastructure--elevated" />

      {world === 'inner' && (
        <g className="center-shared-anomalies">
          <path className="center-shared-echo center-shared-echo--road" d={roads[0].d} />
          <path className="center-shared-echo center-shared-echo--axis" d={roads[5].d} />
          <path className="center-shared-echo center-shared-echo--district" d={districts[2].d} />
          <path className="center-shared-echo center-shared-echo--pipeline" d={infrastructure[2].d} />
        </g>
      )}

      <MiniLandmark previewNodeId={previewNodeId} world={world} anchors={anchors} />
    </svg>
  )
}

export default SharedWorldMap
