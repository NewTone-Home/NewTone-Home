/**
 * Authored geometry for the existing Yonghe mining-perimeter street.
 * Coordinates are logical scene units, not measured physical dimensions.
 */
export const yongheMiningPerimeterLayout = {
  walkBounds: { x: 8, y: 8, width: 84, height: 184 },
  areas: {
    shopRow: { x: 10, y: 8, width: 26, height: 184 },
    publicLane: { x: 36, y: 8, width: 28, height: 184 },
    industrialEdge: { x: 64, y: 8, width: 28, height: 184 },
  },
  facadeAirWalls: [
    { id: 'yonghe-left-shop-air-wall-top', bounds: { x: 8, y: 8, width: 27.3, height: 23.3 } },
    { id: 'yonghe-left-shop-air-wall-bottom', bounds: { x: 8, y: 50.7, width: 27.3, height: 141.3 } },
    { id: 'yonghe-industrial-edge-air-wall', bounds: { x: 64.7, y: 8, width: 27.3, height: 184 } },
  ],
  storefronts: {
    starts: [10, 32, 54, 76, 98, 120, 142, 164],
    width: 18,
    labels: ['修鞋', '永和小馆', '药品', '五金', '小吃', '面馆', '修理', '早点'],
    eateryIndex: 1,
  },
  entry: {
    doorPosition: { x: 36, y: 41 },
    threshold: { x: 39.5, y: 41 },
    crossingTarget: { x: 37.5, y: 41 },
    eateryEntryPosition: { x: 20, y: 56 },
    streetEntryPosition: { x: 42, y: 41 },
    approachClearance: { x: 36, y: 38, width: 10, height: 6 },
    indoorWallOpening: { edge: 'left' as const, start: 50, end: 62 },
  },
  externalExit: { axis: 'y' as const, direction: 1 as const, threshold: 186 },
  initialPlayerPosition: { x: 50, y: 180 },
  areaLabelThresholds: { mine: 150, perimeter: 100, eateryFront: 70 },
  outdoorFurniture: [
    {
      groupId: 'yonghe-outdoor-group-1',
      tableId: 'yonghe-outdoor-table-1',
      seatIds: ['yonghe-outdoor-chair-1-top', 'yonghe-outdoor-chair-1-bottom'] as const,
      anchor: { x: 50, y: 41 },
      approach: { x: 57, y: 41 },
    },
    {
      groupId: 'yonghe-outdoor-group-2',
      tableId: 'yonghe-outdoor-table-2',
      seatIds: ['yonghe-outdoor-chair-2-top', 'yonghe-outdoor-chair-2-bottom'] as const,
      anchor: { x: 40, y: 61 },
      approach: { x: 47, y: 61 },
    },
  ],
} as const
