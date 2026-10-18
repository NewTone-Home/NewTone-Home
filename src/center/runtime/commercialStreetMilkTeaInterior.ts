import type { PlayerSceneState } from './playerSave'

export const commercialStreetMilkTeaInteriorId = 'commercial-milktea-interior' as const
export const commercialStreetMilkTeaShopSceneId = 'commercial-milktea-shop' as const
export const commercialStreetMilkTeaClerkId = 'milk-tea-clerk'
export const commercialStreetMilkTeaClerkContactId = 'milk-tea-clerk-contact'
export const commercialStreetMilkTeaQrId = 'milk-tea-qr'
export const commercialStreetMilkTeaPickupId = 'milk-tea-pickup'
export const commercialStreetMilkTeaTutorialSeenKey = 'milkTeaTutorialSeen'

export const commercialStreetMilkTeaInteriorLayout = {
  bounds: { x: 8, y: 7, width: 90, height: 52 },
  streetDoor: { x: 111, y: 64 },
  streetReturn: { x: 105, y: 57 },
  interiorDoor: { x: 53, y: 59 },
  interiorEntry: { x: 53, y: 55 },
  counter: { x: 25, y: 29, width: 56, height: 3.4 },
  staffArea: { x: 25, y: 8, width: 56, height: 21 },
  clerk: { x: 53, y: 23 },
  clerkContact: { x: 53, y: 35 },
  qr: { x: 68, y: 34 },
  tables: [
    { id: 'milk-tea-left-table', anchor: { x: 28, y: 42 }, approach: { x: 28, y: 36 } },
    { id: 'milk-tea-right-table', anchor: { x: 75, y: 42 }, approach: { x: 75, y: 36 } },
  ],
} as const

/**
 * Reversible first continuous-map layout. These coordinates are authored in
 * the commercial-street world: the shop opens from the south storefront row
 * and extends behind it, matching the existing storefront slot (102..120).
 */
export const commercialStreetMilkTeaContinuousLayout = {
  bounds: { x: 100, y: 64, width: 22, height: 52 },
  storefront: { start: 100, end: 122, doorX: 111, doorY: 64 },
  streetEntry: { x: 111, y: 69 },
  front: { x: 100, y: 64, width: 22, height: 34 },
  rear: { x: 100, y: 98, width: 22, height: 18 },
  counter: {
    run: { x: 116, y: 72, width: 2, height: 22 },
    return: { x: 106, y: 92, width: 12, height: 2 },
  },
  staffArea: { x: 118.5, y: 65, width: 3.2, height: 32 },
  clerk: { x: 120, y: 81 },
  clerkContact: { x: 114.5, y: 82 },
  clerkApproach: { x: 111, y: 82 },
  qr: { x: 106, y: 80 },
  menu: { x: 106, y: 73 },
  counterContacts: [
    { id: 'milk-tea-pickup-1', y: 76 },
    { id: 'milk-tea-clerk-contact', y: 82 },
    { id: 'milk-tea-pickup-3', y: 88 },
    { id: 'milk-tea-pickup-4', y: 94 },
  ],
  rearDivider: { x: 100, y: 98, width: 16, height: 1.4 },
  kitchenWarehouseDivider: { x: 111, y: 99, width: 1.4, height: 17 },
  kitchenLabel: { x: 105, y: 100.5 },
  warehouseLabel: { x: 117, y: 100.5 },
  walkBounds: { x: 8, y: -16, width: 180, height: 132 },
  oldInteriorFallback: { x: 111, y: 69 },
} as const

/** Map legacy room coordinates into the new public aisle without deleting old save data. */
export function remapLegacyMilkTeaInteriorPosition(position: { x: number; y: number } | null | undefined) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return { ...commercialStreetMilkTeaContinuousLayout.oldInteriorFallback }
  }
  const old = commercialStreetMilkTeaInteriorLayout.bounds
  const yProgress = Math.max(0, Math.min(1, (position.y - old.y) / 86))
  return {
    x: Math.max(12, Math.min(94, 8 + (position.x - old.x))),
    y: Math.max(10, Math.min(56, 10 + yProgress * 46)),
  }
}

export const commercialStreetMilkTeaInteriorCopy = {
  zh: {
    title: '商业街 · 奶茶店',
    subtitle: '柜台前留出顾客通道，墙边有菜单和扫码点单牌。',
    statusLabel: '营业中',
    hint: '可以在店里走动、查看桌椅；到柜台点击店员，或扫描二维码点单。取货需要在柜台明确领取。',
    areaLabel: '奶茶店',
    door: '店门',
    clerk: '店员',
    counter: '柜台',
    qr: '扫码点单',
    menu: '菜单',
    table: '桌子',
    chair: '椅子',
    plant: '绿植',
    tutorial: '欢迎光临！请扫描旁边的二维码点单。',
    clerkAgain: '需要点单时，可以扫描柜台旁的二维码。',
    qrPrompt: '打开手机奶茶应用，挑选饮品、甜度和冰量。',
    noOrder: '还没有待取订单。可以扫描二维码开始点单。',
    making: '这杯还在制作中，稍后可以回来取。',
    pickedUp: '你从柜台取到了奶茶。',
    alreadyHolding: '手里已经有一杯奶茶了。',
    deniedStaff: '柜台后面是店员工作区。',
    plantText: '窗边摆着几盆绿植。',
    phoneHeading: '奶茶点单',
    phoneHeld: '手里已有一杯饮料',
    phoneCannotOrder: '暂时不能再下单。',
    phonePickupNumber: '取餐号',
    phoneReady: '已完成，可以到奶茶店柜台取餐。',
    phonePending: '制作中',
    phoneOrder: '下单',
    phoneDrink: '饮品',
    phoneSugar: '甜度',
    phoneIce: '冰量',
    phonePlaceOrder: '确认下单',
    phoneOrderSubmitted: '订单已提交。完成后可以回店取餐。',
  },
  en: {
    title: 'Commercial Street · Milk Tea Shop',
    subtitle: 'A clear customer lane runs in front of the counter, with a menu and QR ordering sign nearby.',
    statusLabel: 'Open',
    hint: 'Walk around and look at the tables. Tap the clerk or scan the QR code to order. Pick up drinks explicitly at the counter.',
    areaLabel: 'Milk Tea Shop',
    door: 'Shop Door',
    clerk: 'Clerk',
    counter: 'Counter',
    qr: 'Scan to Order',
    menu: 'Menu',
    table: 'Table',
    chair: 'Chair',
    plant: 'Plant',
    tutorial: 'Welcome! Scan the QR code beside the counter to place an order.',
    clerkAgain: 'Scan the QR code beside the counter when you are ready to order.',
    qrPrompt: 'Open the milk tea app to choose a drink, sweetness, and ice.',
    noOrder: 'There is no order waiting for pickup. Scan the QR code to order.',
    making: 'Your drink is still being made. Come back in a little while.',
    pickedUp: 'You picked up your milk tea at the counter.',
    alreadyHolding: 'You are already carrying a drink.',
    deniedStaff: 'The area behind the counter is for staff.',
    plantText: 'A few plants sit by the window.',
    phoneHeading: 'Milk Tea Order',
    phoneHeld: 'You already have a drink',
    phoneCannotOrder: 'You cannot place another order yet.',
    phonePickupNumber: 'Order',
    phoneReady: 'Ready for pickup at the milk tea counter.',
    phonePending: 'Preparing',
    phoneOrder: 'Order',
    phoneDrink: 'Drink',
    phoneSugar: 'Sweetness',
    phoneIce: 'Ice',
    phonePlaceOrder: 'Place Order',
    phoneOrderSubmitted: 'Order placed. Return to the shop when it is ready.',
  },
} as const

export type CommercialStreetMilkTeaInteriorCopy = { [Key in keyof typeof commercialStreetMilkTeaInteriorCopy.zh]: string }

export function commercialStreetMilkTeaCopy(language?: string): CommercialStreetMilkTeaInteriorCopy {
  return language?.toLowerCase().startsWith('en')
    ? commercialStreetMilkTeaInteriorCopy.en
    : commercialStreetMilkTeaInteriorCopy.zh
}

export function commercialStreetMilkTeaTutorialSeen(sceneState: PlayerSceneState | undefined) {
  return sceneState?.[commercialStreetMilkTeaTutorialSeenKey] === true
}

export function commercialStreetMilkTeaTutorialPatch(): PlayerSceneState {
  return { [commercialStreetMilkTeaTutorialSeenKey]: true }
}
