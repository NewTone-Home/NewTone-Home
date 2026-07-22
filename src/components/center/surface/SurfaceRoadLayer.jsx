function SurfaceRoadLayer() {
  const westRoad = `
    M 18 150
    C 82 145, 137 126, 184 108
  `

  const estateToCouncil = `
    M 212 116
    C 275 145, 332 181, 391 205
    C 454 231, 508 246, 551 266
  `

  const renderRoad = (d, key) => (
    <g key={key}>
      <path
        d={d}
        fill="none"
        stroke="rgba(151, 133, 104, 0.20)"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={d}
        fill="none"
        stroke="rgba(231, 220, 199, 0.88)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )

  return (
    <svg
      className="surface-road-layer"
      viewBox="0 0 1000 500"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {renderRoad(westRoad, 'west-road')}
      {renderRoad(estateToCouncil, 'estate-to-council')}
    </svg>
  )
}

export default SurfaceRoadLayer
