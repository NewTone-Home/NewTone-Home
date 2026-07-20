import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readerContent } from '../src/data/readerContent'

const css = readFileSync(fileURLToPath(new URL('../src/views/ReaderStage.css', import.meta.url)), 'utf8')
const pages = readerContent[0].pages

describe('reader text motion stays local', () => {
  it('never moves reading text by viewport-sized distances', () => {
    expect(/translate[XY3d]*\([^)]*\d+vh/i.test(css)).toBe(false)
  })

  it('reveals new scenes with the reveal animation instead of a flying page enter', () => {
    expect(css).toContain('reader-scene-reveal')
    expect(css).not.toContain('reader-page-enter ')
    const reveal = css.match(/@keyframes reader-scene-reveal[^}]*from[^}]*}/s)?.[0] ?? ''
    expect(/translateY\((1?\d)px\)/.test(reveal)).toBe(true)
  })
})

describe('chase stays inside the commercial street', () => {
  it('keeps chase and aftermath beats under the 商业街 scene', () => {
    const commercial = pages.find(page => page.id === 'commercial-street')
    const corner = pages.find(page => page.id === 'crowd-corner')
    expect(commercial.scene.label).toBe('商业街')
    expect(corner.scene.label).toBe('商业街')
    expect(corner.scene.id).toBe(commercial.scene.id)
    expect(pages.some(page => page.id.includes('chase'))).toBe(false)
  })

  it('keeps chase beats free of auto-advance and only slightly dimmed', () => {
    const chaseBeats = pages.flatMap(page => page.beats).filter(beat => beat.sceneState?.sceneState === 'chase')
    expect(chaseBeats.length).toBeGreaterThan(0)
    chaseBeats.forEach(beat => {
      expect(beat.sceneState.autoAdvanceMs).toBeUndefined()
      expect(beat.sceneState.light).toBeGreaterThanOrEqual(.7)
    })
  })

  it('shows the white figure as a brief glimpse, not an endless loop', () => {
    expect(css).toContain('reader-commercial-figure-glimpse')
    expect(/reader-commercial-figure-glimpse[^;}]*infinite/.test(css)).toBe(false)
  })

  it('settles the aftermath back onto the stable commercial street', () => {
    const aftermathRule = css.match(/\[data-scene-state="aftermath"\][^}]*}/s)?.[0] ?? ''
    expect(aftermathRule).not.toContain('animation')
  })

  it('never masks or clips the chase focus text and keeps it above atmosphere layers', () => {
    const focusRule = css.match(/\.reader-stage-beat\[data-distance="0"\][^}]*}/s)?.[0] ?? ''
    const chaseFocusRule = css.match(/\[data-scene-state="chase"\]\s+\.reader-stage-beat\[data-distance="0"\][^}]*}/s)?.[0] ?? ''
    const beatStackRule = css.match(/\.reader-beat-stack\s*{[^}]*}/s)?.[0] ?? ''
    const atmosphereRule = css.match(/\.reader-scene-atmosphere\s*{[^}]*}/s)?.[0] ?? ''
    const figureRules = [...css.matchAll(/\.reader-commercial-figure\s*{[^}]*}/gs)].map(match => match[0]).join('\n')

    expect(chaseFocusRule).not.toContain('mask-image')
    expect(focusRule).not.toContain('clip-path')
    expect(beatStackRule).toContain('z-index: 2')
    expect(atmosphereRule).toContain('z-index: 0')
    expect(figureRules).toContain('z-index: 1')

    const chaseText = pages.flatMap(page => page.beats)
      .find(beat => beat.sceneState?.sceneState === 'chase')
      ?.blocks.map(block => block.text).join('')
    expect(chaseText).toContain('周围的声音突然远了')
  })
})
