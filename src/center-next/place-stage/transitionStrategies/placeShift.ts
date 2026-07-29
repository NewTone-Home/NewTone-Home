import { resolvePlaceSlots } from '../placeStageMath'
import type { PlaceStageVisualState } from '../placeStageTypes'
import { registerTransitionStrategy } from './types'
import type { PlaceTransitionContext, PlaceTransitionStrategy } from './types'

/**
 * place-shift：地点在世界空间中前后推进。
 *
 * 名字是空间的，不是交换的：这里发生的不是「两张卡片对调」，而是所有地点
 * 沿前后两条连续轨迹移动 —— 后一个从右侧后方推进到前景，当前主体向左滑出、
 * 缩小、淡化并逐渐收成剪影，再后一个从右侧深处浮出接上 20% 位。
 *
 * 职责边界：
 * - 时间由控制器负责（连续输入 1:1，离散补间自带曲线），策略不碰时间；
 * - 深度 → 视觉量的映射由 placeStageMath 的三个构图预设负责；
 * - 策略负责的是这个映射之上的表现选择 —— 这里是「层级展开滞后于推进」。
 *
 * 因此没有任何一处把「所有图层一起 translateX」写死。
 */

/** 比这更近的地点保持完整层级。 */
const UNFOLD_FULL_DEPTH = 0.35
/** 比这更深的地点只剩剪影 —— 剪影属于深处，不属于邻居位。 */
const UNFOLD_GONE_DEPTH = 1.8

function smoothstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped * clamped * (3 - 2 * clamped)
}

/**
 * 层级的收起滞后于空间推进。
 *
 * 退场主体随左滑进度连续收束；进入者在右侧邻居位仍然看得见真实的多层地点，
 * 只有更深处才是一块剪影。
 *
 * 反过来，从深处浮出的地点先是剪影，推进到邻居位就已经开始立起层级，
 * 到主体位才完全展开。这是「纸景立起 / 收起」，不是「一张图淡入淡出」，
 * 也是 silhouette-reveal 将来要接管并做得更细的地方。
 */
function unfoldAtDepth(depth: number): number {
  if (depth <= UNFOLD_FULL_DEPTH) return 1
  if (depth >= UNFOLD_GONE_DEPTH) return 0
  return smoothstep((UNFOLD_GONE_DEPTH - depth) / (UNFOLD_GONE_DEPTH - UNFOLD_FULL_DEPTH))
}

export const placeShiftStrategy: PlaceTransitionStrategy = {
  id: 'place-shift',

  prepare() {
    // 基础策略没有需要预热的资产
  },

  apply(progress: number, context: PlaceTransitionContext): PlaceStageVisualState {
    const span = context.state.toIndex === null ? 0 : context.state.toIndex - context.state.fromIndex
    const position = context.state.fromIndex + progress * span

    if (context.reduced) {
      // Reduced motion：不表现中间态，直接读成最近的稳定构图，层也不收束
      return {
        slots: resolvePlaceSlots(Math.round(position), context.placeCount)
          .map(slot => ({ ...slot, converge: 0, unfold: slot.depth < 0.5 ? 1 : 0 })),
      }
    }

    return {
      slots: resolvePlaceSlots(position, context.placeCount).map(slot => ({
        ...slot,
        unfold: unfoldAtDepth(slot.depth),
        // unfoldDelay 恒为 0：时间差通道留给 layer-unfold
        unfoldDelay: 0,
      })),
    }
  },

  complete() {
    // 结算由 reducer 负责，策略不持有状态
  },
}

registerTransitionStrategy(placeShiftStrategy)
