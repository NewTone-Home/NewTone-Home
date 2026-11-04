import { closeRuntimeEntryHandle } from './runtimeEntryLifecycle.mjs'
function evidence(error, info) {
  return { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack ?? '' : '', stage: info.stage ?? 'runtime', componentStack: info.componentStack ?? '' }
}
export function createRuntimeRecovery(onRecover) {
  let owner = null, first = null, events = [], reporting = false
  return {
    reset(handle) { if (owner !== handle) { owner = handle; first = null; events = [] } },
    report(error, info = {}, handle = owner, observer = null) {
      const detail = evidence(error, info)
      first ??= detail
      if (events.length < 12) events.push(detail)
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
        if (events.length < 12) events.push(evidence(closeError, { stage: 'runtime-close' }))
      } finally {
        reporting = false
        onRecover({ first, events: [...events] })
      }
    },
  }
}
