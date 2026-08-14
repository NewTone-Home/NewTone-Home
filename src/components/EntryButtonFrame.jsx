import { useEffect, useId, useRef, useState } from 'react'
import './EntryButtonSurface.css'

const FRAME_ENTER_DURATION_MS = 720
const FRAME_EXIT_DURATION_MS = 420
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

// This is the only source of button geometry. The visible stroke, material
// fill, and fill clip all reuse the same path reference below.
const FRAME_PATHS = Object.freeze({
  'top-left': 'M 1 1 H 99 V 35 H 1 Z',
  'top-right': 'M 99 1 V 35 H 1 V 1 Z',
  'bottom-right': 'M 99 35 H 1 V 1 H 99 Z',
  'bottom-left': 'M 1 35 V 1 H 99 V 35 Z',
})

function clamp(value) {
  return Math.max(0, Math.min(1, value))
}

function materialTransform(direction, progress) {
  const amount = clamp(progress)
  const remainder = 1 - amount

  if (direction === 'left') return `translate(${-100 * remainder} 0)`
  if (direction === 'right') return `translate(${100 * remainder} 0)`
  if (direction === 'top') return `translate(0 ${-36 * remainder})`
  if (direction === 'bottom') return `translate(0 ${36 * remainder})`

  const scale = Math.max(.001, amount)
  return `translate(50 18) scale(${scale}) translate(-50 -18)`
}

function resolveMaterial(materialMode, worldLayer) {
  if (materialMode === 'background') return BACKGROUND_MATERIAL
  return WORLD_MATERIALS[worldLayer] || WORLD_MATERIALS.surface
}

function scheduleFrame(callback) {
  return window.requestAnimationFrame(callback)
}

function cancelFrame(frame) {
  if (frame) window.cancelAnimationFrame(frame)
}

function easeInOut(value) {
  return value * value * (3 - 2 * value)
}

/**
 * Shared frame-only timeline for controls that do not use EntryButtonSurface.
 * It animates the same path in and out; it never creates a second rectangle.
 */
export function useEntryFrameProgress(visible = true, restartKey = 0) {
  const [progress, setProgress] = useState(() => (visible ? 0 : 1))
  const progressRef = useRef(progress)

  useEffect(() => {
    let mounted = true
    let frame = 0
    const from = progressRef.current
    const target = visible ? 1 : 0
    const duration = visible ? FRAME_ENTER_DURATION_MS : FRAME_EXIT_DURATION_MS
    const startedAt = performance.now()

    const tick = timestamp => {
      if (!mounted) return
      const raw = Math.min(1, Math.max(0, (timestamp - startedAt) / duration))
      const next = from + (target - from) * easeInOut(raw)
      progressRef.current = next
      setProgress(next)
      if (raw < 1) frame = scheduleFrame(tick)
    }

    frame = scheduleFrame(tick)
    return () => {
      mounted = false
      cancelFrame(frame)
    }
  }, [restartKey, visible])

  return progress
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
  const material = resolveMaterial(materialMode, worldLayer)
  const fillActive = fillEnabled && fillProgress > 0.001
  const materialPathTransform = materialTransform(fillDirection, fillProgress)

  return (
    <svg
      className={['shared-entry-surface', className].filter(Boolean).join(' ')}
      viewBox="0 0 100 36"
      aria-hidden="true"
      focusable="false"
      data-entry-frame-origin={frameOrigin}
      data-entry-frame-fill={fillEnabled ? 'enabled' : 'disabled'}
      data-entry-paint-model="shared-path-fill>shared-path-stroke"
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
        <g clipPath={`url(#${fillClipId})`} data-entry-fill-geometry={shapeId}>
          <use
            className="shared-entry-material"
            href={`#${shapeId}`}
            fill={`url(#${materialId})`}
            transform={materialPathTransform}
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

export {
  FILL_DIRECTIONS,
  FRAME_ENTER_DURATION_MS,
  FRAME_EXIT_DURATION_MS,
  FRAME_ORIGINS,
  FRAME_PATHS,
  materialTransform,
}
export default EntryButtonFrame
