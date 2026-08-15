import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.jsx')
const surface = read('../src/components/EntrySurface.jsx')
const surfaceCss = read('../src/components/EntrySurface.css')

describe('persistent entry surface contract', () => {
  it('keeps Landing and all entry stages on one mounted surface until Reader takes over', () => {
    expect(app).toContain("const showEntrySurface = currentView === 'landing' || readingEntry.isActive")
    expect(app).toContain('<EntrySurface')
    expect(app).not.toContain('<ReadingTransition')
    expect(surface).toContain('<Landing')
    expect(surface).toContain('<ReadingTransition')
    expect(surface).toContain("const entryActive = phase !== 'idle'")
    expect(surface).toContain("const readerHandoffActive = phase === 'reader-preparing' || phase === 'transition-leaving'")
    expect(surface).toContain('entry-surface--reader-handoff')
    expect(surface).toContain('leaving={entryActive}')
  })

  it('embeds the former full-screen transition layer inside the persistent surface', () => {
    expect(surfaceCss).toContain('.entry-surface > .reading-transition')
    expect(surfaceCss).toContain('position: absolute')
    expect(surfaceCss).toContain('.entry-surface > .landing')
    expect(surfaceCss).toContain('.entry-surface--reader-handoff')
    expect(surfaceCss).toContain('transition: opacity var(--entry-handoff-fade-duration, 400ms) ease')
    expect(surfaceCss).toContain('.entry-surface--reader-handoff-leaving')
    expect(surface).not.toContain('guidePaused')
  })
})
