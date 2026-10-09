import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MainlineSceneRenderer } from '../../src/center/runtime/MainlineSceneRenderer'
import { mainlineScenes, mainlineStorefrontAnchor, mainlineStorefrontApproach } from '../../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../../src/center/runtime/mainlineSceneGeometrySnapshot'
import { useStorefrontPresentation } from '../../src/center/runtime/useStorefrontPresentation'
import '../../src/center/runtime/scene.css'

// Test-only harness: renders the production geometry, lifecycle and renderer.
function Fixture() {
  const scene = mainlineScenes['commercial-street']
  const cafe = scene.storefronts.find(slot => slot.portalId)!
  const anchor = mainlineStorefrontAnchor(scene, cafe)
  const [near, setNear] = useState(false)
  const [text, setText] = useState('我跟你说，事情不是这样的。')
  const [mode, setMode] = useState<'dialogue' | 'observation' | null>(null)
  const [speaker, setSpeaker] = useState('修杰')
  const [cameraShift, setCameraShift] = useState(0)
  const lines = [{ id: 'long', speaker, text: '我跟你说，这一段长文字需要保持原有正文的阅读方式。' }, { id: 'short', speaker, text: '好。' }]
  const position = near ? mainlineStorefrontApproach(scene, cafe) : scene.initialPlayerPosition
  const presentation = useStorefrontPresentation(scene, position)
  const [metrics, setMetrics] = useState({ width: innerWidth, height: innerHeight, viewportWidth: innerWidth })
  const snapshot = createMainlineSceneGeometrySnapshot(scene, position, {}, metrics, presentation.phaseByStorefront)
  return <div className="mainline-scene--map-only" style={{ '--room': '#0b0f12', '--active': '#f0cc7b', '--ink': '#b0bec5', '--soft': '#a1c2c2', '--muted': '#6c8088' } as React.CSSProperties}>
    <button style={{ position: 'fixed', zIndex: 100 }} onClick={() => setNear(value => !value)} data-fixture-approach>{near ? 'leave' : 'approach'}</button>
    <div style={{ position: 'fixed', top: 30, zIndex: 100 }}>
      <input data-fixture-text value={text} onChange={event => setText(event.target.value)} />
      <input data-fixture-speaker value={speaker} onChange={event => setSpeaker(event.target.value)} />
      <button data-fixture-dialogue onClick={() => setMode('dialogue')}>dialogue</button>
      <button data-fixture-observation onClick={() => setMode('observation')}>observation</button>
      <button data-fixture-close onClick={() => setMode(null)}>close</button>
      <button data-fixture-camera onClick={() => setCameraShift(scene.walkBounds.width / 10)}>camera follow</button>
    </div>
    <MainlineSceneRenderer scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null} geometrySnapshot={snapshot} readingMode={mode} onScreenMetricsChange={next => setMetrics(current => current.width === next.width && current.height === next.height ? current : { ...next, viewportWidth: innerWidth })} cameraOffset={{ x: 50 - anchor.x + cameraShift, y: 50 - anchor.y }} onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => { const target = window as Window & { fixtureWalkCount?: number }; target.fixtureWalkCount = (target.fixtureWalkCount ?? 0) + 1 }} storefrontPresentation={presentation.phaseByStorefront} onStorefrontRevealMotionComplete={presentation.completeRevealMotion} onStorefrontLingerAnimationComplete={presentation.completeLingerAnimation} onStorefrontRestoreMotionComplete={presentation.completeRestoreMotion}
      dialogue={mode === 'dialogue' ? { triggerEntityId: 'fixture', lines: lines as import('../../src/center/runtime/mainlineSceneModel').MainlineSceneDialogueLine[] } : undefined}
      dialogueLine={mode === 'dialogue' ? { id: text, speaker: speaker as import('../../src/center/runtime/mainlineSceneModel').MainlineSceneDialogueSpeaker, text } : null}
      dialogueText={text} dialoguePosition={{ x: anchor.x, y: anchor.y }}
      sceneEcho={mode === 'observation' ? { id: 1, text, segments: [text], segmentIndex: 0, position: anchor, typing: false } : null}
    />
  </div>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
