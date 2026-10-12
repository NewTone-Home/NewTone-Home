export const centerReadingDimmerTargets = {
  observation: 0.18,
  dialogue: 0.42,
} as const
export const centerReadingDimmerFullTransitionMs = 800

/** Keep full transitions cinematic while scaling interrupted reversals to remaining distance. */
export function centerReadingDimmerTransitionDurationMs(from: number, to: number, target: number) {
  const distance = Math.abs(to - from)
  if (distance === 0) return 0
  const referenceDistance = to === 0 ? Math.abs(from) : Math.abs(target)
  return centerReadingDimmerFullTransitionMs * distance / Math.max(referenceDistance, Number.EPSILON)
}
