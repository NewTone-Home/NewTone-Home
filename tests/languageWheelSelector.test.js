import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const selector = read('../src/components/LanguageWheelSelector.jsx')
const styles = read('../src/components/LanguageWheelSelector.css')
const hook = read('../src/hooks/useScrambleText.js')

describe('language wheel selector stage', () => {
  it('keeps browser-language decoding separate from confirmation', () => {
    expect(selector).toContain("data-language-selector-phase={phase}")
    expect(selector).toContain("recordRuntimeAudit('language-preview-start'")
    expect(selector).toContain("recordRuntimeAudit('language-preview-ready'")
    expect(selector).toContain('data-language-fill="none"')
    expect(selector).toContain('onClick={handleClick}')
    expect(selector).toContain('onPointerEnter={handlePointerEnter}')
    expect(selector).toContain('onWheel={handleWheel}')
    expect(selector).toContain('onPointerUp={handlePointerUp}')
    expect(selector).toContain('LANGUAGE_WHEEL_IDLE_MS')
    expect(selector).toContain("recordRuntimeAudit('language-wheel-idle'")
    expect(selector).toContain("enabled: phase === 'decoding' || phase === 'settling'")
  })

  it('uses one blurred candidate and a floating arrow after decoding', () => {
    expect(selector).toContain("useState('bottom')")
    expect(selector).toContain('language-wheel-selector__candidate')
    expect(selector).toContain('language-wheel-selector__arrow')
    expect(selector).toContain("data-language-arrow-state={showArrow && !hasInteracted ? 'floating' : showArrow ? 'fading' : 'hidden'}")
    expect(styles).toContain('@keyframes language-wheel-arrow-float')
    expect(styles).toContain('filter: blur(')
    expect(styles).not.toContain('shared-entry-material')
    expect(hook).toContain('export function useScrambleText')
  })
})
