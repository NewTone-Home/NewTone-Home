import { useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import { getReaderLanguage, READER_LANGUAGES } from '../../i18n/languages'
import { getLanguageMark } from '../../reader/readerLanguageMarks'
import {
  clampThemePosition,
  magnetizeThemePosition,
  nearestThemeNode,
  THEME_NODES,
  themeName,
  themePositionForWheel,
  themePositionFromPointerX,
} from '../../reader/readerTheme'
import ReaderSceneGlyph from './ReaderSceneGlyph'

function ClapperIcon() {
  return (
    <svg className="reader-tool-svg reader-tool-clapper" viewBox="0 0 48 40" aria-hidden="true">
      <path className="reader-tool-clapper-body" d="M7 14h34v22H7z" />
      <path className="reader-tool-clapper-top" d="m6 14 4-9h34l-4 9z" />
      <path d="m16 6-4 8m14-8-4 8m14-8-4 8" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg className="reader-tool-svg reader-tool-book" viewBox="0 0 48 40" aria-hidden="true">
      <path className="reader-tool-book-left" d="M4 9c8-2 14 0 20 5v22c-6-5-12-7-20-5z" />
      <path className="reader-tool-book-right" d="M44 9c-8-2-14 0-20 5v22c6-5 12-7 20-5z" />
      <path className="reader-tool-book-spine" d="M24 14v22" />
    </svg>
  )
}

function ReadingModeIcon({ mode }) {
  return mode === 'immersive' ? <ClapperIcon /> : <BookIcon />
}

const MODE_TRANSITION_MS = 1500
const LANGUAGE_SCRAMBLE_START_MS = 360
const LANGUAGE_SWAP_MS = 1020
const LANGUAGE_COMPLETE_MS = 1360
const LANGUAGE_SCRAMBLE_FRAMES = 9
const LANGUAGE_SCRAMBLE_FRAME_MS = 67
const FULL_WHEEL_STEP = 0.04
const TOOLBAR_CLOSE_DELAY_MS = 120
const CLOSED_PANELS = Object.freeze({ language: false, theme: false })
const READER_MODE_SWITCH_ENABLED = false

function initialLanguageSlots(language) {
  return READER_LANGUAGES.filter(item => item.code !== language)
}

function languageMarkClass(code) {
  return code === 'zh' ? 'reader-language-mark--single-cjk' : 'reader-language-mark--latin'
}

function ReaderTools({
  language,
  onLanguage,
  readingMode,
  themePosition = 0.5,
  motionMode,
  onReadingMode,
  onThemePosition,
  locationId,
  locationLabel,
  showLocationLabel = true,
}) {
  const visibleReadingMode = 'standard'
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedPanels, setExpandedPanels] = useState(CLOSED_PANELS)
  const [hoveredTool, setHoveredTool] = useState(null)
  const [languageSlots, setLanguageSlots] = useState(() => initialLanguageSlots(language))
  const [languageSwap, setLanguageSwap] = useState(null)
  const [scrambling, setScrambling] = useState(false)
  const [displayMark, setDisplayMark] = useState(() => getLanguageMark(language))
  const [outgoingMode, setOutgoingMode] = useState(null)
  const [modeTransition, setModeTransition] = useState(null)
  const [clapping, setClapping] = useState(false)
  const [modeHintVisible, setModeHintVisible] = useState(false)
  const [draggingTheme, setDraggingTheme] = useState(false)
  const [sceneSwap, setSceneSwap] = useState(null)
  const rootRef = useRef(null)
  const modeButtonRef = useRef(null)
  const themeDockRef = useRef(null)
  const themeTrackRef = useRef(null)
  const themeThumbRef = useRef(null)
  const pointerFocusedRef = useRef(null)
  const themePointerIdRef = useRef(null)
  const themeDragGeometryRef = useRef(null)
  const lastThemePointerRef = useRef({ clientX: 0, clientY: 0 })
  const pointerRegionRef = useRef('none')
  const toolbarCloseTimerRef = useRef(null)
  const panelCloseTimersRef = useRef({ language: null, theme: null })
  const languageSwapActiveRef = useRef(false)
  const settledLanguageRef = useRef(language)
  const timersRef = useRef(new Set())
  const previousModeRef = useRef(visibleReadingMode)
  const displayedSceneRef = useRef({ locationId, locationLabel })

  const schedule = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer)
      callback()
    }, delay)
    timersRef.current.add(timer)
    return timer
  }

  const clearTimer = timer => {
    if (timer === null) return
    window.clearTimeout(timer)
    timersRef.current.delete(timer)
  }

  const cancelToolbarClose = () => {
    clearTimer(toolbarCloseTimerRef.current)
    toolbarCloseTimerRef.current = null
  }

  const cancelPanelClose = panel => {
    clearTimer(panelCloseTimersRef.current[panel])
    panelCloseTimersRef.current[panel] = null
  }

  const releaseThemeFocus = (restoreToMode = false) => {
    const activeElement = document.activeElement
    if (!themeDockRef.current?.contains(activeElement)) return
    if (restoreToMode) modeButtonRef.current?.focus({ preventScroll: true })
    else activeElement.blur?.()
    if (pointerFocusedRef.current === activeElement) pointerFocusedRef.current = null
  }

  const closeToolbarNow = () => {
    releaseThemeFocus()
    cancelToolbarClose()
    cancelPanelClose('language')
    cancelPanelClose('theme')
    setMenuOpen(false)
    setMobileOpen(false)
    setHoveredTool(null)
    setModeHintVisible(false)
    setExpandedPanels(CLOSED_PANELS)
  }

  const shouldKeepToolbarOpen = () => (
    pointerRegionRef.current !== 'none'
    || Boolean(rootRef.current?.contains(document.activeElement))
    || themePointerIdRef.current !== null
    || languageSwapActiveRef.current
  )

  const scheduleToolbarClose = () => {
    cancelToolbarClose()
    toolbarCloseTimerRef.current = schedule(() => {
      toolbarCloseTimerRef.current = null
      if (!shouldKeepToolbarOpen()) closeToolbarNow()
    }, TOOLBAR_CLOSE_DELAY_MS)
  }

  const schedulePanelClose = panel => {
    cancelPanelClose(panel)
    panelCloseTimersRef.current[panel] = schedule(() => {
      panelCloseTimersRef.current[panel] = null
      if (themePointerIdRef.current !== null || languageSwapActiveRef.current) return
      if (panel === 'theme') releaseThemeFocus()
      setExpandedPanels(current => (current[panel] ? { ...current, [panel]: false } : current))
    }, TOOLBAR_CLOSE_DELAY_MS)
  }

  const setActiveTool = tool => {
    cancelToolbarClose()
    cancelPanelClose('language')
    cancelPanelClose('theme')
    setMenuOpen(true)
    setHoveredTool(tool)
    if (tool === 'language') releaseThemeFocus()
    setExpandedPanels(tool === 'language'
      ? { language: true, theme: false }
      : tool === 'reading' && visibleReadingMode === 'standard'
        ? { language: false, theme: true }
        : CLOSED_PANELS)
  }

  const regionFromNode = node => {
    if (!(node instanceof Node) || !rootRef.current?.contains(node)) return 'none'
    if (node.closest?.('.reader-menu-mark')) return 'mark'
    if (node.closest?.('.reader-language-group')) return 'language'
    if (node.closest?.('.reader-mode-group')) return 'reading'
    return 'toolbar'
  }

  const reconcileToolbarState = () => {
    const region = pointerRegionRef.current
    if (region === 'language' || region === 'reading') setActiveTool(region)
    else if (region === 'mark' || region === 'toolbar' || rootRef.current?.contains(document.activeElement)) {
      cancelToolbarClose()
      setMenuOpen(true)
    } else closeToolbarNow()
  }

  useEffect(() => {
    if (!languageSwap && language !== settledLanguageRef.current) {
      settledLanguageRef.current = language
      setLanguageSlots(initialLanguageSlots(language))
      setDisplayMark(getLanguageMark(language))
    }
  }, [language, languageSwap])

  useEffect(() => {
    const previousMode = previousModeRef.current
    if (previousMode === visibleReadingMode) return
    setOutgoingMode(previousMode)
    setModeTransition(`${previousMode}-to-${visibleReadingMode}`)
    previousModeRef.current = visibleReadingMode
    schedule(() => {
      setOutgoingMode(null)
      setModeTransition(null)
    }, MODE_TRANSITION_MS)
  }, [visibleReadingMode])

  useEffect(() => {
    const previous = displayedSceneRef.current
    if (previous.locationId === locationId && previous.locationLabel === locationLabel) return
    const next = { locationId, locationLabel }
    displayedSceneRef.current = next
    setSceneSwap({ previous, next })
    schedule(() => setSceneSwap(null), 560)
  }, [locationId, locationLabel])

  useEffect(() => {
    const handleOutside = event => {
      if (!rootRef.current?.contains(event.target)) {
        pointerRegionRef.current = 'none'
        if (!languageSwapActiveRef.current && themePointerIdRef.current === null) closeToolbarNow()
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [])

  useEffect(() => () => {
    timersRef.current.forEach(window.clearTimeout)
    timersRef.current.clear()
  }, [])

  const isMobileInteraction = () => window.matchMedia('(hover: none)').matches || window.innerWidth <= 700

  const releasePointerFocus = () => {
    pointerFocusedRef.current?.blur()
    pointerFocusedRef.current = null
  }

  const rememberPointerFocus = event => {
    if (event.detail > 0) pointerFocusedRef.current = event.currentTarget
  }

  const scrambleToLanguage = target => {
    const mark = getLanguageMark(target.code)
    const glyphs = ['░', '▒', '/', '\\', '·', '#']
    let frame = 0
    setScrambling(true)
    const tick = () => {
      frame += 1
      setDisplayMark(frame < LANGUAGE_SCRAMBLE_FRAMES
        ? Array.from({ length: Math.max(2, mark.length) }, (_, index) => glyphs[(frame + index) % glyphs.length]).join('')
        : mark)
      if (frame < LANGUAGE_SCRAMBLE_FRAMES) schedule(tick, LANGUAGE_SCRAMBLE_FRAME_MS)
      else setScrambling(false)
    }
    tick()
  }

  const chooseLanguage = (slotIndex, event) => {
    if (languageSwap || scrambling) return
    const selected = languageSlots[slotIndex]
    const previous = getReaderLanguage(language)
    if (!selected) return
    rememberPointerFocus(event)
    cancelToolbarClose()
    languageSwapActiveRef.current = true
    setLanguageSwap({ slotIndex, phase: 'candidate-exit' })
    schedule(() => {
      setLanguageSwap(current => current && { ...current, phase: 'current-glitch' })
      settledLanguageRef.current = selected.code
      onLanguage(selected.code)
      scrambleToLanguage(selected)
    }, LANGUAGE_SCRAMBLE_START_MS)
    schedule(() => {
      setLanguageSlots(current => current.map((item, index) => (index === slotIndex ? previous : item)))
      setLanguageSwap(current => current && { ...current, phase: 'old-language-enter' })
    }, LANGUAGE_SWAP_MS)
    schedule(() => {
      languageSwapActiveRef.current = false
      setLanguageSwap(null)
      releasePointerFocus()
      reconcileToolbarState()
    }, LANGUAGE_COMPLETE_MS)
  }

  const toggleMode = event => {
    if (modeTransition) return
    rememberPointerFocus(event)
    if (!READER_MODE_SWITCH_ENABLED || visibleReadingMode === 'standard') {
      cancelToolbarClose()
      cancelPanelClose('language')
      cancelPanelClose('theme')
      setMenuOpen(true)
      setHoveredTool('reading')
      setExpandedPanels({ language: false, theme: true })
      pointerRegionRef.current = 'reading'
      return
    }
    const nextMode = visibleReadingMode === 'immersive' ? 'standard' : 'immersive'
    if (nextMode === 'immersive') releaseThemeFocus(true)
    setOutgoingMode(readingMode)
    setModeTransition(`${readingMode}-to-${nextMode}`)
    previousModeRef.current = nextMode
    pointerRegionRef.current = 'reading'
    cancelToolbarClose()
    cancelPanelClose('theme')
    setMenuOpen(true)
    setHoveredTool('reading')
    setExpandedPanels(nextMode === 'standard'
      ? { language: false, theme: true }
      : CLOSED_PANELS)
    onReadingMode(nextMode)
    setClapping(false)
    schedule(() => {
      setOutgoingMode(null)
      setModeTransition(null)
      releasePointerFocus()
    }, MODE_TRANSITION_MS)
  }

  const handleModeHover = () => {
    if (visibleReadingMode !== 'immersive' || modeTransition || clapping) return
    setClapping(true)
    schedule(() => setClapping(false), 780)
  }

  const readThemeDragGeometry = () => {
    const trackRect = themeTrackRef.current?.getBoundingClientRect()
    const thumbRect = themeThumbRef.current?.getBoundingClientRect()
    return trackRect?.width && thumbRect?.width ? { trackRect, thumbSize: thumbRect.width } : null
  }

  const commitThemePointer = clientX => {
    const geometry = themeDragGeometryRef.current
    if (!geometry) return
    const next = themePositionFromPointerX(clientX, geometry.trackRect, geometry.thumbSize)
    onThemePosition(motionMode === 'reduced' ? nearestThemeNode(next) : magnetizeThemePosition(next))
  }

  const reconcileAfterThemePointer = (clientX, clientY) => {
    if (mobileOpen) return
    pointerRegionRef.current = regionFromNode(document.elementFromPoint(clientX, clientY))
    if (pointerRegionRef.current === 'reading' || pointerRegionRef.current === 'language') setActiveTool(pointerRegionRef.current)
    else if (pointerRegionRef.current === 'none') scheduleToolbarClose()
    else schedulePanelClose('theme')
  }

  const handleThemePointerDown = event => {
    const geometry = readThemeDragGeometry()
    if (!geometry) return
    event.preventDefault()
    event.stopPropagation()
    themePointerIdRef.current = event.pointerId
    themeDragGeometryRef.current = geometry
    lastThemePointerRef.current = { clientX: event.clientX, clientY: event.clientY }
    pointerFocusedRef.current = event.currentTarget
    pointerRegionRef.current = 'reading'
    cancelToolbarClose()
    cancelPanelClose('theme')
    setMenuOpen(true)
    setExpandedPanels({ language: false, theme: true })
    setDraggingTheme(true)
    event.currentTarget.focus({ preventScroll: true })
    try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch { /* inactive pointer */ }
    commitThemePointer(event.clientX)
  }

  const handleThemePointerMove = event => {
    if (themePointerIdRef.current !== event.pointerId) return
    lastThemePointerRef.current = { clientX: event.clientX, clientY: event.clientY }
    commitThemePointer(event.clientX)
  }

  const finishThemePointer = event => {
    if (themePointerIdRef.current !== event.pointerId) return
    lastThemePointerRef.current = { clientX: event.clientX, clientY: event.clientY }
    commitThemePointer(event.clientX)
    themePointerIdRef.current = null
    try { event.currentTarget.releasePointerCapture?.(event.pointerId) } catch { /* capture already lost */ }
    themeDragGeometryRef.current = null
    setDraggingTheme(false)
    reconcileAfterThemePointer(event.clientX, event.clientY)
  }

  const handleThemeLostPointerCapture = event => {
    if (themePointerIdRef.current !== event.pointerId) return
    themePointerIdRef.current = null
    themeDragGeometryRef.current = null
    setDraggingTheme(false)
    reconcileAfterThemePointer(lastThemePointerRef.current.clientX, lastThemePointerRef.current.clientY)
  }

  const stepTheme = direction => {
    const currentIndex = THEME_NODES.indexOf(nearestThemeNode(themePosition))
    onThemePosition(THEME_NODES[Math.min(THEME_NODES.length - 1, Math.max(0, currentIndex + direction))])
  }

  const handleThemeWheel = event => {
    event.stopPropagation()
    onThemePosition(themePositionForWheel(themePosition, event.deltaY, motionMode, FULL_WHEEL_STEP))
  }

  const handleThemeKeyDown = event => {
    let handled = true
    if (event.key === 'Home') onThemePosition(0)
    else if (event.key === 'End') onThemePosition(1)
    else if (['ArrowRight', 'ArrowDown'].includes(event.key)) stepTheme(1)
    else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) stepTheme(-1)
    else handled = false
    if (handled) event.preventDefault()
  }

  const languageOpen = expandedPanels.language || languageSwap !== null
  const ui = getReaderUi(language)
  const modeLabel = ui.standardReading
  const activeThemeNode = nearestThemeNode(themePosition)
  const themeAtAnchor = themeName(themePosition)
  const activeThemeName = themeAtAnchor
    ? ({ 0: ui.bright, 0.5: ui.soft, 1: ui.night })[activeThemeNode]
    : ''
  const themePillOpen = expandedPanels.theme || mobileOpen || (visibleReadingMode === 'standard' && hoveredTool === 'reading')
  const toolbarOpen = menuOpen || mobileOpen || draggingTheme || languageSwap !== null
  const standardControlsPresent = true

  return (
    <div
      ref={rootRef}
      className={`reader-corner-menu${toolbarOpen ? ' is-open' : ''}${draggingTheme ? ' is-dragging' : ''}${modeTransition ? ` is-mode-switching is-${modeTransition}` : ''}`}
      data-hovered-tool={hoveredTool || 'none'}
      data-menu-items="language reading-mode"
      onPointerEnter={() => { if (toolbarOpen) cancelToolbarClose() }}
      onPointerLeave={() => {
        if (themePointerIdRef.current !== null) return
        pointerRegionRef.current = 'none'
        scheduleToolbarClose()
      }}
      onFocusCapture={() => { cancelToolbarClose(); setMenuOpen(true) }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) scheduleToolbarClose() }}
    >
      <div className={`reader-scene-menu-group reader-scene-menu-group--${visibleReadingMode}`}>
        {showLocationLabel && (
          <span className="reader-scene-menu-label" aria-live="polite">
            {sceneSwap && <span className="reader-scene-menu-label-layer is-outgoing">{sceneSwap.previous.locationLabel}</span>}
            <span className={`reader-scene-menu-label-layer${sceneSwap ? ' is-incoming' : ''}`}>{locationLabel}</span>
          </span>
        )}
        <button
          className={`reader-menu-mark reader-menu-mark--${visibleReadingMode}${modeTransition ? ` is-switching is-${modeTransition}` : ''}`}
          type="button"
          aria-label={ui.readerSettings}
          aria-expanded={toolbarOpen}
          onPointerEnter={() => {
            pointerRegionRef.current = 'mark'
            cancelToolbarClose()
            if (!isMobileInteraction()) setMenuOpen(true)
          }}
          onPointerLeave={() => { pointerRegionRef.current = 'none'; scheduleToolbarClose() }}
          onFocus={() => { cancelToolbarClose(); setMenuOpen(true) }}
          onClick={() => {
            if (isMobileInteraction()) setMobileOpen(current => !current)
            else setMenuOpen(true)
          }}
        >
          <span className={`reader-menu-trigger-layer reader-menu-trigger-layer--incoming reader-menu-trigger-layer--${visibleReadingMode}`} aria-hidden="true">
            {visibleReadingMode === 'standard'
              ? <span className="reader-menu-bars"><i /><i /></span>
              : (
              <span className="reader-menu-scene-layers" aria-hidden="true">
                {sceneSwap && <ReaderSceneGlyph locationId={sceneSwap.previous.locationId} className="reader-menu-scene-glyph is-outgoing" />}
                <ReaderSceneGlyph locationId={locationId} className={`reader-menu-scene-glyph${sceneSwap ? ' is-incoming' : ''}`} />
              </span>
              )}
          </span>
          {outgoingMode && (
            <span className={`reader-menu-trigger-layer reader-menu-trigger-layer--outgoing reader-menu-trigger-layer--${outgoingMode}`} aria-hidden="true">
              {outgoingMode === 'standard'
                ? <span className="reader-menu-bars"><i /><i /></span>
                : <span className="reader-menu-scene-layers"><ReaderSceneGlyph locationId={locationId} className="reader-menu-scene-glyph" /></span>}
            </span>
          )}
        </button>
      </div>

      <div
        className="reader-corner-stack"
        role="menu"
        aria-label={ui.readerSettings}
        onPointerEnter={() => { pointerRegionRef.current = 'toolbar'; cancelToolbarClose() }}
        onPointerLeave={() => { pointerRegionRef.current = 'none'; scheduleToolbarClose() }}
      >
        <div
          className={`reader-tool-group reader-language-group${languageOpen ? ' is-submenu-open' : ''}`}
          onPointerEnter={() => { pointerRegionRef.current = 'language'; if (!isMobileInteraction()) setActiveTool('language') }}
          onPointerLeave={event => {
            pointerRegionRef.current = regionFromNode(event.relatedTarget)
            schedulePanelClose('language')
            if (pointerRegionRef.current !== 'toolbar') scheduleToolbarClose()
          }}
          onFocus={() => setActiveTool('language')}
        >
          <div className="reader-language-anchor" data-language-tools-revision="horizontal-v1">
            <button
              className={`reader-corner-item reader-language-tool${scrambling ? ' is-scrambling' : ''}`}
              type="button"
              role="menuitem"
              aria-label={`${ui.language}${ui.languageSeparator}${getReaderLanguage(language).label}`}
              aria-expanded={languageOpen}
              onClick={() => {
                if (isMobileInteraction()) {
                  releaseThemeFocus()
                  setExpandedPanels({ language: true, theme: false })
                }
              }}
            >
              <span className={`reader-language-mark ${languageMarkClass(language)}`}>{displayMark}</span>
            </button>
            <div className={`reader-language-track${languageOpen ? ' is-open' : ''}`} role="menu" aria-label={ui.selectLanguage} aria-hidden={!languageOpen}>
              {languageSlots.map((item, index) => {
                const swapPhase = languageSwap?.slotIndex === index ? languageSwap.phase : ''
                return (
                  <button
                    key={`language-slot-${index}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked="false"
                    className={`reader-language-slot${swapPhase ? ` is-${swapPhase}` : ''}`}
                    aria-label={`${ui.switchLanguageTo} ${item.label}`}
                    onClick={event => chooseLanguage(index, event)}
                  ><span className="reader-language-slot-label">{item.label}</span></button>
                )
              })}
            </div>
          </div>
        </div>

        <div
          className={`reader-tool-group reader-mode-group${themePillOpen ? ' is-submenu-open' : ''}`}
          onPointerEnter={() => {
            pointerRegionRef.current = 'reading'
            setModeHintVisible(true)
            if (!isMobileInteraction()) setActiveTool('reading')
          }}
          onPointerLeave={event => {
            pointerRegionRef.current = regionFromNode(event.relatedTarget)
            setModeHintVisible(false)
            if (themePointerIdRef.current === null) {
              schedulePanelClose('theme')
              if (pointerRegionRef.current !== 'toolbar') scheduleToolbarClose()
            }
          }}
          onFocus={() => { setModeHintVisible(true); setActiveTool('reading') }}
        >
          <div className="reader-tool-row">
            {visibleReadingMode === 'immersive' && <span className={`reader-tool-status reader-mode-status${modeHintVisible ? ' is-visible' : ''}`} role="status">{modeLabel}</span>}
            <div className="reader-mode-anchor">
              <button
                ref={modeButtonRef}
                className={`reader-corner-item reader-mode-tool reader-mode-tool--${visibleReadingMode}${modeTransition ? ` is-switching is-${modeTransition}` : ''}${clapping ? ' is-clapping' : ''}`}
                type="button"
                role="menuitem"
                onMouseEnter={handleModeHover}
                onClick={toggleMode}
                aria-label={modeLabel}
              >
                <span className="reader-mode-icon-layer reader-mode-icon-layer--incoming"><ReadingModeIcon mode={visibleReadingMode} /></span>
                {outgoingMode && <span className="reader-mode-icon-layer reader-mode-icon-layer--outgoing"><ReadingModeIcon mode={outgoingMode} /></span>}
              </button>
              {standardControlsPresent && (
                <div
                  ref={themeDockRef}
                  className={`reader-theme-dock${visibleReadingMode === 'standard' && themePillOpen ? ' is-open' : ''}${modeTransition === 'immersive-to-standard' ? ' is-mode-entering' : ''}${modeTransition === 'standard-to-immersive' ? ' is-mode-leaving' : ''}`}
                  aria-hidden={visibleReadingMode !== 'standard' || !themePillOpen}
                >
                  {activeThemeName && <span key={activeThemeNode} className="reader-theme-name" style={{ '--theme-node': activeThemeNode }} aria-hidden="true">{activeThemeName}</span>}
                  <div
                    className={`reader-theme-pill reader-theme-pill--${motionMode}${draggingTheme ? ' is-dragging' : ''}`}
                    role="slider"
                    tabIndex={visibleReadingMode === 'standard' && themePillOpen ? 0 : -1}
                    aria-label={ui.standardTheme}
                    aria-valuemin="0"
                    aria-valuemax="1"
                    aria-valuenow={themePosition}
                    aria-valuetext={activeThemeName || `${ui.theme} ${Math.round(themePosition * 100)}%`}
                    onPointerDown={handleThemePointerDown}
                    onPointerMove={handleThemePointerMove}
                    onPointerUp={finishThemePointer}
                    onPointerCancel={finishThemePointer}
                    onLostPointerCapture={handleThemeLostPointerCapture}
                    onWheel={handleThemeWheel}
                    onKeyDown={handleThemeKeyDown}
                  >
                    <span className="reader-theme-pill-text" aria-hidden="true">{ui.standardReading}</span>
                    <span ref={themeTrackRef} className="reader-theme-track-geometry" aria-hidden="true" />
                    <span ref={themeThumbRef} className="reader-theme-thumb" style={{ '--theme-position': clampThemePosition(themePosition) }} aria-hidden="true" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReaderTools
