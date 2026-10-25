import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MainlineSceneRenderer } from '../../src/center/runtime/MainlineSceneRenderer'
import { createMainlineSceneGeometrySnapshot } from '../../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes } from '../../src/center/runtime/mainlineScenes'
import '../../src/center/runtime/scene.css'

function Fixture() {
  const scene = mainlineScenes['zhongshuyuan-office']
  const room = scene.rooms.find(candidate => candidate.kind !== 'boundary' && candidate.kind !== 'corridor')!
  const [edge, setEdge] = useState<'top' | 'bottom'>('top')
  const [overflowFixture, setOverflowFixture] = useState(false)
  const [walkCount, setWalkCount] = useState(0)
  const [choiceIndex, setChoiceIndex] = useState<number | null>(null)
  const [metrics, setMetrics] = useState({ width: innerWidth, height: innerHeight, viewportWidth: innerWidth })
  const position = {
    x: room.bounds.x + room.bounds.width / 2,
    y: edge === 'top' ? room.bounds.y + 1 : room.bounds.y + room.bounds.height - 1,
  }
  const cameraOffset = { x: 50 - position.x, y: 50 - position.y }
  const geometry = createMainlineSceneGeometrySnapshot(scene, position, {}, metrics, new Map())
  const shortOptions = ['One long option', 'Another long option']
  const longOptions = ['Long option content '.repeat(80), 'Second long option content '.repeat(80)]
  return <div className="mainline-scene--map-only" data-fixture-walk-count={walkCount} data-fixture-choice-index={choiceIndex ?? ''} style={{ '--room': '#0b0f12', '--active': '#f0cc7b', '--ink': '#b0bec5', '--soft': '#a1c2c2', '--muted': '#6c8088' } as React.CSSProperties}>
    <div style={{ position: 'fixed', zIndex: 100, top: 8, left: 8, display: 'flex', gap: 6 }}>
      <button data-action-edge="top" onClick={() => setEdge('top')}>Top edge</button>
      <button data-action-edge="bottom" onClick={() => setEdge('bottom')}>Bottom edge</button>
      <button data-action-overflow onClick={() => setOverflowFixture(true)}>Long options</button>
    </div>
    <MainlineSceneRenderer
      scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null}
      geometrySnapshot={geometry} viewportMetrics={metrics}
      onScreenMetricsChange={next => setMetrics(current => current.width === next.width && current.height === next.height ? current : { ...next, viewportWidth: innerWidth })}
      cameraOffset={cameraOffset} onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => setWalkCount(count => count + 1)}
      sceneAction={{ entityId: 'fixture-two-long-options', options: overflowFixture ? longOptions : shortOptions, position, cameraOffset }}
      onSceneActionStart={() => {}} onSceneActionChoice={index => setChoiceIndex(index)}
    />
  </div>
}

createRoot(document.getElementById('root')!).render(<Fixture />)
