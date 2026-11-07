import { createPlayerSupabase } from '../lib/playerSupabase.js'
import { createPlayerAuthController } from './playerAuth.mjs'
import { createPlayerAccountBackend } from './playerAccountBackend.mjs'
import { createPlayerAccountCoordinator } from './playerAccountCoordinator.mjs'

const disabled = code => ({ enabled: false, error: { code, message: 'Player accounts are not enabled for this deployment.' } })

/** Explicit composition entrypoint. Importing this module creates no runtime/client. */
export function createPlayerAccountRuntime({ env = import.meta.env, currentOrigin, currentUrl,
  storage, locks, makeClient = createPlayerSupabase, makeAuth = createPlayerAuthController,
  makeBackend = createPlayerAccountBackend, makeCoordinator = createPlayerAccountCoordinator,
} = {}) {
  // Gate before touching browser storage or constructing any client.
  if (env?.VITE_PLAYER_ACCOUNTS_ENABLED !== 'true' || env?.VITE_PLAYER_CLOUD_CONFIGURED !== 'true') return disabled('player_accounts_disabled')
  let client, authController, saveCoordinator
  try {
    storage ??= globalThis.localStorage
    locks ??= globalThis.navigator?.locks
    if (!storage || typeof locks?.request !== 'function') return disabled('player_storage_unavailable')
    const configured = makeClient({ env, currentOrigin, currentUrl })
    if (!configured.enabled) return configured
    client = configured.client
    authController = makeAuth({ auth: client.auth, verifiedOrigin: configured.verifiedOrigin,
      callbackUrl: configured.callbackUrl, otpEmailConfigured: configured.otpReady === true, oauthFlow: configured.oauthFlow })
    const backend = makeBackend({ rpc: (name, args) => client.rpc(name, args), storage, locks,
      getIdentity: () => {
        const snapshot = authController.getSnapshot()
        return snapshot.status === 'authenticated' && snapshot.user?.id
          ? { ownerId: snapshot.user.id, sessionEpoch: snapshot.sessionEpoch } : null
      },
    })
    saveCoordinator = makeCoordinator({ authController, backend, storage, locks })
    let disposed = false
    return { enabled: true, authController, saveCoordinator, otpReady: configured.otpReady === true,
      googleReady: env.VITE_PLAYER_GOOGLE_CONFIGURED === 'true' && configured.oauthFlow?.available === true,
      async dispose() {
        if (disposed) return
        disposed = true
        try { await saveCoordinator.dispose() }
        finally { authController.dispose(); await client.auth.stopAutoRefresh() }
      },
    }
  } catch {
    authController?.dispose()
    // Initialization failure does not sign out, clear credentials, or mutate saves.
    try { Promise.resolve(client?.auth?.stopAutoRefresh()).catch(() => {}) } catch { /* safe fallback */ }
    return disabled('player_runtime_initialization_failed')
  }
}
