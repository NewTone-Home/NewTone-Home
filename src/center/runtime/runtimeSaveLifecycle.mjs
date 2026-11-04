// Bound to one runtime capability, never to a later global session.
export function createRuntimeSaveLifecycle(storage, sessionHandle) {
  let reason = null;
  const cancellations = new Set();
  function stop(firstReason) {
    if (reason !== null) return;
    reason = firstReason ?? 'save-session-stopped';
    const callbacks = [...cancellations];
    cancellations.clear();
    for (const cancel of callbacks) cancel();
  }
  function canPersist() {
    if (reason !== null) return false;
    if (sessionHandle?.isOpen === false || storage?.isOpen === false) {
      stop(sessionHandle?.stopReason ?? storage?.stopReason);
      return false;
    }
    try { storage?.check?.(); }
    catch (error) {
      // check() reports the first failure through the service before revoking.
      // Only that confirmed terminal capability may take the no-save exit.
      if (sessionHandle?.isOpen !== false && storage?.isOpen !== false) throw error;
      stop(sessionHandle?.stopReason ?? storage?.stopReason);
      return false;
    }
    return true;
  }
  return {
    canPersist,
    assertActive() { if (!canPersist()) throw Error(reason); },
    run(callback) { if (canPersist()) return callback(); },
    onStop(cancel) {
      if (!canPersist()) { cancel(); return () => {}; }
      cancellations.add(cancel);
      return () => cancellations.delete(cancel);
    },
    connect() { return sessionHandle?.onStop?.(stop) ?? (() => {}); },
    get stopReason() { return reason; },
  };
}
