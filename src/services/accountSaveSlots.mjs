import { CLOUD_IMPORT_PREFIX, readCloudImportRecord } from './accountCloudImportRecord.mjs';
import { WRITER_LOCK } from './saveEpoch.mjs';
import { ADOPTION_PREFIX, readAdoptionRecord } from './playerAdoptionRecord.mjs';
import {
  ACCOUNT_SLOT_SCHEMA, accountOwnerPrefix, accountSlotPrefix, accountSlotRecordKey,
  assertAccountAccess, createAccountSaveStorage, readAccountSlotRecord, validateAccountSlotNamespace,
} from './accountSaveStorage.mjs';

function requireThat(ok, reason) { if (!ok) throw Error(reason); }
const failure = (status, error, slotId) => ({ status, slotId, reasonCodes: [error instanceof Error ? error.message : String(error)] });

/**
 * Local slot catalogue foundation. A listed empty slot is valid: the existing
 * entry service creates its game only after an explicit entry operation.
 * The metadata write is the only creation commit, so retries use the same ID.
 * There is deliberately no product slot limit, deletion, or backup retention.
 */
export function createAccountSaveSlots({ storage, locks, assertAccess, canCreateSlot, now = Date.now } = {}) {
  requireThat(storage && typeof storage.getItem === 'function', 'ACCOUNT_STORAGE_REQUIRED');

  function listSlots(ownerId) {
    const prefix = accountOwnerPrefix(ownerId);
    assertAccountAccess(assertAccess, { ownerId });
    const slots = new Map();
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (typeof key !== 'string' || !key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length), colon = rest.indexOf(':');
      requireThat(colon > 0, 'UNSUPPORTED_ACCOUNT_SLOT_NAMESPACE');
      const slotId = rest.slice(0, colon), suffix = rest.slice(colon + 1);
      accountSlotPrefix(ownerId, slotId);
      requireThat(suffix === 'meta' || suffix.startsWith('data:'), 'UNSUPPORTED_ACCOUNT_SLOT_NAMESPACE');
      if (!slots.has(slotId)) {
        validateAccountSlotNamespace(storage, ownerId, slotId);
        slots.set(slotId, readAccountSlotRecord(storage, ownerId, slotId).record);
      }
    }
    // A prepared adoption is the reservation commit, even if the next metadata
    // write never landed. Count it before allowing unrelated slot creation.
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key?.startsWith(ADOPTION_PREFIX)) continue;
      const adoption = readAdoptionRecord(storage, key.slice(ADOPTION_PREFIX.length))?.record;
      if (!adoption || adoption.ownerId !== ownerId) continue;
      const existing = slots.get(adoption.slotId);
      if (existing) {
        requireThat(existing.adoptionOperationId === adoption.operationId && existing.adoptionSourceId === adoption.guestId, 'ADOPTION_RESERVATION_CONFLICT');
      } else {
        requireThat(adoption.phase === 'prepared', 'ADOPTED_SLOT_MISSING');
        slots.set(adoption.slotId, { schemaVersion: ACCOUNT_SLOT_SCHEMA, ownerId, slotId: adoption.slotId, createdAt: adoption.createdAt, adoptionOperationId: adoption.operationId, adoptionSourceId: adoption.guestId });
      }
    }
    // Cloud-import preparation reserves its slot before metadata becomes visible.
    const importPrefix = CLOUD_IMPORT_PREFIX + ownerId + ':';
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key?.startsWith(importPrefix)) continue;
      const parts = key.slice(importPrefix.length).split(':');
      requireThat(parts.length === 2, 'INVALID_CLOUD_IMPORT_RECORD');
      const imported = readCloudImportRecord(storage, ownerId, parts[0], parts[1])?.record;
      requireThat(imported, 'INVALID_CLOUD_IMPORT_RECORD');
      const existing = slots.get(imported.slotId);
      if (existing) {
        requireThat(existing.cloudImportOperationId === imported.operationId, 'CLOUD_IMPORT_RESERVATION_CONFLICT');
      } else {
        requireThat(imported.phase === 'prepared', 'CLOUD_IMPORTED_SLOT_MISSING');
        slots.set(imported.slotId, { schemaVersion: ACCOUNT_SLOT_SCHEMA, ownerId, slotId: imported.slotId, createdAt: imported.createdAt, cloudImportOperationId: imported.operationId });
      }
    }
    assertAccountAccess(assertAccess, { ownerId });
    return [...slots.values()].sort((a, b) => a.createdAt - b.createdAt || a.slotId.localeCompare(b.slotId));
  }

  async function createSlot({ ownerId, slotId }) {
    let attempted = false;
    try {
      const scope = { ownerId, slotId }, prefix = accountSlotPrefix(ownerId, slotId);
      assertAccountAccess(assertAccess, scope);
      const manager = locks ?? globalThis.navigator?.locks;
      requireThat(typeof manager?.request === 'function', 'LOCKING_UNAVAILABLE');
      // All slots share the existing writer lock. The current runtime installs
      // one global game storage, so per-slot parallel writers are not safe yet.
      return await manager.request(WRITER_LOCK, { mode: 'exclusive', ifAvailable: true }, lock => {
        if (!lock) return failure('busy', 'ANOTHER_SESSION_ACTIVE', slotId);
        assertAccountAccess(assertAccess, scope);
        const existing = listSlots(ownerId).find(slot => slot.slotId === slotId);
        if (existing) {
          if (existing.cloudImportOperationId) requireThat(readCloudImportRecord(storage, ownerId, slotId, existing.cloudImportOperationId)?.record.phase === 'committed', 'CLOUD_IMPORT_RECOVERY_REQUIRED');
          if (existing.adoptionOperationId) requireThat(readAdoptionRecord(storage, existing.adoptionSourceId)?.record.phase === 'committed', 'ADOPTION_RECOVERY_REQUIRED');
          return { status: 'existing', slot: existing };
        }
        // A missing catalogue record with surviving data is not a fresh slot.
        for (let i = 0; i < storage.length; i += 1) requireThat(!storage.key(i)?.startsWith(prefix), 'ACCOUNT_SLOT_ORPHANED');
        requireThat(typeof canCreateSlot === 'function', 'SLOT_CREATION_POLICY_REQUIRED');
        requireThat(canCreateSlot({ ownerId, slots: listSlots(ownerId) }) === true, 'SLOT_CREATION_NOT_ALLOWED');
        const slot = { schemaVersion: ACCOUNT_SLOT_SCHEMA, ownerId, slotId, createdAt: now() };
        requireThat(Number.isSafeInteger(slot.createdAt) && slot.createdAt >= 0, 'INVALID_ACCOUNT_SLOT_TIMESTAMP');
        const key = accountSlotRecordKey(ownerId, slotId), serialized = JSON.stringify(slot);
        assertAccountAccess(assertAccess, scope);
        requireThat(storage.getItem(key) === null, 'ACCOUNT_SLOT_CHANGED');
        attempted = true;
        storage.setItem(key, serialized);
        requireThat(storage.getItem(key) === serialized, 'ACCOUNT_SLOT_WRITE_UNCERTAIN');
        assertAccountAccess(assertAccess, scope);
        return { status: 'created', slot };
      });
    } catch (error) {
      // A setter may persist and then throw. Never delete on uncertainty or
      // generate another ID; the caller can retry with this same owner/slot.
      return failure(attempted ? 'outcome-uncertain' : 'blocked', error, slotId);
    }
  }

  function openStorage({ ownerId, slotId }) {
    assertAccountAccess(assertAccess, { ownerId, slotId });
    return createAccountSaveStorage({ storage, ownerId, slotId, assertAccess });
  }

  return Object.freeze({ listSlots, createSlot, openStorage });
}
