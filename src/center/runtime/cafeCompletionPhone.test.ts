import { describe, expect, it } from 'vitest'
import { commercialCafeCompletionPhoneOpenedKey, commercialCafeCompletionPhonePatch } from './cafeCompletionPhone'
import { commercialCafeStoryStatusKey } from './commercialCafeStory'

describe('commercial Cafe completion phone handoff', () => {
  it('waits until the completed story is outside the Cafe with the inner phone', () => {
    const completed = { [commercialCafeStoryStatusKey]: 'complete' as const }
    expect(commercialCafeCompletionPhonePatch(undefined, { insideCafe: false, phoneDevice: 'inner' })).toBeNull()
    expect(commercialCafeCompletionPhonePatch({ [commercialCafeStoryStatusKey]: 'ready-to-leave' }, { insideCafe: false, phoneDevice: 'inner' })).toBeNull()
    expect(commercialCafeCompletionPhonePatch(completed, { insideCafe: true, phoneDevice: 'inner' })).toBeNull()
    expect(commercialCafeCompletionPhonePatch(completed, { insideCafe: false, phoneDevice: 'surface' })).toBeNull()
    expect(commercialCafeCompletionPhonePatch(completed, { insideCafe: false, phoneDevice: 'inner', readingActive: true })).toBeNull()
    expect(commercialCafeCompletionPhonePatch(completed, { insideCafe: false, phoneDevice: 'inner' })).toEqual({
      [commercialCafeCompletionPhoneOpenedKey]: true,
    })
  })

  it('does not hand off again after the consumed marker is saved', () => {
    expect(commercialCafeCompletionPhonePatch({
      [commercialCafeStoryStatusKey]: 'complete',
      [commercialCafeCompletionPhoneOpenedKey]: true,
    }, { insideCafe: false, phoneDevice: 'inner' })).toBeNull()
  })
})
