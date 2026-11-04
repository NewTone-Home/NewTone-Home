import type { NpcIntent } from './npcCore'
import type { Point } from './sceneGeometry'

/**
 * One shared behaviour for every counter clerk (milk tea, fruit tea, Yonghe owner).
 * It is distilled from the café counter clerk: prepare while an order cooks,
 * wait/return to the station otherwise, pace between station and worktop while
 * idle, and answer the counter. Café story rules stay in the café coordinator.
 */
export type ShopClerkWork = { targetId: string; target?: Point; targetEntityId?: string }
export type ShopClerkConfig = { workerId: string; dutyPrefix: string; station: Point; work: ShopClerkWork }
export type ShopClerkOrderState = 'none' | 'preparing' | 'waiting-pickup'

export const shopClerkEngagedMs = 20000
export const shopClerkDwellRangeMs = [1500, 3200] as const

export function shopClerkStationIntent(config: ShopClerkConfig, duty: string): NpcIntent {
  return { dutyId: `${config.dutyPrefix}.${duty}`, targetId: `${config.workerId}.station`, target: config.station }
}

export function shopClerkWorkIntent(config: ShopClerkConfig, duty: string): NpcIntent {
  const { work } = config
  return work.targetEntityId
    ? { dutyId: `${config.dutyPrefix}.${duty}`, targetId: work.targetId, targetEntityId: work.targetEntityId }
    : { dutyId: `${config.dutyPrefix}.${duty}`, targetId: work.targetId, target: work.target ?? config.station }
}

export function shopClerkOrderIntent(config: ShopClerkConfig, state: ShopClerkOrderState): NpcIntent {
  if (state === 'preparing') return shopClerkWorkIntent(config, 'preparing')
  return shopClerkStationIntent(config, state === 'waiting-pickup' ? 'waiting-pickup' : 'return-to-station')
}

/** Idle pacing alternates worktop and station so the clerk keeps working the counter. */
export function createShopClerkAmbient() {
  let step = 0
  let nextAt = 0
  return {
    ready: (now: number) => now >= nextAt,
    next(config: ShopClerkConfig): NpcIntent {
      const intent = step % 2 === 0 ? shopClerkWorkIntent(config, 'counter-ambient') : shopClerkStationIntent(config, 'counter-ambient')
      step += 1
      return intent
    },
    dwell(now: number, random = Math.random) {
      nextAt = now + shopClerkDwellRangeMs[0] + random() * (shopClerkDwellRangeMs[1] - shopClerkDwellRangeMs[0])
    },
    reset() { step = 0; nextAt = 0 },
  }
}

export function shopClerkEngaged(engagedAt: number | null, now: number) {
  return engagedAt !== null && now - engagedAt < shopClerkEngagedMs
}
