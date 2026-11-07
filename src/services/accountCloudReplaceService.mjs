import { accountSlotPrefix, accountSlotRecordKey, readAccountSlotRecord, createAccountSaveStorage, assertAccountAccess } from './accountSaveStorage.mjs';
import { cloudReplaceRecordKey, readCloudReplaceRecord, listCloudReplaceRecords } from './accountCloudReplaceRecord.mjs';
import { authorityFromPortable } from './accountCloudImportService.mjs';
import { createSaveEntryService, validateSaveEntryAuthority } from './saveEntryService.mjs';
import { fingerprintPlayerCloudPayload, createPlayerCloudPayloadFromAuthority } from './playerCloudService.mjs';
import { AUTHORITY, GUARD, PENDING, ACKNOWLEDGED, SAVE_EPOCH, WRITER_LOCK } from './saveEpoch.mjs';
const assert = (ok, code) => { if (!ok) throw Error(code); };
const snapshot = view => Object.fromEntries(Array.from({ length: view.length }, (_, index) => { const key = view.key(index); return [key, view.getItem(key)]; }));

/** Explicit, receipt-bound replacement only. Backup and recovery records are never deleted. */
export function createAccountCloudReplaceService({ storage, locks, assertAccess, verifyResolution, now = Date.now, subtle = globalThis.crypto?.subtle } = {}) {
  async function replace(input) {
    const { ownerId, slotId, operationId, expectedAuthorityRaw, expectedGuardRaw, payloadRaw, sourceFingerprint, cloudRevision } = input;
    let attempted = false;
    try {
      const scope = { ownerId, slotId }, key = cloudReplaceRecordKey(ownerId, slotId, operationId), prefix = accountSlotPrefix(ownerId, slotId) + 'data:';
      assert(typeof expectedAuthorityRaw === 'string' && typeof expectedGuardRaw === 'string', 'REPLACEMENT_BASE_REQUIRED');
      const payload = JSON.parse(payloadRaw), encoded = await fingerprintPlayerCloudPayload(payload, subtle);
      assert(encoded.payloadRaw === payloadRaw && encoded.sourceFingerprint === sourceFingerprint, 'CLOUD_REPLACE_FINGERPRINT_MISMATCH');
      const authority = authorityFromPortable(payload, operationId, sourceFingerprint);
      const targetAuthority = JSON.stringify(authority), targetGuard = JSON.stringify({ saveEpoch: SAVE_EPOCH, firstOperationId: operationId, phase: 'committed' });
      assert(/^[1-9][0-9]*$/.test(cloudRevision), 'INVALID_CLOUD_REVISION');
      assertAccountAccess(assertAccess, scope);
      assert(typeof verifyResolution === 'function' && await verifyResolution(input) === true, 'VERIFIED_RESOLUTION_REQUIRED');
      assertAccountAccess(assertAccess, scope);
      const manager = locks ?? globalThis.navigator?.locks;
      assert(typeof manager?.request === 'function', 'LOCKING_UNAVAILABLE');
      return await manager.request(WRITER_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        assert(lock, 'ANOTHER_SESSION_ACTIVE'); assertAccountAccess(assertAccess, scope);
        const pending = listCloudReplaceRecords(storage, ownerId, slotId).filter(record => record.phase === 'prepared');
        assert(pending.every(record => record.operationId === operationId), 'OTHER_REPLACEMENT_PENDING');
        let prior = readCloudReplaceRecord(storage, ownerId, slotId, operationId);
        if (prior) {
          const r = prior.record;
          assert(r.payloadRaw === payloadRaw && r.sourceFingerprint === sourceFingerprint && r.cloudRevision === cloudRevision && r.before[AUTHORITY] === expectedAuthorityRaw && r.before[GUARD] === expectedGuardRaw && r.after[AUTHORITY] === targetAuthority && r.after[GUARD] === targetGuard, 'CLOUD_REPLACE_REQUEST_CHANGED');
          assert(storage.getItem(accountSlotRecordKey(ownerId, slotId)) === r.metadataRaw, 'CLOUD_REPLACE_METADATA_CHANGED');
          validateSaveEntryAuthority(JSON.parse(r.before[AUTHORITY])); validateSaveEntryAuthority(JSON.parse(r.after[AUTHORITY]));
          const expectedAfter = { ...r.before, [AUTHORITY]: targetAuthority, [GUARD]: targetGuard }; delete expectedAfter[PENDING]; delete expectedAfter[ACKNOWLEDGED];
          assert(JSON.stringify(expectedAfter) === JSON.stringify(r.after), 'CLOUD_REPLACE_RECORD_CHANGED');
          if (r.phase === 'committed') { createAccountSaveStorage({ storage, ...scope, assertAccess }).check(); return { status: 'existing', ...scope, operationId }; }
        } else {
          const view = createAccountSaveStorage({ storage, ...scope, assertAccess });
          const exported = await createSaveEntryService({ storage: view, locks }).exportCurrentSave();
          assert(exported.status === 'exported', exported.reasonCodes?.[0] ?? 'LOCAL_SAVE_NOT_EXPORTABLE');
          assertAccountAccess(assertAccess, scope);
          assert(exported.authorityRaw === expectedAuthorityRaw && exported.guardRaw === expectedGuardRaw, 'CLOUD_REPLACE_BASE_CHANGED');
          const before = snapshot(view), metadataRaw = readAccountSlotRecord(storage, ownerId, slotId).raw;
          assert(before[AUTHORITY] === expectedAuthorityRaw && before[GUARD] === expectedGuardRaw, 'CLOUD_REPLACE_BASE_CHANGED');
          const after = { ...before, [AUTHORITY]: targetAuthority, [GUARD]: targetGuard }; delete after[PENDING]; delete after[ACKNOWLEDGED];
          const record = { schemaVersion: 1, ownerId, slotId, operationId, phase: 'prepared', cloudRevision, payloadRaw, sourceFingerprint, metadataRaw, before, after, createdAt: now() };
          assert(Number.isSafeInteger(record.createdAt) && record.createdAt >= 0, 'INVALID_REPLACEMENT_TIMESTAMP');
          const raw = JSON.stringify(record); attempted = true; storage.setItem(key, raw); assert(storage.getItem(key) === raw, 'CLOUD_REPLACE_PREPARE_UNCERTAIN');
          prior = { raw, record };
        }
        const { before, after, metadataRaw } = prior.record;
        const allowed = new Set([...Object.keys(before), ...Object.keys(after)]);
        function check() {
          assertAccountAccess(assertAccess, scope);
          assert(storage.getItem(key) === prior.raw, 'CLOUD_REPLACE_RECORD_CHANGED');
          assert(storage.getItem(accountSlotRecordKey(ownerId, slotId)) === metadataRaw, 'CLOUD_REPLACE_METADATA_CHANGED');
          for (let i = 0; i < storage.length; i += 1) {
            const physical = storage.key(i); if (!physical?.startsWith(prefix)) continue;
            let logical; try { logical = decodeURIComponent(physical.slice(prefix.length)); } catch { throw Error('CLOUD_REPLACE_UNKNOWN_KEY'); }
            assert(prefix + encodeURIComponent(logical) === physical && allowed.has(logical), 'CLOUD_REPLACE_UNKNOWN_KEY');
          }
          for (const logical of allowed) {
            const actual = storage.getItem(prefix + encodeURIComponent(logical));
            assert(actual === (before[logical] ?? null) || actual === (after[logical] ?? null), 'CLOUD_REPLACE_TARGET_CHANGED');
          }
        }
        // The pending ledger hides this slot until all known control keys agree.
        for (const logical of allowed) {
          check(); const physical = prefix + encodeURIComponent(logical), desired = after[logical] ?? null;
          if (storage.getItem(physical) !== desired) { attempted = true; if (desired === null) storage.removeItem(physical); else storage.setItem(physical, desired); }
          assert(storage.getItem(physical) === desired, 'CLOUD_REPLACE_WRITE_UNCERTAIN');
        }
        check(); for (const logical of allowed) assert(storage.getItem(prefix + encodeURIComponent(logical)) === (after[logical] ?? null), 'CLOUD_REPLACE_WRITE_UNCERTAIN');
        const committed = JSON.stringify({ ...prior.record, phase: 'committed' }); attempted = true; storage.setItem(key, committed); assert(storage.getItem(key) === committed, 'CLOUD_REPLACE_COMMIT_UNCERTAIN');
        assertAccountAccess(assertAccess, scope); createAccountSaveStorage({ storage, ...scope, assertAccess }).check();
        return { status: 'replaced', ...scope, operationId };
      });
    } catch (error) { return { status: attempted ? 'outcome-uncertain' : 'blocked', operationId, reasonCodes: [error?.name === 'QuotaExceededError' ? 'LOCAL_STORAGE_FULL' : error instanceof Error ? error.message : String(error)] }; }
  }
  async function listBackups({ ownerId, slotId }) {
    assertAccountAccess(assertAccess, { ownerId, slotId });
    const records = listCloudReplaceRecords(storage, ownerId, slotId), result = [];
    for (const record of records) {
      const authority = validateSaveEntryAuthority(JSON.parse(record.before[AUTHORITY]));
      const encoded = await fingerprintPlayerCloudPayload(createPlayerCloudPayloadFromAuthority(authority), subtle);
      assertAccountAccess(assertAccess, { ownerId, slotId });
      result.push({ backupId: record.operationId, createdAt: record.createdAt, phase: record.phase, ...encoded });
    }
    return result;
  }
  return Object.freeze({ replace, listBackups });
}
