export const PLAYER_EMAIL_LINK_INTENT_KEY = 'newtone-player-email-link-intent-v1'
const LOCK = 'newtone-player-email-link-v1'
const MAX_AGE = 10 * 60 * 1000
const failed = () => ({ error: { code: 'email_link_restart' } })

/** Intent is only a lifecycle fence. The Supabase SDK verifies the PKCE code. */
export function createPlayerEmailLinkFlow({ auth, callbackUrl, currentUrl, storage, locks, now = Date.now, replaceUrl = () => {} }) {
  const available = Boolean(storage?.getItem && storage?.setItem && storage?.removeItem && locks?.request && auth?.exchangeCodeForSession)
  let completion = null
  let completed = false
  return {
    available,
    send(email) {
      if (!available) return Promise.resolve(failed())
      return locks.request(LOCK, async () => {
        const raw = JSON.stringify({ version: 1, callbackUrl, createdAt: now() })
        storage.setItem(PLAYER_EMAIL_LINK_INTENT_KEY, raw)
        if (storage.getItem(PLAYER_EMAIL_LINK_INTENT_KEY) !== raw) return failed()
        try {
          const result = await auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: callbackUrl } })
          if (result?.error) storage.removeItem(PLAYER_EMAIL_LINK_INTENT_KEY)
          return result
        } catch (error) { storage.removeItem(PLAYER_EMAIL_LINK_INTENT_KEY); throw error }
      })
    },
    complete() {
      if (completed) return Promise.resolve(null)
      if (completion) return completion
      if (!currentUrl) return Promise.resolve(null)
      const actual = new URL(currentUrl), expected = new URL(callbackUrl)
      if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) return Promise.resolve(null)
      if (!actual.search && !actual.hash) return Promise.resolve(null)
      const codes = actual.searchParams.getAll('code')
      if (!available || actual.hash || codes.length !== 1 || !codes[0] || [...actual.searchParams.keys()].some(key => key !== 'code')) {
        replaceUrl(callbackUrl)
        return Promise.resolve(failed())
      }
      completion = locks.request(LOCK, async () => {
        try {
          let intent
          try { intent = JSON.parse(storage.getItem(PLAYER_EMAIL_LINK_INTENT_KEY)) } catch { return failed() }
          const age = now() - intent?.createdAt
          if (intent?.version !== 1 || intent.callbackUrl !== callbackUrl || !Number.isFinite(age) || age < 0 || age > MAX_AGE) return failed()
          // Consume before the exchange while holding a cross-tab Web Lock.
          // Failed/expired/reused links require a fresh explicit send, never guessed sessions.
          storage.removeItem(PLAYER_EMAIL_LINK_INTENT_KEY)
          const result = await auth.exchangeCodeForSession(codes[0])
          if (result?.error || !result?.data?.session?.user?.id || result.data.session.user.is_anonymous) return failed()
          completed = true
          return result
        } catch { return failed() }
        finally { replaceUrl(callbackUrl) }
      })
      return completion
    },
  }
}
