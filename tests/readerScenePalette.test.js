import { describe, expect, it } from 'vitest'
import { readerContent } from '../src/data/readerContent'
import { getScenePalette } from '../src/reader/readerScenePalette'

const getPage = pageId => readerContent[0].pages.find(page => page.id === pageId)
const paletteAt = (pageId, beatIndex) => {
  const page = getPage(pageId)
  return getScenePalette(page.beats[beatIndex].sceneState ?? {}, page.scene.id)
}
const beatIndexOf = (pageId, beatId) => getPage(pageId).beats.findIndex(beat => beat.id === beatId)
const channels = palette => palette.paperChannels

describe('continuous scene colour track from the ancestral home to the inner world', () => {
  it('renders the courtyard bright and faintly warm-yellow, never purple', () => {
    const [r, g, b] = channels(paletteAt('ancestral-home', 0))
    expect(paletteAt('ancestral-home', 0).paperLevel).toBeGreaterThan(220)
    expect(r).toBeGreaterThanOrEqual(g)
    expect(g).toBeGreaterThan(b)
    expect(r - b).toBeLessThanOrEqual(48)
  })

  it('darkens monotonically through the main house', () => {
    const levels = getPage('ancestral-home').beats.map((_, index) => paletteAt('ancestral-home', index).paperLevel)
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1])
    }
    expect(levels.at(-1)).toBeLessThan(levels[0] / 2)
  })

  it('keeps losing light through the passage and bottoms out near black before the door', () => {
    const levels = getPage('threshold-passage').beats.map((_, index) => paletteAt('threshold-passage', index).paperLevel)
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]).toBeLessThan(levels[i - 1])
    }
    expect(levels.at(-1)).toBeLessThanOrEqual(30)
  })

  it('keeps the passage clearly distinct from the inner-world cool white', () => {
    const door = paletteAt('threshold-passage', beatIndexOf('threshold-passage', 'threshold-05'))
    const street = paletteAt('inner-street', 0)
    expect(street.paperLevel - door.paperLevel).toBeGreaterThan(150)
    const [sr, , sb] = channels(street)
    expect(sb).toBeGreaterThan(sr)
  })

  it('keeps street-01 a cool white below the pure white flash peak', () => {
    const street = paletteAt('inner-street', 0)
    const [r, g, b] = channels(street)
    ;[r, g, b].forEach(channel => expect(channel).toBeLessThan(240))
    expect(street.paperLevel).toBeGreaterThan(160)
    expect(b).toBeGreaterThanOrEqual(g)
    expect(g).toBeGreaterThanOrEqual(r)
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(12)
    expect(b - r).toBeLessThan(29)
  })

  it('switches ink to a readable light colour in the dark passage and keeps dark ink in the courtyard', () => {
    expect(paletteAt('threshold-passage', 4).darkScene).toBe(true)
    expect(paletteAt('ancestral-home', 0).darkScene).toBe(false)
    expect(Number(paletteAt('threshold-passage', 4).ink.match(/\d+/)[0])).toBeGreaterThan(200)
  })

  it('is a pure function of the beat, so reading backwards restores the exact colour', () => {
    const forward = paletteAt('threshold-passage', 2)
    const backAgain = paletteAt('threshold-passage', 2)
    expect(backAgain).toEqual(forward)
  })

  it('dims the chase slightly while keeping the commercial-street base', () => {
    const normal = paletteAt('commercial-street', 0)
    const chase = paletteAt('commercial-street', beatIndexOf('commercial-street', 'chase-01'))
    const aftermath = paletteAt('crowd-corner', beatIndexOf('crowd-corner', 'corner-02'))
    expect(chase.paperLevel).toBeLessThan(normal.paperLevel)
    expect(chase.paperLevel).toBeGreaterThan(100)
    expect(chase.darkScene).toBe(false)
    expect(aftermath.paperLevel).toBe(normal.paperLevel)
  })
})
