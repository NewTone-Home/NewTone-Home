import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/components/LandingUpdatesPage.jsx')
const styles = read('../src/components/LandingUpdatesPage.css')
const scramble = read('../src/components/ScrambleText.jsx')

describe('Landing updates return entry', () => {
  it('uses the Landing paper and exposes a local desktop return state machine', () => {
    expect(styles).toContain('background: var(--reader-paper, var(--paper-base));')
    expect(page).toContain('data-return-state={returnEntryPhase}')
    expect(page).toContain('className="landing-updates-page__return-backdrop"')
    expect(page).toContain('className="landing-updates-return-trigger"')
    expect(page).toContain('onPointerLeave={handleReturnPointerLeave}')
  })

  it('proves the strict text, arrow, ring order in source', () => {
    const textToArrow = page.indexOf("transitionReturnEntry(RETURN_ENTRY_PHASE.ARROW)")
    const arrowToRing = page.indexOf("transitionReturnEntry(RETURN_ENTRY_PHASE.RING)")
    const ringToReady = page.indexOf("transitionReturnEntry(RETURN_ENTRY_PHASE.READY)")

    expect(textToArrow).toBeGreaterThan(-1)
    expect(arrowToRing).toBeGreaterThan(textToArrow)
    expect(ringToReady).toBeGreaterThan(arrowToRing)
    expect(styles).toContain('updates-return-arrow-reveal')
    expect(styles).toContain('updates-return-ring-draw')
    expect(styles).toContain('[data-return-state="ring"]')
  })

  it('uses one withdrawal path for leave, wheel, and outside pointer input', () => {
    expect(page).toContain('beginWithdrawal()')
    expect(page).toContain('beginWithdrawal({')
    expect(page).toContain('returnTriggerRef.current?.contains(event.target)')
    expect(page).toContain("window.addEventListener('wheel', onWheel, { passive: true })")
    expect(page).toContain("window.addEventListener('pointerdown', onPointerDown, { capture: true })")
    expect(styles).toContain('transition: opacity 180ms ease-in')
    expect(styles).toContain('transition: stroke-dashoffset 240ms')
    expect(scramble).toContain('withdrawing = false')
    expect(scramble).toContain('onWithdrawn')
  })

  it('keeps the existing mobile touch path separate from the desktop state', () => {
    expect(page).toContain('mobileReturnArmed')
    expect(page).toContain('mobileReturnReady')
    expect(page).toContain('resolveTouchReturnSwipe')
    expect(styles).toContain('@media (pointer: coarse)')
  })
})
