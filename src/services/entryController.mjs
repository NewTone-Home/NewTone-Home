// UI coordination only. All durable identities and writes belong to the save service.
export function createEntryController(service) {
  let state = { phase: 'probing', inspection: null, reasons: [], epoch: 0 }
  let locked = false, started = false, acknowledgement = null
  const listeners = new Set()
  const publish = patch => { state = { ...state, ...patch, epoch: state.epoch + 1 }; for (const fn of listeners) fn(state) }
  const reason = result => result.reasonCodes ?? []
  const permitted = action => state.inspection?.allowedActions?.includes(action)
  async function inspect() {
    const result = await service.inspectSave()
    const phase = result.status !== 'ready' || result.classification == null ? 'failed'
      : result.classification === 'empty' ? 'start-ready'
      : ['historical-supported', 'generation-current'].includes(result.classification) ? 'choice-ready'
      : 'unknown'
    publish({ phase, inspection: result, reasons: reason(result), committed: null, focusTarget: null })
  }
  function accept(result) {
    if (!result.snapshot || !result.receipt || !result.sessionHandle) throw Error('INCOMPLETE_COMMITTED_RESULT')
    result.sessionHandle.check()
    acknowledgement = null
    publish({ phase: 'entering', committed: result, reasons: [] })
  }
  async function recover() {
    const recovery = await service.getRecoveryState()
    if (recovery.status === 'operation-found') {
      const result = await service.resolveOperation({ ticket: recovery.ticket })
      if (result.status === 'committed') return accept(result)
      if (result.status === 'not-committed' && result.resumeAllowed === true) {
        // Service proved this exact prepared request was not committed. Reuse its ticket.
        const resumed = await service.commitEntry({ ticket: result.ticket })
        if (resumed.status === 'committed') return accept(resumed)
        return publish({ phase: resumed.status === 'outcome-uncertain' ? 'uncertain' : 'failed', reasons: reason(resumed) })
      }
      if (result.status === 'superseded') return inspect()
      if (result.status === 'not-committed') return publish({ phase: 'failed', reasons: reason(result) })
      return publish({ phase: 'uncertain', reasons: reason(result) })
    }
    if (recovery.status === 'no-pending-operation') return inspect()
    publish({ phase: 'failed', reasons: reason(recovery) })
  }
  async function run(work) {
    if (locked || state.phase === 'entering') return false
    locked = true
    try { await work(); return true }
    catch {
      // A lost response is not proof of failure. Recover the durable ticket first.
      publish({ phase: 'uncertain', reasons: ['OPERATION_RESPONSE_LOST'] })
      try { await recover() } catch { publish({ phase: 'uncertain', reasons: ['RECOVERY_UNAVAILABLE'] }) }
      return false
    } finally { locked = false }
  }
  return {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    start() { if (started) return; started = true; return run(recover) },
    recheck() { return run(async () => { publish({ phase: 'probing' }); await recover() }) },
    requestReplace() {
      if (locked || state.phase !== 'choice-ready' || !permitted('request-replace')) return false
      publish({ phase: 'overwrite-confirm' }); return true
    },
    cancelReplace() {
      if (locked || state.phase !== 'overwrite-confirm') return false
      publish({ phase: 'choice-ready', focusTarget: 'request-replace' }); return true
    },
    back() {
      if (locked || !['unknown', 'failed'].includes(state.phase)) return false
      publish({ phase: 'back' }); return true
    },
    submit(intent) {
      const valid = intent === 'create' ? state.phase === 'start-ready' && permitted('create')
        : intent === 'continue' ? state.phase === 'choice-ready' && permitted('continue')
        : intent === 'replace' && state.phase === 'overwrite-confirm' && permitted('request-replace')
      if (!valid || locked) return Promise.resolve(false)
      const snapshotToken = state.inspection.snapshotToken
      return run(async () => {
        publish({ phase: 'committing', reasons: [] })
        const prepared = await service.prepareEntry({ intent, snapshotToken, overwriteConfirmed: intent === 'replace' })
        if (prepared.status !== 'prepared') {
          if (prepared.status === 'stale') return inspect()
          publish({ phase: 'failed', reasons: reason(prepared) }); return
        }
        const result = await service.commitEntry({ ticket: prepared.ticket })
        if (result.status === 'committed') return accept(result)
        if (result.status === 'outcome-uncertain') { publish({ phase: 'uncertain', reasons: reason(result) }); return }
        if (result.status === 'superseded') return inspect()
        publish({ phase: 'failed', reasons: reason(result) })
      })
    },
    acknowledgeEntered() {
      if (state.phase !== 'entering' || !state.committed) return Promise.resolve(false)
      if (acknowledgement) return acknowledgement
      const current = state.committed
      acknowledgement = (async () => {
        try {
          const result = await service.acknowledgeEntry({ ticket: current.ticket, sessionHandle: current.sessionHandle })
          if (state.committed !== current) return false
          if (result.status === 'acknowledged') return true
          publish({ phase: 'uncertain', committed: null, reasons: reason(result) }); return false
        } catch {
          if (state.committed === current) publish({ phase: 'uncertain', committed: null, reasons: ['ACK_RESPONSE_LOST'] })
          return false
        }
      })()
      return acknowledgement
    },
    stopped(reasonCode) { publish({ phase: 'failed', committed: null, reasons: [reasonCode || 'SESSION_STOPPED'] }) },
  }
}
