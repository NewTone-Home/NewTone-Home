function SurfaceEstateMini({ anchor }) {
  return (
    <g
      className="center-mini-landmark-anchor"
      data-mini-landmark-id="surface-estate"
      data-anchor-id="jijia"
      data-anchor-x={anchor.x}
      data-anchor-y={anchor.y}
      transform={`translate(${anchor.x} ${anchor.y}) scale(${anchor.scale})`}
    >
      <g className="center-mini-landmark center-mini-landmark--surface-estate">
        <path className="center-mini-ground-shadow" d="M -132 45 L -106 -72 L 98 -77 L 130 32 L 66 81 L -73 77 Z" />
        <path className="center-mini-estate-yard" d="M -110 37 L -101 -61 L 88 -66 L 111 33 L 57 63 L -65 63 Z" />
        <path className="center-mini-estate-wall-face" d="M -111 36 L -66 63 L -22 63 L -22 75 L -70 75 L -111 49 Z M 23 63 L 57 63 L 112 32 L 112 45 L 61 76 L 23 76 Z" />
        <path className="center-mini-estate-wall" d="M -111 37 L -103 -63 L 90 -68 L 112 33 M -111 37 L -66 64 L -22 64 M 23 64 L 57 64 L 112 33" />
        <path className="center-mini-estate-main-face" d="M -70 -25 L -3 11 L 61 -24 L 61 -5 L -3 31 L -70 -6 Z" />
        <path className="center-mini-estate-main-roof" d="M -78 -30 L -12 -67 L 70 -27 L -3 15 Z" />
        <path className="center-mini-estate-roof-ribs" d="M -61 -30 L -5 1 M -43 -40 L 10 -10 M 40 -40 L -1 2 M 57 -31 L 11 0" />
        <path className="center-mini-estate-left-face" d="M -103 5 L -70 23 L -40 6 L -40 22 L -70 40 L -103 22 Z" />
        <path className="center-mini-estate-left-roof" d="M -109 1 L -76 -18 L -34 3 L -70 25 Z" />
        <path className="center-mini-estate-right-face" d="M 35 12 L 73 33 L 105 14 L 105 31 L 73 50 L 35 29 Z" />
        <path className="center-mini-estate-right-roof" d="M 29 8 L 68 -14 L 112 10 L 73 35 Z" />
        <path className="center-mini-estate-courtyard" d="M -49 35 L -5 11 L 44 36 L -4 61 Z" />
        <path className="center-mini-estate-courtyard-lines" d="M -34 37 L -4 53 L 29 36 M -20 29 L 11 46" />
        <path className="center-mini-estate-gate-face" d="M -22 61 L 1 73 L 24 61 L 24 82 L 1 94 L -22 82 Z" />
        <path className="center-mini-estate-gate" d="M -25 58 L 1 44 L 27 58 L 1 74 Z" />
        <g className="center-mini-estate-trees">
          <circle cx="-83" cy="24" r="17" />
          <circle cx="-65" cy="42" r="13" />
          <circle cx="78" cy="43" r="14" />
          <circle cx="94" cy="27" r="10" />
        </g>
        <path className="center-mini-estate-entry-path" d="M 1 94 L 1 137 M -11 126 L 1 139 L 13 126" />
      </g>
    </g>
  )
}

export default SurfaceEstateMini
