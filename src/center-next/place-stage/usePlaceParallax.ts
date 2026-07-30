import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * 地点视差输入。
 *
 * 桌面端读取 pointer；触摸端不读取手指位移，而读取设备方向。
 * 两种输入最终都只写舞台根上的 `--place-px` / `--place-py`（-1..1），
 * 不产生地点导航意图，也不改变构图状态。
 */

const PARALLAX_LERP = 0.12
const PARALLAX_EPSILON = 0.0015
const ORIENTATION_RANGE_DEG = 14
const INITIAL_BASELINE_SAMPLES = 12
const STABLE_DELTA_DEG = 0.35
const STABLE_REBASE_DELAY_MS = 1800
const SOFT_REBASE_RATE = 0.018
const TOUCH_PARALLAX_SCALE = 0.2
const INFO_PANEL_PARALLAX_SCALE = 0.4
const MOTION_PERMISSION_SESSION_KEY = 'newtone-place-motion-permission'

interface PlaceParallaxOptions {
  stageRef: RefObject<HTMLElement | null>
  /** Reduced motion 下关闭视差。 */
  reduced: boolean
  /** false 时通常归零；信息层展开是例外，只降低强度。 */
  enabled?: boolean
  /** 外部需要时可整体降低强度。 */
  intensity?: number
}

interface DeviceOrientationEventWithPermission extends DeviceOrientationEvent {
  // 仅用于类型收窄；实例上不读取此方法。
}

type DeviceOrientationEventConstructorWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

interface OrientationPoint {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readScreenAngle(): number {
  if (typeof screen !== 'undefined' && screen.orientation) return screen.orientation.angle
  return 0
}

function mapOrientation(event: DeviceOrientationEventWithPermission): OrientationPoint | null {
  if (event.beta === null || event.gamma === null) return null

  const beta = event.beta
  const gamma = event.gamma
  const angle = readScreenAngle()

  if (angle === 90) return { x: beta, y: -gamma }
  if (angle === 270 || angle === -90) return { x: -beta, y: gamma }
  if (angle === 180) return { x: -gamma, y: -beta }
  return { x: gamma, y: beta }
}

export function usePlaceParallax({
  stageRef,
  reduced,
  enabled = true,
  intensity = 1,
}: PlaceParallaxOptions): void {
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef<number | null>(null)
  const intensityRef = useRef(intensity)
  intensityRef.current = clamp(intensity, 0, 1)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const infoPanelOpen = stage.dataset.infoOpen === 'true'
    const write = (x: number, y: number) => {
      stage.style.setProperty('--place-px', x.toFixed(4))
      stage.style.setProperty('--place-py', y.toFixed(4))
    }

    if ((!enabled && !infoPanelOpen) || reduced) {
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

      currentRef.current = {
        x: current.x + dx * PARALLAX_LERP,
        y: current.y + dy * PARALLAX_LERP,
      }
      write(currentRef.current.x, currentRef.current.y)
      frameRef.current = requestAnimationFrame(step)
    }

    const run = () => {
      if (frameRef.current !== null) return
      frameRef.current = requestAnimationFrame(step)
    }

    const setTarget = (x: number, y: number, scale = 1) => {
      const panelScale = stage.dataset.infoOpen === 'true' ? INFO_PANEL_PARALLAX_SCALE : 1
      const gain = intensityRef.current * scale * panelScale
      targetRef.current = {
        x: clamp(x * gain, -1, 1),
        y: clamp(y * gain, -1, 1),
      }
      run()
    }

    const handlePointerMove = (event: PointerEvent) => {
      // 触摸只负责地点轴；移动端视差由设备方向提供。
      if (event.pointerType === 'touch') return
      const rect = stage.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      setTarget(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        ((event.clientY - rect.top) / rect.height) * 2 - 1,
      )
    }

    const handlePointerLeave = () => {
      targetRef.current = { x: 0, y: 0 }
      run()
    }

    let touchActive = false
    const handleTouchStart = (event: PointerEvent) => {
      if (event.pointerType === 'touch') touchActive = true
    }
    const handleTouchEnd = (event: PointerEvent) => {
      if (event.pointerType === 'touch') touchActive = false
    }

    let baseline: OrientationPoint | null = null
    let baselineSum = { x: 0, y: 0, count: 0 }
    let lastOrientation: OrientationPoint | null = null
    let stableSince = 0
    let orientationListening = false

    const resetOrientationBaseline = () => {
      baseline = null
      baselineSum = { x: 0, y: 0, count: 0 }
      lastOrientation = null
      stableSince = 0
      targetRef.current = { x: 0, y: 0 }
      run()
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const point = mapOrientation(event)
      if (!point) return

      if (!baseline) {
        baselineSum.x += point.x
        baselineSum.y += point.y
        baselineSum.count += 1
        if (baselineSum.count >= INITIAL_BASELINE_SAMPLES) {
          baseline = {
            x: baselineSum.x / baselineSum.count,
            y: baselineSum.y / baselineSum.count,
          }
          lastOrientation = point
        }
        return
      }

      const now = performance.now()
      const movement = lastOrientation
        ? Math.hypot(point.x - lastOrientation.x, point.y - lastOrientation.y)
        : Number.POSITIVE_INFINITY

      if (movement <= STABLE_DELTA_DEG) {
        if (stableSince === 0) stableSince = now
        if (now - stableSince >= STABLE_REBASE_DELAY_MS) {
          baseline.x += (point.x - baseline.x) * SOFT_REBASE_RATE
          baseline.y += (point.y - baseline.y) * SOFT_REBASE_RATE
        }
      } else {
        stableSince = 0
      }
      lastOrientation = point

      const x = clamp((point.x - baseline.x) / ORIENTATION_RANGE_DEG, -1, 1)
      const y = clamp((point.y - baseline.y) / ORIENTATION_RANGE_DEG, -1, 1)
      setTarget(x, y, touchActive ? TOUCH_PARALLAX_SCALE : 1)
    }

    const startOrientation = () => {
      if (orientationListening) return
      window.addEventListener('deviceorientation', handleOrientation)
      orientationListening = true
    }

    const requestOrientationAccess = async (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return

      const OrientationEvent = window.DeviceOrientationEvent as
        | DeviceOrientationEventConstructorWithPermission
        | undefined
      if (!OrientationEvent) return

      const requestPermission = OrientationEvent.requestPermission
      if (!requestPermission) {
        startOrientation()
        return
      }

      const storedPermission = sessionStorage.getItem(MOTION_PERMISSION_SESSION_KEY)
      if (storedPermission === 'granted') {
        startOrientation()
        return
      }
      if (storedPermission === 'denied') return

      try {
        const result = await requestPermission()
        sessionStorage.setItem(MOTION_PERMISSION_SESSION_KEY, result)
        if (result === 'granted') startOrientation()
      } catch {
        // 浏览器拒绝或不支持时自然降级为无移动端视差。
      }
    }

    const OrientationEvent = window.DeviceOrientationEvent as
      | DeviceOrientationEventConstructorWithPermission
      | undefined
    if (OrientationEvent) {
      if (!OrientationEvent.requestPermission) startOrientation()
      else if (sessionStorage.getItem(MOTION_PERMISSION_SESSION_KEY) === 'granted') startOrientation()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resetOrientationBaseline()
    }

    write(currentRef.current.x, currentRef.current.y)
    window.addEventListener('pointermove', handlePointerMove)
    stage.addEventListener('pointerleave', handlePointerLeave)
    document.documentElement.addEventListener('mouseleave', handlePointerLeave)
    stage.addEventListener('pointerdown', handleTouchStart)
    stage.addEventListener('pointerup', handleTouchEnd)
    stage.addEventListener('pointercancel', handleTouchEnd)
    stage.addEventListener('pointerdown', requestOrientationAccess)
    window.addEventListener('orientationchange', resetOrientationBaseline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      stage.removeEventListener('pointerleave', handlePointerLeave)
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave)
      stage.removeEventListener('pointerdown', handleTouchStart)
      stage.removeEventListener('pointerup', handleTouchEnd)
      stage.removeEventListener('pointercancel', handleTouchEnd)
      stage.removeEventListener('pointerdown', requestOrientationAccess)
      window.removeEventListener('orientationchange', resetOrientationBaseline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (orientationListening) window.removeEventListener('deviceorientation', handleOrientation)
      stop()
    }
  }, [enabled, reduced, stageRef])
}
