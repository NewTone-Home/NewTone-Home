export const surfaceLocations = [
  {
    id: 'surface-estate',
    title: '姬家祖宅',
    x: 0.20,
    y: 0.20,
  },
  {
    id: 'surface-council',
    title: '中枢院',
    x: 0.56,
    y: 0.50,
  },
]

export const surfaceRegions = [
  {
    id: 'estate-surrounding',
    d: 'M 0.10 0.14 C 0.14 0.10 0.22 0.11 0.26 0.16 C 0.30 0.20 0.28 0.28 0.23 0.30 C 0.17 0.32 0.10 0.28 0.08 0.23 C 0.06 0.18 0.07 0.16 0.10 0.14 Z',
  },
  {
    id: 'council-precinct',
    d: 'M 0.42 0.42 C 0.46 0.38 0.54 0.38 0.58 0.42 C 0.62 0.46 0.62 0.54 0.58 0.58 C 0.54 0.62 0.46 0.62 0.42 0.58 C 0.38 0.54 0.38 0.46 0.42 0.42 Z',
  },
]

export const surfaceRoads = [
  {
    id: 'estate-to-council',
    d: 'M 0.18 0.22 C 0.22 0.28 0.26 0.34 0.32 0.38 C 0.38 0.42 0.44 0.46 0.50 0.50',
  },
  {
    id: 'west-path',
    d: 'M 0.08 0.30 C 0.12 0.28 0.14 0.24 0.18 0.22',
  },
]

export const surfaceEnvironment = [
  {
    id: 'tree-cluster-north',
    kind: 'trees',
    x: 0.08,
    y: 0.06,
    points: [
      { x: 0, y: -0.02 }, { x: 0.02, y: -0.01 }, { x: 0.015, y: 0.015 }, { x: -0.01, y: 0.01 },
    ],
  },
  {
    id: 'tree-cluster-east',
    kind: 'trees',
    x: 0.65,
    y: 0.30,
    points: [
      { x: 0, y: -0.015 }, { x: 0.025, y: 0 }, { x: 0.01, y: 0.02 },
    ],
  },
  {
    id: 'rock-formation',
    kind: 'rocks',
    x: 0.35,
    y: 0.38,
    d: 'M 0.33 0.38 L 0.35 0.36 L 0.38 0.37 L 0.36 0.40 Z',
  },
]
