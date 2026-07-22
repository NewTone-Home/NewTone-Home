function SurfaceCouncilFabric({ anchor }) {
  return (
    <g
      className="center-fabric-asset center-fabric-asset--surface-council"
      data-fabric-id="surface-council"
      data-anchor-id="council"
      transform={`translate(${anchor.x} ${anchor.y}) scale(${anchor.scale})`}
    >
      <path className="center-fabric-ground-shadow" d="M -106 34 L 11 -32 L 116 25 L 15 82 Z" />
      <path className="center-fabric-council-plaza" d="M -98 21 L 0 -34 L 99 20 L 2 66 Z" />
      <path className="center-fabric-council-plinth-face" d="M -49 1 A 49 25 0 0 0 49 1 L 49 14 A 49 25 0 0 1 -49 14 Z" />
      <ellipse className="center-fabric-council-plinth" cx="0" cy="0" rx="52" ry="28" />
      <path className="center-fabric-council-main-face" d="M -39 -7 A 39 20 0 0 0 39 -7 L 39 7 A 39 20 0 0 1 -39 7 Z" />
      <ellipse className="center-fabric-council-main-roof" cx="0" cy="-9" rx="41" ry="22" />
      <path className="center-fabric-council-annex-face" d="M -91 8 L -58 26 L -58 35 L -91 17 Z M 91 7 L 57 26 L 57 35 L 91 16 Z" />
      <path className="center-fabric-council-annex" d="M -93 5 L -63 -12 L -31 5 L -59 22 Z M 31 5 L 63 -13 L 94 4 L 60 23 Z" />
      <path className="center-fabric-council-walk" d="M -70 25 L -39 8 L -24 16 L -55 33 Z M 24 16 L 39 8 L 71 25 L 55 34 Z" />
      <path className="center-fabric-council-axis" d="M 0 112 L 0 23" />
    </g>
  )
}

export default SurfaceCouncilFabric
