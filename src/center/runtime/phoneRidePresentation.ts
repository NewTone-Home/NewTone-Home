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
  const meters=remaining / 1000 * phoneDriverDisplayMetersPerSecond
  return remaining === 0 ? 0 : meters < 100 ? 50 : meters < 1000 ? Math.ceil(meters/100)*100 : Math.ceil(meters/1000)*1000
}
export function phoneDriverDistanceLabel(deadline:number,now:number) {
 const meters=phoneDriverDisplayDistance(deadline,now)
 return meters===0 ? '已到达' : meters<100 ? '不足 100 米' : meters>=1000 ? `约 ${meters/1000} 公里` : `约 ${meters} 米`
}
export function phoneDriverEtaLabel(deadline:number,now:number) {
 const remaining=Math.max(0,deadline-now)
 return remaining===0 ? '已到达' : remaining<60000 ? '即将到达' : `约 ${Math.ceil(remaining/60000)} 分钟`
}
