/** Shared staff-facing copy for manual ordering at the three commercial shops. */
export const commercialShopWelcomeCopy =
  '欢迎光临，看看想喝什么？也可以扫描柜台上的二维码下单。'

export type ShopOrderAppState = 'unlocked' | 'not-unlocked'

export type ShopServiceCopy = Readonly<{
  welcome: string
  orderSuccess: string
  orderPending: string
  cancel: string
  pickup: string
  heldFull: string
}>

const sharedCopy = {
  welcome: commercialShopWelcomeCopy,
  cancel: '没问题，欢迎下次光临。',
  pickup: '您的饮料好了，请慢用。',
  heldFull: '手里还有东西，暂时拿不了。',
} as const

const copyByAppState: Readonly<Record<ShopOrderAppState, Pick<ShopServiceCopy, 'orderSuccess' | 'orderPending'>>> = {
  'not-unlocked': {
    orderSuccess: '好的。扫一下柜台上的二维码，就可以查看订单号和进度了。',
    orderPending: '还没做好哦，可以先逛逛。可以扫一下柜台二维码查看进度噢。',
  },
  unlocked: {
    orderSuccess: '好的，订单号和进度可以在手机里的订单 App 查看哦。',
    orderPending: '还没做好哦，先逛逛吧，进度可以在订单 App 里看。',
  },
}

/**
 * Resolve staff copy using the shared, persistent order-app unlock state.
 * The caller owns app persistence and must pass the same state for all shops.
 */
export function shopServiceCopy(appState: ShopOrderAppState): ShopServiceCopy {
  return { ...sharedCopy, ...copyByAppState[appState] }
}
