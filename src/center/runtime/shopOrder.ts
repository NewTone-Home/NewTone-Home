import type { PlayerChoiceValue, PlayerSceneState } from './playerSave'

/** Storage keys and historical timings are supplied by each shop adapter. */
export type ShopOrderConfig<Selection extends object> = {
  keys: {
    orderNumber: string
    lastOrderNumber: string
    readyAt: string
    createdAt: string
    queueAhead: string
    heldItem: string
  }
  minimumPreparationMs: number
  maximumPreparationMs: number
  maxOrderNumber?: number
  queueAheadForOrder?: (orderNumber: number) => number
  heldValue: string
  selectionKeys: readonly string[]
  readSelection: (state: PlayerSceneState) => Selection | null
  selectionPatch: (selection: Selection) => Record<string, PlayerChoiceValue>
}

export type ShopOrder<Selection extends object> = Selection & {
  number: number
  readyAt: number
  createdAt: number
  queueAhead: number
}

function isOrderNumber(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maximum
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function nextShopOrderNumber(previous: unknown, maximum = 999) {
  return isOrderNumber(previous, maximum) && previous < maximum ? previous + 1 : 1
}

export function shopPreparationDurationMs<Selection extends object>(
  config: ShopOrderConfig<Selection>,
  random: () => number = Math.random,
) {
  const sample = Math.max(0, Math.min(1, random()))
  return config.minimumPreparationMs + Math.floor(sample * (config.maximumPreparationMs - config.minimumPreparationMs))
}

export function createShopOrder<Selection extends object>(
  state: PlayerSceneState | undefined,
  selection: Selection,
  config: ShopOrderConfig<Selection>,
  now = Date.now(),
  random: () => number = Math.random,
): ShopOrder<Selection> {
  const number = nextShopOrderNumber(state?.[config.keys.lastOrderNumber], config.maxOrderNumber)
  return {
    number,
    ...selection,
    readyAt: now + shopPreparationDurationMs(config, random),
    createdAt: now,
    queueAhead: config.queueAheadForOrder?.(number) ?? 0,
  }
}

export function shopOrderFromState<Selection extends object>(
  state: PlayerSceneState | undefined,
  config: ShopOrderConfig<Selection>,
): ShopOrder<Selection> | null {
  if (!state) return null
  const maximum = config.maxOrderNumber ?? 999
  const number = state[config.keys.orderNumber]
  const readyAt = state[config.keys.readyAt]
  const selection = config.readSelection(state)
  if (!isOrderNumber(number, maximum) || !isTimestamp(readyAt) || !selection) return null
  const createdAt = isTimestamp(state[config.keys.createdAt])
    ? state[config.keys.createdAt] as number
    : readyAt - config.minimumPreparationMs
  const queueAhead = typeof state[config.keys.queueAhead] === 'number'
    ? Math.max(0, Math.floor(state[config.keys.queueAhead] as number))
    : 0
  return { number, ...selection, readyAt, createdAt, queueAhead }
}

export function shopOrderPatch<Selection extends object>(
  order: ShopOrder<Selection>,
  config: ShopOrderConfig<Selection>,
): Record<string, PlayerChoiceValue> {
  return {
    [config.keys.orderNumber]: order.number,
    [config.keys.lastOrderNumber]: order.number,
    ...config.selectionPatch(order),
    [config.keys.readyAt]: order.readyAt,
    [config.keys.createdAt]: order.createdAt,
    [config.keys.queueAhead]: order.queueAhead,
  }
}

export function shopPickupPatch<Selection extends object>(
  config: ShopOrderConfig<Selection>,
): Record<string, PlayerChoiceValue> {
  return {
    [config.keys.orderNumber]: null,
    ...Object.fromEntries(config.selectionKeys.map(key => [key, null])),
    [config.keys.readyAt]: null,
    [config.keys.createdAt]: null,
    [config.keys.queueAhead]: null,
    [config.keys.heldItem]: config.heldValue,
  }
}

export function shopItemIsHeld<Selection extends object>(
  state: PlayerSceneState | undefined,
  config: ShopOrderConfig<Selection>,
) {
  return state?.[config.keys.heldItem] === config.heldValue
}

export function shopPickupAllowed<Selection extends object>(
  state: PlayerSceneState | undefined,
  order: ShopOrder<Selection> | null,
  config: ShopOrderConfig<Selection>,
  now = Date.now(),
) {
  return !shopItemIsHeld(state, config) && !!order && now >= order.readyAt
}

export function shopOrderIsReady<Selection extends object>(order: ShopOrder<Selection>, now = Date.now()) {
  return now >= order.readyAt
}

export function shopOrderQueueStatus<Selection extends object>(
  order: ShopOrder<Selection>,
  now = Date.now(),
) {
  if (shopOrderIsReady(order, now)) return { phase: 'ready' as const, ahead: 0, progress: 1 }
  const duration = Math.max(1, order.readyAt - order.createdAt)
  const progress = Math.max(0, Math.min(1, (now - order.createdAt) / duration))
  return { phase: 'pending' as const, ahead: Math.max(0, Math.ceil(order.queueAhead * (1 - progress))), progress }
}

export function formatShopOrderNumber(number: number) {
  return String(number).padStart(3, '0')
}

export function consumeShopItemPatch<Selection extends object>(
  config: ShopOrderConfig<Selection>,
): PlayerSceneState {
  return { [config.keys.heldItem]: null }
}
