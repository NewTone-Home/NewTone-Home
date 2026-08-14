import { useId } from 'react'
import './EntryButtonSurface.css'

const FILL_DIRECTIONS = ['left', 'right', 'top', 'bottom', 'center']
const FRAME_ORIGINS = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
const WORLD_MATERIALS = Object.freeze({
  surface: Object.freeze({
    highlight: '#3f372f',
    body: '#0b0a09',
    shade: '#020202',
    edge: '#5d5145',
  }),
  inner: Object.freeze({
    highlight: '#ffffff',
    body: '#f7f5ef',
    shade: '#dedbd2',
    edge: '#bcb7aa',
  }),
})
const BACKGROUND_MATERIAL = Object.freeze({
  highlight: 'var(--entry-background-highlight)',
  body: 'var(--entry-background-body)',
  shade: 'var(--entry-background-shade)',
  edge: 'var(--entry-background-edge)',
})
const FRAME_PATHS = Object.freeze({
  'top-left': 'M 1 1 H 99 V 35 H 1 Z',
  'top-right': 'M 99 1 V 35 H 1 V 1 Z',
  'bottom-right': 'M 99 35 H 1 V 1 H 99 Z',
  'bottom-left': 'M 1 35 V 1 H 99 V 35 Z',
})

function clamp(value) {
  return Math.max(0, Math.min(1, value))
}

function getFillRect(direction, progress) {
  const amount = clamp(progress)

  if (direction === 'left') return { x: 0, y: 0, width: 100 * amount, height: 36 }
  if (direction === 'right') return { x: 100 * (1 - amount), y: 0, width: 100 * amount, height: 36 }
  if (direction === 'top') return { x: 0, y: 0, width: 100, height: 36 * amount }
  if (direction === 'bottom') return { x: 0, y: 36 * (1 - amount), width: 100, height: 36 * amount }

  const width = 100 * amount
  return { x: (100 - width) / 2, y: 0, width, height: 36 }
}

function resolveMaterial(materialMode, worldLayer) {
  if (materialMode === 'background') return BACKGROUND_MATERIAL
  return WORLD_MATERIALS[worldLayer] || WORLD_MATERIALS.surface
}

function EntryButtonFrame({
  frameOrigin = 'top-left',
  frameProgress = 1,
  fillDirection = 'left',
  fillProgress = 0,
  materialMode = 'background',
  worldLayer = 'surface',
  fillEnabled = true,
  className = '',
}) {
  const svgId = useId().replace(/:/g, '')
  const shapeId = `${svgId}-shape`
  const fillClipId = `${svgId}-fill-clip`
  const materialId = `${svgId}-material`
  const framePath = FRAME_PATHS[frameOrigin] || FRAME_PATHS['top-left']
  const fillRect = getFillRect(fillDirection, fillProgress)
  const material = resolveMaterial(materialMode, worldLayer)
  const fillActive = fillEnabled && fillProgress > 0.001

  return (
    <svg
      className={['shared-entry-surface', className].filter(Boolean).join(' ')}
      viewBox="0 0 100 36"
      aria-hidden="true"
      focusable="false"
      data-entry-frame-origin={frameOrigin}
      data-entry-frame-fill={fillEnabled ? 'enabled' : 'disabled'}
    >
      <defs>
        <path id={shapeId} d={framePath} pathLength="1" />
        {fillEnabled && (
          <>
            <clipPath id={fillClipId} clipPathUnits="userSpaceOnUse">
              <use href={`#${shapeId}`} />
            </clipPath>
            <linearGradient id={materialId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={material.highlight} stopOpacity=".76" />
              <stop offset=".34" stopColor={material.body} />
              <stop offset="1" stopColor={material.shade} />
            </linearGradient>
          </>
        )}
      </defs>
      {fillEnabled && (
        <g clipPath={`url(#${fillClipId})`}>
          <rect
            className="shared-entry-material"
            x={fillRect.x}
            y={fillRect.y}
            width={fillRect.width}
            height={fillRect.height}
            fill={`url(#${materialId})`}
          />
        </g>
      )}
      <use
        className="shared-entry-frame"
        href={`#${shapeId}`}
        fill="none"
        stroke="currentColor"
        pathLength="1"
        style={{ strokeDashoffset: 1 - clamp(frameProgress) }}
      />
      {fillEnabled && (
        <use
          className="shared-entry-material-edge"
          href={`#${shapeId}`}
          fill="none"
          stroke={material.edge}
          strokeWidth=".65"
          opacity={fillActive ? '.7' : '0'}
          pointerEvents="none"
        />
      )}
    </svg>
  )
}

export { FILL_DIRECTIONS, FRAME_ORIGINS }
export default EntryButtonFrame
