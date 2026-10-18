export const commercialStreetStorefrontInteractionDebounceMs = 300

export type CommercialStreetStorefrontAction = 'milk-tea-order'

type AmbientStorefrontInteraction = {
  kind: 'ambient'
  lines: readonly [string, string, string]
}

type ActionStorefrontInteraction = {
  kind: 'action'
  action: CommercialStreetStorefrontAction
}

export type CommercialStreetStorefrontId =
  | 'commercial-north-slot-1' | 'commercial-north-slot-2' | 'commercial-north-slot-3' | 'commercial-north-slot-4'
  | 'commercial-north-slot-5' | 'commercial-north-slot-6' | 'commercial-north-slot-7' | 'commercial-north-slot-8'
  | 'commercial-south-slot-1' | 'commercial-south-slot-2' | 'commercial-south-slot-3' | 'commercial-south-slot-4'
  | 'commercial-south-slot-5' | 'commercial-south-slot-6' | 'commercial-south-slot-7' | 'commercial-south-slot-8'

export const commercialStreetStorefrontIds = [
  'commercial-north-slot-1', 'commercial-north-slot-2', 'commercial-north-slot-3', 'commercial-north-slot-4',
  'commercial-north-slot-5', 'commercial-north-slot-6', 'commercial-north-slot-7', 'commercial-north-slot-8',
  'commercial-south-slot-1', 'commercial-south-slot-2', 'commercial-south-slot-3', 'commercial-south-slot-4',
  'commercial-south-slot-5', 'commercial-south-slot-6', 'commercial-south-slot-7', 'commercial-south-slot-8',
] as const satisfies readonly CommercialStreetStorefrontId[]

export type CommercialStreetStorefrontInteraction = AmbientStorefrontInteraction | ActionStorefrontInteraction

export const commercialStreetStorefrontInteractions = {
  'commercial-north-slot-1': {
    kind: 'ambient',
    lines: [
      '窗边立牌上画着几种颜色鲜亮的果茶。',
      '菜单板列着当季水果的搭配，冷热选项标在旁边。',
      '透明壶里的柑橘和莓果浸出淡淡的颜色。',
    ],
  },
  'commercial-north-slot-2': {
    kind: 'ambient',
    lines: [
      '门边木架上摆着几本新到的书。',
      '玻璃上贴着本周书单，角落压着一张借阅说明。',
      '靠窗的矮桌上摊开一本翻到一半的书。',
    ],
  },
  'commercial-north-slot-3': {
    kind: 'ambient',
    lines: [
      '展示台上排着几支不同色号的口红。',
      '玻璃柜里摆着几只粉盒和小镜子。',
      '墙边海报介绍着新一季的护肤系列。',
    ],
  },
  'commercial-north-slot-4': {
    kind: 'ambient',
    lines: [
      '靠门的展示架上放着几副颜色不同的太阳镜。',
      '门边摆着一块写着镜片折扣的小立牌。',
      '玻璃上贴着一张视力检查的宣传单。',
    ],
  },
  'commercial-north-slot-5': {
    kind: 'ambient',
    lines: [
      '玻璃柜里摆着几只不同大小的模型。',
      '门边立牌印着几只颜色鲜艳的卡通角色。',
      '展示架上站着几只排成一列的玩偶。',
    ],
  },
  'commercial-north-slot-6': {
    kind: 'ambient',
    lines: [
      '门边陈列着几瓶插有试香纸的香水。',
      '展示架上摆着几只不同香调的香氛蜡烛。',
      '小牌子上写着木质、花香和柑橘调。',
    ],
  },
  'commercial-north-slot-7': {
    kind: 'ambient',
    lines: [
      '吧台沿着两间店面展开，靠街一侧留作点单区。',
      '磨豆机旁放着当天的豆袋，纸签标着烘焙日期。',
      '靠窗座位朝向湖面，桌椅之间留出通行位置。',
    ],
  },
  'commercial-north-slot-8': {
    kind: 'ambient',
    lines: [
      '弧形玻璃外能望见湖岸，窗边没有通往室外的门。',
      '靠湖的桌椅沿窗边排开，没有挡住店内通道。',
      '湖面的光落在桌面上，杯垫和水壶摆在一侧。',
    ],
  },
  'commercial-south-slot-1': {
    kind: 'ambient',
    lines: [
      '橱窗里摆着几双不同颜色的运动鞋。',
      '门口的展示台上放着几双低帮鞋。',
      '橱窗底部放着几个鞋盒。',
    ],
  },
  'commercial-south-slot-2': {
    kind: 'ambient',
    lines: [
      '墙边菜单列着几种简餐，旁边标出可选配菜。',
      '靠墙的餐桌留出座位，桌面上放着菜单牌。',
      '服务台旁摆着取餐托盘和餐具，通道保持畅通。',
    ],
  },
  'commercial-south-slot-3': {
    kind: 'ambient',
    lines: [
      '几张餐桌分布在店内，桌间留着进出的空隙。',
      '墙上的小牌写着今日供应，下面附着简短说明。',
      '柜台旁的点单牌列着饮品与简餐搭配。',
    ],
  },
  'commercial-south-slot-4': {
    kind: 'ambient',
    lines: [
      '橱窗里的模特穿着一条长裙。',
      '展示架上挂着几条不同颜色的裙子。',
      '橱窗里几件衣服的面料看起来很轻薄。',
    ],
  },
  'commercial-south-slot-5': {
    kind: 'action',
    action: 'milk-tea-order',
  },
  'commercial-south-slot-6': {
    kind: 'ambient',
    lines: [
      '玻璃柜里摆着几块颜色不同的小蛋糕。',
      '门边的小黑板画着蛋糕和冰淇淋口味。',
      '柜台旁的冷柜里排着几份甜点。',
    ],
  },
  'commercial-south-slot-7': {
    kind: 'ambient',
    lines: [
      '橱窗里摆着几条细细的项链。',
      '橱窗里的首饰在灯下反着一点细碎的光。',
      '展示柜里铺着一层深色绒布。',
    ],
  },
  'commercial-south-slot-8': {
    kind: 'ambient',
    lines: [
      '靠窗的衣架上是一排黑白灰色的衣服。',
      '门边挂着一件长款风衣。',
      '橱窗里摆着一套颜色很深的上下装。',
    ],
  },
} as const satisfies Readonly<Record<CommercialStreetStorefrontId, CommercialStreetStorefrontInteraction>>

export type CommercialStreetStorefrontInteractionRuntime = {
  lastShownByStorefront: Map<string, string>
}

export type CommercialStreetStorefrontExecutionRuntime = {
  lastExecutedAtByStorefront: Map<string, number>
}

export type CommercialStreetStorefrontInteractionResult =
  | { kind: 'echo'; text: string }
  | { kind: 'action'; action: CommercialStreetStorefrontAction }

export function createCommercialStreetStorefrontInteractionRuntime(): CommercialStreetStorefrontInteractionRuntime {
  return {
    lastShownByStorefront: new Map(),
  }
}

export function createCommercialStreetStorefrontExecutionRuntime(): CommercialStreetStorefrontExecutionRuntime {
  return { lastExecutedAtByStorefront: new Map() }
}

export function commercialStreetStorefrontInteractionFor(storefrontId: string): CommercialStreetStorefrontInteraction | undefined {
  const canonicalId = storefrontId === 'commercial-cafe-slot' ? 'commercial-north-slot-7' : storefrontId
  return (commercialStreetStorefrontInteractions as Readonly<Record<string, CommercialStreetStorefrontInteraction>>)[canonicalId]
}

function randomIndex(length: number, random: () => number) {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)))
}

function nextNonRepeatingLine(storefrontId: string, lines: readonly string[], runtime: CommercialStreetStorefrontInteractionRuntime, random: () => number) {
  const previous = runtime.lastShownByStorefront.get(storefrontId)
  const candidates = lines.length > 1 && previous
    ? lines.filter((line) => line !== previous)
    : lines
  const next = candidates[randomIndex(candidates.length, random)]!
  runtime.lastShownByStorefront.set(storefrontId, next)
  return next
}

export function resolveCommercialStreetStorefrontInteraction(
  storefrontId: string,
  runtime: CommercialStreetStorefrontInteractionRuntime,
  random: () => number = Math.random,
): CommercialStreetStorefrontInteractionResult | null {
  const interaction = commercialStreetStorefrontInteractionFor(storefrontId)
  if (!interaction) return null
  if (interaction.kind === 'action') return { kind: 'action', action: interaction.action }
  return {
    kind: 'echo',
    text: nextNonRepeatingLine(storefrontId, interaction.lines, runtime, random),
  }
}

export function isCommercialStreetStorefrontInteractionDebounced(lastInteractionAt: number | undefined, now: number) {
  return lastInteractionAt !== undefined && now - lastInteractionAt < commercialStreetStorefrontInteractionDebounceMs
}

/**
 * The cooldown belongs to the completed storefront interaction, not to a
 * particular input route. Both an already-arrived click and a movement-arrival
 * callback must pass through here before they can consume text or an action.
 */
export function executeCommercialStreetStorefrontInteraction(
  storefrontId: string,
  runtime: CommercialStreetStorefrontInteractionRuntime,
  executionRuntime: CommercialStreetStorefrontExecutionRuntime,
  now: number = Date.now(),
  random: () => number = Math.random,
): CommercialStreetStorefrontInteractionResult | null {
  if (isCommercialStreetStorefrontInteractionDebounced(executionRuntime.lastExecutedAtByStorefront.get(storefrontId), now)) return null
  const resolution = resolveCommercialStreetStorefrontInteraction(storefrontId, runtime, random)
  if (!resolution) return null
  executionRuntime.lastExecutedAtByStorefront.set(storefrontId, now)
  return resolution
}
