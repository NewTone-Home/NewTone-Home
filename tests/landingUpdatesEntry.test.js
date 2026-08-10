import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const landing = read('../src/views/Landing.jsx')
const guideCss = read('../src/views/LandingGuideArrow.css')
const updatesCss = read('../src/views/LandingUpdatesEntry.css')

describe('Landing updates entry', () => {
  it('keeps the guide visible through title reveal and turns it toward updates', () => {
    expect(landing).toContain("[TITLE_PHASE.IDLE, TITLE_PHASE.DRAWING, TITLE_PHASE.REVEALED].includes(phase)")
    expect(landing).toContain('<LandingGuideArrow phase={guidePhase} turned={promptsRevealed} />')
    expect(landing).not.toContain('withdrawGuide().then(() => {\n      activationPendingRef.current = false\n      begin()')
    expect(guideCss).toContain('.landing-guide-arrow--turned .landing-guide-arrow__turn')
    expect(guideCss).toContain('transform: rotate(180deg)')
  })

  it('reveals the updates label with the same prompt timing as the downward entry', () => {
    expect(landing).toContain('data-landing-entry="updates"')
    expect(landing).toContain("landingLanguage === 'zh' ? '更新公告' : 'Updates'")
    expect(landing.match(/duration=\{800\}/g)?.length).toBeGreaterThanOrEqual(2)
    expect(updatesCss).toContain('.landing-direction-prompts--revealed .landing-prompt--updates')
    expect(updatesCss).toContain('var(--scene-parallax-back-x, 0px)')
    expect(updatesCss).toContain('var(--scene-parallax-back-y, 0px)')
  })
})
