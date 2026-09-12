import { describe, expect, it } from 'vitest'
import {
  clearCenterFeedbackPrompt,
  hasShownCenterFeedbackPrompt,
  markCenterFeedbackPromptShown,
} from '../src/services/centerFeedback'

function createStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

describe('Center feedback prompt persistence', () => {
  it('shows the exit questionnaire once per anonymous visitor', () => {
    const storage = createStorage()
    expect(hasShownCenterFeedbackPrompt(storage)).toBe(false)
    expect(markCenterFeedbackPromptShown(storage)).toBe(true)
    expect(hasShownCenterFeedbackPrompt(storage)).toBe(true)
    expect(clearCenterFeedbackPrompt(storage)).toBe(true)
    expect(hasShownCenterFeedbackPrompt(storage)).toBe(false)
  })
})
