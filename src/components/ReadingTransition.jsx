import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { READING_ENTRY_TIMINGS } from '../transitions/readingEntryController'
import { copy } from '../i18n/copy'
import { getReaderLanguage, READER_LANGUAGES } from '../i18n/languages'
import { getReaderThemeVariables } from '../reader/readerTheme'
import './ReadingTransition.css'

const SCRAMBLE = '01░▒/\\-_:;~*#+%&@'

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

function ExpandLabel({ labelText, labelVisible }) {
  return (
    <span className={`lang-current-label${labelVisible ? ' lang-current-label--visible' : ' lang-current-label--hidden'}`}>
      {labelText}
    </span>
  )
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

  const handlePrimaryClick = useCallback(() => {
    if (modeStage) {
      onModeSelect('immersive')
      return
    }
    onProceed()
  }, [modeStage, onModeSelect, onProceed])

  const handleClick = useCallback(() => {
    if (modeStage) {
      onModeSelect('standard')
      return
    }
    if (window.matchMedia('(hover: hover)').matches) {
      setLangExpandHover(true)
      return
    }
    setLangExpandToggled(s => !s)
  }, [modeStage, onModeSelect])

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
              <button ref={primaryButtonRef} className="language-btn language-btn--primary" data-selector-option="primary" onClick={handlePrimaryClick} disabled={locked}>
                <span className="lang-btn-curtain" />
                <span className="lang-btn-text-area">
                  <span ref={primaryTextRef} className="lang-btn-text-single">{proceedText}</span>
                </span>
              </button>
            </div>
            <div className="language-btn-signal">
              <div className="lang-secondary-zone" ref={secondaryZoneRef}>
                <button
                  className="language-btn language-btn--secondary"
                  data-selector-option="secondary"
                  ref={secondaryButtonRef}
                  onClick={handleClick}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                  onTouchStart={() => { touchInProgress.current = true }}
                  onTouchEnd={() => { scheduleTransient(() => { touchInProgress.current = false }, 300) }}
                  disabled={locked}
                >
                  <span className={`lang-btn-curtain${langExpandHover ? ' lang-btn-curtain--raised' : ''}`} />
                  <span className="lang-btn-text-area">
                    <span ref={secondaryTextRef} className={`lang-btn-text-top${expanded ? ' lang-btn-text-top--hidden' : ''}`}>
                      {changeText}
                    </span>
                    <span className={`lang-btn-text-reveal${expanded ? ' lang-btn-text-reveal--visible' : ''}`}>
                      <ExpandLabel labelText={labelText} labelVisible={labelVisible} />
                    </span>
                  </span>
                </button>
                <div className="lang-hover-bridge" onMouseEnter={handleEnter} onMouseLeave={handleLeave} />
                <div
                  className={`lang-expand-layer${expanded && fillDone ? ' lang-expand-layer--visible' : ''}`}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
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

function ReadingTransition({ phase, intent, language, readingMode, themePosition, motionMode, onProceed, onModeSelect }) {
  const setLanguage = useProgressStore(s => s.setLanguage)

  useEffect(() => {
    if (phase !== 'language-active') return
    const browserLangs = navigator.languages || [navigator.language || '']
    const detected = detectLanguage(browserLangs)
    if (detected && detected !== language) {
      setLanguage(detected)
    }
  }, [phase])

  if (phase === 'landing-leaving' || phase === 'landing-empty-hold') return null

  if (['language-active', 'language-leaving', 'mode-active', 'mode-leaving'].includes(phase)) {
    return (
      <div className={`reading-transition reading-transition--motion-${motionMode}`}>
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
    const readerThemeStyle = readingMode === 'standard'
      ? getReaderThemeVariables(themePosition)
      : {}

    return (
      <div
        className={`reading-transition reading-transition--road-${readingMode} reading-transition--motion-${motionMode}${fading ? ' reading-transition--fading' : ''}`}
        style={{ ...readerThemeStyle, '--rt-fade-duration': `${READING_ENTRY_TIMINGS.TRANSITION_FADE_MS}ms` }}
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
        <div className="reading-transition-pulse" />
        <p className="reading-transition-text">{text}</p>
      </div>
    )
  }

  return null
}

function detectLanguage(browserLangs) {
  const PREFIX_MAP = {
    zh: ['zh'], en: ['en'], ja: ['ja'], ko: ['ko'], fr: ['fr'],
  }
  for (const bl of browserLangs) {
    const code = bl.slice(0, 2).toLowerCase()
    for (const [lang, prefixes] of Object.entries(PREFIX_MAP)) {
      if (prefixes.includes(code)) return lang
    }
  }
  return null
}

export default ReadingTransition
