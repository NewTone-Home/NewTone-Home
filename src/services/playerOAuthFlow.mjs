export const PLAYER_OAUTH_INTENT_KEY = 'newtone-player-oauth-intent-v1'
const MAX_AGE_MS = 10 * 60 * 1000

/** Same-tab explicit OAuth intent plus SDK PKCE exchange, not a session authenticity check. */
export function createPlayerOAuthFlow({ auth, callbackUrl, currentUrl, storage, now = Date.now, replaceUrl = () => {} }) {
  let inFlight = null
  let completed = false
  const available = Boolean(storage && typeof storage.setItem === 'function' && typeof auth?.exchangeCodeForSession === 'function')
  return {
    available,
    prepare() {
      if (!available) throw new Error('OAuth callback storage is unavailable.')
      const raw = JSON.stringify({ version: 1, callbackUrl, createdAt: now() })
      storage.setItem(PLAYER_OAUTH_INTENT_KEY, raw)
      if (storage.getItem(PLAYER_OAUTH_INTENT_KEY) !== raw) throw new Error('OAuth intent could not be saved.')
    },
    async complete() {
      if (!available || completed || !currentUrl) return null
      if (inFlight) return inFlight
      const actual = new URL(currentUrl), expected = new URL(callbackUrl)
      const codes = actual.searchParams.getAll('code')
      if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.hash ||
          codes.length !== 1 || !codes[0] || [...actual.searchParams.keys()].some(key => key !== 'code')) return null
      let intent
      try { intent = JSON.parse(storage.getItem(PLAYER_OAUTH_INTENT_KEY)) } catch { return null }
      const age = now() - intent?.createdAt
      if (intent?.version !== 1 || intent.callbackUrl !== callbackUrl || !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null
      inFlight = (async () => {
        const result = await auth.exchangeCodeForSession(codes[0])
        if (!result?.error && result?.data?.session?.user?.id && !result.data.session.user.is_anonymous) {
          completed = true
          storage.removeItem(PLAYER_OAUTH_INTENT_KEY)
          replaceUrl(callbackUrl)
        }
        return result
      })()
      // Cache both in-flight and failed results. A retry needs a new flow instance;
      // repeated StrictMode/bootstrap calls cannot exchange a one-time code twice.
      return inFlight
    },
  }
}
