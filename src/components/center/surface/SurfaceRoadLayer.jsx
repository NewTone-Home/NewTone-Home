function SurfaceRoadLayer() {
  const mainRoads = [
    {
      id: 'west-east-arterial',
      d: `
        M -20 326
        C 105 326, 202 307, 300 282
        C 402 256, 500 245, 610 264
        C 744 287, 860 331, 1020 346
      `,
    },
    {
      id: 'north-south-arterial',
      d: `
        M 126 -20
        C 150 50, 171 112, 197 176
        C 231 259, 278 350, 348 520
      `,
    },
  ]

  const secondaryRoads = [
    {
      id: 'estate-west-loop',
      d: `
        M -20 170
        C 56 169, 118 150, 164 124
        C 180 115, 190 108, 200 98
        C 214 111, 237 129, 272 145
      `,
    },
    {
      id: 'estate-south-link',
      d: `
        M 196 116
        C 225 144, 253 169, 287 190
        C 328 216, 370 238, 415 258
      `,
    },
    {
      id: 'north-east-road',
      d: `
        M 286 -20
        C 343 52, 401 102, 471 130
        C 548 161, 626 170, 715 164
        C 810 158, 900 139, 1020 146
      `,
    },
    {
      id: 'south-east-road',
      d: `
        M 356 520
        C 436 430, 505 382, 585 350
        C 682 311, 785 302, 890 314
        C 940 320, 982 331, 1020 344
      `,
    },
  ]

  const localRoads = [
    {
      id: 'council-ring',
      d: `
        M 486 250
        C 486 218, 519 198, 560 198
        C 607 198, 643 220, 643 252
        C 643 285, 607 307, 560 307
        C 516 307, 486 284, 486 250
        Z
      `,
    },
    {
      id: 'council-west-spoke',
      d: `
        M 486 250
        C 458 252, 438 255, 415 258
      `,
    },
    {
      id: 'council-east-spoke',
      d: `
        M 643 252
        C 680 257, 714 269, 746 286
      `,
    },
    {
      id: 'council-north-spoke',
      d: `
        M 560 198
        C 559 178, 555 162, 548 147
      `,
    },
    {
      id: 'council-south-spoke',
      d: `
        M 560 307
        C 566 326, 574 340, 585 350
      `,
    },
    {
      id: 'estate-courtyard-loop',
      d: `
        M 164 124
        C 165 94, 181 76, 204 76
        C 231 76, 248 94, 248 118
        C 248 137, 235 151, 214 156
      `,
    },
  ]

  const renderRoad = (road, widths, tones) => (
    <g key={road.id}>
      <path
        d={road.d}
        fill="none"
        stroke={tones.edge}
        strokeWidth={widths.edge}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={road.d}
        fill="none"
        stroke={tones.surface}
        strokeWidth={widths.surface}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )

  return (
    <svg
      className="surface-road-layer"
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
      {mainRoads.map(road => renderRoad(
        road,
        { edge: 17, surface: 11 },
        {
          edge: 'rgba(145, 126, 98, 0.23)',
          surface: 'rgba(231, 220, 198, 0.90)',
        },
      ))}

      {secondaryRoads.map(road => renderRoad(
        road,
        { edge: 11, surface: 7 },
        {
          edge: 'rgba(145, 126, 98, 0.18)',
          surface: 'rgba(235, 225, 206, 0.82)',
        },
      ))}

      {localRoads.map(road => renderRoad(
        road,
        { edge: 7, surface: 4 },
        {
          edge: 'rgba(145, 126, 98, 0.16)',
          surface: 'rgba(239, 230, 213, 0.76)',
        },
      ))}
    </svg>
  )
}

export default SurfaceRoadLayer
