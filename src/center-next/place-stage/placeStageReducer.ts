import {
  clampPlacePosition,
  derivePosition,
  isSettledAt,
  nearestPlaceIndex,
  resolveComposition,
  weakSnapTarget,
} from './placeStageMath'
import type { PlaceNavigationIntent, PlaceStageState } from './placeStageTypes'

/**
 * Place Stage 的状态归约。
 *
 * 纯函数，不认识 DOM、不认识 rAF、不认识 CSS。控制器只负责驱动时间。
 *
 * 这里钉住的核心规则只有一条：**settledIndex 只在结算时更新**。
 * 离散切换从一个稳定 80/20 补间到另一个稳定 80/20，数值上会经过 50/50，
 * 但那既不是可交互状态，也不会被记成「当前地点」。
 */

export type PlaceStageAction =
  | { type: 'intent'; intent: PlaceNavigationIntent; placeCount: number; reduced: boolean }
  /** 控制器内部的位置驱动：连续输入、弱吸附动画、HUD 跳转都走这一条。 */
  | { type: 'set-position'; position: number; phase: PlaceStageState['phase']; placeCount: number }
  | { type: 'release'; placeCount: number; reduced: boolean; discreteStep: number }
  | { type: 'commit-tick'; progress: number; placeCount: number }
  | { type: 'commit-complete'; placeCount: number }

export function createPlaceStageState(initialIndex: number, placeCount: number): PlaceStageState {
  const index = nearestPlaceIndex(initialIndex, placeCount)
  return {
    phase: 'idle',
    settledIndex: index,
    ...resolveComposition(index, placeCount),
    commit: null,
  }
}

/** 由构图状态派生连续位置。控制器与 HUD 都走这一个出口。 */
export function positionOf(state: PlaceStageState): number {
  return derivePosition(state)
}

function withPosition(
  state: PlaceStageState,
  position: number,
  placeCount: number,
  patch: Partial<PlaceStageState> = {},
): PlaceStageState {
  return {
    ...state,
    ...resolveComposition(position, placeCount),
    ...patch,
  }
}

/** 只有停在主体位、且没有过渡在跑时才结算。 */
function settleIfPossible(state: PlaceStageState, placeCount: number): PlaceStageState {
  if (state.phase !== 'idle') return state
  const position = positionOf(state)
  const nearest = nearestPlaceIndex(position, placeCount)
  if (!isSettledAt(nearest, position)) return state
  if (state.settledIndex === nearest) return state
  return { ...state, settledIndex: nearest }
}

export function placeStageReducer(
  state: PlaceStageState,
  action: PlaceStageAction,
): PlaceStageState {
  switch (action.type) {
    case 'intent':
      return reduceIntent(state, action)

    case 'set-position': {
      // 补间途中不接受外部位置驱动，避免 commit 被拽停在 50/50
      if (state.phase === 'committing' && action.phase !== 'committing') return state
      const next = withPosition(state, action.position, action.placeCount, {
        phase: action.phase,
        commit: action.phase === 'committing' ? state.commit : null,
      })
      return settleIfPossible(next, action.placeCount)
    }

    case 'release': {
      if (state.phase === 'committing') return state

      // Reduced motion：拖动期间不连续移动，释放时离散换一格
      if (action.reduced) {
        const target = clampPlacePosition(state.settledIndex + action.discreteStep, action.placeCount)
        return withPosition(state, target, action.placeCount, {
          phase: 'idle',
          settledIndex: nearestPlaceIndex(target, action.placeCount),
          commit: null,
        })
      }

      // 弱吸附之外的中间态原样保留：50/50 可以长期停留。
      // 真正的吸附动画由控制器驱动，这里只负责落到最终值并结算。
      const snapped = weakSnapTarget(positionOf(state), action.placeCount)
      const next = withPosition(state, snapped, action.placeCount, { phase: 'idle', commit: null })
      return settleIfPossible(next, action.placeCount)
    }

    case 'commit-tick': {
      if (!state.commit) return state
      const { fromPosition, toIndex } = state.commit
      const progress = Math.min(1, Math.max(0, action.progress))
      const position = fromPosition + (toIndex - fromPosition) * progress
      // settledIndex 刻意不动：补间途中的 50/50 不是「当前地点」
      return withPosition(state, position, action.placeCount, {
        phase: 'committing',
        commit: { ...state.commit, progress },
      })
    }

    case 'commit-complete': {
      if (!state.commit) return { ...state, phase: 'idle' }
      const target = clampPlacePosition(state.commit.toIndex, action.placeCount)
      return withPosition(state, target, action.placeCount, {
        phase: 'idle',
        settledIndex: nearestPlaceIndex(target, action.placeCount),
        commit: null,
      })
    }

    default:
      return state
  }
}

function reduceIntent(
  state: PlaceStageState,
  action: Extract<PlaceStageAction, { type: 'intent' }>,
): PlaceStageState {
  const { intent, placeCount, reduced } = action

  switch (intent.type) {
    case 'continuous': {
      // 离散切换期间不接受连续输入：不允许在 50/50 停住
      if (state.phase === 'committing') return state
      // Reduced motion 下连续输入不移动构图，等 release 时离散换格
      if (reduced) return state.phase === 'continuous' ? state : { ...state, phase: 'continuous' }

      const position = clampPlacePosition(positionOf(state) + intent.progress, placeCount)
      return withPosition(state, position, placeCount, { phase: 'continuous', commit: null })
    }

    case 'commit': {
      const target = nearestPlaceIndex(intent.targetIndex, placeCount)
      const fromPosition = positionOf(state)

      if (reduced || fromPosition === target) {
        return withPosition(state, target, placeCount, {
          phase: 'idle',
          settledIndex: target,
          commit: null,
        })
      }

      return {
        ...state,
        phase: 'committing',
        commit: { fromPosition, toIndex: target, progress: 0 },
      }
    }

    case 'activate':
      // 打开信息层不改变构图，也不改变结算索引
      return state

    default:
      return state
  }
}

/** 当前是否停在某个地点的主体位上 —— 只有此时才允许打开信息层。 */
export function isStageSettled(state: PlaceStageState, placeCount: number): boolean {
  if (state.phase !== 'idle') return false
  const position = positionOf(state)
  return isSettledAt(nearestPlaceIndex(position, placeCount), position)
}
