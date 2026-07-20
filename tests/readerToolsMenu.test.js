import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReaderTools from '../src/components/reader/ReaderTools'

const readerStageCss = readFileSync(new URL('../src/views/ReaderStage.css', import.meta.url), 'utf8')

const noop = () => {}
const markup = props => renderToStaticMarkup(createElement(ReaderTools, {
  language: 'zh',
  onLanguage: noop,
  readingMode: 'standard',
  standardTheme: 'soft',
  themePosition: 0.5,
  motionMode: 'full',
  onReadingMode: noop,
  onStandardTheme: noop,
  onThemePosition: noop,
  onMotionMode: noop,
  ...props,
}))

describe('corner menu structure', () => {
  it('orders language, mode, and motion groups top-down', () => {
    const html = markup()
    const language = html.indexOf('reader-language-group')
    const mode = html.indexOf('reader-mode-group')
    const motion = html.indexOf('reader-motion-group')
    expect(language).toBeGreaterThan(-1)
    expect(mode).toBeGreaterThan(language)
    expect(motion).toBeGreaterThan(mode)
  })

  it('keeps the horizontal candidate track anchored beside the language entry', () => {
    const html = markup()
    const track = html.indexOf('reader-language-track')
    expect(html).toContain('data-language-tools-revision="horizontal-v1"')
    expect(track).toBeGreaterThan(html.indexOf('reader-language-tool'))
    expect(track).toBeLessThan(html.indexOf('reader-mode-group'))
    expect(html).not.toContain('reader-submenu-inner reader-language-options')
    expect(html.match(/menuitemradio/g)).toHaveLength(4)
    expect(html).toContain('aria-hidden="true"')
  })

  it('shows a short mark on the entry and full native names in the slots', () => {
    const html = markup()
    expect(html).toContain('>中</span>')
    expect(html).toContain('reader-language-mark--single-cjk')
    expect(html).not.toContain('>ZH<')
    expect(html).toContain('reader-language-slot-label">English</span>')
    expect(html).toContain('reader-language-slot-label">日本語</span>')
    expect(html).toContain('reader-language-slot-label">한국어</span>')
    expect(html).toContain('reader-language-slot-label">Français</span>')
    expect(html).not.toContain('reader-language-slot-label">EN</span>')
    expect(html).not.toContain('reader-language-slot-label">日</span>')
  })

  it('excludes the active language without changing the five-language source order', () => {
    const english = markup({ language: 'en' })
    expect(english.match(/menuitemradio/g)).toHaveLength(4)
    expect(english).toContain('>EN</span>')
    expect(english).toContain('reader-language-mark--latin')
    expect(english).not.toContain('reader-language-slot-label">English</span>')
    expect(english).toContain('reader-language-slot-label">中文</span>')

    const japanese = markup({ language: 'ja' })
    expect(japanese).toContain('reader-language-mark--single-cjk')
    expect(japanese).not.toContain('reader-language-slot-label">日本語</span>')
    expect(japanese).toContain('reader-language-slot-label">中文</span>')
    expect(japanese).toContain('reader-language-slot-label">English</span>')
  })

  it('keeps language exchange in stable index-keyed slots without geometry', () => {
    const source = ReaderTools.toString()
    expect(source).toContain('`language-slot-${index}`')
    expect(source).toContain('phase: "candidate-exit"')
    expect(source).toContain('phase: "current-glitch"')
    expect(source).toContain('phase: "old-language-enter"')
    expect(source).toContain('setLanguageSlots')
    expect(source).toContain('current.map')
    expect(source).not.toContain('anchorRect')
    expect(source).not.toContain('sourceRect')
    expect(source.indexOf('LANGUAGE_SCRAMBLE_START_MS')).toBeLessThan(source.indexOf('LANGUAGE_SWAP_MS'))
    expect(source.indexOf('LANGUAGE_SWAP_MS')).toBeLessThan(source.indexOf('LANGUAGE_COMPLETE_MS'))
  })

  it('keeps language fade, scramble, pause, and return phases sequential', () => {
    const source = ReaderTools.toString()
    expect(source).toContain('LANGUAGE_SCRAMBLE_START_MS')
    expect(source).toContain('LANGUAGE_SCRAMBLE_FRAMES')
    expect(source).toContain('LANGUAGE_SWAP_MS')
    expect(source).toContain('LANGUAGE_COMPLETE_MS')
    expect(source).toContain('phase: "candidate-exit"')
    expect(source).toContain('phase: "old-language-enter"')
  })

  it('keeps expanded panel occupancy until the pointer leaves the whole toolbar', () => {
    const source = ReaderTools.toString()
    expect(source).toContain('menuOpen')
    expect(source).toContain('hoveredTool')
    expect(source).toContain('setActiveTool("language")')
    expect(source).toContain('setActiveTool("reading")')
    expect(source).toContain('setActiveTool("motion")')
    expect(source).toContain('expandedPanels')
    expect(source).toContain('setExpandedPanels(CLOSED_PANELS)')
    expect(source).toContain('scheduleToolbarClose')
    expect(source).toContain('cancelToolbarClose')
    expect(source).toContain('schedulePanelClose')
    expect(source).toContain('pointerRegionRef')
    expect(source).toContain('languageSwapActiveRef')
    expect(source).toContain('document.elementFromPoint')
    expect(source).not.toContain("matches(':hover')")
  })

  it('uses a narrow cancellable close delay instead of a blank hover trigger', () => {
    const source = ReaderTools.toString()
    expect(source).toContain('TOOLBAR_CLOSE_DELAY_MS')
    expect(source).toContain('shouldKeepToolbarOpen')
    expect(source).toMatch(/pointerRegionRef\.current !== ["']none["']/)
    expect(source).toContain('rootRef.current?.contains(document.activeElement)')
    expect(source).toContain('themePointerIdRef.current !== null')
  })

  it('shows only the active theme label above its anchor', () => {
    const soft = markup({ themePosition: 0.5 })
    expect(soft.match(/reader-theme-name/g)).toHaveLength(1)
    expect(soft).toContain('--theme-node:0.5" aria-hidden="true">柔和</span>')
    expect(soft).not.toContain('明亮')
    expect(soft).not.toContain('夜间')

    const light = markup({ themePosition: 0 })
    expect(light.match(/reader-theme-name/g)).toHaveLength(1)
    expect(light).toContain('--theme-node:0" aria-hidden="true">明亮</span>')

    const dark = markup({ themePosition: 1 })
    expect(dark.match(/reader-theme-name/g)).toHaveLength(1)
    expect(dark).toContain('--theme-node:1" aria-hidden="true">夜间</span>')

    const between = markup({ themePosition: 0.37 })
    expect(between).not.toContain('reader-theme-name')
    expect(between).not.toContain('明亮')
    expect(between).not.toContain('柔和')
    expect(between).not.toContain('夜间')
  })

  it('uses thumb-safe pointer capture and a unified full/reduced wheel entry', () => {
    const source = ReaderTools.toString()
    expect(source).toContain('themeTrackRef')
    expect(source).toContain('themeThumbRef')
    expect(source).toContain('setPointerCapture')
    expect(source).toContain('releasePointerCapture')
    expect(source).toContain('themePointerIdRef.current !== event.pointerId')
    expect(source).toContain('themePositionFromPointer')
    expect(source).toContain('themePositionForWheel')
    expect(source).toContain('magnetizeThemePosition')
    expect(source).toContain('onLostPointerCapture')
    expect(source).toContain('event.preventDefault()')
    expect(source).toContain('event.stopPropagation()')
  })

  it('does not use a shared selection flight or selected-option overlay', () => {
    const source = ReaderTools.toString()
    expect(source).not.toContain('selectionFlight')
    expect(source).not.toContain('beginSelectionFlight')
    expect(source).not.toContain('selectedTheme')
    expect(source).not.toContain('--selection-shift')
  })

  it('anchors the horizontal theme pill beside the reading button in standard mode', () => {
    const html = markup({ readingMode: 'standard' })
    const dock = html.indexOf('reader-theme-dock')
    expect(dock).toBeGreaterThan(html.indexOf('reader-mode-tool'))
    expect(dock).toBeLessThan(html.indexOf('reader-motion-group'))
    expect(html).toContain('reader-theme-pill-text')
    expect(html).toContain('>普通阅读</span>')
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-valuenow="0.5"')
    expect(html).not.toContain('reader-theme-pill-shell')
    expect(html).not.toContain('reader-theme-tick')
  })

  it('scopes status text: pill text for standard, hover hint for immersive', () => {
    const standard = markup({ readingMode: 'standard', motionMode: 'full' })
    expect(standard).toContain('reader-theme-pill-text')
    expect(standard).toContain('>普通阅读</span>')
    expect(standard).not.toContain('reader-mode-status')
    expect(standard).toContain('reader-motion-status')
    expect(standard).toContain('动态完整')

    const immersive = markup({ readingMode: 'immersive' })
    expect(immersive).toContain('reader-mode-status')
    expect(immersive).toContain('沉浸叙事')
  })

  it('shows immersive status without any theme list in immersive mode', () => {
    const html = markup({ readingMode: 'immersive' })
    expect(html).toContain('沉浸叙事')
    expect(html).not.toContain('reader-theme-pill')
  })

  it('labels reduced motion state', () => {
    expect(markup({ motionMode: 'reduced' })).toContain('动态减弱')
  })

  it('keeps the tool axis shared and the theme handle visually transparent', () => {
    expect(readerStageCss).toContain('--reader-tool-size:')
    expect(readerStageCss).toContain('width: var(--reader-tool-size)')
    expect(readerStageCss).toContain('.reader-language-mark--single-cjk')
    expect(readerStageCss).toContain('.reader-language-mark--single-hangul')
    expect(readerStageCss).toContain('.reader-language-mark--latin')
    expect(readerStageCss).toMatch(/\.reader-theme-pill \{[\s\S]*?width: clamp\(144px, 8vw, 160px\);[\s\S]*?height: clamp\(34px, 2vw, 35px\);[\s\S]*?border: 0;[\s\S]*?background: transparent;/)
    expect(readerStageCss).toMatch(/\.reader-theme-pill::before \{[\s\S]*?inset: 4px 0;[\s\S]*?border: 1px solid var\(--reader-border, currentColor\);/)
    expect(readerStageCss).toMatch(/\.reader-theme-thumb \{[\s\S]*?border: 1px solid currentColor;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;[\s\S]*?pointer-events: none;/)
    expect(readerStageCss).not.toContain('.reader-theme-tick')
  })
})
