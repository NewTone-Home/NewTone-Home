export type MainlineSceneActionExitBarrier = Readonly<{
  actionId: number
  optionCount: number
  completedOptionIndexes: ReadonlySet<number>
  committed: boolean
}>

export type MainlineSceneActionPhase = 'active' | 'committing' | 'exiting' | null
export type MainlineSceneActionExitIntent = 'cancel' | 'replace'

export function resolveMainlineSceneActionCancellation<T>(
  phase: MainlineSceneActionPhase,
  pendingAction: T | null,
  intent: MainlineSceneActionExitIntent,
): { phase: MainlineSceneActionPhase; pendingAction: T | null } {
  return {
    phase: phase === 'active' ? 'exiting' : phase,
    pendingAction: intent === 'replace' ? pendingAction : null,
  }
}

export function createMainlineSceneActionExitBarrier(actionId: number, optionCount: number): MainlineSceneActionExitBarrier {
  return { actionId, optionCount, completedOptionIndexes: new Set(), committed: false }
}

export function commitMainlineSceneActionExit(barrier: MainlineSceneActionExitBarrier, actionId: number): MainlineSceneActionExitBarrier {
  return barrier.actionId === actionId ? { ...barrier, committed: true } : barrier
}

export function cancelMainlineSceneActionExit(barrier: MainlineSceneActionExitBarrier, actionId: number): MainlineSceneActionExitBarrier {
  return commitMainlineSceneActionExit(barrier, actionId)
}

export function completeMainlineSceneActionOptionExit(barrier: MainlineSceneActionExitBarrier, actionId: number, optionIndex: number): MainlineSceneActionExitBarrier {
  if (barrier.actionId !== actionId || optionIndex < 0 || optionIndex >= barrier.optionCount || barrier.completedOptionIndexes.has(optionIndex)) return barrier
  return { ...barrier, completedOptionIndexes: new Set([...barrier.completedOptionIndexes, optionIndex]) }
}

export function mainlineSceneActionExitMayUnmount(barrier: MainlineSceneActionExitBarrier): boolean {
  return barrier.committed && barrier.completedOptionIndexes.size === barrier.optionCount
}
