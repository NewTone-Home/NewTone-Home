import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const landing = read('../src/views/Landing.jsx')
const landingCss = read('../src/views/Landing.css')
const entryCss = read('../src/views/LandingUpdatesEntry.css')
const updatesPage = read('../src/components/LandingUpdatesPage.jsx')
const updatesPageCss = read('../src/components/LandingUpdatesPage.css')
const entryGroup = read('../src/components/EntryButtonGroup.jsx')
const entrySurface = read('../src/components/EntryButtonSurface.jsx')
const entrySurfaceCss = read('../src/components/EntryButtonSurface.css')

describe('Landing updates entry', () => {
  it('renders no Landing arrow or title signature lines', () => {
    expect(landing).not.toContain('LandingEntryArrow')
    expect(landing).not.toContain('NewToneHandLines')
    expect(landing).not.toContain('onPointerEnter')
    expect(landing).not.toContain('onWheel')
    expect(landing).not.toContain('onTouchMove')
    expect(landingCss).not.toContain('landing-guide-arrow')
    expect(landingCss).not.toContain('landing-title:hover')
  })

  it('starts the title animation from the Landing mount instead of hover', () => {
    expect(landing).toContain('window.requestAnimationFrame(() => { begin() })')
    expect(landing).toContain('data-motion-parallax-trigger="true"')
    expect(landing).toContain('data-entry-phase={entryPromptsActive ? \'visible\' : \'hidden\'}')
  })

  it('keeps two independently labelled Landing entries visible from one reveal phase', () => {
    expect(landing).toContain("import EntryButtonGroup from '../components/EntryButtonGroup'")
    expect(landing).toContain('groupId="landing-entries"')
    expect(landing).toContain('landingEntriesVisible = !leaving && entryPromptsActive && updatesPhase === UPDATES_PHASE.LANDING')
    expect(landing).toContain("id: 'updates'")
    expect(landing).toContain("id: readerEntryId")
    expect(landing).toContain("materialMode: 'background'")
    expect(landing).toContain("materialMode: hasProgress ? 'world' : 'background'")
    expect(entryCss).toContain('.landing-entry-button-group .entry-button-surface:first-child')
    expect(entryCss).toContain('.landing-entry-button-group .entry-button-surface:last-child')
    expect(entryCss).not.toContain('landing-direction-prompts')
    expect(entryCss).not.toContain('landing-entry-group--timed')
    expect(entryCss).not.toContain('enter-labels')
    expect(entryCss).not.toContain('return-labels')
  })

  it('keeps Updates navigation click-only and arrow-free', () => {
    expect(updatesPage).not.toContain('LandingEntryArrow')
    expect(updatesPage).not.toContain('resolveTouchReturnSwipe')
    expect(updatesPage).toContain('onClick={onReturnRequested}')
    expect(updatesPageCss).not.toContain('return-ring')
    expect(updatesPageCss).not.toContain('touch-action: none')
  })

  it('keeps the shared button geometry and navigation completion in one component contract', () => {
    expect(entrySurface).toContain('<button')
    expect(entrySurface).toContain('type="button"')
    expect(entrySurface).toContain("const ENTRY_PATH = 'M 2 2 H 198 V 54 H 2 Z'")
    expect(entrySurface.match(/d=\{ENTRY_PATH\}/g)).toHaveLength(2)
    expect(entrySurface).toContain('data-entry-id={entryId}')
    expect(entrySurface).toContain('data-entry-phase={phase}')
    expect(entryGroup).toContain("const GROUP_PHASE = Object.freeze({ ENTERING: 'entering', VISIBLE: 'visible', EXITING: 'exiting' })")
    expect(entryGroup).toContain("event.animationName === 'entry-button-surface-enter'")
    expect(entryGroup).toContain("event.animationName !== 'entry-button-surface-exit'")
    expect(entryGroup).toContain('navigatedRef.current = true')
    expect(entryGroup).toContain('onNavigateRef.current?.(actionRef.current)')
    expect(entryGroup).toContain("recordRuntimeAudit('entry-group-click'")
    expect(entryGroup).toContain("recordRuntimeAudit('entry-group-action-complete'")
    expect(entrySurfaceCss).toContain('entry-button-fill-enter')
    expect(entrySurfaceCss).toContain('entry-button-label-enter')
    expect(entrySurfaceCss).toContain('entry-button-fill-exit')
    expect(entrySurfaceCss).toContain('entry-button-label-exit')
  })
})
