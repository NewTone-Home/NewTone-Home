import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import ReaderBeatStack from '../components/reader/ReaderBeatStack'
import ReaderPrecipitation from '../components/reader/ReaderPrecipitation'
import ReaderTools from '../components/reader/ReaderTools'
import ReaderTraceProgress from '../components/reader/ReaderTraceProgress'
import ReaderReturnControl from '../components/reader/ReaderReturnControl'
import { resolveReaderEnvironmentPreview } from '../data/reader-experiments/readerEnvironmentPreview'
import { getReaderSceneLabel } from '../i18n/readerUi'
import { preventReaderShortcut, preventReaderTransfer } from '../reader/readerCopyProtection'
import { getReaderThemeVariables } from '../reader/readerTheme'
import {
  createReaderReturnFlowState,
  reduceReaderReturnFlow,
  READER_RETURN_EVENT,
  READER_RETURN_STATE,
} from '../reader/readerReturnFlow'
import './ReaderStage.css'
import './ReaderShellContract.css'

const STANDARD_THEME_POSITIONS = Object.freeze({ light: 0, soft: 0.5, dark: 1 })
const DIRECT_READER_QUERY = '(hover: none), (pointer: coarse), (max-width: 720px)'
const EMPTY_READER_ENVIRONMENT = Object.freeze({
  worldLayer: 'surface', time: 'noon', weather: 'clear', light: 'neutral',
  locationId: 'unpublished', locationLabel: '', characters: [],
  evidence: { worldLayer: { sourceType: 'system' }, weather: { sourceType: 'system' } },
})

function ReaderStage({
  emptyDocument = false,
  contentStatus,
  onRetryContent,
  page,
  beats,
  focusBeatIndex,
  progress,
  language,
  onLanguage,
  readingMode,
  standardTheme,
  themePosition,
  motionMode,
  onReadingMode,
  onStandardTheme,
  onThemePosition,
  onFocusMotionEnd,
  onNativeFocusChange,
  onNativeBoundary,
  onNativeScrollOffset,
  initialScrollOffset,
  narrativeRuntimeEnabled,
  narrativeDeliveryStates,
  activeNarrativePauseId,
  activeNarrativePausePhase,
  activeNarrativeRevealId,
  activeNarrativeTypewriterId,
  transitionKind,
  sceneTransitionKind,
  autoVisual,
  rootRef,
  focusRef,
  chapterTrialEnded,
  returningToLanding = false,
  onReturnStart,
  onReturnLanding,
  onReturnArmedChange,
}) {
  const [returnFlow, dispatchReturn] = useReducer(
    reduceReaderReturnFlow,
    undefined,
    createReaderReturnFlowState,
  )
  const [returnEntryReady, setReturnEntryReady] = useState(false)
  const [exitRequestId, setExitRequestId] = useState(0)
  const [exitRequestMode, setExitRequestMode] = useState('dismiss')
  const returnFlowRef = useRef(returnFlow)
  const pointerGestureRef = useRef(null)
  const wasAtBottomRef = useRef(false)
  const nativeBoundaryLockRef = useRef(null)
  const sceneState = beats[focusBeatIndex]?.sceneState ?? {}
  const sceneStateName = sceneState.sceneState ?? 'normal'
  const nativeEnvironmentState = beats[focusBeatIndex]?.worldState
  const environmentState = nativeEnvironmentState ?? EMPTY_READER_ENVIRONMENT
  const environmentVisual = resolveReaderEnvironmentPreview(environmentState)
  const immersiveStyle = environmentVisual.style
  const stageStyle = readingMode === 'standard'
    ? getReaderThemeVariables(themePosition ?? STANDARD_THEME_POSITIONS[standardTheme] ?? 0.5)
    : immersiveStyle
  const directReaderInput = typeof window !== 'undefined' && (
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    || window.matchMedia(DIRECT_READER_QUERY).matches
  )
  const finalNodeReached = !emptyDocument && beats.length > 0 && focusBeatIndex >= beats.length - 1
  returnFlowRef.current = returnFlow
  const shouldMountReturnControl = returnFlow.state !== READER_RETURN_STATE.HIDDEN
  const shouldShowReturnControl = shouldMountReturnControl
  const returnVisible = shouldMountReturnControl && shouldShowReturnControl
  const locationLabel = emptyDocument
    ? (language === 'en' ? 'No pages yet' : '暂无页面')
    : getReaderSceneLabel(language, environmentState.locationId, environmentState.locationLabels?.[language] || environmentState.locationLabel)?.replace(/\s*·\s*/g, ' · ')

  const handleViewportBoundaryChange = useCallback(({ atBottom, lastNodeReached, direction = 0, atTop = false }) => {
    const wasAtBottom = wasAtBottomRef.current
    const reached = Boolean(atBottom && lastNodeReached)
    wasAtBottomRef.current = reached
    dispatchReturn({
      type: reached
        ? READER_RETURN_EVENT.LAST_CONTENT_REACHED
        : READER_RETURN_EVENT.BOUNDARY_REACHED,
      atBottom: reached,
    })
    if (atTop && direction < 0 && nativeBoundaryLockRef.current !== 'backward') {
      nativeBoundaryLockRef.current = 'backward'
      onNativeBoundary?.('backward')
    }
    if (!atTop && !reached) nativeBoundaryLockRef.current = null
    if (wasAtBottom && !reached && direction < 0) {
      dispatchReturn({ type: READER_RETURN_EVENT.REVERSE_GESTURE })
    }
  }, [onNativeBoundary])

  const armReturn = useCallback(() => {
    if (returnFlowRef.current.state === READER_RETURN_STATE.HIDDEN) {
      dispatchReturn({ type: READER_RETURN_EVENT.LAST_CONTENT_REACHED })
    }
    dispatchReturn({ type: READER_RETURN_EVENT.ACTIVATE })
  }, [])

  const disarmReturn = useCallback(() => {
    dispatchReturn({ type: READER_RETURN_EVENT.CANCEL })
  }, [])

  const handleReturnPointerEnter = useCallback(event => {
    if (event.pointerType !== 'mouse'
      || window.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== true) return
    armReturn()
  }, [armReturn])

  const handleReturnPointerLeave = useCallback(event => {
    if (event.pointerType !== 'mouse'
      || window.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== true
      || returnEntryReady
      || returnFlowRef.current.state !== READER_RETURN_STATE.ARMED) return
    disarmReturn()
  }, [disarmReturn, returnEntryReady])

  const handleReturnPointerDown = useCallback(event => {
    if (!['touch', 'pen'].includes(event.pointerType)
      || returnFlowRef.current.state === READER_RETURN_STATE.ARMED) return
    armReturn()
  }, [armReturn])

  const handleReturnClick = useCallback(event => {
    if (event.detail !== 0) return
    if (returnFlowRef.current.state === READER_RETURN_STATE.ARMED) {
      disarmReturn()
      return
    }
    armReturn()
  }, [armReturn, disarmReturn])

  useEffect(() => {
    dispatchReturn({ type: READER_RETURN_EVENT.RESET })
    setReturnEntryReady(false)
    setExitRequestId(0)
    setExitRequestMode('dismiss')
    wasAtBottomRef.current = false
    pointerGestureRef.current = null
    nativeBoundaryLockRef.current = null
  }, [page?.id])

  useEffect(() => {
    if (!returnVisible) return undefined

    const onWheel = event => {
      const state = returnFlowRef.current
      if (event.deltaY > 8 && state.state === READER_RETURN_STATE.ARMED) {
        if (event.cancelable) event.preventDefault()
        event.stopPropagation()
        dispatchReturn({ type: READER_RETURN_EVENT.FORWARD_GESTURE })
        return
      }
      if (event.deltaY < -8 && [
        READER_RETURN_STATE.REVEALING,
        READER_RETURN_STATE.READY,
        READER_RETURN_STATE.ARMED,
      ].includes(state.state)) {
        if (event.cancelable) event.preventDefault()
        event.stopPropagation()
        dispatchReturn({ type: READER_RETURN_EVENT.REVERSE_GESTURE })
      }
    }

    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => window.removeEventListener('wheel', onWheel, { capture: true })
  }, [onNativeBoundary, returnVisible])

  useEffect(() => {
    if (!returnVisible) return undefined
    const onPointerDown = event => {
      if (!['touch', 'pen'].includes(event.pointerType)) return
      pointerGestureRef.current = { pointerId: event.pointerId, startY: event.clientY }
    }
    const onPointerMove = event => {
      const gesture = pointerGestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      const state = returnFlowRef.current
      const delta = gesture.startY - event.clientY
      if (Math.abs(delta) <= 36) return
      if (![READER_RETURN_STATE.READY, READER_RETURN_STATE.ARMED].includes(state.state)) return
      pointerGestureRef.current = null
      if (event.cancelable) event.preventDefault()
      event.stopPropagation()
      dispatchReturn({
        type: delta > 36
          ? READER_RETURN_EVENT.FORWARD_GESTURE
          : READER_RETURN_EVENT.REVERSE_GESTURE,
      })
    }
    const clearGesture = event => {
      const gesture = pointerGestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      pointerGestureRef.current = null
      if (returnFlowRef.current.state === READER_RETURN_STATE.ARMED
        && Math.abs(gesture.startY - event.clientY) <= 36) disarmReturn()
    }
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
    window.addEventListener('pointerup', clearGesture, { capture: true, passive: true })
    window.addEventListener('pointercancel', clearGesture, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
      window.removeEventListener('pointermove', onPointerMove, { capture: true })
      window.removeEventListener('pointerup', clearGesture, { capture: true })
      window.removeEventListener('pointercancel', clearGesture, { capture: true })
    }
  }, [disarmReturn, onNativeBoundary, returnVisible])

  useEffect(() => {
    if (returnFlow.state === READER_RETURN_STATE.HIDDEN && emptyDocument) {
      dispatchReturn({ type: READER_RETURN_EVENT.LAST_CONTENT_REACHED })
    }
  }, [emptyDocument, returnFlow.state])

  useEffect(() => {
    if (returnFlow.state === READER_RETURN_STATE.HIDDEN
      && !emptyDocument
      && directReaderInput
      && finalNodeReached) {
      dispatchReturn({ type: READER_RETURN_EVENT.LAST_CONTENT_REACHED })
    }
  }, [directReaderInput, emptyDocument, finalNodeReached, returnFlow.state])

  useEffect(() => {
    onReturnArmedChange?.(returnFlow.state === READER_RETURN_STATE.ARMED)
    if (returnFlow.effect === 'return-start' || returnFlow.effect === 'dismiss-start') {
      setExitRequestMode(returnFlow.effect === 'return-start' ? 'return' : 'dismiss')
      setExitRequestId(current => current + 1)
    }
    if (returnFlow.effect === 'navigation-ready' && returnFlow.returnToLanding) {
      onReturnLanding?.()
    }
  }, [onReturnArmedChange, onReturnLanding, returnFlow.effect, returnFlow.returnToLanding, returnFlow.state])

  return (
    <main
      className={`reader-stage-page paper-surface reader-stage-page--${readingMode} reader-stage-page--theme-${standardTheme} reader-stage-page--motion-${motionMode}${returningToLanding ? ' reader-stage-page--returning' : ''}`}
      style={stageStyle}
      data-reading-mode={readingMode}
      data-motion-mode={motionMode}
      data-returning-to-landing={returningToLanding ? 'true' : 'false'}
      data-scene-state={sceneStateName}
      data-world-layer={environmentState.worldLayer}
      data-scene-characters={environmentState.characters.join(' ')}
      data-world-evidence={environmentState.evidence.worldLayer.sourceType}
      data-time-of-day={environmentState.time}
      data-weather={environmentState.weather}
      data-weather-evidence={environmentState.evidence.weather.sourceType}
      data-reader-location={environmentState.locationId}
      data-light-state={environmentState.light}
      data-environment-preview="chapter"
      data-auto-visual={autoVisual || 'idle'}
      data-copy-protected="true"
      onCopyCapture={preventReaderTransfer}
      onCutCapture={preventReaderTransfer}
      onContextMenu={preventReaderTransfer}
      onDragStartCapture={preventReaderTransfer}
      onKeyDownCapture={preventReaderShortcut}
    >
      <section
        ref={rootRef}
        className={`reader-stage${sceneTransitionKind ? ` reader-stage--scene-${sceneTransitionKind}` : ''}`}
        aria-label={emptyDocument ? 'NewTone Reader：暂无可读页面' : `阅读场景：${environmentState.locationLabel}`}
        data-transition-kind={transitionKind || 'idle'}
      >
        <div className="reader-environment-light" aria-hidden="true" />
        <div className="reader-environment-shadow" aria-hidden="true" />
        <div className="reader-environment-weather" aria-hidden="true">
          <ReaderPrecipitation />
        </div>
        <ReaderTools
          language={language}
          onLanguage={onLanguage}
          readingMode={readingMode}
          standardTheme={standardTheme}
          themePosition={themePosition}
          motionMode={motionMode}
          onReadingMode={onReadingMode}
          onStandardTheme={onStandardTheme}
          onThemePosition={onThemePosition}
          locationId={environmentState.locationId}
          locationLabel={locationLabel}
        />
        {!emptyDocument && <ReaderBeatStack
          beats={beats}
          language={language}
          focusBeatIndex={focusBeatIndex}
          onFocusMotionEnd={onFocusMotionEnd}
          onNativeFocusChange={onNativeFocusChange}
          onNativeScrollOffset={onNativeScrollOffset}
          onViewportBoundaryChange={handleViewportBoundaryChange}
          initialScrollOffset={initialScrollOffset}
          narrativeRuntimeEnabled={narrativeRuntimeEnabled}
          narrativeDeliveryStates={narrativeDeliveryStates}
          activeNarrativePauseId={activeNarrativePauseId}
          activeNarrativePausePhase={activeNarrativePausePhase}
          activeNarrativeRevealId={activeNarrativeRevealId}
          activeNarrativeTypewriterId={activeNarrativeTypewriterId}
          focusRef={focusRef}
        />}
        {emptyDocument && <section className="reader-empty-document" aria-labelledby="reader-empty-document-title">
          <p className="reader-empty-document-mark">NewTone / Reader</p>
          <h1 id="reader-empty-document-title">{language === 'en' ? 'No pages are available yet' : '暂无可读页面'}</h1>
          <p>{language === 'en' ? 'The story has not been published yet. You can still explore the Reader settings.' : '正文尚未发布。Reader 的阅读设置可以继续使用。'}</p>
          {contentStatus !== 'empty' && <button type="button" onClick={onRetryContent}>{language === 'en' ? 'Try again' : '重新检查正文'}</button>}
        </section>}
        {!emptyDocument && <ReaderTraceProgress
          key={page?.id}
          progress={progress}
          beats={beats}
          focusBeatIndex={focusBeatIndex}
          language={language}
          readingMode={readingMode}
          returningToLanding={returningToLanding}
        />}
        {returnVisible && <ReaderReturnControl
          armed={returnFlow.state === READER_RETURN_STATE.ARMED}
          onReadyChange={setReturnEntryReady}
          onPointerEnter={handleReturnPointerEnter}
          onPointerLeave={handleReturnPointerLeave}
          onPointerDown={handleReturnPointerDown}
          onClick={handleReturnClick}
          onDismissStart={() => {}}
          onDismissComplete={() => dispatchReturn({ type: READER_RETURN_EVENT.DISMISS_COMPLETED })}
          exitRequestId={exitRequestId}
          exitRequestMode={exitRequestMode}
          onStart={onReturnStart}
          onComplete={() => dispatchReturn({ type: READER_RETURN_EVENT.DISMISS_COMPLETED })}
          language={language}
        />}
        {chapterTrialEnded && <span className="reader-chapter-end" aria-hidden="true" />}
      </section>
    </main>
  )
}

export default ReaderStage
