import { useMemo, useState } from 'react'
import SceneRenderer from '../sceneRuntime/SceneRenderer'
import { resolveSceneInteraction, INTERACTION_TYPES } from '../sceneRuntime/interactionResolver'
import { useSceneMovement } from '../sceneRuntime/useSceneMovement'
import { CAFE_SCENE } from './cafeScene'
import {
  advanceCafeDialogue,
  applyCafeEvent,
  createInitialCafeNarrative,
  getCafeStageLabel,
  getCurrentCafeDialogue,
} from './cafeNarrative'
import './CafeDemo.css'

function createObjectState(narrative, highlightedObjectId) {
  const highlighted = id => highlightedObjectId === id
  return {
    door: { open: narrative.doorOpen, highlighted: highlighted('door') },
    counter: { ordered: narrative.coffeeOrdered, highlighted: highlighted('counter') },
    server: { delivered: narrative.coffeeDelivered, highlighted: highlighted('server') },
    window: { looked: narrative.laoZhouLooksOutside, highlighted: highlighted('window') },
    table: { occupied: narrative.laoZhouReacted, highlighted: highlighted('table') },
    chair: { occupied: narrative.laoZhouReacted, highlighted: highlighted('chair') },
    coffee: { visible: narrative.coffeeDelivered, empty: narrative.cupEmpty, highlighted: highlighted('coffee') },
    'lao-zhou': {
      turned: narrative.laoZhouReacted,
      lookingOutside: narrative.laoZhouLooksOutside,
      highlighted: highlighted('lao-zhou'),
    },
  }
}

function dialoguePosition(speakerObject) {
  if (!speakerObject) return undefined
  return {
    '--dialogue-x': `${Math.min(66, speakerObject.position.x - 14)}%`,
    '--dialogue-y': `${Math.min(62, speakerObject.position.y + 10)}%`,
  }
}

export default function CafeDemo() {
  const [narrative, setNarrative] = useState(createInitialCafeNarrative)
  const [highlightedObjectId, setHighlightedObjectId] = useState(null)
  const movement = useSceneMovement(CAFE_SCENE.protagonist.start)
  const objectState = useMemo(
    () => createObjectState(narrative, highlightedObjectId),
    [narrative, highlightedObjectId],
  )
  const currentDialogue = getCurrentCafeDialogue(narrative)

  const setFeedback = message => {
    setNarrative(previous => ({
      ...previous,
      feedback: message,
      feedbackVersion: previous.feedbackVersion + 1,
    }))
  }

  const handleInteract = objectId => {
    if (movement.isMoving) return
    const resolution = resolveSceneInteraction({
      scene: CAFE_SCENE,
      objectId,
      narrativeState: narrative,
    })
    setHighlightedObjectId(objectId)
    if (!resolution.target) {
      setFeedback(resolution.message ?? '这里没有可接触的对象。')
      return
    }

    movement.moveTo(resolution.target, () => {
      if (resolution.type === INTERACTION_TYPES.STORY) {
        setNarrative(previous => applyCafeEvent(previous, resolution.event))
        return
      }
      setFeedback(resolution.message ?? '它安静地留在原处。')
    })
  }

  const handleAdvanceDialogue = () => {
    if (movement.isMoving) return
    setNarrative(previous => advanceCafeDialogue(previous))
  }

  const handleReset = () => {
    setNarrative(createInitialCafeNarrative())
    setHighlightedObjectId(null)
  }

  return (
    <div className="center-cafe-demo" data-story-stage={narrative.stage}>
      <header className="center-cafe-demo__header">
        <div>
          <p className="center-cafe-demo__eyebrow">NEWTONE / CENTER / PLAYABLE STUDY</p>
          <h1>{CAFE_SCENE.title}</h1>
          <p className="center-cafe-demo__subtitle">{CAFE_SCENE.subtitle}</p>
        </div>
        <div className="center-cafe-demo__state" aria-label="剧情状态">
          <span>状态</span>
          <strong data-story-state>{getCafeStageLabel(narrative.stage)}</strong>
        </div>
      </header>

      <main className="center-cafe-demo__main">
        <SceneRenderer
          scene={CAFE_SCENE}
          protagonistPosition={movement.position}
          objectState={objectState}
          narrativeState={narrative}
          isMoving={movement.isMoving}
          movementDuration={movement.movement?.duration}
          onInteract={handleInteract}
          renderOverlay={({ getObject }) => currentDialogue && (
            <aside
              className="scene-dialogue"
              style={dialoguePosition(getObject('lao-zhou'))}
              data-dialogue
              data-speaker={currentDialogue.speaker}
              aria-live="polite"
            >
              <span className="scene-dialogue__speaker">{currentDialogue.speaker}</span>
              <p>{currentDialogue.text}</p>
              <button type="button" onClick={handleAdvanceDialogue} data-dialogue-advance>
                {narrative.dialogue.index === 0 ? '继续' : '下一句'}
              </button>
            </aside>
          )}
        />
      </main>

      <footer className="center-cafe-demo__footer">
        <p className="center-cafe-demo__feedback" key={narrative.feedbackVersion} data-scene-feedback>
          {narrative.feedback}
        </p>
        <p className="center-cafe-demo__hint">
          {movement.isMoving ? '正在走过去……' : currentDialogue ? '读完对白后点击“继续”。' : '点击文字对象，让修杰走过去。'}
        </p>
        <button className="center-cafe-demo__reset" type="button" onClick={handleReset}>
          重置片段
        </button>
      </footer>
    </div>
  )
}
