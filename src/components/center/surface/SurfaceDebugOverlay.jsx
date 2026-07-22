const DEBUG = import.meta.env.DEV

function SurfaceDebugOverlay({ viewportWidth, viewportHeight, cameraZoom, panX, panY }) {
  if (!DEBUG) return null

  const renderedWidth = viewportWidth * cameraZoom
  const renderedHeight = viewportHeight * cameraZoom

  return (
    <div
      className="surface-debug-overlay"
      style={{
        position: 'fixed',
        zIndex: 9999,
        right: 8,
        bottom: 8,
        padding: '6px 10px',
        background: 'rgba(0,0,0,0.72)',
        color: '#b0bec5',
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.5,
        pointerEvents: 'none',
        userSelect: 'none',
        borderRadius: 4,
      }}
    >
      <div>{viewportWidth} × {viewportHeight}</div>
      <div>zoom: {cameraZoom.toFixed(3)}</div>
      <div>pan: ({panX.toFixed(1)}, {panY.toFixed(1)})</div>
      <div>rendered: {renderedWidth.toFixed(0)} × {renderedHeight.toFixed(0)}</div>
    </div>
  )
}

export default SurfaceDebugOverlay
