function SurfaceCouncilMini({ anchor }) {
  return (
    <g
      className="center-mini-landmark-anchor"
      data-mini-landmark-id="surface-council"
      data-anchor-id="council"
      data-anchor-x={anchor.x}
      data-anchor-y={anchor.y}
      transform={`translate(${anchor.x} ${anchor.y}) scale(${anchor.scale})`}
    >
      <g className="center-mini-landmark center-mini-landmark--surface-council">
        <path className="center-mini-ground-shadow" d="M -139 40 L 12 -48 L 143 26 L 18 101 Z" />
        <path className="center-mini-council-plaza" d="M -125 25 L 0 -46 L 126 24 L 4 86 Z" />
        <path className="center-mini-council-ring-face" d="M -65 -2 A 65 34 0 0 0 65 -2 L 65 20 A 65 34 0 0 1 -65 20 Z" />
        <ellipse className="center-mini-council-ring" cx="0" cy="-5" rx="68" ry="37" />
        <ellipse className="center-mini-council-ring-cut" cx="0" cy="-5" rx="51" ry="27" />
        <path className="center-mini-council-main-face" d="M -45 -14 A 45 24 0 0 0 45 -14 L 45 5 A 45 24 0 0 1 -45 5 Z" />
        <ellipse className="center-mini-council-main-roof" cx="0" cy="-17" rx="48" ry="26" />
        <ellipse className="center-mini-council-crown-face" cx="0" cy="-34" rx="17" ry="8" />
        <ellipse className="center-mini-council-crown" cx="0" cy="-37" rx="18" ry="9" />
        <path className="center-mini-council-annex-face" d="M -122 4 L -77 29 L -77 42 L -122 17 Z M 122 3 L 77 29 L 77 42 L 122 16 Z" />
        <path className="center-mini-council-annex" d="M -124 0 L -87 -22 L -43 2 L -79 25 Z M 43 2 L 87 -23 L 125 -1 L 79 26 Z" />
        <path className="center-mini-council-walk-face" d="M -99 34 L -62 13 L -42 24 L -80 47 Z M 42 24 L 62 13 L 100 34 L 80 48 Z" />
        <path className="center-mini-council-walk" d="M -102 29 L -63 7 L -38 21 L -79 43 Z M 38 21 L 63 7 L 103 29 L 79 44 Z" />
        <path className="center-mini-council-entry-face" d="M -17 18 L 0 29 L 18 18 L 18 39 L 0 50 L -17 39 Z" />
        <path className="center-mini-council-entry" d="M -20 16 L 0 5 L 21 16 L 0 28 Z" />
        <path className="center-mini-council-axis" d="M 0 145 L 0 42 M -13 129 L 0 147 L 13 129" />
        <path className="center-mini-council-ring-lines" d="M -57 -17 A 60 31 0 0 1 57 -17 M -59 7 A 62 32 0 0 0 59 7" />
      </g>
    </g>
  )
}

export default SurfaceCouncilMini
