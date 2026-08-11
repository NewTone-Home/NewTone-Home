import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/components/LandingUpdatesPage.jsx')
const styles = read('../src/components/LandingUpdatesPage.css')
const scramble = read('../src/components/ScrambleText.jsx')

describe('Landing updates return entry', () => {
  it('uses the Landing paper and exposes a local desktop return state machine', () => {
    expect(styles).toContain('background-color: var(--reader-paper, var(--paper-base));')
    expect(page).toContain('data-return-state={returnEntryPhase}')
    expect(page).toContain('className="landing-updates-page__return-backdrop"')
    expect(page).toContain('className="landing-updates-return-trigger"')
    expect(page).toContain('onPointerLeave={handleReturnPointerLeave}')
  })

  it('proves the strict text, arrow, ready order without a rendered ring', () => {
    const textToArrow = page.indexOf("transitionReturnEntry(RETURN_ENTRY_PHASE.ARROW)")
    const ringToReady = page.indexOf("transitionReturnEntry(RETURN_ENTRY_PHASE.READY)")

    expect(textToArrow).toBeGreaterThan(-1)
    expect(ringToReady).toBeGreaterThan(textToArrow)
    expect(page).toContain('showRing={false}')
    expect(page).toContain("direction={isWithdrawalPhase(returnEntryPhase) ? 'left' : 'up'}")
    expect(page).toContain('withdrawing={isWithdrawalPhase(returnEntryPhase)}')
    expect(styles).toContain('updates-return-arrow-reveal')
    expect(styles).toContain('updates-return-arrow-withdraw')
    expect(styles).toContain('[data-return-state="withdraw-arrow"]')
  })

  it('uses one withdrawal path for leave, wheel, and outside pointer input', () => {
    expect(page).toContain('beginWithdrawal({')
    expect(page).toContain('returnTriggerRef.current?.contains(event.target)')
    expect(page).toContain("window.addEventListener('wheel', onWheel, { passive: true })")
    expect(page).toContain("window.addEventListener('pointerdown', onPointerDown, { capture: true })")
    expect(page).toContain("reason: RETURN_ENTRY_WITHDRAWAL_REASON.WHEEL")
    expect(page).toContain("returnToLanding: event.deltaY < -8")
    expect(page).toContain("reason: RETURN_ENTRY_WITHDRAWAL_REASON.LEAVE")
    expect(page).toContain("reason: RETURN_ENTRY_WITHDRAWAL_REASON.OUTSIDE")
    expect(page).toContain('returnNavigationIssuedRef')
    expect(styles).toContain('withdraw-ring')
    expect(styles).toContain('withdraw-arrow')
    expect(styles).toContain('withdraw-text')
    expect(styles).toContain('transition: none !important')
    expect(styles).toContain('transition-duration: 360ms')
    expect(styles).toContain('animation: updates-return-arrow-withdraw')
    expect(scramble).toContain('withdrawing = false')
    expect(scramble).toContain('onWithdrawn')
    expect(scramble).toContain('onWithdrawnRef.current?.()')
    expect(scramble).toContain('onRevealedRef.current?.()')
  })

  it('uses a soft gradient backdrop and explicit leave/wheel timing', () => {
    expect(styles).toContain('linear-gradient(')
    expect(styles).toContain('rgba(32, 29, 25, 0) 100%')
    expect(styles).toContain('backdrop-filter: blur(6px)')
    expect(styles).toContain('transition: opacity 520ms ease-in')
    expect(styles).toContain('transition-duration: 360ms')
    expect(page).toContain('ring: 0')
    expect(page).toContain('arrow: 520')
    expect(page).toContain('text: 520')
    expect(page).toContain('ring: 0')
    expect(page).toContain('arrow: 360')
    expect(page).toContain('text: 360')
  })

  it('keeps the existing mobile touch path separate from the desktop state', () => {
    expect(page).toContain('mobileReturnArmed')
    expect(page).toContain('mobileReturnReady')
    expect(page).toContain('resolveTouchReturnSwipe')
    expect(styles).toContain('@media (pointer: coarse)')
  })
})
