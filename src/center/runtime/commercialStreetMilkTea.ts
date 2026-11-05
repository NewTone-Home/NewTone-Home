import type { PlayerChoiceValue, PlayerSceneState } from './playerSave'
import {
  consumeShopItemPatch,
  createShopOrder,
  formatShopOrderNumber,
  nextShopOrderNumber,
  shopItemIsHeld,
  shopOrderFromState,
  shopOrderIsReady,
  shopOrderPatch,
  shopOrderQueueStatus,
  shopPickupAllowed,
  shopPickupPatch,
  shopPreparationDurationMs,
  type ShopOrderConfig,
} from './shopOrder'

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
export const commercialStreetMilkTeaReadyAnalyticsMarkerKey = 'commercialStreetMilkTeaReadyAnalyticsMarker'

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
type MilkTeaSelection = Pick<CommercialStreetMilkTeaOrder, 'drink' | 'sugar' | 'ice'>

const milkTeaOrderConfig: ShopOrderConfig<MilkTeaSelection> = {
  keys: {
    orderNumber: commercialStreetMilkTeaOrderNumberKey,
    lastOrderNumber: commercialStreetMilkTeaLastOrderNumberKey,
    readyAt: commercialStreetMilkTeaReadyAtKey,
    createdAt: commercialStreetMilkTeaCreatedAtKey,
    queueAhead: commercialStreetMilkTeaQueueAheadKey,
    heldItem: commercialStreetMilkTeaHeldDrinkKey,
  },
  minimumPreparationMs,
  maximumPreparationMs,
  queueAheadForOrder: orderNumber => orderNumber % 4 + 1,
  heldValue: 'milk-tea',
  selectionKeys: [commercialStreetMilkTeaDrinkKey, commercialStreetMilkTeaSugarKey, commercialStreetMilkTeaIceKey],
  readSelection: (state) => {
    const drink = state[commercialStreetMilkTeaDrinkKey]
    const sugar = state[commercialStreetMilkTeaSugarKey]
    const ice = state[commercialStreetMilkTeaIceKey]
    if (!includes(milkTeaDrinks, drink) || !includes(milkTeaSugarOptions, sugar) || !includes(milkTeaIceOptions, ice)) return null
    return { drink, sugar, ice }
  },
  selectionPatch: (selection) => ({
    [commercialStreetMilkTeaDrinkKey]: selection.drink,
    [commercialStreetMilkTeaSugarKey]: selection.sugar,
    [commercialStreetMilkTeaIceKey]: selection.ice,
  }),
}

function includes<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value)
}

export function commercialStreetMilkTeaOrderFromSceneState(sceneState: PlayerSceneState | undefined): CommercialStreetMilkTeaOrder | null {
  return shopOrderFromState(sceneState, milkTeaOrderConfig)
}

export function commercialStreetMilkTeaAppUnlocked(sceneState: PlayerSceneState | undefined) {
  return sceneState?.[commercialStreetMilkTeaAppUnlockedKey] === true
}

export function commercialStreetMilkTeaAppUnlockPatch(): Record<string, PlayerChoiceValue> {
  return { [commercialStreetMilkTeaAppUnlockedKey]: true }
}

export function commercialStreetMilkTeaHeld(sceneState: PlayerSceneState | undefined) {
  return shopItemIsHeld(sceneState, milkTeaOrderConfig)
}

export function nextCommercialStreetMilkTeaOrderNumber(previous: unknown) {
  return nextShopOrderNumber(previous)
}

export function milkTeaPreparationDurationMs(random: () => number = Math.random) {
  return shopPreparationDurationMs(milkTeaOrderConfig, random)
}

export function createCommercialStreetMilkTeaOrder(
  sceneState: PlayerSceneState | undefined,
  selection: Pick<CommercialStreetMilkTeaOrder, 'drink' | 'sugar' | 'ice'>,
  now: number = Date.now(),
  random: () => number = Math.random,
): CommercialStreetMilkTeaOrder {
  return createShopOrder(sceneState, selection, milkTeaOrderConfig, now, random)
}

export function commercialStreetMilkTeaOrderPatch(order: CommercialStreetMilkTeaOrder): Record<string, PlayerChoiceValue> {
  return {
    ...shopOrderPatch(order, milkTeaOrderConfig),
    [commercialStreetMilkTeaReadyAnalyticsMarkerKey]: null,
  }
}

export function commercialStreetMilkTeaPickupPatch(): Record<string, PlayerChoiceValue> {
  return shopPickupPatch(milkTeaOrderConfig)
}

export function commercialStreetMilkTeaPickupAllowed(sceneState: PlayerSceneState | undefined, now = Date.now()) {
  return shopPickupAllowed(sceneState, commercialStreetMilkTeaOrderFromSceneState(sceneState), milkTeaOrderConfig, now)
}

export function commercialStreetMilkTeaIsReady(order: CommercialStreetMilkTeaOrder, now: number = Date.now()) {
  return shopOrderIsReady(order, now)
}

/** A stable order identity makes the ready milestone durable across reloads. */
export function commercialStreetMilkTeaReadyAnalyticsMarker(order: CommercialStreetMilkTeaOrder) {
  return `${order.number}:${order.readyAt}`
}

export function commercialStreetMilkTeaReadyAnalyticsWasReported(
  sceneState: PlayerSceneState | undefined,
  order: CommercialStreetMilkTeaOrder,
) {
  return sceneState?.[commercialStreetMilkTeaReadyAnalyticsMarkerKey] === commercialStreetMilkTeaReadyAnalyticsMarker(order)
}

export function commercialStreetMilkTeaReadyAnalyticsPatch(order: CommercialStreetMilkTeaOrder): Record<string, PlayerChoiceValue> {
  return { [commercialStreetMilkTeaReadyAnalyticsMarkerKey]: commercialStreetMilkTeaReadyAnalyticsMarker(order) }
}

export function commercialStreetMilkTeaQueueStatus(order: CommercialStreetMilkTeaOrder, now: number = Date.now()) {
  return shopOrderQueueStatus(order, now)
}

export function formatCommercialStreetMilkTeaOrderNumber(number: number) {
  return formatShopOrderNumber(number)
}

export function commercialStreetMilkTeaConsumePatch(): PlayerSceneState {
  return consumeShopItemPatch(milkTeaOrderConfig)
}
