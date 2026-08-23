import './ReaderSceneTransition.css'

function ReaderSceneTransition({ sceneId, phase = 'idle', children }) {
  return (
    <div
      className={`reader-scene-transition reader-scene-transition--${phase}`}
      data-scene-id={sceneId || undefined}
      data-scene-transition={phase}
    >
      {children}
    </div>
  )
}

export default ReaderSceneTransition
