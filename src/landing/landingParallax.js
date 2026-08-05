export const LANDING_PARALLAX_LIMIT = Object.freeze({ x: 12, y: 9 })

export function resolveLandingParallax(clientX, clientY, viewportWidth, viewportHeight) {
  const width = Math.max(1, viewportWidth)
  const height = Math.max(1, viewportHeight)
  const normalizedX = Math.max(-1, Math.min(1, (clientX / width - 0.5) * 2))
  const normalizedY = Math.max(-1, Math.min(1, (clientY / height - 0.5) * 2))
  return {
    x: normalizedX * LANDING_PARALLAX_LIMIT.x,
    y: normalizedY * LANDING_PARALLAX_LIMIT.y,
  }
}
