function SurfaceEstateFabric({ anchor }) {
  return (
    <g
      className="center-fabric-asset center-fabric-asset--surface-estate"
      data-fabric-id="surface-estate"
      data-anchor-id="jijia"
      transform={`translate(${anchor.x} ${anchor.y}) scale(${anchor.scale})`}
    >
      <path className="center-fabric-ground-shadow" d="M -107 39 L -88 -55 L 79 -60 L 110 27 L 58 67 L -57 65 Z" />
      <path className="center-fabric-estate-yard" d="M -82 32 L -75 -42 L 71 -47 L 86 28 L 42 51 L -47 51 Z" />
      <path className="center-fabric-estate-wall-face" d="M -84 31 L -47 50 L 42 50 L 87 27 L 87 35 L 44 59 L -51 59 L -84 40 Z" />
      <path className="center-fabric-estate-wall" d="M -84 31 L -77 -45 L 73 -49 L 87 28 M -84 31 L -48 51 L -13 51 M 14 51 L 42 51 L 87 28" />
      <path className="center-fabric-estate-main-face" d="M -58 -18 L -4 10 L 47 -17 L 47 -3 L -4 25 L -58 -4 Z" />
      <path className="center-fabric-estate-main-roof" d="M -65 -22 L -10 -52 L 55 -20 L -4 13 Z" />
      <path className="center-fabric-estate-wing-face" d="M 29 10 L 60 27 L 86 12 L 86 24 L 60 39 L 29 22 Z" />
      <path className="center-fabric-estate-wing-roof" d="M 24 8 L 55 -10 L 91 9 L 60 28 Z" />
      <path className="center-fabric-estate-courtyard" d="M -43 28 L -5 8 L 36 29 L -4 49 Z" />
      <g className="center-fabric-trees">
        <circle cx="-66" cy="17" r="12" />
        <circle cx="-52" cy="30" r="9" />
        <circle cx="67" cy="31" r="10" />
      </g>
      <path className="center-fabric-estate-road-occlusion" d="M -18 51 L 16 51 L 17 61 L -18 61 Z" />
    </g>
  )
}

export default SurfaceEstateFabric
