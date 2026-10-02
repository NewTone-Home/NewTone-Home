import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

describe('Center voluntary Feedback contract', () => {
  it('accepts only the active phone Feedback source', () => {
    const service = read('../src/services/centerFeedback.js')
    expect(service).toContain("const SOURCES = new Set(['phone'])")
    expect(service).not.toContain('incomplete-questionnaire')
    expect(service).not.toContain('completion-prompt')
  })

  it('keeps the Feedback app as an explicit phone action', () => {
    const phone = read('../src/center/runtime/WorldPhone.tsx')
    expect(phone).toContain('data-app="feedback"')
    expect(phone).toContain("onFeedbackModeChange?.('phone')")
  })
})
