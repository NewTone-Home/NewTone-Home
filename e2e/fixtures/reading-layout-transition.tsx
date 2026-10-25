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
const overflowTypingText = '\u8fd9\u6bb5\u6d4b\u8bd5\u6587\u5b57\u9700\u8981\u5728\u7a84\u5c4f\u4e2d\u62c6\u6210\u591a\u4e2a\u9605\u8bfb\u9875\uff0c\u4ee5\u9a8c\u8bc1\u6253\u5b57\u673a\u8865\u5168\u5148\u4e8e\u5206\u9875\u63a8\u8fdb\u3002'.repeat(12)

function Fixture() {
  const scene = mainlineScenes['commercial-street']
  const cafe = scene.storefronts.find(slot => slot.id === 'commercial-cafe-slot')!
  const position = mainlineStorefrontAnchor(scene, cafe)
  const [pageIndex, setPageIndex] = useState(0)
  const [mode, setMode] = useState<'observation' | 'dialogue' | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [typing, setTyping] = useState(false)
  const [typingOverflow, setTypingOverflow] = useState(false)
  const [metrics, setMetrics] = useState({ width: innerWidth, height: innerHeight, viewportWidth: innerWidth })
  const presentation = useStorefrontPresentation(scene, position)
  const geometry = createMainlineSceneGeometrySnapshot(scene, position, {}, metrics, presentation.phaseByStorefront)
  const pageText = pages[pageIndex]
  const dialogueLines = [{ id: 'fixture-line', speaker: '老周' as const, text: pages.join('') }]
  // Match production: dialogueLine is the complete authored line; dialogueText
  // is only the currently presented page. The full line supplies a stable
  // camera/placement envelope while page text changes.
  const dialogueLine = dialogueLines[0]

  return <div className="mainline-scene--map-only" data-fixture-page-index={pageIndex} data-fixture-typing={String(typing)} style={{ '--room': '#0b0f12', '--active': '#f0cc7b', '--ink': '#b0bec5', '--soft': '#a1c2c2', '--muted': '#6c8088' } as React.CSSProperties}>
    <div style={{ position: 'fixed', zIndex: 100, top: 8, left: 8, display: 'flex', gap: 6 }}>
      <button data-reading-start onClick={() => { setPageIndex(0); setTypingOverflow(false); setTyping(false); setLeaving(false); setMode('observation') }}>Start observation</button>
      <button data-reading-dialogue onClick={() => { setPageIndex(0); setTypingOverflow(false); setTyping(false); setLeaving(false); setMode('dialogue') }}>Start dialogue</button>
      <button data-reading-observation onClick={() => { setPageIndex(0); setTypingOverflow(false); setTyping(false); setLeaving(false); setMode('observation') }}>Start observation</button>
      <button data-reading-type onClick={() => setTyping(true)}>Type</button>
      <button data-reading-type-overflow onClick={() => { setPageIndex(0); setTypingOverflow(true); setTyping(true); setLeaving(false); setMode('observation') }}>Type long overflow</button>
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
        readingMode={mode && !leaving ? mode : null}
        sceneEcho={mode === 'observation' ? { id: 810, text: typingOverflow ? overflowTypingText : pageText, segments: typingOverflow ? [overflowTypingText] : pages, segmentIndex: typingOverflow ? 0 : pageIndex, position, typing, ...(leaving ? { phase: 'leaving' as const } : {}) } : null}
        onSceneEchoAdvance={() => {
          if (typing) setTyping(false)
          else setPageIndex(current => Math.min(current + 1, pages.length - 1))
        }}
        onSceneEchoTypingComplete={() => setTyping(false)}
        dialogue={mode === 'dialogue' ? { triggerEntityId: 'fixture-dialogue', lines: dialogueLines as import('../../src/center/runtime/mainlineSceneModel').MainlineSceneDialogueLine[] } : undefined}
        dialogueLine={mode === 'dialogue' ? dialogueLine as import('../../src/center/runtime/mainlineSceneModel').MainlineSceneDialogueLine : null}
        dialogueLineIndex={mode === 'dialogue' ? 0 : null}
        dialogueSegmentIndex={pageIndex}
        dialogueSegmentCount={pages.length}
        dialoguePosition={mode === 'dialogue' ? position : null}
        dialogueText={mode === 'dialogue' ? pageText : undefined}
        onDialogueAdvance={() => setPageIndex(current => Math.min(current + 1, pages.length - 1))}
        dialoguePhase={leaving ? 'leaving' : 'active'}
      />
    </Profiler>
  </div>
}

createRoot(document.getElementById('root')!).render(<Fixture />)
