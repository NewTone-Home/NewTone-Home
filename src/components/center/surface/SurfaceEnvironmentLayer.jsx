import { surfaceEnvironment } from './surfaceWorldData'

function TreeCluster({ item }) {
  return (
    <g>
      {item.points.map((p, i) => (
        <circle
          key={i}
          cx={item.x + p.x}
          cy={item.y + p.y}
          r={0.012}
          fill="rgba(113, 124, 98, 0.30)"
          stroke="rgba(61, 70, 55, 0.26)"
          strokeWidth={0.0006}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

function RockFormation({ item }) {
  return (
    <path
      d={item.d}
      fill="rgba(151, 145, 126, 0.18)"
      stroke="rgba(71, 65, 56, 0.22)"
      strokeWidth={0.0008}
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function SurfaceEnvironmentLayer() {
  return (
    <svg
      className="surface-environment-layer"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {surfaceEnvironment.map(item => {
        if (item.kind === 'trees') return <TreeCluster key={item.id} item={item} />
        if (item.kind === 'rocks') return <RockFormation key={item.id} item={item} />
        return null
      })}
    </svg>
  )
}

export default SurfaceEnvironmentLayer
