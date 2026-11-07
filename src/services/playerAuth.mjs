// UI-only authentication state. Never use it instead of server-side RLS.
const messages = {
  unavailable: 'Player authentication is not configured.',
  disposed: 'This authentication controller has been disposed.',
  busy: 'Wait for the current authentication request to finish.',
  cancelled: 'The request result was dismissed. An already sent request cannot be undone.',
  invalid_email: 'Enter a valid email address.',
  invalid_code: 'Enter the verification code from your email.',
  otp_not_configured: 'Email verification code delivery has not been confirmed configured.',
  otp_expired: 'The code is invalid or expired. Request a new code.',
  over_email_send_rate_limit: 'Too many emails requested. Please wait before trying again.',
  over_request_rate_limit: 'Too many requests. Please wait before trying again.',
  email_provider_disabled: 'Email sign-in is unavailable.',
  provider_disabled: 'Google sign-in is unavailable.',
  invalid_response: 'Authentication returned an incomplete response. Please try again.',
  auth_failed: 'Authentication failed. Please try again.',
}

function failure(code) {
  return { ok: false, error: Object.freeze({ code, message: messages[code] || messages.auth_failed }) }
}

function sessionIdentifier(session) {
  try {
    const payload = session?.access_token?.split('.')[1]
    if (payload) {
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
      if (typeof claims.session_id === 'string' && claims.session_id.length > 0) return claims.session_id
    }
  } catch { /* Unusable claims are not evidence of a new session. */ }
  return null
}

/** Validate a deployment-owned origin and exact allowlisted callback, not user input. */
export function validatePlayerAuthCallback(verifiedOrigin, callbackUrl) {
  let origin, callback
  try {
    origin = new URL(verifiedOrigin)
    callback = new URL(callbackUrl)
  } catch { throw new TypeError('An absolute verified origin and callback URL are required.') }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  if ((origin.protocol !== 'https:' && !(local && origin.protocol === 'http:')) ||
      origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      callback.origin !== origin.origin || callback.username || callback.password || callback.search || callback.hash) {
    throw new TypeError('The callback must use the verified origin, without credentials, query, or fragment.')
  }
  return callback.href
}

/**
 * Inject a dedicated player Supabase client.auth (never admin/service-role credentials).
 * No client creation, storage, navigation or network calls happen on construction.
 * otpEmailConfigured must only be true after verifying the {{ .Token }} email template.
 * subscribe/getSnapshot support useSyncExternalStore. Snapshots omit session tokens.
 */
export function createPlayerAuthController({ auth = null, verifiedOrigin, callbackUrl, otpEmailConfigured = false, oauthFlow = null } = {}) {
  const redirectTo = validatePlayerAuthCallback(verifiedOrigin, callbackUrl)
  let state = Object.freeze({ status: 'unknown', user: null, sessionEpoch: 0, sessionOrigin: 'signed_out', pending: null, email: null, error: null })
  let observedSessionId = null
  let disposed = false
  let generation = 0
  let sessionRevision = 0
  let otpRevision = 0
  let active = null
  let subscription = null
  const listeners = new Set()
  function publish(patch) {
    if (disposed) return
    state = Object.freeze({ ...state, ...patch })
    for (const listener of listeners) {
      // A consumer must not break SDK event delivery or another consumer.
      try { listener() } catch { /* consumer owns its rendering errors */ }
    }
  }
  function acceptSession(session, preserveOtpEmail = false, event = null) {
    const user = session?.user?.id && !session.user.is_anonymous
      ? Object.freeze({ id: session.user.id, email: session.user.email || null }) : null
    // Unverified JWT session_id is only a local lifecycle fence, never authorization.
    // Keep tokens/claims out of snapshots and compare only a private session identifier.
    const sessionId = sessionIdentifier(session)
    const identityChanged = (state.user?.id || null) !== (user?.id || null)
    const sessionChanged = event === 'SIGNED_IN' && observedSessionId !== null && sessionId !== null && observedSessionId !== sessionId
    const sessionEpoch = state.sessionEpoch + (identityChanged || sessionChanged ? 1 : 0)
    const sessionOrigin = !user ? 'signed_out'
      : event === 'LOGIN_VERIFIED' || (event === 'SIGNED_IN' && (identityChanged || sessionChanged)) ? 'login'
      : identityChanged || state.sessionOrigin === 'signed_out' ? 'restored' : state.sessionOrigin
    if (!user) observedSessionId = null
    else if (identityChanged || event === 'SIGNED_IN' || observedSessionId === null) observedSessionId = sessionId
    publish({ status: user ? 'authenticated' : 'signed_out', user, sessionEpoch, sessionOrigin, email: preserveOtpEmail ? state.email : null, error: null })
  }
  function listen() {
    if (subscription) return
    const result = auth.onAuthStateChange((event, session) => {
      if (disposed) return
      if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) return
      // Loading an empty initial session is not a new login/logout intent and
      // must not discard the code-entry email, even if initialization arrives late.
      const incomingUserId = session?.user?.id && !session.user.is_anonymous ? session.user.id : null
      const sameIdentity = incomingUserId === (state.user?.id || null)
      const preserveOtpEmail = sameIdentity && (
        (event === 'INITIAL_SESSION' && session === null) ||
        event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'
      )
      if (!preserveOtpEmail) otpRevision += 1
      sessionRevision += 1
      acceptSession(event === 'SIGNED_OUT' ? null : session, preserveOtpEmail, event)
    })
    subscription = result?.data?.subscription
    if (disposed) {
      subscription?.unsubscribe()
      subscription = null
      return
    }
    if (typeof subscription?.unsubscribe !== 'function') throw new Error('invalid_response')
  }
  function run(operation, invoke, apply) {
    if (disposed) return Promise.resolve(failure('disposed'))
    if (!auth) return Promise.resolve(failure('unavailable'))
    if (active) return Promise.resolve(failure('busy'))
    const ticket = ++generation
    const revision = sessionRevision
    // Reserve before notifying subscribers to guard reentrant clicks.
    active = ticket
    publish({ pending: operation, error: null })
    return (async () => {
      try {
        if (disposed || ticket !== generation) return failure('cancelled')
        listen()
        if (disposed || ticket !== generation) return failure('cancelled')
        const response = await invoke()
        if (disposed || ticket !== generation) return failure('cancelled')
        if (!response || response.error) throw response?.error || new Error('invalid_response')
        // An SDK event is more recent than any result captured by this request.
        const data = apply(response.data, revision === sessionRevision)
        return { ok: true, data }
      } catch (error) {
        if (disposed || ticket !== generation) return failure('cancelled')
        const code = Object.hasOwn(messages, error?.code) ? error.code : error?.message === 'invalid_response' ? 'invalid_response' : 'auth_failed'
        const result = failure(code)
        publish({ error: result.error })
        return result
      } finally {
        if (active === ticket) {
          active = null
          publish({ pending: null })
        }
      }
    })()
  }
  function sessionResult(data, current) {
    if (!data || !('session' in data)) throw new Error('invalid_response')
    if (current) acceptSession(data.session)
    return undefined
  }
  function acceptVerifiedSession(session, current) {
    if (current) acceptSession(session, false, 'LOGIN_VERIFIED')
    else if (state.user?.id === session.user.id && observedSessionId !== null && sessionIdentifier(session) === observedSessionId) {
      // INITIAL_SESSION may have hydrated this exact callback session first.
      // Never let an older result reclassify a newer same-user session.
      publish({ sessionOrigin: 'login' })
    }
  }
  return Object.freeze({
    getSnapshot: () => state,
    subscribe(listener) {
      if (disposed) return () => {}
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    bootstrap: () => {
      let callbackCompleted = false
      return run('bootstrap', async () => {
        const result = await oauthFlow?.complete()
        if (result) { callbackCompleted = true; return result }
        return auth.getSession()
      }, (data, current) => {
        if (!callbackCompleted) return sessionResult(data, current)
        if (!data?.session?.user?.id || data.session.user.is_anonymous) throw new Error('invalid_response')
        acceptVerifiedSession(data.session, current)
      })
    },
    refresh: () => run('refresh', () => auth.refreshSession(), sessionResult),
    requestEmailOtp(email) {
      if (disposed) return Promise.resolve(failure('disposed'))
      if (otpEmailConfigured !== true) return Promise.resolve(failure('otp_not_configured'))
      const normalized = typeof email === 'string' ? email.trim() : ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) return Promise.resolve(failure('invalid_email'))
      const requestedRevision = otpRevision
      return run('request_otp', () => auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: true } }), () => {
        if (requestedRevision === otpRevision && state.user === null) publish({ email: normalized })
      })
    },
    verifyEmailOtp(email, token) {
      if (disposed) return Promise.resolve(failure('disposed'))
      const normalized = typeof email === 'string' ? email.trim() : ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) return Promise.resolve(failure('invalid_email'))
      // Supabase deployments can configure a 6–10 digit code. Never coerce numbers (leading zeroes).
      if (typeof token !== 'string' || !/^\d{6,10}$/.test(token.trim())) return Promise.resolve(failure('invalid_code'))
      return run('verify_otp', () => auth.verifyOtp({ email: normalized, token: token.trim(), type: 'email' }), (data, current) => {
        if (!data?.session?.user?.id || data.session.user.is_anonymous) throw new Error('invalid_response')
        acceptVerifiedSession(data.session, current)
        publish({ email: null })
      })
    },
    beginGoogleOAuth: () => run('google_oauth', () => auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } }), (data) => {
      let url
      try { url = new URL(data?.url) } catch { throw new Error('invalid_response') }
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid_response')
      oauthFlow?.prepare()
      return Object.freeze({ url: url.href })
    }),
    logout: () => run('logout', () => auth.signOut({ scope: 'local' }), (_data, current) => {
      if (current) acceptSession(null)
    }),
    // Dismisses results only. Keep the request lock until SDK completion; do not pretend
    // to abort an email or session mutation. Real SDK session events remain authoritative.
    cancel() {
      if (disposed) return
      generation += 1
      publish({ email: null, error: null })
    },
    dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      listeners.clear()
      subscription?.unsubscribe()
      subscription = null
    },
  })
}
