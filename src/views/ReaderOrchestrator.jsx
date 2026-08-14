import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getNarrativeReplayLocation, readerContent, READER_TRANSITION_TYPES, resolveReaderDisplayLocation } from '../data/readerContent'
import { useReaderInput } from '../hooks/useReaderInput'
import { useReaderNavigation } from '../hooks/useReaderNavigation'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useReaderRestore } from '../hooks/useReaderRestore'
import { useNarrativePauseRuntime } from '../hooks/useNarrativePauseRuntime'
import { useNarrativeRevealRuntime } from '../hooks/useNarrativeRevealRuntime'
import { useNarrativeTypewriterRuntime } from '../hooks/useNarrativeTypewriterRuntime'
import { READER_STEP_ACTIONS, resolveReaderStep } from '../reader/readerAdvance'
import { hasReaderSceneChanged } from '../reader/readerPresentation'
import { beginNarrativePlaybackSession, NARRATIVE_RUNTIME_ENABLED } from '../reader/narrativePlaybackSession'
import { getOverallProgress } from '../reader/readerPosition'
import { trackEvent, trackReaderProgress } from '../services/analytics'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import ReaderStage from './ReaderStage'

function getPage(location, content = readerContent) {
  return content
    .find(phase => phase.id === location.phaseId)
    .pages.find(page => page.id === location.pageId)
}

function resolveLocationForContent(location) { return resolveReaderDisplayLocation(location) }

function currentAnalyticsContext() {
  const state = useProgressStore.getState()
  return { language: state.language, readingMode: state.readingMode }
}

function PopulatedReaderOrchestrator({ onReaderReady }) {
  const language = useProgressStore(state => state.language)
  const setLanguage = useProgressStore(state => state.setLanguage)
  const committedLocation = useProgressStore(state => state.committedLocation)
  const commitLocation = useProgressStore(state => state.commitLocation)
  const readerScrollOffset = useProgressStore(state => state.readerScrollOffset)
  const setReaderScrollOffset = useProgressStore(state => state.setReaderScrollOffset)
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
  const selectReadingMode = useProgressStore(state => state.selectReadingMode)
  const setStandardTheme = useProgressStore(state => state.setStandardTheme)
  const setThemePosition = useProgressStore(state => state.setThemePosition)
  const transitionTo = useTransitionStore(state => state.transitionTo)
  const reducedMotion = useReducedMotion()
  const rootRef = useRef(null)
  const focusRef = useRef(null)
  const [pageMotion, setPageMotion] = useState('idle')
  const [autoVisual, setAutoVisual] = useState(null)
  const [returningToLanding, setReturningToLanding] = useState(false)
  const pageMotionTimerRef = useRef(null)
  const blockedGestureRef = useRef(null)
  const pageTransitionBusyRef = useRef(false)
  const clearInputAccumulatorRef = useRef(null)
  const activeReaderContent = readerContent
  const [initialLocation] = useState(() => {
    const replayParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
    const replayChapter = replayParams?.get('narrative-replay')
    const replayBeat = replayParams?.get('narrative-beat')
    const official = getNarrativeReplayLocation(replayChapter, replayBeat) ?? resolveReaderDisplayLocation(committedLocation)
    return resolveLocationForContent(official)
  })
  useMemo(() => beginNarrativePlaybackSession(initialLocation), [initialLocation])
  const commitReaderLocation = useCallback((location) => {
    commitLocation(location)
  }, [commitLocation])
  const navigation = useReaderNavigation({
    initialLocation,
    reducedMotion,
    commitLocation: commitReaderLocation,
    content: activeReaderContent,
  })
  const { displayLocation, navigateTo, syncTo, finishTransition } = navigation
  const activeLocation = useMemo(() => resolveLocationForContent(displayLocation), [displayLocation])
  const page = useMemo(() => getPage(activeLocation, activeReaderContent), [activeLocation, activeReaderContent])
  const scene = page.scene
  const clearNarrativeInputAccumulator = useCallback(() => clearInputAccumulatorRef.current?.(), [])
  const narrativePause = useNarrativePauseRuntime({
    navigateTo,
    clearInputAccumulator: clearNarrativeInputAccumulator,
  })
  const narrativeReveal = useNarrativeRevealRuntime({
    navigateTo,
    clearInputAccumulator: clearNarrativeInputAccumulator,
  })
  const narrativeTypewriter = useNarrativeTypewriterRuntime({
    navigateTo,
    clearInputAccumulator: clearNarrativeInputAccumulator,
  })

  const previousScene = navigation.transitionFrom
    ? getPage(resolveLocationForContent(navigation.transitionFrom), activeReaderContent).scene
    : scene
  const sceneTransitionKind = hasReaderSceneChanged(previousScene, scene) ? navigation.transitionKind : null

  useReaderRestore({ rootRef, focusRef, clearResumeRequest, onReaderReady })

  useEffect(() => {
    if (
      activeLocation.phaseId !== displayLocation.phaseId
      || activeLocation.pageId !== displayLocation.pageId
      || activeLocation.beatIndex !== displayLocation.beatIndex
    ) syncTo(activeLocation)
  }, [activeLocation, displayLocation, syncTo])

  useEffect(() => {
    trackEvent('reading_started', {
      ...currentAnalyticsContext(),
      stepId: `${activeLocation.pageId}:${activeLocation.beatIndex}`,
    })
  }, [])

  useEffect(() => {
    trackEvent('page_entered', {
      ...currentAnalyticsContext(),
      stepId: `page:${page.id}`,
      progressRatio: getOverallProgress(activeLocation, activeReaderContent),
    })
  }, [page.id])

  useEffect(() => {
    trackEvent('chapter_entered', {
      ...currentAnalyticsContext(),
      stepId: `chapter:${page.chapterId}`,
      progressRatio: getOverallProgress(activeLocation, activeReaderContent),
    })
  }, [page.chapterId])

  useEffect(() => {
    const stepId = `${activeLocation.pageId}:${activeLocation.beatIndex}`
    trackReaderProgress(stepId, getOverallProgress(activeLocation, activeReaderContent), currentAnalyticsContext())
  }, [activeLocation, activeReaderContent])

  useEffect(() => {
    const stepId = `${activeLocation.pageId}:${activeLocation.beatIndex}`
    const progressRatio = getOverallProgress(activeLocation, activeReaderContent)
    let visibleStartedAt = document.visibilityState === 'visible' ? performance.now() : null
    let dwellMs = 0

    const closeVisibleSegment = () => {
      if (visibleStartedAt === null) return
      dwellMs += Math.max(0, performance.now() - visibleStartedAt)
      visibleStartedAt = null
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') closeVisibleSegment()
      else if (visibleStartedAt === null) visibleStartedAt = performance.now()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      closeVisibleSegment()
      if (dwellMs >= 250) {
        trackEvent('beat_dwell', {
          ...currentAnalyticsContext(),
          stepId,
          progressRatio,
          dwellMs,
        })
      }
    }
  }, [activeLocation.beatIndex, activeLocation.pageId, activeReaderContent])

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

    if (NARRATIVE_RUNTIME_ENABLED) {
      if (narrativeTypewriter.handleFocusInputDuringTypewriter(steps)) return
      if (narrativeReveal.handleFocusInputDuringReveal(steps)) return
      if (narrativePause.handleFocusInputDuringPause(steps)) return
    }

    const action = resolveReaderStep({ page, location: activeLocation, steps, chapterTrialEnded, content: activeReaderContent })
    if (action.type === READER_STEP_ACTIONS.NONE) return

    if (action.type === READER_STEP_ACTIONS.BEAT) {
      if (NARRATIVE_RUNTIME_ENABLED) {
        if (narrativeTypewriter.startFocusTypewriter({ fromLocation: activeLocation, toLocation: action.location })) return
        if (narrativeReveal.startFocusReveal({ fromLocation: activeLocation, toLocation: action.location })) return
        if (narrativePause.startFocusPause({ fromLocation: activeLocation, toLocation: action.location })) return
      }
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
    const progressRatio = getOverallProgress(activeLocation, activeReaderContent)
    const analyticsContext = currentAnalyticsContext()
    endChapterTrial()
    trackEvent('chapter_completed', {
      ...analyticsContext,
      stepId: `chapter:${page.chapterId}`,
      progressRatio,
    })
    trackEvent('reader_exit', { ...analyticsContext, exitReason: 'completed', progressRatio })
    completeReader()
  }, [activeLocation, activeReaderContent, chapterTrialEnded, completeReader, endChapterTrial, navigatePage, navigateTo, narrativePause, narrativeReveal, narrativeTypewriter, page, readerExitGestureLearned, setReaderExitGestureLearned])

  const handleNativeFocusChange = useCallback((beatIndex) => {
    if (!Number.isInteger(beatIndex) || beatIndex === activeLocation.beatIndex) return
    if (beatIndex < 0 || beatIndex >= page.beats.length) return
    if (!readerExitGestureLearned) setReaderExitGestureLearned()
    const nextLocation = { ...activeLocation, beatIndex, beatId: page.beats[beatIndex]?.id }
    if (NARRATIVE_RUNTIME_ENABLED) {
      if (narrativeTypewriter.handleFlowFocusChange({ fromLocation: activeLocation, toLocation: nextLocation }) === false) return false
      if (narrativeReveal.handleFlowFocusChange({ fromLocation: activeLocation, toLocation: nextLocation }) === false) return false
      if (narrativePause.handleFlowFocusChange({ fromLocation: activeLocation, toLocation: nextLocation }) === false) return false
    }
    syncTo(nextLocation)
    return true
  }, [activeLocation, narrativePause, narrativeReveal, narrativeTypewriter, page.beats, readerExitGestureLearned, setReaderExitGestureLearned, syncTo])

  const handleNativeBoundary = useCallback((direction) => {
    const steps = direction === 'backward' ? -1 : 1
    handleReadingSteps(steps, {
      source: 'native-boundary',
      gestureId: `native-boundary-${direction}-${activeLocation.linearIndex ?? activeLocation.beatId}`,
    })
  }, [activeLocation, handleReadingSteps])

  const { clearInputAccumulator } = useReaderInput({
    onSteps: handleReadingSteps,
  })
  clearInputAccumulatorRef.current = clearInputAccumulator

  useEffect(() => () => window.clearTimeout(pageMotionTimerRef.current), [])

  const handleReaderLanguage = useCallback((nextLanguage) => {
    setLanguage(nextLanguage)
    trackEvent('language_selected', {
      ...currentAnalyticsContext(),
      stepId: 'reader-tools',
      language: nextLanguage,
    })
  }, [setLanguage])

  const handleReaderMode = useCallback((nextMode) => {
    selectReadingMode(nextMode)
    trackEvent('mode_selected', {
      ...currentAnalyticsContext(),
      stepId: 'reader-tools',
      readingMode: nextMode,
    })
  }, [selectReadingMode])

  const handleReturnLanding = useCallback(() => {
    clearInputAccumulator()
    setReaderExitGestureLearned()
    trackEvent('reader_return', {
      ...currentAnalyticsContext(),
      stepId: `${activeLocation.pageId}:${activeLocation.beatIndex}`,
      exitReason: 'return',
      progressRatio: getOverallProgress(activeLocation, activeReaderContent),
    })
    transitionTo('landing', { preset: 'reader-to-surface', waitForReady: false })
  }, [activeLocation, activeReaderContent, clearInputAccumulator, setReaderExitGestureLearned, transitionTo])

  const handleReturnStart = useCallback(() => {
    if (returningToLanding) return
    pageTransitionBusyRef.current = true
    clearInputAccumulator()
    setReturningToLanding(true)
  }, [clearInputAccumulator, returningToLanding])

  const finishFocusMotion = useCallback((event) => {
    if (event.target === event.currentTarget) finishTransition()
  }, [finishTransition])

  return (
    <ReaderStage
      page={{ ...page, scene }}
      beats={page.beats}
      focusBeatIndex={activeLocation.beatIndex}
      progress={page.beats.length === 1 ? 1 : activeLocation.beatIndex / (page.beats.length - 1)}
      language={language}
      onLanguage={handleReaderLanguage}
      readingMode={readingMode}
      standardTheme={standardTheme}
      themePosition={themePosition}
      motionMode={motionMode}
      onReadingMode={handleReaderMode}
      onStandardTheme={setStandardTheme}
      onThemePosition={setThemePosition}
      onFocusMotionEnd={finishFocusMotion}
      onNativeFocusChange={handleNativeFocusChange}
      onNativeBoundary={handleNativeBoundary}
      onNativeScrollOffset={setReaderScrollOffset}
      initialScrollOffset={readerScrollOffset}
      narrativeRuntimeEnabled={NARRATIVE_RUNTIME_ENABLED}
      narrativeDeliveryStates={NARRATIVE_RUNTIME_ENABLED
        ? { ...narrativePause.deliveryStates, ...narrativeReveal.deliveryStates, ...narrativeTypewriter.deliveryStates }
        : {}}
      activeNarrativePauseId={NARRATIVE_RUNTIME_ENABLED ? narrativePause.activePauseId : null}
      activeNarrativePausePhase={NARRATIVE_RUNTIME_ENABLED ? narrativePause.activePausePhase : null}
      activeNarrativeRevealId={NARRATIVE_RUNTIME_ENABLED ? narrativeReveal.activeRevealId : null}
      activeNarrativeTypewriterId={NARRATIVE_RUNTIME_ENABLED ? narrativeTypewriter.activeTypewriterId : null}
      transitionKind={pageMotion === 'idle' ? navigation.transitionKind : `page-${pageMotion}`}
      sceneTransitionKind={sceneTransitionKind}
      autoVisual={autoVisual}
      tutorialVisible={isFirstReaderSession && !readerExitGestureLearned}
      rootRef={rootRef}
      focusRef={focusRef}
      chapterTrialEnded={chapterTrialEnded && page.transitionType === READER_TRANSITION_TYPES.CHAPTER_END && activeLocation.beatIndex === page.beats.length - 1}
      returningToLanding={returningToLanding}
      onReturnStart={handleReturnStart}
      onReturnLanding={handleReturnLanding}
    />
  )
}

function EmptyReaderOrchestrator({ contentStatus, onRetryContent, onReaderReady }) {
  const language = useProgressStore(state => state.language)
  const setLanguage = useProgressStore(state => state.setLanguage)
  const readingMode = useProgressStore(state => state.readingMode)
  const standardTheme = useProgressStore(state => state.standardTheme)
  const themePosition = useProgressStore(state => state.themePosition)
  const motionMode = useProgressStore(state => state.motionMode)
  const selectReadingMode = useProgressStore(state => state.selectReadingMode)
  const setStandardTheme = useProgressStore(state => state.setStandardTheme)
  const setThemePosition = useProgressStore(state => state.setThemePosition)
  const setReaderExitGestureLearned = useProgressStore(state => state.setReaderExitGestureLearned)
  const transitionTo = useTransitionStore(state => state.transitionTo)
  const [returningToLanding, setReturningToLanding] = useState(false)
  const rootRef = useRef(null)
  const focusRef = useRef(null)

  useEffect(() => { onReaderReady?.() }, [onReaderReady])

  const handleReaderLanguage = useCallback((nextLanguage) => {
    setLanguage(nextLanguage)
    trackEvent('language_selected', { stepId: 'reader-tools', language: nextLanguage, readingMode })
  }, [readingMode, setLanguage])

  const handleReaderMode = useCallback((nextMode) => {
    selectReadingMode(nextMode)
    trackEvent('mode_selected', { stepId: 'reader-tools', language, readingMode: nextMode })
  }, [language, selectReadingMode])

  const handleReturnLanding = useCallback(() => {
    setReaderExitGestureLearned()
    trackEvent('reader_return', {
      stepId: 'content:empty',
      language,
      readingMode,
      exitReason: 'return',
      progressRatio: 0,
    })
    transitionTo('landing', { preset: 'reader-to-surface', waitForReady: false })
  }, [language, readingMode, setReaderExitGestureLearned, transitionTo])

  const handleReturnStart = useCallback(() => {
    setReturningToLanding(true)
  }, [])

  return <ReaderStage
    emptyDocument
    contentStatus={contentStatus}
    onRetryContent={onRetryContent}
    page={null}
    beats={[]}
    focusBeatIndex={0}
    progress={0}
    language={language}
    onLanguage={handleReaderLanguage}
    readingMode={readingMode}
    standardTheme={standardTheme}
    themePosition={themePosition}
    motionMode={motionMode}
    onReadingMode={handleReaderMode}
    onStandardTheme={setStandardTheme}
    onThemePosition={setThemePosition}
    onFocusMotionEnd={() => {}}
    onNativeFocusChange={() => false}
    onNativeBoundary={() => {}}
    onNativeScrollOffset={() => {}}
    initialScrollOffset={0}
    narrativeRuntimeEnabled={false}
    narrativeDeliveryStates={{}}
    transitionKind="idle"
    sceneTransitionKind={null}
    autoVisual={null}
    tutorialVisible={false}
    rootRef={rootRef}
    focusRef={focusRef}
    chapterTrialEnded={false}
    returningToLanding={returningToLanding}
    onReturnStart={handleReturnStart}
    onReturnLanding={handleReturnLanding}
  />
}

function ReaderOrchestrator(props) {
  return readerContent.length === 0
    ? <EmptyReaderOrchestrator {...props} />
    : <PopulatedReaderOrchestrator {...props} />
}

export default ReaderOrchestrator
