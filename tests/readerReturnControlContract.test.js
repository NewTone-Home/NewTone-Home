import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const control = read('../src/components/reader/ReaderReturnControl.jsx')
const controlCss = read('../src/components/reader/ReaderReturnControl.css')
const stage = read('../src/views/ReaderStage.jsx')

describe('portable Reader return control', () => {
  it('has a host-independent visual contract', () => {
    expect(control).toContain('visible = false')
    expect(control).toContain('mobile = false')
    expect(control).toContain("worldLayer = 'surface'")
    expect(control).toContain('onReturnStart')
    expect(control).toContain('onReturnComplete')
    expect(control).toContain('text -> frame -> door on entry')
    expect(control).toContain("startExit('return')")
    expect(control).not.toContain('ReaderStage')
    expect(control).not.toContain('readerReturnFlow')
    expect(control).not.toContain('setTimeout')
    expect(control).not.toContain('pointermove')
    expect(control).not.toContain('wheel')
  })

  it('keeps the door inside the outer frame and supports five directions', () => {
    expect(control).toContain("const MASK_DIRECTIONS = ['left', 'right', 'top', 'bottom', 'center']")
    expect(control).toContain('nextMaskDirection(queue)')
    expect(control).toContain('const FRAME_ORIGINS')
    expect(controlCss).toContain('inset: 3px')
    expect(controlCss).toContain('reader-return-frame')
    expect(controlCss).toContain("data-return-mask-direction='left'")
    expect(controlCss).toContain("data-return-mask-direction='right'")
    expect(controlCss).toContain("data-return-mask-direction='top'")
    expect(controlCss).toContain("data-return-mask-direction='bottom'")
    expect(controlCss).toContain("data-return-mask-direction='center'")
    expect(controlCss).toContain('perspective: 160px')
  })

  it('leaves ReaderStage responsible only for the boundary fact and host callbacks', () => {
    expect(stage).toContain('const [lastContentReached, setLastContentReached] = useState(false)')
    expect(stage).toContain('const returnVisible = emptyDocument || lastContentReached')
    expect(stage).toContain('visible={returnVisible}')
    expect(stage).toContain('onReturnStart={onReturnStart}')
    expect(stage).toContain('onReturnComplete={onReturnLanding}')
    expect(stage).not.toContain('readerReturnFlow')
    expect(stage).not.toContain('READER_RETURN_')
  })
})
