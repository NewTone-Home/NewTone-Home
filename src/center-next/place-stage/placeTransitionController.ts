import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampPlacePosition,
  hiddenSlotVisual,
  nearestPlaceIndex,
  resolveMountWindow,
  weakSnapTarget,
} from './placeStageMath'
import {
  createPlaceStageState,
  isStageSettled,
  placeStageReducer,
  positionOf,
} from './placeStageReducer'
import type { PlaceStageAction } from './placeStageReducer'
import type {
  PlaceNavigationIntent,
  PlaceSlotVisual,
  PlaceStageState,
} from './placeStageTypes'
import { getTransitionStrategy } from './transitionStrategies'
import type { PlaceTransitionStrategyId } from './transitionStrategies'

/**
 * 过渡控制器。
 *
 * 负责三件事，且只负责这三件事：
 * 1. 驱动时间（离散补间的曲线、释放后的弱吸附动画）；
 * 2. 调用当前策略把构图推进量翻译成视觉量；
 * 3. 把视觉量交给渲染层。
 *
 * 它不认识具体输入设备（那是 usePlaceStageInput），
 * 也不认识 CSS 图层公式（那是策略 + 渲染层）。
 *
 * 状态边界：连续构图住在 ref 里，每帧只回调视觉量；
 * 只有 settledIndex / phase / settled 三个低频量进 React state，
 * 因此拖动过程中地点组件零重渲染。
 */

/** 离散切换的补间时长。足够读出前后交换，又不至于让人等。 */
const COMMIT_DURATION_MS = 620

/** 弱吸附动画的每帧插值系数。 */
const SNAP_LERP = 0.14
const SNAP_EPSILON = 0.0008

/** 离散补间的时间曲线。两端稳、中段快 —— 50/50 从观感上就不像一个档位。 */
function easeCommit(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2
}

export interface PlaceStageFrame {
  /** 已挂载地点的视觉量，按地点索引取。缺席表示该地点这一帧不在挂载窗口内。 */
  slotByPlaceIndex: Map<number, PlaceSlotVisual>
  /** 未知世界边界的视觉量。null = 当前构图里没有边界。 */
  boundary: PlaceSlotVisual | null
  state: PlaceStageState
  position: number
}

export interface PlaceTransitionControllerApi {
  settledIndex: number
  phase: PlaceStageState['phase']
  settled: boolean
  /** 当前挂载的地点索引集合。低频变化，供渲染层决定 DOM。 */
  mountedIndices: number[]
  sendIntent: (intent: PlaceNavigationIntent) => void
  /** 连续手势结束。discreteStep 只在 reduced motion 下有意义。 */
  releaseContinuous: (discreteStep: number) => void
  /** HUD / 测试专用：无动画直接落位。刻意不参与任何吸附集合。 */
  debugJump: (position: number) => void
  getState: () => PlaceStageState
  getPosition: () => number
}

interface ControllerInput {
  placeCount: number
  reduced: boolean
  strategyId: PlaceTransitionStrategyId
  initialIndex?: number
  /** 每帧回调。渲染层在这里写 CSS 变量，不要 setState。 */
  onFrame: (frame: PlaceStageFrame) => void
}

export function usePlaceTransitionController({
  placeCount,
  reduced,
  strategyId,
  initialIndex = 0,
  onFrame,
}: ControllerInput): PlaceTransitionControllerApi {
  const stateRef = useRef<PlaceStageState>(createPlaceStageState(initialIndex, placeCount))
  const frameRef = useRef<number | null>(null)
  const commitStartRef = useRef(0)
  const snapTargetRef = useRef<number | null>(null)

  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const strategyIdRef = useRef(strategyId)
  strategyIdRef.current = strategyId
  const placeCountRef = useRef(placeCount)
  placeCountRef.current = placeCount
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  const [settledIndex, setSettledIndex] = useState(() => stateRef.current.settledIndex)
  const [phase, setPhase] = useState<PlaceStageState['phase']>(() => stateRef.current.phase)
  const [settled, setSettled] = useState(() => isStageSettled(stateRef.current, placeCount))
  const [mountedIndices, setMountedIndices] = useState<number[]>(
    () => resolveMountWindow(stateRef.current.settledIndex, placeCount),
  )
  const mountedKeyRef = useRef(mountedIndices.join(','))

  /** 把当前状态翻译成视觉量并交给渲染层。低频量顺带同步进 React。 */
  const emit = useCallback(() => {
    const state = stateRef.current
    const count = placeCountRef.current
    const strategy = getTransitionStrategy(strategyIdRef.current)

    const visual = strategy.apply(state.transitionProgress, {
      placeCount: count,
      state,
      position: positionOf(state),
      reduced: reducedRef.current,
    })

    // 挂载窗口比可见槽位宽：窗口内但不在槽位里的地点保留 DOM、视觉完全退出，
    // 这样一个地点从剪影走到多层主体的全程都不会经历卸载再挂载。
    const slotByPlaceIndex = new Map<number, PlaceSlotVisual>()
    for (const index of resolveMountWindow(state.settledIndex, count)) {
      slotByPlaceIndex.set(index, hiddenSlotVisual(index))
    }

    let boundary: PlaceSlotVisual | null = null
    for (const slot of visual.slots) {
      if (slot.placeIndex === null) {
        boundary = slot
        continue
      }
      slotByPlaceIndex.set(slot.placeIndex, slot)
    }

    onFrameRef.current({ slotByPlaceIndex, boundary, state, position: positionOf(state) })

    // 挂载集合只在真正变化时才进 React：跨多个索引的补间也不会漏挂目标地点
    const nextMounted = [...slotByPlaceIndex.keys()].sort((a, b) => a - b)
    const nextKey = nextMounted.join(',')
    if (nextKey !== mountedKeyRef.current) {
      mountedKeyRef.current = nextKey
      setMountedIndices(nextMounted)
    }

    setSettledIndex(current => (current === state.settledIndex ? current : state.settledIndex))
    setPhase(current => (current === state.phase ? current : state.phase))
    const nextSettled = isStageSettled(state, count)
    setSettled(current => (current === nextSettled ? current : nextSettled))
  }, [])

  /** 归约 + 发帧。返回归约后的状态，调用方据此决定要不要起动画。 */
  const dispatch = useCallback((action: PlaceStageAction): PlaceStageState => {
    const next = placeStageReducer(stateRef.current, action)
    if (next === stateRef.current) return next
    stateRef.current = next
    emit()
    return next
  }, [emit])

  const stopFrame = useCallback(() => {
    if (frameRef.current === null) return
    cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    snapTargetRef.current = null
  }, [])

  /**
   * 页面隐藏时 rAF 不会被调度。
   *
   * 此时必须直接落到终点，否则一次在后台发起的切换会把 phase 永久钉在
   * committing 上 —— 舞台从此不再接受任何输入。
   */
  const framesAvailable = () => typeof document === 'undefined' || !document.hidden

  /** 释放后的弱吸附动画。任何新的连续输入都会取消它。 */
  const runSnap = useCallback((target: number) => {
    if (!framesAvailable()) {
      dispatch({
        type: 'set-position',
        position: target,
        phase: 'idle',
        placeCount: placeCountRef.current,
      })
      return
    }

    snapTargetRef.current = target

    const step = () => {
      frameRef.current = null
      const goal = snapTargetRef.current
      if (goal === null) return

      const current = positionOf(stateRef.current)
      const diff = goal - current

      if (Math.abs(diff) < SNAP_EPSILON) {
        snapTargetRef.current = null
        dispatch({ type: 'release', placeCount: placeCountRef.current, reduced: false, discreteStep: 0 })
        return
      }

      dispatch({
        type: 'set-position',
        position: current + diff * SNAP_LERP,
        phase: 'idle',
        placeCount: placeCountRef.current,
      })
      frameRef.current = requestAnimationFrame(step)
    }

    frameRef.current = requestAnimationFrame(step)
  }, [dispatch])

  /** 离散补间。期间忽略连续输入，完成后才更新 settledIndex。 */
  const runCommit = useCallback(() => {
    const strategy = getTransitionStrategy(strategyIdRef.current)
    const context = () => ({
      placeCount: placeCountRef.current,
      state: stateRef.current,
      position: positionOf(stateRef.current),
      reduced: reducedRef.current,
    })

    strategy.prepare(context())

    if (!framesAvailable()) {
      dispatch({ type: 'commit-tick', progress: 1, placeCount: placeCountRef.current })
      dispatch({ type: 'commit-complete', placeCount: placeCountRef.current })
      strategy.complete(context())
      return
    }

    commitStartRef.current = performance.now()

    const step = () => {
      frameRef.current = null
      const elapsed = performance.now() - commitStartRef.current
      const t = Math.min(1, elapsed / COMMIT_DURATION_MS)

      dispatch({
        type: 'commit-tick',
        progress: easeCommit(t),
        placeCount: placeCountRef.current,
      })

      if (t >= 1) {
        dispatch({ type: 'commit-complete', placeCount: placeCountRef.current })
        strategy.complete({
          placeCount: placeCountRef.current,
          state: stateRef.current,
          position: positionOf(stateRef.current),
          reduced: reducedRef.current,
        })
        return
      }

      frameRef.current = requestAnimationFrame(step)
    }

    frameRef.current = requestAnimationFrame(step)
  }, [dispatch])

  const sendIntent = useCallback((intent: PlaceNavigationIntent) => {
    // 补间途中一律不接受新意图：不允许在中间停住，也不允许被打断成 50/50
    if (stateRef.current.phase === 'committing') return

    if (intent.type === 'continuous') {
      stopFrame()
      dispatch({
        type: 'intent',
        intent,
        placeCount: placeCountRef.current,
        reduced: reducedRef.current,
      })
      return
    }

    if (intent.type === 'commit') {
      stopFrame()
      const next = dispatch({
        type: 'intent',
        intent,
        placeCount: placeCountRef.current,
        reduced: reducedRef.current,
      })
      // reduced motion 与「已经在目标位」都直接落位，不起补间
      if (next.phase === 'committing') runCommit()
      return
    }

    // activate 不改变构图，交给上层打开信息层
    dispatch({
      type: 'intent',
      intent,
      placeCount: placeCountRef.current,
      reduced: reducedRef.current,
    })
  }, [dispatch, runCommit, stopFrame])

  const releaseContinuous = useCallback((discreteStep: number) => {
    if (stateRef.current.phase === 'committing') return
    stopFrame()

    if (reducedRef.current) {
      dispatch({
        type: 'release',
        placeCount: placeCountRef.current,
        reduced: true,
        discreteStep,
      })
      return
    }

    const position = positionOf(stateRef.current)
    const target = weakSnapTarget(position, placeCountRef.current)
    if (target === position) {
      // 吸附半径之外：中间态原样保留，50/50 可以长期停留
      dispatch({ type: 'release', placeCount: placeCountRef.current, reduced: false, discreteStep: 0 })
      return
    }
    runSnap(target)
  }, [dispatch, runSnap, stopFrame])

  const debugJump = useCallback((position: number) => {
    stopFrame()
    dispatch({
      type: 'set-position',
      position: clampPlacePosition(position, placeCountRef.current),
      phase: 'idle',
      placeCount: placeCountRef.current,
    })
  }, [dispatch, stopFrame])

  // 首帧写一次，避免 CSS 变量缺失
  useEffect(() => {
    emit()
  }, [emit])

  // 地点数量变化后重新夹住位置（新增地点会让原本的边界变回真实邻居）
  useEffect(() => {
    const clamped = clampPlacePosition(positionOf(stateRef.current), placeCount)
    dispatch({ type: 'set-position', position: clamped, phase: 'idle', placeCount })
  }, [dispatch, placeCount])

  /** 页面隐藏时 rAF 会被冻结，动画会停在中途 —— 直接落到目标位。 */
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) return
      if (frameRef.current === null) return

      const count = placeCountRef.current
      const state = stateRef.current
      stopFrame()

      if (state.phase === 'committing' && state.commit) {
        dispatch({ type: 'commit-tick', progress: 1, placeCount: count })
        dispatch({ type: 'commit-complete', placeCount: count })
        return
      }
      dispatch({ type: 'release', placeCount: count, reduced: false, discreteStep: 0 })
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [dispatch, stopFrame])

  useEffect(() => stopFrame, [stopFrame])

  const getState = useCallback(() => stateRef.current, [])
  const getPosition = useCallback(() => positionOf(stateRef.current), [])

  return {
    settledIndex: nearestPlaceIndex(settledIndex, placeCount),
    phase,
    settled,
    mountedIndices,
    sendIntent,
    releaseContinuous,
    debugJump,
    getState,
    getPosition,
  }
}
