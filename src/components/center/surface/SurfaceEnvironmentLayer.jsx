const COUNCIL_BLOCKS = [
  {
    id: 'north-west',
    transform: 'translate(410 168) rotate(-6)',
    buildings: [
      ['rect', 0, 0, 28, 12], ['l', 34, 2, 24, 18], ['rect', 66, 0, 18, 10],
      ['court', 4, 22, 34, 24], ['rect', 45, 27, 20, 10], ['rect', 70, 22, 26, 13],
      ['rect', 2, 54, 22, 10], ['l', 30, 49, 30, 20], ['rect', 69, 50, 20, 12],
    ],
  },
  {
    id: 'north-east',
    transform: 'translate(595 165) rotate(5)',
    buildings: [
      ['rect', 0, 2, 24, 11], ['rect', 31, 0, 18, 9], ['l', 56, 2, 28, 20],
      ['court', 1, 20, 38, 25], ['rect', 47, 24, 22, 11], ['rect', 75, 27, 18, 9],
      ['rect', 5, 52, 20, 10], ['l', 33, 48, 26, 22], ['rect', 67, 52, 25, 11],
    ],
  },
  {
    id: 'south-west',
    transform: 'translate(405 308) rotate(4)',
    buildings: [
      ['l', 0, 0, 28, 20], ['rect', 36, 3, 24, 10], ['rect', 67, 0, 22, 12],
      ['rect', 4, 28, 20, 10], ['court', 31, 22, 36, 25], ['rect', 73, 26, 18, 10],
      ['rect', 0, 55, 26, 11], ['rect', 33, 54, 20, 9], ['l', 61, 50, 30, 20],
    ],
  },
  {
    id: 'south-east',
    transform: 'translate(600 308) rotate(-5)',
    buildings: [
      ['rect', 0, 1, 22, 10], ['l', 29, 0, 28, 20], ['rect', 65, 2, 24, 10],
      ['rect', 4, 26, 18, 9], ['court', 29, 22, 38, 25], ['rect', 74, 27, 20, 10],
      ['l', 0, 50, 28, 20], ['rect', 36, 55, 20, 9], ['rect', 65, 52, 26, 11],
    ],
  },
]

const TREE_CLUSTERS = [
  [455, 150], [480, 144], [505, 148], [650, 154], [674, 162], [690, 177],
  [432, 382], [457, 389], [485, 383], [636, 385], [662, 391], [686, 381],
]

function SketchRect({ x, y, w, h }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M 0 1 L ${w - 1} 0 L ${w} ${h - 1} L 1 ${h} Z`}
        fill="rgba(226, 216, 197, 0.34)"
        stroke="rgba(62, 56, 49, 0.44)"
        strokeWidth="0.9"
        vectorEffect="non-scaling-stroke"
      />
      <path d={`M 2 ${h - 2} L ${w - 2} 2`} stroke="rgba(62, 56, 49, 0.16)" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
    </g>
  )
}

function SketchL({ x, y, w, h }) {
  const cutX = Math.round(w * 0.48)
  const cutY = Math.round(h * 0.5)
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M 0 0 L ${w} 1 L ${w - 1} ${cutY} L ${cutX} ${cutY} L ${cutX} ${h} L 1 ${h - 1} Z`}
        fill="rgba(223, 213, 194, 0.34)"
        stroke="rgba(61, 55, 48, 0.45)"
        strokeWidth="0.9"
        vectorEffect="non-scaling-stroke"
      />
      <path d={`M 3 ${h - 3} L ${cutX - 2} ${cutY + 2}`} stroke="rgba(61, 55, 48, 0.15)" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
    </g>
  )
}

function SketchCourt({ x, y, w, h }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M 0 0 L ${w} 1 L ${w - 1} ${h} L 1 ${h - 1} Z M 8 7 L ${w - 8} 7 L ${w - 8} ${h - 7} L 8 ${h - 7} Z`}
        fill="rgba(226, 216, 197, 0.30)"
        fillRule="evenodd"
        stroke="rgba(62, 56, 49, 0.44)"
        strokeWidth="0.9"
        vectorEffect="non-scaling-stroke"
      />
      <path d={`M 10 ${h / 2} L ${w - 10} ${h / 2}`} stroke="rgba(62, 56, 49, 0.14)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
    </g>
  )
}

function Building({ item, index }) {
  const [kind, x, y, w, h] = item
  const rotation = ((index * 7) % 5) - 2
  const content = kind === 'l'
    ? <SketchL x={0} y={0} w={w} h={h} />
    : kind === 'court'
      ? <SketchCourt x={0} y={0} w={w} h={h} />
      : <SketchRect x={0} y={0} w={w} h={h} />

  return <g transform={`translate(${x} ${y}) rotate(${rotation * 0.5})`}>{content}</g>
}

function CouncilBlock({ block }) {
  return (
    <g transform={block.transform}>
      <path
        d="M -8 -10 C 22 -18 73 -16 104 -3 C 111 20 110 51 99 78 C 68 86 23 86 -8 73 C -14 48 -14 16 -8 -10 Z"
        fill="rgba(185, 171, 145, 0.045)"
        stroke="rgba(80, 71, 60, 0.18)"
        strokeWidth="0.8"
        strokeDasharray="5 7"
        vectorEffect="non-scaling-stroke"
      />
      {block.buildings.map((item, index) => <Building key={`${block.id}-${index}`} item={item} index={index} />)}
      <path d="M 18 -5 C 20 18 19 48 17 77" fill="none" stroke="rgba(70, 63, 55, 0.20)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      <path d="M 58 -6 C 58 18 59 49 60 78" fill="none" stroke="rgba(70, 63, 55, 0.18)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      <path d="M -5 17 C 24 19 66 18 101 16" fill="none" stroke="rgba(70, 63, 55, 0.18)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      <path d="M -5 47 C 25 46 67 48 101 49" fill="none" stroke="rgba(70, 63, 55, 0.16)" strokeWidth="0.65" vectorEffect="non-scaling-stroke" />
    </g>
  )
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
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.75" />
        </filter>
      </defs>

      <g filter="url(#environment-pencil)">
        <g className="surface-council-sample">
          <ellipse cx="560" cy="252" rx="104" ry="78" fill="rgba(179, 163, 135, 0.045)" stroke="rgba(68, 61, 53, 0.20)" strokeWidth="0.9" strokeDasharray="8 9" vectorEffect="non-scaling-stroke" />
          <ellipse cx="560" cy="252" rx="76" ry="56" fill="none" stroke="rgba(68, 61, 53, 0.17)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <ellipse cx="560" cy="252" rx="48" ry="35" fill="rgba(214, 203, 184, 0.20)" stroke="rgba(60, 54, 47, 0.32)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M 520 250 C 536 236 583 235 600 251 C 587 269 536 270 520 250 Z" fill="rgba(218, 208, 190, 0.32)" stroke="rgba(58, 52, 45, 0.42)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M 532 248 L 545 238 L 575 238 L 589 248 L 574 254 L 546 254 Z" fill="rgba(204, 192, 171, 0.42)" stroke="rgba(55, 49, 43, 0.48)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
          <path d="M 545 255 L 575 255 L 576 266 L 544 266 Z" fill="rgba(188, 176, 158, 0.26)" stroke="rgba(55, 49, 43, 0.30)" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
          <path d="M 560 217 L 560 236 M 560 267 L 560 288 M 507 252 L 483 252 M 613 252 L 638 252" stroke="rgba(62, 55, 48, 0.28)" strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>

        {COUNCIL_BLOCKS.map(block => <CouncilBlock key={block.id} block={block} />)}

        {TREE_CLUSTERS.map(([x, y], index) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <circle cx="0" cy="0" r={5 + (index % 3)} fill="rgba(111, 119, 91, 0.13)" stroke="rgba(62, 68, 53, 0.30)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
            <circle cx={3 + (index % 2)} cy={-2} r={3.2} fill="none" stroke="rgba(62, 68, 53, 0.18)" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
          </g>
        ))}

        <path d="M 384 145 C 403 131 428 124 452 125" fill="none" stroke="rgba(71, 65, 57, 0.16)" strokeWidth="0.8" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        <path d="M 668 132 C 694 137 718 150 737 169" fill="none" stroke="rgba(71, 65, 57, 0.16)" strokeWidth="0.8" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        <path d="M 380 395 C 409 404 436 404 461 398" fill="none" stroke="rgba(71, 65, 57, 0.15)" strokeWidth="0.8" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        <path d="M 661 399 C 693 399 719 390 741 373" fill="none" stroke="rgba(71, 65, 57, 0.15)" strokeWidth="0.8" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}

export default SurfaceEnvironmentLayer
