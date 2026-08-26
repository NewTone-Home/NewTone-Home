import { getSceneObject } from './interactionResolver'

function percentPosition(point) {
  return { left: `${point.x}%`, top: `${point.y}%` }
}

function getObjectPresentation(object, objectState, narrativeState) {
  if (typeof object.presentation === 'function') {
    return object.presentation({ objectState, narrativeState })
  }
  return { label: object.label }
}

function SceneObject({ object, objectState, narrativeState, isMoving, onInteract }) {
  const presentation = getObjectPresentation(object, objectState, narrativeState)
  if (presentation.hidden) return null
  const isInteractive = Boolean(object.interaction)
  const className = [
    'scene-object',
    `scene-object--${object.kind ?? 'object'}`,
    isInteractive ? 'scene-object--interactive' : '',
    presentation.emphasis ? 'scene-object--emphasis' : '',
  ].filter(Boolean).join(' ')

  const content = (
    <>
      <span className="scene-object__label">{presentation.label}</span>
      {presentation.stateText && <span className="scene-object__state">{presentation.stateText}</span>}
      {presentation.reaction && <span className="scene-object__reaction">{presentation.reaction}</span>}
    </>
  )

  if (!isInteractive) {
    return <span className={className} style={percentPosition(object.position)}>{content}</span>
  }

  return (
    <button
      className={className}
      style={percentPosition(object.position)}
      type="button"
      disabled={isMoving}
      data-scene-object={object.id}
      aria-label={presentation.label}
      onClick={() => onInteract(object.id)}
    >
      {content}
    </button>
  )
}

export default function SceneRenderer({
  scene,
  protagonistPosition,
  objectState,
  narrativeState,
  isMoving,
  movementDuration,
  onInteract,
  renderOverlay,
}) {
  const protagonist = scene.protagonist
  const protagonistStyle = {
    ...percentPosition(protagonistPosition),
    '--movement-duration': `${movementDuration ?? scene.movementDuration ?? 360}ms`,
  }

  return (
    <section className="scene-stage" aria-label={scene.title}>
      <svg className="scene-walk-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {scene.walkways.map(line => (
          <line key={line.id} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
        ))}
      </svg>

      {scene.objects.map(object => (
        <SceneObject
          key={object.id}
          object={object}
          objectState={objectState[object.id]}
          narrativeState={narrativeState}
          isMoving={isMoving}
          onInteract={onInteract}
        />
      ))}

      <div className="scene-protagonist" style={protagonistStyle} data-protagonist-position={`${protagonistPosition.x},${protagonistPosition.y}`}>
        <span className="scene-protagonist__dot" aria-hidden="true" />
        <span>{protagonist.label}</span>
      </div>

      {renderOverlay?.({
        getObject: objectId => getSceneObject(scene, objectId),
        objectState,
        narrativeState,
      })}
    </section>
  )
}
