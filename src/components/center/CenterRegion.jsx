import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

const SURFACE_OVERVIEW_HIT_AREAS = {
  'surface-estate': { x: 13.4, y: 15.6, width: 17.5, height: 17.2 },
  'surface-council': { x: 57.5, y: 42.5, width: 16, height: 17.6 },
}

const SURFACE_OVERVIEW_OUTLINES = {
  'surface-council': [
    { x: 6.63, y: 30.065 },
    { x: 53.141, y: 11.386 },
    { x: 89.776, y: 68.292 },
    { x: 38.532, y: 90.596 },
  ],
  'surface-estate': [
    { x: 0, y: 31.498 },
    { x: 55.657, y: 16.514 },
    { x: 87.87, y: 77.905 },
    { x: 27.625, y: 98.089 },
  ],
}

const DEFAULT_GLOW_SETTINGS = {
  coreWidth: 1.4,
  middleWidth: 5.5,
  outerWidth: 12,
  middleBlur: 2.4,
  outerBlur: 6.5,
  intensity: 1.35,
  hue: 42,
  saturation: 92,
  lightness: 72,
  fadeMs: 1000,
}

const SURFACE_GLOW_SETTINGS = {
  'surface-council': { ...DEFAULT_GLOW_SETTINGS },
  'surface-estate': { ...DEFAULT_GLOW_SETTINGS },
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pointsToString(points) {
  return points.map(point => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' ')
}

function glowColor(settings, alpha = 1) {
  return `hsla(${settings.hue}, ${settings.saturation}%, ${settings.lightness}%, ${alpha})`
}

function SurfaceGlowPolygons({ nodeId, pointString, settings, preview = false }) {
  const prefix = preview ? 'preview-' : ''
  const outerFilterId = `${prefix}surface-glow-outer-${nodeId}`
  const middleFilterId = `${prefix}surface-glow-middle-${nodeId}`
  const intensity = settings.intensity

  return (
    <>
      <defs>
        <filter id={outerFilterId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={settings.outerBlur} />
        </filter>
        <filter id={middleFilterId} x="-55%" y="-55%" width="210%" height="210%">
          <feGaussianBlur stdDeviation={settings.middleBlur} />
        </filter>
      </defs>
      <polygon
        points={pointString}
        fill="none"
        stroke={glowColor(settings, Math.min(0.9, 0.32 * intensity))}
        strokeWidth={settings.outerWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        filter={`url(#${outerFilterId})`}
      />
      <polygon
        points={pointString}
        fill="none"
        stroke={glowColor(settings, Math.min(1, 0.72 * intensity))}
        strokeWidth={settings.middleWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        filter={`url(#${middleFilterId})`}
      />
      <polygon
        points={pointString}
        fill="none"
        stroke="rgba(255, 252, 236, 0.98)"
        strokeWidth={settings.coreWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  )
}

function SurfaceLandmarkOutline({ nodeId, points, visible }) {
  const settings = SURFACE_GLOW_SETTINGS[nodeId] ?? DEFAULT_GLOW_SETTINGS

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
        transition: `opacity ${settings.fadeMs}ms ease`,
        zIndex: 1,
      }}
    >
      <SurfaceGlowPolygons nodeId={nodeId} pointString={pointsToString(points)} settings={settings} />
    </svg>
  )
}

function CalibrationSlider({ label, value, min, max, step, onChange, suffix = '' }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '96px 1fr 54px', gap: 8, alignItems: 'center' }}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
      <output style={{ textAlign: 'right' }}>{value}{suffix}</output>
    </label>
  )
}

function CalibrationPanel({
  nodeId,
  points,
  settings,
  setSetting,
  collapsed,
  setCollapsed,
  panelPosition,
  setPanelPosition,
}) {
  const [panelDrag, setPanelDrag] = useState(null)
  const coordinateText = useMemo(
    () => JSON.stringify(points.map(point => ({
      x: Number(point.x.toFixed(3)),
      y: Number(point.y.toFixed(3)),
    }))),
    [points],
  )
  const settingsText = useMemo(
    () => JSON.stringify(Object.fromEntries(
      Object.entries(settings).map(([key, value]) => [key, Number(value.toFixed?.(2) ?? value)]),
    )),
    [settings],
  )

  const movePanel = event => {
    if (!panelDrag) return
    const width = collapsed ? 240 : 342
    const height = collapsed ? 48 : Math.min(window.innerHeight - 24, 660)
    setPanelPosition({
      x: clamp(event.clientX - panelDrag.offsetX, 8, window.innerWidth - width - 8),
      y: clamp(event.clientY - panelDrag.offsetY, 8, window.innerHeight - height - 8),
    })
  }

  const stopPanelDrag = event => {
    if (!panelDrag) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setPanelDrag(null)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: panelPosition.x,
        top: panelPosition.y,
        width: collapsed ? 240 : 342,
        maxHeight: collapsed ? 48 : 'calc(100vh - 24px)',
        overflow: 'hidden',
        borderRadius: 8,
        background: 'rgba(27, 24, 22, 0.94)',
        color: '#f5eee4',
        font: '12px/1.45 monospace',
        pointerEvents: 'auto',
        boxShadow: '0 10px 32px rgba(0,0,0,0.38)',
        zIndex: nodeId === 'surface-estate' ? 10002 : 10001,
      }}
      onClick={event => event.stopPropagation()}
    >
      <div
        onPointerDown={event => {
          if (event.target.closest('button')) return
          const rect = event.currentTarget.parentElement.getBoundingClientRect()
          event.currentTarget.setPointerCapture(event.pointerId)
          setPanelDrag({
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
          })
        }}
        onPointerMove={movePanel}
        onPointerUp={stopPanelDrag}
        onPointerCancel={stopPanelDrag}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          minHeight: 44,
          padding: '0 10px 0 14px',
          cursor: panelDrag ? 'grabbing' : 'grab',
          userSelect: 'none',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.14)',
        }}
      >
        <strong>{nodeId}</strong>
        <button
          type="button"
          onClick={event => {
            event.stopPropagation()
            setCollapsed(current => !current)
          }}
          style={{ cursor: 'pointer', minWidth: 54 }}
        >
          {collapsed ? '展开' : '收起'}
        </button>
      </div>

      {!collapsed && (
        <div style={{ maxHeight: 'calc(100vh - 78px)', overflowY: 'auto', padding: '12px 14px' }}>
          <div style={{ display: 'grid', gap: 7 }}>
            <CalibrationSlider label="核心亮线" value={settings.coreWidth} min={0.4} max={5} step={0.1} onChange={value => setSetting('coreWidth', value)} />
            <CalibrationSlider label="中层光宽" value={settings.middleWidth} min={1} max={18} step={0.5} onChange={value => setSetting('middleWidth', value)} />
            <CalibrationSlider label="外层光宽" value={settings.outerWidth} min={3} max={32} step={0.5} onChange={value => setSetting('outerWidth', value)} />
            <CalibrationSlider label="中层模糊" value={settings.middleBlur} min={0} max={10} step={0.2} onChange={value => setSetting('middleBlur', value)} />
            <CalibrationSlider label="外层模糊" value={settings.outerBlur} min={0} max={18} step={0.5} onChange={value => setSetting('outerBlur', value)} />
            <CalibrationSlider label="光强" value={settings.intensity} min={0.4} max={3} step={0.05} onChange={value => setSetting('intensity', value)} />
            <CalibrationSlider label="色相" value={settings.hue} min={0} max={70} step={1} onChange={value => setSetting('hue', value)} suffix="°" />
            <CalibrationSlider label="饱和度" value={settings.saturation} min={0} max={100} step={1} onChange={value => setSetting('saturation', value)} suffix="%" />
            <CalibrationSlider label="亮度" value={settings.lightness} min={40} max={95} step={1} onChange={value => setSetting('lightness', value)} suffix="%" />
            <CalibrationSlider label="余辉淡出" value={settings.fadeMs} min={100} max={1800} step={50} onChange={value => setSetting('fadeMs', value)} suffix="ms" />
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.16)' }}>
            <div style={{ marginBottom: 4 }}>四点坐标</div>
            <code style={{ display: 'block', wordBreak: 'break-all' }}>{coordinateText}</code>
            <div style={{ margin: '8px 0 4px' }}>光效参数</div>
            <code style={{ display: 'block', wordBreak: 'break-all' }}>{settingsText}</code>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={async event => {
                  event.stopPropagation()
                  await navigator.clipboard?.writeText(`${nodeId}: ${coordinateText}`)
                }}
              >
                复制坐标
              </button>
              <button
                type="button"
                onClick={async event => {
                  event.stopPropagation()
                  await navigator.clipboard?.writeText(`${nodeId} glow: ${settingsText}`)
                }}
              >
                复制光效
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SurfaceCalibrationOverlay({ nodeId, initialPoints, initialSettings }) {
  const [points, setPoints] = useState(() => initialPoints ?? [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ])
  const [draggingIndex, setDraggingIndex] = useState(null)
  const [settings, setSettings] = useState(() => initialSettings ?? DEFAULT_GLOW_SETTINGS)
  const [collapsed, setCollapsed] = useState(nodeId === 'surface-council')
  const [panelPosition, setPanelPosition] = useState(() => ({
    x: Math.max(12, (typeof window !== 'undefined' ? window.innerWidth : 1440) - 366),
    y: nodeId === 'surface-estate' ? 24 : 82,
  }))

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

  const panel = typeof document !== 'undefined'
    ? createPortal(
        <CalibrationPanel
          nodeId={nodeId}
          points={points}
          settings={settings}
          setSetting={(key, value) => setSettings(current => ({ ...current, [key]: value }))}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          panelPosition={panelPosition}
          setPanelPosition={setPanelPosition}
        />,
        document.body,
      )
    : null

  return (
    <>
      <div
        data-center-calibration
        onPointerMove={movePoint}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onClick={event => event.stopPropagation()}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 30 }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          <SurfaceGlowPolygons
            nodeId={nodeId}
            pointString={pointsToString(points)}
            settings={settings}
            preview
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
      </div>
      {panel}
    </>
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
  const glowSettings = isSurfaceOverviewNode ? SURFACE_GLOW_SETTINGS[node.id] : null
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
      <span className="center-region-shape" aria-hidden="true" style={isSurfaceOverviewNode ? { opacity: 0 } : undefined} />
      <span className="center-region-title" style={isSurfaceOverviewNode ? { opacity: 0 } : undefined}>
        {node.title}
      </span>

      {!calibrationEnabled && outlinePoints && (
        <SurfaceLandmarkOutline nodeId={node.id} points={outlinePoints} visible={outlineVisible} />
      )}

      {calibrationEnabled && hitArea && (
        <SurfaceCalibrationOverlay
          nodeId={node.id}
          initialPoints={outlinePoints}
          initialSettings={glowSettings}
        />
      )}

      {focused && !calibrationEnabled && (
        <div className="center-region-annotation" data-center-annotation>
          <span className="center-region-annotation-stroke" aria-hidden="true" />
          <button
            type="button"
            className="center-region-annotation-target"
            onMouseEnter={onKeepFocus}
            onClick={event => {
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
