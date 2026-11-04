import { mainlineScenes } from './mainlineScenes'

/**
 * Where the cafe sits on the world map, relative to the commercial region centre (map units).
 * Derived from the cafe's real position along the street: the street's shopfronts span
 * `planWidth` map units, centred on the region; the cafe is in the north row.
 */
const planWidth = 22
const northRowCenterY = -3.1

let cached: readonly [number, number] | null = null
export function phoneCommercialCafeCenter(): readonly [number, number] {
  if (cached) return cached
  const slots = mainlineScenes['commercial-street'].storefronts.filter(slot => slot.id.includes('-slot'))
  const minX = Math.min(...slots.map(slot => slot.start))
  const maxX = Math.max(...slots.map(slot => slot.end))
  const cafe = slots.find(slot => slot.id === 'commercial-cafe-slot')!
  const scale = planWidth / (maxX - minX)
  cached = [((cafe.start + cafe.end) / 2 - (minX + maxX) / 2) * scale, northRowCenterY] as const
  return cached
}
