import { useEffect, useRef, useState } from 'react'
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

function MotionIcon({ reduced }) {
  return (
    <svg className="reader-tool-svg reader-tool-motion" viewBox="0 0 48 40" aria-hidden="true">
      <path className="motion-line motion-line--one" d="M31 10h10" />
      <path className="motion-line motion-line--two" d="M23 20h18" />
      <path className="motion-line motion-line--three" d="M13 30h28" />
      <path className={`motion-slash${reduced ? ' is-visible' : ''}`} d="M10 34 39 6" />
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
const LANGUAGE_TRACK_EXPAND_STAGGER_MS = 45
const LANGUAGE_TRACK_COLLAPSE_STAGGER_MS = 30
const TOOLBAR_CLOSE_DELAY_MS = 120
const CLOSED_PANELS = Object.freeze({ language: false, theme: false })

function initialLanguageSlots(language) {
  return READER_LANGUAGES.filter(item => item.code !== language)
}

function languageMarkClass(code) {
  if (code === 'zh' || code === 'ja') return 'reader-language-mark--single-cjk'
  if (code === 'ko') return 'reader-language-mark--single-hangul'
  return 'reader-language-mark--latin'
}

function ReaderTools({
  language,
  onLanguage,
  readingMode,
  themePosition = 0.5,
  motionMode,
  onReadingMode,
  onThemePosition,
  onMotionMode,
}) {
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
  const [motionHintVisible, setMotionHintVisible] = useState(false)
  const [motionStatusSwap, setMotionStatusSwap] = useState(null)
  const [motionTransition, setMotionTransition] = useState(null)
  const [draggingTheme, setDraggingTheme] = useState(false)
  const rootRef = useRef(null)
  const themeTrackRef = useRef(null)
  const themeThumbRef = useRef(null)
  const pointerFocusedRef = useRef(null)
  const lastInputMethodRef = useRef('pointer')
  const themePointerIdRef = useRef(null)
  const themeCaptureNodeRef = useRef(null)
  const themeDragGeometryRef = useRef(null)
  const lastThemePointerRef = useRef({ clientX: 0, clientY: 0 })
  const pointerRegionRef = useRef('none')
  const toolbarCloseTimerRef = useRef(null)
  const panelCloseTimersRef = useRef({ language: null, theme: null })
  const languageSwapActiveRef = useRef(false)
  const settledLanguageRef = useRef(language)
  const timersRef = useRef(new Set())
  const previousModeRef = useRef(readingMode)

  const schedule = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer)
      callback()
    }, delay)
    timersRef.current.add(timer)
    return timer
  }

  const clearScheduledRef = timerRef => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timersRef.current.delete(timerRef.current)
    timerRef.current = null
  }

  const cancelToolbarClose = () => clearScheduledRef(toolbarCloseTimerRef)

  const cancelPanelClose = panel => {
    const timer = panelCloseTimersRef.current[panel]
    if (timer === null) return
    window.clearTimeout(timer)
    timersRef.current.delete(timer)
    panelCloseTimersRef.current[panel] = null
  }

  const closeToolbarNow = () => {
    cancelToolbarClose()
    cancelPanelClose('language')
    cancelPanelClose('theme')
    setMenuOpen(false)
    setMobileOpen(false)
    setHoveredTool(null)
    setModeHintVisible(false)
    setMotionHintVisible(false)
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
      setExpandedPanels(current => (current[panel] ? { ...current, [panel]: false } : current))
    }, TOOLBAR_CLOSE_DELAY_MS)
  }

  const setActiveTool = tool => {
    cancelToolbarClose()
    cancelPanelClose('language')
    cancelPanelClose('theme')
    setMenuOpen(true)
    setHoveredTool(tool)
    if (tool === 'language') {
      setExpandedPanels({ language: true, theme: false })
    } else if (tool === 'reading' && readingMode === 'standard') {
      setExpandedPanels({ language: false, theme: true })
    } else {
      setExpandedPanels(CLOSED_PANELS)
    }
  }

  const regionFromNode = node => {
    if (!node || !rootRef.current?.contains(node)) return 'none'
    if (node.closest?.('.reader-menu-mark')) return 'mark'
    if (node.closest?.('.reader-language-group')) return 'language'
    if (node.closest?.('.reader-mode-group')) return 'reading'
    if (node.closest?.('.reader-motion-group')) return 'motion'
    return 'toolbar'
  }

  const reconcileToolbarState = () => {
    const region = pointerRegionRef.current
    if (region === 'language' || region === 'reading' || region === 'motion') {
      setActiveTool(region)
      return
    }
    if (region === 'mark' || region === 'toolbar' || rootRef.current?.contains(document.activeElement)) {
      cancelToolbarClose()
      setMenuOpen(true)
      return
    }
    closeToolbarNow()
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
    if (previousMode === readingMode) return
    setOutgoingMode(previousMode)
    setModeTransition(`${previousMode}-to-${readingMode}`)
    previousModeRef.current = readingMode
    schedule(() => {
      setOutgoingMode(null)
      setModeTransition(null)
    }, MODE_TRANSITION_MS)
  }, [readingMode])

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
    if (event.detail > 0) {
      lastInputMethodRef.current = 'pointer'
      pointerFocusedRef.current = event.currentTarget
    } else {
      lastInputMethodRef.current = 'keyboard'
    }
  }

  const scrambleToLanguage = target => {
    const mark = getLanguageMark(target.code)
    setScrambling(true)
    const glyphs = ['░', '▒', '/', '\\', '·', '#']
    let frame = 0
    const tick = () => {
      frame += 1
      if (frame < LANGUAGE_SCRAMBLE_FRAMES) {
        setDisplayMark(Array.from({ length: Math.max(2, mark.length) }, (_, index) => (
          index === frame % Math.max(1, mark.length)
            ? mark[index] ?? glyphs[(frame + index) % glyphs.length]
            : glyphs[(frame + index) % glyphs.length]
        )).join(''))
      } else {
        setDisplayMark(mark)
      }
      if (frame < LANGUAGE_SCRAMBLE_FRAMES) schedule(tick, LANGUAGE_SCRAMBLE_FRAME_MS)
      else {
        setScrambling(false)
      }
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
    setLanguageSwap({ slotIndex, phase: 'candidate-exit', previousCode: previous.code, nextCode: selected.code })
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
    onReadingMode()
    setClapping(false)
    setExpandedPanels(current => ({ ...current, theme: false }))
    schedule(releasePointerFocus, MODE_TRANSITION_MS)
  }

  const toggleMotion = event => {
    if (motionTransition) return
    rememberPointerFocus(event)
    const nextMode = motionMode === 'full' ? 'reduced' : 'full'
    const from = motionMode === 'full' ? '动态完整' : '动态减弱'
    const to = nextMode === 'full' ? '动态完整' : '动态减弱'
    setMotionStatusSwap({ from, to })
    setMotionTransition(nextMode === 'reduced' ? 'to-reduced' : 'to-full')
    if (nextMode === 'reduced') onThemePosition(nearestThemeNode(themePosition))
    onMotionMode()
    schedule(() => setMotionStatusSwap(null), 360)
    schedule(() => {
      setMotionTransition(null)
      releasePointerFocus()
    }, 520)
  }

  const handleModeHover = () => {
    if (readingMode !== 'immersive' || modeTransition || clapping) return
    setClapping(true)
    schedule(() => setClapping(false), 780)
  }

  const readThemeDragGeometry = () => {
    const trackRect = themeTrackRef.current?.getBoundingClientRect()
    const thumbRect = themeThumbRef.current?.getBoundingClientRect()
    if (!trackRect?.width || !thumbRect?.width) return null
    return { trackRect, thumbSize: thumbRect.width }
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
    if (pointerRegionRef.current === 'reading') setActiveTool('reading')
    else if (pointerRegionRef.current === 'language' || pointerRegionRef.current === 'motion') setActiveTool(pointerRegionRef.current)
    else if (pointerRegionRef.current === 'none') scheduleToolbarClose()
    else schedulePanelClose('theme')
  }

  const handleThemePointerDown = event => {
    const geometry = readThemeDragGeometry()
    if (!geometry) return
    event.preventDefault()
    themePointerIdRef.current = event.pointerId
    themeCaptureNodeRef.current = event.currentTarget
    themeDragGeometryRef.current = geometry
    lastThemePointerRef.current = { clientX: event.clientX, clientY: event.clientY }
    lastInputMethodRef.current = 'pointer'
    pointerFocusedRef.current = event.currentTarget
    pointerRegionRef.current = 'reading'
    cancelToolbarClose()
    cancelPanelClose('theme')
    setMenuOpen(true)
    setExpandedPanels(current => ({ ...current, language: false, theme: true }))
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

  const handleThemePointerEnd = event => {
    if (themePointerIdRef.current !== event.pointerId) return
    lastThemePointerRef.current = { clientX: event.clientX, clientY: event.clientY }
    commitThemePointer(event.clientX)
    themePointerIdRef.current = null
    try { event.currentTarget.releasePointerCapture?.(event.pointerId) } catch { /* capture already lost */ }
    themeCaptureNodeRef.current = null
    themeDragGeometryRef.current = null
    setDraggingTheme(false)
    reconcileAfterThemePointer(event.clientX, event.clientY)
  }

  const handleThemeLostPointerCapture = event => {
    if (themePointerIdRef.current !== event.pointerId) return
    themePointerIdRef.current = null
    themeCaptureNodeRef.current = null
    themeDragGeometryRef.current = null
    setDraggingTheme(false)
    reconcileAfterThemePointer(lastThemePointerRef.current.clientX, lastThemePointerRef.current.clientY)
  }

  const stepTheme = direction => {
    const currentIndex = THEME_NODES.indexOf(nearestThemeNode(themePosition))
    const nextIndex = Math.min(THEME_NODES.length - 1, Math.max(0, currentIndex + direction))
    onThemePosition(THEME_NODES[nextIndex])
  }

  const handleThemeWheel = event => {
    event.preventDefault()
    event.stopPropagation()
    onThemePosition(themePositionForWheel(themePosition, event.deltaY, motionMode, FULL_WHEEL_STEP))
  }

  const handleThemeKeyDown = event => {
    lastInputMethodRef.current = 'keyboard'
    let next = null
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = 1
    if (motionMode === 'reduced' && ['ArrowRight', 'ArrowDown'].includes(event.key)) stepTheme(1)
    if (motionMode === 'reduced' && ['ArrowLeft', 'ArrowUp'].includes(event.key)) stepTheme(-1)
    if (next !== null) onThemePosition(next)
    if (next !== null || (motionMode === 'reduced' && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key))) event.preventDefault()
  }

  const languageOpen = expandedPanels.language || languageSwap !== null
  const modeLabel = readingMode === 'immersive' ? '沉浸叙事' : '普通阅读'
  const motionLabel = motionMode === 'full' ? '动态完整' : '动态减弱'
  const activeThemeNode = nearestThemeNode(themePosition)
  const activeThemeName = themeName(themePosition)
  const themePillOpen = expandedPanels.theme || mobileOpen
  const toolbarOpen = menuOpen || mobileOpen || draggingTheme || languageSwap !== null

  return (
    <div
      ref={rootRef}
      className={`reader-corner-menu${toolbarOpen ? ' is-open' : ''}${draggingTheme ? ' is-dragging' : ''}`}
      data-hovered-tool={hoveredTool || 'none'}
      onPointerEnter={() => {
        if (toolbarOpen) cancelToolbarClose()
      }}
      onPointerLeave={() => {
        if (themePointerIdRef.current !== null) return
        pointerRegionRef.current = 'none'
        scheduleToolbarClose()
      }}
      onFocusCapture={() => {
        cancelToolbarClose()
        setMenuOpen(true)
      }}
      onPointerDownCapture={() => { lastInputMethodRef.current = 'pointer' }}
      onKeyDownCapture={() => { lastInputMethodRef.current = 'keyboard' }}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) scheduleToolbarClose()
      }}
    >
      <button
        className="reader-menu-mark"
        type="button"
        aria-label="阅读设置"
        aria-expanded={toolbarOpen}
        onPointerEnter={() => {
          pointerRegionRef.current = 'mark'
          cancelToolbarClose()
          if (!isMobileInteraction()) setMenuOpen(true)
        }}
        onPointerLeave={() => {
          pointerRegionRef.current = 'none'
          scheduleToolbarClose()
        }}
        onFocus={() => {
          cancelToolbarClose()
          setMenuOpen(true)
        }}
        onClick={() => {
          if (isMobileInteraction()) {
            setMobileOpen(current => {
              const next = !current
              if (!next) setMenuOpen(false)
              return next
            })
          } else setMenuOpen(true)
        }}
      >
        <span />
        <span />
      </button>

      <div
        className="reader-corner-stack"
        role="menu"
        aria-label="阅读设置"
        onPointerEnter={() => {
          pointerRegionRef.current = 'toolbar'
          cancelToolbarClose()
        }}
        onPointerMove={event => {
          if (event.target !== event.currentTarget) return
          pointerRegionRef.current = 'toolbar'
          cancelToolbarClose()
        }}
        onPointerLeave={() => {
          pointerRegionRef.current = 'none'
          scheduleToolbarClose()
        }}
      >
        <div
          className={`reader-tool-group reader-language-group${languageOpen ? ' is-submenu-open' : ''}`}
          onPointerEnter={() => {
            pointerRegionRef.current = 'language'
            if (!isMobileInteraction()) setActiveTool('language')
          }}
          onPointerLeave={event => {
            pointerRegionRef.current = regionFromNode(event.relatedTarget)
            schedulePanelClose('language')
            if (pointerRegionRef.current === 'toolbar') cancelToolbarClose()
            else scheduleToolbarClose()
          }}
          onFocus={() => setActiveTool('language')}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              schedulePanelClose('language')
            }
          }}
        >
          <div className="reader-language-anchor" data-language-tools-revision="horizontal-v1">
            <button
              className={`reader-corner-item reader-language-tool${scrambling ? ' is-scrambling' : ''}`}
              type="button"
              role="menuitem"
              aria-label={`语言：${getReaderLanguage(language).label}`}
              aria-expanded={languageOpen}
              onClick={() => {
                if (isMobileInteraction()) {
                  setExpandedPanels(current => ({ ...current, language: !current.language }))
                }
              }}
            >
              <span className={`reader-language-mark ${languageMarkClass(language)}`}>{displayMark}</span>
            </button>
            <div
              className={`reader-language-track${languageOpen ? ' is-open' : ''}`}
              role="menu"
              aria-label="选择语言"
              aria-hidden={!languageOpen}
            >
              {languageSlots.map((item, index) => {
                const swapPhase = languageSwap?.slotIndex === index ? languageSwap.phase : ''
                const staggerMs = languageOpen
                  ? (languageSlots.length - 1 - index) * LANGUAGE_TRACK_EXPAND_STAGGER_MS
                  : index * LANGUAGE_TRACK_COLLAPSE_STAGGER_MS
                return (
                  <button
                    key={`language-slot-${index}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={false}
                    className={`reader-language-slot${swapPhase ? ` is-${swapPhase}` : ''}`}
                    style={{ transitionDelay: `${staggerMs}ms` }}
                    aria-label={`切换到 ${item.label}`}
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
              if (pointerRegionRef.current === 'toolbar') cancelToolbarClose()
              else scheduleToolbarClose()
            }
          }}
          onFocus={() => {
            setModeHintVisible(true)
            setActiveTool('reading')
          }}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setModeHintVisible(false)
              if (themePointerIdRef.current === null) {
                schedulePanelClose('theme')
              }
            }
          }}
        >
          <div className="reader-tool-row">
            {readingMode === 'immersive' && (
              <span className={`reader-tool-status reader-mode-status${modeHintVisible ? ' is-visible' : ''}`} role="status">{modeLabel}</span>
            )}
            <div className="reader-mode-anchor">
              <button
                className={`reader-corner-item reader-mode-tool reader-mode-tool--${readingMode}${modeTransition ? ` is-switching is-${modeTransition}` : ''}${clapping ? ' is-clapping' : ''}`}
                type="button"
                role="menuitem"
                onMouseEnter={handleModeHover}
                onClick={toggleMode}
                aria-label={modeLabel}
              >
                <span className="reader-mode-icon-layer reader-mode-icon-layer--incoming"><ReadingModeIcon mode={readingMode} /></span>
                {outgoingMode && <span className="reader-mode-icon-layer reader-mode-icon-layer--outgoing"><ReadingModeIcon mode={outgoingMode} /></span>}
              </button>
              {readingMode === 'standard' && (
                <div className={`reader-theme-dock${themePillOpen ? ' is-open' : ''}`} aria-hidden={!themePillOpen}>
                  {activeThemeName && (
                    <span
                      key={activeThemeNode}
                      className="reader-theme-name"
                      style={{ '--theme-node': activeThemeNode }}
                      aria-hidden="true"
                    >{activeThemeName}</span>
                  )}
                  <div
                    className={`reader-theme-pill reader-theme-pill--${motionMode}${draggingTheme ? ' is-dragging' : ''}`}
                    role="slider"
                    tabIndex={0}
                    aria-label="普通阅读主题"
                    aria-valuemin="0"
                    aria-valuemax="1"
                    aria-valuenow={themePosition}
                    aria-valuetext={activeThemeName || `主题 ${Math.round(themePosition * 100)}%`}
                    onPointerDown={handleThemePointerDown}
                    onPointerMove={handleThemePointerMove}
                    onPointerUp={handleThemePointerEnd}
                    onPointerCancel={handleThemePointerEnd}
                    onLostPointerCapture={handleThemeLostPointerCapture}
                    onWheel={handleThemeWheel}
                    onKeyDown={handleThemeKeyDown}
                  >
                    <span className="reader-theme-pill-text" aria-hidden="true">普通阅读</span>
                    <span ref={themeTrackRef} className="reader-theme-track-geometry" aria-hidden="true" />
                    <span ref={themeThumbRef} className="reader-theme-thumb" style={{ '--theme-position': clampThemePosition(themePosition) }} aria-hidden="true" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="reader-tool-group reader-motion-group"
          onPointerEnter={() => {
            pointerRegionRef.current = 'motion'
            setMotionHintVisible(true)
            if (!isMobileInteraction()) setActiveTool('motion')
          }}
          onPointerLeave={event => {
            pointerRegionRef.current = regionFromNode(event.relatedTarget)
            setMotionHintVisible(false)
            if (pointerRegionRef.current === 'toolbar') cancelToolbarClose()
            else scheduleToolbarClose()
          }}
        >
          <div className="reader-tool-row reader-motion-row">
            <span className={`reader-tool-status reader-motion-status${motionHintVisible ? ' is-visible' : ''}`} role="status">
              {motionStatusSwap ? (
                <span className="reader-motion-status-swap">
                  <span className="reader-motion-status-old">{motionStatusSwap.from}</span>
                  <span className="reader-motion-status-new">{motionStatusSwap.to}</span>
                </span>
              ) : motionLabel}
            </span>
            <button
              className={`reader-corner-item reader-motion-tool${motionMode === 'reduced' ? ' is-reduced' : ''}${motionTransition ? ` is-${motionTransition}` : ''}`}
              type="button"
              role="menuitem"
              onFocus={() => {
                setMotionHintVisible(true)
                setActiveTool('motion')
              }}
              onBlur={() => {
                setMotionHintVisible(false)
              }}
              onClick={toggleMotion}
              aria-label={motionLabel}
            >
              <MotionIcon reduced={motionMode === 'reduced'} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReaderTools
