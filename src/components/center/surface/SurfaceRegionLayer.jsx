function SurfaceRegionLayer() {
  return (
    <svg
      className="surface-region-layer"
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
      <defs>
        <linearGradient id="surface-estate-wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(116, 125, 96, 0.13)" />
          <stop offset="1" stopColor="rgba(168, 151, 119, 0.035)" />
        </linearGradient>
        <radialGradient id="surface-council-wash" cx="50%" cy="48%" r="65%">
          <stop offset="0" stopColor="rgba(155, 139, 112, 0.12)" />
          <stop offset="1" stopColor="rgba(155, 139, 112, 0.025)" />
        </radialGradient>
      </defs>

      <g className="surface-region surface-region--estate">
        <path
          d="M 66 110 C 108 72 185 66 244 88 C 302 109 352 151 356 208 C 360 264 322 315 258 337 C 198 357 126 341 86 299 C 50 261 38 205 48 162 C 52 141 58 123 66 110 Z"
          fill="url(#surface-estate-wash)"
          stroke="rgba(76, 78, 64, 0.46)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 92 132 C 137 103 198 98 246 114 C 292 130 323 161 326 205 C 329 245 302 281 256 300 C 208 320 151 310 116 282"
          fill="none"
          stroke="rgba(82, 85, 69, 0.20)"
          strokeWidth="1.2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 72 247 C 119 226 162 225 205 238 C 248 251 282 247 323 222"
          fill="none"
          stroke="rgba(96, 88, 70, 0.18)"
          strokeWidth="1"
          strokeDasharray="7 8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      <g className="surface-region surface-region--council">
        <path
          d="M 405 394 C 452 343 526 326 597 347 C 665 367 717 418 728 480 C 740 548 706 613 644 650 C 583 686 504 688 445 651 C 389 616 357 558 365 498 C 371 452 383 418 405 394 Z"
          fill="url(#surface-council-wash)"
          stroke="rgba(82, 73, 61, 0.43)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 440 415 C 480 380 536 366 590 379 C 641 391 682 426 696 472 C 710 518 691 566 651 597 C 609 630 548 642 496 624"
          fill="none"
          stroke="rgba(91, 80, 65, 0.19)"
          strokeWidth="1.2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 394 532 C 445 506 493 500 542 511 C 591 523 643 515 700 482"
          fill="none"
          stroke="rgba(103, 89, 69, 0.17)"
          strokeWidth="1"
          strokeDasharray="7 8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  )
}

export default SurfaceRegionLayer
