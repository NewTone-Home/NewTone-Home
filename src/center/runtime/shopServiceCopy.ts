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
  pickup: '饮品好了，请慢用。',
  heldFull: '手里还有东西，拿不了这么多。',
} as const

const copyByAppState: Readonly<Record<ShopOrderAppState, Pick<ShopServiceCopy, 'orderSuccess' | 'orderPending'>>> = {
  'not-unlocked': {
    orderSuccess: '好的，手机里还没有订单 App。扫一下柜台上的二维码，之后就能查看订单号和进度哦。',
    orderPending: '饮品还没做好哦，可以先逛逛或坐一会儿。手机里还没有订单 App，扫一下柜台上的二维码后就能查看进度。',
  },
  unlocked: {
    orderSuccess: '好的，订单号和进度可以在手机里的订单 App 查看哦。',
    orderPending: '饮品还没做好哦，可以先逛逛或坐一会儿，也可以打开手机里的订单 App 看进度。',
  },
}

/**
 * Resolve staff copy using the shared, persistent order-app unlock state.
 * The caller owns app persistence and must pass the same state for all shops.
 */
export function shopServiceCopy(appState: ShopOrderAppState): ShopServiceCopy {
  return { ...sharedCopy, ...copyByAppState[appState] }
}
