function SurfaceRoadLayer() {
  const mainRoad = `
    M 24 318
    C 86 304, 137 273, 188 229
    C 228 247, 258 293, 300 332
    C 365 392, 438 441, 520 486
    C 580 519, 642 559, 720 614
  `

  const estateApproach = `
    M 188 229
    C 195 216, 198 205, 200 190
  `

  const councilApproach = `
    M 520 486
    C 535 492, 548 499, 560 510
  `

  const renderRoad = (d, key) => (
    <g key={key}>
      <path
        d={d}
        fill="none"
        stroke="rgba(142, 126, 101, 0.30)"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={d}
        fill="none"
        stroke="rgba(247, 239, 222, 0.72)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={d}
        fill="none"
        stroke="rgba(105, 91, 73, 0.48)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )

  return (
    <svg
      className="surface-road-layer"
      viewBox="0 0 1000 1000"
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
      {renderRoad(mainRoad, 'main-road')}
      {renderRoad(estateApproach, 'estate-approach')}
      {renderRoad(councilApproach, 'council-approach')}
    </svg>
  )
}

export default SurfaceRoadLayer
