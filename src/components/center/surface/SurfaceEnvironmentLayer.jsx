const BUILDING_GROUPS = [
  { x: 92, y: 96, cols: 5, rows: 3, gapX: 20, gapY: 17, w: 12, h: 8 },
  { x: 112, y: 180, cols: 6, rows: 3, gapX: 18, gapY: 16, w: 11, h: 7 },
  { x: 250, y: 105, cols: 5, rows: 4, gapX: 19, gapY: 15, w: 11, h: 7 },
  { x: 290, y: 215, cols: 6, rows: 3, gapX: 18, gapY: 15, w: 11, h: 7 },
  { x: 390, y: 120, cols: 5, rows: 3, gapX: 18, gapY: 16, w: 11, h: 7 },
  { x: 430, y: 300, cols: 6, rows: 3, gapX: 18, gapY: 15, w: 11, h: 7 },
  { x: 650, y: 120, cols: 7, rows: 3, gapX: 18, gapY: 15, w: 11, h: 7 },
  { x: 680, y: 300, cols: 7, rows: 3, gapX: 18, gapY: 15, w: 11, h: 7 },
]

const TREE_CLUSTERS = [
  [70, 74], [85, 68], [102, 76], [118, 69], [285, 72], [300, 64], [317, 74],
  [620, 83], [636, 73], [652, 84], [670, 76], [740, 185], [756, 178], [772, 188],
  [325, 365], [341, 357], [358, 367], [814, 352], [830, 344], [846, 355],
]

function BuildingGroup({ group, index }) {
  const buildings = []
  for (let row = 0; row < group.rows; row += 1) {
    for (let col = 0; col < group.cols; col += 1) {
      const jitter = ((row * 7 + col * 11 + index * 3) % 5) - 2
      buildings.push(
        <g key={`${row}-${col}`} transform={`translate(${group.x + col * group.gapX + jitter} ${group.y + row * group.gapY}) rotate(${jitter * 0.8})`}>
          <rect
            x="0"
            y="0"
            width={group.w + (col % 2)}
            height={group.h + (row % 2)}
            rx="0.8"
            fill="rgba(225, 216, 198, 0.46)"
            stroke="rgba(63, 57, 49, 0.28)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`M 1 ${group.h - 1} L ${group.w - 1} 1`}
            stroke="rgba(63, 57, 49, 0.10)"
            strokeWidth="0.55"
            vectorEffect="non-scaling-stroke"
          />
        </g>,
      )
    }
  }
  return <g>{buildings}</g>
}

function SurfaceEnvironmentLayer() {
  return (
    <svg
      className="surface-environment-layer"
      viewBox="0 0 1000 500"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}
    >
      <defs>
        <filter id="environment-pencil" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="21" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" />
        </filter>
      </defs>

      <g filter="url(#environment-pencil)">
        {BUILDING_GROUPS.map((group, index) => <BuildingGroup key={`${group.x}-${group.y}`} group={group} index={index} />)}

        {TREE_CLUSTERS.map(([x, y], index) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <circle cx="0" cy="0" r={5 + (index % 3)} fill="rgba(111, 119, 91, 0.16)" stroke="rgba(62, 68, 53, 0.24)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
            <path d="M -4 1 C -2 -4, 3 -5, 5 0 C 3 4, -2 5, -4 1 Z" fill="none" stroke="rgba(62, 68, 53, 0.16)" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
          </g>
        ))}

        <path d="M 310 58 C 344 72, 371 88, 394 112 C 418 138, 428 164, 421 188" fill="none" stroke="rgba(88, 96, 91, 0.15)" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d="M 310 58 C 344 72, 371 88, 394 112 C 418 138, 428 164, 421 188" fill="none" stroke="rgba(70, 76, 72, 0.18)" strokeWidth="0.9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        <path d="M 735 87 C 760 105, 779 125, 789 148 C 800 174, 798 200, 784 225" fill="none" stroke="rgba(88, 96, 91, 0.13)" strokeWidth="4.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d="M 735 87 C 760 105, 779 125, 789 148 C 800 174, 798 200, 784 225" fill="none" stroke="rgba(70, 76, 72, 0.16)" strokeWidth="0.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}

export default SurfaceEnvironmentLayer
