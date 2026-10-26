import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MainlineSceneRenderer } from '../../src/center/runtime/MainlineSceneRenderer'
import { createMainlineSceneGeometrySnapshot } from '../../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes } from '../../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../../src/center/runtime/sceneBoundaryGrid'
import '../../src/center/runtime/scene.css'

function Fixture() {
  const scene = mainlineScenes['zhongshuyuan-office']
  const room = scene.rooms.find(candidate => candidate.kind !== 'boundary' && candidate.kind !== 'corridor')!
  const [edge, setEdge] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-left')
  const [overflowFixture, setOverflowFixture] = useState(false)
  const [scrollOverflowFixture, setScrollOverflowFixture] = useState(false)
  const [zeroSavedCamera, setZeroSavedCamera] = useState(false)
  const [renderCameraOffsetOverride, setRenderCameraOffsetOverride] = useState<{ x: number; y: number } | null>(null)
  const [walkCount, setWalkCount] = useState(0)
  const [choiceIndex, setChoiceIndex] = useState<number | null>(null)
  const [actionPhase, setActionPhase] = useState<'active' | 'committing' | 'exiting'>('active')
  const [showAction, setShowAction] = useState(true)
  const [metrics, setMetrics] = useState({ width: innerWidth, height: innerHeight, viewportWidth: innerWidth })
  const position = {
    x: edge.endsWith('left') ? room.bounds.x + 1 : room.bounds.x + room.bounds.width - 1,
    y: edge.startsWith('top') ? room.bounds.y + 1 : room.bounds.y + room.bounds.height - 1,
  }
  const cameraOffset = zeroSavedCamera ? { x: 0, y: 0 } : { x: 50 - position.x, y: 50 - position.y }
  const renderCameraOffset = renderCameraOffsetOverride ?? cameraOffset
  // Match production: geometry stays on the authored design grid while live
  // viewport metrics change independently after resize.
  const geometry = createMainlineSceneGeometrySnapshot(scene, position, {}, sceneDesignReferenceMetrics, new Map())
  const shortOptions = ['One long option', 'Another long option']
  const longOptions = ['Long option content '.repeat(80), 'Second long option content '.repeat(80)]
  const scrollOptions = Array.from({ length: 10 }, (_, index) => `Scroll option ${index + 1}`)
  return <div className="mainline-scene--map-only" data-fixture-walk-count={walkCount} data-fixture-choice-index={choiceIndex ?? ''}
    data-fixture-saved-camera-x={cameraOffset.x} data-fixture-saved-camera-y={cameraOffset.y}
    data-fixture-render-camera-x={renderCameraOffset.x} data-fixture-render-camera-y={renderCameraOffset.y}
    data-fixture-design-width={sceneDesignReferenceMetrics.width} data-fixture-design-height={sceneDesignReferenceMetrics.height}
    style={{ '--room': '#0b0f12', '--active': '#f0cc7b', '--ink': '#b0bec5', '--soft': '#a1c2c2', '--muted': '#6c8088' } as React.CSSProperties}>
    <div style={{ position: 'fixed', zIndex: 100, top: 8, left: 8, display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 'calc(100vw - 16px)' }}>
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(nextEdge =>
        <button key={nextEdge} data-action-edge={nextEdge} onClick={() => { setEdge(nextEdge); setRenderCameraOffsetOverride(null) }}>{nextEdge}</button>,
      )}
      <button data-action-overflow onClick={() => setOverflowFixture(true)}>Long options</button>
      <button data-action-scroll-overflow onClick={() => setScrollOverflowFixture(true)}>Scrollable options</button>
      <button data-camera-handoff onClick={() => setRenderCameraOffsetOverride({ x: cameraOffset.x + 6, y: cameraOffset.y - 4 })}>Handoff offset</button>
      <button data-camera-handoff-mid onClick={() => setRenderCameraOffsetOverride({ x: cameraOffset.x + 3, y: cameraOffset.y - 2 })}>Handoff mid</button>
      <button data-camera-zero onClick={() => { setZeroSavedCamera(true); setRenderCameraOffsetOverride(null) }}>Zero camera</button>
    </div>
    <MainlineSceneRenderer
      scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null}
      geometrySnapshot={geometry} viewportMetrics={metrics}
      onScreenMetricsChange={next => setMetrics(current => current.width === next.width && current.height === next.height ? current : { ...next, viewportWidth: innerWidth })}
      cameraOffset={renderCameraOffset} onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => setWalkCount(count => count + 1)}
      sceneAction={showAction ? { entityId: 'fixture-two-long-options', options: scrollOverflowFixture ? scrollOptions : overflowFixture ? longOptions : shortOptions, position, cameraOffset, phase: actionPhase } : null}
      onSceneActionStart={() => setActionPhase('committing')}
      onSceneActionChoice={index => { setChoiceIndex(index); setActionPhase('exiting') }}
      onSceneActionExitComplete={() => setShowAction(false)}
    />
  </div>
}

createRoot(document.getElementById('root')!).render(<Fixture />)
