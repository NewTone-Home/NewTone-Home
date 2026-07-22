function SurfaceRegionLayer() {
  return (
    <svg
      className="surface-region-layer"
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
        d="
          M 0.070 0.115
          C 0.105 0.085, 0.185 0.080, 0.245 0.105
          C 0.290 0.125, 0.325 0.165, 0.315 0.205
          C 0.302 0.245, 0.245 0.270, 0.182 0.260
          C 0.125 0.252, 0.085 0.225, 0.072 0.185
          C 0.060 0.155, 0.060 0.135, 0.070 0.115
          Z
        "
        fill="rgba(71,65,56,0.16)"
        stroke="rgba(71,65,56,0.48)"
        strokeWidth="0.0022"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="
          M 0.405 0.405
          C 0.455 0.360, 0.545 0.350, 0.610 0.385
          C 0.662 0.415, 0.690 0.470, 0.675 0.525
          C 0.658 0.585, 0.590 0.620, 0.515 0.610
          C 0.455 0.600, 0.405 0.565, 0.390 0.515
          C 0.378 0.470, 0.385 0.430, 0.405 0.405
          Z
        "
        fill="rgba(71,65,56,0.16)"
        stroke="rgba(71,65,56,0.48)"
        strokeWidth="0.0022"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default SurfaceRegionLayer
