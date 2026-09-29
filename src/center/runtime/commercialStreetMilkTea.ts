import type { PlayerChoiceValue, PlayerSceneState } from './playerSave'

export const commercialStreetMilkTeaStorefrontId = 'commercial-south-slot-5'
export const commercialStreetMilkTeaOrderNumberKey = 'commercialStreetMilkTeaOrderNumber'
export const commercialStreetMilkTeaLastOrderNumberKey = 'commercialStreetMilkTeaLastOrderNumber'
export const commercialStreetMilkTeaDrinkKey = 'commercialStreetMilkTeaDrink'
export const commercialStreetMilkTeaSugarKey = 'commercialStreetMilkTeaSugar'
export const commercialStreetMilkTeaIceKey = 'commercialStreetMilkTeaIce'
export const commercialStreetMilkTeaReadyAtKey = 'commercialStreetMilkTeaReadyAt'
export const commercialStreetMilkTeaHeldDrinkKey = 'commercialStreetMilkTeaHeldDrink'
export const commercialStreetMilkTeaAppUnlockedKey = 'commercialStreetMilkTeaAppUnlocked'
export const commercialStreetMilkTeaCreatedAtKey = 'commercialStreetMilkTeaCreatedAt'
export const commercialStreetMilkTeaQueueAheadKey = 'commercialStreetMilkTeaQueueAhead'

export const milkTeaDrinks = ['原味奶茶', '黑糖珍珠奶茶', '芋泥奶茶', '茉莉奶绿'] as const
export const milkTeaSugarOptions = ['少糖', '正常', '多糖'] as const
export const milkTeaIceOptions = ['少冰', '正常冰', '去冰'] as const

export type MilkTeaDrink = typeof milkTeaDrinks[number]
export type MilkTeaSugar = typeof milkTeaSugarOptions[number]
export type MilkTeaIce = typeof milkTeaIceOptions[number]

export type CommercialStreetMilkTeaOrder = {
  number: number
  drink: MilkTeaDrink
  sugar: MilkTeaSugar
  ice: MilkTeaIce
  readyAt: number
  createdAt: number
  queueAhead: number
}

const minimumPreparationMs = 15_000
const maximumPreparationMs = 30_000

function includes<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value)
}

function validOrderNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 999
}

function validReadyAt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function commercialStreetMilkTeaOrderFromSceneState(sceneState: PlayerSceneState | undefined): CommercialStreetMilkTeaOrder | null {
  const number = sceneState?.[commercialStreetMilkTeaOrderNumberKey]
  const drink = sceneState?.[commercialStreetMilkTeaDrinkKey]
  const sugar = sceneState?.[commercialStreetMilkTeaSugarKey]
  const ice = sceneState?.[commercialStreetMilkTeaIceKey]
  const readyAt = sceneState?.[commercialStreetMilkTeaReadyAtKey]
  if (!validOrderNumber(number) || !includes(milkTeaDrinks, drink) || !includes(milkTeaSugarOptions, sugar) || !includes(milkTeaIceOptions, ice) || !validReadyAt(readyAt)) return null
  const createdAt = validReadyAt(sceneState?.[commercialStreetMilkTeaCreatedAtKey])
    ? sceneState![commercialStreetMilkTeaCreatedAtKey] as number
    : readyAt - minimumPreparationMs
  const queueAhead = typeof sceneState?.[commercialStreetMilkTeaQueueAheadKey] === 'number'
    ? Math.max(0, Math.floor(sceneState![commercialStreetMilkTeaQueueAheadKey] as number))
    : 0
  return { number, drink, sugar, ice, readyAt, createdAt, queueAhead }
}

export function commercialStreetMilkTeaAppUnlocked(sceneState: PlayerSceneState | undefined) {
  return sceneState?.[commercialStreetMilkTeaAppUnlockedKey] === true
}

export function commercialStreetMilkTeaAppUnlockPatch(): Record<string, PlayerChoiceValue> {
  return { [commercialStreetMilkTeaAppUnlockedKey]: true }
}

export function commercialStreetMilkTeaHeld(sceneState: PlayerSceneState | undefined) {
  return sceneState?.[commercialStreetMilkTeaHeldDrinkKey] === 'milk-tea'
}

export function nextCommercialStreetMilkTeaOrderNumber(previous: unknown) {
  return validOrderNumber(previous) && previous < 999 ? previous + 1 : 1
}

export function milkTeaPreparationDurationMs(random: () => number = Math.random) {
  return minimumPreparationMs + Math.floor(Math.max(0, Math.min(1, random())) * (maximumPreparationMs - minimumPreparationMs))
}

export function createCommercialStreetMilkTeaOrder(
  sceneState: PlayerSceneState | undefined,
  selection: Pick<CommercialStreetMilkTeaOrder, 'drink' | 'sugar' | 'ice'>,
  now: number = Date.now(),
  random: () => number = Math.random,
): CommercialStreetMilkTeaOrder {
  return {
    number: nextCommercialStreetMilkTeaOrderNumber(sceneState?.[commercialStreetMilkTeaLastOrderNumberKey]),
    ...selection,
    readyAt: now + milkTeaPreparationDurationMs(random),
    createdAt: now,
    queueAhead: nextCommercialStreetMilkTeaOrderNumber(sceneState?.[commercialStreetMilkTeaLastOrderNumberKey]) % 4 + 1,
  }
}

export function commercialStreetMilkTeaOrderPatch(order: CommercialStreetMilkTeaOrder): Record<string, PlayerChoiceValue> {
  return {
    [commercialStreetMilkTeaOrderNumberKey]: order.number,
    [commercialStreetMilkTeaLastOrderNumberKey]: order.number,
    [commercialStreetMilkTeaDrinkKey]: order.drink,
    [commercialStreetMilkTeaSugarKey]: order.sugar,
    [commercialStreetMilkTeaIceKey]: order.ice,
    [commercialStreetMilkTeaReadyAtKey]: order.readyAt,
    [commercialStreetMilkTeaCreatedAtKey]: order.createdAt,
    [commercialStreetMilkTeaQueueAheadKey]: order.queueAhead,
  }
}

export function commercialStreetMilkTeaPickupPatch(): Record<string, PlayerChoiceValue> {
  return {
    [commercialStreetMilkTeaOrderNumberKey]: null,
    [commercialStreetMilkTeaDrinkKey]: null,
    [commercialStreetMilkTeaSugarKey]: null,
    [commercialStreetMilkTeaIceKey]: null,
    [commercialStreetMilkTeaReadyAtKey]: null,
    [commercialStreetMilkTeaCreatedAtKey]: null,
    [commercialStreetMilkTeaQueueAheadKey]: null,
    [commercialStreetMilkTeaHeldDrinkKey]: 'milk-tea',
  }
}

export function commercialStreetMilkTeaIsReady(order: CommercialStreetMilkTeaOrder, now: number = Date.now()) {
  return now >= order.readyAt
}

export function commercialStreetMilkTeaQueueStatus(order: CommercialStreetMilkTeaOrder, now: number = Date.now()) {
  if (commercialStreetMilkTeaIsReady(order, now)) return { phase: 'ready' as const, ahead: 0, progress: 1 }
  const duration = Math.max(1, order.readyAt - order.createdAt)
  const progress = Math.max(0, Math.min(1, (now - order.createdAt) / duration))
  return { phase: 'pending' as const, ahead: Math.max(0, Math.ceil(order.queueAhead * (1 - progress))), progress }
}

export function formatCommercialStreetMilkTeaOrderNumber(number: number) {
  return String(number).padStart(3, '0')
}
