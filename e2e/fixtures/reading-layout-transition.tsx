import { Profiler, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MainlineSceneRenderer } from '../../src/center/runtime/MainlineSceneRenderer'
import { createMainlineSceneGeometrySnapshot } from '../../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes, mainlineStorefrontAnchor } from '../../src/center/runtime/mainlineScenes'
import { useStorefrontPresentation } from '../../src/center/runtime/useStorefrontPresentation'
import '../../src/center/runtime/scene.css'

const pages = [
  '这是一个比较宽的第一页，用来观察阅读框怎样收缩',
  '短页',
  '第三页比短页宽一些，再看快速切换',
]

function Fixture() {
  const scene = mainlineScenes['commercial-street']
  const cafe = scene.storefronts.find(slot => slot.id === 'commercial-cafe-slot')!
  const position = mainlineStorefrontAnchor(scene, cafe)
  const [pageIndex, setPageIndex] = useState(0)
  const [reading, setReading] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [metrics, setMetrics] = useState({ width: innerWidth, height: innerHeight, viewportWidth: innerWidth })
  const presentation = useStorefrontPresentation(scene, position)
  const geometry = createMainlineSceneGeometrySnapshot(scene, position, {}, metrics, presentation.phaseByStorefront)
  const pageText = pages[pageIndex]

  return <div className="mainline-scene--map-only" style={{ '--room': '#0b0f12', '--active': '#f0cc7b', '--ink': '#b0bec5', '--soft': '#a1c2c2', '--muted': '#6c8088' } as React.CSSProperties}>
    <div style={{ position: 'fixed', zIndex: 100, top: 8, left: 8, display: 'flex', gap: 6 }}>
      <button data-reading-start onClick={() => { setPageIndex(0); setLeaving(false); setReading(true) }}>Start</button>
      <button data-reading-next onClick={() => setPageIndex(current => (current + 1) % pages.length)}>Next page</button>
      <button data-reading-leave onClick={() => setLeaving(true)}>Leave</button>
    </div>
    <Profiler id="reading-layout-transition-fixture" onRender={() => {
      const windowWithCount = window as Window & { __readingLayoutCommitCount?: number }
      windowWithCount.__readingLayoutCommitCount = (windowWithCount.__readingLayoutCommitCount ?? 0) + 1
    }}>
      <MainlineSceneRenderer
        scene={scene}
        position={position}
        moving={false}
        destination={null}
        layoutMode={false}
        layout={{}}
        activeObjectId={null}
        geometrySnapshot={geometry}
        viewportMetrics={metrics}
        onScreenMetricsChange={next => setMetrics(current => current.width === next.width && current.height === next.height ? current : { ...next, viewportWidth: innerWidth })}
        cameraOffset={{ x: 50 - position.x, y: 50 - position.y }}
        onLayoutChange={() => {}}
        onInteract={() => {}}
        onWalk={() => {}}
        readingMode={reading && !leaving ? 'observation' : null}
        sceneEcho={reading ? { id: 810, text: pageText, segments: pages, segmentIndex: pageIndex, position, typing: false, ...(leaving ? { phase: 'leaving' as const } : {}) } : null}
      />
    </Profiler>
  </div>
}

createRoot(document.getElementById('root')!).render(<Fixture />)
