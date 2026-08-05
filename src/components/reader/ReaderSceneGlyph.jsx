// Integer-aligned source outlines. They are rasterized below into equal square
// cells so no long source segment is ever rendered as a smooth SVG bar.
const PIXEL_LINES = Object.freeze({
  'ancestral-home-courtyard': [[3,9,26,2],[6,7,20,2],[6,11,2,13],[24,11,2,13],[7,23,19,2],[14,15,5,9],[2,27,9,1],[20,27,10,1]],
  'ancestral-home-hall': [[2,7,28,2],[5,5,22,2],[5,9,2,19],[25,9,2,19],[5,27,22,2],[11,12,2,15],[20,12,2,15],[14,15,5,2],[14,20,5,2]],
  'ancestral-passage': [[5,27,2,5],[7,12,2,15],[9,8,14,2],[23,12,2,15],[25,27,2,5],[12,14,8,1],[15,16,2,11]],
  'inner-street': [[1,11,12,2],[3,9,8,2],[3,13,2,11],[11,13,2,11],[4,23,8,2],[21,8,2,13],[18,10,8,2],[25,12,2,9],[0,26,32,2],[14,24,4,1]],
  'inner-commercial-street': [[0,9,10,2],[2,7,6,2],[2,11,2,14],[8,11,2,14],[11,7,12,2],[11,9,2,16],[21,9,2,16],[14,11,6,2],[24,10,8,2],[24,12,2,13],[30,12,2,13],[26,15,4,2],[0,26,32,2]],
  'inner-commercial-cafe': [[3,6,26,2],[3,8,2,20],[27,8,2,20],[3,27,26,2],[7,11,18,2],[7,13,2,10],[23,13,2,10],[7,22,18,2],[10,15,5,5],[18,14,4,7]],
  'inner-lakeside': [[2,24,8,1],[12,27,8,1],[22,23,8,1],[0,19,32,2],[20,5,2,12],[16,7,10,2],[18,4,6,2],[2,14,9,1]],
  'inner-transit': [[0,25,32,2],[14,6,4,19],[8,11,2,4],[22,15,2,4],[25,5,6,2],[25,7,2,8],[29,7,2,8],[9,21,5,1],[18,10,5,1]],
  'mining-old-street': [[0,26,32,2],[2,12,10,2],[4,9,6,3],[2,14,2,12],[10,14,2,12],[13,8,10,2],[13,10,2,16],[21,10,2,16],[24,14,8,2],[24,16,2,10],[30,16,2,10],[17,4,2,4]],
  'yonghe-diner': [[2,8,28,2],[4,5,24,3],[2,10,2,17],[28,10,2,17],[2,26,28,2],[6,13,20,2],[7,16,8,9],[18,16,7,9],[10,7,12,1]],
  'yonghe-back-alley': [[3,4,2,24],[27,3,2,25],[5,10,16,1],[9,18,8,2],[9,20,2,8],[15,20,2,8],[21,12,4,2],[23,14,2,7],[0,28,32,2]],
  'ruoyu-commercial-street': [[0,12,9,2],[2,9,5,3],[0,14,2,12],[7,14,2,12],[10,7,13,2],[10,9,2,17],[21,9,2,17],[13,12,7,2],[24,11,8,2],[24,13,2,13],[30,13,2,13],[0,26,32,2]],
  'ruoyu-cafe': [[2,7,28,2],[4,5,24,2],[2,9,2,19],[28,9,2,19],[2,27,28,2],[6,12,20,2],[6,14,2,10],[24,14,2,10],[10,16,6,6],[19,15,4,7]],
  'noodle-shop': [[2,8,28,2],[4,5,24,3],[2,10,2,18],[28,10,2,18],[2,27,28,2],[6,13,20,2],[8,16,7,8],[18,16,6,12],[10,4,2,3],[16,3,2,4],[22,4,2,3]],
  'walk-to-subway': [[0,26,32,2],[14,7,4,19],[2,11,8,2],[2,13,2,12],[8,13,2,12],[23,9,7,2],[23,11,2,14],[29,11,2,14],[18,10,4,1]],
  subway: [[4,10,24,2],[2,13,2,12],[28,13,2,12],[4,25,24,2],[7,14,18,9],[9,16,5,5],[18,16,5,5],[14,23,4,2],[7,27,4,2],[21,27,4,2]],
})

const PIXEL_CELL_STEP = 2
const PIXEL_CELL_SIZE = 1.45

function rasterizePixelCells(segments) {
  const cells = new Map()
  segments.forEach(([x, y, width, height]) => {
    for (let cellY = y; cellY < y + Math.max(1, height); cellY += PIXEL_CELL_STEP) {
      for (let cellX = x; cellX < x + Math.max(1, width); cellX += PIXEL_CELL_STEP) {
        const key = `${cellX}:${cellY}`
        if (!cells.has(key)) cells.set(key, [cellX, cellY])
      }
    }
  })
  return [...cells.values()]
}

export function getReaderScenePixels(locationId) {
  return rasterizePixelCells(PIXEL_LINES[locationId] ?? PIXEL_LINES['inner-street'])
}

export const getReaderScenePaths = getReaderScenePixels

function ReaderSceneGlyph({ locationId, className = '' }) {
  return (
    <svg
      className={`reader-scene-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      aria-hidden="true"
      data-scene-svg={locationId}
    >
      {getReaderScenePixels(locationId).map(([x, y], index) => (
        <rect
          key={`${locationId}-${index}`}
          x={x}
          y={y}
          width={PIXEL_CELL_SIZE}
          height={PIXEL_CELL_SIZE}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}

export default ReaderSceneGlyph
