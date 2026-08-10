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
  })

  it('pre-mounts the reader ring and maps its real path offset to the title sweep', () => {
    expect(landing).toContain('{!returnSequenceActive && (')
    expect(landing).toContain('ring.style.strokeDashoffset = String(ringLength * normalizedSweepOffset)')
    expect(landing).toContain("ring.style.strokeDashoffset = '0'")
    expect(landing).not.toContain('READER_RING_DRAW_CAP')
    expect(landing).not.toContain('TITLE_FINISHING_PASS_MS')
    expect(updatesCss).toContain('.landing-entry-group--timed {\n  opacity: 0')
    expect(updatesCss).toContain('.landing-direction-prompts--revealed .landing-entry-group--timed')
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
