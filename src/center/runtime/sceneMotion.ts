/**
 * The frame is drawn at a relative screen-space speed, not a fixed duration.
 * A small floor keeps short labels visibly drawable without making long text
 * boxes race through the same animation budget.
 */
export const sceneFrameDrawSpeedPxPerSecond = 300
export const sceneFrameMinimumMotionMs = 1100
export const sceneFrameDefaultMotionMs = sceneFrameMinimumMotionMs
export const sceneFrameExitLeadRatio = 1.25

export function sceneFrameMotionMsForRect(width: number, height: number) {
  const perimeter = Math.max(0, width) * 2 + Math.max(0, height) * 2
  if (perimeter <= 0) return sceneFrameDefaultMotionMs
  return Math.max(sceneFrameMinimumMotionMs, Math.round(perimeter / sceneFrameDrawSpeedPxPerSecond * 1000))
}

export function sceneFrameRetractionBudgetMs(durationMs: number) {
  return Math.ceil(Math.max(sceneFrameDefaultMotionMs, durationMs) * sceneFrameExitLeadRatio)
}
