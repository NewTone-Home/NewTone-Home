import { createRoot } from 'react-dom/client'
import { useAutomaticPassages } from '../../src/center/runtime/useAutomaticPassages'
import { mainlineScenes } from '../../src/center/runtime/mainlineScenes'
import { mainlinePassageDoorRegion } from '../../src/center/runtime/mainlineNavigation'

const scene = mainlineScenes['commercial-street']
const passage = scene.passages.find(passage => passage.id === 'street-cafe-entry')!
const region = mainlinePassageDoorRegion(passage)
const definitions = [{ id: passage.id, region }]

function Fixture() {
  const runtime = useAutomaticPassages({ passages: definitions })
  return <>
    <button data-request onClick={() => {
      runtime.updateActor('protagonist', scene.initialPlayerPosition)
      runtime.requestPassage('protagonist', passage.id, scene.initialPlayerPosition, region.crossingTargets[1])
    }}>request</button>
    <button data-release onClick={() => runtime.cancelPassage('protagonist')}>release</button>
    <output data-phase>{runtime.getPassagePhase(passage.id)}</output>
    <output data-passable>{String(runtime.getOpenPassageIds().has(passage.id))}</output>
  </>
}
// Deliberately no glyph, Frame, transitionend or animationend consumer.
createRoot(document.getElementById('root')!).render(<Fixture />)
