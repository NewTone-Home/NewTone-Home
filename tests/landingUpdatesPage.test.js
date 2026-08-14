import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/components/LandingUpdatesPage.jsx')
const styles = read('../src/components/LandingUpdatesPage.css')
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
    expect(styles).toContain('left: var(--space-md, 1.5rem)')
    expect(styles).toContain('bottom: var(--space-md, 1.5rem)')
    expect(audit).toContain('window.NT_AUDIT')
  })
})
