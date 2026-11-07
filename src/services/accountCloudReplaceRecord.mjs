export const CLOUD_REPLACE_PREFIX = 'newtone-cloud-replace:v1:';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const assert = (ok, code) => { if (!ok) throw Error(code); };
export function cloudReplacePrefix(ownerId, slotId) {
  assert([ownerId, slotId].every(id => typeof id === 'string' && uuid.test(id)), 'INVALID_CLOUD_REPLACE_SCOPE');
  return `${CLOUD_REPLACE_PREFIX}${ownerId}:${slotId}:`;
}
export function cloudReplaceRecordKey(ownerId, slotId, operationId) {
  assert(typeof operationId === 'string' && uuid.test(operationId), 'INVALID_CLOUD_REPLACE_OPERATION');
  return cloudReplacePrefix(ownerId, slotId) + operationId;
}
export function readCloudReplaceRecord(storage, ownerId, slotId, operationId) {
  const key = cloudReplaceRecordKey(ownerId, slotId, operationId), raw = storage.getItem(key);
  if (raw === null) return null;
  let record; try { record = JSON.parse(raw); } catch { throw Error('INVALID_CLOUD_REPLACE_RECORD'); }
  const fields = ['schemaVersion','ownerId','slotId','operationId','phase','cloudRevision','payloadRaw','sourceFingerprint','metadataRaw','before','after','createdAt'];
  assert(record?.schemaVersion === 1 && record.ownerId === ownerId && record.slotId === slotId && record.operationId === operationId && ['prepared','committed'].includes(record.phase) && Object.keys(record).length === fields.length && Object.keys(record).every(key => fields.includes(key)), 'INVALID_CLOUD_REPLACE_RECORD');
  assert(/^[1-9][0-9]*$/.test(record.cloudRevision) && /^[0-9a-f]{64}$/.test(record.sourceFingerprint) && typeof record.payloadRaw === 'string' && typeof record.metadataRaw === 'string' && Number.isSafeInteger(record.createdAt) && record.createdAt >= 0, 'INVALID_CLOUD_REPLACE_RECORD');
  for (const values of [record.before, record.after]) assert(values && Object.getPrototypeOf(values) === Object.prototype && Object.values(values).every(value => typeof value === 'string'), 'INVALID_CLOUD_REPLACE_RECORD');
  return { raw, record };
}
export function listCloudReplaceRecords(storage, ownerId, slotId) {
  const prefix = cloudReplacePrefix(ownerId, slotId), records = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i); if (!key?.startsWith(prefix)) continue;
    records.push(readCloudReplaceRecord(storage, ownerId, slotId, key.slice(prefix.length)).record);
  }
  return records;
}
export function assertCloudReplacementVisible(storage, ownerId, slotId) {
  assert(!listCloudReplaceRecords(storage, ownerId, slotId).some(record => record.phase === 'prepared'), 'CLOUD_REPLACE_RECOVERY_REQUIRED');
}
