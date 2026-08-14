import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderLanguage, READER_LANGUAGES } from '../i18n/languages'
import { useScrambleText } from '../hooks/useScrambleText'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import './LanguageWheelSelector.css'

const RESOLUTION = Object.freeze({
  startDelay: 80,
  charInterval: 64,
  scrambleInterval: 42,
})
export const LANGUAGE_WHEEL_IDLE_MS = 720
export const LANGUAGE_SWIPE_THRESHOLD_PX = 24

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function cycleLanguage(code, direction) {
  const currentIndex = READER_LANGUAGES.findIndex(item => item.code === code)
  const safeIndex = currentIndex < 0 ? 0 : currentIndex
  const nextIndex = (safeIndex + direction + READER_LANGUAGES.length) % READER_LANGUAGES.length
  return READER_LANGUAGES[nextIndex].code
}

function LanguageWheelSelector({ language, alternateLanguage, onLanguageChange }) {
  const [phase, setPhase] = useState('idle')
  const [candidatePosition, setCandidatePosition] = useState('bottom')
  const [hasInteracted, setHasInteracted] = useState(false)
  const settleTimerRef = useRef(null)
  const pointerStartYRef = useRef(null)
  const languageLabel = getReaderLanguage(language).label
  const alternateLabel = getReaderLanguage(alternateLanguage).label
  const { displayText, stable } = useScrambleText(languageLabel, {
    ...RESOLUTION,
    enabled: phase === 'decoding' || phase === 'settling',
  })

  useEffect(() => {
    if (phase !== 'decoding' || !stable) return
    setPhase('ready')
    recordRuntimeAudit('language-preview-ready', { language })
  }, [language, phase, stable])

  useEffect(() => {
    if (phase !== 'settling' || !stable) return
    setPhase('ready')
    recordRuntimeAudit('language-wheel-settled', { language })
  }, [language, phase, stable])

  useEffect(() => () => {
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)
  }, [])

  const activate = useCallback((source) => {
    if (phase !== 'idle') return
    setPhase('decoding')
    recordRuntimeAudit('language-preview-start', { language, source })
  }, [language, phase])

  const handlePointerEnter = useCallback(event => {
    if (isCoarsePointer() || event.pointerType !== 'mouse') return
    activate('hover')
  }, [activate])

  const handleClick = useCallback(() => {
    if (!isCoarsePointer()) return
    activate('tap')
  }, [activate])

  const armSettleTimer = useCallback(() => {
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null
      setPhase('settling')
      recordRuntimeAudit('language-wheel-idle', { language })
    }, LANGUAGE_WHEEL_IDLE_MS)
  }, [language])

  const selectByDirection = useCallback((direction, source) => {
    if (!['ready', 'selecting'].includes(phase)) return
    const nextLanguage = cycleLanguage(language, direction)
    setCandidatePosition(direction > 0 ? 'bottom' : 'top')
    setHasInteracted(true)
    setPhase('selecting')
    onLanguageChange?.(nextLanguage)
    recordRuntimeAudit('language-wheel-select', { language: nextLanguage, direction, source })
    armSettleTimer()
  }, [armSettleTimer, language, onLanguageChange, phase])

  const handleWheel = useCallback(event => {
    if (isCoarsePointer() || Math.abs(event.deltaY) < 1) return
    if (!['ready', 'selecting'].includes(phase)) return
    event.preventDefault()
    selectByDirection(event.deltaY > 0 ? 1 : -1, 'wheel')
  }, [phase, selectByDirection])

  const handlePointerDown = useCallback(event => {
    if (!isCoarsePointer() || !['ready', 'selecting'].includes(phase)) return
    pointerStartYRef.current = event.clientY
  }, [phase])

  const handlePointerUp = useCallback(event => {
    if (!isCoarsePointer()) return
    const startY = pointerStartYRef.current
    pointerStartYRef.current = null
    if (startY === null || !['ready', 'selecting'].includes(phase)) return
    const deltaY = event.clientY - startY
    if (Math.abs(deltaY) < LANGUAGE_SWIPE_THRESHOLD_PX) return
    event.preventDefault()
    selectByDirection(deltaY > 0 ? 1 : -1, 'swipe')
  }, [phase, selectByDirection])

  const handlePointerCancel = useCallback(() => {
    pointerStartYRef.current = null
  }, [])

  const showCandidate = ['ready', 'selecting'].includes(phase)
  const showArrow = phase !== 'idle' && phase !== 'decoding'

  return (
    <button
      type="button"
      className="language-wheel-selector"
      data-language-selector="true"
      data-language-selector-phase={phase}
      data-language-selected={language}
      data-language-candidate={alternateLanguage}
      data-language-candidate-position={candidatePosition}
      data-language-arrow-state={showArrow && !hasInteracted ? 'floating' : showArrow ? 'fading' : 'hidden'}
      data-language-fill="none"
      aria-label={`${languageLabel}，语言选择`}
      onPointerEnter={handlePointerEnter}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <span className="language-wheel-selector__current">
        {phase === 'idle' ? '当前语言' : (displayText || languageLabel)}
      </span>
      {showCandidate && (
        <span className="language-wheel-selector__candidate" aria-hidden="true">
          {alternateLabel}
        </span>
      )}
      {showArrow && (
        <span className="language-wheel-selector__arrow" aria-hidden="true">↓</span>
      )}
    </button>
  )
}

export default LanguageWheelSelector
