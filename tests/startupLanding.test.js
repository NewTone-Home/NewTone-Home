import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

describe('public startup', () => {
  it('renders the real Landing app while publication content loads', () => {
    expect(source).toContain("import App from './App.jsx'")
    expect(source).toContain("import './views/EmptyContentApp.css'")
    expect(source).not.toContain("result.status === 'loading' || !App")
    expect(source).toContain('return <App contentStatus={result.status}')
  })
})
