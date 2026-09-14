import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  clearCenterCompletionFeedbackPrompt,
  hasShownCenterCompletionFeedbackPrompt,
  hasSubmittedCenterCompletionFeedback,
  markCenterCompletionFeedbackSubmitted,
  markCenterCompletionFeedbackPromptShown,
} from '../src/services/centerFeedback'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

function createStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

describe('Center playable-completion feedback contract', () => {
  it('persists the completion prompt separately from the legacy prompt key', () => {
    const storage = createStorage()
    expect(hasShownCenterCompletionFeedbackPrompt(storage)).toBe(false)
    expect(markCenterCompletionFeedbackPromptShown(storage)).toBe(true)
    expect(hasShownCenterCompletionFeedbackPrompt(storage)).toBe(true)
    expect(clearCenterCompletionFeedbackPrompt(storage)).toBe(true)
    expect(hasShownCenterCompletionFeedbackPrompt(storage)).toBe(false)
  })

  it('tracks prompt display and successful submission separately', () => {
    const storage = createStorage()
    expect(hasSubmittedCenterCompletionFeedback(storage)).toBe(false)
    expect(markCenterCompletionFeedbackPromptShown(storage)).toBe(true)
    expect(hasShownCenterCompletionFeedbackPrompt(storage)).toBe(true)
    expect(hasSubmittedCenterCompletionFeedback(storage)).toBe(false)
    expect(markCenterCompletionFeedbackSubmitted(storage)).toBe(true)
    expect(hasSubmittedCenterCompletionFeedback(storage)).toBe(true)
  })

  it('opens only from the valid inner-world ride completion path', () => {
    const experience = read('../src/center/CenterExperience.jsx')
    expect(experience).toContain("trackEvent('center_ride_ready'")
    expect(experience).toContain("trigger: 'playable-completion'")
    expect(experience).toContain("device === 'inner' && layer === 'inner'")
    expect(experience).toContain("setFeedbackMode('completion-prompt')")
  })
})
