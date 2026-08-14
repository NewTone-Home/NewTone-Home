import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderLanguage, READER_LANGUAGES } from '../i18n/languages'
import { useScrambleText } from '../hooks/useScrambleText'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import EntryButtonFrame from './EntryButtonFrame'
import './LanguageWheelSelector.css'

const LANGUAGE_PREVIEW_DURATION_MS = 760
export const LANGUAGE_WHEEL_TRANSITION_MS = 360
export const LANGUAGE_ARROW_DELAY_MS = 180
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

function trackCodes(code) {
  return [cycleLanguage(code, -1), code, cycleLanguage(code, 1)]
}

function placeholderLabel(label) {
  return Array.from(label, () => '░').join('')
}

function LanguageWheelSelector({ language, onLanguageChange }) {
  const [phase, setPhase] = useState('idle')
  const [selectedLanguage, setSelectedLanguage] = useState(language)
  const [track, setTrack] = useState(null)
  const [trackState, setTrackState] = useState('center')
  const [hasInteracted, setHasInteracted] = useState(false)
  const [arrowState, setArrowState] = useState('hidden')
  const pointerStartYRef = useRef(null)
  const languageLabel = getReaderLanguage(selectedLanguage).label
  const { displayText, stable } = useScrambleText(languageLabel, {
    startDelay: 80,
    duration: LANGUAGE_PREVIEW_DURATION_MS,
    enabled: phase === 'decoding',
    restartKey: `${phase}:${selectedLanguage}`,
  })

  useEffect(() => {
    if (phase !== 'decoding' || !stable) return
    setPhase('ready')
    recordRuntimeAudit('language-preview-ready', { language: selectedLanguage })
  }, [phase, selectedLanguage, stable])

  useEffect(() => {
    if (phase !== 'ready' || hasInteracted) {
      setArrowState(current => current === 'visible' ? 'fading' : 'hidden')
      return undefined
    }

    setArrowState('hidden')
    const timer = window.setTimeout(() => {
      setArrowState('entering')
      recordRuntimeAudit('language-arrow-reveal-start', { language: selectedLanguage })
      window.requestAnimationFrame(() => {
        setArrowState('visible')
        recordRuntimeAudit('language-arrow-revealed', { language: selectedLanguage })
      })
    }, LANGUAGE_ARROW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [hasInteracted, phase, selectedLanguage])

  const activate = useCallback((source) => {
    if (phase !== 'idle') return
    setPhase('decoding')
    recordRuntimeAudit('language-preview-start', { language: selectedLanguage, source })
  }, [phase, selectedLanguage])

  const handlePointerEnter = useCallback(event => {
    if (isCoarsePointer() || event.pointerType !== 'mouse') return
    activate('hover')
  }, [activate])

  const handleClick = useCallback(() => {
    if (!isCoarsePointer()) return
    activate('tap')
  }, [activate])

  const selectByDirection = useCallback((direction, source) => {
    if (phase !== 'ready' || track) return

    const previousLanguage = selectedLanguage
    const nextLanguage = cycleLanguage(selectedLanguage, direction)
    setHasInteracted(true)
    setArrowState('fading')
    setSelectedLanguage(nextLanguage)
    setTrack({ direction, from: previousLanguage, target: nextLanguage })
    setTrackState('center')
    setPhase('selecting')
    onLanguageChange?.(nextLanguage)
    recordRuntimeAudit('language-wheel-language-committed', {
      language: nextLanguage,
      previousLanguage,
      direction,
      source,
    })
    recordRuntimeAudit('language-wheel-select', { language: nextLanguage, direction, source })
    window.requestAnimationFrame(() => {
      setTrackState(direction > 0 ? 'next' : 'previous')
      recordRuntimeAudit('language-wheel-transition-start', { language: nextLanguage, direction })
    })
  }, [onLanguageChange, phase, selectedLanguage, track])

  const handleTrackTransitionEnd = useCallback(event => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform' || !track) return
    const committedLanguage = track.target
    const direction = track.direction
    setTrack(null)
    setTrackState('center')
    setPhase('decoding')
    recordRuntimeAudit('language-wheel-transition-complete', { language: committedLanguage, direction })
  }, [track])

  const handleWheel = useCallback(event => {
    if (isCoarsePointer() || Math.abs(event.deltaY) < 1) return
    if (phase !== 'ready') return
    event.preventDefault()
    selectByDirection(event.deltaY > 0 ? 1 : -1, 'wheel')
  }, [phase, selectByDirection])

  const handlePointerDown = useCallback(event => {
    if (!isCoarsePointer() || phase !== 'ready') return
    pointerStartYRef.current = event.clientY
  }, [phase])

  const handlePointerUp = useCallback(event => {
    if (!isCoarsePointer()) return
    const startY = pointerStartYRef.current
    pointerStartYRef.current = null
    if (startY === null || phase !== 'ready') return
    const deltaY = event.clientY - startY
    if (Math.abs(deltaY) < LANGUAGE_SWIPE_THRESHOLD_PX) return
    event.preventDefault()
    selectByDirection(deltaY > 0 ? 1 : -1, 'swipe')
  }, [phase, selectByDirection])

  const handlePointerCancel = useCallback(() => {
    pointerStartYRef.current = null
  }, [])

  const visualLabel = phase === 'idle'
    ? '当前语言'
    : phase === 'decoding'
      ? (displayText || placeholderLabel(languageLabel))
      : languageLabel
  const codes = trackCodes(track?.from || selectedLanguage)
  const labels = codes.map(code => getReaderLanguage(code).label)
  const trackClass = track ? trackState : 'center'
  const accessibleLanguage = phase === 'idle' ? '当前语言' : languageLabel

  return (
    <button
      type="button"
      className="shared-entry-control language-wheel-selector"
      data-language-selector="true"
      data-language-selector-phase={phase}
      data-language-selected={selectedLanguage}
      data-language-track-state={trackClass}
      data-language-arrow-state={arrowState}
      data-language-fill="none"
      data-entry-material-source="background"
      data-entry-frame-fill="disabled"
      aria-label={`${accessibleLanguage}，语言选择`}
      onPointerEnter={handlePointerEnter}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <span className="shared-entry-content language-wheel-selector__content">
        <EntryButtonFrame fillEnabled={false} />
        <span className="language-wheel-selector__viewport" aria-hidden="true">
          <span
            className="language-wheel-selector__track"
            data-language-track-state={trackClass}
            onTransitionEnd={handleTrackTransitionEnd}
          >
            {labels.map((label, index) => (
              <span
                className={`language-wheel-selector__slot language-wheel-selector__slot--${index === 1 ? 'current' : index === 0 ? 'previous' : 'next'}`}
                key={`${codes[index]}:${index}`}
              >
                {index === 1 && !track ? visualLabel : label}
              </span>
            ))}
          </span>
        </span>
      </span>
      {arrowState !== 'hidden' && (
        <span className="language-wheel-selector__arrow" aria-hidden="true">↓</span>
      )}
    </button>
  )
}

export default LanguageWheelSelector
