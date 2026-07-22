function SurfaceRoadLayer() {
  const roadPath = `
    M 0.090 0.300
    C 0.145 0.275, 0.185 0.235, 0.220 0.215
    C 0.275 0.255, 0.310 0.315, 0.365 0.355
    C 0.425 0.400, 0.500 0.435, 0.575 0.475
  `

  return (
    <svg
      className="surface-road-layer"
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
      <path
        d={roadPath}
        fill="none"
        stroke="rgba(119,108,92,0.28)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={roadPath}
        fill="none"
        stroke="rgba(86,78,68,0.55)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default SurfaceRoadLayer
