import { useCallback, useEffect, useMemo } from 'react'
import { readerContent } from '../data/readerContent'
import { useReaderInput } from '../hooks/useReaderInput'
import { useReaderNavigation } from '../hooks/useReaderNavigation'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { READER_INTENTS } from '../reader/readerInput'
import { getOverallProgress } from '../reader/readerPosition'
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
  const committedLocation = useProgressStore(state => state.committedLocation)
  const commitLocation = useProgressStore(state => state.commitLocation)
  const reducedMotion = useReducedMotion()
  const navigation = useReaderNavigation({
    initialLocation: committedLocation,
    reducedMotion,
    commitLocation,
  })
  const { displayLocation, animationLocked } = navigation
  const page = useMemo(() => getPage(displayLocation), [displayLocation])

  useEffect(() => {
    const frame = requestAnimationFrame(() => onReaderReady?.())
    return () => cancelAnimationFrame(frame)
  }, [onReaderReady])

  const dispatchIntent = useReaderInput({ animationLocked, onIntent: navigation.navigate })

  const finishFocusMotion = useCallback((event) => {
    if (event.target !== event.currentTarget) return
    navigation.finishTransition()
  }, [navigation])

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
      transitionKind={navigation.transitionKind}
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
