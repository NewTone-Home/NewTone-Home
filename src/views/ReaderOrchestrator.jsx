import { useCallback, useMemo, useRef } from 'react'
import { readerContent } from '../data/readerContent'
import { useReaderInput } from '../hooks/useReaderInput'
import { useReaderNavigation } from '../hooks/useReaderNavigation'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useReaderRestore } from '../hooks/useReaderRestore'
import { canCompleteReader, isReaderFinalLocation } from '../reader/readerCompletion'
import { READER_INTENTS } from '../reader/readerInput'
import { getOverallProgress } from '../reader/readerPosition'
import { hasReaderSceneChanged } from '../reader/readerPresentation'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import ReaderStage from './ReaderStage'

function getPage(location) {
  return readerContent
    .find(phase => phase.id === location.phaseId)
    .pages.find(page => page.id === location.pageId)
}

function ReaderOrchestrator({ onReaderReady }) {
  const language = useProgressStore(state => state.language)
  const toggleLanguage = useProgressStore(state => state.toggleLanguage)
  const committedLocation = useProgressStore(state => state.committedLocation)
  const commitLocation = useProgressStore(state => state.commitLocation)
  const exitTutorialSeen = useProgressStore(state => state.exitTutorialSeen)
  const setExitTutorialSeen = useProgressStore(state => state.setExitTutorialSeen)
  const clearResumeRequest = useProgressStore(state => state.clearResumeRequest)
  const readerCompleted = useProgressStore(state => state.readerCompleted)
  const completeReader = useProgressStore(state => state.completeReader)
  const transitionTo = useTransitionStore(state => state.transitionTo)
  const reducedMotion = useReducedMotion()
  const rootRef = useRef(null)
  const focusRef = useRef(null)
  const navigation = useReaderNavigation({
    initialLocation: committedLocation,
    reducedMotion,
    commitLocation,
  })
  const { displayLocation, animationLocked } = navigation
  const page = useMemo(() => getPage(displayLocation), [displayLocation])
  const previousScene = navigation.transitionFrom
    ? getPage(navigation.transitionFrom).scene
    : page.scene
  const sceneTransitionKind = hasReaderSceneChanged(previousScene, page.scene)
    ? navigation.transitionKind
    : null

  useReaderRestore({ rootRef, focusRef, clearResumeRequest, onReaderReady })

  const dispatchIntent = useReaderInput({ animationLocked, onIntent: navigation.navigate })
  const completionAvailable = canCompleteReader({
    location: displayLocation,
    forwardExit: page.exits.forward,
    readerCompleted,
  })
  const hasForwardPosition = !isReaderFinalLocation(displayLocation)

  const handleBackward = useCallback(() => {
    const isReaderExit = displayLocation.beatIndex === 0
      && page.exits.backward.action === 'leave-reader'
    if (isReaderExit) {
      transitionTo('landing', { preset: 'reader-to-surface' })
      return
    }
    dispatchIntent(READER_INTENTS.BACKWARD)
  }, [dispatchIntent, displayLocation.beatIndex, page.exits.backward.action, transitionTo])

  const handleForward = useCallback(() => {
    if (completionAvailable) {
      completeReader()
      return
    }
    dispatchIntent(READER_INTENTS.FORWARD)
  }, [completeReader, completionAvailable, dispatchIntent])

  const handleEnterCenter = useCallback(() => {
    transitionTo('center', { preset: 'reader-to-core' })
  }, [transitionTo])

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
      onBackward={handleBackward}
      onForward={handleForward}
      onLanguage={toggleLanguage}
      onFocusMotionEnd={finishFocusMotion}
      transitionKind={navigation.transitionKind}
      sceneTransitionKind={sceneTransitionKind}
      tutorialVisible={!exitTutorialSeen}
      onTutorialDismiss={setExitTutorialSeen}
      rootRef={rootRef}
      focusRef={focusRef}
      hasForwardPosition={hasForwardPosition}
      canComplete={completionAvailable}
      readerCompleted={readerCompleted}
      onEnterCenter={handleEnterCenter}
    />
  )
}

export default ReaderOrchestrator
