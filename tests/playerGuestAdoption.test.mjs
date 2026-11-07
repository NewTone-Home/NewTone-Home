import { test, expect, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { memoryStorage, installGameStorage, getGameStorage } from '../src/save-session.mjs';
import { createSaveEntryService } from '../src/services/saveEntryService.mjs';
import { AUTHORITY, GUARD, WRITER_LOCK } from '../src/services/saveEpoch.mjs';
import { createPlayerGuestAdoption } from '../src/services/playerGuestAdoption.mjs';
import { createPlayerGuestRepository, createPlayerGuestStorage } from '../src/services/playerGuestStorage.mjs';
import { adoptionRecordKey, readAdoptionRecord } from '../src/services/playerAdoptionRecord.mjs';
import { createAccountSaveSlots } from '../src/services/accountSaveSlots.mjs';
import { accountSlotRecordKey } from '../src/services/accountSaveStorage.mjs';
import { canCreatePlayerSaveSlot } from '../src/services/playerAccountPolicy.mjs';
import { createPlayerCloudPayloadFromAuthority, fingerprintPlayerCloudPayload } from '../src/services/playerCloudService.mjs';

const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222';
const SLOT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NEW_GUEST = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const hash = value => Promise.resolve(createHash('sha256').update(value).digest('hex'));
const encodePortable = authority => fingerprintPlayerCloudPayload(createPlayerCloudPayloadFromAuthority(authority));
const handles = [];
afterEach(async () => { for (const handle of handles.splice(0)) await handle.close(); installGameStorage(null); vi.unstubAllGlobals(); });
function lockManager() { let held = false; return { async request(key, _options, callback) { expect(key).toBe(WRITER_LOCK); if (held) return callback(null); held = true; try { return await callback({}); } finally { held = false; } } }; }
const dump = raw => Object.fromEntries(Array.from({ length: raw.length }, (_, i) => [raw.key(i), raw.getItem(raw.key(i))]));
let sequence = 0;
function entry(storage, locks) { return createSaveEntryService({ storage, locks, digest: hash, uuid: () => `test-op-${++sequence}` }); }
async function enter(service, intent = 'create') {
  const inspection = await service.inspectSave(), prepared = await service.prepareEntry({ intent, snapshotToken: inspection.snapshotToken });
  expect(prepared.status).toBe('prepared'); const committed = await service.commitEntry({ ticket: prepared.ticket });
  expect(committed.status).toBe('committed'); handles.push(committed.sessionHandle);
  await service.acknowledgeEntry({ ticket: committed.ticket, sessionHandle: committed.sessionHandle }); return committed;
}
async function rig() {
  const raw = memoryStorage(), locks = lockManager(), guest = createPlayerGuestStorage({ storage: raw });
  const current = await enter(entry(guest, locks));
  const player = JSON.parse(current.sessionHandle.storage.getItem('newtone-player-save-v1')); player.walletBalance = 650;
  current.sessionHandle.storage.setItem('newtone-player-save-v1', JSON.stringify(player)); await current.sessionHandle.close();
  let allowed = true, grant = true, failures = null, calls = 0;
  const originalSet = raw.setItem;
  raw.setItem = (key, value) => { calls += 1; if (failures?.at === calls && failures.before) throw Error('injected-write'); originalSet(key, value); if (failures?.at === calls && !failures.before) throw Error('injected-write'); };
  const options = { storage: raw, locks, assertAccess: ({ ownerId }) => allowed && ownerId === OWNER, authorize: () => grant, canCreateSlot: canCreatePlayerSaveSlot, encodePortable, digest: hash, now: () => 123 };
  const adoption = createPlayerGuestAdoption(options), inspected = await adoption.inspectGuest('legacy'); expect(inspected.status).toBe('exported');
  const request = { guestId: 'legacy', ownerId: OWNER, slotId: SLOT, operationId: OP, sourceHash: inspected.sourceHash, sourceFingerprint: inspected.sourceFingerprint };
  return { raw, locks, guest, adoption, request, options, inspected, repository: createAccountSaveSlots(options), fail(at, before = false) { calls = 0; failures = { at, before }; }, clearFailure() { failures = null; calls = 0; }, deny() { allowed = false; }, denyGrant() { grant = false; } };
}

test('adoption preserves exact current gameplay and original guest evidence, blocking stale guest reads', async () => {
  const r = await rig(), before = dump(r.raw);
  expect(await r.adoption.adopt(r.request)).toMatchObject({ status: 'adopted', existing: false });
  for (const [key, value] of Object.entries(before)) expect(r.raw.getItem(key)).toBe(value);
  expect(() => r.guest.getItem(AUTHORITY)).toThrow('GUEST_ALREADY_CLAIMED');
  expect(() => r.guest.setItem(AUTHORITY, 'bad')).toThrow('GUEST_ALREADY_CLAIMED');
  const target = r.repository.openStorage({ ownerId: OWNER, slotId: SLOT });
  expect(target.getItem(AUTHORITY)).toBe(before[AUTHORITY]); expect(target.getItem(GUARD)).toBe(before[GUARD]);
  expect(target.length).toBe(2);
  const current = await enter(entry(target, r.locks), 'continue');
  expect(JSON.parse(current.sessionHandle.storage.getItem('newtone-player-save-v1')).walletBalance).toBe(650);
});

test.each([1,2,3,4,5])('write-then-throw at durable write %s resumes exactly one original operation', async at => {
  const r = await rig(); r.fail(at);
  expect((await r.adoption.adopt(r.request)).status).toBe('outcome-uncertain');
  r.clearFailure(); expect((await r.adoption.adopt(r.request)).status).toBe('adopted');
  expect(r.repository.listSlots(OWNER)).toHaveLength(1);
  expect(readAdoptionRecord(r.raw, 'legacy').record.phase).toBe('committed');
});

test.each([1,2,3,4,5])('failure before durable write %s retains evidence and is resumable', async at => {
  const r = await rig(); r.fail(at, true);
  expect((await r.adoption.adopt(r.request)).status).toBe('outcome-uncertain');
  r.clearFailure(); expect((await r.adoption.adopt(r.request)).status).toBe('adopted');
});

test('a partially reserved destination is listed but cannot be opened or initialized', async () => {
  const r = await rig(); r.fail(3, true); await r.adoption.adopt(r.request); r.clearFailure();
  expect(r.repository.listSlots(OWNER)).toHaveLength(1);
  expect(() => r.repository.openStorage({ ownerId: OWNER, slotId: SLOT })).toThrow('ADOPTION_RECOVERY_REQUIRED');
});

test('prepared adoption reserves capacity and its slot ID even before metadata lands', async () => {
  const r = await rig(); r.fail(2, true); await r.adoption.adopt(r.request); r.clearFailure();
  expect(r.repository.listSlots(OWNER)).toHaveLength(1);
  expect((await r.repository.createSlot({ ownerId: OWNER, slotId: SLOT })).reasonCodes).toContain('ADOPTION_RECOVERY_REQUIRED');
  for (const slotId of [OP, NEW_GUEST]) expect((await r.repository.createSlot({ ownerId: OWNER, slotId })).status).toBe('created');
  expect((await r.repository.createSlot({ ownerId: OWNER, slotId: OTHER })).reasonCodes).toContain('SLOT_CREATION_NOT_ALLOWED');
  expect((await r.adoption.adopt(r.request)).status).toBe('adopted'); expect(r.repository.listSlots(OWNER)).toHaveLength(3);
});

test('a completed adoption retry never overwrites newer destination gameplay', async () => {
  const r = await rig(); await r.adoption.adopt(r.request);
  const current = await enter(entry(r.repository.openStorage({ ownerId: OWNER, slotId: SLOT }), r.locks), 'continue');
  const player = JSON.parse(current.sessionHandle.storage.getItem('newtone-player-save-v1')); player.walletBalance = 601;
  current.sessionHandle.storage.setItem('newtone-player-save-v1', JSON.stringify(player)); await current.sessionHandle.close();
  const before = dump(r.raw); expect((await r.adoption.adopt(r.request)).existing).toBe(true); expect(dump(r.raw)).toEqual(before);
});

test('different owner, slot or operation cannot reuse a claimed guest', async () => {
  const r = await rig(); await r.adoption.adopt(r.request); const before = dump(r.raw);
  for (const change of [{ ownerId: OTHER }, { slotId: OP }, { operationId: SLOT }]) expect((await r.adoption.adopt({ ...r.request, ...change })).status).toBe('blocked');
  expect(dump(r.raw)).toEqual(before);
});

test('without authenticated access or verified server grant adoption has no writes', async () => {
  for (const action of ['deny','denyGrant']) { const r = await rig(), before = dump(r.raw); r[action](); expect((await r.adoption.adopt(r.request)).status).toBe('blocked'); expect(dump(r.raw)).toEqual(before); }
});

test('an existing empty slot is not permission to overwrite or adopt', async () => {
  const r = await rig(); await r.repository.createSlot({ ownerId: OWNER, slotId: SLOT }); const before = dump(r.raw);
  expect((await r.adoption.adopt(r.request)).reasonCodes).toContain('ADOPTION_DESTINATION_EXISTS'); expect(dump(r.raw)).toEqual(before);
});

test('capacity policy includes all reserved slots and never deletes an older slot', async () => {
  const r = await rig(); for (const slotId of [OP, NEW_GUEST, OTHER]) await r.repository.createSlot({ ownerId: OWNER, slotId }); const before = dump(r.raw);
  expect((await r.adoption.adopt(r.request)).reasonCodes).toContain('SLOT_CREATION_NOT_ALLOWED'); expect(dump(r.raw)).toEqual(before);
});

test('partial target corruption blocks recovery without overwriting it', async () => {
  const r = await rig(); r.fail(3); await r.adoption.adopt(r.request); r.clearFailure();
  const key = accountSlotRecordKey(OWNER, SLOT).replace(/meta$/, 'data:unexpected'); r.raw.setItem(key, 'do not overwrite');
  const before = dump(r.raw); expect((await r.adoption.adopt(r.request)).status).toBe('blocked'); expect(dump(r.raw)).toEqual(before);
});

test('new or changed guest content cannot silently replace the captured recovery source', async () => {
  const r = await rig(); r.fail(2, true); await r.adoption.adopt(r.request); r.clearFailure();
  const source = JSON.parse(r.raw.getItem(AUTHORITY)); source.revision += 1; r.raw.setItem(AUTHORITY, JSON.stringify(source)); const before = dump(r.raw);
  expect((await r.adoption.adopt(r.request)).reasonCodes).toContain('ADOPTION_SOURCE_CHANGED'); expect(dump(r.raw)).toEqual(before);
});

test('legacy test-only saves cannot become account gameplay', async () => {
  const raw = memoryStorage({ 'newtone-player-save-v1': '{retired' }), before = dump(raw);
  const service = createPlayerGuestAdoption({ storage: raw, locks: lockManager(), encodePortable, digest: hash });
  expect((await service.inspectGuest('legacy')).status).toBe('blocked'); expect(dump(raw)).toEqual(before);
});

test('logout can explicitly open a fresh independent guest without reviving claimed bytes', async () => {
  const r = await rig(), guests = createPlayerGuestRepository({ storage: r.raw, locks: r.locks, uuid: () => NEW_GUEST });
  await expect(guests.startFresh()).rejects.toThrow('UNCLAIMED_GUEST_MUST_BE_PRESERVED');
  await r.adoption.adopt(r.request); const old = r.raw.getItem(AUTHORITY); expect(guests.inspect().status).toBe('claimed');
  expect((await guests.startFresh()).status).toBe('created'); const fresh = guests.openCurrent(); expect(fresh.getItem(AUTHORITY)).toBeNull();
  await enter(entry(fresh, r.locks)); expect(r.raw.getItem(AUTHORITY)).toBe(old); expect(() => r.guest.getItem(AUTHORITY)).toThrow('GUEST_ALREADY_CLAIMED');
});

test('failed second entry cannot clear another service global game storage', async () => {
  const locks = lockManager(), one = entry(memoryStorage(), locks), active = await enter(one);
  const two = entry(memoryStorage(), locks); await two.prepareEntry({ intent: 'invalid', snapshotToken: '' });
  expect(getGameStorage()).toBe(active.sessionHandle.storage); active.sessionHandle.check();
});

test('disposed service cannot reacquire the writer or publish a runtime', async () => {
  const raw = memoryStorage(), locks = lockManager(), service = entry(raw, locks), inspected = await service.inspectSave();
  await service.dispose(); const before = dump(raw);
  expect((await service.prepareEntry({ intent: 'create', snapshotToken: inspected.snapshotToken })).reasonCodes).toContain('SAVE_SERVICE_DISPOSED');
  expect(dump(raw)).toEqual(before);
});

test('default guest entry remains claim-aware when account configuration is disabled', async () => {
  const r = await rig(); await r.adoption.adopt(r.request); const before = dump(r.raw);
  vi.stubGlobal('localStorage', r.raw);
  const fallback = createSaveEntryService({ locks: r.locks, digest: hash });
  const inspection = await fallback.inspectSave(); expect(inspection.allowedActions).not.toContain('continue'); expect(inspection.reasonCodes).toContain('GUEST_ALREADY_CLAIMED');
  expect((await fallback.prepareEntry({ intent: 'create', snapshotToken: inspection.snapshotToken })).status).toBe('blocked'); expect(dump(r.raw)).toEqual(before);
});
