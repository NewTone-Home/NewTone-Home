import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const timeline = read('../src/components/entryButtonTimeline.js')
const surface = read('../src/components/EntryButtonSurface.jsx')
const selector = read('../src/components/LanguageWheelSelector.jsx')

describe('shared entry button timeline', () => {
  it('is the single requestAnimationFrame timeline for both button surfaces', () => {
    expect(timeline).toContain('export const ENTRY_BUTTON_TIMINGS')
    expect(timeline).toContain('export function createEntryProgress')
    expect(timeline).toContain('export function useEntryButtonTimeline')
    expect(timeline).toContain('window.requestAnimationFrame(tick)')
    expect(timeline).toContain('window.cancelAnimationFrame')
    expect(timeline).not.toContain('setTimeout')
    expect(surface).toContain('useEntryButtonTimeline')
    expect(selector).toContain('useEntryButtonTimeline')
  })

  it('starts with no fill and preserves the shared entry order', () => {
    expect(timeline).toContain('return { text: 0, frame: 0, fill: 0, ...overrides }')
    expect(surface).toContain("{ key: 'text', to: 1, duration: ENTRY_BUTTON_TIMINGS.textEnter }")
    expect(surface).toContain("{ key: 'frame', to: 1, duration: ENTRY_BUTTON_TIMINGS.frameEnter }")
    expect(selector).toContain('const initialSteps = [')
    expect(selector).toContain("if (coarse) initialSteps.push({ key: 'fill', to: 1, duration: ENTRY_BUTTON_TIMINGS.fillOpen })")
    expect(selector).toContain("startPanelTransition('opening', () =>")
    expect(selector).toContain("runTimeline([{ key: 'fill', to: 1, duration: ENTRY_BUTTON_TIMINGS.fillOpen }]")
    expect(selector).toContain("runTimeline([{ key: 'fill', to: 0, duration: ENTRY_BUTTON_TIMINGS.fillClose }]")
  })
})
