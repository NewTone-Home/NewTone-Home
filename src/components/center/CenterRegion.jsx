import { useEffect, useMemo, useState } from 'react'

const SURFACE_OVERVIEW_HIT_AREAS = {
  'surface-estate': {
    x: 13.4,
    y: 15.6,
    width: 17.5,
    height: 17.2,
  },
  'surface-council': {
    x: 57.5,
    y: 42.5,
    width: 16.0,
    height: 17.6,
  },
}

const SURFACE_OVERVIEW_OUTLINES = {
  'surface-council': [
    { x: 6.32, y: 30.352 },
    { x: 52.09, y: 13.685 },
    { x: 90.367, y: 66.667 },
    { x: 38.532, y: 90.596 },
  ],
  'surface-estate': [
    { x: 0, y: 31.498 },
    { x: 55.657, y: 16.514 },
    { x: 87.87, y: 77.905 },
    { x: 27.625, y: 98.089 },
  ],
}

function rectangleToPoints(area) {
  return [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pointsToString(points) {
  return points.map(point => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' ')
}

function SurfaceLandmarkOutline({ nodeId, points, visible }) {
  const filterId = `surface-outline-${nodeId}`
  const pointString = pointsToString(points)

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 420ms ease',
        zIndex: 1,
      }}
    >
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.035" numOctaves="2" seed={nodeId === 'surface-estate' ? 11 : 17} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.75" result="rough" />
          <feGaussianBlur in="rough" stdDeviation="0.7" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="rough" />
          </feMerge>
        </filter>
      </defs>

      <polygon
        points={pointString}
        fill="rgba(247, 224, 188, 0.07)"
        stroke="rgba(161, 102, 61, 0.38)"
        strokeWidth="1.9"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        filter={`url(#${filterId})`}
      />
      <polygon
        points={pointString}
        fill="none"
        stroke="rgba(246, 230, 203, 0.88)"
        strokeWidth="0.72"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function SurfaceCalibrationOverlay({ nodeId, initialPoints }) {
  const [points, setPoints] = useState(() => initialPoints ?? rectangleToPoints())
  const [draggingIndex, setDraggingIndex] = useState(null)

  const pointString = useMemo(() => pointsToString(points), [points])

  const coordinateText = useMemo(
    () => JSON.stringify(points.map(point => ({
      x: Number(point.x.toFixed(3)),
      y: Number(point.y.toFixed(3)),
    }))),
    [points],
  )

  const movePoint = event => {
    if (draggingIndex === null) return
    const region = event.currentTarget.closest('.center-region')
    if (!region) return
    const rect = region.getBoundingClientRect()
    const x = clamp((event.clientX - rect.left) / rect.width * 100, 0, 100)
    const y = clamp((event.clientY - rect.top) / rect.height * 100, 0, 100)
    setPoints(current => current.map((point, index) => (
      index === draggingIndex ? { x, y } : point
    )))
  }

  const stopDragging = event => {
    if (draggingIndex === null) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setDraggingIndex(null)
  }

  return (
    <div
      data-center-calibration
      onPointerMove={movePoint}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClick={event => event.stopPropagation()}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <polygon
          points={pointString}
          fill="rgba(188, 115, 61, 0.12)"
          stroke="rgba(146, 75, 35, 0.95)"
          strokeWidth="0.25"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {points.map((point, index) => (
        <button
          key={`${nodeId}-${index}`}
          type="button"
          aria-label={`${nodeId} corner ${index + 1}`}
          onPointerDown={event => {
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            setDraggingIndex(index)
          }}
          style={{
            position: 'absolute',
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: 18,
            height: 18,
            padding: 0,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.95)',
            background: draggingIndex === index ? '#7e321c' : '#b55f35',
            boxShadow: '0 0 0 2px rgba(91,45,25,0.75), 0 2px 8px rgba(0,0,0,0.32)',
            transform: 'translate(-50%, -50%)',
            cursor: draggingIndex === index ? 'grabbing' : 'grab',
            pointerEvents: 'auto',
            zIndex: 2,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          left: `${points[0].x}%`,
          top: `${Math.max(1, points[0].y - 2)}%`,
          transform: 'translateY(-100%)',
          width: 310,
          maxWidth: '45vw',
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(31, 27, 24, 0.9)',
          color: '#f5eee4',
          font: '12px/1.45 monospace',
          pointerEvents: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}
      >
        <strong style={{ display: 'block', marginBottom: 4 }}>{nodeId}</strong>
        <code style={{ wordBreak: 'break-all' }}>{coordinateText}</code>
        <button
          type="button"
          onClick={async event => {
            event.stopPropagation()
            await navigator.clipboard?.writeText(`${nodeId}: ${coordinateText}`)
          }}
          style={{ marginTop: 6, cursor: 'pointer' }}
        >
          复制坐标
        </button>
      </div>
    </div>
  )
}

function CenterRegion({
  node,
  focused,
  annotationLeaving,
  onHoverStart,
  onHoverEnd,
  onKeepFocus,
  onOpenDetail,
  className = '',
}) {
  const [hovered, setHovered] = useState(false)
  const [introVisible, setIntroVisible] = useState(false)
  const nodeState = node.state ?? 'sensed'
  const revealState = node.reveal ?? 'sensed'
  const isSurfaceOverviewNode = className.includes('center-region--surface-dot')
  const hitArea = isSurfaceOverviewNode ? SURFACE_OVERVIEW_HIT_AREAS[node.id] : null
  const outlinePoints = isSurfaceOverviewNode ? SURFACE_OVERVIEW_OUTLINES[node.id] : null
  const calibrationEnabled = isSurfaceOverviewNode
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('centerCalibrate') === '1'

  useEffect(() => {
    if (!isSurfaceOverviewNode || calibrationEnabled) return undefined
    const delay = node.id === 'surface-estate' ? 500 : 1250
    const showTimer = window.setTimeout(() => setIntroVisible(true), delay)
    const hideTimer = window.setTimeout(() => setIntroVisible(false), delay + 1050)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [calibrationEnabled, isSurfaceOverviewNode, node.id])

  const style = {
    '--node-x': `${hitArea?.x ?? node.x}%`,
    '--node-y': `${hitArea?.y ?? node.y}%`,
    '--node-width': `${hitArea?.width ?? node.width}%`,
    '--node-height': `${hitArea?.height ?? node.height}%`,
  }

  const outlineVisible = Boolean(outlinePoints && (introVisible || hovered || focused))

  return (
    <div
      className={`center-region center-region--${node.type} center-region--state-${nodeState}${focused ? ' is-focused' : ''}${annotationLeaving ? ' is-annotation-leaving' : ''} ${className}`}
      style={style}
      data-world={node.world}
      data-state={nodeState}
      data-reveal={revealState}
      data-center-node-id={node.id}
      onMouseEnter={event => {
        if (calibrationEnabled) return
        setHovered(true)
        onHoverStart(node.id, event)
      }}
      onMouseLeave={() => {
        if (calibrationEnabled) return
        setHovered(false)
        onHoverEnd()
      }}
    >
      <span
        className="center-region-shape"
        aria-hidden="true"
        style={isSurfaceOverviewNode ? { opacity: 0 } : undefined}
      />
      <span
        className="center-region-title"
        style={isSurfaceOverviewNode ? { opacity: 0 } : undefined}
      >
        {node.title}
      </span>

      {!calibrationEnabled && outlinePoints && (
        <SurfaceLandmarkOutline
          nodeId={node.id}
          points={outlinePoints}
          visible={outlineVisible}
        />
      )}

      {calibrationEnabled && hitArea && (
        <SurfaceCalibrationOverlay nodeId={node.id} initialPoints={outlinePoints} />
      )}

      {focused && !calibrationEnabled && (
        <div className="center-region-annotation" data-center-annotation>
          <span className="center-region-annotation-stroke" aria-hidden="true" />
          <button
            type="button"
            className="center-region-annotation-target"
            onMouseEnter={onKeepFocus}
            onClick={(event) => {
              event.stopPropagation()
              onOpenDetail(node.id)
            }}
          >
            <span className="center-region-annotation-title">{node.title}</span>
            <span className="center-region-annotation-copy">{node.annotation ?? node.description}</span>
            <span className="center-region-annotation-hint">点击细看</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default CenterRegion
