import { mainlineStoryTimeLabel, type MainlineStoryClock } from './mainlineStoryClock'

// Phone presentation estimates only: neither real geography nor a StoryClock update.
const tripMinutes: Record<string, number> = { 'commercial:zhongshuyuan': 12, 'commercial:mine': 18, 'mine:zhongshuyuan': 24 }
export function phoneRideTripEstimate(sourceId: string | undefined, targetId: string | null, clock: MainlineStoryClock) {
  if (!sourceId || !targetId) return null
  const minutes = tripMinutes[[sourceId, targetId].sort().join(':')]
  if (!minutes) return null
  const [hour, minute] = mainlineStoryTimeLabel(clock.stage).split(':').map(Number)
  const arrival = (hour * 60 + minute + minutes) % (24 * 60)
  return { minutes, arrivalLabel: `${String(Math.floor(arrival / 60)).padStart(2, '0')}:${String(arrival % 60).padStart(2, '0')}` }
}
// Estimated visual distance, not GPS. Deadline remains owned by mainlineRide.
export const phoneDriverDisplayMetersPerSecond = 6
export function phoneDriverDisplayDistance(driverArrivesAt: number, now: number) {
  const remaining = Math.max(0, driverArrivesAt - now)
  return remaining === 0 ? 0 : Math.ceil(remaining / 1000 * phoneDriverDisplayMetersPerSecond / 5) * 5
}
