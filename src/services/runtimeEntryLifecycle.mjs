// Detaching a React observer is not abandoning the durable game session.
const closedHandles = new WeakSet()
export function closeRuntimeEntryHandle(handle) {
  if (closedHandles.has(handle)) return
  closedHandles.add(handle)
  try { handle.close() } catch (error) { closedHandles.delete(handle); throw error }
}
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
    abandon(reason, { notifyUI = true } = {}) {
      if (disposed) return
      // close may synchronously emit onStop. Detach first and notify just once ourselves.
      unsubscribe()
      if (!notifyUI) notified = true
      try { closeRuntimeEntryHandle(handle) } catch { notify('SESSION_CLOSE_FAILED'); return false }
      notify(reason)
      return true
    },
    dispose() { disposed = true; unsubscribe() },
  }
}
