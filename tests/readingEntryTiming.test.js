import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { READING_ENTRY_TIMINGS } from '../src/transitions/readingEntryController'

const css = readFileSync(fileURLToPath(new URL('../src/components/ReadingTransition.css', import.meta.url)), 'utf8')
const component = readFileSync(fileURLToPath(new URL('../src/components/ReadingTransition.jsx', import.meta.url)), 'utf8')

describe('first-entry language-to-environment breath', () => {
  it('holds, fades, and breathes before the mode stage begins', () => {
    expect(READING_ENTRY_TIMINGS.LANG_LEAVING_MS).toBe(1000)
    expect(css).toContain('animation: ritual-options-release 1000ms ease both')
    expect(css).toContain('animation: ritual-title-release 1000ms ease both')
    expect(css).toMatch(/0%, 55%\s*{ opacity: 1; transform: translateY\(0\); }/)
    expect(css).toMatch(/75%, 100%\s*{ opacity: 0; transform: translateY\(3px\); }/)
  })

  it('starts the two mode labels only after the environment title stabilizes', () => {
    expect(component).toContain('if (!modeStage || !titleStable)')
    expect(component.match(/enabled: showText && \(!modeStage \|\| modeActionsReady\)/g)).toHaveLength(2)
    expect(component).toContain("node.style.transform = 'translateY(3px)'")
    expect(component).toContain("node.style.opacity = '1'")
  })

  it('uses one data-driven selector without a second hidden option system', () => {
    expect(component).toContain('function RitualSelector')
    expect(component).toContain('const currentStage = useMemo')
    expect(component).toContain('className={`ritual-selector language-init')
    expect(component.match(/data-selector-option=/g)).toHaveLength(2)
    expect(component).toContain("data-selector-identity={selectorIdentityStable === null ? 'pending' : selectorIdentityStable ? 'stable' : 'replaced'}")
    expect(component).toContain('node === selectorIdentityBaselineRef.current[index]')
    expect(component).not.toContain('function LanguageInit')
    expect(component).not.toContain('<LanguageInit')
  })

  it('resets scramble text before paint and avoids display-based stage switching', () => {
    expect(component).toContain('useLayoutEffect(() => {')
    const releaseRules = css.match(/@keyframes ritual-(?:options|title)-release[\s\S]*?\n}/g)?.join('\n') ?? ''
    expect(releaseRules).not.toContain('display:')
  })
})
