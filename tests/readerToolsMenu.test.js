import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReaderTools from '../src/components/reader/ReaderTools'
import { getReaderScenePaths } from '../src/components/reader/ReaderSceneGlyph'
import { READER_LANGUAGES } from '../src/i18n/languages'
import { themeName } from '../src/reader/readerTheme'

const readerStageCss = readFileSync(new URL('../src/views/ReaderStage.css', import.meta.url), 'utf8')
const readerContractCss = readFileSync(new URL('../src/views/ReaderShellContract.css', import.meta.url), 'utf8')
const readerToolsSource = readFileSync(new URL('../src/components/reader/ReaderTools.jsx', import.meta.url), 'utf8')
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
  locationId: 'inner-street',
  ...props,
}))

describe('Reader shell menu contract', () => {
  it('contains only Language and Reading mode as the two primary groups', () => {
    const html = markup()
    expect(html).toContain('data-menu-items="language reading-mode"')
    expect(html.indexOf('reader-language-group')).toBeLessThan(html.indexOf('reader-mode-group'))
    expect(html).not.toContain('reader-motion-group')
    expect(html).not.toContain('动态完整')
    expect(html).not.toContain('动态减弱')
  })

  it('exposes only Chinese and English in both languages', () => {
    expect(READER_LANGUAGES.map(item => item.code)).toEqual(['zh', 'en'])
    const chinese = markup()
    expect(chinese.match(/menuitemradio/g)).toHaveLength(1)
    expect(chinese).toContain('aria-label="语言：中文"')
    expect(chinese).toContain('reader-language-slot-label">English</span>')
    expect(chinese).not.toContain('日本語')
    expect(chinese).not.toContain('한국어')
    expect(chinese).not.toContain('Français')

    const english = markup({ language: 'en' })
    expect(english).toContain('aria-label="Language: English"')
    expect(english).toContain('reader-language-slot-label">中文</span>')
    expect(english).toContain('aria-label="Choose a language"')
    expect(english).toContain('aria-label="Switch to 中文"')
  })

  it('keeps the original theme pill with exact Bright, Soft, and Night anchors', () => {
    expect(themeName(0)).toBe('明亮')
    expect(themeName(0.5)).toBe('柔和')
    expect(themeName(1)).toBe('夜间')
    expect(themeName(0.37)).toBe('')
    const standard = markup({ readingMode: 'standard', themePosition: 0.5 })
    expect(standard).toContain('reader-theme-pill')
    expect(standard).toContain('role="slider"')
    expect(standard).toContain('aria-valuenow="0.5"')
    expect(standard).toContain('reader-theme-name')
    expect(standard).not.toContain('reader-standard-themes')

    const english = markup({ language: 'en', readingMode: 'standard', themePosition: 0.5 })
    expect(english).toContain('reader-theme-name')
    expect(english).toContain('>Warm</span>')
    expect(english).toContain('aria-label="Reading theme"')
    expect(english).toContain('>Classic</span>')
    expect(english).not.toContain('>柔和</span>')

    const immersive = markup({ readingMode: 'immersive' })
    expect(immersive).not.toContain('role="slider"')
  })

  it('translates reading-mode labels when English is active', () => {
    expect(markup({ language: 'en', readingMode: 'immersive' })).toContain('aria-label="Immersive"')
    expect(markup({ language: 'en', readingMode: 'standard' })).toContain('aria-label="Classic"')
    expect(markup({ language: 'zh', readingMode: 'immersive' })).toContain('aria-label="沉浸叙事"')
  })

  it('uses fixed double bars for Standard and the exact location SVG for Immersive', () => {
    const standard = markup({ readingMode: 'standard', locationLabel: '里世界商业街' })
    expect(standard).toContain('reader-menu-bars')
    expect(standard).toContain('reader-scene-menu-label')
    expect(standard).toContain('里世界商业街')
    expect(standard).not.toContain('reader-menu-scene-layers')
    const immersive = markup({ readingMode: 'immersive', locationId: 'inner-street' })
    expect(immersive).toContain('data-scene-svg="inner-street"')
    expect(immersive).toContain('<rect')
    expect(immersive).toContain('shape-rendering="crispEdges"')
    expect(immersive).toContain('reader-scene-menu-label')
    expect(immersive).not.toContain('reader-menu-bars')
    const renderedCells = [...immersive.matchAll(/<rect[^>]*width="([^"]+)"[^>]*height="([^"]+)"/g)]
    expect(renderedCells.length).toBeGreaterThan(8)
    expect(new Set(renderedCells.map(match => `${match[1]}:${match[2]}`))).toEqual(new Set(['1.45:1.45']))
  })

  it('does not merge stable scene IDs or ancestral sublocations into one SVG', () => {
    expect(getReaderScenePaths('inner-street')).not.toEqual(getReaderScenePaths('inner-commercial-street'))
    expect(getReaderScenePaths('ancestral-home-courtyard')).not.toEqual(getReaderScenePaths('ancestral-home-hall'))
    expect(markup({ readingMode: 'immersive', locationId: 'inner-commercial-street' }))
      .toContain('data-scene-svg="inner-commercial-street"')
  })

  it('restores the narrow transparent bridges and gap-safe toolbar', () => {
    const source = ReaderTools.toString()
    expect(source).toContain('TOOLBAR_CLOSE_DELAY_MS')
    expect(source).toContain('pointerRegionRef')
    expect(source).toContain('scheduleToolbarClose')
    expect(source).toContain('themePointerIdRef')
    expect(readerStageCss).toContain('.reader-corner-stack::before')
    expect(readerStageCss).toContain('.reader-theme-dock::after')
  })

  it('recomputes the open reading-mode menu immediately and keeps centered bars fixed-width', () => {
    expect(readerToolsSource).toContain("const nextMode = readingMode === 'immersive' ? 'standard' : 'immersive'")
    expect(readerToolsSource).toContain("pointerRegionRef.current = 'reading'")
    expect(readerToolsSource).toContain("nextMode === 'standard'")
    expect(readerToolsSource).toContain('{ language: false, theme: true }')
    expect(readerToolsSource).toContain("const standardControlsPresent = readingMode === 'standard'")
    expect(readerToolsSource).toContain('reader-menu-trigger-layer--outgoing')
    expect(readerContractCss).toContain('reader-contract-mode-group-out 480ms')
    expect(readerContractCss).toContain('reader-contract-mode-group-in 760ms 640ms')
    expect(readerContractCss).toContain('.reader-mode-tool.is-switching .reader-mode-icon-layer--outgoing')
    expect(readerContractCss).toContain('.reader-mode-tool.is-switching .reader-mode-icon-layer--incoming')
    expect(readerContractCss).toContain('left:50%')
    expect(readerContractCss).toContain('transform:translateX(-50%) rotate(-.7deg)')
    expect(readerContractCss).toContain('top:2px; width:18px')
    expect(readerContractCss).toContain('top:15px; width:26px')
    expect(readerContractCss).not.toContain('top:2px; width:24px')
    expect(readerContractCss).not.toContain('top:15px; width:30px')
    expect(readerContractCss).toContain('box-shadow:none')
    expect(readerContractCss).toContain('.reader-menu-mark > .reader-menu-trigger-layer')
    expect(readerContractCss).toContain('background:transparent')
    expect(readerStageCss).toContain('.reader-menu-mark .reader-menu-bars > i')
    expect(readerStageCss).not.toContain('.reader-menu-mark span {')
    expect(readerContractCss).toContain('.reader-theme-dock.is-open')
    expect(readerContractCss).toContain('transition:visibility 0s linear 520ms')
    expect(readerContractCss).toContain('.reader-theme-dock .reader-theme-pill')
    expect(readerContractCss).toContain('transform:translateX(18px) scaleX(.08)')
    expect(readerContractCss).toContain('transform:translateX(0) scaleX(1)')
    expect(readerContractCss).toContain('opacity 160ms 180ms ease')
    expect(readerContractCss).toContain('.reader-theme-dock .reader-theme-name')
    expect(readerContractCss).toContain('transition:opacity 180ms 360ms ease')
    expect(readerContractCss).toContain('animation:none')
    expect(readerContractCss).toContain('.reader-theme-dock.is-mode-entering .reader-theme-pill')
    expect(readerContractCss).toContain('reader-contract-theme-pill-enter 360ms 640ms')
    expect(readerContractCss).toContain('.reader-theme-dock.is-mode-entering .reader-theme-name')
    expect(readerContractCss).toContain('reader-contract-theme-name-enter 180ms 1000ms')
    expect(readerContractCss).toContain('.reader-corner-menu.is-standard-to-immersive .reader-mode-status')
    expect(readerContractCss.match(/reader-contract-mode-group-in 760ms 640ms/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('releases theme-slider focus before hiding its aria-hidden dock', () => {
    expect(readerToolsSource).toContain('const releaseThemeFocus = (restoreToMode = false) =>')
    expect(readerToolsSource).toContain('themeDockRef.current?.contains(activeElement)')
    expect(readerToolsSource).toContain("if (nextMode === 'immersive') releaseThemeFocus(true)")
    expect(readerToolsSource).toContain("tabIndex={readingMode === 'standard' && themePillOpen ? 0 : -1}")
  })

  it('guards non-Node pointer exits and avoids preventDefault in the wheel handler', () => {
    expect(readerToolsSource).toContain('if (!(node instanceof Node)')
    const wheelHandler = readerToolsSource.match(/const handleThemeWheel = event => \{([\s\S]*?)\n  \}/)?.[1] ?? ''
    expect(wheelHandler).toContain('event.stopPropagation()')
    expect(wheelHandler).not.toContain('event.preventDefault()')
  })
})
