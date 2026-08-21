const localized = (zh, en) => Object.freeze({ zh, en })

export const WORLD_MAP_VIEWBOX = Object.freeze({ width: 1600, height: 1000 })

// The projection is intentionally small and explicit. The scene is a data
// surface, not a 3D engine: x/y describe the world graph and z only lifts
// lines above that graph so the result reads as a wireframe relief.
export const WORLD_MAP_PROJECTION = Object.freeze({
  originX: 800,
  originY: 50,
  tileX: 42,
  tileY: 29,
  height: 38,
})

export const WORLD_MAP_BOUNDS = Object.freeze({ minX: 0, maxX: 18, minY: 0, maxY: 16 })

export const WORLD_MAP_BOUNDARY = Object.freeze([
  [1.1, 1.2], [4.8, .45], [8.8, .65], [13.1, 1.1], [16.8, 3.05],
  [17.9, 7.1], [16.9, 11.5], [13.2, 14.45], [9.4, 15.65],
  [5.1, 14.7], [1.65, 12.3], [.35, 8.1], [.35, 4.2],
])

export const WORLD_MAP_REGIONS = Object.freeze([
  {
    id: 'world-region-north',
    entityId: 'north-archive-district',
    label: localized('北部档案区', 'NORTH ARCHIVE'),
    tone: 'warm',
    points: [[1.1, 1.2], [4.8, .45], [8.8, .65], [9.2, 5.5], [6.1, 6.5], [2.2, 5.2], [.35, 4.2]],
  },
  {
    id: 'world-region-east',
    entityId: 'east-signal-district',
    label: localized('东部信号区', 'EAST SIGNAL'),
    tone: 'cool',
    points: [[8.8, .65], [13.1, 1.1], [16.8, 3.05], [17.9, 7.1], [15.1, 8.4], [11.8, 6.9], [9.2, 5.5]],
  },
  {
    id: 'world-region-south',
    entityId: 'south-transit-district',
    label: localized('南部通行区', 'SOUTH TRANSIT'),
    tone: 'neutral',
    points: [[2.2, 5.2], [6.1, 6.5], [11.8, 6.9], [15.1, 8.4], [16.9, 11.5], [13.2, 14.45], [9.4, 15.65], [5.1, 14.7], [1.65, 12.3], [.35, 8.1]],
  },
])

export const WORLD_MAP_MOUNTAINS = Object.freeze([
  { id: 'ridge-north', point: [4.35, 2.3], height: 4.7, radius: 3.65, tone: 'warm' },
  { id: 'ridge-east', point: [14.15, 3.05], height: 3.35, radius: 2.75, tone: 'cool' },
  { id: 'ridge-south', point: [9.55, 13.45], height: 4.15, radius: 3.15, tone: 'neutral' },
])

export const WORLD_MAP_ROUTES = Object.freeze([
  {
    id: 'world-river',
    type: 'river',
    status: 'active',
    points: [[1.4, 2.25], [2.25, 3.95], [3.55, 5.2], [4.9, 6.1], [5.65, 7.85], [6.35, 9.3], [7.9, 10.85], [8.65, 12.45], [9.6, 14.75]],
  },
  {
    id: 'world-trade-loop',
    type: 'trade',
    status: 'active',
    points: [[1.55, 10.4], [3.35, 8.75], [5.75, 7.05], [8.25, 6.1], [10.55, 6.95], [12.75, 6.6], [15.6, 7.7], [16.85, 9.9]],
  },
  {
    id: 'world-signal-chain',
    type: 'signal',
    status: 'watch',
    points: [[3.85, 3.75], [6.15, 2.7], [8.9, 2.95], [11.55, 3.75], [13.85, 4.9], [15.35, 7.95]],
  },
  {
    id: 'world-south-road',
    type: 'road',
    status: 'quiet',
    points: [[2.15, 12.05], [4.45, 10.6], [6.85, 10.45], [9.7, 9.15], [12.2, 10.45], [14.85, 11.35]],
  },
])

export const WORLD_MAP_NODES = Object.freeze([
  { id: 'node-archive', point: [3.1, 3.45], role: 'city', entityId: 'memory-archive', connections: ['node-ridge-west', 'node-relay', 'node-market'] },
  { id: 'node-ridge-west', point: [2.05, 2.05], role: 'ridge', connections: ['node-ridge-north', 'node-relay'] },
  { id: 'node-ridge-north', point: [5.3, 1.55], role: 'ridge', connections: ['node-observatory', 'node-relay'] },
  { id: 'node-relay', point: [6.8, 4.8], role: 'relay', entityId: 'relay-17', connections: ['node-market', 'node-observatory', 'node-south'] },
  { id: 'node-observatory', point: [13.85, 3.45], role: 'city', entityId: 'north-observatory', connections: ['node-east-ridge', 'node-signal'] },
  { id: 'node-east-ridge', point: [15.75, 2.95], role: 'ridge', connections: ['node-signal'] },
  { id: 'node-signal', point: [14.05, 8.55], role: 'city', entityId: 'signal-tower', connections: ['node-east-ridge', 'node-station', 'node-south-east'] },
  { id: 'node-market', point: [6.65, 7.05], role: 'city', entityId: 'crossing-market', connections: ['node-south', 'node-station'] },
  { id: 'node-south', point: [8.65, 9.85], role: 'transit', entityId: 'south-station', connections: ['node-station', 'node-south-west', 'node-south-east'] },
  { id: 'node-station', point: [10.45, 8.85], role: 'transit', connections: ['node-signal', 'node-south-east'] },
  { id: 'node-south-west', point: [4.05, 11.55], role: 'residential', connections: ['node-south-ridge'] },
  { id: 'node-south-east', point: [13.05, 11.2], role: 'residential', connections: ['node-south-ridge'] },
  { id: 'node-south-ridge', point: [9.55, 14.05], role: 'ridge', connections: ['node-south-west', 'node-south-east'] },
])

export const WORLD_MAP_CITIES = Object.freeze([
  { id: 'city-archive', center: [3.1, 3.45], radius: .9, tone: 'warm', heights: [1.05, 1.8, .8, 2.25, 1.25, .68, 1.55, .95] },
  { id: 'city-market', center: [6.65, 7.05], radius: 1.05, tone: 'warm', heights: [.72, 1.2, .88, 1.55, .66, 1.05, .82, 1.35, .7] },
  { id: 'city-station', center: [10.35, 9.15], radius: .9, tone: 'neutral', heights: [.62, 1.18, .75, 1.65, .55, 1.08, .78] },
  { id: 'city-signal', center: [14.05, 8.55], radius: .78, tone: 'cool', heights: [.72, 1.65, 2.55, .86, 1.28, .58, 1.1] },
])

export const WORLD_MAP_LOCATIONS = Object.freeze([
  { id: 'location-mine', label: localized('矿区', 'MINE'), point: [4.15, 1.85], anchor: [4.35, 2.3], tone: 'warm' },
  { id: 'location-commercial', label: localized('商业街', 'COMMERCIAL STREET'), point: [5.25, 6.35], anchor: [6.65, 7.05], tone: 'warm' },
  { id: 'location-library', label: localized('中书院', 'CENTRAL LIBRARY'), point: [8.25, 5.1], anchor: [6.8, 4.8], tone: 'neutral' },
  { id: 'location-estate', label: localized('姬家大院', 'JI ESTATE'), point: [14.8, 7.05], anchor: [14.05, 8.55], tone: 'cool' },
  { id: 'location-tavern', label: localized('永恒小馆', 'ETERNAL INN'), point: [11.55, 11.05], anchor: [10.35, 9.15], tone: 'neutral' },
  { id: 'location-valley', label: localized('河谷', 'RIVER VALLEY'), point: [6.85, 12.55], anchor: [7.9, 10.85], tone: 'neutral' },
  { id: 'location-mountain', label: localized('山脉', 'SOUTH RIDGE'), point: [10.65, 15.1], anchor: [9.55, 14.05], tone: 'cool' },
])

export const WORLD_MAP_INTERACTIVE_IDS = Object.freeze([
  'memory-archive',
  'north-observatory',
  'crossing-market',
  'south-station',
  'signal-tower',
  'relay-17',
])
