import { closeRuntimeEntryHandle } from './runtimeEntryLifecycle.mjs'
export function runtimeFailureDetail(error, info = {}) {
  return { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack ?? '' : '', stage: info.stage ?? 'runtime', componentStack: info.componentStack ?? '' }
}
export function runtimeFailureRecord(error, info = {}) {
  const first = runtimeFailureDetail(error, info)
  return { first, events: [first] }
}
export function createRuntimeRecovery(onRecover) {
  let owner = null, first = null, events = [], reporting = false
  const terminated = new WeakMap()
  return {
    isTerminated(handle) { return Boolean(handle && terminated.has(handle)) },
    reset(handle) {
      if (handle && terminated.has(handle)) return false
      if (owner !== handle) { owner = handle; first = null; events = [] }
      return true
    },
    report(error, info = {}, handle = owner, observer = null) {
      const previous = handle && terminated.get(handle)
      if (previous) { first = previous.first; events = [...previous.events] }
      const detail = runtimeFailureDetail(error, info)
      first ??= detail
      if (events.length < 12) events.push(detail)
      // Latch before close/onStop/React effect replay can reenter this path.
      if (handle) terminated.set(handle, { first, events: [...events] })
      if (reporting) return
      reporting = true
      try {
        // Stop callbacks are detached before close; never reopen an old handle.
        if (handle) {
          if (observer?.handle === handle) {
            if (observer.lifecycle.abandon(detail.message, { notifyUI: false }) === false) throw Error('SESSION_CLOSE_FAILED')
          } else closeRuntimeEntryHandle(handle)
        }
      } catch (closeError) {
        if (events.length < 12) events.push(runtimeFailureDetail(closeError, { stage: 'runtime-close' }))
      } finally {
        reporting = false
        const record = { first, events: [...events] }
        if (handle) terminated.set(handle, record)
        onRecover(record)
      }
    },
  }
}
