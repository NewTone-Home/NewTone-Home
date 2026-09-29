import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

describe('Center completion-feedback retirement', () => {
  it('keeps Chapter 2 completion outside survey and automatic Feedback flows', () => {
    const experience = read('../src/center/CenterExperience.jsx')
    expect(experience).toContain("trackEvent('center_ride_ready'")
    expect(experience).not.toContain('handlePlayableCompletion')
    expect(experience).not.toContain('completion-prompt')
    expect(experience).not.toContain('center_feedback_prompt_shown')
    expect(experience).toContain('setPhoneOpen(false)')
  })

  it('keeps Feedback voluntary after retired survey flags are ignored', () => {
    const phone = read('../src/center/runtime/WorldPhone.tsx')
    const service = read('../src/services/centerFeedback.js')
    expect(phone).toContain("type FeedbackMode = 'phone'")
    expect(phone).toContain('data-app="feedback"')
    expect(phone).not.toContain('experience-length')
    expect(service).not.toContain('newtone-center-feedback-completion-shown-v1')
    expect(service).not.toContain('newtone-center-feedback-prompt-shown-v1')
  })
})
