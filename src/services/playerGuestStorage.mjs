import { ADOPTION_PREFIX, ADOPTION_INTENT_PREFIX, GUEST_PREFIX, CURRENT_GUEST_KEY, assertGuestId, adoptionRecordKey, adoptionIntentKey, readAdoptionRecord } from './playerAdoptionRecord.mjs';
import { ACCOUNT_SAVE_PREFIX } from './accountSaveStorage.mjs';
import { WRITER_LOCK } from './saveEpoch.mjs';

const assert = (ok, reason) => { if (!ok) throw Error(reason); };
const excluded = key => key.startsWith(ACCOUNT_SAVE_PREFIX) || key.startsWith(ADOPTION_PREFIX) || key.startsWith(ADOPTION_INTENT_PREFIX) || key.startsWith(GUEST_PREFIX);

// Application isolation, not encryption. A claimed guest's original bytes stay
// untouched but can no longer be used through a guest runtime or another login.
export function createPlayerGuestStorage({ storage, guestId = 'legacy', recovery = false, assertRecoveryAccess } = {}) {
  assertGuestId(guestId);
  const prefix = `${GUEST_PREFIX}${guestId}:data:`;
  let revoked = false;
  function check() {
    assert(!revoked, 'GUEST_STORAGE_REVOKED');
    if (recovery) assert(assertRecoveryAccess?.() === true, 'GUEST_RECOVERY_ACCESS_DENIED');
    else {
      assert(storage.getItem(adoptionRecordKey(guestId)) === null, 'GUEST_ALREADY_CLAIMED');
      assert(storage.getItem(adoptionIntentKey(guestId)) === null, 'GUEST_ADOPTION_PENDING');
    }
  }
  const encode = key => { assert(typeof key === 'string' && key.length > 0 && !excluded(key), 'INVALID_GUEST_STORAGE_KEY'); return guestId === 'legacy' ? key : prefix + encodeURIComponent(key); };
  function keys() {
    check(); const result = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (typeof key !== 'string') continue;
      if (guestId === 'legacy') { if (!excluded(key)) result.push(key); }
      else if (key.startsWith(prefix)) {
        let decoded; try { decoded = decodeURIComponent(key.slice(prefix.length)); } catch { throw Error('INVALID_GUEST_STORAGE_KEY'); }
        assert(encode(decoded) === key, 'INVALID_GUEST_STORAGE_KEY'); result.push(decoded);
      }
    }
    return result.sort();
  }
  return Object.freeze({
    guestId, check, revoke() { revoked = true; },
    getItem(key) { check(); return storage.getItem(encode(key)); },
    setItem(key, value) { check(); assert(!recovery, 'GUEST_RECOVERY_IS_READ_ONLY'); storage.setItem(encode(key), String(value)); },
    removeItem(key) { check(); assert(!recovery, 'GUEST_RECOVERY_IS_READ_ONLY'); storage.removeItem(encode(key)); },
    clear() { check(); throw Error('GUEST_CLEAR_REQUIRES_EXPLICIT_RECOVERY'); },
    key(index) { return Number.isInteger(index) && index >= 0 ? keys()[index] ?? null : (check(), null); },
    get length() { return keys().length; },
  });
}

export function createPlayerGuestRepository({ storage, locks, uuid = () => crypto.randomUUID() } = {}) {
  function currentId() {
    const id = storage.getItem(CURRENT_GUEST_KEY) ?? 'legacy'; assertGuestId(id); return id;
  }
  return Object.freeze({
    inspect() {
      const guestId = currentId(), adoption = readAdoptionRecord(storage, guestId);
      return { guestId, status: adoption ? 'claimed' : storage.getItem(adoptionIntentKey(guestId)) !== null ? 'pending' : 'available' };
    },
    openCurrent() { return createPlayerGuestStorage({ storage, guestId: currentId() }); },
    // Explicit action only. Do not silently discard an existing unclaimed guest.
    async startFresh() {
      const manager = locks ?? globalThis.navigator?.locks;
      assert(typeof manager?.request === 'function', 'LOCKING_UNAVAILABLE');
      return manager.request(WRITER_LOCK, { mode: 'exclusive', ifAvailable: true }, lock => {
        assert(lock, 'ANOTHER_SESSION_ACTIVE');
        const oldId = currentId(); assert(readAdoptionRecord(storage, oldId)?.record.phase === 'committed', 'UNCLAIMED_GUEST_MUST_BE_PRESERVED');
        const guestId = uuid(); assertGuestId(guestId); assert(guestId !== 'legacy', 'INVALID_GUEST_ID');
        const prefix = `${GUEST_PREFIX}${guestId}:`;
        for (let i = 0; i < storage.length; i += 1) assert(!storage.key(i)?.startsWith(prefix), 'GUEST_ID_COLLISION');
        assert(storage.getItem(adoptionRecordKey(guestId)) === null, 'GUEST_ID_COLLISION');
        storage.setItem(CURRENT_GUEST_KEY, guestId);
        assert(storage.getItem(CURRENT_GUEST_KEY) === guestId, 'GUEST_SELECTION_UNCERTAIN');
        return { guestId, status: 'created' };
      });
    },
  });
}
