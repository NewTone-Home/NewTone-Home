import { describe, expect, it } from 'vitest'
import {
  advanceMainlineStoryClock,
  createInitialMainlineStoryClock,
  mainlineStoryDateLabel,
  mainlineStoryTimeLabel,
  mainlineWorldWeatherLabel,
} from '../src/center/runtime/mainlineStoryClock'
import { loadPlayerSave, PLAYER_SAVE_STORAGE_KEY, savePlayerSave } from '../src/center/runtime/playerSave'
import { PUBLIC_RELEASE_CUTOVER_ID, PUBLIC_RELEASE_CUTOVER_STORAGE_KEY } from '../src/services/publicReleaseMigration'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('story clock', () => {
  it('uses narrative calendar labels rather than the device date', () => {
    expect(mainlineStoryDateLabel()).toBe('4月12日')
    expect(mainlineWorldWeatherLabel('inner')).toBe('☀ 18°')
    expect(mainlineStoryTimeLabel('opening')).toBe('10:00')
  })

  it('advances at story scene milestones and never rewinds when returning to an earlier scene', () => {
    const initial = createInitialMainlineStoryClock('jijia-ancestral-home')
    const street = advanceMainlineStoryClock(initial, 'commercial-street')
    const cafe = advanceMainlineStoryClock(street, 'commercial-cafe')
    const yonghe = advanceMainlineStoryClock(cafe, 'yonghe-eatery')

    expect(street.stage).toBe('commercial-street')
    expect(cafe.stage).toBe('cafe')
    expect(yonghe.stage).toBe('yonghe')
    expect(advanceMainlineStoryClock(yonghe, 'commercial-street')).toBe(yonghe)
  })

  it('persists the story-clock stage and migrates existing saves from their current scene', () => {
    const storage = createStorage()
    storage.setItem(PUBLIC_RELEASE_CUTOVER_STORAGE_KEY, PUBLIC_RELEASE_CUTOVER_ID)
    const oldSave = { currentSceneId: 'commercial-cafe', phoneDevice: 'inner', updatedAt: 5 }
    storage.setItem(PLAYER_SAVE_STORAGE_KEY, JSON.stringify(oldSave))
    const loaded = loadPlayerSave(storage)

    expect(loaded.storyClock).toMatchObject({ dayId: 'story-day-001', stage: 'cafe', month:4, day:12, weekday:6, hour:12, minute:0, weatherCycle:'sunny' })
    savePlayerSave(loaded, storage, 10)
    expect(JSON.parse(storage.getItem(PLAYER_SAVE_STORAGE_KEY) ?? '{}').storyClock).toEqual(loaded.storyClock)
  })
})
