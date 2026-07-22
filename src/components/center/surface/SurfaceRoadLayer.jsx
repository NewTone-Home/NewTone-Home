function SurfaceRoadLayer() {
  const mainRoads = [
    { id: 'west-east', d: 'M -30 320 C 110 324, 220 303, 322 274 C 430 244, 533 240, 646 263 C 774 289, 883 327, 1030 340' },
    { id: 'north-south', d: 'M 138 -30 C 157 56, 178 121, 204 181 C 239 262, 286 350, 356 530' },
    { id: 'north-arc', d: 'M 270 -20 C 342 54, 414 108, 501 137 C 596 168, 703 170, 817 151 C 895 138, 962 136, 1030 144' },
  ]

  const secondaryRoads = [
    { id: 'estate-west', d: 'M -20 170 C 63 171, 124 151, 168 126 C 183 117, 194 108, 204 99 C 219 113, 243 132, 278 149' },
    { id: 'estate-south', d: 'M 200 116 C 230 146, 260 171, 298 194 C 340 219, 383 241, 430 260' },
    { id: 'mid-north', d: 'M 346 36 C 373 95, 402 145, 438 186 C 473 226, 516 250, 562 270' },
    { id: 'mid-south', d: 'M 246 458 C 314 394, 376 349, 444 319 C 516 287, 589 279, 663 292' },
    { id: 'east-sweep', d: 'M 560 270 C 637 267, 710 281, 785 311 C 870 345, 944 368, 1030 379' },
    { id: 'south-east', d: 'M 420 520 C 482 430, 548 374, 625 343 C 713 307, 807 309, 904 334 C 954 347, 995 362, 1030 378' },
  ]

  const localRoads = [
    { id: 'estate-ring-a', d: 'M 154 123 C 156 90, 176 70, 205 70 C 237 70, 260 91, 260 119 C 260 145, 239 163, 211 164 C 180 165, 157 148, 154 123 Z' },
    { id: 'estate-ring-b', d: 'M 171 123 C 173 99, 187 85, 207 85 C 229 85, 244 100, 244 120 C 244 139, 229 151, 209 152' },
    { id: 'council-ring-a', d: 'M 478 252 C 478 216, 514 193, 559 193 C 609 193, 649 218, 649 253 C 649 289, 611 313, 560 313 C 513 313, 478 288, 478 252 Z' },
    { id: 'council-ring-b', d: 'M 498 252 C 498 226, 524 209, 559 209 C 597 209, 627 227, 627 253 C 627 279, 598 296, 560 296 C 525 296, 498 278, 498 252 Z' },
    { id: 'council-west', d: 'M 478 252 C 455 253, 443 256, 430 260' },
    { id: 'council-east', d: 'M 649 253 C 682 258, 711 269, 743 287' },
    { id: 'council-north', d: 'M 559 193 C 558 176, 553 160, 546 145' },
    { id: 'council-south', d: 'M 560 313 C 565 328, 575 343, 591 356' },
    { id: 'west-grid-1', d: 'M 82 228 C 137 212, 181 204, 224 205' },
    { id: 'west-grid-2', d: 'M 98 266 C 151 248, 201 240, 257 242' },
    { id: 'mid-grid-1', d: 'M 300 226 C 335 191, 367 171, 405 158' },
    { id: 'mid-grid-2', d: 'M 338 294 C 372 279, 405 271, 441 267' },
    { id: 'east-grid-1', d: 'M 676 205 C 728 212, 773 225, 820 247' },
    { id: 'east-grid-2', d: 'M 694 248 C 743 254, 789 268, 837 292' },
  ]

  const renderSketchRoad = (road, width, tone, wobbleId) => (
    <g key={road.id} filter={`url(#${wobbleId})`}>
      <path d={road.d} fill="none" stroke="rgba(69, 61, 50, 0.12)" strokeWidth={width + 3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={road.d} fill="none" stroke="rgba(239, 230, 213, 0.94)" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={road.d} fill="none" stroke={tone} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </g>
  )

  return (
    <svg
      className="surface-road-layer"
      viewBox="0 0 1000 500"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}
    >
      <defs>
        <filter id="road-wobble-a" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.018" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.25" />
        </filter>
        <filter id="road-wobble-b" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.024" numOctaves="2" seed="13" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.9" />
        </filter>
      </defs>

      {mainRoads.map(road => renderSketchRoad(road, 10, 'rgba(72, 63, 51, 0.35)', 'road-wobble-a'))}
      {secondaryRoads.map(road => renderSketchRoad(road, 6.5, 'rgba(72, 63, 51, 0.30)', 'road-wobble-b'))}
      {localRoads.map(road => renderSketchRoad(road, 3.5, 'rgba(72, 63, 51, 0.24)', 'road-wobble-b'))}
    </svg>
  )
}

export default SurfaceRoadLayer
