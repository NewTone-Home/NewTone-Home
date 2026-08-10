import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const landing = read('../src/views/Landing.jsx')
const guideCss = read('../src/views/LandingGuideArrow.css')
const updatesCss = read('../src/views/LandingUpdatesEntry.css')

describe('Landing updates entry', () => {
  it('keeps one fixed-pivot guide and derives its direction from the live target', () => {
    expect(landing).toContain("[TITLE_PHASE.IDLE, TITLE_PHASE.DRAWING, TITLE_PHASE.REVEALED].includes(phase)")
    expect(landing).toContain("updatesSelected ? 'down' : 'left'")
    expect(guideCss).toContain('top: 50%')
    expect(guideCss).toContain('transform-origin: 0 35px')
    expect(guideCss).toContain('transform-box: view-box')
    expect(guideCss).toContain('transform: rotate(90deg)')
    expect(guideCss).toContain('transform: rotate(-90deg)')
    expect(guideCss).toContain('transition: transform 1200ms')
  })

  it('lets the reader ring use its own visible draw transition without inline title overrides', () => {
    expect(landing).toContain('{!returnSequenceActive && (')
    expect(landing).toContain('&& !leaving')
    expect(landing).toContain('arrowDelayed={leaving || !entryPromptsSettled}')
    expect(landing).not.toContain('readerRingRef')
    expect(landing).not.toContain("ring.style.transition = 'none'")
    expect(landing).not.toContain('getComputedStyle(sweep).strokeDashoffset')
    expect(guideCss).toContain('transition-duration: 2200ms')
    expect(guideCss).toContain('stroke-dashoffset 1200ms')
    expect(guideCss).toContain('transform: scale(1.12)')
    expect(updatesCss).toContain('.landing-entry-group--timed {\n  opacity: 0')
    expect(updatesCss).toContain('.landing-direction-prompts--revealed .landing-entry-group--timed')
  })

  it('returns arrows left from their labels before a separate slow turn down', () => {
    expect(landing).toContain('const arrowsEmerging = updatesPhase === UPDATES_PHASE.RETURN_ARROWS')
    expect(landing).toContain('const arrowsTurning = updatesPhase === UPDATES_PHASE.RETURN_ARROW_TURN')
    expect(landing).toContain("arrowsEmerging\n      ? 'left'")
    expect(landing).toContain("onUpdatesBarrier?.('turns', key)")
    expect(guideCss).toContain('landing-updates-arrow-return 1400ms')
    expect(guideCss).toContain('[data-updates-phase="return-arrow-turn"] .landing-entry-arrow__rotator')
  })

  it('reveals both labels together and routes the next downward input by target', () => {
    expect(landing).toContain('data-landing-entry="updates"')
    expect(landing).toContain("landingLanguage === 'zh' ? '更新公告' : 'Updates'")
    expect(landing.match(/active=\{entryPromptsActive\}/g)?.length).toBe(2)
    expect(landing.match(/duration=\{LANDING_ENTRY_PROMPT_DURATION_MS\}/g)?.length).toBe(2)
    expect(landing).toContain("entryTargetRef.current === 'updates'")
    expect(landing).toContain('onEnterUpdates?.()')
    expect(landing).toContain('requestLeave(enterSelectedTarget)')
    expect(updatesCss).toContain('.landing-direction-prompts--revealed .landing-prompt--updates')
    expect(updatesCss).toContain('var(--scene-parallax-back-x, 0px)')
    expect(updatesCss).toContain('var(--scene-parallax-back-y, 0px)')
  })
})
