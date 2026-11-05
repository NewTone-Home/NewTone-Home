// Product retention boundary. Never change this for an ordinary release/schema update.
// Local-only identity: it cannot prove a save once every local credential is removed.
export const SAVE_EPOCH = 'persistent-era-1';
export const EPOCH_PREFIX = 'newtone-persistence:era-1:';
export const AUTHORITY = EPOCH_PREFIX + 'authority';
export const PENDING = EPOCH_PREFIX + 'pending';
export const ACKNOWLEDGED = EPOCH_PREFIX + 'acknowledged';
export const GUARD = EPOCH_PREFIX + 'guard';
export const BACKUP_PREFIX = EPOCH_PREFIX + 'backup:';
// Keep the existing cooperating-writer lock through the cutover.
export const WRITER_LOCK = 'newtone-save-entry-writer-v2';
