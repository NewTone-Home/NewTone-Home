/** Isolated candidate client. Never signs in, mounts runtime storage, or resolves conflicts itself. */
const ACTIONS = new Set(['create', 'adopt', 'write', 'resolve', 'restore', 'release']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requireThat = (condition, code) => { if (!condition) throw Error(code); };
const copy = value => JSON.parse(JSON.stringify(value));
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const sameScope = (a, b) => a?.ownerId === b?.ownerId && a?.sessionId === b?.sessionId;
export function createPlayerCloudService({ rpc, getScope, persistPending, clearPending, now = Date.now } = {}) {
  requireThat(typeof rpc === 'function' && typeof getScope === 'function', 'CLOUD_DEPENDENCIES_REQUIRED');
  let active = null, generation = 0;
  function scope() {
    const s = getScope();
    requireThat(uuid.test(s?.ownerId ?? '') && uuid.test(s?.sessionId ?? ''), 'AUTH_REQUIRED');
    return { ownerId: s.ownerId, sessionId: s.sessionId };
  }
  function stop() { generation += 1; active = null; }
  async function call(action, args, needsLease = true) {
    const s = scope(), g = generation;
    if (needsLease) requireThat(active && sameScope(s, active) && (action === 'renew' || now() < active.deadline), 'CLOUD_SESSION_NOT_ACTIVE');
    const started = now();
    let response;
    try { response = await rpc('player_cloud_v1', { p_action: action, p_args: copy(args) }); }
    catch (error) { return { ok: false, code: 'OUTCOME_UNCERTAIN', error }; }
    requireThat(g === generation && sameScope(s, getScope()), 'STALE_CLOUD_RESPONSE');
    if (response.error) {
      const message = String(response.error.message ?? response.error.code ?? 'CLOUD_ERROR');
      if (/AUTH_REQUIRED|SESSION_REPLACED|SESSION_EXPIRED/.test(message)) stop();
      return { ok: false, code: message, error: response.error };
    }
    const data = response.data;
    requireThat(data && typeof data.ok === 'boolean', 'INVALID_CLOUD_RESPONSE');
    if (data.ok && (action === 'activate' || action === 'renew' || action === 'resume')) {
      requireThat(/^\d+$/.test(data.fence ?? ''), 'INVALID_CLOUD_FENCE');
      const duration = Date.parse(data.leaseUntil) - Date.parse(data.serverNow);
      requireThat(Number.isFinite(duration) && duration > 5000 && duration <= 90000, 'INVALID_CLOUD_LEASE');
      // Duration measured from request start, minus safety margin; client wall-clock skew irrelevant.
      active = { ...s, fence: data.fence, deadline: started + duration - 5000 };
    }
    return data;
  }
  async function activateAfterExplicitLogin() { stop(); return call('activate', {}, false); }
  function args(extra = {}) { requireThat(active && sameScope(active, scope()), 'CLOUD_SESSION_NOT_ACTIVE'); return { ...extra, fence: active.fence }; }
  function prepare(action, parameters) {
    requireThat(ACTIONS.has(action), 'UNSUPPORTED_CLOUD_MUTATION');
    requireThat(uuid.test(parameters?.operationId ?? ''), 'OPERATION_ID_REQUIRED');
    const s = scope();
    requireThat(!Object.hasOwn(parameters, 'fence') && !Object.hasOwn(parameters, 'ownerId'), 'SERVER_AUTHORITY_REQUIRED');
    return freeze({ version: 1, ownerId: s.ownerId, action, parameters: copy(parameters) });
  }
  async function execute(request) {
    requireThat(request?.version === 1 && ACTIONS.has(request.action) && request.ownerId === scope().ownerId, 'CLOUD_REQUEST_SCOPE_MISMATCH');
    requireThat(uuid.test(request.parameters?.operationId ?? ''), 'OPERATION_ID_REQUIRED');
    requireThat(typeof persistPending === 'function' && typeof clearPending === 'function', 'DURABLE_PENDING_STORAGE_REQUIRED');
    const immutable = copy(request), s = scope(), g = generation;
    await persistPending(immutable); // Caller stores exact immutable body, never tokens/fence.
    requireThat(g === generation && sameScope(s, getScope()), 'STALE_CLOUD_REQUEST');
    const result = await call(immutable.action, args(immutable.parameters));
    if (result.ok) {
      if (result.ownerId !== undefined) requireThat(result.ownerId === s.ownerId, 'CLOUD_RECEIPT_OWNER_MISMATCH');
      if (result.operationId !== undefined) requireThat(result.operationId === immutable.parameters.operationId, 'CLOUD_RECEIPT_OPERATION_MISMATCH');
      if (immutable.action === 'adopt') {
        requireThat(result.ownerId === s.ownerId && result.operationId === immutable.parameters.operationId && result.slotId === immutable.parameters.slotId && result.sourceFingerprint === immutable.parameters.sourceFingerprint, 'CLOUD_ADOPTION_RECEIPT_MISMATCH');
      }
      // Persist resulting acknowledgement/import intent BEFORE removing the pending request.
      await clearPending(immutable, result);
      if (immutable.action === 'release') stop();
    }
    return result;
  }
  return Object.freeze({ activateAfterExplicitLogin, resumeExistingSession: () => call('resume', {}, false), stop, prepare, execute,
    renew: () => call('renew', args()),
    listSlots: () => call('list', args()),
    readSlot: slotId => call('read', args({ slotId })),
    listBackups: slotId => call('list_backups', args({slotId})),
    readBackup: (slotId,backupId) => call('read_backup',args({slotId,backupId})),
    getReceipt: operationId => call('receipt', args({ operationId })),
    get isActive() { return !!active && sameScope(active, getScope()) && now() < active.deadline; },
  });
}

/** Canonical wire serialization; rejects values JSON would silently drop or coerce. */
export function serializePlayerCloudPayload(payload) {
  function normalized(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') { requireThat(Number.isFinite(value), 'INVALID_PAYLOAD_NUMBER'); return value; }
    if (Array.isArray(value)) return value.map(normalized);
    requireThat(value && Object.getPrototypeOf(value) === Object.prototype, 'INVALID_PAYLOAD_VALUE');
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])]));
  }
  return JSON.stringify(normalized(payload));
}
export async function fingerprintPlayerCloudPayload(payload, subtle = globalThis.crypto?.subtle) {
  requireThat(subtle && typeof subtle.digest === 'function', 'CRYPTO_REQUIRED');
  const payloadRaw = serializePlayerCloudPayload(payload);
  const bytes = new TextEncoder().encode(payloadRaw);
  requireThat(bytes.length <= 2097152, 'PAYLOAD_TOO_LARGE');
  const digest = await subtle.digest('SHA-256', bytes);
  const sourceFingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return { payloadRaw, sourceFingerprint };
}


/** Caller must first validate authority with the save-entry service under its writer lock. */
export function createPlayerCloudPayloadFromAuthority(authority) {
  requireThat(authority?.saveEpoch === 'persistent-era-1' && authority?.protocolVersion === 2, 'UNSUPPORTED_SAVE_EPOCH');
  requireThat(Number.isSafeInteger(authority.revision) && authority.revision >= 0, 'INVALID_LOCAL_REVISION');
  requireThat(typeof authority.generation?.id === 'string' && authority.generation.id.length > 0 && Number.isSafeInteger(authority.generation.sequence) && authority.generation.sequence >= 1, 'INVALID_GENERATION');
  requireThat(authority.values && Object.getPrototypeOf(authority.values) === Object.prototype && typeof authority.values['newtone-player-save-v1'] === 'string', 'INVALID_PLAYER_VALUES');
  const allowed = key => key === 'newtone-player-save-v1' || key === 'newtone-reader-publication-v1' || /^newtone-(progress-v[1-4]|narrative-progress-v[12]|reader-exit-tutorial-v1|landing-intro-v1|choice-wheel-hint-seen|scene-motion-enabled)$/.test(key) || key.startsWith('newtone:center:scene-layout:');
  requireThat(Object.entries(authority.values).every(([key, value]) => allowed(key) && typeof value === 'string'), 'INVALID_PLAYER_VALUES');
  requireThat(Array.isArray(authority.recoveryHolds) && authority.recoveryHolds.every(hold => hold?.domain === 'cafe' && hold.release === 'verified-return-to-cafe-space'), 'INVALID_RECOVERY_HOLDS');
  return freeze({ format: 'newtone-player-state', formatVersion: 1, saveEpoch: authority.saveEpoch,
    localProtocolVersion: 2, generation: { id: authority.generation.id, sequence: authority.generation.sequence },
    localRevision: authority.revision, values: copy(authority.values),
    recoveryHolds: authority.recoveryHolds.map(() => ({ domain: 'cafe', release: 'verified-return-to-cafe-space' })),
  });
}
