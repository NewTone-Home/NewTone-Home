import { useEffect, useRef } from 'react'
import './ReaderSceneTransition.css'

const SCENE_ENTER_MS = 820

function ReaderSceneTransition({ sceneId, phase = 'idle', reducedMotion = false, onComplete, children }) {
  const completedRef = useRef(false)

  useEffect(() => {
    completedRef.current = false
    if (phase !== 'entering') return undefined
    if (reducedMotion) {
      onComplete?.()
      return undefined
    }

    const fallback = window.setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onComplete?.()
    }, SCENE_ENTER_MS + 120)
    return () => window.clearTimeout(fallback)
  }, [onComplete, phase, reducedMotion, sceneId])

  const finish = event => {
    if (event.target !== event.currentTarget || event.animationName !== 'reader-scene-enter') return
    if (completedRef.current) return
    completedRef.current = true
    onComplete?.()
  }

  return (
    <div
      key={sceneId}
      className={`reader-scene-transition reader-scene-transition--${phase}`}
      data-scene-id={sceneId || undefined}
      data-scene-transition={phase}
      onAnimationEnd={finish}
    >
      {children}
    </div>
  )
}

export default ReaderSceneTransition
