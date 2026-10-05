import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8')
const rootContent = html.match(/<div id="root">([\s\S]*?)<\/div>/)?.[1] ?? ''

describe('static Landing fallback', () => {
  it('keeps the current public identity and v0.2.1 summaries in the original HTML', () => {
    expect(rootContent).toContain('<main id="static-landing-fallback"')
    expect(rootContent).toContain('NewTone')
    expect(rootContent).toContain('v0.2.1')
    expect(rootContent).toContain('2026.10.05')
    expect(rootContent).toContain('世界正在慢慢变得热闹起来。')
    expect(rootContent).toContain('新的街道、新的人，以及一些还没有结束的事情，正在出现。')
    expect(rootContent).toContain('The world is slowly starting to feel a little more alive.')
    expect(rootContent).toContain('New streets, new faces, and a few things still unfolding are beginning to appear.')
  })
})
