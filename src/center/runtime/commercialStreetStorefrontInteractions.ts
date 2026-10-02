export const commercialStreetStorefrontInteractionDebounceMs = 300

export type CommercialStreetStorefrontAction = 'milk-tea-order'

type AmbientStorefrontInteraction = {
  kind: 'ambient'
  lines: readonly [string, string, string]
}

type ComingSoonStorefrontInteraction = {
  kind: 'coming-soon'
  firstLine: string
  lines: readonly [string, string]
}

type ActionStorefrontInteraction = {
  kind: 'action'
  action: CommercialStreetStorefrontAction
}

export type CommercialStreetStorefrontInteraction = AmbientStorefrontInteraction | ComingSoonStorefrontInteraction | ActionStorefrontInteraction

export const commercialStreetStorefrontInteractions = {
  'commercial-north-slot-1': {
    kind: 'coming-soon',
    firstLine: 'Coming Soon',
    lines: [
      '门边的立牌上画着几种颜色很亮的果饮。',
      '招牌上的布还没有揭开。',
    ],
  },
  'commercial-north-slot-2': {
    kind: 'ambient',
    lines: [
      '靠窗的衣架上挂着一排颜色很素的上衣。',
      '门口的衣架上挂着几件薄外套。',
      '橱窗里的模特穿着一套浅色外套和长裤。',
    ],
  },
  'commercial-north-slot-3': {
    kind: 'ambient',
    lines: [
      '门口摆着几束已经包好的鲜花。',
      '门边的小黑板上写着几种花的名字。',
      '一股很淡的花香从门缝里飘出来。',
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
      '玻璃上贴着一张新品海报。',
      '靠门的展示台上放着一组口红试色卡。',
      '展示架上摆着几只圆形粉盒和小镜子。',
    ],
  },
  'commercial-north-slot-6': {
    kind: 'ambient',
    lines: [
      '橱窗里有一排宽松版型的外套。',
      '门边摆着两双搭配展示的鞋。',
      '展示台上叠着几件印花 T 恤。',
    ],
  },
  'commercial-north-slot-7': {
    kind: 'ambient',
    lines: [
      '门边的木架上堆着几本薄薄的杂志。',
      '玻璃门上贴着一张新书推荐单。',
      '靠门的矮桌上摆着几摞大小不同的书。',
    ],
  },
  'commercial-north-slot-8': {
    kind: 'ambient',
    lines: [
      '橱窗里的冷柜摆着几块颜色不同的小蛋糕。',
      '门口能闻到一点奶油和烘烤过的甜味。',
      '门边立着一块画着蛋糕和冰淇淋的小黑板。',
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
      '橱窗里摆着一排大大小小的玩偶。',
      '门边的立牌上印着几只颜色很鲜艳的卡通角色。',
      '橱窗角落里摆着一只比其他玩偶大很多的模型。',
    ],
  },
  'commercial-south-slot-3': {
    kind: 'ambient',
    lines: [
      '门边放着几瓶插着木条的香薰。',
      '展示架上摆着几只不同颜色的香氛蜡烛。',
      '门边的小牌子上写着几种香调的名字。',
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
      '靠门的架子上挂着一排钥匙扣。',
      '展示台上摊着几张颜色不同的徽章卡。',
      '橱窗里立着几张角色立牌。',
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
} as const satisfies Readonly<Record<string, CommercialStreetStorefrontInteraction>>

export type CommercialStreetStorefrontInteractionRuntime = {
  lastShownByStorefront: Map<string, string>
  comingSoonShown: Set<string>
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
    comingSoonShown: new Set(),
  }
}

export function createCommercialStreetStorefrontExecutionRuntime(): CommercialStreetStorefrontExecutionRuntime {
  return { lastExecutedAtByStorefront: new Map() }
}

export function commercialStreetStorefrontInteractionFor(storefrontId: string): CommercialStreetStorefrontInteraction | undefined {
  return (commercialStreetStorefrontInteractions as Readonly<Record<string, CommercialStreetStorefrontInteraction>>)[storefrontId]
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
  if (interaction.kind === 'coming-soon' && !runtime.comingSoonShown.has(storefrontId)) {
    runtime.comingSoonShown.add(storefrontId)
    runtime.lastShownByStorefront.set(storefrontId, interaction.firstLine)
    return { kind: 'echo', text: interaction.firstLine }
  }
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
