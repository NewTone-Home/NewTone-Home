/** Best-effort lifecycle hooks. No auth mutation and no durability promise on unload. */
export function installPlayerAccountLifecycle({ saveCoordinator, windowTarget = globalThis.window, documentTarget = globalThis.document }) {
  const invoke = action => { try { Promise.resolve(action()).catch(() => {}) } catch { /* coordinator owns recovery state */ } }
  const checkpoint = () => { if (saveCoordinator.getSnapshot().source?.ownerId) invoke(() => saveCoordinator.checkpoint()) }
  const offline = () => { if (saveCoordinator.getSnapshot().source?.ownerId) invoke(() => saveCoordinator.suspend('ACCOUNT_SESSION_NOT_ACTIVE')) }
  const visibility = () => { if (documentTarget.visibilityState === 'hidden') checkpoint() }
  windowTarget?.addEventListener('offline', offline)
  windowTarget?.addEventListener('pagehide', checkpoint)
  documentTarget?.addEventListener('visibilitychange', visibility)
  if (windowTarget?.navigator?.onLine === false) offline()
  return () => {
    windowTarget?.removeEventListener('offline', offline)
    windowTarget?.removeEventListener('pagehide', checkpoint)
    documentTarget?.removeEventListener('visibilitychange', visibility)
  }
}
