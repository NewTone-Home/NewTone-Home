import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sceneCss = readFileSync(new URL('../src/center/runtime/scene.css', import.meta.url), 'utf8')

describe('mainline reading exit motion', () => {
  it('fades the text at its fitted position without adding an exit translation', () => {
    const keyframes = sceneCss.match(/@keyframes mainline-text-leave\s*\{([^}]+\{[^}]+\}[^}]+\})/)?.[1]
    expect(keyframes).toBeTruthy()

    const from = keyframes!.match(/from\s*\{([^}]+)\}/)?.[1]
    const to = keyframes!.match(/to\s*\{([^}]+)\}/)?.[1]
    expect(from).toContain('opacity: 1')
    expect(to).toContain('opacity: 0')
    expect(from?.match(/transform:\s*([^;]+);/)?.[1]).toBe('translate(-50%, -50%)')
    expect(to?.match(/transform:\s*([^;]+);/)?.[1]).toBe('translate(-50%, -50%)')
    expect(sceneCss).toMatch(/\.scene-mainline-text\.is-leaving\s*\{\s*animation:\s*mainline-text-leave 160ms ease-in both;/)
    expect(sceneCss).toMatch(/@keyframes mainline-text-arrive\s*\{\s*from\s*\{[^}]*transform:\s*translate\(-50%, calc\(-50% \+ 5px\)\)/)
  })
})
