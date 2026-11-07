import { createClient } from '@supabase/supabase-js'
import { validatePlayerAuthCallback } from '../services/playerAuth.mjs'
import { createPlayerOAuthFlow } from '../services/playerOAuthFlow.mjs'

export const PLAYER_AUTH_STORAGE_KEY = 'newtone-player-auth-v1'

const blocked = code => ({ enabled: false, client: null, error: { code, message: 'Player accounts are not configured for this deployment.' } })

/** No module-level client. Explicit deployment configuration and origin required. */
export function createPlayerSupabase({ env = import.meta.env, currentOrigin, currentUrl, oauthStorage,
  replaceUrl = url => globalThis.history?.replaceState(null, '', url), createClientImpl = createClient } = {}) {
  if (env?.VITE_PLAYER_ACCOUNTS_ENABLED !== 'true') return blocked('player_accounts_disabled')
  if (env?.VITE_PLAYER_OTP_CONFIGURED !== 'true') return blocked('player_otp_not_configured')
  const verifiedOrigin = env.VITE_PLAYER_AUTH_ORIGIN
  const callbackUrl = env.VITE_PLAYER_AUTH_CALLBACK_URL
  let redirectTo, url
  try {
    redirectTo = validatePlayerAuthCallback(verifiedOrigin, callbackUrl)
    // The current deployment must match configured origin exactly, never a forwarded URL.
    if (typeof currentOrigin !== 'string' || new URL(currentOrigin).origin !== currentOrigin || currentOrigin !== new URL(verifiedOrigin).origin) return blocked('player_origin_mismatch')
    url = new URL(env.VITE_PLAYER_SUPABASE_URL)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return blocked('player_supabase_url_invalid')
  } catch { return blocked('player_callback_invalid') }
  const key = env.VITE_PLAYER_SUPABASE_PUBLISHABLE_KEY
  // Require a frontend publishable key, never service-role/secret credentials.
  if (typeof key !== 'string' || !key.startsWith('sb_publishable_') || key.length <= 'sb_publishable_'.length || /\s/.test(key)) return blocked('player_publishable_key_required')
  try {
    const client = createClientImpl(url.origin, key, {
      db: { schema: 'public' },
      auth: { storageKey: PLAYER_AUTH_STORAGE_KEY, flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
    try { oauthStorage ??= globalThis.sessionStorage } catch { /* Google stays unavailable. */ }
    const oauthFlow = createPlayerOAuthFlow({ auth: client.auth, callbackUrl: redirectTo, currentUrl, storage: oauthStorage, replaceUrl })
    return { enabled: true, client, verifiedOrigin: new URL(verifiedOrigin).origin, callbackUrl: redirectTo, otpReady: true, oauthFlow, error: null }
  } catch { return blocked('player_client_initialization_failed') }
}
