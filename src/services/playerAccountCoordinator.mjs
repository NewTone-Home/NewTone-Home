import { createSaveEntryService } from './saveEntryService.mjs';
import { createAccountSaveSlots } from './accountSaveSlots.mjs';
import { createPlayerGuestRepository, createPlayerGuestStorage } from './playerGuestStorage.mjs';
import { createPlayerGuestAdoption } from './playerGuestAdoption.mjs';
import { adoptionIntentKey, readAdoptionRecord } from './playerAdoptionRecord.mjs';
import { canCreatePlayerSaveSlot } from './playerAccountPolicy.mjs';
import { createPlayerCloudPayloadFromAuthority, fingerprintPlayerCloudPayload } from './playerCloudService.mjs';
import { AUTHORITY, GUARD, WRITER_LOCK } from './saveEpoch.mjs';
import { memoryStorage } from '../save-session.mjs';

const assert = (ok, code) => { if (!ok) throw Error(code); };
const messages = {
  ACCOUNT_BACKEND_NOT_READY: '账号服务尚未完成配置，原有游客存档保持不变。',
  LOCAL_CLOUD_CONFLICT: '本机和云端存档不同，已暂停载入，未覆盖任何一份。',
  GUEST_ADOPTION_PENDING: '当前游客存档正在恢复注册事务，请先用原账号完成恢复。',
  GUEST_ADOPTION_OTHER_OWNER: '当前游客档已保留给原账号，请用原账号完成恢复。',
  SESSION_REPLACED: '账号已在另一处登录。当前游戏已暂停，存档保留在本机。',
  ACCOUNT_SESSION_NOT_ACTIVE: '账号连接已中断，游戏已暂停，请重新连接后重试。',
  ACCOUNT_OPERATION_CANCELLED: '账号状态已改变，已停止上一个操作。',
  ACCOUNT_BUSY: '正在处理存档，请稍后再试。',
  LOCAL_STORAGE_FULL: '本机存储空间不足，恢复已暂停。请先不要清除网站数据，原有存档需要保留。',
};
const failure = error => { const code = error instanceof Error ? error.message : String(error); return { ok: false, error: { code, message: messages[code] ?? '暂时无法完成账号存档操作。原有存档和恢复记录已保留，请重试。' } }; };
const encodePortable = authority => fingerprintPlayerCloudPayload(createPlayerCloudPayloadFromAuthority(authority));
function backendError(result, fallback, slotId) { const error = Error(result?.code ?? fallback); error.slotId = result?.slotId ?? slotId; return error; }

/** Owns runtime teardown and account/guest routing. Backend must enforce server authority. */
export function createPlayerAccountCoordinator({ authController, backend, storage, locks,
  uuid = () => crypto.randomUUID(), makeEntryService = options => createSaveEntryService(options),
  setInterval: schedule = globalThis.setInterval, clearInterval: unschedule = globalThis.clearInterval,
} = {}) {
  const guests = createPlayerGuestRepository({ storage, locks, uuid });
  let state = Object.freeze({ status: 'loading', slots: [], selectedSlotId: null, error: null, source: null, conflict: null, recovery: null });
  let disposed = false, revision = 0, queue = Promise.resolve(), closing = Promise.resolve(), unsubscribe = null, timer = null, checkpointTimer = null, sourceSerial = 0, lastIdentity = null, checkpointRunning = false;
  const listeners = new Set();
  const auth = () => authController.getSnapshot();
  const identity = () => auth().status === 'authenticated' ? `${auth().user.id}:${auth().sessionEpoch ?? 0}:${auth().sessionOrigin ?? 'restored'}` : auth().status;
  const publish = patch => { if (disposed) return; state = Object.freeze({ ...state, ...patch }); for (const listener of listeners) { try { listener(); } catch { /* UI subscriber owns its error. */ } } };
  const check = ticket => assert(!disposed && ticket === revision, 'ACCOUNT_OPERATION_CANCELLED');
  function access(ownerId, epoch) { return auth().status === 'authenticated' && auth().user.id === ownerId && auth().sessionEpoch === epoch && backend?.isActive === true; }
  async function closeSource(sync = false) {
    const old = state.source;
    publish({ source: null, selectedSlotId: null });
    if (old) { old.storage.revoke?.(); closing = Promise.all([closing, old.service.dispose()]).then(() => undefined); }
    await closing;
    if (sync && old?.ownerId && backend?.isActive && backend.syncSlot) {
      const result = await backend.syncSlot(old.slotId);
      if (result?.ok !== true) throw backendError(result, 'ACCOUNT_SYNC_FAILED', old.slotId);
    }
  }
  function stopTimer() { if (timer !== null) unschedule(timer); if (checkpointTimer !== null) unschedule(checkpointTimer); timer = null; checkpointTimer = null; }
  function beginTimer() {
    stopTimer();
    timer = schedule(() => {
      const ticket = revision;
      Promise.resolve(backend.renew()).then(result => {
        if (result?.ok !== true) throw Error(result?.code ?? 'ACCOUNT_SESSION_NOT_ACTIVE');
      }).catch(async error => {
        if (ticket !== revision || disposed) return;
        revision += 1; backend.stop(); stopTimer(); await closeSource(); publish({ status: 'error', error: failure(error).error });
      });
    }, 20_000);
    checkpointTimer = schedule(() => { checkpoint(); }, 30 * 60_000);
  }
  function enqueue(work) {
    const ticket = revision;
    const task = queue.then(async () => { check(ticket); return work(ticket); }).then(() => ({ ok: true })).catch(async error => {
      const result = failure(error);
      if (!disposed && ticket === revision) {
        if (['LOCAL_CLOUD_CONFLICT','CONFLICT_CHANGED','REVISION_CONFLICT'].includes(error.message) && error.slotId && backend?.inspectConflict) {
          try { await showConflict(ticket, error.slotId); return result; } catch (inspectionError) { if (ticket === revision) publish({ status: 'error', error: failure(inspectionError).error }); }
        } else publish({ status: 'error', error: result.error });
      }
      return result;
    });
    queue = task.then(() => undefined); return task;
  }
  async function guestSource(ticket, fresh = false) {
    await closeSource(true); check(ticket); stopTimer(); backend?.stop();
    let inspected = guests.inspect();
    if (inspected.status === 'claimed' && fresh) { await guests.startFresh(); check(ticket); inspected = guests.inspect(); }
    assert(inspected.status !== 'pending', 'GUEST_ADOPTION_PENDING');
    if (inspected.status !== 'available') { publish({ status: 'guest', slots: [], error: null, conflict: null, recovery: null }); return; }
    const view = guests.openCurrent(), service = makeEntryService({ storage: view, locks });
    publish({ status: 'guest', slots: [], error: null, conflict: null, recovery: null, source: { key: `guest:${inspected.guestId}:${++sourceSerial}`, guestId: inspected.guestId, storage: view, service } });
  }
  function repositoryFor(ownerId, epoch) {
    return createAccountSaveSlots({ storage, locks, assertAccess: scope => scope.ownerId === ownerId && access(ownerId, epoch), canCreateSlot: canCreatePlayerSaveSlot });
  }
  async function selectedSlot(ticket, slotId) {
    const { user, sessionEpoch } = auth(); assert(user, 'ACCOUNT_SESSION_NOT_ACTIVE');
    publish({ status: 'switching', error: null }); await closeSource(true); check(ticket);
    assert(access(user.id, sessionEpoch), 'ACCOUNT_SESSION_NOT_ACTIVE');
    const ready = await backend.ensureLocalSlot(slotId); check(ticket);
    if (ready?.ok !== true) throw backendError(ready, 'LOCAL_CLOUD_CONFLICT', slotId);
    const view = repositoryFor(user.id, sessionEpoch).openStorage({ ownerId: user.id, slotId });
    const service = makeEntryService({ storage: view, locks, onStoryCheckpoint: () => {
      if (state.source?.service !== service || !access(user.id, sessionEpoch)) return;
      return checkpoint();
    } });
    publish({ status: 'ready', selectedSlotId: slotId, source: { key: `account:${user.id}:${slotId}:${++sourceSerial}`, ownerId: user.id, slotId, storage: view, service }, error: null, conflict: null, recovery: null });
  }
  async function showConflict(ticket, slotId) {
    await closeSource(); check(ticket);
    const result = await backend.inspectConflict(slotId); check(ticket);
    if (result?.ok !== true) throw backendError(result, 'CONFLICT_INSPECTION_FAILED', slotId);
    const conflict = result.conflict ?? result;
    assert(conflict.slotId === slotId && typeof conflict.token === 'string' && conflict.token.length > 0, 'INVALID_CONFLICT_RESPONSE');
    publish({ status: 'conflict', conflict: { slotId, token: conflict.token, pendingChoice: conflict.pendingChoice ?? null, local: { summary: conflict.local?.summary }, cloud: { summary: conflict.cloud?.summary } }, recovery: null, error: null });
  }
  function readIntent(guestId) {
    const raw = storage.getItem(adoptionIntentKey(guestId)); if (raw === null) return null;
    let intent; try { intent = JSON.parse(raw); } catch { throw Error('INVALID_ADOPTION_INTENT'); }
    assert(intent?.schemaVersion === 1 && intent.guestId === guestId && typeof intent.ownerId === 'string' && typeof intent.slotId === 'string' && typeof intent.operationId === 'string' && /^[0-9a-f]{64}$/.test(intent.sourceHash) && /^[0-9a-f]{64}$/.test(intent.sourceFingerprint) && typeof intent.portableRaw === 'string', 'INVALID_ADOPTION_INTENT');
    return intent;
  }
  async function preserveGuest(ticket, catalogue) {
    const { user, sessionEpoch } = auth(), current = guests.inspect();
    const prior = readAdoptionRecord(storage, current.guestId)?.record;
    if (prior?.phase === 'committed') return null;
    let intent = readIntent(current.guestId);
    assert(!prior || intent, 'GUEST_ADOPTION_PENDING');
    if (intent) assert(intent.ownerId === user.id, 'GUEST_ADOPTION_OTHER_OWNER');
    else if (!catalogue.autoAdoptionEligible) return null;
    let receipt = null;
    const adoption = createPlayerGuestAdoption({ storage, locks, canCreateSlot: canCreatePlayerSaveSlot, encodePortable,
      assertAccess: ({ ownerId }) => ownerId === user.id && access(user.id, sessionEpoch),
      authorize: request => receipt?.ok === true && receipt.ownerId === request.ownerId && receipt.slotId === request.slotId && receipt.operationId === request.operationId && receipt.sourceFingerprint === request.sourceFingerprint,
    });
    if (!intent) {
      const source = await adoption.inspectGuest(current.guestId); check(ticket);
      if (source.status !== 'exported') {
        const view = createPlayerGuestStorage({ storage, guestId: current.guestId });
        const inspection = await makeEntryService({ storage: view, locks }).inspectSave(); check(ticket);
        if (['empty','legacy-reset-required'].includes(inspection.classification)) return null;
        throw Error(source.reasonCodes?.[0] ?? 'GUEST_ADOPTION_PENDING');
      }
      intent = { schemaVersion: 1, guestId: current.guestId, ownerId: user.id, slotId: uuid(), operationId: uuid(), sourceHash: source.sourceHash, sourceFingerprint: source.sourceFingerprint, portableRaw: source.portableRaw };
      assert(typeof locks?.request === 'function', 'LOCKING_UNAVAILABLE');
      await locks.request(WRITER_LOCK, { mode: 'exclusive', ifAvailable: true }, lock => {
        assert(lock, 'ANOTHER_SESSION_ACTIVE'); check(ticket); assert(access(user.id, sessionEpoch), 'ACCOUNT_SESSION_NOT_ACTIVE');
        const view = createPlayerGuestStorage({ storage, guestId: current.guestId });
        assert(view.getItem(AUTHORITY) === source.authorityRaw && view.getItem(GUARD) === source.guardRaw, 'ADOPTION_SOURCE_CHANGED');
        const key = adoptionIntentKey(current.guestId); assert(storage.getItem(key) === null, 'ADOPTION_INTENT_EXISTS');
        const raw = JSON.stringify(intent); storage.setItem(key, raw); assert(storage.getItem(key) === raw, 'ADOPTION_INTENT_UNCERTAIN');
      });
    }
    publish({ status: 'adopting', error: null });
    // Same immutable request on every retry, including lost remote responses.
    receipt = await backend.adoptGuest({ slotId: intent.slotId, operationId: intent.operationId, portableRaw: intent.portableRaw, sourceFingerprint: intent.sourceFingerprint }); check(ticket);
    assert(receipt?.ok === true, receipt?.code ?? 'GUEST_ADOPTION_PENDING');
    const result = await adoption.adopt(intent); check(ticket);
    assert(result.status === 'adopted', result.reasonCodes?.[0] ?? 'GUEST_ADOPTION_PENDING');
    if (backend.markAdoptedSlot) { const marked = await backend.markAdoptedSlot(receipt, intent.sourceFingerprint); check(ticket); assert(marked?.ok === true, marked?.code ?? 'ADOPTION_BASELINE_NOT_SAVED'); }
    return intent.slotId;
  }
  async function reconcile(ticket) {
    await closeSource(); check(ticket); stopTimer();
    if (auth().status !== 'authenticated') { backend?.stop(); return guestSource(ticket); }
    assert(backend, 'ACCOUNT_BACKEND_NOT_READY'); publish({ status: 'loading', slots: [], error: null, conflict: null, recovery: null });
    const opened = await backend.openSession({ origin: auth().sessionOrigin ?? 'restored' }); check(ticket);
    assert(opened?.ok === true, opened?.code ?? 'ACCOUNT_SESSION_NOT_ACTIVE'); beginTimer();
    if (backend.recoverPendingResolution) { const recovered = await backend.recoverPendingResolution(); check(ticket); if (recovered?.ok !== true) throw backendError(recovered, 'PENDING_CLOUD_OPERATION', recovered?.slotId); }
    if (backend.recoverPendingCreate) { const recovered = await backend.recoverPendingCreate(); check(ticket); assert(recovered?.ok === true, recovered?.code ?? 'PENDING_CLOUD_OPERATION'); }
    let catalogue = await backend.listSlots(); check(ticket); assert(catalogue?.ok === true, catalogue?.code ?? 'ACCOUNT_BACKEND_NOT_READY');
    const adopted = await preserveGuest(ticket, catalogue); check(ticket);
    if (adopted) { catalogue = await backend.listSlots(); check(ticket); assert(catalogue?.ok === true, catalogue?.code ?? 'ACCOUNT_BACKEND_NOT_READY'); }
    publish({ status: 'ready', slots: catalogue.slots, error: null });
    if (adopted) await selectedSlot(ticket, adopted);
  }
  function observeAuth() {
    const next = identity(); if (next === lastIdentity || auth().status === 'unknown') return;
    lastIdentity = next; revision += 1; stopTimer(); backend?.stop();
    // Revoke synchronously before the asynchronous serialized transition.
    const old = state.source;
    if (old) { old.storage.revoke?.(); closing = Promise.all([closing, old.service.dispose()]).then(() => undefined); }
    publish({ source: null, selectedSlotId: null, status: 'loading', slots: [], conflict: null, recovery: null, error: null });
    enqueue(reconcile);
  }
  async function bootstrap() {
    if (disposed) return failure(Error('ACCOUNT_OPERATION_CANCELLED'));
    if (!unsubscribe) unsubscribe = authController.subscribe(observeAuth);
    if (auth().status === 'unknown') { const loaded = await authController.bootstrap(); if (loaded?.ok === false && auth().status === 'unknown') return guestSource(revision).then(() => loaded); }
    if (identity() !== lastIdentity) { observeAuth(); return queue.then(() => ({ ok: state.status !== 'error', error: state.error })); }
    if (state.status === 'conflict' && state.conflict?.slotId) return enqueue(ticket => showConflict(ticket, state.conflict.slotId));
    if (state.status !== 'error') return queue.then(() => ({ ok: state.status !== 'error', error: state.error }));
    return enqueue(reconcile);
  }
  async function checkpointWork(ticket) {
    const source = state.source;
    if (checkpointRunning || !source?.ownerId || !backend?.isActive || !backend.syncSnapshot) return { ok: true, skipped: true };
    checkpointRunning = true;
    try {
      const exported = await source.service.exportActiveSave(); check(ticket);
      if (exported.status !== 'exported') return { ok: true, skipped: true };
      const payload = await encodePortable(exported.snapshot); check(ticket);
      assert(state.source === source, 'ACCOUNT_OPERATION_CANCELLED');
      const result = await backend.syncSnapshot(source.slotId, payload); check(ticket);
      if (result?.ok !== true) throw backendError(result, 'ACCOUNT_SYNC_FAILED', source.slotId); return { ok: true };
    } catch (error) {
      const result = failure(error);
      if (ticket === revision && !disposed) { await closeSource(); publish({ status: 'error', error: result.error }); }
      throw error;
    } finally { checkpointRunning = false; }
  }
  function checkpoint() { return enqueue(checkpointWork); }
  return Object.freeze({
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    bootstrap,
    checkpoint,
    resolveConflict(request) { return enqueue(async ticket => {
      assert(state.status === 'conflict' && state.conflict?.token === request.token && state.conflict.slotId === request.slotId && ['local','cloud'].includes(request.choice), 'STALE_CONFLICT_CHOICE');
      publish({ status: 'recovering', error: null }); await closeSource(); check(ticket);
      const result = await backend.resolveConflict(request); check(ticket); if (result?.ok !== true) throw backendError(result, 'RESOLUTION_FAILED', request.slotId);
      const catalogue = await backend.listSlots(); check(ticket); assert(catalogue?.ok === true, 'ACCOUNT_BACKEND_NOT_READY');
      publish({ status: 'ready', slots: catalogue.slots, conflict: null, recovery: null }); await selectedSlot(ticket, request.slotId);
    }); },
    listBackups(slotId) { return enqueue(async ticket => {
      assert(state.slots.some(slot => slot.slotId === slotId) || state.conflict?.slotId === slotId, 'UNKNOWN_ACCOUNT_SLOT');
      await closeSource(); check(ticket); publish({ recovery: { status: 'loading', slotId, token: null, backups: [], error: null } });
      const result = await backend.listBackups(slotId); check(ticket);
      if (result?.ok !== true) { publish({ recovery: { status: 'error', slotId, token: null, backups: [], error: failure(backendError(result, 'BACKUP_LIST_FAILED', slotId)).error } }); throw backendError(result, 'BACKUP_LIST_FAILED', slotId); }
      assert(result.slotId === slotId && typeof result.token === 'string' && Array.isArray(result.backups), 'INVALID_BACKUP_LIST');
      publish({ status: state.conflict ? 'conflict' : 'ready', recovery: { ...result, status: 'ready', error: null }, error: null });
    }); },
    restoreBackup(request) { return enqueue(async ticket => {
      const recovery = state.recovery;
      assert(recovery?.status === 'ready' && recovery.slotId === request.slotId && recovery.token === request.token && recovery.backups.some(backup => backup.backupId === request.backupId), 'STALE_BACKUP_CHOICE');
      publish({ status: 'recovering', error: null }); await closeSource(); check(ticket);
      const result = await backend.restoreBackup(request); check(ticket); if (result?.ok !== true) throw backendError(result, 'BACKUP_RESTORE_FAILED', request.slotId);
      const catalogue = await backend.listSlots(); check(ticket); assert(catalogue?.ok === true, 'ACCOUNT_BACKEND_NOT_READY');
      publish({ status: 'ready', slots: catalogue.slots, conflict: null, recovery: null }); await selectedSlot(ticket, request.slotId);
    }); },
    async suspend(reason = 'ACCOUNT_SESSION_NOT_ACTIVE') { revision += 1; stopTimer(); backend?.stop(); await closeSource(); publish({ status: 'error', error: failure(Error(reason)).error }); },
    selectSlot(slotId) { return enqueue(async ticket => { assert(state.slots.some(slot => slot.slotId === slotId), 'UNKNOWN_ACCOUNT_SLOT'); await selectedSlot(ticket, slotId); }); },
    createSlot() { return enqueue(async ticket => {
      assert(auth().status === 'authenticated' && backend?.isActive, 'ACCOUNT_SESSION_NOT_ACTIVE');
      publish({ status: 'switching', error: null }); await closeSource(true); check(ticket);
      if (backend.recoverPendingCreate) {
        const recovered = await backend.recoverPendingCreate(); check(ticket); assert(recovered?.ok === true, recovered?.code ?? 'PENDING_CLOUD_OPERATION');
        if (recovered.recovered) { const catalogue = await backend.listSlots(); check(ticket); assert(catalogue?.ok === true, catalogue?.code ?? 'ACCOUNT_BACKEND_NOT_READY'); publish({ slots: catalogue.slots }); return selectedSlot(ticket, recovered.slotId); }
      }
      const raw = memoryStorage(), service = makeEntryService({ storage: raw, locks });
      let payload;
      try {
        const inspected = await service.inspectSave(), prepared = await service.prepareEntry({ intent: 'create', snapshotToken: inspected.snapshotToken }); check(ticket);
        assert(prepared.status === 'prepared', prepared.reasonCodes?.[0] ?? 'NEW_SAVE_FAILED');
        const committed = await service.commitEntry({ ticket: prepared.ticket }); check(ticket);
        assert(committed.status === 'committed', committed.reasonCodes?.[0] ?? 'NEW_SAVE_FAILED');
        payload = await encodePortable(committed.snapshot); check(ticket);
      } finally { await service.dispose(); }
      const result = await backend.createSlot({ slotId: uuid(), operationId: uuid(), ...payload }); check(ticket);
      assert(result?.ok === true, result?.code ?? 'NEW_SAVE_FAILED');
      const catalogue = await backend.listSlots(); check(ticket); assert(catalogue?.ok === true, catalogue?.code ?? 'ACCOUNT_BACKEND_NOT_READY');
      publish({ slots: catalogue.slots }); await selectedSlot(ticket, result.slotId);
    }); },
    continueGuest() { revision += 1; return enqueue(ticket => guestSource(ticket, true)); },
    logout() { revision += 1; return enqueue(async ticket => { stopTimer(); await closeSource(true); check(ticket); backend?.stop(); publish({ status: 'guest', slots: [], error: null, conflict: null, recovery: null }); }); },
    async dispose() { if (disposed) return; revision += 1; stopTimer(); unsubscribe?.(); unsubscribe = null; backend?.stop(); await closeSource(); disposed = true; listeners.clear(); },
  });
}
