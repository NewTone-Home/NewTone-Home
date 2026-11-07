export const CLOUD_IMPORT_PREFIX = 'newtone-cloud-import:v1:';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const assert=(ok,code)=>{if(!ok)throw Error(code);};
export function cloudImportRecordKey(ownerId,slotId,operationId) {
 assert([ownerId,slotId,operationId].every(x=>typeof x==='string'&&uuid.test(x)),'INVALID_CLOUD_IMPORT_ID');
 return `${CLOUD_IMPORT_PREFIX}${ownerId}:${slotId}:${operationId}`;
}
export function readCloudImportRecord(storage,ownerId,slotId,operationId) {
 const raw=storage.getItem(cloudImportRecordKey(ownerId,slotId,operationId));if(raw===null)return null;
 let record;try{record=JSON.parse(raw);}catch{throw Error('INVALID_CLOUD_IMPORT_RECORD');}
 const keys=['schemaVersion','ownerId','slotId','operationId','phase','cloudRevision','payloadRaw','sourceFingerprint','targetAuthorityRaw','targetGuardRaw','targetMetadataRaw','createdAt'];
 assert(record?.schemaVersion===1&&record.ownerId===ownerId&&record.slotId===slotId&&record.operationId===operationId&&['prepared','committed'].includes(record.phase)&&Object.keys(record).length===keys.length&&Object.keys(record).every(k=>keys.includes(k)),'INVALID_CLOUD_IMPORT_RECORD');
 assert(/^[1-9][0-9]*$/.test(record.cloudRevision)&&/^[0-9a-f]{64}$/.test(record.sourceFingerprint)&&['payloadRaw','targetAuthorityRaw','targetGuardRaw','targetMetadataRaw'].every(k=>typeof record[k]==='string')&&Number.isSafeInteger(record.createdAt)&&record.createdAt>=0,'INVALID_CLOUD_IMPORT_RECORD');
 return {raw,record};
}
export function assertCloudImportVisible(storage,metadata) {
 if(!Object.hasOwn(metadata,'cloudImportOperationId'))return;
 const entry=readCloudImportRecord(storage,metadata.ownerId,metadata.slotId,metadata.cloudImportOperationId)?.record;
 assert(entry&&entry.phase==='committed','CLOUD_IMPORT_RECOVERY_REQUIRED');
 assert(entry.targetMetadataRaw===JSON.stringify(metadata),'CLOUD_IMPORT_BINDING_MISMATCH');
}
