// Account namespaces isolate application state, not access by a person who can
// inspect this browser's storage. Authentication and encryption are separate.
import { assertAdoptionVisible, assertGuestId } from './playerAdoptionRecord.mjs';
import { assertCloudImportVisible } from './accountCloudImportRecord.mjs';
export const ACCOUNT_SAVE_PREFIX = 'newtone-account-save:v1:';
export const ACCOUNT_SLOT_SCHEMA = 1;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function requireThat(ok, reason) { if (!ok) throw Error(reason); }

export function accountOwnerPrefix(ownerId) {
  requireThat(typeof ownerId === 'string' && uuid.test(ownerId), 'INVALID_ACCOUNT_OWNER_ID');
  return `${ACCOUNT_SAVE_PREFIX}${ownerId}:`;
}

export function accountSlotPrefix(ownerId, slotId) {
  const owner = accountOwnerPrefix(ownerId);
  requireThat(typeof slotId === 'string' && uuid.test(slotId), 'INVALID_ACCOUNT_SLOT_ID');
  return `${owner}${slotId}:`;
}

export function accountSlotRecordKey(ownerId, slotId) {
  return `${accountSlotPrefix(ownerId, slotId)}meta`;
}

export function validateAccountSlotRecord(value, ownerId, slotId) {
  accountSlotPrefix(ownerId, slotId);
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_ACCOUNT_SLOT_RECORD');
  requireThat(value.schemaVersion === ACCOUNT_SLOT_SCHEMA, 'UNSUPPORTED_ACCOUNT_SLOT_SCHEMA');
  requireThat(value.ownerId === ownerId && value.slotId === slotId, 'ACCOUNT_SLOT_OWNER_MISMATCH');
  requireThat(Number.isSafeInteger(value.createdAt) && value.createdAt >= 0, 'INVALID_ACCOUNT_SLOT_RECORD');
  requireThat(Object.keys(value).every(key => ['schemaVersion', 'ownerId', 'slotId', 'createdAt', 'adoptionOperationId', 'adoptionSourceId', 'cloudImportOperationId'].includes(key)), 'UNSUPPORTED_ACCOUNT_SLOT_SCHEMA');
  if (Object.hasOwn(value, 'cloudImportOperationId')) {
    requireThat(typeof value.cloudImportOperationId === 'string' && uuid.test(value.cloudImportOperationId) && !Object.hasOwn(value, 'adoptionOperationId'), 'INVALID_CLOUD_IMPORT_BINDING');
  }
  if (Object.hasOwn(value, 'adoptionOperationId') || Object.hasOwn(value, 'adoptionSourceId')) {
    requireThat(typeof value.adoptionOperationId === 'string' && uuid.test(value.adoptionOperationId), 'INVALID_ADOPTION_BINDING');
    assertGuestId(value.adoptionSourceId);
  }
  return value;
}

export function readAccountSlotRecord(storage, ownerId, slotId) {
  const raw = storage.getItem(accountSlotRecordKey(ownerId, slotId));
  requireThat(raw !== null, 'ACCOUNT_SLOT_MISSING');
  let record;
  try { record = JSON.parse(raw); } catch { throw Error('INVALID_ACCOUNT_SLOT_JSON'); }
  return { record: validateAccountSlotRecord(record, ownerId, slotId), raw };
}

export function assertAccountAccess(assertAccess, scope) {
  requireThat(typeof assertAccess === 'function', 'ACCOUNT_ACCESS_GUARD_REQUIRED');
  // A Promise must not accidentally authorize synchronous Storage operations.
  requireThat(assertAccess(scope) === true, 'ACCOUNT_ACCESS_DENIED');
}

function encodeLogicalKey(key) {
  requireThat(typeof key === 'string' && key.length > 0, 'INVALID_ACCOUNT_STORAGE_KEY');
  try { return encodeURIComponent(key); } catch { throw Error('INVALID_ACCOUNT_STORAGE_KEY'); }
}

function decodeLogicalKey(encoded) {
  let key;
  try { key = decodeURIComponent(encoded); } catch { throw Error('INVALID_ACCOUNT_STORAGE_KEY'); }
  requireThat(encodeLogicalKey(key) === encoded, 'INVALID_ACCOUNT_STORAGE_KEY');
  return key;
}

export function validateAccountSlotNamespace(storage, ownerId, slotId) {
  const prefix = accountSlotPrefix(ownerId, slotId);
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (typeof key !== 'string' || !key.startsWith(prefix)) continue;
    const suffix = key.slice(prefix.length);
    requireThat(suffix === 'meta' || suffix.startsWith('data:'), 'UNSUPPORTED_ACCOUNT_SLOT_NAMESPACE');
    if (suffix.startsWith('data:')) decodeLogicalKey(suffix.slice('data:'.length));
  }
}

/**
 * Storage-compatible view used beneath createSaveEntryService, not instead of it.
 * No guest fallback, authentication persistence, slot creation, or implicit copy.
 * The caller must bind assertAccess to a particular authenticated session and
 * revoke this view before switching accounts. A user ID alone is not proof.
 */
export function createAccountSaveStorage({ storage, ownerId, slotId, assertAccess }) {
  const scope = Object.freeze({ ownerId, slotId });
  const prefix = `${accountSlotPrefix(ownerId, slotId)}data:`;
  const metaKey = accountSlotRecordKey(ownerId, slotId);
  assertAccountAccess(assertAccess, scope);
  validateAccountSlotNamespace(storage, ownerId, slotId);
  const metadata = readAccountSlotRecord(storage, ownerId, slotId);
  assertAdoptionVisible(storage, metadata.record);
  assertCloudImportVisible(storage, metadata.record);
  const baseline = metadata.raw;
  let revoked = false;
  function check() {
    requireThat(!revoked, 'ACCOUNT_STORAGE_REVOKED');
    assertAccountAccess(assertAccess, scope);
    requireThat(storage.getItem(metaKey) === baseline, 'ACCOUNT_SLOT_RECORD_CHANGED');
    assertAdoptionVisible(storage, metadata.record);
    assertCloudImportVisible(storage, metadata.record);
    validateAccountSlotNamespace(storage, ownerId, slotId);
  }
  function keys() {
    check();
    const found = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (typeof key === 'string' && key.startsWith(prefix)) found.push(decodeLogicalKey(key.slice(prefix.length)));
    }
    return found.sort();
  }
  return Object.freeze({
    scope,
    check,
    revoke() { revoked = true; },
    getItem(key) { check(); return storage.getItem(prefix + encodeLogicalKey(key)); },
    setItem(key, value) { check(); storage.setItem(prefix + encodeLogicalKey(key), String(value)); },
    removeItem(key) { check(); storage.removeItem(prefix + encodeLogicalKey(key)); },
    // Clearing a slot must later use an explicit backup/replacement workflow.
    clear() { check(); throw Error('ACCOUNT_SLOT_CLEAR_REQUIRES_EXPLICIT_RECOVERY'); },
    key(index) { return Number.isInteger(index) && index >= 0 ? keys()[index] ?? null : (check(), null); },
    get length() { return keys().length; },
  });
}
