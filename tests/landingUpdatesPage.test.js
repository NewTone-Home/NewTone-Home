import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/components/LandingUpdatesPage.jsx')
const styles = read('../src/components/LandingUpdatesPage.css')
const entryStyles = read('../src/views/LandingUpdatesEntry.css')
const entrySurface = read('../src/components/EntrySurface.jsx')
const audit = read('../src/services/runtimeAudit.js')

describe('Landing updates page button contract', () => {
  it('uses the shared button and waits for the page phase before showing it', () => {
    expect(page).toContain("import EntryButtonSurface from './EntryButtonSurface'")
    expect(page).toContain('const interactive = phase === UPDATES_PHASE.UPDATES')
    expect(page).toContain('visible={interactive}')
    expect(page).toContain('entryId="landing-updates-return"')
    expect(page).toContain('materialMode="background"')
    expect(page).toContain('onActionComplete={handleReturnComplete}')
    expect(page).not.toContain('useReducer')
    expect(page).not.toContain('LandingUpdatesReturnEntry')
    expect(page).not.toContain('LandingEntryArrow')
  })

  it('has no global wheel, touch, or pointer gesture route', () => {
    expect(page).not.toContain('addEventListener')
    expect(page).not.toContain('onPointerLeave')
    expect(page).not.toContain('resolveUpdatesWheelIntent')
    expect(page).not.toContain('resolveUpdatesTouchIntent')
    expect(styles).not.toContain('data-return-state')
    expect(styles).not.toContain('landing-updates-page__return-backdrop')
  })

  it('records one return intent only after the shared exit completes', () => {
    expect(page).toContain('returnIssuedRef.current')
    expect(page).toContain("recordRuntimeAudit('updates-return-intent'")
    expect(page).toContain('onReturnRequested?.()')
    expect(styles).toContain('left: clamp(1.25rem, 8vw, 8rem)')
    expect(styles).toContain('bottom: clamp(1.25rem, 6vh, 3.5rem)')
    expect(audit).toContain('window.NT_AUDIT')
  })

  it('renders the selected announcement layout and copy', () => {
    expect(page).toContain('landing-updates-page__timeline')
    expect(page).toContain('landing-updates-page__timeline-trigger')
    expect(page).toContain('aria-expanded={expanded}')
    expect(page).toContain('setExpanded(current => !current)')
    expect(page).toContain('landing-updates-page__summary')
    expect(page).toContain('landing-updates-page__details')
    expect(page).not.toContain('landing-updates-page__placeholder')
    expect(page).not.toContain('<h1>')
    expect(page).toContain('本次更新没有加入新的宇宙，也没有打开什么神秘入口。')
    expect(page).toContain('改善了多个设备运行表现')
    expect(page).toContain('No new universe this time. No secret doorway, either.')
    expect(page).toContain('We also improved performance across a wider range of devices.')
    expect(entrySurface).toContain('language={language}')
  })

  it('keeps the Landing and updates surface transitions on one timing contract', () => {
    expect(styles).toContain('animation: updates-page-enter 720ms')
    expect(styles).toContain('animation: updates-page-return 720ms')
    expect(entryStyles).toContain('animation: landing-updates-surface-exit 720ms')
    expect(entryStyles).toContain('animation: landing-updates-surface-return 720ms')
    expect(styles).not.toContain('120ms forwards')
  })
})
