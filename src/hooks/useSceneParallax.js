import { useEffect, useRef } from 'react'
import {
  LANDING_PARALLAX_BACK_LIMIT,
  LANDING_PARALLAX_LIMIT,
  clampParallax,
  mapDeviceOrientation,
  resolveOrientationNormalized,
  resolvePointerNormalized,
  resolveStablePoseAnchor,
} from '../landing/landingParallax'

const PARALLAX_LERP = 0.18
const PARALLAX_EPSILON = 0.0015
const INITIAL_BASELINE_SAMPLES = 12
const STABLE_POSE_RADIUS_DEG = 0.55
const STABLE_REBASE_DELAY_MS = 1800
const SOFT_REBASE_RATE = 0.018
const MOTION_PERMISSION_SESSION_KEY = 'newtone-scene-motion-permission'
const MOTION_PREFERENCE_KEY = 'newtone-scene-motion-enabled'
let motionPermissionRequestedThisPage = false

function readScreenAngle() {
  if (typeof screen !== 'undefined' && screen.orientation) return screen.orientation.angle
  return typeof window.orientation === 'number' ? window.orientation : 0
}

function readSessionPermission() {
  try {
    return sessionStorage.getItem(MOTION_PERMISSION_SESSION_KEY)
  } catch {
    return null
  }
}

function writeSessionPermission(value) {
  try {
    if (value) sessionStorage.setItem(MOTION_PERMISSION_SESSION_KEY, value)
    else sessionStorage.removeItem(MOTION_PERMISSION_SESSION_KEY)
  } catch {
    // Private browsing may make session storage unavailable.
  }
}

function readMotionPreference() {
  try {
    return localStorage.getItem(MOTION_PREFERENCE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeMotionPreference(enabled) {
  try {
    if (enabled) localStorage.setItem(MOTION_PREFERENCE_KEY, 'true')
    else localStorage.removeItem(MOTION_PREFERENCE_KEY)
  } catch {
    // The preference is optional; orientation still works for this page view.
  }
}

function isOrientationInputPreferred() {
  return window.matchMedia?.('(hover: none), (pointer: coarse)').matches === true
}

export function useSceneParallax({ rootRef, enabled = true, reduced = false }) {
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const write = (x, y, source = root.dataset.parallaxSource || 'static') => {
      root.style.setProperty('--scene-parallax-x', x.toFixed(4))
      root.style.setProperty('--scene-parallax-y', y.toFixed(4))
      root.style.setProperty('--scene-parallax-front-x', `${(x * LANDING_PARALLAX_LIMIT.x).toFixed(3)}px`)
      root.style.setProperty('--scene-parallax-front-y', `${(y * LANDING_PARALLAX_LIMIT.y).toFixed(3)}px`)
      root.style.setProperty('--scene-parallax-back-x', `${(-x * LANDING_PARALLAX_BACK_LIMIT.x).toFixed(3)}px`)
      root.style.setProperty('--scene-parallax-back-y', `${(-y * LANDING_PARALLAX_BACK_LIMIT.y).toFixed(3)}px`)
      root.dataset.parallaxX = x.toFixed(4)
      root.dataset.parallaxY = y.toFixed(4)
      root.dataset.parallaxSource = source
    }

    const stop = () => {
      if (!frameRef.current) return
      cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }

    const step = () => {
      frameRef.current = 0
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
      if (!frameRef.current) frameRef.current = requestAnimationFrame(step)
    }

    const setTarget = (x, y, source) => {
      targetRef.current = { x: clampParallax(x), y: clampParallax(y) }
      root.dataset.parallaxSource = source
      run()
    }

    const resetOutput = () => {
      targetRef.current = { x: 0, y: 0 }
      currentRef.current = { x: 0, y: 0 }
      write(0, 0, 'static')
    }

    if (!enabled || reduced) {
      resetOutput()
      return () => stop()
    }

    const orientationPreferred = isOrientationInputPreferred()
    let baseline = null
    let baselineSum = { x: 0, y: 0, count: 0 }
    let stableAnchor = null
    let stableSince = 0
    let orientationListening = false
    let orientationReceived = false
    let permissionRequestInFlight = false

    const resetOrientationBaseline = () => {
      baseline = null
      baselineSum = { x: 0, y: 0, count: 0 }
      stableAnchor = null
      stableSince = 0
      setTarget(0, 0, orientationPreferred ? 'orientation-calibrating' : 'pointer')
    }

    const handleOrientation = event => {
      const point = mapDeviceOrientation(event.beta, event.gamma, readScreenAngle())
      if (!point) return
      orientationReceived = true

      if (!baseline) {
        baselineSum.x += point.x
        baselineSum.y += point.y
        baselineSum.count += 1
        if (baselineSum.count >= INITIAL_BASELINE_SAMPLES) {
          baseline = {
            x: baselineSum.x / baselineSum.count,
            y: baselineSum.y / baselineSum.count,
          }
          stableAnchor = point
          stableSince = performance.now()
          root.dataset.parallaxSource = 'orientation'
        }
        return
      }

      const now = performance.now()
      const stablePose = resolveStablePoseAnchor(stableAnchor, point, STABLE_POSE_RADIUS_DEG)
      stableAnchor = stablePose.anchor
      if (stablePose.stable) {
        if (now - stableSince >= STABLE_REBASE_DELAY_MS) {
          baseline.x += (point.x - baseline.x) * SOFT_REBASE_RATE
          baseline.y += (point.y - baseline.y) * SOFT_REBASE_RATE
        }
      } else {
        stableSince = now
      }
      const normalized = resolveOrientationNormalized(point, baseline)
      setTarget(normalized.x, normalized.y, 'orientation')
    }

    const startOrientation = () => {
      if (orientationListening) return
      window.addEventListener('deviceorientation', handleOrientation)
      orientationListening = true
      resetOrientationBaseline()
    }

    const requestOrientationAccess = async event => {
      if (!['touch', 'pen'].includes(event.pointerType) || permissionRequestInFlight) return
      if (!event.target?.closest?.('[data-motion-parallax-trigger="true"]')) return
      const OrientationEvent = window.DeviceOrientationEvent
      if (!OrientationEvent) return
      if (orientationReceived) return
      if (typeof OrientationEvent.requestPermission !== 'function') {
        startOrientation()
        return
      }
      if (readSessionPermission() === 'granted') {
        startOrientation()
        return
      }
      if (motionPermissionRequestedThisPage) return
      motionPermissionRequestedThisPage = true
      permissionRequestInFlight = true
      try {
        const result = await OrientationEvent.requestPermission()
        if (result === 'granted') {
          writeSessionPermission('granted')
          writeMotionPreference(true)
          startOrientation()
        } else {
          writeSessionPermission(null)
          writeMotionPreference(false)
        }
      } catch {
        writeSessionPermission(null)
        if (!readMotionPreference()) writeMotionPreference(false)
      } finally {
        permissionRequestInFlight = false
      }
    }

    const handlePointerMove = event => {
      if (orientationPreferred || event.pointerType === 'touch') return
      const normalized = resolvePointerNormalized(event.clientX, event.clientY, window.innerWidth, window.innerHeight)
      setTarget(normalized.x, normalized.y, 'pointer')
    }

    const returnToCenter = () => {
      if (!orientationPreferred) setTarget(0, 0, 'pointer')
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resetOrientationBaseline()
    }

    write(currentRef.current.x, currentRef.current.y, 'static')
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('blur', returnToCenter)
    document.documentElement.addEventListener('mouseleave', returnToCenter)

    if (orientationPreferred) {
      const OrientationEvent = window.DeviceOrientationEvent
      if (OrientationEvent) {
        // Listening first is intentional. Browsers that retain permission will
        // deliver events without another prompt; restricted Safari stays quiet
        // until the next completed NewTone gesture requests access.
        startOrientation()
      }
      root.addEventListener('pointerup', requestOrientationAccess)
      window.addEventListener('orientationchange', resetOrientationBaseline)
      screen.orientation?.addEventListener?.('change', resetOrientationBaseline)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('pageshow', resetOrientationBaseline)
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('blur', returnToCenter)
      document.documentElement.removeEventListener('mouseleave', returnToCenter)
      root.removeEventListener('pointerup', requestOrientationAccess)
      window.removeEventListener('orientationchange', resetOrientationBaseline)
      screen.orientation?.removeEventListener?.('change', resetOrientationBaseline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', resetOrientationBaseline)
      if (orientationListening) window.removeEventListener('deviceorientation', handleOrientation)
      stop()
    }
  }, [enabled, reduced, rootRef])
}
