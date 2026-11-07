import { createSaveEntryService } from './saveEntryService.mjs';
import { AUTHORITY, GUARD, WRITER_LOCK } from './saveEpoch.mjs';
import { createAccountSaveSlots } from './accountSaveSlots.mjs';
import { accountSlotPrefix, accountSlotRecordKey, assertAccountAccess } from './accountSaveStorage.mjs';
import { adoptionRecordKey, readAdoptionRecord, assertGuestId } from './playerAdoptionRecord.mjs';
import { createPlayerGuestStorage } from './playerGuestStorage.mjs';

const assert = (ok, reason) => { if (!ok) throw Error(reason); };
const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
const failure = (status, error, operationId) => ({ status, operationId, reasonCodes: [error instanceof Error ? error.message : String(error)] });

/**
 * Local half of a cloud-confirmed adoption. It never guesses whether OTP was a
 * registration or a returning login. authorize must bind a verified cloud result
 * to the exact owner, slot, operation and portable fingerprint below.
 * All source evidence is retained; the committed ledger is the visibility point.
 */
export function createPlayerGuestAdoption({ storage, locks, assertAccess, authorize, canCreateSlot, encodePortable, digest = sha256, now = Date.now } = {}) {
  const repository = createAccountSaveSlots({ storage, locks, assertAccess, canCreateSlot, now });
  const manager = locks ?? globalThis.navigator?.locks;
  async function withLease(work) {
    assert(typeof manager?.request === 'function', 'LOCKING_UNAVAILABLE');
    return manager.request(WRITER_LOCK, { mode: 'exclusive', ifAvailable: true }, lock => {
      assert(lock, 'ANOTHER_SESSION_ACTIVE'); return work();
    });
  }
  async function capture(guestId, recoveryAccess) {
    const source = createPlayerGuestStorage({ storage, guestId, recovery: Boolean(recoveryAccess), assertRecoveryAccess: recoveryAccess });
    const result = await createSaveEntryService({ storage: source, digest }).exportCurrentSave();
    assert(result.status === 'exported', result.reasonCodes?.[0] ?? 'SOURCE_NOT_EXPORTABLE');
    const sourceHash = await digest(result.authorityRaw + '\n' + result.guardRaw);
    assert(source.getItem(AUTHORITY) === result.authorityRaw && source.getItem(GUARD) === result.guardRaw, 'SOURCE_CHANGED_DURING_EXPORT');
    assert(typeof encodePortable === 'function', 'PORTABLE_CODEC_REQUIRED');
    const portable = await encodePortable(result.snapshot);
    assert(typeof portable?.payloadRaw === 'string' && /^[0-9a-f]{64}$/.test(portable.sourceFingerprint), 'INVALID_PORTABLE_SNAPSHOT');
    assert(await digest(portable.payloadRaw) === portable.sourceFingerprint, 'INVALID_PORTABLE_FINGERPRINT');
    assert(source.getItem(AUTHORITY) === result.authorityRaw && source.getItem(GUARD) === result.guardRaw, 'SOURCE_CHANGED_DURING_EXPORT');
    return { ...result, sourceHash, portableRaw: portable.payloadRaw, sourceFingerprint: portable.sourceFingerprint };
  }
  async function inspectGuest(guestId) {
    try { return await withLease(() => capture(guestId)); }
    catch (error) { return failure('blocked', error); }
  }
  async function adopt(request) {
    let attempted = false;
    const { guestId, ownerId, slotId, operationId, sourceHash, sourceFingerprint } = request;
    try {
      assertGuestId(guestId); accountSlotPrefix(ownerId, slotId); accountSlotPrefix(ownerId, operationId);
      const scope = Object.freeze({ guestId, ownerId, slotId, operationId, sourceHash, sourceFingerprint });
      function permission() {
        assertAccountAccess(assertAccess, { ownerId, slotId });
        assert(authorize?.(scope) === true, 'VERIFIED_ADOPTION_GRANT_REQUIRED'); return true;
      }
      permission();
      return await withLease(async () => {
        permission();
        const key = adoptionRecordKey(guestId);
        let saved = readAdoptionRecord(storage, guestId), record = saved?.record;
        if (record) {
          assert(['ownerId','slotId','operationId','sourceHash','sourceFingerprint'].every(field => record[field] === scope[field]), 'GUEST_ADOPTION_ALREADY_BOUND');
          if (record.phase === 'committed') {
            // The target may have legitimate new gameplay. Never restore old bytes.
            repository.openStorage({ ownerId, slotId }).check();
            return { status: 'adopted', ownerId, slotId, operationId, existing: true };
          }
          assert(await digest(record.sourceAuthorityRaw + '\n' + record.sourceGuardRaw) === sourceHash, 'ADOPTION_SOURCE_INTEGRITY_FAILED');
          assert(await digest(record.portableRaw) === sourceFingerprint, 'ADOPTION_PORTABLE_INTEGRITY_FAILED');
          assert(record.targetAuthorityRaw === record.sourceAuthorityRaw && record.targetGuardRaw === record.sourceGuardRaw, 'ADOPTION_TARGET_INTEGRITY_FAILED');
          permission();
          const immutable = await capture(guestId, permission);
          assert(immutable.authorityRaw === record.sourceAuthorityRaw && immutable.guardRaw === record.sourceGuardRaw && immutable.portableRaw === record.portableRaw, 'ADOPTION_SOURCE_CHANGED');
        } else {
          const source = await capture(guestId, permission); permission();
          assert(source.sourceHash === sourceHash && source.sourceFingerprint === sourceFingerprint, 'ADOPTION_SOURCE_CHANGED');
          const slots = repository.listSlots(ownerId);
          assert(!slots.some(slot => slot.slotId === slotId), 'ADOPTION_DESTINATION_EXISTS');
          assert(canCreateSlot?.({ ownerId, slots }) === true, 'SLOT_CREATION_NOT_ALLOWED');
          const prefix = accountSlotPrefix(ownerId, slotId);
          for (let i = 0; i < storage.length; i += 1) assert(!storage.key(i)?.startsWith(prefix), 'ACCOUNT_SLOT_ORPHANED');
          record = { schemaVersion: 1, operationId, guestId, ownerId, slotId, phase: 'prepared', sourceAuthorityRaw: source.authorityRaw, sourceGuardRaw: source.guardRaw, sourceHash, portableRaw: source.portableRaw, sourceFingerprint, targetAuthorityRaw: source.authorityRaw, targetGuardRaw: source.guardRaw, createdAt: now() };
          assert(Number.isSafeInteger(record.createdAt) && record.createdAt >= 0, 'INVALID_ADOPTION_TIMESTAMP');
          assert(storage.getItem(key) === null, 'GUEST_ADOPTION_ALREADY_BOUND');
          attempted = true; storage.setItem(key, JSON.stringify(record));
          assert(storage.getItem(key) === JSON.stringify(record), 'ADOPTION_PREPARE_UNCERTAIN');
          saved = { record, raw: JSON.stringify(record) };
        }
        const metaKey = accountSlotRecordKey(ownerId, slotId), dataPrefix = accountSlotPrefix(ownerId, slotId) + 'data:';
        const metadata = { schemaVersion: 1, ownerId, slotId, createdAt: record.createdAt, adoptionOperationId: operationId, adoptionSourceId: guestId };
        const expected = new Map([[metaKey, JSON.stringify(metadata)], [dataPrefix + encodeURIComponent(GUARD), record.targetGuardRaw], [dataPrefix + encodeURIComponent(AUTHORITY), record.targetAuthorityRaw]]);
        const prefix = accountSlotPrefix(ownerId, slotId);
        for (let i = 0; i < storage.length; i += 1) {
          const physical = storage.key(i);
          if (physical?.startsWith(prefix)) assert(expected.has(physical) && storage.getItem(physical) === expected.get(physical), 'ADOPTION_DESTINATION_CONFLICT');
        }
        for (const [physical, value] of expected) {
          permission(); assert(storage.getItem(key) === saved.raw, 'ADOPTION_RECORD_CHANGED');
          const previous = storage.getItem(physical); assert(previous === null || previous === value, 'ADOPTION_DESTINATION_CONFLICT');
          if (previous === null) { attempted = true; storage.setItem(physical, value); }
          assert(storage.getItem(physical) === value, 'ADOPTION_WRITE_UNCERTAIN');
        }
        permission(); assert(storage.getItem(key) === saved.raw, 'ADOPTION_RECORD_CHANGED');
        const source = createPlayerGuestStorage({ storage, guestId, recovery: true, assertRecoveryAccess: permission });
        assert(source.getItem(AUTHORITY) === record.sourceAuthorityRaw && source.getItem(GUARD) === record.sourceGuardRaw, 'ADOPTION_SOURCE_CHANGED');
        const committed = JSON.stringify({ ...record, phase: 'committed' });
        attempted = true; storage.setItem(key, committed);
        assert(storage.getItem(key) === committed, 'ADOPTION_COMMIT_UNCERTAIN');
        permission(); repository.openStorage({ ownerId, slotId }).check();
        return { status: 'adopted', ownerId, slotId, operationId, existing: false };
      });
    } catch (error) { return failure(attempted ? 'outcome-uncertain' : 'blocked', error, operationId); }
  }
  return Object.freeze({ inspectGuest, adopt });
}
