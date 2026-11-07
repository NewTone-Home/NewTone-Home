import { describe, expect, it, vi } from 'vitest'
import { createPlayerAuthController, validatePlayerAuthCallback } from '../src/services/playerAuth.mjs'

const config = { verifiedOrigin: 'https://game.example', callbackUrl: 'https://game.example/auth/callback', otpEmailConfigured: true }
const session = (id = 'player-1') => ({ access_token: 'not-exposed', refresh_token: 'not-exposed', user: { id, email: 'player@example.com' } })
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function setup(overrides = {}, options = {}) {
  let callback
  const unsubscribe = vi.fn()
  const auth = {
    onAuthStateChange: vi.fn((cb) => { callback = cb; return { data: { subscription: { unsubscribe } } } }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: session() }, error: null }),
    signInWithOtp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { session: session() }, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: 'https://auth.example/authorize' }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  }
  const controller = createPlayerAuthController({ ...config, auth, ...options })
  return { auth, controller, unsubscribe, emit: (...args) => callback(...args) }
}

describe('player authentication foundation', () => {
  it('distinguishes restored sessions from actual login and preserves origin across routine events', async () => {
    const existing = { ...session(), access_token: `header.${btoa(JSON.stringify({ session_id: 'restored-id' }))}.sig` }
    const { controller, emit } = setup({ getSession: vi.fn().mockResolvedValue({ data: { session: existing } }) })
    await controller.bootstrap()
    expect(controller.getSnapshot().sessionOrigin).toBe('restored')
    emit('SIGNED_IN', existing)
    emit('TOKEN_REFRESHED', existing)
    emit('USER_UPDATED', existing)
    expect(controller.getSnapshot().sessionOrigin).toBe('restored')
    const next = { ...existing, access_token: `header.${btoa(JSON.stringify({ session_id: 'new-id' }))}.sig` }
    emit('SIGNED_IN', next)
    expect(controller.getSnapshot().sessionOrigin).toBe('login')
    emit('TOKEN_REFRESHED', next)
    await controller.bootstrap()
    expect(controller.getSnapshot().sessionOrigin).toBe('login')
    emit('SIGNED_OUT', null)
    expect(controller.getSnapshot().sessionOrigin).toBe('signed_out')
  })
  it('marks successful OTP verification as login and never overwrites a newer login with bootstrap', async () => {
    const s = setup()
    await s.controller.verifyEmailOtp('a@b.com', '012345')
    expect(s.controller.getSnapshot().sessionOrigin).toBe('login')
    const wait = deferred()
    const t = setup({ getSession: vi.fn().mockReturnValue(wait.promise) })
    const loading = t.controller.bootstrap()
    t.emit('SIGNED_IN', session('new-user'))
    wait.resolve({ data: { session: session('old-user') } })
    await loading
    expect(t.controller.getSnapshot()).toMatchObject({ sessionOrigin: 'login', user: { id: 'new-user' } })
  })
  it('fences real session changes without exposing tokens or session identifiers', async () => {
    const { controller, emit } = setup()
    await controller.bootstrap()
    const withId = (id, tokenVersion = 'a') => ({ ...session(), access_token: `header.${btoa(JSON.stringify({ session_id: id }))}.${tokenVersion}` })
    emit('SIGNED_IN', withId('private-session-a'))
    const first = controller.getSnapshot().sessionEpoch
    expect(first).toBeGreaterThan(0)
    emit('TOKEN_REFRESHED', withId('private-session-a', 'b'))
    emit('USER_UPDATED', withId('private-session-a', 'b'))
    emit('SIGNED_IN', withId('private-session-a', 'b'))
    expect(controller.getSnapshot().sessionEpoch).toBe(first)
    emit('SIGNED_IN', withId('private-session-b'))
    expect(controller.getSnapshot().sessionEpoch).toBe(first + 1)
    emit('SIGNED_OUT', null)
    emit('SIGNED_IN', withId('private-session-b'))
    expect(controller.getSnapshot().sessionEpoch).toBe(first + 3)
    expect(JSON.stringify(controller.getSnapshot())).not.toContain('private-session')
  })
  it('requires a verified same-origin absolute callback', () => {
    for (const callback of ['//evil.example', 'https://evil.example/callback', 'javascript:alert(1)', 'https://game.example/cb?next=x', 'https://game.example/cb#x', 'https://me:pass@game.example/cb']) {
      expect(() => validatePlayerAuthCallback(config.verifiedOrigin, callback)).toThrow()
    }
    expect(() => createPlayerAuthController()).toThrow()
    expect(() => validatePlayerAuthCallback('http://game.example', 'http://game.example/cb')).toThrow()
    expect(validatePlayerAuthCallback('http://localhost:5173', 'http://localhost:5173/cb')).toBe('http://localhost:5173/cb')
  })
  it('does nothing at construction and reports missing configuration', async () => {
    const { auth } = setup()
    expect(auth.onAuthStateChange).not.toHaveBeenCalled()
    const controller = createPlayerAuthController(config)
    expect((await controller.bootstrap()).error.code).toBe('unavailable')
  })
  it('fails closed until code email delivery is confirmed configured', async () => {
    const { controller, auth } = setup({}, { otpEmailConfigured: false })
    expect((await controller.requestEmailOtp('a@b.com')).error.code).toBe('otp_not_configured')
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })
  it('requests code sign-in/signup without password or magic-link redirect options', async () => {
    const { controller, auth } = setup()
    expect((await controller.requestEmailOtp('  player@example.com  ')).ok).toBe(true)
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'player@example.com', options: { shouldCreateUser: true } })
    expect(controller.getSnapshot().email).toBe('player@example.com')
    expect(controller.getSnapshot().user).toBeNull()
  })
  it('validates input before calling SDK and preserves leading zeroes', async () => {
    const { controller, auth } = setup()
    expect((await controller.requestEmailOtp('bad')).error.code).toBe('invalid_email')
    expect((await controller.verifyEmailOtp('bad', '012345')).error.code).toBe('invalid_email')
    for (const code of [123456, '', '123', '12345x', '12345678901']) {
      expect((await controller.verifyEmailOtp('a@b.com', code)).error.code).toBe('invalid_code')
    }
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    await controller.verifyEmailOtp('a@b.com', ' 012345 ')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '012345', type: 'email' })
    expect(controller.getSnapshot()).toMatchObject({ status: 'authenticated', user: { id: 'player-1' }, pending: null })
    expect(JSON.stringify(controller.getSnapshot())).not.toContain('not-exposed')
  })
  it('preserves code-entry email when empty initialization arrives during or after OTP delivery', async () => {
    for (const duringRequest of [true, false]) {
      const wait = deferred()
      const { controller, emit } = setup({ signInWithOtp: vi.fn().mockReturnValue(wait.promise) })
      const first = controller.requestEmailOtp('a@b.com')
      if (duringRequest) emit('INITIAL_SESSION', null)
      wait.resolve({ error: null })
      expect((await first).ok).toBe(true)
      if (!duringRequest) emit('INITIAL_SESSION', null)
      expect(controller.getSnapshot()).toMatchObject({ status: 'signed_out', email: 'a@b.com', pending: null })
    }
  })
  it('does not restore OTP email after a real sign-out or account change', async () => {
    for (const [event, value] of [['SIGNED_OUT', null], ['SIGNED_IN', session()], ['INITIAL_SESSION', session()]]) {
      const wait = deferred()
      const { controller, emit } = setup({ signInWithOtp: vi.fn().mockReturnValue(wait.promise) })
      const first = controller.requestEmailOtp('a@b.com')
      emit(event, value)
      wait.resolve({ error: null })
      await first
      expect(controller.getSnapshot().email).toBeNull()
      expect(controller.getSnapshot().user?.id || null).toBe(value?.user.id || null)
    }
  })
  it('preserves OTP email across same-identity refresh/update during and after delivery', async () => {
    for (const event of ['TOKEN_REFRESHED', 'USER_UPDATED']) {
      const wait = deferred()
      const { controller, emit } = setup({ signInWithOtp: vi.fn().mockReturnValue(wait.promise) })
      const first = controller.requestEmailOtp('a@b.com')
      emit(event, null)
      wait.resolve({ error: null })
      await first
      expect(controller.getSnapshot().email).toBe('a@b.com')
      emit(event, null)
      expect(controller.getSnapshot().email).toBe('a@b.com')
      emit(event, session('changed-account'))
      expect(controller.getSnapshot().email).toBeNull()
    }
  })
  it('clears delivered OTP email on successful verification', async () => {
    const { controller } = setup()
    await controller.requestEmailOtp('a@b.com')
    expect(controller.getSnapshot().email).toBe('a@b.com')
    await controller.verifyEmailOtp('a@b.com', '012345')
    expect(controller.getSnapshot().email).toBeNull()
  })
  it.each(['cancel', 'dispose'])('does not dispatch when pending subscriber calls %s', async (action) => {
    const { controller, auth } = setup()
    let handled = false
    controller.subscribe(() => {
      if (controller.getSnapshot().pending && !handled) {
        handled = true
        controller[action]()
      }
    })
    expect((await controller.requestEmailOtp('a@b.com')).error.code).toBe('cancelled')
    expect(auth.onAuthStateChange).not.toHaveBeenCalled()
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })
  it.each(['cancel', 'dispose'])('does not dispatch when initial-event subscriber calls %s', async (action) => {
    const { controller, auth, unsubscribe } = setup()
    auth.onAuthStateChange.mockImplementationOnce((callback) => {
      callback('INITIAL_SESSION', null)
      return { data: { subscription: { unsubscribe } } }
    })
    let handled = false
    controller.subscribe(() => {
      if (controller.getSnapshot().status === 'signed_out' && !handled) {
        handled = true
        controller[action]()
      }
    })
    expect((await controller.requestEmailOtp('a@b.com')).error.code).toBe('cancelled')
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
    if (action === 'dispose') expect(unsubscribe).toHaveBeenCalledTimes(1)
    controller.dispose()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
  it('initiates only Google OAuth and returns URL without automatic navigation', async () => {
    const { controller, auth } = setup()
    expect(await controller.beginGoogleOAuth()).toEqual({ ok: true, data: { url: 'https://auth.example/authorize' } })
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: config.callbackUrl, skipBrowserRedirect: true } })
    expect(controller.getSnapshot().status).toBe('unknown')
  })
  it.each(['javascript:alert(1)', 'http://evil.example', 'https://user:pass@auth.example'])('rejects unsafe OAuth response %s', async (url) => {
    const { controller } = setup({ signInWithOAuth: vi.fn().mockResolvedValue({ data: { url } }) })
    expect((await controller.beginGoogleOAuth()).error.code).toBe('invalid_response')
  })
  it('bootstraps once per request, refreshes and unsubscribes once', async () => {
    const { controller, auth, unsubscribe, emit } = setup()
    await controller.bootstrap()
    expect(controller.getSnapshot().status).toBe('signed_out')
    await controller.refresh()
    expect(controller.getSnapshot().status).toBe('authenticated')
    emit('TOKEN_REFRESHED', session('player-2'))
    expect(controller.getSnapshot().user.id).toBe('player-2')
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1)
    controller.dispose(); controller.dispose()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    emit('SIGNED_OUT', null)
    expect(controller.getSnapshot().user.id).toBe('player-2')
    expect((await controller.refresh()).error.code).toBe('disposed')
  })
  it('rejects overlapping/reentrant clicks instead of duplicating requests', async () => {
    const wait = deferred()
    const { controller, auth } = setup({ signInWithOtp: vi.fn().mockReturnValue(wait.promise) })
    const first = controller.requestEmailOtp('a@b.com')
    expect((await controller.requestEmailOtp('a@b.com')).error.code).toBe('busy')
    expect((await controller.logout()).error.code).toBe('busy')
    expect(auth.signInWithOtp).toHaveBeenCalledTimes(1)
    wait.resolve({ error: null })
    expect((await first).ok).toBe(true)
  })
  it('dismisses stale results but retains lock until physical request settles', async () => {
    const wait = deferred()
    const { controller } = setup({ signInWithOtp: vi.fn().mockReturnValue(wait.promise) })
    const first = controller.requestEmailOtp('a@b.com')
    controller.cancel()
    expect(controller.getSnapshot().pending).toBe('request_otp')
    expect((await controller.requestEmailOtp('c@d.com')).error.code).toBe('busy')
    wait.resolve({ error: null })
    expect((await first).error.code).toBe('cancelled')
    expect(controller.getSnapshot()).toMatchObject({ pending: null, email: null, error: null })
  })
  it('retains real session events after cancel, without pretending to undo login', async () => {
    const wait = deferred()
    const { controller, emit } = setup({ verifyOtp: vi.fn().mockReturnValue(wait.promise) })
    const first = controller.verifyEmailOtp('a@b.com', '012345')
    controller.cancel()
    emit('SIGNED_IN', session())
    wait.resolve({ data: { session: session() } })
    expect((await first).error.code).toBe('cancelled')
    expect(controller.getSnapshot().status).toBe('authenticated')
  })
  it('never lets an outdated bootstrap or refresh overwrite a newer sign-out', async () => {
    for (const method of ['bootstrap', 'refresh']) {
      const wait = deferred()
      const { controller, emit } = setup({ getSession: vi.fn().mockReturnValue(wait.promise), refreshSession: vi.fn().mockReturnValue(wait.promise) })
      const first = controller[method]()
      emit('SIGNED_OUT', null)
      wait.resolve({ data: { session: session() }, error: null })
      await first
      expect(controller.getSnapshot().status).toBe('signed_out')
    }
  })
  it('ignores pending response and stops notifications after dispose', async () => {
    const wait = deferred()
    const { controller } = setup({ getSession: vi.fn().mockReturnValue(wait.promise) })
    const listener = vi.fn()
    controller.subscribe(listener)
    const first = controller.bootstrap()
    controller.dispose()
    const count = listener.mock.calls.length
    wait.resolve({ data: { session: session() } })
    expect((await first).error.code).toBe('cancelled')
    expect(listener).toHaveBeenCalledTimes(count)
  })
  it('logs out only this device and preserves identity on SDK failure', async () => {
    const { controller, auth } = setup()
    await controller.refresh()
    auth.signOut.mockResolvedValueOnce({ error: { message: 'private details' } })
    expect((await controller.logout()).ok).toBe(false)
    expect(controller.getSnapshot().user.id).toBe('player-1')
    expect(JSON.stringify(controller.getSnapshot())).not.toContain('private details')
    await controller.logout()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(controller.getSnapshot().status).toBe('signed_out')
  })
  it('maps code expiry and rate limits without exposing provider payloads', async () => {
    const { controller, auth } = setup()
    auth.verifyOtp.mockResolvedValueOnce({ error: { code: 'otp_expired', message: 'raw secret' } })
    expect((await controller.verifyEmailOtp('a@b.com', '012345')).error.code).toBe('otp_expired')
    auth.signInWithOtp.mockRejectedValueOnce({ code: 'over_email_send_rate_limit' })
    expect((await controller.requestEmailOtp('a@b.com')).error.code).toBe('over_email_send_rate_limit')
    expect(controller.getSnapshot().pending).toBeNull()
    expect((await controller.requestEmailOtp('a@b.com')).ok).toBe(true)
    expect(controller.getSnapshot().error).toBeNull()
  })
  it('requires a nonanonymous session after verification', async () => {
    const { controller, auth } = setup()
    for (const value of [null, { user: { id: 'anon', is_anonymous: true } }]) {
      auth.verifyOtp.mockResolvedValueOnce({ data: { session: value } })
      expect((await controller.verifyEmailOtp('a@b.com', '012345')).error.code).toBe('invalid_response')
    }
  })
  it('preserves a newer account event over an old verification result', async () => {
    const wait = deferred()
    const { controller, emit } = setup({ verifyOtp: vi.fn().mockReturnValue(wait.promise) })
    const first = controller.verifyEmailOtp('a@b.com', '012345')
    emit('SIGNED_IN', session('newer-player'))
    wait.resolve({ data: { session: session('older-player') } })
    await first
    expect(controller.getSnapshot().user.id).toBe('newer-player')
  })
  it('survives setup failure and allows retry without a stuck request lock', async () => {
    const { controller, auth } = setup()
    auth.onAuthStateChange.mockImplementationOnce(() => { throw new Error('adapter failure') })
    expect((await controller.bootstrap()).error.code).toBe('auth_failed')
    expect(controller.getSnapshot().pending).toBeNull()
    expect((await controller.bootstrap()).ok).toBe(true)
  })
  it('keeps disposed snapshots and rejects all future write entry points', async () => {
    const { controller, auth } = setup()
    controller.dispose()
    expect((await controller.requestEmailOtp('a@b.com')).error.code).toBe('disposed')
    expect((await controller.verifyEmailOtp('a@b.com', '012345')).error.code).toBe('disposed')
    expect((await controller.beginGoogleOAuth()).error.code).toBe('disposed')
    expect((await controller.logout()).error.code).toBe('disposed')
    expect(auth.onAuthStateChange).not.toHaveBeenCalled()
  })
  it('keeps snapshots stable between changes and isolates broken subscribers', async () => {
    const { controller } = setup()
    const before = controller.getSnapshot()
    expect(controller.getSnapshot()).toBe(before)
    controller.subscribe(() => { throw new Error('render') })
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    await controller.bootstrap()
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    const count = listener.mock.calls.length
    await controller.refresh()
    expect(listener).toHaveBeenCalledTimes(count)
  })
})
