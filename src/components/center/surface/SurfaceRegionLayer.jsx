function SurfaceRegionLayer() {
  return (
    <svg
      className="surface-region-layer"
      viewBox="0 0 1000 500"
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
        <filter id="surface-soften" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>

      <g className="surface-region surface-region--estate" filter="url(#surface-soften)">
        <path
          d="M 64 72 C 115 34 206 30 272 56 C 324 77 347 113 334 149 C 319 190 263 214 194 211 C 126 208 72 184 53 148 C 36 116 42 88 64 72 Z"
          fill="rgba(118, 128, 96, 0.11)"
        />
        <path
          d="M 92 92 C 136 64 204 61 257 78 C 293 90 311 111 303 134 C 293 161 251 177 198 174 C 150 171 112 154 98 132 C 88 116 85 102 92 92 Z"
          fill="rgba(176, 158, 124, 0.06)"
        />
      </g>

      <g className="surface-region surface-region--council" filter="url(#surface-soften)">
        <path
          d="M 398 188 C 451 156 533 151 601 170 C 665 188 706 224 704 265 C 701 308 653 341 584 350 C 516 359 446 342 405 310 C 366 279 354 232 374 207 C 381 198 389 192 398 188 Z"
          fill="rgba(155, 139, 112, 0.10)"
        />
        <path
          d="M 431 207 C 474 183 534 179 585 192 C 628 203 654 226 650 252 C 646 279 613 301 566 307 C 516 314 466 302 437 280 C 410 260 401 230 415 216 C 420 212 425 209 431 207 Z"
          fill="rgba(196, 178, 143, 0.055)"
        />
      </g>
    </svg>
  )
}

export default SurfaceRegionLayer
