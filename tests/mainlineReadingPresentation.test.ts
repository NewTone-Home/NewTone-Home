import { describe, expect, it } from 'vitest'
import { mainlineReadingPresentationForPhase, type MainlineReadingPresentationSnapshot } from '../src/center/runtime/mainlineReadingPresentation'

const active: MainlineReadingPresentationSnapshot = {
  sessionKey: 'scene:observation:echo:7:plant',
  position: { x: 42, y: 27 },
  cameraOffset: { x: -3, y: 2 },
  layout: { widthPx: 240, heightPx: 64, fontSizePx: 16 },
  maxWidthPx: 280,
  text: 'A short observation',
  overflowIndex: 1,
}

describe('mainline reading presentation retention', () => {
  it('uses the fitted active placement and carries that exact placement into leaving', () => {
    const fitted = { ...active, position: { x: 48, y: 21 } }
    expect(mainlineReadingPresentationForPhase('active', active.sessionKey, fitted, null)).toBe(fitted)
    expect(mainlineReadingPresentationForPhase('leaving', active.sessionKey, null, fitted)).toBe(fitted)
  })

  it('does not reuse a prior session position when a new session enters or leaves without a capture', () => {
    const nextSession = 'scene:observation:echo:8:plant'
    expect(mainlineReadingPresentationForPhase('active', nextSession, null, active)).toBeNull()
    expect(mainlineReadingPresentationForPhase('leaving', nextSession, null, active)).toBeNull()
    expect(mainlineReadingPresentationForPhase('inactive', null, null, active)).toBeNull()
  })

  it('keeps the captured dialogue segment, page and camera offset through its exit fade', () => {
    const dialogue = { ...active, sessionKey: 'scene:dialogue:conversation-seat:42', text: 'Current fitted dialogue segment' }
    expect(mainlineReadingPresentationForPhase('leaving', dialogue.sessionKey, null, dialogue)).toEqual(dialogue)
  })
})
