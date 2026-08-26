import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReaderStatusBar from '../src/components/reader/ReaderStatusBar'

const state = {
  worldLayer: 'surface',
  locationId: 'ancestral-home-courtyard',
  locationLabels: { zh: '祖宅院落', en: 'Ancestral Courtyard' },
  time: 'morning',
  weather: 'clear',
}

describe('ReaderStatusBar', () => {
  it('shows the current world, location, time, and weather without reading progress', () => {
    const html = renderToStaticMarkup(createElement(ReaderStatusBar, { language: 'zh', state }))
    expect(html).toContain('表世界')
    expect(html).toContain('祖宅院落')
    expect(html).toContain('上午')
    expect(html).toContain('晴')
    expect(html).not.toContain('阅读进度')
    expect(html).not.toContain('%')
  })

  it('uses the matching English environment labels', () => {
    const html = renderToStaticMarkup(createElement(ReaderStatusBar, { language: 'en', state }))
    expect(html).toContain('Surface World')
    expect(html).toContain('Courtyard')
    expect(html).toContain('Morning')
    expect(html).toContain('Clear')
  })

  it('keeps the status bar mounted but hidden when the reader has no document', () => {
    const html = renderToStaticMarkup(createElement(ReaderStatusBar, { language: 'zh', state, visible: false }))
    expect(html).toContain('data-reader-status-visible="false"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('is-hidden')
  })
})
