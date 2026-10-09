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
  const position = near ? mainlineStorefrontApproach(scene, cafe) : scene.initialPlayerPosition
  const presentation = useStorefrontPresentation(scene, position)
  const metrics = { width: innerWidth, height: innerHeight, viewportWidth: innerWidth }
  const snapshot = createMainlineSceneGeometrySnapshot(scene, position, {}, metrics, presentation.phaseByStorefront)
  return <div style={{ '--active': '#f0cc7b', '--ink': '#b0bec5', '--soft': '#a1c2c2', '--muted': '#6c8088' } as React.CSSProperties}>
    <button style={{ position: 'fixed', zIndex: 100 }} onClick={() => setNear(value => !value)} data-fixture-approach>{near ? 'leave' : 'approach'}</button>
    <MainlineSceneRenderer scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null} geometrySnapshot={snapshot} cameraOffset={{ x: 50 - anchor.x, y: 50 - anchor.y }} onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} storefrontPresentation={presentation.phaseByStorefront} onStorefrontRevealMotionComplete={presentation.completeRevealMotion} onStorefrontLingerAnimationComplete={presentation.completeLingerAnimation} onStorefrontRestoreMotionComplete={presentation.completeRestoreMotion} />
  </div>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
