/** Separates manual counter dialogue from explicit phone entry. */
export type StoreOrderEntrySource =
  | 'counter-dialogue'
  | 'npc-dialogue'
  | 'recommendation-dialogue'
  | 'storefront-action'
  | 'explicit-scan'
  | 'explicit-app-entry'
  | 'player-opened-app'

export type StoreOrderEntryRoute = 'stay-in-dialogue' | 'open-phone-app' | 'continue-in-phone-app'

export function storeOrderEntryRoute(source: StoreOrderEntrySource): StoreOrderEntryRoute {
  if (source === 'explicit-scan' || source === 'explicit-app-entry') return 'open-phone-app'
  if (source === 'player-opened-app') return 'continue-in-phone-app'
  return 'stay-in-dialogue'
}

export type ManualOrderDialogueAction = 'order' | 'accept-recommendation' | 'look-again'

export function manualOrderDialogueRoute(_action: ManualOrderDialogueAction): StoreOrderEntryRoute {
  return storeOrderEntryRoute('counter-dialogue')
}

export const knownStoreAppEntryEntityIds = {
  cafe: 'commercial-cafe-app-square',
  milkTea: 'commercial-s5-milk-tea-app-square',
  fruitTea: 'fruit-tea-trial-app-square',
  yonghe: null,
} as const
