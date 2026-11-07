export const ADOPTION_PREFIX = 'newtone-player-adoption:v1:';
export const ADOPTION_INTENT_PREFIX = 'newtone-player-adoption-intent:v1:';
export const GUEST_PREFIX = 'newtone-player-guest:v1:';
export const CURRENT_GUEST_KEY = GUEST_PREFIX + 'current';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function assertGuestId(id) {
  if (id !== 'legacy' && !(typeof id === 'string' && uuid.test(id))) throw Error('INVALID_GUEST_ID');
}
export function adoptionRecordKey(guestId) { assertGuestId(guestId); return ADOPTION_PREFIX + guestId; }
export function adoptionIntentKey(guestId) { assertGuestId(guestId); return ADOPTION_INTENT_PREFIX + guestId; }
export function readAdoptionRecord(storage, guestId) {
  const raw = storage.getItem(adoptionRecordKey(guestId));
  if (raw === null) return null;
  let record;
  try { record = JSON.parse(raw); } catch { throw Error('INVALID_ADOPTION_RECORD'); }
  const fields = ['schemaVersion','operationId','guestId','ownerId','slotId','phase','sourceAuthorityRaw','sourceGuardRaw','sourceHash','portableRaw','sourceFingerprint','targetAuthorityRaw','targetGuardRaw','createdAt'];
  if (!record || record.schemaVersion !== 1 || record.guestId !== guestId ||
      !['operationId','ownerId','slotId'].every(key => typeof record[key] === 'string' && uuid.test(record[key])) ||
      !['prepared','committed'].includes(record.phase) ||
      !['sourceAuthorityRaw','sourceGuardRaw','targetAuthorityRaw','targetGuardRaw','portableRaw'].every(key => typeof record[key] === 'string') ||
      !['sourceHash','sourceFingerprint'].every(key => /^[0-9a-f]{64}$/.test(record[key])) || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0 ||
      Object.keys(record).length !== fields.length || !Object.keys(record).every(key => fields.includes(key))) throw Error('INVALID_ADOPTION_RECORD');
  return { record, raw };
}

export function assertAdoptionVisible(storage, slot) {
  if (!slot.adoptionOperationId) return;
  const entry = readAdoptionRecord(storage, slot.adoptionSourceId)?.record;
  if (!entry || entry.ownerId !== slot.ownerId || entry.slotId !== slot.slotId || entry.operationId !== slot.adoptionOperationId) throw Error('ADOPTION_BINDING_MISMATCH');
  if (entry.phase !== 'committed') throw Error('ADOPTION_RECOVERY_REQUIRED');
}
