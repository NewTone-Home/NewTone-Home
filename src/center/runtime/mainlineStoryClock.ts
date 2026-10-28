import type { MainlineSceneId } from './mainlineSceneModel'

export type MainlineStoryStage = 'opening' | 'commercial-street' | 'cafe' | 'yonghe'

export type MainlineStoryClock = {
  dayId: 'story-day-001'
  stage: MainlineStoryStage
  year?: number
  month?: number
  day?: number
  weekday?: number
  hour?: number
  minute?: number
  weatherCycle?: 'sunny' | 'rainy'
}

const stageOrder: Record<MainlineStoryStage, number> = {
  opening: 0,
  'commercial-street': 1,
  cafe: 2,
  yonghe: 3,
}

export function mainlineStoryStageForScene(sceneId: MainlineSceneId): MainlineStoryStage | null {
  if (sceneId === 'jijia-ancestral-home' || sceneId === 'jijia-ancestral-interior') return 'opening'
  if (sceneId === 'commercial-street') return 'commercial-street'
  if (sceneId === 'commercial-cafe') return 'cafe'
  if (sceneId === 'yonghe-mining-perimeter' || sceneId === 'yonghe-eatery') return 'yonghe'
  return null
}

export function createInitialMainlineStoryClock(sceneId: MainlineSceneId): MainlineStoryClock {
  const clock = storyClockForStage(mainlineStoryStageForScene(sceneId) ?? 'opening')
  return { ...clock, hour: 10, minute: 0 }
}

export function advanceMainlineStoryClock(
  clock: MainlineStoryClock,
  sceneId: MainlineSceneId,
): MainlineStoryClock {
  const stage = mainlineStoryStageForScene(sceneId)
  if (!stage || stageOrder[stage] <= stageOrder[clock.stage]) return clock
  // Scene progress changes the narrative stage. The shared game clock and
  // narrative date keep their current values across travel.
  return { ...clock, stage }
}

export function storyClockForStage(stage: MainlineStoryStage): MainlineStoryClock {
  const times = { opening: [10, 0], 'commercial-street': [11, 0], cafe: [12, 0], yonghe: [12, 30] }
  const [hour, minute] = times[stage]
  return { dayId: 'story-day-001', stage, year: 2025, month: 4, day: 12, weekday: 6, hour, minute, weatherCycle: 'sunny' }
}

export function mainlineStoryTimeLabel(stage: MainlineStoryStage): string {
  const clock = storyClockForStage(stage)
  return `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`
}
export function mainlineStoryDateLabel(clock: Pick<MainlineStoryClock, 'month' | 'day' | 'year'> = {}): string { return storyDateLabel(clock) }
function storyCalendarUtcDate(year: number, month: number, day: number): Date {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export function daysInStoryMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) return 30
  const date = new Date(0)
  date.setUTCFullYear(year, month, 0)
  date.setUTCHours(0, 0, 0, 0)
  return date.getUTCDate()
}

export function storyCalendarLeadingBlankCount(year: number, month: number): number {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) return 0
  const weekday = storyCalendarUtcDate(year, month, 1).getUTCDay()
  return (weekday + 6) % 7
}

export function storyWeekday(year: number, month: number, day: number): number {
  if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12
    || !Number.isInteger(day) || day < 1 || day > daysInStoryMonth(year, month)) return 0
  return storyCalendarUtcDate(year, month, day).getUTCDay()
}

export function gameMinuteOfDay(gameTimeMs: number): number {
  if (!Number.isFinite(gameTimeMs) || gameTimeMs < 0) return 0
  return Math.floor(gameTimeMs / 60_000) % (24 * 60)
}

export function isStoryNight(gameTimeMs: number): boolean {
  const minuteOfDay = gameMinuteOfDay(gameTimeMs)
  return minuteOfDay < 6 * 60 || minuteOfDay >= 19 * 60
}

export function mainlineTimeOfDayLabel(gameTimeMs: number): string {
  const minuteOfDay = gameMinuteOfDay(gameTimeMs)
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`
}

export function storyDateLabel(clock: Pick<MainlineStoryClock, 'month' | 'day' | 'year'> = {}): string {
  const month = Number.isInteger(clock.month) && clock.month! >= 1 && clock.month! <= 12 ? clock.month! : 4
  const year = Number.isInteger(clock.year) && clock.year! > 0 ? clock.year! : 2025
  const day = Number.isInteger(clock.day) && clock.day! >= 1 && clock.day! <= daysInStoryMonth(year, month) ? clock.day! : 12
  return `${month}月${day}日`
}

export function mainlineWorldWeatherLabel(_device: 'surface' | 'inner', cycle: 'sunny' | 'rainy' = 'sunny'): string {
  return cycle === 'rainy' ? '🌧 14°' : '☀ 18°'
}
