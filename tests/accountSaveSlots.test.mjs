import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { memoryStorage, installGameStorage, getGameStorage } from '../src/save-session.mjs';
import { createAccountSaveSlots } from '../src/services/accountSaveSlots.mjs';
import { ACCOUNT_SAVE_PREFIX, accountSlotPrefix, accountSlotRecordKey, createAccountSaveStorage } from '../src/services/accountSaveStorage.mjs';
import { createSaveEntryService, AUTHORITY, PENDING, ACKNOWLEDGED, GUARD, PLAYER, BACKUP_PREFIX } from '../src/services/saveEntryService.mjs';
import { WRITER_LOCK } from '../src/services/saveEpoch.mjs';
import { canCreatePlayerSaveSlot, PLAYER_ACCOUNT_SLOT_LIMIT } from '../src/services/playerAccountPolicy.mjs';

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const SLOT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SLOT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const handles = [];
afterEach(async () => { for (const handle of handles.splice(0)) await handle.close(); installGameStorage(null); });
const hash = value => Promise.resolve(createHash('sha256').update(value).digest('hex'));
const snapshot = storage => Object.fromEntries(Array.from({ length: storage.length }, (_, i) => [storage.key(i), storage.getItem(storage.key(i))]));
function lockManager() {
  const held = new Set();
  return { async request(key, options, callback) {
    expect(key).toBe(WRITER_LOCK);
    expect(options).toEqual({ mode: 'exclusive', ifAvailable: true });
    if (held.has(key)) return callback(null);
    held.add(key);
    try { return await callback({ name: key }); } finally { held.delete(key); }
  } };
}
function rig({ raw = memoryStorage(), allow = () => true, limit = () => true, locks = lockManager() } = {}) {
  return { raw, locks, repository: createAccountSaveSlots({ storage: raw, locks, assertAccess: allow, canCreateSlot: limit, now: () => 123 }) };
}
async function open(r, ownerId = OWNER_A, slotId = SLOT_A) {
  expect((await r.repository.createSlot({ ownerId, slotId })).status).toBe('created');
  return r.repository.openStorage({ ownerId, slotId });
}
let serial = 0;
function entry(storage, locks) {
  return createSaveEntryService({ storage, locks, digest: hash, uuid: () => `test-op-${++serial}` });
}
async function enter(service, intent) {
  const inspection = await service.inspectSave();
  const prepared = await service.prepareEntry({ intent, snapshotToken: inspection.snapshotToken });
  expect(prepared.status).toBe('prepared');
  const committed = await service.commitEntry({ ticket: prepared.ticket });
  expect(committed.status).toBe('committed');
  handles.push(committed.sessionHandle);
  expect((await service.acknowledgeEntry({ ticket: committed.ticket, sessionHandle: committed.sessionHandle })).status).toBe('acknowledged');
  return committed;
}

test('enumerating an unused account is read-only and creates no slot or game', () => {
  const r = rig({ raw: memoryStorage({ [PLAYER]: '{retired test bytes' }) });
  const before = snapshot(r.raw);
  expect(r.repository.listSlots(OWNER_A)).toEqual([]);
  expect(snapshot(r.raw)).toEqual(before);
});

test('an explicit slot is empty until the normal entry service creates a game', async () => {
  const r = rig(), view = await open(r);
  expect(view.length).toBe(0);
  expect(view.getItem(AUTHORITY)).toBeNull();
  expect(r.repository.listSlots(OWNER_A)).toEqual([{ schemaVersion: 1, ownerId: OWNER_A, slotId: SLOT_A, createdAt: 123 }]);
  expect((await entry(view, r.locks).inspectSave()).classification).toBe('empty');
  expect(Object.keys(snapshot(r.raw))).toEqual([accountSlotRecordKey(OWNER_A, SLOT_A)]);
});

test('two owners and two slots isolate every control key, backup and enumeration', async () => {
  const r = rig(), a = await open(r), b = await open(r, OWNER_A, SLOT_B), other = await open(r, OWNER_B, SLOT_A);
  const keys = [AUTHORITY, GUARD, PENDING, ACKNOWLEDGED, BACKUP_PREFIX + 'receipt', 'newtone-progress-v4', 'newtone:center:scene-layout:场景'];
  for (const key of keys) { a.setItem(key, `a:${key}`); b.setItem(key, `b:${key}`); other.setItem(key, `other:${key}`); }
  for (const key of keys) { expect(a.getItem(key)).toBe(`a:${key}`); expect(b.getItem(key)).toBe(`b:${key}`); expect(other.getItem(key)).toBe(`other:${key}`); expect(r.raw.getItem(key)).toBeNull(); }
  for (const view of [a, b, other]) expect(Array.from({ length: view.length }, (_, i) => view.key(i))).toEqual([...keys].sort());
  expect(a.key(-1)).toBeNull(); expect(a.key(100)).toBeNull();
  a.removeItem(AUTHORITY);
  expect(a.getItem(AUTHORITY)).toBeNull(); expect(b.getItem(AUTHORITY)).toBe(`b:${AUTHORITY}`);
  expect(r.repository.listSlots(OWNER_A).map(slot => slot.slotId)).toEqual([SLOT_A, SLOT_B]);
  expect(r.repository.listSlots(OWNER_B).map(slot => slot.slotId)).toEqual([SLOT_A]);
});

test('storage encoding cannot escape a scope or collide with another logical key', async () => {
  const r = rig(), view = await open(r);
  const keys = ['a:b', 'a%3Ab', '../meta', '雪 ❄', `${ACCOUNT_SAVE_PREFIX}${OWNER_B}:${SLOT_B}:meta`];
  keys.forEach((key, i) => view.setItem(key, i));
  keys.forEach((key, i) => expect(view.getItem(key)).toBe(String(i)));
  expect(view.length).toBe(keys.length);
  expect(r.repository.listSlots(OWNER_B)).toEqual([]);
});

test.each(['', '../owner', 'A', OWNER_A.toUpperCase().replace('1111', 'AAAA'), OWNER_A + ':data', null, 42])('invalid owner %s never writes', async ownerId => {
  const r = rig();
  expect((await r.repository.createSlot({ ownerId, slotId: SLOT_A })).status).toBe('blocked');
  expect(r.raw.length).toBe(0);
});

test.each(['', '../slot', SLOT_A.toUpperCase(), SLOT_A + ':data', null, 42])('invalid slot %s never writes', async slotId => {
  const r = rig();
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId })).status).toBe('blocked');
  expect(r.raw.length).toBe(0);
});

test('access guard is required and asynchronous/truthy results cannot grant access', async () => {
  for (const allow of [undefined, () => 'yes', () => Promise.resolve(true), () => false]) {
    const r = rig({ allow });
    // Explicit undefined is defaulted by rig, so construct the missing-guard case separately.
    const repository = allow === undefined ? createAccountSaveSlots({ storage: r.raw, locks: r.locks, canCreateSlot: () => true }) : r.repository;
    expect((await repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe('blocked');
    expect(r.raw.length).toBe(0);
  }
});

test('the caller supplies capacity policy; the foundation has no fixed slot count', async () => {
  const raw = memoryStorage(), locks = lockManager();
  const unset = createAccountSaveSlots({ storage: raw, locks, assertAccess: () => true });
  expect(await unset.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).toMatchObject({ status: 'blocked', reasonCodes: ['SLOT_CREATION_POLICY_REQUIRED'] });
  let capacity = 1;
  const r = rig({ raw, locks, limit: ({ slots }) => slots.length < capacity });
  await open(r);
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_B })).status).toBe('blocked');
  capacity = 2;
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_B })).status).toBe('created');
});

test('the approved player policy permits three slots per account, not three across all accounts', async () => {
  expect(PLAYER_ACCOUNT_SLOT_LIMIT).toBe(3);
  const r = rig({ limit: canCreatePlayerSaveSlot });
  const ids = [SLOT_A, SLOT_B, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
  for (const slotId of ids.slice(0, 3)) expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId })).status).toBe('created');
  const before = snapshot(r.raw);
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: ids[3] })).status).toBe('blocked');
  expect(snapshot(r.raw)).toEqual(before);
  expect((await r.repository.createSlot({ ownerId: OWNER_B, slotId: SLOT_A })).status).toBe('created');
  expect(r.repository.listSlots(OWNER_A)).toHaveLength(3);
  expect(r.repository.listSlots(OWNER_B)).toHaveLength(1);
});

test('creating with the same ID is idempotent, including a later restrictive policy', async () => {
  let allow = true;
  const r = rig({ limit: () => allow }); await open(r);
  const before = snapshot(r.raw); allow = false;
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe('existing');
  expect(snapshot(r.raw)).toEqual(before);
});

test.each([false, true])('write failure landed=%s does not report success or delete evidence', async landed => {
  const r = rig(), set = r.raw.setItem.bind(r.raw); let fail = true;
  r.raw.setItem = (key, value) => { if (!fail || landed) set(key, value); if (fail) throw Error('quota or response lost'); };
  const result = await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A });
  expect(result).toMatchObject({ status: 'outcome-uncertain', slotId: SLOT_A });
  expect(r.raw.getItem(accountSlotRecordKey(OWNER_A, SLOT_A)) !== null).toBe(landed);
  fail = false;
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe(landed ? 'existing' : 'created');
  expect(r.repository.listSlots(OWNER_A)).toHaveLength(1);
});

test('read-back mismatch is uncertain and does not repair or overwrite data', async () => {
  const r = rig(), set = r.raw.setItem.bind(r.raw);
  r.raw.setItem = (key) => set(key, '{concurrent or damaged bytes');
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe('outcome-uncertain');
  const before = snapshot(r.raw);
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe('blocked');
  expect(snapshot(r.raw)).toEqual(before);
});

test('no lock support blocks creation instead of attempting an unsafe write', async () => {
  const r = rig({ locks: {} });
  expect(await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).toMatchObject({ status: 'blocked', reasonCodes: ['LOCKING_UNAVAILABLE'] });
  expect(r.raw.length).toBe(0);
});

test('identity is checked again after the asynchronous lock acquisition', async () => {
  let authorized = true;
  const r = rig({ allow: () => authorized, locks: { request: async (_name, _options, callback) => { authorized = false; return callback({}); } } });
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe('blocked');
  expect(r.raw.length).toBe(0);
});

test('logout and account switch deny all operations without deleting stored saves', async () => {
  let current = OWNER_A;
  const r = rig({ allow: ({ ownerId }) => current === ownerId }), view = await open(r);
  view.setItem(PLAYER, 'private account data');
  const before = snapshot(r.raw); current = OWNER_B;
  for (const read of [() => view.getItem(PLAYER), () => view.setItem(PLAYER, 'replace'), () => view.removeItem(PLAYER), () => view.key(0), () => view.length, () => r.repository.listSlots(OWNER_A)]) expect(read).toThrow('ACCOUNT_ACCESS_DENIED');
  expect(snapshot(r.raw)).toEqual(before);
  current = OWNER_A; expect(view.getItem(PLAYER)).toBe('private account data');
  view.revoke(); expect(() => view.getItem(PLAYER)).toThrow('ACCOUNT_STORAGE_REVOKED');
  expect(snapshot(r.raw)).toEqual(before);
});

test('a session-bound guard does not revive a stale view after same-owner reauthentication', async () => {
  const originalSession = { userId: OWNER_A, sessionId: 'authenticated-session-one' };
  let currentSession = originalSession;
  const r = rig({ allow: ({ ownerId }) => currentSession?.userId === ownerId && currentSession?.sessionId === originalSession.sessionId });
  const view = await open(r); view.setItem(PLAYER, 'preserved bytes');
  const before = snapshot(r.raw);
  currentSession = null;
  expect(() => view.getItem(PLAYER)).toThrow('ACCOUNT_ACCESS_DENIED');
  currentSession = { userId: OWNER_A, sessionId: 'authenticated-session-two' };
  expect(() => view.getItem(PLAYER)).toThrow('ACCOUNT_ACCESS_DENIED');
  expect(() => view.setItem(PLAYER, 'stale write')).toThrow('ACCOUNT_ACCESS_DENIED');
  expect(snapshot(r.raw)).toEqual(before);
});

test.each(['{bad', 'missing', 'future', 'other-owner'])('corrupt/replaced metadata %s revokes an old view and never resets it', async mode => {
  const r = rig(), view = await open(r), key = accountSlotRecordKey(OWNER_A, SLOT_A);
  view.setItem(PLAYER, 'preserve this');
  if (mode === 'missing') r.raw.removeItem(key);
  else if (mode === '{bad') r.raw.setItem(key, mode);
  else { const value = JSON.parse(r.raw.getItem(key)); if (mode === 'future') value.schemaVersion = 999; else value.ownerId = OWNER_B; r.raw.setItem(key, JSON.stringify(value)); }
  const before = snapshot(r.raw);
  expect(() => view.getItem(PLAYER)).toThrow('ACCOUNT_SLOT_RECORD_CHANGED');
  expect(() => r.repository.openStorage({ ownerId: OWNER_A, slotId: SLOT_A })).toThrow();
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe('blocked');
  expect(snapshot(r.raw)).toEqual(before);
});

test('data without a metadata record is protected, not adopted as a fresh slot', async () => {
  const r = rig(); r.raw.setItem(accountSlotPrefix(OWNER_A, SLOT_A) + 'data:' + encodeURIComponent(AUTHORITY), 'orphan');
  const before = snapshot(r.raw);
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe('blocked');
  expect(() => r.repository.listSlots(OWNER_A)).toThrow();
  expect(snapshot(r.raw)).toEqual(before);
});

test('unknown account namespace and noncanonical encoded keys fail closed', async () => {
  const r = rig(), view = await open(r);
  const bad = accountSlotPrefix(OWNER_A, SLOT_A) + 'future:data'; r.raw.setItem(bad, 'keep');
  expect(() => r.repository.listSlots(OWNER_A)).toThrow('UNSUPPORTED_ACCOUNT_SLOT_NAMESPACE');
  expect(() => r.repository.openStorage({ ownerId: OWNER_A, slotId: SLOT_A })).toThrow('UNSUPPORTED_ACCOUNT_SLOT_NAMESPACE');
  const before = snapshot(r.raw);
  expect(() => view.setItem(AUTHORITY, 'do not write')).toThrow('UNSUPPORTED_ACCOUNT_SLOT_NAMESPACE');
  expect(snapshot(r.raw)).toEqual(before);
  r.raw.removeItem(bad);
  r.raw.setItem(accountSlotPrefix(OWNER_A, SLOT_A) + 'data:%61', 'noncanonical');
  expect(() => view.key(0)).toThrow('INVALID_ACCOUNT_STORAGE_KEY');
  expect(() => r.repository.listSlots(OWNER_A)).toThrow('INVALID_ACCOUNT_STORAGE_KEY');
  expect(() => r.repository.openStorage({ ownerId: OWNER_A, slotId: SLOT_A })).toThrow('INVALID_ACCOUNT_STORAGE_KEY');
});

test('generic clear is prohibited and invalid logical keys do not write', async () => {
  const r = rig(), view = await open(r); view.setItem(PLAYER, 'keep');
  const before = snapshot(r.raw);
  expect(() => view.clear()).toThrow('ACCOUNT_SLOT_CLEAR_REQUIRES_EXPLICIT_RECOVERY');
  for (const key of ['', null, '\ud800']) expect(() => view.setItem(key, 'bad')).toThrow('INVALID_ACCOUNT_STORAGE_KEY');
  expect(snapshot(r.raw)).toEqual(before);
});

test('real save services preserve separate generations and balances across slots', async () => {
  const r = rig(), a = await open(r), b = await open(r, OWNER_A, SLOT_B);
  const serviceA = entry(a, r.locks), first = await enter(serviceA, 'create');
  const player = JSON.parse(first.sessionHandle.storage.getItem(PLAYER));
  first.sessionHandle.storage.setItem(PLAYER, JSON.stringify({ ...player, walletBalance: 650 }));
  await first.sessionHandle.close();
  const second = await enter(entry(b, r.locks), 'create');
  expect(second.snapshot.generation.id).not.toBe(first.snapshot.generation.id);
  expect(JSON.parse(second.snapshot.values[PLAYER]).walletBalance).toBe(800);
  await second.sessionHandle.close();
  const resumed = await enter(entry(a, r.locks), 'continue');
  expect(resumed.snapshot.generation.id).toBe(first.snapshot.generation.id);
  expect(JSON.parse(resumed.snapshot.values[PLAYER]).walletBalance).toBe(650);
});

test('slot creation cannot disrupt an active guest runtime or bypass its writer lease', async () => {
  const r = rig(), guest = await enter(entry(r.raw, r.locks), 'create');
  const active = getGameStorage(), before = snapshot(r.raw);
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe('busy');
  expect(snapshot(r.raw)).toEqual(before); expect(getGameStorage()).toBe(active); guest.sessionHandle.check();
  await guest.sessionHandle.close();
  expect((await r.repository.createSlot({ ownerId: OWNER_A, slotId: SLOT_A })).status).toBe('created');
});

test('account runtime revocation stops stale journal writes while retaining its saved data', async () => {
  const r = rig(), view = await open(r), current = await enter(entry(view, r.locks), 'create');
  const before = snapshot(r.raw); view.revoke();
  expect(() => current.sessionHandle.storage.setItem(PLAYER, '{}')).toThrow();
  expect(current.sessionHandle.isOpen).toBe(false); expect(snapshot(r.raw)).toEqual(before);
});

test('current guest authority and retired source bytes are untouched and never used as fallback', async () => {
  const raw = memoryStorage({ [PLAYER]: '{retired exact bytes', 'newtone-reader-publication-v1': 'retired reader bytes' });
  const r = rig({ raw }), guestService = entry(raw, r.locks), guest = await enter(guestService, 'restart');
  const p = JSON.parse(guest.sessionHandle.storage.getItem(PLAYER));
  guest.sessionHandle.storage.setItem(PLAYER, JSON.stringify({ ...p, walletBalance: 550 }));
  await guest.sessionHandle.close();
  const before = snapshot(raw), beforeInspection = await guestService.inspectSave();
  const view = await open(r);
  expect(view.getItem(PLAYER)).toBeNull(); expect(view.getItem(AUTHORITY)).toBeNull();
  const account = await enter(entry(view, r.locks), 'create');
  expect(JSON.parse(account.snapshot.values[PLAYER]).walletBalance).toBe(800);
  await account.sessionHandle.close();
  for (const [key, value] of Object.entries(before)) expect(raw.getItem(key)).toBe(value);
  expect(await guestService.inspectSave()).toEqual(beforeInspection);
  expect(JSON.parse(JSON.parse(raw.getItem(AUTHORITY)).values[PLAYER]).walletBalance).toBe(550);
  expect(raw.getItem(PLAYER)).toBe('{retired exact bytes');
});

test('direct adapter requires an existing validated slot, never creates one', () => {
  const raw = memoryStorage();
  expect(() => createAccountSaveStorage({ storage: raw, ownerId: OWNER_A, slotId: SLOT_A, assertAccess: () => true })).toThrow('ACCOUNT_SLOT_MISSING');
  expect(raw.length).toBe(0);
});
