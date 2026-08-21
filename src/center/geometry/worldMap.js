// Backwards-compatible exports for the Center scene geometry. The renderer
// now uses the shared procedural terrain field, while existing tests and
// scene modules can continue importing the original worldMap helpers.
export {
  PROCEDURAL_TERRAIN,
  worldFootprint,
  worldGridPath,
  worldLinePath,
  worldPathFromPoints,
  worldPolygonPath,
  worldProjectPoint,
  worldRingPath,
  worldTerrainHeight,
  worldTerrainPoint,
} from './proceduralTerrain'
