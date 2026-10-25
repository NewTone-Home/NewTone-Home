import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sceneCss = read('../src/center/runtime/scene.css')
const surfaceCss = read('../src/components/EntryButtonSurface.css')

describe('reading visual adjustments', () => {
  it('flips reading pages vertically while preserving the page timing and frame-size transition contract', () => {
    const close = sceneCss.match(/@keyframes mainline-reading-page-close\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    const open = sceneCss.match(/@keyframes mainline-reading-page-open\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

    expect(sceneCss).toContain('.scene-mainline-page--outgoing { animation: mainline-reading-page-close 160ms')
    expect(sceneCss).toContain('.scene-mainline-page--incoming { animation: mainline-reading-page-open 160ms cubic-bezier(.4, 0, .2, 1) 320ms')
    expect(sceneCss).toContain('.scene-mainline-page--current { transform: scaleY(1); }')
    expect(close).toContain('scaleY(1)')
    expect(close).toContain('scaleY(0)')
    expect(open).toContain('scaleY(0)')
    expect(open).toContain('scaleY(1)')
    expect(close).not.toContain('scaleX(')
    expect(open).not.toContain('scaleX(')
    expect(sceneCss).toContain('.scene-mainline-text--dialogue { z-index: 14; isolation: isolate; color: var(--active); }')
  })

  it('brightens only reading-option text and frame, leaving the shared world fill unchanged', () => {
    expect(sceneCss).toContain('.scene-mainline-action--reading .shared-entry-control.is-content-sized {')
    expect(sceneCss).toContain('color: var(--active);')
    expect(sceneCss).toContain('.scene-mainline-action--reading .shared-entry-control.is-content-sized .shared-entry-text { color: var(--active); }')
    expect(sceneCss).toContain('.scene-mainline-action--reading .shared-entry-control.is-content-sized:disabled { color: color-mix(in srgb, var(--active) 60%, var(--soft)); }')
    expect(sceneCss).toContain('.scene-mainline-action--reading .shared-entry-control.is-content-sized:disabled .shared-entry-text { color: color-mix(in srgb, var(--active) 60%, var(--soft)); }')
    expect(sceneCss).toContain('.scene-mainline-action--reading .shared-entry-control.is-content-sized:focus-visible {')
    expect(sceneCss).toContain('outline-color: color-mix(in srgb, var(--active) 42%, transparent);')
    expect(surfaceCss).toContain('--entry-world-surface-opacity: .56;')
    expect(sceneCss).not.toMatch(/\.scene-mainline-action--reading[^}]*--entry-world-surface-opacity/)
  })
})
