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
  const [metrics, setMetrics] = useState({ width: innerWidth, height: innerHeight, viewportWidth: innerWidth })
  const position = {
    x: room.bounds.x + room.bounds.width / 2,
    y: edge === 'top' ? room.bounds.y + 1 : room.bounds.y + room.bounds.height - 1,
  }
  const cameraOffset = { x: 50 - position.x, y: 50 - position.y }
  const geometry = createMainlineSceneGeometrySnapshot(scene, position, {}, metrics, new Map())
  return <div className="mainline-scene--map-only" style={{ '--room': '#0b0f12', '--active': '#f0cc7b', '--ink': '#b0bec5', '--soft': '#a1c2c2', '--muted': '#6c8088' } as React.CSSProperties}>
    <div style={{ position: 'fixed', zIndex: 100, top: 8, left: 8, display: 'flex', gap: 6 }}>
      <button data-action-edge="top" onClick={() => setEdge('top')}>Top edge</button>
      <button data-action-edge="bottom" onClick={() => setEdge('bottom')}>Bottom edge</button>
    </div>
    <MainlineSceneRenderer
      scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null}
      geometrySnapshot={geometry} viewportMetrics={metrics}
      onScreenMetricsChange={next => setMetrics(current => current.width === next.width && current.height === next.height ? current : { ...next, viewportWidth: innerWidth })}
      cameraOffset={cameraOffset} onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}}
      sceneAction={{ entityId: 'fixture-two-long-options', options: ['请确认这是一条较长的第一项选择内容', '这是另一条需要在窄屏中换行显示的较长选项'], position, cameraOffset }}
      onSceneActionStart={() => {}} onSceneActionChoice={() => {}}
    />
  </div>
}

createRoot(document.getElementById('root')!).render(<Fixture />)
