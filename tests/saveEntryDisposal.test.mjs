import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { createSaveEntryService } from '../src/services/saveEntryService.mjs';
import { memoryStorage, getGameStorage, installGameStorage } from '../src/save-session.mjs';
import { AUTHORITY, PENDING, RETIRED_PREFIX, WRITER_LOCK } from '../src/services/saveEpoch.mjs';

const services = [];
afterEach(async () => {
  for (const service of services.splice(0)) await service.dispose();
  installGameStorage(null);
});
const hash = text => createHash('sha256').update(text).digest('hex');
const dump = storage => Object.fromEntries(Array.from({ length: storage.length }, (_, i) => {
  const key = storage.key(i); return [key, storage.getItem(key)];
}));
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function gatedDigest(predicate) {
  const entered = deferred(), resume = deferred();
  let used = false;
  return {
    entered: entered.promise, resume: resume.resolve,
    async digest(text) {
      if (!used && predicate(JSON.parse(text))) {
        used = true; entered.resolve(); await resume.promise;
      }
      return hash(text);
    },
  };
}
function locks() {
  let held = false;
  return { async request(name, options, callback) {
    expect(name).toBe(WRITER_LOCK);
    expect(options).toEqual({ mode: 'exclusive', ifAvailable: true });
    if (held) return callback(null);
    held = true;
    try { return await callback({ name }); } finally { held = false; }
  } };
}
let serial = 0;
function service(storage, manager, digest = async text => hash(text)) {
  const result = createSaveEntryService({ storage, locks: manager, digest, uuid: () => `disposal-${++serial}` });
  services.push(result); return result;
}
async function enter(current) {
  const inspected = await current.inspectSave();
  const prepared = await current.prepareEntry({ intent: 'create', snapshotToken: inspected.snapshotToken });
  expect(prepared.status).toBe('prepared');
  const result = await current.commitEntry({ ticket: prepared.ticket });
  expect(result.status).toBe('committed');
  return result.sessionHandle;
}

test('dispose during retirement hashing prevents writes after the writer lease is released', async () => {
  const manager = locks(), raw = memoryStorage();
  const gate = gatedDigest(value => value.reason === 'source-changed-before-first-commit');
  const old = service(raw, manager, gate.digest);
  const inspection = await old.inspectSave();
  const prepared = await old.prepareEntry({ intent: 'create', snapshotToken: inspection.snapshotToken });
  expect(prepared.status).toBe('prepared');
  raw.setItem('newtone-player-save-v1', 'late legacy bytes');
  const pending = old.resolveOperation({ ticket: prepared.ticket });
  await gate.entered;
  const before = dump(raw);
  await old.dispose();
  // A different service acquires the released lease before the old hash finishes.
  const replacement = await enter(service(memoryStorage(), manager));
  gate.resume();
  expect(await pending).toMatchObject({ status: 'unresolved', reasonCodes: ['SESSION_NOT_OWNED'] });
  expect(dump(raw)).toEqual(before);
  expect(raw.getItem(RETIRED_PREFIX + prepared.ticket.operationId)).toBeNull();
  expect(raw.getItem(PENDING)).not.toBeNull();
  expect(getGameStorage()).toBe(replacement.storage);
  replacement.check();
});

test('dispose during prepare hashing prevents pending persistence and late runtime publication', async () => {
  const manager = locks(), raw = memoryStorage();
  const gate = gatedDigest(value => value.intent === 'create' && Boolean(value.values));
  const old = service(raw, manager, gate.digest);
  const inspection = await old.inspectSave();
  const pending = old.prepareEntry({ intent: 'create', snapshotToken: inspection.snapshotToken });
  await gate.entered;
  const before = dump(raw);
  await old.dispose();
  const replacement = await enter(service(memoryStorage(), manager));
  gate.resume();
  const result = await pending;
  expect(result.status).not.toBe('prepared');
  expect(result.reasonCodes).toContain('SAVE_SERVICE_DISPOSED');
  expect(dump(raw)).toEqual(before);
  expect(raw.getItem(PENDING)).toBeNull();
  expect(raw.getItem(AUTHORITY)).toBeNull();
  expect(getGameStorage()).toBe(replacement.storage);
  replacement.check();
});

test('disposing and failing an unowned service cannot detach the installed game', async () => {
  const manager = locks();
  const active = await enter(service(memoryStorage(), manager));
  const unrelated = service(memoryStorage(), manager);
  await unrelated.prepareEntry({ intent: 'invalid', snapshotToken: '' });
  await unrelated.dispose();
  await unrelated.dispose();
  expect(getGameStorage()).toBe(active.storage);
  active.check();
});
