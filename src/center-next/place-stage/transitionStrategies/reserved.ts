import { placeShiftStrategy } from './placeShift'
import { registerTransitionStrategy } from './types'
import type { PlaceTransitionContext, PlaceTransitionStrategy } from './types'

/**
 * 已预留但本轮未实现的过渡策略。
 *
 * 它们**真的注册进了注册表**，也真的能被 HUD 选中运行 —— 只是行为暂时委托给
 * place-shift。这样做的目的不是占位好看，而是让整条链路（选择 → prepare → apply →
 * complete → 视觉量）在本轮就被真实走通：将来替换实现是改这一个文件，
 * 不是改控制器、渲染层或数据结构。
 */

function delegatingStrategy(
  id: PlaceTransitionStrategy['id'],
  note: string,
): PlaceTransitionStrategy {
  return {
    id,
    prepare(context: PlaceTransitionContext) {
      placeShiftStrategy.prepare(context)
    },
    apply(progress: number, context: PlaceTransitionContext) {
      // TODO(Phase 1+): ${note}
      void note
      return placeShiftStrategy.apply(progress, context)
    },
    complete(context: PlaceTransitionContext) {
      placeShiftStrategy.complete(context)
    },
  }
}

/**
 * 邻居剪影先融化 / 撕开 / 淡出，后方真实地点的内部多层再逐层显现。
 * 不是「把一张剪影替换成一张完整图片」—— 两种表述本来就同时挂载，
 * 靠 slot 的 unfold 推进，所以这条路在渲染层已经通了。
 */
export const silhouetteRevealStrategy = delegatingStrategy(
  'silhouette-reveal',
  '剪影撕开 + 内部多层逐层显现',
)

/** 剪影以纸面溶解的方式退场，而不是整体淡出。 */
export const silhouetteDissolveStrategy = delegatingStrategy(
  'silhouette-dissolve',
  '剪影纸面溶解退场',
)

/** rear → inner → subject → foreground 按很短的时间差展开，形成纸景立起的感觉。 */
export const layerUnfoldStrategy = delegatingStrategy(
  'layer-unfold',
  '按 slot 顺序给 unfoldDelay 赋非零值，形成纸景立起',
)

registerTransitionStrategy(silhouetteRevealStrategy)
registerTransitionStrategy(silhouetteDissolveStrategy)
registerTransitionStrategy(layerUnfoldStrategy)
