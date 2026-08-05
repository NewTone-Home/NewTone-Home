import { memo, useEffect, useRef, useState } from 'react'
import { getReaderSceneLabel, getReaderUi } from '../../i18n/readerUi'

function ReaderSceneLabel({ scene, language }) {
  const label = getReaderSceneLabel(language, scene.locationId, scene.label)
  const ui = getReaderUi(language)
  const [displayName, setDisplayName] = useState(label)
  const [changing, setChanging] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (label === displayName) return undefined
    setChanging(true)
    timerRef.current = window.setTimeout(() => {
      setDisplayName(label)
      requestAnimationFrame(() => setChanging(false))
    }, 420)
    return () => window.clearTimeout(timerRef.current)
  }, [displayName, label])

  return (
    <div className="reader-scene-label" aria-label={`${ui.currentScene}: ${displayName}`}>
      <span className="reader-scene-prefix">{ui.currentScene}: </span>
      <span className={`reader-scene-name${changing ? ' is-changing' : ''}`}>{displayName}</span>
    </div>
  )
}

export default memo(ReaderSceneLabel, (previous, next) => (
  previous.scene.id === next.scene.id
  && previous.scene.label === next.scene.label
  && previous.scene.locationId === next.scene.locationId
  && previous.language === next.language
))
