// Detaching a React observer is not abandoning the durable game session.
const closedHandles = new WeakSet()
export function observeRuntimeEntry(handle, onStopped) {
  let disposed = false, notified = false
  let unsubscribe = () => {}
  const notify = reason => {
    if (disposed || notified) return
    notified = true
    onStopped(reason)
  }
  unsubscribe = handle.onStop(notify)
  return {
    abandon(reason) {
      if (disposed) return
      // close may synchronously emit onStop. Detach first and notify just once ourselves.
      unsubscribe()
      if (!closedHandles.has(handle)) {
        closedHandles.add(handle)
        try { handle.close() } catch { closedHandles.delete(handle); notify('SESSION_CLOSE_FAILED'); return }
      }
      notify(reason)
    },
    dispose() { disposed = true; unsubscribe() },
  }
}
