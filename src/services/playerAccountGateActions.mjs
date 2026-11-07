const failed = (code, message) => ({ ok: false, error: { code, message } })
const unavailable = () => failed('unavailable', 'This account action is not available yet.')

/** Per-mounted-view action fence. Does not own controller/coordinator lifetime. */
export function createPlayerAccountGateActions({ authController, saveCoordinator, navigate,
  onPending = () => {}, onError = () => {}, onCodeClear = () => {},
}) {
  let revision = 0
  let pending = false
  let disposed = false
  function run(kind, operation, supersede = false) {
    if (disposed) return Promise.resolve(failed('disposed', 'This account view is closed.'))
    if (pending && (!supersede || pending === 'guest')) return Promise.resolve(failed('busy', 'Please wait for the current action.'))
    const ticket = ++revision
    const current = () => !disposed && revision === ticket
    pending = kind
    onError(null)
    onPending(kind)
    return (async () => {
      try {
        if (!current()) return failed('cancelled', 'Action dismissed.')
        const result = await operation(current)
        if (!current()) return failed('cancelled', 'Action dismissed.')
        if (result?.ok !== true) {
          const error = result?.error?.message ? result.error : { code: 'action_failed', message: 'Unable to complete this action. Please try again.' }
          onError(error)
          return { ok: false, error }
        }
        return result
      } catch {
        const result = failed('action_failed', 'Unable to complete this action. Please try again.')
        if (current()) onError(result.error)
        return result
      } finally {
        if (current()) { pending = false; onPending(null) }
      }
    })()
  }
  return {
    requestLink: email => run('request_link', () => authController?.requestEmailLink(email) ?? unavailable()),
    requestOtp: email => run('request_otp', () => authController?.requestEmailOtp(email) ?? unavailable()),
    verifyOtp: (email, code) => run('verify_otp', async current => {
      const result = await (authController?.verifyEmailOtp(email, code) ?? unavailable())
      if (current() && result.ok) onCodeClear()
      return result
    }),
    google: () => run('google_oauth', async current => {
      // Do not even initiate OAuth without an explicit navigation adapter.
      if (typeof navigate !== 'function') return unavailable()
      const result = await (authController?.beginGoogleOAuth() ?? unavailable())
      if (current() && result.ok) {
        const url = new URL(result.data?.url)
        if (url.protocol !== 'https:' || url.username || url.password) return unavailable()
        await navigate(url.href)
      }
      return result
    }),
    logout: () => run('logout', async current => {
      const prepared = await (saveCoordinator?.logout() ?? unavailable())
      if (prepared?.ok !== true || !current()) return prepared
      return authController?.logout() ?? unavailable()
    }),
    continueGuest: () => run('guest', async () => {
      authController?.cancel()
      onCodeClear()
      return saveCoordinator?.continueGuest() ?? unavailable()
    }, true),
    selectSlot: slotId => run('select_slot', () => saveCoordinator?.selectSlot(slotId) ?? unavailable()),
    createSlot: () => run('create_slot', () => saveCoordinator?.createSlot() ?? unavailable()),
    resolveConflict: request => run('resolve_conflict', () => {
      const snapshot = saveCoordinator?.getSnapshot?.(), conflict = snapshot?.conflict
      if (snapshot?.status !== 'conflict' || !['local', 'cloud'].includes(request?.choice)
        || typeof request?.token !== 'string' || !request.token || conflict?.token !== request.token || conflict?.slotId !== request.slotId
        || (conflict.pendingChoice != null && conflict.pendingChoice !== request.choice)) {
        return failed('stale_conflict', 'The save comparison changed. Review both versions again.')
      }
      return saveCoordinator?.resolveConflict?.({ slotId: request.slotId, token: request.token, choice: request.choice }) ?? unavailable()
    }),
    listBackups: slotId => run('list_backups', () => {
      const snapshot = saveCoordinator?.getSnapshot?.()
      const known = snapshot?.selectedSlotId === slotId || snapshot?.conflict?.slotId === slotId
        || snapshot?.slots?.some(slot => slot.slotId === slotId)
      if (typeof slotId !== 'string' || !slotId || !known) return failed('unknown_slot', 'Choose a known save before viewing its backups.')
      return saveCoordinator?.listBackups?.(slotId) ?? unavailable()
    }),
    restoreBackup: request => run('restore_backup', () => {
      const snapshot = saveCoordinator?.getSnapshot?.(), recovery = snapshot?.recovery
      if (snapshot?.conflict?.pendingChoice != null || recovery?.status !== 'ready' || typeof request?.token !== 'string' || !request.token
        || recovery.token !== request.token || recovery.slotId !== request.slotId
        || !recovery.backups?.some(backup => backup.backupId === request.backupId)) {
        return failed('stale_backup', 'The backup list changed. Review the backup again before restoring.')
      }
      return saveCoordinator?.restoreBackup?.({ slotId: request.slotId, backupId: request.backupId, token: request.token }) ?? unavailable()
    }),
    retry: () => run('load_slots', () => saveCoordinator?.bootstrap() ?? unavailable()),
    changeEmail() {
      if (disposed || pending) return
      authController?.cancel()
      onCodeClear()
      onError(null)
    },
    dispose() { disposed = true; revision += 1 },
  }
}
