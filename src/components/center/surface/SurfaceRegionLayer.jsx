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
        <pattern id="pencil-hatch" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(9)">
          <path d="M 0 2 L 13 2" stroke="rgba(67, 60, 50, 0.07)" strokeWidth="0.7" />
          <path d="M 1 8 L 10 8" stroke="rgba(67, 60, 50, 0.045)" strokeWidth="0.6" />
        </pattern>
        <filter id="pencil-wobble" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.025" numOctaves="2" seed="17" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter="url(#pencil-wobble)">
        <path
          d="M 43 57 C 101 22 192 18 267 45 C 330 68 365 110 354 154 C 343 200 287 230 214 231 C 142 233 77 207 51 169 C 24 131 22 86 43 57 Z"
          fill="rgba(123, 126, 103, 0.055)"
          stroke="rgba(69, 64, 54, 0.23)"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 55 70 C 110 39 192 35 257 57 C 309 74 337 105 330 140 C 322 177 276 202 213 203 C 151 205 96 184 71 155"
          fill="none"
          stroke="rgba(69, 64, 54, 0.11)"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 43 57 C 101 22 192 18 267 45 C 330 68 365 110 354 154 C 343 200 287 230 214 231 C 142 233 77 207 51 169 C 24 131 22 86 43 57 Z"
          fill="url(#pencil-hatch)"
          opacity="0.45"
        />

        <path
          d="M 374 174 C 436 139 528 132 606 153 C 681 173 732 216 735 264 C 739 315 687 358 611 373 C 535 388 450 370 399 333 C 352 298 332 244 349 208 C 355 194 363 183 374 174 Z"
          fill="rgba(146, 132, 108, 0.05)"
          stroke="rgba(69, 64, 54, 0.22)"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 400 193 C 454 163 530 158 595 174 C 657 190 697 223 699 261 C 701 301 660 334 601 346 C 541 358 476 345 433 317"
          fill="none"
          stroke="rgba(69, 64, 54, 0.10)"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 374 174 C 436 139 528 132 606 153 C 681 173 732 216 735 264 C 739 315 687 358 611 373 C 535 388 450 370 399 333 C 352 298 332 244 349 208 C 355 194 363 183 374 174 Z"
          fill="url(#pencil-hatch)"
          opacity="0.42"
        />
      </g>
    </svg>
  )
}

export default SurfaceRegionLayer
