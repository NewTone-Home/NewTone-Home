// UI coordination only. All durable identities and writes belong to the save service.
export function createEntryController(service) {
  let state = { phase: 'probing', inspection: null, reasons: [], inspectionWarnings: [], operationWarnings: [], committedWarnings: [], warningSource: 'inspection', epoch: 0 }
  let locked = false, started = false, acknowledgement = null, acknowledgingHandle = null, acknowledgementStopped = false
  const listeners = new Set()
  const publish = patch => { state = { ...state, ...patch, epoch: state.epoch + 1 }; for (const fn of listeners) fn(state) }
  const reason = result => result.reasonCodes ?? []
  const warnings = result => [...new Set((result.warnings ?? []).filter(code => typeof code === 'string'))]
  const captureOperationWarnings = result => {
    if (Array.isArray(result.warnings)) publish({ operationWarnings: warnings(result), warningSource: 'operation' })
  }
  const permitted = action => state.inspection?.allowedActions?.includes(action)
  async function inspect() {
    const result = await service.inspectSave()
    const phase = result.status !== 'ready' || result.classification == null ? 'failed'
      : result.classification === 'empty' ? 'start-ready'
      : ['historical-supported', 'generation-current'].includes(result.classification) ? 'choice-ready'
      : 'unknown'
    publish({ phase, inspection: result, reasons: reason(result), committed: null, focusTarget: null, inspectionWarnings: warnings(result), operationWarnings: [], committedWarnings: [], warningSource: 'inspection' })
  }
  function accept(result) {
    if (!result.snapshot || !result.receipt || !result.sessionHandle) throw Error('INCOMPLETE_COMMITTED_RESULT')
    result.sessionHandle.check()
    acknowledgement = null
    publish({ phase: 'entering', committed: result, reasons: [], committedWarnings: warnings(result), warningSource: 'committed', runtimeEvidence: null })
  }
  async function recover() {
    const recovery = await service.getRecoveryState()
    if (recovery.status === 'operation-found') {
      captureOperationWarnings(recovery)
      const result = await service.resolveOperation({ ticket: recovery.ticket })
      captureOperationWarnings(result)
      if (result.status === 'committed') return accept(result)
      if (result.status === 'not-committed' && result.resumeAllowed === true) {
        // Service proved this exact prepared request was not committed. Reuse its ticket.
        const resumed = await service.commitEntry({ ticket: result.ticket })
        captureOperationWarnings(resumed)
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
        publish({ phase: 'committing', reasons: [], ...(intent === 'create' || intent === 'replace' ? { operationWarnings: [], committedWarnings: [], warningSource: 'operation' } : {}) })
        const prepared = await service.prepareEntry({ intent, snapshotToken, overwriteConfirmed: intent === 'replace' })
        captureOperationWarnings(prepared)
        if (prepared.status !== 'prepared') {
          if (prepared.status === 'stale') return inspect()
          publish({ phase: prepared.status === 'outcome-uncertain' ? 'uncertain' : 'failed', reasons: reason(prepared) }); return
        }
        const result = await service.commitEntry({ ticket: prepared.ticket })
        captureOperationWarnings(result)
        if (result.status === 'committed') return accept(result)
        if (result.status === 'outcome-uncertain') { publish({ phase: 'uncertain', reasons: reason(result) }); return }
        if (result.status === 'superseded') return inspect()
        publish({ phase: 'failed', reasons: reason(result) })
      })
    },
    acknowledgeEntered({ abandon } = {}) {
      if (state.phase !== 'entering' || !state.committed) return Promise.resolve(false)
      if (acknowledgement) return acknowledgement
      const current = state.committed
      acknowledgingHandle = current.sessionHandle
      acknowledgementStopped = false
      const pause = (codes, error = null) => {
        const detail = { message: error instanceof Error ? error.message : codes[0] ?? 'ACKNOWLEDGEMENT_FAILED', stack: error instanceof Error ? error.stack ?? '' : '', stage: 'acknowledgement', componentStack: '' }
        const runtimeEvidence = state.runtimeEvidence ?? { first: detail, events: [detail] }
        // The UI closes through its observer, detaching onStop before close.
        // Do not clear the service ticket/receipt or restore any previous handle.
        try { abandon?.('ACKNOWLEDGEMENT_FAILED') } catch { codes = [...codes, 'SESSION_CLOSE_FAILED'] }
        if (state.committed === current) publish({ phase: 'uncertain', committed: null, reasons: codes, runtimeEvidence })
        return false
      }
      acknowledgement = (async () => {
        try {
          const result = await service.acknowledgeEntry({ ticket: current.ticket, sessionHandle: current.sessionHandle })
          if (state.committed !== current) return false
          if (result.status !== 'acknowledged' || acknowledgementStopped) return pause(reason(result))
          current.sessionHandle.check()
          return true
        } catch (error) { return pause(['ACK_RESPONSE_LOST'], error) }
        finally { acknowledgingHandle = null }
      })()
      return acknowledgement
    },
    runtimeFailed(evidence) {
      const firstEvidence = state.runtimeEvidence ?? evidence
      if (acknowledgingHandle && state.committed?.sessionHandle === acknowledgingHandle) {
        acknowledgementStopped = true
        publish({ runtimeEvidence: firstEvidence }); return
      }
      publish({ phase: state.phase === 'uncertain' ? 'uncertain' : 'failed', committed: null,
        runtimeEvidence: { ...evidence, first: firstEvidence.first }, reasons: [firstEvidence.first.message] })
    },
    stopped(reasonCode) {
      // A service-side ACK failure may stop the handle synchronously before its
      // response arrives. Preserve the ACK recovery path instead of turning it into failed.
      if (acknowledgingHandle && state.committed?.sessionHandle === acknowledgingHandle) {
        acknowledgementStopped = true
        return
      }
      publish({ phase: 'failed', committed: null, reasons: [reasonCode || 'SESSION_STOPPED'] })
    },
  }
}
