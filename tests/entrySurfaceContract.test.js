import { worldEntryReducer, WORLD_ENTRY_INITIAL_STATE } from '../src/center/worldEntryTransition.js'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.jsx')
const surface = read('../src/components/EntrySurface.jsx')
const surfaceCss = read('../src/components/EntrySurface.css')

describe('persistent entry surface contract', () => {
  it('keeps the Center cover until both cover and acknowledged scene readiness are complete', () => {
    const covering = worldEntryReducer(WORLD_ENTRY_INITIAL_STATE, { type: 'start' })
    const covered = worldEntryReducer(covering, { type: 'cover-complete' })
    expect(covered.phase).toBe('covered')
    expect(worldEntryReducer(covered, { type: 'reveal-complete' }).phase).toBe('covered')
    const revealing = worldEntryReducer(covered, { type: 'scene-ready' })
    expect(revealing.phase).toBe('revealing')
    expect(worldEntryReducer(revealing, { type: 'reveal-complete' }).phase).toBe('active')
    expect(app).toContain('controller.acknowledgeEntered(')
    expect(app).toContain('<EntrySurface')
    expect(surface).toContain('<Landing')
    expect(surface).not.toContain('progressStore')
    expect(app).not.toContain('readerEntryHandoffPhase')
  })

  it('keeps the Landing cover on its existing surface and the recovery boundary stable', () => {
    expect(surfaceCss).toContain('.entry-surface > .landing')
    expect(surfaceCss).toContain('position: absolute')
    expect(surface).toContain('worldEntryPhase={worldEntryPhase}')
    expect(surface).not.toContain('ReadingTransition')
    expect(app.indexOf('<RuntimeRecoveryBoundary')).toBeLessThan(app.indexOf('{Runtime &&'))
    expect(app).toContain('{recoveringRuntime && recoveryPanel}')
  })

})
