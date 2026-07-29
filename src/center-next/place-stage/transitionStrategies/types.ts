import type { PlaceStageVisualState, PlaceStageState } from '../placeStageTypes'

/**
 * 过渡策略接口。
 *
 * 存在的意义是：**没有任何地方把「所有图层一起 translateX」写死**。
 * 控制器只知道 progress 与上下文，视觉量全部由策略产生；
 * 换一套过渡表现，只需要换一个策略 id。
 */
export interface PlaceTransitionContext {
  placeCount: number
  /** 当前构图状态。策略可读，不可改。 */
  state: PlaceStageState
  /** 由构图状态派生的连续位置。 */
  position: number
  reduced: boolean
}

export interface PlaceTransitionStrategy {
  id: PlaceTransitionStrategyId
  /** 一次过渡开始前调用。用于预热资产、记录起点。 */
  prepare(context: PlaceTransitionContext): void
  /** 每帧调用。progress 是构图推进量（0..1），不是补间时间。 */
  apply(progress: number, context: PlaceTransitionContext): PlaceStageVisualState
  /** 过渡结算后调用。 */
  complete(context: PlaceTransitionContext): void
}

export type PlaceTransitionStrategyId =
  /** 地点沿深度轨前后推进。名字是空间的，不是交换的。 */
  | 'place-shift'
  | 'silhouette-reveal'
  | 'silhouette-dissolve'
  | 'layer-unfold'

const registry = new Map<PlaceTransitionStrategyId, PlaceTransitionStrategy>()

export function registerTransitionStrategy(strategy: PlaceTransitionStrategy): void {
  registry.set(strategy.id, strategy)
}

export function getTransitionStrategy(id: PlaceTransitionStrategyId): PlaceTransitionStrategy {
  const strategy = registry.get(id)
  if (!strategy) throw new Error(`未注册的过渡策略：${id}`)
  return strategy
}

export function listTransitionStrategies(): PlaceTransitionStrategyId[] {
  return [...registry.keys()]
}
