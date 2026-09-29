export type SceneFramePolicy = 'interactive' | 'exploration' | 'passage' | 'gate'

export type SceneFramePhase = 'hidden' | 'appearing' | 'visible' | 'retracting'

export type SceneFrameTarget = {
  group: string
  policy: SceneFramePolicy
  phase: string
  gateTriggered: boolean
  interactionBusy: boolean
  interactionActive: boolean
  retractRequested: boolean
  suppressed: boolean
}

export type SceneFrameRuntime = {
  corner: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'
  phase: SceneFramePhase
  fullyCollapsed: boolean
  preserveCornerOnResume: boolean
  resumeCorner: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' | null
  transitionDirection: 'appearing' | 'retracting' | null
  transitionStartedAt: number
  initialized: boolean
  hovered: boolean
  locked: boolean
}

export function frameShouldCollapse(target: SceneFrameTarget, runtime: SceneFrameRuntime) {
  if (target.suppressed) return true
  if (target.retractRequested) return true
  if (target.policy === 'interactive') return false
  if (target.policy === 'exploration') return !target.interactionActive && !runtime.hovered && !runtime.locked
  if (target.policy === 'gate') return target.gateTriggered
  return target.phase !== 'closed'
}

export function beginFrameRetraction(runtime: SceneFrameRuntime, transitionStartedAt: number, preserveCornerOnResume: boolean) {
  if (preserveCornerOnResume) preserveFrameRetractCorner(runtime)
  else {
    runtime.preserveCornerOnResume = false
    runtime.resumeCorner = null
  }
  runtime.phase = 'retracting'
  runtime.fullyCollapsed = false
  runtime.transitionDirection = 'retracting'
  runtime.transitionStartedAt = transitionStartedAt
}

export function preserveFrameRetractCorner(runtime: SceneFrameRuntime) {
  if (runtime.preserveCornerOnResume) return
  runtime.preserveCornerOnResume = true
  runtime.resumeCorner = runtime.corner
}

export function resumeFrameAppearance(runtime: SceneFrameRuntime, nextCorner: SceneFrameRuntime['corner'], transitionStartedAt: number) {
  if (runtime.resumeCorner) runtime.corner = runtime.resumeCorner
  else if (!runtime.preserveCornerOnResume) runtime.corner = nextCorner
  runtime.preserveCornerOnResume = false
  runtime.resumeCorner = null
  runtime.phase = 'appearing'
  runtime.fullyCollapsed = false
  runtime.transitionDirection = 'appearing'
  runtime.transitionStartedAt = transitionStartedAt
}

export function beginFrameAppearance(runtime: SceneFrameRuntime, transitionStartedAt: number) {
  runtime.phase = 'appearing'
  runtime.fullyCollapsed = false
  runtime.transitionDirection = 'appearing'
  runtime.transitionStartedAt = transitionStartedAt
}

/**
 * A CSS transitionend has no direction token. Keep the lifecycle from
 * accepting a completion from a transition that was superseded in the same
 * frame: its event timestamp predates the current transition's duration.
 */
export function completeFrameTransition(
  runtime: SceneFrameRuntime,
  retractRequested: boolean,
  eventTimestamp: number,
  elapsedMs: number,
  reachedCurrentEndpoint: boolean,
) {
  const earliestCurrentCompletion = runtime.transitionStartedAt + Math.max(0, elapsedMs - 34)
  if (!runtime.transitionDirection || eventTimestamp < earliestCurrentCompletion || !reachedCurrentEndpoint) return false
  if (runtime.transitionDirection === 'retracting' && runtime.phase === 'retracting' && retractRequested) {
    runtime.phase = 'hidden'
    runtime.fullyCollapsed = true
    runtime.transitionDirection = null
    return true
  }
  if (runtime.transitionDirection === 'appearing' && runtime.phase === 'appearing') {
    runtime.phase = 'visible'
    runtime.fullyCollapsed = false
    runtime.transitionDirection = null
    return true
  }
  return false
}

export function frameVisualPhase(runtime: SceneFrameRuntime) {
  return runtime.phase === 'hidden' ? 'collapsed' : runtime.phase
}
