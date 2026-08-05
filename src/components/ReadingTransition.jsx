import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { READING_ENTRY_TIMINGS } from '../transitions/readingEntryController'
import { copy } from '../i18n/copy'
import { detectBrowserReaderLanguage, getReaderLanguage, READER_LANGUAGES } from '../i18n/languages'
import { HOLD_PROGRESS_TIMINGS, stepHoldProgress } from '../interactions/holdProgress'
import { getReaderSceneLabel } from '../i18n/readerUi'
import { NewToneTransitionMark } from './landing/LandingTitleMark'
import './ReadingTransition.css'

const SCRAMBLE = '01░▒/\\-_:;~*#+%&@'
const RESUME_BLINK_CYCLE_MS = 1180

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

function ScrambleFlash({ text }) {
  const [display, setDisplay] = useState(initialScramble(text.length))

  useEffect(() => {
    let mounted = true
    let frame = 0
    const interval = setInterval(() => {
      if (!mounted) return
      frame++
      if (frame >= 8) {
        clearInterval(interval)
        setDisplay(text)
        return
      }
      setDisplay(initialScramble(text.length))
    }, 50)

    return () => { mounted = false; clearInterval(interval) }
  }, [text])

  return <>{display}</>
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

function useHoldAdvance({ enabled, onComplete, resetKey, textRef, flashRef }) {
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
      const next = stepHoldProgress(progressRef.current, targetRef.current, delta)
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
          { duration: HOLD_PROGRESS_TIMINGS.FLASH_MS, easing: 'ease-in-out' },
        ) ?? null
        finishTimerRef.current = window.setTimeout(
          () => onCompleteRef.current(),
          HOLD_PROGRESS_TIMINGS.FLASH_MS,
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
  }, [flashRef])

  return { progress, holdPhase, trackPointer, retract }
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

function RitualSelector({ language, onProceed, onModeSelect, phase }) {
  const setLanguage = useProgressStore(s => s.setLanguage)
  const lang = copy[language] || copy.zh
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
  const [fillDone, setFillDone] = useState(false)
  const [scramblingLang, setScramblingLang] = useState(null)
  const [languageSlots, setLanguageSlots] = useState([])
  const [labelText, setLabelText] = useState(getReaderLanguage(language).label)
  const [labelVisible, setLabelVisible] = useState(true)
  const [languageLabelPinned, setLanguageLabelPinned] = useState(false)
  const hideTimerRef = useRef(null)
  const hoverActiveRef = useRef(false)
  const isSwitchingRef = useRef(false)
  const expandedRef = useRef(false)
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

  useEffect(() => {
    if (!slotsInitialized.current) {
      slotsInitialized.current = true
      setLanguageSlots(READER_LANGUAGES.map(item => item.code).filter(code => code !== language))
    }
    if (!isSwitchingRef.current) {
      setLabelText(getReaderLanguage(language).label)
    }
  }, [language])

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
  const languageLabelShown = !modeStage && (expanded || languageLabelPinned)

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
    expandedRef.current = expanded
    if (expanded) {
      setFillDone(false)
      const t = setTimeout(() => {
        if (expandedRef.current) setFillDone(true)
      }, 500)
      return () => clearTimeout(t)
    } else {
      setFillDone(false)
    }
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

  const handleEnter = useCallback(() => {
    if (modeStage) return
    if (touchInProgress.current) return
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    hoverActiveRef.current = true
    setLangExpandHover(true)
  }, [modeStage])

  const handleLeave = useCallback(() => {
    if (modeStage) return
    if (touchInProgress.current) return
    hideTimerRef.current = setTimeout(() => {
      hoverActiveRef.current = false
      setLangExpandHover(false)
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
    if (window.matchMedia('(hover: hover)').matches) {
      setLangExpandHover(true)
      return
    }
    setLangExpandToggled(s => !s)
  }, [modeStage])

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
  })
  const modeSecondaryHold = useHoldAdvance({
    enabled: buttonsReady && modeStage && modeActionsReady && !locked,
    onComplete: performModeSecondaryAction,
    resetKey: holdResetKey,
    textRef: secondaryHoldTextRef,
    flashRef: secondaryButtonRef,
  })
  const languageSelectorHold = useLanguageSelectorHold({
    enabled: buttonsReady && !modeStage && !locked,
  })
  const secondaryProgress = modeStage ? modeSecondaryHold.progress : languageSelectorHold.progress
  const secondaryPhase = modeStage ? modeSecondaryHold.holdPhase : languageSelectorHold.holdPhase

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
      if (!button || !rect) return
      button.style.setProperty('--hold-text-width', `${rect.width}px`)
      button.style.setProperty('--hold-text-height', `${rect.height}px`)
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

  const row1 = languageSlots.slice(0, 2)
  const row2 = languageSlots.slice(2, 5)

  return (
    <div
      ref={selectorRootRef}
      className={`ritual-selector language-init${reforming ? ' language-init--reforming' : ''}${exiting ? ' language-init--exiting' : ''}`}
      data-selector-stage={currentStage.id}
      data-selector-identity={selectorIdentityStable === null ? 'pending' : selectorIdentityStable ? 'stable' : 'replaced'}
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
                data-hold-phase={primaryHold.holdPhase}
                data-hold-progress={primaryHold.progress.toFixed(3)}
                onPointerEnter={primaryHold.trackPointer}
                onPointerMove={primaryHold.trackPointer}
                onPointerDown={primaryHold.trackPointer}
                onPointerLeave={primaryHold.retract}
                onPointerCancel={primaryHold.retract}
                onPointerUp={event => { if (event.pointerType === 'touch') primaryHold.retract() }}
                disabled={locked}
              >
                <span className="lang-btn-curtain" style={{ '--hold-angle': `${primaryHold.progress * 360}deg` }} />
                <span className="lang-btn-text-area">
                  <span ref={primaryTextRef} className="lang-btn-text-single">{proceedText}</span>
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
                  ref={secondaryButtonRef}
                  data-hold-phase={secondaryPhase}
                  data-hold-progress={secondaryProgress.toFixed(3)}
                  onClick={modeStage ? undefined : handleLanguageExpandClick}
                  onPointerEnter={modeStage ? modeSecondaryHold.trackPointer : undefined}
                  onPointerMove={modeStage ? modeSecondaryHold.trackPointer : handleLanguageSecondaryPointer}
                  onPointerDown={modeStage ? modeSecondaryHold.trackPointer : handleLanguageSecondaryPointer}
                  onPointerLeave={modeStage ? modeSecondaryHold.retract : undefined}
                  onPointerCancel={modeStage ? modeSecondaryHold.retract : handleLanguageBoundaryLeave}
                  onPointerUp={event => { if (event.pointerType === 'touch' && modeStage) modeSecondaryHold.retract() }}
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
                  </span>
                </button>
                <div className="lang-hover-bridge" />
                <div
                  className={`lang-expand-layer${expanded && fillDone ? ' lang-expand-layer--visible' : ''}`}
                >
                  <div className="lang-array">
                    <div className="lang-row">
                      {row1.map(lc => (
                        <div
                          key={lc}
                          className={`lang-item${lc === scramblingLang ? ' lang-item--scrambling' : ''}`}
                          onClick={() => handleLanguageChange(lc)}
                        >
                          {lc === scramblingLang ? (
                            <ScrambleFlash text={getReaderLanguage(lc).label} />
                          ) : (
                            getReaderLanguage(lc).label
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="lang-row">
                      {row2.map(lc => (
                        <div
                          key={lc}
                          className={`lang-item${lc === scramblingLang ? ' lang-item--scrambling' : ''}`}
                          onClick={() => handleLanguageChange(lc)}
                        >
                          {lc === scramblingLang ? (
                            <ScrambleFlash text={getReaderLanguage(lc).label} />
                          ) : (
                            getReaderLanguage(lc).label
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
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
      <div className={`reading-transition reading-transition--motion-${motionMode}`} style={surfaceStyle}>
        <RitualSelector language={language} onProceed={onProceed} onModeSelect={onModeSelect} phase={phase} />
      </div>
    )
  }

  if (phase === 'reader-preparing' || phase === 'transition-leaving') {
    const lang = copy[language] ? language : 'zh'
    const chars = '░▒/\\-_01'
    const particles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      char: chars[Math.floor(Math.random() * chars.length)],
      x: Math.random() * 100,
      delay: Math.random() * 600,
    }))

    const text = intent === 'start'
      ? copy[lang].transitionStart
      : copy[lang].transitionResume

    const fading = phase === 'transition-leaving'
    return (
      <div
        className={`reading-transition reading-transition--road-${readingMode} reading-transition--motion-${motionMode}${fading ? ' reading-transition--fading' : ''}`}
        style={{ ...surfaceStyle, '--rt-fade-duration': `${READING_ENTRY_TIMINGS.TRANSITION_FADE_MS}ms` }}
        data-world-layer={environmentState.worldLayer}
        data-time-of-day={environmentState.time}
        data-weather={environmentState.weather}
      >
        <div className="reading-transition-noise" aria-hidden="true">
          {particles.map(p => (
            <span
              key={p.id}
              className="reading-transition-char"
              style={{ left: `${p.x}%`, animationDelay: `${p.delay}ms` }}
            >
              {p.char}
            </span>
          ))}
        </div>
        <div className="reading-transition-road-content">
          {intent === 'start' && <NewToneTransitionMark reduced={motionMode === 'reduced'} />}
          {intent !== 'start' && <ResumeEnvironment lines={environmentLines} />}
          <div className="reading-transition-pulse" />
          <p className={`reading-transition-text${intent !== 'start' ? ' reading-transition-text--resume' : ''}`}>{text}</p>
        </div>
      </div>
    )
  }

  return null
}

export default ReadingTransition
