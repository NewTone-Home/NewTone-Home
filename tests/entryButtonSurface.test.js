import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const surface = read('../src/components/EntryButtonSurface.jsx')
const frame = read('../src/components/EntryButtonFrame.jsx')
const styles = read('../src/components/EntryButtonSurface.css')
const audit = read('../src/services/runtimeAudit.js')

describe('shared entry button surface', () => {
  it('owns one explicit visual timeline and click completion boundary', () => {
    expect(surface).toContain('hidden -> entering -> visible -> exiting -> hidden')
    expect(surface).toContain("setPhaseValue('entering')")
    expect(surface).toContain("setPhaseValue('visible')")
    expect(surface).toContain("setPhaseValue('exiting')")
    expect(surface).toContain("setPhaseValue('hidden')")
    expect(surface).toContain("recordRuntimeAudit('entry-click'")
    expect(surface).toContain("recordRuntimeAudit('entry-timeline-start'")
    expect(surface).toContain("recordRuntimeAudit('entry-timeline-cancel'")
    expect(surface).toContain("phaseRef.current === 'entering' && !timelineRef.current.frame")
    expect(surface).toContain("recordRuntimeAudit('entry-action-complete'")
    expect(surface).toContain('onActionCompleteRef.current?.')
    expect(surface).toContain('phaseRef.current !== \'visible\'')
    expect(surface).toContain('disabled={!present || disabled || phase !== \'visible\'}')
    expect(surface).not.toContain('setTimeout')
  })

  it('clips fill and frame to the same SVG path', () => {
    expect(surface).toContain("import EntryButtonFrame, { FILL_DIRECTIONS, FRAME_ORIGINS } from './EntryButtonFrame'")
    expect(surface).toContain('<EntryButtonFrame')
    expect(frame).toContain("const FILL_DIRECTIONS = ['left', 'right', 'top', 'bottom', 'center']")
    expect(frame).toContain('const FRAME_ORIGINS')
    expect(frame).toContain('const FRAME_PATHS')
    expect(frame).toContain('<clipPath id={fillClipId}')
    expect(frame).toContain('<use href={`#${shapeId}`} />')
    expect(frame).toContain('clipPath={`url(#${fillClipId})`}')
    expect(surface).toContain('data-entry-layer-model="shared-svg-geometry>text"')
    expect(styles).toContain('.shared-entry-surface')
    expect(styles).toContain('.shared-entry-frame')
    expect(styles).toContain('.shared-entry-material')
  })

  it('keeps material source separate from host state', () => {
    expect(frame).toContain("if (materialMode === 'background') return BACKGROUND_MATERIAL")
    expect(frame).toContain("WORLD_MATERIALS[worldLayer]")
    expect(surface).toContain('data-entry-material-source={materialMode}')
    expect(surface).toContain('data-entry-world-layer={worldLayer}')
    expect(styles).toContain('color-mix(')
    expect(audit).toContain('window.NT_AUDIT')
  })
})
