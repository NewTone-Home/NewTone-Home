import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { READING_ENTRY_TIMINGS } from '../transitions/readingEntryController'
import { copy } from '../i18n/copy'
import { detectBrowserReaderLanguage, getReaderLanguage, READER_LANGUAGES } from '../i18n/languages'
import { HOLD_PROGRESS_TIMINGS, stepHoldProgress } from '../interactions/holdProgress'
import {
  isRitualDirectPointer,
  resolveRitualArmAction,
  resolveRitualSwipeAction,
  resolveRitualWheelAction,
} from '../interactions/ritualWheelAdvance'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useSceneParallax } from '../hooks/useSceneParallax'
import { getReaderSceneLabel } from '../i18n/readerUi'
import { NewToneTransitionMark } from './landing/LandingTitleMark'
import './ReadingTransition.css'

const SCRAMBLE = '01░▒/\\-_:;~*#+%&@'
const RESUME_BLINK_CYCLE_MS = 520
const RITUAL_TIMINGS = Object.freeze({
  RING_DRAW_MS: 720,
  RING_RETRACT_MS: 300,
  ARROW_DRAW_MS: 260,
  ARROW_FADE_MS: 180,
  CONTENT_RELEASE_MS: 1600,
})
const RITUAL_HOLD_TIMINGS = Object.freeze({
  DRAW_MS: RITUAL_TIMINGS.RING_DRAW_MS,
  RETRACT_MS: RITUAL_TIMINGS.RING_RETRACT_MS,
  FLASH_MS: 280,
})
const LANGUAGE_AFFORDANCE_TIMINGS = Object.freeze({
  RING_DRAW_MS: 560,
  NOTE_DRAW_MS: 260,
  CANDIDATE_REVEAL_MS: 220,
})

function randScramble() {
  return SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]
}

function initialScramble(len) {
  return Array.from({ length: len }, () => randScramble()).join('')
}

function useScrambleText(text, { startDelay = 0, charInterval = 70, scrambleInterval = 40, enabled = true } = {}) {
  const [displayText, setDisplayText] = useState('')
  const [stable, setStable] = useState(false)

  useLayoutEffect(() => {
    if (!enabled) {
      setDisplayText('')
      setStable(false)
      return
    }

    let mounted = true
    let resolvedCount = 0
    let si, ri, st

    setDisplayText(initialScramble(text.length))
    setStable(false)

    si = setInterval(() => {
      if (!mounted) return
      const chars = text.split('').map((ch, i) => i < resolvedCount ? ch : randScramble())
      setDisplayText(chars.join(''))
    }, scrambleInterval)

    const startResolution = () => {
      ri = setInterval(() => {
        resolvedCount++
        if (resolvedCount >= text.length) {
          clearInterval(ri)
          clearInterval(si)
          if (mounted) {
            setDisplayText(text)
            setStable(true)
          }
        }
      }, charInterval)
    }

    if (startDelay > 0) st = setTimeout(startResolution, startDelay)
    else startResolution()

    return () => { mounted = false; clearTimeout(st); clearInterval(si); clearInterval(ri) }
  }, [text, startDelay, charInterval, scrambleInterval, enabled])

  return { displayText, stable }
}

const TRANSITION_ENVIRONMENT_COPY = Object.freeze({
  zh: {
    worldLayer: '世界层',
    location: '地点',
    time: '时间',
    weather: '天气',
    unknown: '未标明',
    world: { surface: '表世界', inner: '里世界', unknown: '未标明' },
    timeValue: { morning: '上午', noon: '午间', afternoon: '下午', dusk: '黄昏', night: '夜间', unknown: '未标明' },
    weatherValue: { clear: '晴', overcast: '阴', rain: '雨', snow: '雪', unknown: '未标明' },
  },
  en: {
    worldLayer: 'World',
    location: 'Setting',
    time: 'Time',
    weather: 'Weather',
    unknown: 'Not specified',
    world: { surface: 'Surface World', inner: 'Inner World', unknown: 'Not specified' },
    timeValue: { morning: 'Morning', noon: 'Noon', afternoon: 'Afternoon', dusk: 'Dusk', night: 'Night', unknown: 'Not specified' },
    weatherValue: { clear: 'Clear', overcast: 'Overcast', rain: 'Rain', snow: 'Snow', unknown: 'Not specified' },
  },
})

function resolveTransitionEnvironment(state, language) {
  const envCopy = TRANSITION_ENVIRONMENT_COPY[language] ?? TRANSITION_ENVIRONMENT_COPY.zh
  if (!state) return []
  return [
    `${envCopy.worldLayer} · ${envCopy.world[state.worldLayer] ?? envCopy.unknown}`,
    `${envCopy.location} · ${getReaderSceneLabel(language, state.locationId, state.locationLabels?.[language] || state.locationLabel) || envCopy.unknown}`,
    `${envCopy.time} · ${envCopy.timeValue[state.time] ?? envCopy.unknown}`,
    `${envCopy.weather} · ${envCopy.weatherValue[state.weather] ?? envCopy.unknown}`,
  ]
}

function TransitionEnvironmentLine({ text }) {
  const { displayText } = useScrambleText(text, {
    charInterval: Math.max(18, Math.min(54, Math.floor(880 / Math.max(1, Array.from(text).length)))),
    scrambleInterval: 44,
  })
  return (
    <span className="reading-transition-environment-line">
      {displayText || initialScramble(text.length)}
    </span>
  )
}

function ResumeEnvironment({ lines }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
    const interval = window.setInterval(() => {
      setActiveIndex(current => {
        if (current >= lines.length - 1) {
          window.clearInterval(interval)
          return current
        }
        return current + 1
      })
    }, RESUME_BLINK_CYCLE_MS)
    return () => window.clearInterval(interval)
  }, [lines])

  const activeLine = lines[activeIndex] ?? ''
  return (
    <div
      className="reading-transition-environment"
      aria-label={activeLine}
      data-resume-line={activeIndex + 1}
    >
      <TransitionEnvironmentLine key={`${activeIndex}:${activeLine}`} text={activeLine} />
    </div>
  )
}

function ExpandLabel({ labelText, labelVisible, labelRef, scrambleActive }) {
  const labelCharInterval = Math.max(80, Math.floor(650 / Math.max(1, Array.from(labelText).length)))
  const { displayText } = useScrambleText(labelText, {
    startDelay: 0,
    charInterval: labelCharInterval,
    scrambleInterval: 40,
    enabled: scrambleActive,
  })
  return (
    <span ref={labelRef} className={`lang-current-label${labelVisible ? ' lang-current-label--visible' : ' lang-current-label--hidden'}`}>
      {scrambleActive ? (displayText || labelText) : labelText}
    </span>
  )
}

function getTextHitRect(node) {
  const textNode = node
    ? Array.from(node.childNodes).find(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())
    : null
  if (!textNode) {
    return node?.getBoundingClientRect() ?? null
  }
  const range = document.createRange()
  range.selectNodeContents(textNode)
  return range.getBoundingClientRect()
}

function getInitialBrowserLanguage(fallback) {
  if (typeof navigator === 'undefined') return fallback
  const browserLangs = navigator.languages || [navigator.language || '']
  return detectBrowserReaderLanguage(browserLangs) || fallback
}

function stepRitualProgress(current, target, deltaMs, timings) {
  const duration = target > current ? timings.DRAW_MS : timings.RETRACT_MS
  const distance = Math.max(0, deltaMs) / duration
  return target > current
    ? Math.min(target, current + distance)
    : Math.max(target, current - distance)
}

function useHoldAdvance({ enabled, onComplete, resetKey, textRef, flashRef, timings = HOLD_PROGRESS_TIMINGS }) {
  const [progress, setProgress] = useState(0)
  const [holdPhase, setHoldPhase] = useState('idle')
  const targetRef = useRef(0)
  const progressRef = useRef(0)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const completedRef = useRef(false)
  const finishTimerRef = useRef(0)
  const flashAnimationRef = useRef(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const retract = useCallback(() => {
    if (completedRef.current) return
    targetRef.current = 0
    setHoldPhase(progressRef.current > 0 ? 'retracting' : 'idle')
  }, [])

  const interrupt = useCallback(() => {
    completedRef.current = false
    targetRef.current = 0
    window.clearTimeout(finishTimerRef.current)
    flashAnimationRef.current?.cancel()
    setHoldPhase(progressRef.current > 0 ? 'retracting' : 'idle')
  }, [])

  const trackPointer = useCallback(event => {
    if (!enabled || completedRef.current) {
      retract()
      return
    }
    const rect = getTextHitRect(textRef.current)
    const inside = rect && event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom
    targetRef.current = inside ? 1 : 0
    setHoldPhase(inside ? 'drawing' : progressRef.current > 0 ? 'retracting' : 'idle')
  }, [enabled, retract, textRef])

  useEffect(() => {
    if (!enabled || completedRef.current) return undefined
    window.addEventListener('pointermove', trackPointer)
    return () => window.removeEventListener('pointermove', trackPointer)
  }, [enabled, trackPointer])

  useEffect(() => {
    completedRef.current = false
    targetRef.current = 0
    progressRef.current = 0
    setProgress(0)
    setHoldPhase('idle')
    window.clearTimeout(finishTimerRef.current)
    flashAnimationRef.current?.cancel()
  }, [resetKey])

  useEffect(() => {
    if (enabled || completedRef.current) return
    retract()
  }, [enabled, retract])

  useEffect(() => {
    const animate = time => {
      const delta = lastTimeRef.current ? Math.min(40, time - lastTimeRef.current) : 16
      lastTimeRef.current = time
      const next = stepRitualProgress(progressRef.current, targetRef.current, delta, timings)
      if (next !== progressRef.current) {
        progressRef.current = next
        setProgress(next)
      }
      if (next <= 0 && targetRef.current === 0 && !completedRef.current) setHoldPhase('idle')
      if (next >= 1 && !completedRef.current) {
        completedRef.current = true
        targetRef.current = 1
        setHoldPhase('flashing')
        flashAnimationRef.current = flashRef.current?.animate(
          [{ opacity: 1 }, { opacity: .18 }, { opacity: 1 }, { opacity: .18 }, { opacity: 1 }],
          { duration: timings.FLASH_MS, easing: 'ease-in-out' },
        ) ?? null
        finishTimerRef.current = window.setTimeout(
          () => onCompleteRef.current(),
          timings.FLASH_MS,
        )
      }
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frameRef.current)
      window.clearTimeout(finishTimerRef.current)
      flashAnimationRef.current?.cancel()
    }
  }, [flashRef, timings])

  return { progress, holdPhase, trackPointer, retract, interrupt }
}

function useLanguageSelectorHold({ enabled }) {
  const [progress, setProgress] = useState(0)
  const [holdPhase, setHoldPhase] = useState('idle')
  const targetRef = useRef(0)
  const progressRef = useRef(0)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)

  const hold = useCallback(() => {
    if (!enabled) return
    targetRef.current = 1
    setHoldPhase(progressRef.current >= 1 ? 'complete' : 'drawing')
  }, [enabled])

  const retract = useCallback(() => {
    const persistCompleted = progressRef.current >= 1
      && typeof window !== 'undefined'
      && (window.matchMedia('(hover: none)').matches || window.innerWidth <= 700)
    if (persistCompleted) {
      targetRef.current = 1
      setHoldPhase('complete')
      return
    }
    targetRef.current = 0
    setHoldPhase(progressRef.current > 0 ? 'retracting' : 'idle')
  }, [])

  useEffect(() => {
    if (enabled) return
    targetRef.current = 0
    progressRef.current = 0
    setProgress(0)
    setHoldPhase('idle')
  }, [enabled])

  useEffect(() => {
    const animate = time => {
      const delta = lastTimeRef.current ? Math.min(40, time - lastTimeRef.current) : 16
      lastTimeRef.current = time
      const next = stepHoldProgress(progressRef.current, targetRef.current, delta)
      if (next !== progressRef.current) {
        progressRef.current = next
        setProgress(next)
        if (next >= 1 && targetRef.current === 1) setHoldPhase('complete')
        if (next <= 0 && targetRef.current === 0) setHoldPhase('idle')
      }
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  return { progress, holdPhase, hold, retract }
}

function RitualHandAffordance({ showArrow = true }) {
  return (
    <svg className={`ritual-hand-affordance${showArrow ? '' : ' ritual-hand-affordance--ring-only'}`} viewBox="0 0 120 64" aria-hidden="true">
      <path className="ritual-hand-affordance__ring" pathLength="1" d="M36 5C54 4 68 14 69 31C70 48 56 58 35 57C14 56 4 47 6 31C8 14 18 6 36 5" />
      {showArrow && <path className="ritual-hand-affordance__arrow" pathLength="1" d="M74 31C85 30 97 31 109 31M102 25C105 27 108 29 111 31M102 37C105 35 108 33 111 31" />}
    </svg>
  )
}

function LanguageExpandAffordance({ onAnimationEnd }) {
  return (
    <svg className="language-expand-affordance" viewBox="0 0 120 64" aria-hidden="true" onAnimationEnd={onAnimationEnd}>
      <path className="language-expand-affordance__ring" pathLength="1" d="M36 5C54 4 68 14 69 31C70 48 56 58 35 57C14 56 4 47 6 31C8 14 18 6 36 5" />
      <path className="language-expand-affordance__note" pathLength="1" d="M74 31C85 30 97 31 109 31M102 25C105 27 108 29 111 31M102 37C105 35 108 33 111 31" />
    </svg>
  )
}

function RitualSelector({ language, onProceed, onModeSelect, phase }) {
  const setLanguage = useProgressStore(s => s.setLanguage)
  const lang = copy[language] || copy.zh
  const browserDefaultLanguage = useMemo(() => getInitialBrowserLanguage(language), [])
  const modeStage = phase === 'mode-active' || phase === 'mode-leaving'
  const reforming = phase === 'language-leaving'
  const exiting = phase === 'mode-leaving'
  const locked = reforming || exiting
  const [showFrames, setShowFrames] = useState(false)
  const [showText, setShowText] = useState(false)
  const [buttonsReady, setButtonsReady] = useState(false)
  const [titleReady, setTitleReady] = useState(false)
  const [languageVersion, setLanguageVersion] = useState(0)
  const isFirstEntry = languageVersion === 0
  const [revealed, setRevealed] = useState(!isFirstEntry)
  useEffect(() => {
    if (!isFirstEntry) return
    const t = setTimeout(() => setRevealed(true), READING_ENTRY_TIMINGS.LANGUAGE_INIT_TITLE_DELAY_MS)
    return () => clearTimeout(t)
  }, [isFirstEntry])
  const [langExpandHover, setLangExpandHover] = useState(false)
  const [langExpandToggled, setLangExpandToggled] = useState(false)
  const [languageAffordanceStage, setLanguageAffordanceStage] = useState('idle')
  const [ritualExitStage, setRitualExitStage] = useState('idle')
  const [scramblingLang, setScramblingLang] = useState(null)
  const [languageSlots, setLanguageSlots] = useState([])
  const [labelText, setLabelText] = useState(getReaderLanguage(browserDefaultLanguage).label)
  const [labelVisible, setLabelVisible] = useState(true)
  const [languageLabelPinned, setLanguageLabelPinned] = useState(false)
  const hideTimerRef = useRef(null)
  const hoverActiveRef = useRef(false)
  const isSwitchingRef = useRef(false)
  const slotsInitialized = useRef(false)
  const secondaryZoneRef = useRef(null)
  const touchInProgress = useRef(false)
  const selectorRootRef = useRef(null)
  const selectorTitleRef = useRef(null)
  const selectorOptionsRef = useRef(null)
  const primaryButtonRef = useRef(null)
  const secondaryButtonRef = useRef(null)
  const primaryTextRef = useRef(null)
  const secondaryTextRef = useRef(null)
  const currentLanguageLabelRef = useRef(null)
  const secondaryHoldTextRef = useRef(null)
  const languageSecondaryInsideRef = useRef(false)
  const selectorIdentityBaselineRef = useRef(null)
  const [selectorIdentityStable, setSelectorIdentityStable] = useState(null)
  const [armedOption, setArmedOption] = useState(null)
  const [readyOption, setReadyOption] = useState(null)
  const ritualWheelPendingRef = useRef(false)

  useEffect(() => {
    if (!slotsInitialized.current) {
      slotsInitialized.current = true
      setLanguageSlots(READER_LANGUAGES.map(item => item.code).filter(code => code !== language))
    }
    if (!isSwitchingRef.current) {
      const visibleLanguage = languageVersion === 0 ? browserDefaultLanguage : language
      setLabelText(getReaderLanguage(visibleLanguage).label)
    }
  }, [browserDefaultLanguage, language, languageVersion])

  const currentStage = useMemo(() => ({
    id: modeStage ? 'mode' : 'language',
    title: modeStage ? lang.modeInitTitle : lang.languageInitTitle,
    primary: modeStage ? lang.modeImmersive : lang.languageInitProceed,
    secondary: modeStage ? lang.modeStandard : lang.languageInitChange,
  }), [lang, modeStage])
  const titleText = currentStage.title

  const titleCharInterval = useMemo(() => {
    if (languageVersion === 0) {
      return Math.max(60, Math.min(130, Math.floor(2000 / titleText.length)))
    }
    return Math.max(30, Math.min(60, Math.floor(800 / titleText.length)))
  }, [titleText, languageVersion])

  const { displayText: titleDisplay, stable: titleStable } = useScrambleText(titleText, {
    startDelay: 0,
    charInterval: titleCharInterval,
    scrambleInterval: 50,
    enabled: revealed,
  })
  const [modeActionsReady, setModeActionsReady] = useState(false)

  useEffect(() => {
    if (!modeStage || !titleStable) {
      setModeActionsReady(false)
      return undefined
    }
    const timer = setTimeout(() => setModeActionsReady(true), 160)
    return () => clearTimeout(timer)
  }, [modeStage, titleStable, titleText])

  useEffect(() => {
    if (!modeStage || !modeActionsReady || !selectorOptionsRef.current) return undefined
    const node = selectorOptionsRef.current
    const duration = 480
    const startedAt = window.performance.now()
    node.style.opacity = '0'
    node.style.transform = 'translateY(3px)'
    const interval = window.setInterval(() => {
      const linear = Math.min(1, (window.performance.now() - startedAt) / duration)
      const eased = 1 - Math.pow(1 - linear, 3)
      node.style.opacity = String(linear)
      node.style.transform = `translateY(${3 * (1 - eased)}px)`
      if (linear === 1) window.clearInterval(interval)
    }, 24)
    const finish = window.setTimeout(() => {
      node.style.opacity = '1'
      node.style.transform = 'translateY(0)'
    }, duration)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(finish)
    }
  }, [modeActionsReady, modeStage])

  const proceedStartDelay = useMemo(() => {
    return languageVersion > 0 ? 150 : 100
  }, [languageVersion])

  const proceedCharInterval = useMemo(() => {
    return languageVersion > 0 ? 120 : 100
  }, [languageVersion])

  const { displayText: proceedText } = useScrambleText(currentStage.primary, {
    startDelay: proceedStartDelay,
    charInterval: proceedCharInterval,
    scrambleInterval: 30,
    enabled: showText && (!modeStage || modeActionsReady),
  })

  const { displayText: changeText } = useScrambleText(currentStage.secondary, {
    startDelay: 0,
    charInterval: 100,
    scrambleInterval: 30,
    enabled: showText && (!modeStage || modeActionsReady),
  })

  const expanded = langExpandHover || langExpandToggled
  const languageLabelShown = !modeStage

  useLayoutEffect(() => {
    const nodes = [
      selectorRootRef.current,
      selectorTitleRef.current,
      selectorOptionsRef.current,
      primaryButtonRef.current,
      secondaryButtonRef.current,
      primaryTextRef.current,
      secondaryTextRef.current,
    ]
    if (nodes.some(node => !node)) return
    if (!modeStage && !reforming) {
      selectorIdentityBaselineRef.current = nodes
      setSelectorIdentityStable(null)
      return
    }
    if (modeStage && selectorIdentityBaselineRef.current) {
      setSelectorIdentityStable(nodes.every((node, index) => node === selectorIdentityBaselineRef.current[index]))
    }
  }, [modeStage, reforming])

  useEffect(() => {
    if (titleStable && !titleReady) {
      const t = setTimeout(() => {
        setTitleReady(true)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [titleStable, titleReady])

  useEffect(() => {
    if (!titleReady || showFrames) return undefined
    const timer = setTimeout(() => setShowFrames(true), 600)
    return () => clearTimeout(timer)
  }, [showFrames, titleReady])

  useEffect(() => {
    if (!showFrames) return
    const t = setTimeout(() => setShowText(true), 850)
    return () => clearTimeout(t)
  }, [showFrames])

  useEffect(() => {
    if (!showText) return
    const t = setTimeout(() => setButtonsReady(true), 600)
    return () => clearTimeout(t)
  }, [showText])

  useEffect(() => {
    if (!expanded) return
    const handleOutside = (e) => {
      if (secondaryZoneRef.current && !secondaryZoneRef.current.contains(e.target)) {
        setLangExpandHover(false)
        setLangExpandToggled(false)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => {
      document.removeEventListener('pointerdown', handleOutside)
    }
  }, [expanded])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const transientTimersRef = useRef(new Set())
  const scheduleTransient = useCallback((callback, delay) => {
    const id = setTimeout(() => {
      transientTimersRef.current.delete(id)
      callback()
    }, delay)
    transientTimersRef.current.add(id)
    return id
  }, [])

  useEffect(() => () => {
    transientTimersRef.current.forEach(clearTimeout)
    transientTimersRef.current.clear()
  }, [])

  useEffect(() => {
    if (!expanded) setLanguageAffordanceStage('idle')
  }, [expanded])

  useEffect(() => {
    if (!modeStage) return
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    hoverActiveRef.current = false
    setLangExpandHover(false)
    setLangExpandToggled(false)
  }, [modeStage])

  const beginLanguageAffordance = useCallback(() => {
    if (modeStage) return
    setLanguageAffordanceStage(current => current === 'idle' ? 'ring' : current)
  }, [modeStage])

  const handleEnter = useCallback(() => {
    if (modeStage) return
    if (touchInProgress.current) return
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    hoverActiveRef.current = true
    beginLanguageAffordance()
    setLangExpandHover(true)
  }, [beginLanguageAffordance, modeStage])

  const handleLeave = useCallback(() => {
    if (modeStage) return
    if (touchInProgress.current) return
    hideTimerRef.current = setTimeout(() => {
      hoverActiveRef.current = false
      setLangExpandHover(false)
      setLanguageAffordanceStage('idle')
    }, 180)
  }, [modeStage])

  const performPrimaryAction = useCallback(() => {
    if (modeStage) {
      onModeSelect('immersive')
      return
    }
    onProceed()
  }, [modeStage, onModeSelect, onProceed])

  const handleLanguageExpandClick = useCallback(() => {
    if (modeStage) return
    setArmedOption(null)
    beginLanguageAffordance()
    if (window.matchMedia('(hover: hover)').matches) {
      setLangExpandHover(true)
      return
    }
    setLangExpandToggled(current => {
      if (current) setLanguageAffordanceStage('idle')
      return !current
    })
  }, [beginLanguageAffordance, modeStage])

  const performModeSecondaryAction = useCallback(() => {
    if (modeStage) onModeSelect('standard')
  }, [modeStage, onModeSelect])

  const holdResetKey = `${currentStage.id}:${languageVersion}`
  const primaryHold = useHoldAdvance({
    enabled: buttonsReady && (!modeStage || modeActionsReady) && !locked,
    onComplete: performPrimaryAction,
    resetKey: holdResetKey,
    textRef: primaryTextRef,
    flashRef: primaryButtonRef,
    timings: RITUAL_HOLD_TIMINGS,
  })
  const modeSecondaryHold = useHoldAdvance({
    enabled: buttonsReady && modeStage && modeActionsReady && !locked,
    onComplete: performModeSecondaryAction,
    resetKey: holdResetKey,
    textRef: secondaryHoldTextRef,
    flashRef: secondaryButtonRef,
    timings: RITUAL_HOLD_TIMINGS,
  })
  const languageSelectorHold = useLanguageSelectorHold({
    enabled: buttonsReady && !modeStage && !locked,
  })
  const secondaryProgress = modeStage ? modeSecondaryHold.progress : languageSelectorHold.progress
  const secondaryPhase = modeStage ? modeSecondaryHold.holdPhase : languageSelectorHold.holdPhase

  useEffect(() => {
    if (locked || !armedOption) return
    const progress = armedOption === 'primary' ? primaryHold.progress : modeSecondaryHold.progress
    if (progress >= 0.999) setReadyOption(armedOption)
  }, [armedOption, locked, modeSecondaryHold.progress, primaryHold.progress])

  const performResolvedAction = useCallback(action => {
    if (!action) return
    setArmedOption(null)
    setReadyOption(null)
    if (action.type === 'language') {
      onProceed()
      return
    }
    onModeSelect(action.mode)
  }, [onModeSelect, onProceed])

  const armDirectOption = useCallback((event, selectorOption) => {
    const action = resolveRitualArmAction(phase, selectorOption, event.pointerType)
    if (!action || locked) return
    setReadyOption(null)
    setArmedOption(selectorOption)
  }, [locked, phase])

  useEffect(() => {
    setArmedOption(null)
    setReadyOption(null)
    setRitualExitStage('idle')
    ritualWheelPendingRef.current = false
  }, [currentStage.id])

  useEffect(() => {
    if (!armedOption || locked) return undefined
    let gesture = null

    const clearGesture = event => {
      if (!gesture || !event || gesture.pointerId === event.pointerId) gesture = null
    }
    const handleWindowPointerDown = event => {
      if (!isRitualDirectPointer(event.pointerType)) return
      if (!modeStage && event.target?.closest?.('.lang-secondary-zone')) return
      gesture = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startY: event.clientY,
      }
    }
    const handleWindowPointerMove = event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return
      const action = resolveRitualSwipeAction({
        phase,
        selectorOption: armedOption,
        pointerType: gesture.pointerType,
        startY: gesture.startY,
        endY: event.clientY,
      })
      if (!action) return
      gesture = null
      if (event.cancelable) event.preventDefault()
      performResolvedAction(action)
    }

    window.addEventListener('pointerdown', handleWindowPointerDown, { capture: true })
    window.addEventListener('pointermove', handleWindowPointerMove, { capture: true, passive: false })
    window.addEventListener('pointerup', clearGesture, { capture: true })
    window.addEventListener('pointercancel', clearGesture, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', handleWindowPointerDown, { capture: true })
      window.removeEventListener('pointermove', handleWindowPointerMove, { capture: true })
      window.removeEventListener('pointerup', clearGesture, { capture: true })
      window.removeEventListener('pointercancel', clearGesture, { capture: true })
    }
  }, [armedOption, locked, modeStage, performResolvedAction, phase])

  const armHoverOption = useCallback((event, selectorOption) => {
    if (event.pointerType !== 'mouse' || locked) return
    if (armedOption !== selectorOption) setReadyOption(null)
    setArmedOption(selectorOption)
  }, [armedOption, locked])

  const handleLanguageAffordanceAnimationEnd = useCallback(event => {
    if (event.animationName === 'language-current-ring-draw') {
      setLanguageAffordanceStage('arrow')
      return
    }
    if (event.animationName === 'language-note-arrow-draw') {
      setLanguageAffordanceStage('candidate')
    }
  }, [])

  const queueRitualWheelAction = useCallback((action, selectorOption) => {
    if (!action || ritualWheelPendingRef.current) return
    ritualWheelPendingRef.current = true
    if (selectorOption === 'primary') primaryHold.interrupt()
    if (selectorOption === 'secondary' && modeStage) modeSecondaryHold.interrupt()
    setRitualExitStage('retracting')
    scheduleTransient(() => {
      setReadyOption(null)
      setRitualExitStage('arrow-fading')
      scheduleTransient(() => {
        setRitualExitStage('content-fading')
        ritualWheelPendingRef.current = false
        performResolvedAction(action)
      }, RITUAL_TIMINGS.ARROW_FADE_MS)
    }, RITUAL_TIMINGS.RING_RETRACT_MS)
  }, [modeStage, modeSecondaryHold, performResolvedAction, primaryHold, scheduleTransient])

  useEffect(() => {
    if (locked) return undefined
    const onWheel = event => {
      if (event.deltaY <= 8 || ritualWheelPendingRef.current) return
      const targetOption = event.target?.closest?.('[data-selector-option]')?.dataset?.selectorOption
      const selectorOption = targetOption || armedOption
      const action = resolveRitualWheelAction(phase, selectorOption, event.deltaY)
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      queueRitualWheelAction(action, selectorOption)
    }
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', onWheel, { capture: true })
  }, [armedOption, locked, phase, queueRitualWheelAction])

  const handleLanguageSecondaryPointer = useCallback(event => {
    if (modeStage) return
    const activeText = languageLabelShown ? currentLanguageLabelRef.current : secondaryTextRef.current
    const rect = getTextHitRect(activeText)
    const inside = Boolean(rect && event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom)
    if (!inside || languageSecondaryInsideRef.current) return
    languageSecondaryInsideRef.current = true
    handleEnter()
    languageSelectorHold.hold()
  }, [handleEnter, languageLabelShown, languageSelectorHold, modeStage])

  const handleLanguageBoundaryLeave = useCallback(() => {
    if (modeStage) return
    languageSecondaryInsideRef.current = false
    handleLeave()
    languageSelectorHold.retract()
  }, [handleLeave, languageSelectorHold, modeStage])

  useEffect(() => {
    if (modeStage || !expanded) return undefined
    const trackBoundary = event => {
      const pointedNode = document.elementFromPoint(event.clientX, event.clientY)
      if (pointedNode && secondaryZoneRef.current?.contains(pointedNode)) return
      handleLanguageBoundaryLeave()
    }
    window.addEventListener('pointermove', trackBoundary)
    return () => window.removeEventListener('pointermove', trackBoundary)
  }, [expanded, handleLanguageBoundaryLeave, modeStage])

  useLayoutEffect(() => {
    const syncRingMetrics = (button, textNode) => {
      const rect = getTextHitRect(textNode)
      if (!button || !rect) return undefined
      const affordanceWidth = Math.max(96, rect.width + 50)
      const affordanceHeight = Math.max(28, rect.height + 12)
      const anchorNodes = [button, button.querySelector('.lang-btn-text-area'), button.parentElement].filter(Boolean)
      anchorNodes.forEach(node => {
        const nodeRect = node.getBoundingClientRect()
        node.style.setProperty('--hold-text-width', `${rect.width}px`)
        node.style.setProperty('--hold-text-height', `${rect.height}px`)
        node.style.setProperty('--ritual-affordance-left', `${rect.left - nodeRect.left - 6}px`)
        node.style.setProperty('--ritual-affordance-top', `${rect.top - nodeRect.top + rect.height / 2}px`)
        node.style.setProperty('--ritual-affordance-width', `${affordanceWidth}px`)
        node.style.setProperty('--ritual-affordance-height', `${affordanceHeight}px`)
      })
      return undefined
    }
    syncRingMetrics(primaryButtonRef.current, primaryTextRef.current)
    const secondaryVisibleText = languageLabelShown
      ? secondaryButtonRef.current?.querySelector('.lang-current-label--visible')
      : secondaryTextRef.current
    secondaryHoldTextRef.current = secondaryVisibleText
    syncRingMetrics(secondaryButtonRef.current, secondaryVisibleText)
  }, [changeText, labelText, labelVisible, languageLabelShown, modeStage, proceedText])

  const handleLanguageChange = useCallback((newLang) => {
    if (newLang === language || isSwitchingRef.current) return
    setArmedOption(null)
    isSwitchingRef.current = true

    const oldLang = language
    const clickedIndex = languageSlots.indexOf(newLang)

    setScramblingLang(newLang)

    setLabelVisible(false)

    scheduleTransient(() => {
      setLanguage(newLang)
      setLabelText(getReaderLanguage(newLang).label)
      setLabelVisible(true)
      setLanguageLabelPinned(true)
      setLanguageVersion(v => v + 1)
      setScramblingLang(null)

      if (clickedIndex !== -1) {
        setLanguageSlots(prev => {
          const next = [...prev]
          next[clickedIndex] = oldLang
          return next
        })
      }

      scheduleTransient(() => {
        isSwitchingRef.current = false
      }, 500)
    }, 450)
  }, [language, scheduleTransient, setLanguage, languageSlots])

  const alternateLanguage = languageSlots.find(code => code !== language)
    ?? READER_LANGUAGES.find(item => item.code !== language)?.code

  return (
    <div
      ref={selectorRootRef}
      className={`ritual-selector language-init${reforming ? ' language-init--reforming' : ''}${exiting ? ' language-init--exiting' : ''}`}
      style={{
        '--ritual-ring-draw-ms': `${RITUAL_TIMINGS.RING_DRAW_MS}ms`,
        '--ritual-ring-retract-ms': `${RITUAL_TIMINGS.RING_RETRACT_MS}ms`,
        '--ritual-arrow-draw-ms': `${RITUAL_TIMINGS.ARROW_DRAW_MS}ms`,
        '--ritual-arrow-fade-ms': `${RITUAL_TIMINGS.ARROW_FADE_MS}ms`,
        '--ritual-content-release-ms': `${RITUAL_TIMINGS.CONTENT_RELEASE_MS}ms`,
        '--language-ring-draw-ms': `${LANGUAGE_AFFORDANCE_TIMINGS.RING_DRAW_MS}ms`,
        '--language-note-draw-ms': `${LANGUAGE_AFFORDANCE_TIMINGS.NOTE_DRAW_MS}ms`,
        '--language-candidate-reveal-ms': `${LANGUAGE_AFFORDANCE_TIMINGS.CANDIDATE_REVEAL_MS}ms`,
      }}
      data-selector-stage={currentStage.id}
      data-selector-identity={selectorIdentityStable === null ? 'pending' : selectorIdentityStable ? 'stable' : 'replaced'}
      data-armed-option={armedOption || 'none'}
      data-ready-option={readyOption || 'none'}
      data-ritual-exit-stage={ritualExitStage}
    >
      <p ref={selectorTitleRef} className="ritual-selector-title language-init-title" data-stable={revealed && titleStable ? 'true' : 'false'}>
        {revealed ? (titleDisplay || '') : ''}
      </p>

      <div className="language-init-bottom">
        <div className="language-init-actions">
          <div ref={selectorOptionsRef} className={`ritual-selector-options language-init-actions-inner${showFrames ? ' language-init-actions-inner--visible' : ''}${buttonsReady ? ' language-init-actions-inner--ready' : ''}${modeStage && !modeActionsReady ? ' language-init-actions-inner--stage-pending' : ''}`}>
            <div className="language-btn-signal">
              <button
                ref={primaryButtonRef}
                className="language-btn language-btn--primary"
                data-selector-option="primary"
                data-ritual-armed="false"
                data-ritual-active={armedOption === 'primary' ? 'true' : 'false'}
                data-ritual-ready={readyOption === 'primary' ? 'true' : 'false'}
                data-ritual-wheel-ready={readyOption === 'primary' ? 'true' : 'false'}
                data-hold-phase={primaryHold.holdPhase}
                data-hold-progress={primaryHold.progress.toFixed(3)}
                style={{ '--ritual-progress': primaryHold.progress }}
                onPointerEnter={event => {
                  primaryHold.trackPointer(event)
                  armHoverOption(event, 'primary')
                }}
                onPointerMove={primaryHold.trackPointer}
                onPointerDown={primaryHold.trackPointer}
                onPointerLeave={primaryHold.retract}
                onPointerCancel={primaryHold.retract}
                onPointerUp={event => {
                  if (!isRitualDirectPointer(event.pointerType)) return
                  primaryHold.retract()
                  armDirectOption(event, 'primary')
                }}
                disabled={locked}
              >
                <span className="lang-btn-curtain" style={{ '--hold-angle': `${primaryHold.progress * 360}deg` }} />
                <span className="lang-btn-text-area">
                  <span ref={primaryTextRef} className="lang-btn-text-single">{proceedText}</span>
                  <RitualHandAffordance />
                </span>
              </button>
            </div>
            <div className="language-btn-signal">
              <div
                className="lang-secondary-zone"
                ref={secondaryZoneRef}
                onPointerLeave={handleLanguageBoundaryLeave}
              >
                <button
                  className="language-btn language-btn--secondary"
                  data-selector-option="secondary"
                   data-ritual-armed="false"
                   data-ritual-active={armedOption === 'secondary' ? 'true' : 'false'}
                   data-ritual-ready={readyOption === 'secondary' ? 'true' : 'false'}
                   data-ritual-wheel-ready={readyOption === 'secondary' ? 'true' : 'false'}
                  ref={secondaryButtonRef}
                  data-hold-phase={secondaryPhase}
                  data-hold-progress={secondaryProgress.toFixed(3)}
                  style={{ '--ritual-progress': modeStage ? modeSecondaryHold.progress : 0 }}
                  onClick={modeStage ? undefined : handleLanguageExpandClick}
                  onPointerEnter={modeStage ? event => {
                    modeSecondaryHold.trackPointer(event)
                    armHoverOption(event, 'secondary')
                  } : undefined}
                  onPointerMove={modeStage ? modeSecondaryHold.trackPointer : handleLanguageSecondaryPointer}
                  onPointerDown={modeStage ? modeSecondaryHold.trackPointer : handleLanguageSecondaryPointer}
                  onPointerLeave={modeStage ? modeSecondaryHold.retract : undefined}
                  onPointerCancel={modeStage ? modeSecondaryHold.retract : handleLanguageBoundaryLeave}
                  onPointerUp={event => {
                    if (!isRitualDirectPointer(event.pointerType) || !modeStage) return
                    modeSecondaryHold.retract()
                    armDirectOption(event, 'secondary')
                  }}
                  onTouchStart={() => { touchInProgress.current = true }}
                  onTouchEnd={() => { scheduleTransient(() => { touchInProgress.current = false }, 300) }}
                  disabled={locked}
                >
                  <span
                    className={`lang-btn-curtain${langExpandHover ? ' lang-btn-curtain--raised' : ''}`}
                    style={{ '--hold-angle': `${secondaryProgress * 360}deg` }}
                  />
                  <span className="lang-btn-text-area">
                    <span ref={secondaryTextRef} className={`lang-btn-text-top${languageLabelShown ? ' lang-btn-text-top--hidden' : ''}`}>
                      {changeText}
                    </span>
                    <span className={`lang-btn-text-reveal${languageLabelShown ? ' lang-btn-text-reveal--visible' : ''}`}>
                      <ExpandLabel
                        labelText={labelText}
                        labelVisible={labelVisible}
                        labelRef={currentLanguageLabelRef}
                        scrambleActive={expanded && !languageLabelPinned}
                      />
                    </span>
                    {modeStage
                      ? <RitualHandAffordance />
                      : <span data-language-affordance-stage={languageAffordanceStage}>
                        <LanguageExpandAffordance onAnimationEnd={handleLanguageAffordanceAnimationEnd} />
                      </span>}
                  </span>
                </button>
                <div className="lang-hover-bridge" />
                <div
                  className={`lang-expand-layer${languageAffordanceStage === 'candidate' ? ' lang-expand-layer--visible' : ''}`}
                  data-language-candidate-stage={languageAffordanceStage}
                >
                  {alternateLanguage && (
                    <button
                      type="button"
                      className={`lang-item${alternateLanguage === scramblingLang ? ' lang-item--scrambling' : ''}`}
                      onClick={() => handleLanguageChange(alternateLanguage)}
                    >
                      {getReaderLanguage(alternateLanguage).label}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadingTransition({ phase, intent, language, readingMode, motionMode, surfaceStyle, environmentState, onProceed, onModeSelect }) {
  const setLanguage = useProgressStore(s => s.setLanguage)
  const startRootRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const startParallaxEnabled = (phase === 'reader-preparing' || phase === 'transition-leaving') && intent === 'start'
  useSceneParallax({
    rootRef: startRootRef,
    enabled: startParallaxEnabled,
    reduced: reducedMotion || motionMode === 'reduced',
  })
  const environmentLines = useMemo(
    () => resolveTransitionEnvironment(environmentState, language),
    [environmentState, language],
  )

  useEffect(() => {
    if (phase !== 'language-active') return
    const browserLangs = navigator.languages || [navigator.language || '']
    const detected = detectBrowserReaderLanguage(browserLangs)
    if (detected && detected !== language) {
      setLanguage(detected)
    }
  }, [phase])

  if (phase === 'landing-leaving' || phase === 'landing-empty-hold') return null

  if (['language-active', 'language-leaving', 'mode-active', 'mode-leaving'].includes(phase)) {
    return (
      <div className={`reading-transition reading-transition--ritual reading-transition--motion-${motionMode}`} style={surfaceStyle}>
        <RitualSelector language={language} onProceed={onProceed} onModeSelect={onModeSelect} phase={phase} />
      </div>
    )
  }

  if (phase === 'reader-preparing' || phase === 'transition-leaving') {
    const lang = copy[language] ? language : 'zh'
    const text = intent === 'start'
      ? copy[lang].transitionStart
      : copy[lang].transitionResume

    const fading = phase === 'transition-leaving'
    return (
      <div
        ref={intent === 'start' ? startRootRef : null}
        className={`reading-transition reading-transition--road-${readingMode} reading-transition--intent-${intent === 'start' ? 'start' : 'resume'} reading-transition--motion-${motionMode}${fading ? ' reading-transition--fading' : ''}`}
        style={{ ...surfaceStyle, '--rt-fade-duration': `${READING_ENTRY_TIMINGS.TRANSITION_FADE_MS}ms` }}
        data-world-layer={environmentState.worldLayer}
        data-time-of-day={environmentState.time}
        data-weather={environmentState.weather}
      >
        <div className="reading-transition-road-content">
          {intent === 'start' ? (
            <>
              <div className="reading-transition-start-foreground">
                <NewToneTransitionMark reduced={reducedMotion || motionMode === 'reduced'} />
              </div>
              <div className="reading-transition-start-background">
                <p className="reading-transition-text">{text}</p>
              </div>
            </>
          ) : (
            <>
              <ResumeEnvironment lines={environmentLines} />
              <p className="reading-transition-text reading-transition-text--resume">{text}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}

export default ReadingTransition
