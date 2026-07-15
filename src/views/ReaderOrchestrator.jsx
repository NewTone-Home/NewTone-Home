import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readerContent } from '../data/readerContent'
import { useReaderInput } from '../hooks/useReaderInput'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { READER_INTENTS } from '../reader/readerInput'
import {
  getOverallProgress,
  nextPosition,
  previousPosition,
  readerContentIndex,
} from '../reader/readerPosition'
import { useProgressStore } from '../stores/progressStore'
import LegacyReader from './Reader'
import ReaderStage from './ReaderStage'

function getPage(location) {
  return readerContent
    .find(phase => phase.id === location.phaseId)
    .pages.find(page => page.id === location.pageId)
}

function InteractiveReaderPreview({ onReaderReady }) {
  const language = useProgressStore(state => state.language)
  const toggleLanguage = useProgressStore(state => state.toggleLanguage)
  const reducedMotion = useReducedMotion()
  const [displayLocation, setDisplayLocation] = useState(readerContentIndex.entries[0])
  const displayLocationRef = useRef(displayLocation)
  const [animationLocked, setAnimationLocked] = useState(false)
  const page = useMemo(() => getPage(displayLocation), [displayLocation])

  useEffect(() => {
    const frame = requestAnimationFrame(() => onReaderReady?.())
    return () => cancelAnimationFrame(frame)
  }, [onReaderReady])

  const move = useCallback((intent) => {
    const target = intent === READER_INTENTS.FORWARD
      ? nextPosition(displayLocationRef.current)
      : previousPosition(displayLocationRef.current)
    if (!target) return false
    displayLocationRef.current = target
    setDisplayLocation(target)
    if (!reducedMotion) setAnimationLocked(true)
    return !reducedMotion
  }, [reducedMotion])

  const dispatchIntent = useReaderInput({ animationLocked, onIntent: move })

  const finishFocusMotion = useCallback((event) => {
    if (event.target !== event.currentTarget) return
    setAnimationLocked(false)
  }, [])

  return (
    <ReaderStage
      phaseId={displayLocation.phaseId}
      page={page}
      focusBeatIndex={displayLocation.beatIndex}
      progress={getOverallProgress(displayLocation)}
      language={language}
      onBackward={() => dispatchIntent(READER_INTENTS.BACKWARD)}
      onForward={() => dispatchIntent(READER_INTENTS.FORWARD)}
      onLanguage={toggleLanguage}
      onFocusMotionEnd={finishFocusMotion}
    />
  )
}

function ReaderOrchestrator(props) {
  const previewEnabled = new URLSearchParams(window.location.search).get('readerStage') === '1'
  return previewEnabled
    ? <InteractiveReaderPreview {...props} />
    : <LegacyReader {...props} />
}

export default ReaderOrchestrator
