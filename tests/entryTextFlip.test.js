import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const component = read('../src/components/EntryTextFlip.jsx')
const styles = read('../src/components/EntryTextFlip.css')
const surface = read('../src/components/EntryButtonSurface.jsx')

describe('shared entry text flip', () => {
  it('keeps old and new labels in one clipped vertical track', () => {
    expect(component).toContain('settledValueRef')
    expect(component).toContain('window.requestAnimationFrame')
    expect(component).toContain('onTransitionEnd={handleTransitionEnd}')
    expect(component).toContain('slotValues')
    expect(styles).toContain('overflow: hidden')
    expect(styles).toContain('height: 200%')
    expect(styles).toContain("data-entry-text-flip-direction='down'")
    expect(styles).toContain('transform: translate3d(0, -50%, 0)')
    expect(styles).toContain('transition: transform 360ms')
  })

  it('is the text source for shared entry buttons instead of direct label replacement', () => {
    expect(surface).toContain("import EntryTextFlip from './EntryTextFlip'")
    expect(surface).toContain('<EntryTextFlip className="shared-entry-text" value={label}')
    expect(surface).not.toContain('className="shared-entry-text" style={textStyle}>{label}</span>')
  })
})
