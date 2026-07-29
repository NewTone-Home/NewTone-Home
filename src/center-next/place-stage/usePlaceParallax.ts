import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * 指针视差。
 *
 * 只做一件事：把指针位置写成舞台根上的 `--place-px` / `--place-py`（归一化 -1..1）。
 * 每一层自己带 `--layer-plx` / `--layer-ply`（来自地点定义，不写死在这里），
 * 位移量由 CSS 乘出来。
 *
 * 刻意不做的事：
 * - 整个地点不作为一张卡片倾斜；
 * - 没有 3D rotate；
 * - 不改变构图状态，也不产生任何导航意图。
 *
 * 核心价值是让各深度层产生数像素的相对位移，从而**改变遮挡关系**。
 */

/** 每帧写入的平滑系数。指针停下后很快收敛，不做弹性。 */
const PARALLAX_LERP = 0.12
const PARALLAX_EPSILON = 0.0015

interface PlaceParallaxOptions {
  stageRef: RefObject<HTMLElement | null>
  /** Reduced motion 下大幅降级。 */
  reduced: boolean
  /** false 时归零并停止跟随。 */
  enabled?: boolean
}

export function usePlaceParallax({ stageRef, reduced, enabled = true }: PlaceParallaxOptions): void {
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const write = (x: number, y: number) => {
      stage.style.setProperty('--place-px', x.toFixed(4))
      stage.style.setProperty('--place-py', y.toFixed(4))
    }

    // Reduced motion：关闭视差，并把已有偏移归零
    if (!enabled || reduced) {
      targetRef.current = { x: 0, y: 0 }
      currentRef.current = { x: 0, y: 0 }
      write(0, 0)
      return
    }

    const stop = () => {
      if (frameRef.current === null) return
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    const step = () => {
      frameRef.current = null
      const current = currentRef.current
      const target = targetRef.current
      const dx = target.x - current.x
      const dy = target.y - current.y

      if (Math.abs(dx) < PARALLAX_EPSILON && Math.abs(dy) < PARALLAX_EPSILON) {
        currentRef.current = { ...target }
        write(target.x, target.y)
        return
      }

      currentRef.current = { x: current.x + dx * PARALLAX_LERP, y: current.y + dy * PARALLAX_LERP }
      write(currentRef.current.x, currentRef.current.y)
      frameRef.current = requestAnimationFrame(step)
    }

    const run = () => {
      if (frameRef.current !== null) return
      frameRef.current = requestAnimationFrame(step)
    }

    const handlePointerMove = (event: PointerEvent) => {
      // 触摸不参与视差：手指已经在直接操作构图了
      if (event.pointerType === 'touch') return
      const rect = stage.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      targetRef.current = {
        x: Math.min(1, Math.max(-1, ((event.clientX - rect.left) / rect.width) * 2 - 1)),
        y: Math.min(1, Math.max(-1, ((event.clientY - rect.top) / rect.height) * 2 - 1)),
      }
      run()
    }

    // 指针离开舞台：目标归零，沿用同一 lerp 平滑走回去，不发生 snap
    const handlePointerLeave = () => {
      targetRef.current = { x: 0, y: 0 }
      run()
    }

    write(currentRef.current.x, currentRef.current.y)
    window.addEventListener('pointermove', handlePointerMove)
    stage.addEventListener('pointerleave', handlePointerLeave)
    document.documentElement.addEventListener('mouseleave', handlePointerLeave)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      stage.removeEventListener('pointerleave', handlePointerLeave)
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave)
      stop()
    }
  }, [enabled, reduced, stageRef])
}
