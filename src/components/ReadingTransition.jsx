import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { READING_ENTRY_TIMINGS } from '../transitions/readingEntryController'
import { copy } from '../i18n/copy'
import { detectBrowserReaderLanguage, READER_LANGUAGES } from '../i18n/languages'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useSceneParallax } from '../hooks/useSceneParallax'
import { getReaderSceneLabel } from '../i18n/readerUi'
import { NewToneTransitionMark } from './landing/LandingTitleMark'
import EntryButtonGroup from './EntryButtonGroup'
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

  useEffect(() => {
    if (!enabled) {
      setDisplayText('')
      setStable(false)
      return undefined
    }

    let mounted = true
    let resolvedCount = 0
    let scrambleTimer
    let resolveTimer
    let startTimer

    setDisplayText(initialScramble(text.length))
    setStable(false)

    scrambleTimer = window.setInterval(() => {
      if (!mounted) return
      const chars = text.split('').map((char, index) => index < resolvedCount ? char : randScramble())
      setDisplayText(chars.join(''))
    }, scrambleInterval)

    const startResolution = () => {
      resolveTimer = window.setInterval(() => {
        resolvedCount += 1
        if (resolvedCount >= text.length) {
          window.clearInterval(resolveTimer)
          window.clearInterval(scrambleTimer)
          if (mounted) {
            setDisplayText(text)
            setStable(true)
          }
        }
      }, charInterval)
    }

    if (startDelay > 0) startTimer = window.setTimeout(startResolution, startDelay)
    else startResolution()

    return () => {
      mounted = false
      window.clearTimeout(startTimer)
      window.clearInterval(scrambleTimer)
      window.clearInterval(resolveTimer)
    }
  }, [charInterval, enabled, scrambleInterval, startDelay, text])

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

function RitualSelector({ language, onProceed, onModeSelect, phase }) {
  const setLanguage = useProgressStore(s => s.setLanguage)
  const lang = copy[language] || copy.zh
  const modeStage = phase === 'mode-active' || phase === 'mode-leaving'
  const leaving = phase === 'language-leaving' || phase === 'mode-leaving'
  const [languageVersion, setLanguageVersion] = useState(0)
  const [revealed, setRevealed] = useState(languageVersion > 0)
  const [actionsVisible, setActionsVisible] = useState(false)

  useEffect(() => {
    if (languageVersion > 0) {
      setRevealed(true)
      return undefined
    }
    const timer = window.setTimeout(() => setRevealed(true), READING_ENTRY_TIMINGS.LANGUAGE_INIT_TITLE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [languageVersion])

  const currentStage = useMemo(() => ({
    id: modeStage ? 'mode' : 'language',
    title: modeStage ? lang.modeInitTitle : lang.languageInitTitle,
  }), [lang, modeStage])

  const titleCharInterval = useMemo(() => (
    languageVersion === 0
      ? Math.max(60, Math.min(130, Math.floor(2000 / currentStage.title.length)))
      : Math.max(30, Math.min(60, Math.floor(800 / currentStage.title.length)))
  ), [currentStage.title.length, languageVersion])

  const { displayText: titleDisplay, stable: titleStable } = useScrambleText(currentStage.title, {
    charInterval: titleCharInterval,
    scrambleInterval: 50,
    enabled: revealed,
  })

  useEffect(() => {
    setActionsVisible(false)
    if (leaving || !titleStable) return undefined
    const timer = window.setTimeout(() => setActionsVisible(true), modeStage ? 160 : 300)
    return () => window.clearTimeout(timer)
  }, [currentStage.id, leaving, modeStage, titleStable])

  const alternateLanguage = useMemo(
    () => READER_LANGUAGES.find(item => item.code !== language)?.code,
    [language],
  )

  const entries = useMemo(() => {
    if (modeStage) {
      return [
        { id: 'mode-immersive', label: lang.modeImmersive, materialMode: 'background' },
        { id: 'mode-standard', label: lang.modeStandard, materialMode: 'background' },
      ]
    }
    return [
      { id: 'language-continue', label: lang.languageInitProceed, materialMode: 'background' },
      { id: 'language-change', label: lang.languageInitChange, materialMode: 'background' },
    ]
  }, [lang, modeStage])

  const handleEntryNavigate = useCallback((entryId) => {
    if (modeStage) {
      onModeSelect(entryId === 'mode-standard' ? 'standard' : 'immersive')
      return
    }
    if (entryId === 'language-change' && alternateLanguage) {
      setLanguage(alternateLanguage)
      setLanguageVersion(version => version + 1)
      return
    }
    onProceed()
  }, [alternateLanguage, modeStage, onModeSelect, onProceed, setLanguage])

  return (
    <div
      className={`ritual-selector language-init${leaving ? ' language-init--leaving' : ''}`}
      data-selector-stage={currentStage.id}
      data-selector-phase={leaving ? 'leaving' : actionsVisible ? 'visible' : 'preparing'}
    >
      <p className="ritual-selector-title language-init-title" data-stable={revealed && titleStable ? 'true' : 'false'}>
        {revealed ? (titleDisplay || '') : ''}
      </p>

      {actionsVisible && !leaving && (
        <EntryButtonGroup
          key={`${currentStage.id}:${languageVersion}`}
          groupId={`reader-${currentStage.id}-entries`}
          entries={entries}
          onNavigate={handleEntryNavigate}
          className="reading-transition-entry-group"
        />
      )}
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
    if (detected && detected !== language) setLanguage(detected)
  }, [language, phase, setLanguage])

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
    const text = intent === 'start' ? copy[lang].transitionStart : copy[lang].transitionResume
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
