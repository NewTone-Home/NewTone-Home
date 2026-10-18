/**
 * Authored geometry for the existing Yonghe mining-perimeter street.
 * Coordinates are logical scene units, not measured physical dimensions.
 */
export const yongheMiningPerimeterLayout = {
  walkBounds: { x: 0, y: 0, width: 68, height: 141 },
  areas: {
    backAlley: { x: 0, y: 0, width: 10, height: 141 },
    shopRow: { x: 10, y: 0, width: 28, height: 141 },
    publicLane: { x: 38, y: 0, width: 14, height: 141 },
    industrialEdge: { x: 52, y: 0, width: 16, height: 141 },
  },
  facadeAirWalls: [
    { id: 'yonghe-left-shop-air-wall-top', bounds: { x: 10, y: 0, width: 27.3, height: 20 } },
    { id: 'yonghe-left-shop-air-wall-bottom', bounds: { x: 10, y: 49, width: 27.3, height: 96 } },
    { id: 'yonghe-industrial-edge-air-wall', bounds: { x: 52.7, y: 0, width: 15.3, height: 141 } },
  ],
  storefronts: {
    starts: [6, 21, 50, 65, 80, 95, 110, 125],
    widths: [14, 28, 14, 14, 14, 14, 14, 14],
    labels: ['修鞋', '永和小馆', '药品', '五金', '小吃', '面馆', '修理', '早点'],
    eateryIndex: 1,
  },
  shopRow: {
    depth: 28,
    partyWall: 1,
    alleyWidth: 10,
    rearDoorPositions: [13, 45, 57, 72, 87, 102, 117, 132],
  },
  entry: {
    doorPosition: { x: 38, y: 35 },
    threshold: { x: 42, y: 35 },
    crossingTarget: { x: 34, y: 35 },
    eateryEntryPosition: { x: 42, y: 35 },
    roomSafeEntryPosition: { x: 42, y: 35 },
    streetEntryPosition: { x: 42, y: 35 },
    approachClearance: { x: 38, y: 32, width: 10, height: 6 },
    indoorWallOpening: { edge: 'right' as const, start: 30, end: 40 },
    indoorDoorPosition: { x: 48, y: 35 },
    indoorDoorThreshold: { x: 44, y: 35 },
    rearDoorPosition: { x: 10, y: 45 },
    rearDoorThreshold: { x: 14, y: 45 },
    rearDoorCrossingTarget: { x: 7, y: 45 },
    rearDoorOpening: { edge: 'left' as const, start: 41, end: 49 },
    roomBounds: { x: 10, y: 21, width: 38, height: 28 },
    roomWalkBounds: { x: 8, y: 19, width: 42, height: 32 },
    counterBounds: { x: 18, y: 27, width: 3.5, height: 17 },
  },
  externalExit: { axis: 'y' as const, direction: 1 as const, threshold: 138 },
  initialPlayerPosition: { x: 45, y: 132 },
  areaLabelThresholds: { mine: 112, perimeter: 74, eateryFront: 52 },
  outdoorFurniture: [
    {
      groupId: 'yonghe-outdoor-group-1',
      tableId: 'yonghe-outdoor-table-1',
      seatIds: ['yonghe-outdoor-chair-1-top', 'yonghe-outdoor-chair-1-bottom'] as const,
      anchor: { x: 43, y: 26.5 },
      approach: { x: 48, y: 26.5 },
    },
    {
      groupId: 'yonghe-outdoor-group-2',
      tableId: 'yonghe-outdoor-table-2',
      seatIds: ['yonghe-outdoor-chair-2-top', 'yonghe-outdoor-chair-2-bottom'] as const,
      anchor: { x: 43, y: 43.5 },
      approach: { x: 48, y: 43.5 },
    },
  ],
} as const
