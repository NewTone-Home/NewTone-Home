export function canAdoptRuntime(controllerState, result, recovery) {
  return controllerState.phase === 'entering'
    && controllerState.committed === result
    && !recovery.isTerminated(result.sessionHandle)
    && result.sessionHandle.isOpen !== false
}
