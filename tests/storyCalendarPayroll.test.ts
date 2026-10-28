import { describe, expect, it } from 'vitest'
import {
  advanceMainlineStoryClock,
  createInitialMainlineStoryClock,
  daysInStoryMonth,
  gameMinuteOfDay,
  isStoryNight,
  mainlineStoryDateLabel,
  storyCalendarLeadingBlankCount,
  storyWeekday,
} from '../src/center/runtime/mainlineStoryClock'
import { advancePlayerStoryDate, createInitialPlayerSave, loadPlayerSave, PLAYER_SAVE_STORAGE_KEY, sanitizePlayerSave, savePlayerSave } from '../src/center/runtime/playerSave'
import { PUBLIC_RELEASE_CUTOVER_ID, PUBLIC_RELEASE_CUTOVER_STORAGE_KEY } from '../src/services/publicReleaseMigration'

const at = (hour: number, minute = 0) => (hour * 60 + minute) * 60_000

describe('story calendar and day/night clock', () => {
  it('starts every scene at 10:00 on April 12 and does not reset the shared time on travel', () => {
    const clock = createInitialMainlineStoryClock('commercial-street')
    expect(clock).toMatchObject({ year: 2025, month: 4, day: 12, weekday: 6, hour: 10, minute: 0 })

    const atCafe = advanceMainlineStoryClock({ ...clock, hour: 17, minute: 42 }, 'commercial-cafe')
    const atYonghe = advanceMainlineStoryClock(atCafe, 'yonghe-eatery')
    expect(atCafe).toMatchObject({ stage: 'cafe', month: 4, day: 12, hour: 17, minute: 42 })
    expect(atYonghe).toMatchObject({ stage: 'yonghe', month: 4, day: 12, hour: 17, minute: 42 })
  })

  it('loops time-of-day at midnight without changing the narrative date or triggering salary', () => {
    const save = createInitialPlayerSave('jijia-ancestral-home')
    const afterClockLoop = { ...save, gameTimeMs: 24 * 60 * 60_000 + at(0, 5) }
    expect(gameMinuteOfDay(afterClockLoop.gameTimeMs)).toBe(5)
    expect(afterClockLoop.storyClock).toMatchObject({ year: 2025, month: 4, day: 12 })
    expect(advancePlayerStoryDate(save, { year: 2025, month: 4, day: 12 })).toBe(save)
    expect(save.walletBalance).toBe(800)
    expect(save.monthlySalaryReceipts).toEqual({})
  })

  it('switches night on at 19:00 and day on at 06:00', () => {
    expect(isStoryNight(at(5, 59))).toBe(true)
    expect(isStoryNight(at(6))).toBe(false)
    expect(isStoryNight(at(18, 59))).toBe(false)
    expect(isStoryNight(at(19))).toBe(true)
    expect(isStoryNight(at(23, 59))).toBe(true)
    expect(isStoryNight(at(0))).toBe(true)
  })

  it('renders calendar months with their actual day counts and Monday-first alignment', () => {
    expect(daysInStoryMonth(2025, 2)).toBe(28)
    expect(daysInStoryMonth(2028, 2)).toBe(29)
    expect(daysInStoryMonth(1900, 2)).toBe(28)
    expect(daysInStoryMonth(2000, 2)).toBe(29)
    expect(daysInStoryMonth(2025, 4)).toBe(30)
    expect(daysInStoryMonth(2025, 5)).toBe(31)
    expect(storyCalendarLeadingBlankCount(2025, 4)).toBe(1)
    expect(storyWeekday(2025, 4, 12)).toBe(6)
    expect(mainlineStoryDateLabel({ year: 2028, month: 2, day: 29 })).toBe('2月29日')
  })
})

describe('monthly salary credits on narrative month-end crossings', () => {
  it('pays the first 1,500 only when the plot date reaches April 30', () => {
    const start = createInitialPlayerSave()
    const beforePayday = advancePlayerStoryDate(start, { year: 2025, month: 4, day: 29 })
    expect(beforePayday.walletBalance).toBe(800)
    expect(beforePayday.monthlySalaryReceipts).toEqual({})

    const payday = advancePlayerStoryDate(beforePayday, { year: 2025, month: 4, day: 30 })
    expect(payday.walletBalance).toBe(2_300)
    expect(payday.monthlySalaryReceipts['2025-04']).toMatchObject({ year: 2025, month: 4, amount: 1_500, paidOnDay: 30 })
    expect(advancePlayerStoryDate(payday, { year: 2025, month: 4, day: 30 })).toBe(payday)
    expect(sanitizePlayerSave(payday, payday.currentSceneId).walletBalance).toBe(2_300)
  })

  it('catches up each crossed month once when authored story dates skip forward', () => {
    const start = createInitialPlayerSave()
    const skipped = advancePlayerStoryDate(start, { year: 2025, month: 7, day: 3 })
    expect(skipped.walletBalance).toBe(5_300)
    expect(Object.keys(skipped.monthlySalaryReceipts)).toEqual(['2025-04', '2025-05', '2025-06'])
    expect(skipped.monthlySalaryReceipts['2025-04'].paidOnDay).toBe(30)
    expect(skipped.monthlySalaryReceipts['2025-05'].paidOnDay).toBe(31)
    expect(skipped.monthlySalaryReceipts['2025-06'].paidOnDay).toBe(30)
    expect(advancePlayerStoryDate(skipped, { year: 2025, month: 7, day: 3 }).walletBalance).toBe(5_300)
  })

  it('persists the calendar and payroll receipt together and does not re-credit after reload', () => {
    const values = new Map<string, string>([[PUBLIC_RELEASE_CUTOVER_STORAGE_KEY, PUBLIC_RELEASE_CUTOVER_ID]])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const advanced = advancePlayerStoryDate(createInitialPlayerSave(), { year: 2025, month: 7, day: 3 })
    savePlayerSave(advanced, storage, 100)
    expect(values.has(PLAYER_SAVE_STORAGE_KEY)).toBe(true)

    const restored = loadPlayerSave(storage)
    expect(restored).toMatchObject({
      walletBalance: 5_300,
      storyClock: { year: 2025, month: 7, day: 3 },
      monthlySalaryReceipts: {
        '2025-04': { amount: 1_500, paidOnDay: 30 },
        '2025-05': { amount: 1_500, paidOnDay: 31 },
        '2025-06': { amount: 1_500, paidOnDay: 30 },
      },
    })
    expect(advancePlayerStoryDate(restored, { year: 2025, month: 7, day: 3 }).walletBalance).toBe(5_300)
  })

  it('uses leap-year February and crosses December into the next year correctly', () => {
    const leapStart = sanitizePlayerSave({
      ...createInitialPlayerSave(),
      storyClock: { ...createInitialMainlineStoryClock('commercial-street'), year: 2028, month: 1, day: 12 },
    }, 'commercial-street')
    const leapJump = advancePlayerStoryDate(leapStart, { year: 2028, month: 3, day: 2 })
    expect(Object.keys(leapJump.monthlySalaryReceipts)).toEqual(['2028-01', '2028-02'])
    expect(leapJump.monthlySalaryReceipts['2028-02'].paidOnDay).toBe(29)

    const yearEndStart = sanitizePlayerSave({
      ...createInitialPlayerSave(),
      storyClock: { ...createInitialMainlineStoryClock('commercial-street'), year: 2028, month: 12, day: 30 },
    }, 'commercial-street')
    const yearJump = advancePlayerStoryDate(yearEndStart, { year: 2029, month: 1, day: 2 })
    expect(Object.keys(yearJump.monthlySalaryReceipts)).toEqual(['2028-12'])
    expect(yearJump.walletBalance).toBe(2_300)
  })

  it('does not retroactively pay a legacy save on load or pay on a backwards date change', () => {
    const base = createInitialPlayerSave()
    const legacy = { ...base, walletBalance: 460, storyClock: { ...base.storyClock, year: 2025, month: 5, day: 1 } }
    delete (legacy as Partial<typeof legacy>).monthlySalaryReceipts
    const restored = sanitizePlayerSave(legacy, legacy.currentSceneId)
    expect(restored.walletBalance).toBe(460)
    expect(restored.monthlySalaryReceipts).toEqual({})
    expect(advancePlayerStoryDate(restored, { year: 2025, month: 4, day: 30 })).toBe(restored)
    expect(restored.walletBalance).toBe(460)
  })
})
