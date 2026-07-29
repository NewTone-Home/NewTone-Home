import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import {
  PLACE_DISCRETE_STEP_RATIO,
  PLACE_WHEEL_IDLE_MS,
  discreteDragStep,
  dragPositionDelta,
  exceedsDragThreshold,
  intentDirection,
  normalizeDepthWheelDelta,
  stridePixels,
  wheelPositionDelta,
} from './placeStageInputModel'
import type { PlaceNavigationIntent } from './placeStageTypes'

/**
 * 输入适配层。
 *
 * 唯一职责：把设备事件翻译成 PlaceNavigationIntent。
 *
 * 它不知道有几个图层、不知道 80/20 怎么算、不写任何 CSS 变量。
 * 换一种输入设备只影响这个文件；换一种过渡表现完全不影响这个文件。
 */

interface PlaceStageInputOptions {
  stageRef: RefObject<HTMLElement | null>
  reduced: boolean
  onIntent: (intent: PlaceNavigationIntent) => void
  /** 连续手势结束。discreteStep 只在 reduced motion 下有意义。 */
  onRelease: (discreteStep: number) => void
  /** false 时完全不接管输入（例如信息层已展开）。 */
  enabled?: boolean
}

export interface PlaceStageInputApi {
  /** 消费并清除「这次 click 是拖动的副产物」标记。 */
  isClickSuppressed: () => boolean
}

export function usePlaceStageInput({
  stageRef,
  reduced,
  onIntent,
  onRelease,
  enabled = true,
}: PlaceStageInputOptions): PlaceStageInputApi {
  const suppressClickRef = useRef(false)
  const wheelIdleRef = useRef<number | null>(null)
  /** 一次 wheel 手势内累计的位置增量，只用于 reduced motion 的离散换格。 */
  const wheelAccumRef = useRef(0)
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    lastX: 0,
    moved: 0,
    pointerType: 'mouse',
  })

  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const onIntentRef = useRef(onIntent)
  onIntentRef.current = onIntent
  const onReleaseRef = useRef(onRelease)
  onReleaseRef.current = onRelease

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !enabled) return

    const measuredWidth = () => stage.clientWidth || window.innerWidth

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return

      suppressClickRef.current = false
      dragRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        lastX: event.clientX,
        moved: 0,
        pointerType: event.pointerType,
      }
      try {
        stage.setPointerCapture(event.pointerId)
      } catch {
        /* 指针已失效，退化为无捕获拖动 */
      }
      // 阻止原生图片拖拽与文本选择，否则 pointermove 会在中途断流
      event.preventDefault()
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) return

      const total = event.clientX - drag.startX
      drag.moved = Math.max(drag.moved, Math.abs(total))
      if (exceedsDragThreshold(drag.moved)) suppressClickRef.current = true

      const frameDx = event.clientX - drag.lastX
      drag.lastX = event.clientX
      if (frameDx === 0) return

      const delta = dragPositionDelta(frameDx, stridePixels(measuredWidth()))
      if (delta === 0) return

      onIntentRef.current({
        type: 'continuous',
        source: drag.pointerType === 'touch' ? 'touch-swipe' : 'pointer-drag',
        progress: delta,
        direction: intentDirection(delta),
      })
    }

    const endDrag = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) return

      drag.active = false
      try {
        stage.releasePointerCapture(event.pointerId)
      } catch {
        /* 捕获已经丢失 */
      }

      const step = reducedRef.current
        ? discreteDragStep(event.clientX - drag.startX, stridePixels(measuredWidth()))
        : 0
      onReleaseRef.current(step)
    }

    const handleWheel = (event: WheelEvent) => {
      // 始终阻止页面滚动，无论 delta 是否有效
      event.preventDefault()

      const width = measuredWidth()
      const normalized = normalizeDepthWheelDelta(
        event.deltaX,
        event.deltaY,
        event.deltaMode,
        width,
      )
      const delta = wheelPositionDelta(normalized, stridePixels(width))
      if (delta === 0) return

      wheelAccumRef.current += delta

      // 沿地点链深入（正）/ 返回（负），与拖动共用同一条 intent 通道
      onIntentRef.current({
        type: 'continuous',
        source: 'wheel-depth',
        progress: delta,
        direction: intentDirection(delta),
      })

      // 停止滚动一小段时间即判定手势结束，此时才结算 / 弱吸附
      if (wheelIdleRef.current !== null) window.clearTimeout(wheelIdleRef.current)
      wheelIdleRef.current = window.setTimeout(() => {
        wheelIdleRef.current = null
        const accumulated = wheelAccumRef.current
        wheelAccumRef.current = 0
        const step = reducedRef.current && Math.abs(accumulated) >= PLACE_DISCRETE_STEP_RATIO
          ? (accumulated > 0 ? 1 : -1)
          : 0
        onReleaseRef.current(step)
      }, PLACE_WHEEL_IDLE_MS)
    }

    stage.addEventListener('pointerdown', handlePointerDown)
    stage.addEventListener('pointermove', handlePointerMove)
    stage.addEventListener('pointerup', endDrag)
    stage.addEventListener('pointercancel', endDrag)
    // 捕获意外丢失时的安全网
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    stage.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      stage.removeEventListener('pointerdown', handlePointerDown)
      stage.removeEventListener('pointermove', handlePointerMove)
      stage.removeEventListener('pointerup', endDrag)
      stage.removeEventListener('pointercancel', endDrag)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      stage.removeEventListener('wheel', handleWheel)

      const drag = dragRef.current
      if (drag.active) {
        drag.active = false
        try {
          stage.releasePointerCapture(drag.pointerId)
        } catch {
          /* 捕获已经丢失 */
        }
      }
      if (wheelIdleRef.current !== null) {
        window.clearTimeout(wheelIdleRef.current)
        wheelIdleRef.current = null
      }
      wheelAccumRef.current = 0
    }
  }, [enabled, stageRef])

  const isClickSuppressed = useCallback(() => {
    const suppressed = suppressClickRef.current
    suppressClickRef.current = false
    return suppressed
  }, [])

  return { isClickSuppressed }
}
