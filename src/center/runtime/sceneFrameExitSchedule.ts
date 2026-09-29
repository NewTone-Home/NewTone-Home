export type SceneFocusFrameMotionProfile = Readonly<{
  group: string
  durationMs: number
}>

/**
 * Returns only the frame groups whose own normal retract duration fits inside
 * the live movement time remaining for this passage approach.
 */
export function sceneFrameGroupsDueForExit(
  profile: readonly SceneFocusFrameMotionProfile[],
  requestedGroups: ReadonlySet<string>,
  remainingMovementMs: number,
) {
  if (!Number.isFinite(remainingMovementMs)) return []
  return profile
    .filter(({ group, durationMs }) => !requestedGroups.has(group) && remainingMovementMs <= durationMs)
    .map(({ group }) => group)
}
