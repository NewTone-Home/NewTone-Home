export const LANDING_PARALLAX_LIMIT = Object.freeze({ x: 12, y: 9 })
export const LANDING_PARALLAX_BACK_LIMIT = Object.freeze({ x: 5, y: 3.5 })
export const ORIENTATION_RANGE_DEG = 14

export function clampParallax(value) {
  return Math.max(-1, Math.min(1, value))
}

export function resolvePointerNormalized(clientX, clientY, viewportWidth, viewportHeight) {
  const width = Math.max(1, viewportWidth)
  const height = Math.max(1, viewportHeight)
  return {
    x: clampParallax((clientX / width - 0.5) * 2),
    y: clampParallax((clientY / height - 0.5) * 2),
  }
}

export function mapDeviceOrientation(beta, gamma, screenAngle = 0) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null
  if (screenAngle === 90) return { x: beta, y: -gamma }
  if (screenAngle === 270 || screenAngle === -90) return { x: -beta, y: gamma }
  if (screenAngle === 180 || screenAngle === -180) return { x: -gamma, y: -beta }
  return { x: gamma, y: beta }
}

export function resolveOrientationNormalized(point, baseline, range = ORIENTATION_RANGE_DEG) {
  if (!point || !baseline) return { x: 0, y: 0 }
  const safeRange = Math.max(1, range)
  return {
    x: clampParallax((point.x - baseline.x) / safeRange),
    y: clampParallax((point.y - baseline.y) / safeRange),
  }
}

export function resolveLandingParallax(clientX, clientY, viewportWidth, viewportHeight) {
  const normalized = resolvePointerNormalized(clientX, clientY, viewportWidth, viewportHeight)
  return {
    x: normalized.x * LANDING_PARALLAX_LIMIT.x,
    y: normalized.y * LANDING_PARALLAX_LIMIT.y,
  }
}
