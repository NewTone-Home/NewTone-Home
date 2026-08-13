import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const control = read('../src/components/reader/ReaderReturnControl.jsx')
const surface = read('../src/components/EntryButtonSurface.jsx')
const surfaceCss = read('../src/components/EntryButtonSurface.css')
const stage = read('../src/views/ReaderStage.jsx')

describe('portable Reader return control', () => {
  it('is a thin host wrapper around the shared click timeline', () => {
    expect(control).toContain('visible = false')
    expect(control).toContain('mobile = false')
    expect(control).toContain("worldLayer = 'surface'")
    expect(control).toContain('onReturnStart')
    expect(control).toContain('onReturnComplete')
    expect(control).toContain('<EntryButtonSurface')
    expect(control).toContain('entryId="reader-return"')
    expect(control).not.toContain('LandingEntryArrow')
    expect(control).not.toContain('setTimeout')
  })

  it('owns one shared SVG geometry for frame, fill, and text', () => {
    expect(surface).toContain("const FILL_DIRECTIONS = ['left', 'right', 'top', 'bottom', 'center']")
    expect(surface).toContain('const FRAME_ORIGINS')
    expect(surface).toContain('const FRAME_PATHS')
    expect(surface).toContain('getFillRect(variant.fillDirection, progress.fill)')
    expect(surface).toContain('<clipPath id={fillClipId}')
    expect(surface).toContain('href={`#${shapeId}`}')
    expect(surface).toContain('clipPath={`url(#${fillClipId})`}')
    expect(surface).toContain('data-return-fill-direction')
    expect(surface).toContain('data-return-frame-origin')
    expect(surface).toContain('data-return-layer-model')
    expect(surfaceCss).toContain('.shared-entry-frame')
    expect(surfaceCss).toContain('.shared-entry-material')
    expect(surfaceCss).toContain('color-mix(')
    expect(surfaceCss).toContain('var(--return-fill-progress)')
    expect(surface).not.toContain("color: fillActive ? 'var(--return-text-active)'")
  })

  it('leaves ReaderStage responsible only for final-beat visibility and callbacks', () => {
    expect(stage).toContain("import { isFinalReaderBeat } from '../reader/readerPosition'")
    expect(stage).toContain('const returnVisible = emptyDocument || isFinalReaderBeat(focusBeatIndex, beats)')
    expect(stage).toContain('onReturnStart={onReturnStart}')
    expect(stage).toContain('onReturnComplete={onReturnLanding}')
    expect(stage).not.toContain('readerReturnFlow')
    expect(stage).not.toContain('READER_RETURN_')
  })
})
