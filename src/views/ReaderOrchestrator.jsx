import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readerContent, READER_TRANSITION_TYPES } from '../data/readerContent'
import { useReaderInput } from '../hooks/useReaderInput'
import { useReaderNavigation } from '../hooks/useReaderNavigation'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useReaderRestore } from '../hooks/useReaderRestore'
import { READER_STEP_ACTIONS, resolveReaderStep } from '../reader/readerAdvance'
import { hasReaderSceneChanged } from '../reader/readerPresentation'
import { getOverallProgress } from '../reader/readerPosition'
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
  const setLanguage = useProgressStore(state => state.setLanguage)
  const committedLocation = useProgressStore(state => state.committedLocation)
  const commitLocation = useProgressStore(state => state.commitLocation)
  const readerExitGestureLearned = useProgressStore(state => state.readerExitGestureLearned)
  const setReaderExitGestureLearned = useProgressStore(state => state.setReaderExitGestureLearned)
  const isFirstReaderSession = useProgressStore(state => state.isFirstReaderSession)
  const clearResumeRequest = useProgressStore(state => state.clearResumeRequest)
  const chapterTrialEnded = useProgressStore(state => state.chapterTrialEnded)
  const endChapterTrial = useProgressStore(state => state.endChapterTrial)
  const completeReader = useProgressStore(state => state.completeReader)
  const readingMode = useProgressStore(state => state.readingMode)
  const standardTheme = useProgressStore(state => state.standardTheme)
  const themePosition = useProgressStore(state => state.themePosition)
  const motionMode = useProgressStore(state => state.motionMode)
  const toggleReadingMode = useProgressStore(state => state.toggleReadingMode)
  const setStandardTheme = useProgressStore(state => state.setStandardTheme)
  const setThemePosition = useProgressStore(state => state.setThemePosition)
  const toggleMotionMode = useProgressStore(state => state.toggleMotionMode)
  const transitionTo = useTransitionStore(state => state.transitionTo)
  const reducedMotion = useReducedMotion()
  const rootRef = useRef(null)
  const focusRef = useRef(null)
  const [pageMotion, setPageMotion] = useState('idle')
  const [autoVisual, setAutoVisual] = useState(null)
  const pageMotionTimerRef = useRef(null)
  const blockedGestureRef = useRef(null)
  const pageTransitionBusyRef = useRef(false)
  const navigation = useReaderNavigation({ initialLocation: committedLocation, reducedMotion, commitLocation })
  const { displayLocation, navigateTo, finishTransition } = navigation
  const page = useMemo(() => getPage(displayLocation), [displayLocation])
  const scene = page.scene

  const previousScene = navigation.transitionFrom ? getPage(navigation.transitionFrom).scene : scene
  const sceneTransitionKind = hasReaderSceneChanged(previousScene, scene) ? navigation.transitionKind : null

  useReaderRestore({ rootRef, focusRef, clearResumeRequest, onReaderReady })

  const navigatePage = useCallback((target, gestureId) => {
    blockedGestureRef.current = gestureId
    pageTransitionBusyRef.current = true
    if (reducedMotion) {
      navigateTo(target)
      pageTransitionBusyRef.current = false
      return
    }
    setPageMotion('leaving')
    window.clearTimeout(pageMotionTimerRef.current)
    pageMotionTimerRef.current = window.setTimeout(() => {
      navigateTo(target)
      setPageMotion('entering')
      pageMotionTimerRef.current = window.setTimeout(() => {
        setPageMotion('idle')
        pageTransitionBusyRef.current = false
      }, 360)
    }, 220)
  }, [navigateTo, reducedMotion])

  useEffect(() => {
    if (autoVisual !== 'white') return undefined
    const timer = window.setTimeout(() => setAutoVisual(null), reducedMotion ? 180 : 980)
    return () => window.clearTimeout(timer)
  }, [autoVisual, reducedMotion])

  const handleReadingSteps = useCallback((steps, meta = {}) => {
    if (pageTransitionBusyRef.current) return
    if (!readerExitGestureLearned) setReaderExitGestureLearned()
    const gestureId = meta.gestureId ?? `direct-${Date.now()}`
    if (blockedGestureRef.current === gestureId) return
    blockedGestureRef.current = null

    const action = resolveReaderStep({ page, location: displayLocation, steps, chapterTrialEnded })
    if (action.type === READER_STEP_ACTIONS.NONE) return

    if (action.type === READER_STEP_ACTIONS.BEAT) {
      navigateTo(action.location)
      if (action.reachedBoundary) {
        blockedGestureRef.current = gestureId
        clearInputAccumulatorRef.current?.()
      }
      return
    }

    clearInputAccumulatorRef.current?.()
    if (action.type === READER_STEP_ACTIONS.PAGE) {
      if (action.boundaryVisual === 'white-flash') setAutoVisual('white')
      navigatePage(action.location, gestureId)
      return
    }

    blockedGestureRef.current = gestureId
    endChapterTrial()
    completeReader()
  }, [chapterTrialEnded, completeReader, displayLocation, endChapterTrial, navigatePage, navigateTo, page, readerExitGestureLearned, setReaderExitGestureLearned])

  const clearInputAccumulatorRef = useRef(null)
  const { clearInputAccumulator } = useReaderInput({
    onSteps: handleReadingSteps,
  })
  clearInputAccumulatorRef.current = clearInputAccumulator

  useEffect(() => () => window.clearTimeout(pageMotionTimerRef.current), [])

  const handleReturnCenter = useCallback(() => {
    clearInputAccumulator()
    setReaderExitGestureLearned()
    transitionTo('center', { preset: 'reader-to-core' })
  }, [clearInputAccumulator, setReaderExitGestureLearned, transitionTo])

  const finishFocusMotion = useCallback((event) => {
    if (event.target === event.currentTarget) finishTransition()
  }, [finishTransition])

  return (
    <ReaderStage
      page={{ ...page, scene }}
      beats={page.beats}
      focusBeatIndex={displayLocation.beatIndex}
      progress={page.beats.length === 1 ? 1 : displayLocation.beatIndex / (page.beats.length - 1)}
      overallProgress={getOverallProgress(displayLocation)}
      language={language}
      onLanguage={setLanguage}
      readingMode={readingMode}
      standardTheme={standardTheme}
      themePosition={themePosition}
      motionMode={motionMode}
      onReadingMode={toggleReadingMode}
      onStandardTheme={setStandardTheme}
      onThemePosition={setThemePosition}
      onMotionMode={toggleMotionMode}
      onFocusMotionEnd={finishFocusMotion}
      transitionKind={pageMotion === 'idle' ? navigation.transitionKind : `page-${pageMotion}`}
      sceneTransitionKind={sceneTransitionKind}
      autoVisual={autoVisual}
      tutorialVisible={isFirstReaderSession && !readerExitGestureLearned}
      rootRef={rootRef}
      focusRef={focusRef}
      chapterTrialEnded={chapterTrialEnded && page.transitionType === READER_TRANSITION_TYPES.CHAPTER_END && displayLocation.beatIndex === page.beats.length - 1}
      onReturnCenter={handleReturnCenter}
    />
  )
}

export default ReaderOrchestrator
