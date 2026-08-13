import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const landing = read('../src/views/Landing.jsx')
const guideCss = read('../src/views/LandingGuideArrow.css')
const updatesCss = read('../src/views/LandingUpdatesEntry.css')

describe('Landing entry buttons', () => {
  it('keeps the initial guide arrow visual-only', () => {
    expect(landing.match(/<LandingEntryArrow/g)).toHaveLength(1)
    expect(landing).toContain('className="landing-guide-entry-arrow"')
    expect(landing).toContain("phase={guideVisible ? guidePhase : 'hidden'}")
    expect(landing).not.toContain('onUpdatesBarrier')
    expect(landing).not.toContain('resolveScrollIntent')
    expect(landing).not.toContain('addEventListener')
    expect(guideCss).not.toContain('landing[data-updates-phase="enter-arrow-turn"]')
    expect(guideCss).not.toContain('landing-updates-arrow-retract')
  })

  it('renders Updates and Reader as independent real buttons', () => {
    expect(landing).toContain('entryId="landing-updates"')
    expect(landing).toContain('entryId={readerEntryId}')
    expect(landing).toContain("const readerEntryId = hasProgress ? 'reader-continue' : 'reader-start'")
    expect(landing).toContain('onActionStart={handleEntryActionStart}')
    expect(landing).toContain('onActionComplete={handleEntryActionComplete}')
    expect(landing).toContain("materialMode={hasProgress ? 'world' : 'background'}")
    expect(landing).toContain('worldLayer={environmentState.worldLayer}')
    expect(updatesCss).toContain('.updates-entry-group')
    expect(updatesCss).toContain('landing-updates-surface-exit 900ms')
  })

  it('uses the stable four-phase flow instead of arrow target phases', () => {
    expect(landing).toContain('updatesPhase === UPDATES_PHASE.LANDING')
    expect(landing).not.toContain('ENTER_ARROW')
    expect(landing).not.toContain('RETURN_ARROW')
    expect(landing).not.toContain('entryTarget')
    expect(landing).not.toContain('ScrambleText')
    expect(landing).toContain('returnSequenceStartedRef.current = false')
  })
})
