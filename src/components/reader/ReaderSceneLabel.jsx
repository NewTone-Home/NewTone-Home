import { memo, useEffect, useRef, useState } from 'react'

function ReaderSceneLabel({ scene }) {
  const [displayName, setDisplayName] = useState(scene.label)
  const [changing, setChanging] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (scene.label === displayName) return undefined
    setChanging(true)
    timerRef.current = window.setTimeout(() => {
      setDisplayName(scene.label)
      requestAnimationFrame(() => setChanging(false))
    }, 420)
    return () => window.clearTimeout(timerRef.current)
  }, [displayName, scene.label])

  return (
    <div className="reader-scene-label" aria-label={`当前场景：${displayName}`}>
      <span className="reader-scene-prefix">当前场景：</span>
      <span className={`reader-scene-name${changing ? ' is-changing' : ''}`}>{displayName}</span>
    </div>
  )
}

export default memo(ReaderSceneLabel, (previous, next) => (
  previous.scene.id === next.scene.id
  && previous.scene.label === next.scene.label
))
