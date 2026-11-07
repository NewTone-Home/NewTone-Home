import { test, expect, afterEach, vi } from 'vitest';
import { memoryStorage, installGameStorage } from '../src/save-session.mjs';
import { createSaveEntryService } from '../src/services/saveEntryService.mjs';
import { createPlayerAccountCoordinator } from '../src/services/playerAccountCoordinator.mjs';
import { createAccountCloudImportService } from '../src/services/accountCloudImportService.mjs';
import { AUTHORITY, WRITER_LOCK } from '../src/services/saveEpoch.mjs';
import { adoptionIntentKey, readAdoptionRecord } from '../src/services/playerAdoptionRecord.mjs';
import { createAccountSaveSlots } from '../src/services/accountSaveSlots.mjs';
import { canCreatePlayerSaveSlot } from '../src/services/playerAccountPolicy.mjs';
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const coordinators = [], handles = [];
afterEach(async () => { for (const c of coordinators.splice(0)) await c.dispose(); for (const h of handles.splice(0)) await h.close(); installGameStorage(null); });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
let counter = 0;
const uuid = () => `aaaaaaaa-aaaa-4aaa-8aaa-${(++counter).toString(16).padStart(12, '0')}`;
function lockManager() { let held = false; return { async request(key, _options, callback) { if (key !== WRITER_LOCK) return callback({}); if (held) return callback(null); held = true; try { return await callback({}); } finally { held = false; } } }; }
function fakeAuth() {
  let value = Object.freeze({ status: 'signed_out', user: null, sessionEpoch: 0, sessionOrigin: 'signed_out' }); const listeners = new Set();
  return { getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, bootstrap: async () => ({ ok: true }),
    set(patch) { value = Object.freeze({ ...value, ...patch }); for (const fn of listeners) fn(); },
    login(ownerId = OWNER) { this.set({ status: 'authenticated', user: { id: ownerId }, sessionEpoch: value.sessionEpoch + 1, sessionOrigin: 'login' }); },
    logout() { this.set({ status: 'signed_out', user: null, sessionEpoch: value.sessionEpoch + 1, sessionOrigin: 'signed_out' }); },
  };
}
async function enter(service) {
  const inspected = await service.inspectSave(), intent = inspected.classification === 'empty' ? 'create' : 'continue';
  const prepared = await service.prepareEntry({ intent, snapshotToken: inspected.snapshotToken }); expect(prepared.status).toBe('prepared');
  const current = await service.commitEntry({ ticket: prepared.ticket }); expect(current.status).toBe('committed'); handles.push(current.sessionHandle);
  await service.acknowledgeEntry({ ticket: current.ticket, sessionHandle: current.sessionHandle }); return current;
}
function rig({ withBackend = true } = {}) {
  const storage = memoryStorage(), locks = lockManager(), authController = fakeAuth(), slots = [], receipts = new Map();
  let active = false;
  const importer = createAccountCloudImportService({ storage, locks, assertAccess: ({ ownerId }) => active && authController.getSnapshot().user?.id === ownerId, verifyCloudSnapshot: async () => true });
  const backend = {
    get isActive() { return active; }, stop: vi.fn(() => { active = false; }), openSession: vi.fn(async () => { active = true; return { ok: true }; }),
    renew: vi.fn(async () => ({ ok: true })), listSlots: vi.fn(async () => ({ ok: true, slots: [...slots], autoAdoptionEligible: slots.length === 0 })),
    syncSlot: vi.fn(async () => ({ ok: true })), syncSnapshot: vi.fn(async () => ({ ok: true })),
    adoptGuest: vi.fn(async request => {
      if (receipts.has(request.operationId)) return receipts.get(request.operationId);
      const receipt = { ok: true, ...request, ownerId: authController.getSnapshot().user.id, revision: '1' }; receipts.set(request.operationId, receipt); slots.push({ slotId: request.slotId, slotNo: slots.length + 1, revision: '1' }); return receipt;
    }), markAdoptedSlot: vi.fn(async () => ({ ok: true })), ensureLocalSlot: vi.fn(async () => ({ ok: true })),
    createSlot: vi.fn(async request => {
      if (slots.length === 3) return { ok: false, code: 'SLOT_LIMIT' };
      const ownerId = authController.getSnapshot().user.id;
      await importer.install({ ownerId, ...request, cloudRevision: '1' }); slots.push({ slotId: request.slotId, slotNo: slots.length + 1, revision: '1' }); return { ok: true, ownerId, ...request, revision: '1' };
    }),
  };
  const timers = new Map();
  const coordinator = createPlayerAccountCoordinator({ authController, backend: withBackend ? backend : null, storage, locks, uuid, setInterval: (fn, delay) => { timers.set(delay, fn); return delay; }, clearInterval: id => { timers.delete(id); } });
  coordinators.push(coordinator);
  return { storage, locks, authController, backend, coordinator, slots, tick: () => timers.get(20_000)?.() };
}

test('signed-out startup keeps existing guest play and does not call cloud', async () => {
  const r = rig(); expect((await r.coordinator.bootstrap()).ok).toBe(true);
  expect(r.coordinator.getSnapshot().status).toBe('guest'); expect(r.coordinator.getSnapshot().source.guestId).toBe('legacy'); expect(r.backend.openSession).not.toHaveBeenCalled();
});

test('verified login automatically preserves the active acknowledged guest without a bind step', async () => {
  const r = rig(); await r.coordinator.bootstrap(); const oldSource = r.coordinator.getSnapshot().source, current = await enter(oldSource.service);
  const player = JSON.parse(current.sessionHandle.storage.getItem('newtone-player-save-v1')); player.walletBalance = 650; current.sessionHandle.storage.setItem('newtone-player-save-v1', JSON.stringify(player));
  const original = r.storage.getItem(AUTHORITY); r.authController.login(); await r.coordinator.bootstrap();
  const state = r.coordinator.getSnapshot(); expect(state.status).toBe('ready'); expect(state.source.ownerId).toBe(OWNER); expect(state.slots).toHaveLength(1);
  expect(current.sessionHandle.isOpen).toBe(false); expect(() => oldSource.storage.getItem(AUTHORITY)).toThrow();
  expect(state.source.storage.getItem(AUTHORITY)).toBe(original); expect(r.storage.getItem(AUTHORITY)).toBe(original);
  expect(readAdoptionRecord(r.storage, 'legacy').record.phase).toBe('committed');
});

test('returning cloud account never receives an automatic guest overwrite', async () => {
  const r = rig(); await r.coordinator.bootstrap(); await enter(r.coordinator.getSnapshot().source.service); const original = r.storage.getItem(AUTHORITY);
  r.slots.push({ slotId: uuid(), slotNo: 1, revision: '4' }); r.authController.login(); await r.coordinator.bootstrap();
  expect(r.backend.adoptGuest).not.toHaveBeenCalled(); expect(r.coordinator.getSnapshot().source).toBeNull(); expect(r.storage.getItem(AUTHORITY)).toBe(original);
});

test('empty guest allows creating exactly three independent account saves through explicit actions', async () => {
  const r = rig(); await r.coordinator.bootstrap(); r.authController.login(); await r.coordinator.bootstrap();
  for (let n = 1; n <= 3; n += 1) { expect((await r.coordinator.createSlot()).ok).toBe(true); expect(r.coordinator.getSnapshot().slots).toHaveLength(n); }
  expect((await r.coordinator.createSlot()).ok).toBe(false); expect(r.slots).toHaveLength(3);
});

test('an uncertain cloud adoption retries the original intent, never generating a second slot', async () => {
  const r = rig(); await r.coordinator.bootstrap(); await enter(r.coordinator.getSnapshot().source.service);
  const real = r.backend.adoptGuest; let lose = true;
  r.backend.adoptGuest = vi.fn(async request => { const value = await real(request); if (lose) { lose = false; return { ok: false, code: 'OUTCOME_UNCERTAIN' }; } return value; });
  r.authController.login(); await r.coordinator.bootstrap();
  const intent = r.storage.getItem(adoptionIntentKey('legacy')); expect(intent).not.toBeNull();
  expect((await r.coordinator.bootstrap()).ok).toBe(true); expect(r.slots).toHaveLength(1);
  expect(new Set(r.backend.adoptGuest.mock.calls.map(([request]) => request.operationId)).size).toBe(1);
});

test('logout retains owned data and explicit guest action starts a different empty namespace', async () => {
  const r = rig(); await r.coordinator.bootstrap(); await enter(r.coordinator.getSnapshot().source.service); r.authController.login(); await r.coordinator.bootstrap();
  const original = r.storage.getItem(AUTHORITY); await r.coordinator.logout(); r.authController.logout(); await r.coordinator.bootstrap();
  expect(r.coordinator.getSnapshot().source).toBeNull(); expect((await r.coordinator.continueGuest()).ok).toBe(true);
  const guest = r.coordinator.getSnapshot().source; expect(guest.guestId).not.toBe('legacy'); expect(guest.storage.getItem(AUTHORITY)).toBeNull(); expect(r.storage.getItem(AUTHORITY)).toBe(original);
});

test('renewal failure immediately revokes account storage and pauses its runtime', async () => {
  const r = rig(); await r.coordinator.bootstrap(); r.authController.login(); await r.coordinator.bootstrap(); await r.coordinator.createSlot(); const source = r.coordinator.getSnapshot().source;
  const current = await enter(source.service); r.backend.renew.mockResolvedValue({ ok: false, code: 'SESSION_REPLACED' }); r.tick(); await flush();
  expect(r.coordinator.getSnapshot().source).toBeNull(); expect(r.coordinator.getSnapshot().status).toBe('error'); expect(current.sessionHandle.isOpen).toBe(false); expect(() => source.storage.getItem(AUTHORITY)).toThrow();
});

test('missing account backend never fabricates readiness and guest remains recoverable', async () => {
  const r = rig({ withBackend: false }); await r.coordinator.bootstrap(); await enter(r.coordinator.getSnapshot().source.service); const original = r.storage.getItem(AUTHORITY);
  r.authController.login(); expect((await r.coordinator.bootstrap()).ok).toBe(false); expect(r.coordinator.getSnapshot().error.code).toBe('ACCOUNT_BACKEND_NOT_READY');
  expect((await r.coordinator.continueGuest()).ok).toBe(true); expect(r.coordinator.getSnapshot().source.storage.getItem(AUTHORITY)).toBe(original);
});

test('another account cannot recover a pending adoption intent', async () => {
  const r = rig(); await r.coordinator.bootstrap(); await enter(r.coordinator.getSnapshot().source.service); r.backend.adoptGuest.mockResolvedValue({ ok: false, code: 'OUTCOME_UNCERTAIN' });
  r.authController.login(); await r.coordinator.bootstrap(); const original = r.storage.getItem(AUTHORITY); r.authController.login(OTHER); await r.coordinator.bootstrap();
  expect(r.coordinator.getSnapshot().error.code).toBe('GUEST_ADOPTION_OTHER_OWNER'); expect(r.storage.getItem(AUTHORITY)).toBe(original);
  const repo = createAccountSaveSlots({ storage: r.storage, locks: r.locks, assertAccess: () => true, canCreateSlot: canCreatePlayerSaveSlot }); expect(repo.listSlots(OTHER)).toEqual([]);
});

test('restored session asks backend to resume rather than take over another device', async () => {
  const r = rig(); r.authController.set({ status: 'authenticated', user: { id: OWNER }, sessionEpoch: 1, sessionOrigin: 'restored' });
  await r.coordinator.bootstrap(); expect(r.backend.openSession).toHaveBeenCalledWith({ origin: 'restored' });
});

test('checkpoint uploads an immutable live snapshot without closing the active runtime', async () => {
  const r = rig(); await r.coordinator.bootstrap(); r.authController.login(); await r.coordinator.bootstrap(); await r.coordinator.createSlot();
  const source = r.coordinator.getSnapshot().source, current = await enter(source.service);
  expect((await r.coordinator.checkpoint()).ok).toBe(true); expect(r.backend.syncSnapshot).toHaveBeenCalledTimes(1);
  expect(r.backend.syncSnapshot.mock.calls[0][0]).toBe(source.slotId); expect(JSON.parse(r.backend.syncSnapshot.mock.calls[0][1].payloadRaw).format).toBe('newtone-player-state');
  expect(current.sessionHandle.isOpen).toBe(true); expect(r.coordinator.getSnapshot().source).toBe(source);
});

test('manual logout stops the local runtime before uploading its final snapshot', async () => {
  const r = rig(); await r.coordinator.bootstrap(); r.authController.login(); await r.coordinator.bootstrap(); await r.coordinator.createSlot();
  const source = r.coordinator.getSnapshot().source, current = await enter(source.service);
  r.backend.syncSlot.mockImplementation(async slotId => { expect(slotId).toBe(source.slotId); expect(current.sessionHandle.isOpen).toBe(false); return { ok: true }; });
  expect((await r.coordinator.logout()).ok).toBe(true); expect(r.backend.syncSlot).toHaveBeenCalledWith(source.slotId); expect(r.coordinator.getSnapshot().source).toBeNull();
});

test('a real committed story boundary queues one account checkpoint, not dialogue cursor changes', async () => {
  const r=rig();await r.coordinator.bootstrap();r.authController.login();await r.coordinator.bootstrap();await r.coordinator.createSlot();
  const source=r.coordinator.getSnapshot().source,current=await enter(source.service),view=current.sessionHandle.storage;
  let player=JSON.parse(view.getItem('newtone-player-save-v1'));
  player.sceneState['commercial-street'].commercialCafeNarrativePhase='dialogue';view.setItem('newtone-player-save-v1',JSON.stringify(player));
  await vi.waitFor(()=>expect(r.backend.syncSnapshot).toHaveBeenCalledTimes(1));
  player=JSON.parse(view.getItem('newtone-player-save-v1'));player.walletBalance-=1;view.setItem('newtone-player-save-v1',JSON.stringify(player));await flush();expect(r.backend.syncSnapshot).toHaveBeenCalledTimes(1);
  player.sceneState['commercial-street'].commercialCafeStoryStatus='ready-to-leave';player.sceneState['commercial-street'].commercialCafeNarrativePhase='complete';view.setItem('newtone-player-save-v1',JSON.stringify(player));await vi.waitFor(()=>expect(r.backend.syncSnapshot).toHaveBeenCalledTimes(2));
});

async function conflictRig(){
 const r=rig();await r.coordinator.bootstrap();r.authController.login();await r.coordinator.bootstrap();await r.coordinator.createSlot();const slotId=r.coordinator.getSnapshot().selectedSlotId;
 r.backend.inspectConflict=vi.fn(async()=>({ok:true,conflict:{slotId,token:'comparison-1',local:{summary:'Local'},cloud:{summary:'Cloud'}}}));
 r.backend.resolveConflict=vi.fn(async()=>({ok:true,slotId}));r.backend.ensureLocalSlot.mockResolvedValue({ok:false,code:'LOCAL_CLOUD_CONFLICT',slotId});
 await r.coordinator.selectSlot(slotId);expect(r.coordinator.getSnapshot().status).toBe('conflict');return {...r,slotId};
}
test('detected divergence pauses gameplay and requires the displayed exact conflict token',async()=>{
 const r=await conflictRig();expect(r.coordinator.getSnapshot().source).toBeNull();expect(r.backend.resolveConflict).not.toHaveBeenCalled();
 expect((await r.coordinator.resolveConflict({slotId:r.slotId,token:'stale',choice:'cloud'})).ok).toBe(false);expect(r.backend.resolveConflict).not.toHaveBeenCalled();
});
test('explicit conflict resolution reloads only the selected slot after backend success',async()=>{
 const r=await conflictRig();r.backend.ensureLocalSlot.mockResolvedValue({ok:true});
 expect((await r.coordinator.resolveConflict({slotId:r.slotId,token:'comparison-1',choice:'local'})).ok).toBe(true);
 expect(r.backend.resolveConflict).toHaveBeenCalledWith({slotId:r.slotId,token:'comparison-1',choice:'local'});expect(r.coordinator.getSnapshot().source.slotId).toBe(r.slotId);expect(r.coordinator.getSnapshot().conflict).toBeNull();
});
test('backup restore requires the reviewed list token and one of its backup IDs',async()=>{
 const r=await conflictRig();r.backend.listBackups=vi.fn(async()=>({ok:true,slotId:r.slotId,token:'backup-list-1',backups:[{backupId:'backup-1',summary:'Original'}]}));r.backend.restoreBackup=vi.fn(async()=>({ok:true}));
 expect((await r.coordinator.listBackups(r.slotId)).ok).toBe(true);
 expect((await r.coordinator.restoreBackup({slotId:r.slotId,token:'backup-list-1',backupId:'unknown'})).ok).toBe(false);expect(r.backend.restoreBackup).not.toHaveBeenCalled();
 r.backend.ensureLocalSlot.mockResolvedValue({ok:true});expect((await r.coordinator.restoreBackup({slotId:r.slotId,token:'backup-list-1',backupId:'backup-1'})).ok).toBe(true);expect(r.coordinator.getSnapshot().recovery).toBeNull();
});
test('changing accounts immediately removes prior conflict and backup summaries',async()=>{
 const r=await conflictRig();r.backend.listBackups=vi.fn(async()=>({ok:true,slotId:r.slotId,token:'backup-list-1',backups:[{backupId:'backup-1',summary:'Private'}]}));await r.coordinator.listBackups(r.slotId);
 r.authController.login(OTHER);expect(r.coordinator.getSnapshot().conflict).toBeNull();expect(r.coordinator.getSnapshot().recovery).toBeNull();expect(r.coordinator.getSnapshot().slots).toEqual([]);await r.coordinator.bootstrap();
});
