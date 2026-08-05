import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = path => readFileSync(`${root}/${path}`, 'utf8')

describe('first-release boundary', () => {
  it('has no bundled legacy manuscript or generated content seed', () => {
    expect(readdirSync(`${root}/src/content/manuscripts`)).toEqual([])
    expect(existsSync(`${root}/supabase/seed/reader-content-v1.json`)).toBe(false)
  })

  it('keeps admin separate and clamps public history to Landing or Reader', () => {
    expect(source('src/main.jsx')).toContain("window.location.pathname === '/admin'")
    expect(source('src/App.jsx')).not.toContain("from './views/Center'")
    expect(source('src/App.jsx')).toContain("requestedView === 'reader' ? 'reader' : 'landing'")
    expect(source('src/views/Landing.jsx')).not.toContain('/admin')
  })

  it('allows only the dedicated release branch to create a protected Preview', () => {
    const vercel = JSON.parse(source('vercel.json'))
    expect(vercel.git.deploymentEnabled).toEqual({
      'codex/release-landing-reader-vercel': true,
    })
  })
})
