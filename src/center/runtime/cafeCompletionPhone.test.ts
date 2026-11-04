import { describe, expect, it } from 'vitest'
import {
  commercialCafeCompletionPhoneCanRequest,
  commercialCafeCompletionPhoneDisplayedKey,
  commercialCafeCompletionPhoneDisplayedPatch,
  commercialCafeCompletionPhoneMessageReadyForAck,
  commercialCafeCompletionPhonePendingKey,
  commercialCafeCompletionPhoneStoryPatch,
} from './cafeCompletionPhone'
import { commercialCafeStoryStatusKey } from './commercialCafeStory'
import { createInitialPlayerSave, recordPlayerSceneStatePatch, sanitizePlayerSave } from './playerSave'

describe('commercial Cafe completion phone handoff', () => {
  it('does not infer a new completion request from an older completed save', () => {
    const oldCompleted = { [commercialCafeStoryStatusKey]: 'complete' as const }
    expect(commercialCafeCompletionPhoneStoryPatch(oldCompleted, { [commercialCafeStoryStatusKey]: 'complete' })).toEqual({
      [commercialCafeStoryStatusKey]: 'complete',
    })
    expect(commercialCafeCompletionPhoneStoryPatch(undefined, { [commercialCafeStoryStatusKey]: 'complete' })).toEqual({
      [commercialCafeStoryStatusKey]: 'complete',
    })
  })

  it('persists a pending request only on the live ready-to-leave to complete transition', () => {
    const pending = commercialCafeCompletionPhoneStoryPatch(
      { [commercialCafeStoryStatusKey]: 'ready-to-leave' },
      { [commercialCafeStoryStatusKey]: 'complete' },
    )
    expect(pending[commercialCafeCompletionPhonePendingKey]).toBe(true)
    expect(commercialCafeCompletionPhoneCanRequest(pending, {
      insideCafe: false, phoneDevice: 'inner', readingActive: false, phoneOpen: false,
      phoneRetracted: true, traveling: false, rideBoarding: false,
    })).toBe(true)
  })

  it('keeps a pending request recoverable across refresh and retries when reading ends without movement', () => {
    const persisted = { [commercialCafeStoryStatusKey]: 'complete', [commercialCafeCompletionPhonePendingKey]: true }
    const blockedByReading = commercialCafeCompletionPhoneCanRequest(persisted, {
      insideCafe: false, phoneDevice: 'inner', readingActive: true, phoneOpen: false,
      phoneRetracted: true, traveling: false, rideBoarding: false,
    })
    const afterReadingEnds = commercialCafeCompletionPhoneCanRequest(persisted, {
      insideCafe: false, phoneDevice: 'inner', readingActive: false, phoneOpen: false,
      phoneRetracted: true, traveling: false, rideBoarding: false,
    })
    expect(blockedByReading).toBe(false)
    expect(afterReadingEnds).toBe(true)
  })

  it('preserves the pending handoff through player-save serialization and reload', () => {
    const save = createInitialPlayerSave('commercial-street')
    const pendingSave = recordPlayerSceneStatePatch(save, 'commercial-cafe', {
      [commercialCafeStoryStatusKey]: 'complete',
      [commercialCafeCompletionPhonePendingKey]: true,
    })
    const restored = sanitizePlayerSave(JSON.parse(JSON.stringify(pendingSave)), 'commercial-street')
    expect(restored.sceneState['commercial-cafe']?.[commercialCafeCompletionPhonePendingKey]).toBe(true)
    expect(commercialCafeCompletionPhoneCanRequest(restored.sceneState['commercial-cafe'], {
      insideCafe: false, phoneDevice: 'inner', readingActive: false, phoneOpen: false,
      phoneRetracted: true, traveling: false, rideBoarding: false,
    })).toBe(true)
  })

  it('waits through same-callback ride boarding and any other phone owner', () => {
    const persisted = { [commercialCafeCompletionPhonePendingKey]: true }
    const canRequest = (overrides: Partial<Parameters<typeof commercialCafeCompletionPhoneCanRequest>[1]>) => (
      commercialCafeCompletionPhoneCanRequest(persisted, {
        insideCafe: false, phoneDevice: 'inner', readingActive: false, phoneOpen: false,
        phoneRetracted: true, traveling: false, rideBoarding: false, ...overrides,
      })
    )
    expect(canRequest({ rideBoarding: true })).toBe(false)
    expect(canRequest({ traveling: true })).toBe(false)
    expect(canRequest({ phoneOpen: true })).toBe(false)
    expect(canRequest({ phoneRetracted: false })).toBe(false)
  })

  it('marks displayed only on the explicit message-page acknowledgement', () => {
    const pending = { [commercialCafeCompletionPhonePendingKey]: true }
    expect(commercialCafeCompletionPhoneDisplayedPatch(undefined)).toBeNull()
    expect(commercialCafeCompletionPhoneDisplayedPatch(pending)).toEqual({
      [commercialCafeCompletionPhonePendingKey]: false,
      [commercialCafeCompletionPhoneDisplayedKey]: true,
    })
    expect(commercialCafeCompletionPhoneDisplayedPatch({ ...pending, [commercialCafeCompletionPhoneDisplayedKey]: true })).toBeNull()
  })

  it('acknowledges the phone request only after the actual Lao Zhou messages thread is mounted', () => {
    const request = { requested: true, phoneOpen: true, activeApp: 'contacts', contactView: 'messages', selectedContactId: 'lao-zhou' }
    expect(commercialCafeCompletionPhoneMessageReadyForAck({ ...request, messageThreadMounted: false })).toBe(false)
    expect(commercialCafeCompletionPhoneMessageReadyForAck({ ...request, contactView: 'detail', messageThreadMounted: true })).toBe(false)
    expect(commercialCafeCompletionPhoneMessageReadyForAck({ ...request, phoneOpen: false, messageThreadMounted: true })).toBe(false)
    expect(commercialCafeCompletionPhoneMessageReadyForAck({ ...request, messageThreadMounted: true })).toBe(true)
  })
})
