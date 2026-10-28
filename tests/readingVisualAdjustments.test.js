import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sceneCss = read('../src/center/runtime/scene.css')
const surfaceCss = read('../src/components/EntryButtonSurface.css')

describe('reading visual adjustments', () => {
  it('rolls the old page down while the new page enters from above like the Cafe storefront', () => {
    expect(sceneCss).toContain('.scene-mainline-page-stack { position: relative; left: 50%; top: 50%; display: grid; grid-template-rows: minmax(0, 1fr); overflow: hidden; transform: translate(-50%, -50%); }')
    expect(sceneCss).toContain('.scene-mainline-page--outgoing { transform: translate3d(0, var(--reading-page-out-y, 0%), 0); }')
    expect(sceneCss).toContain('.scene-mainline-page--incoming { transform: translate3d(0, var(--reading-page-in-y, -100%), 0); }')
    expect(sceneCss).not.toContain('mainline-reading-page-close')
    expect(sceneCss).not.toContain('mainline-reading-page-open')
    expect(sceneCss).not.toContain('scaleY(')
    expect(sceneCss).not.toContain('320ms')
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
