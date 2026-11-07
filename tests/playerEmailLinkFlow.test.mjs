import { describe, expect, it, vi } from 'vitest'
import { createPlayerEmailLinkFlow } from '../src/services/playerEmailLinkFlow.mjs'
import { createPlayerAuthController } from '../src/services/playerAuth.mjs'
const callbackUrl = 'https://game.example/auth/callback'
function setup() {
  const values = new Map()
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }
  let queue = Promise.resolve(), time = 1000
  const locks = { request: (_name, f) => { const result = queue.then(f); queue = result.catch(() => {}); return result } }
  let notify
  const session = { user: { id: 'user' }, access_token: `a.${btoa(JSON.stringify({ session_id: 'session' }))}.b` }
  const auth = { signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }), exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    onAuthStateChange: cb => { notify = cb; return { data: { subscription: { unsubscribe() {} } } } }, getSession: vi.fn() }
  const replaceUrl = vi.fn()
  const flow = (url = callbackUrl + '?code=test-code') => createPlayerEmailLinkFlow({ auth, callbackUrl, currentUrl: url, storage, locks, now: () => time, replaceUrl })
  return { auth, flow, session, replaceUrl, setTime: t => { time = t }, emit: (...args) => notify(...args) }
}
describe('email link PKCE flow', () => {
  it('supports a new tab with shared storage, verified SDK session and one-time cross-tab consumption', async () => {
    const s = setup(); await s.flow(callbackUrl).send('player@example.com')
    expect(s.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'player@example.com', options: { shouldCreateUser: true, emailRedirectTo: callbackUrl } })
    const [first, second] = await Promise.all([s.flow().complete(), s.flow().complete()])
    expect(first.data.session).toBe(s.session)
    expect(second.error.code).toBe('email_link_restart')
    expect(s.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
    expect(s.replaceUrl).toHaveBeenCalledWith(callbackUrl)
  })
  it('rejects missing intent and expired intent without exchanging', async () => {
    const s = setup(); expect((await s.flow().complete()).error.code).toBe('email_link_restart')
    await s.flow().send('player@example.com'); s.setTime(1000000)
    expect((await s.flow().complete()).error.code).toBe('email_link_restart')
    expect(s.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })
  it.each(['https://evil.example/auth/callback?code=x', 'https://game.example/wrong?code=x'])('ignores foreign routes %s', async url => {
    const s = setup(); await s.flow().send('player@example.com')
    expect(await s.flow(url).complete()).toBeNull()
    expect(s.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })
  it('rejects malformed callbacks and SDK PKCE failure without inventing sessions', async () => {
    const s = setup(); await s.flow().send('player@example.com')
    expect((await s.flow(callbackUrl + '?code=a&code=b').complete()).error.code).toBe('email_link_restart')
    s.auth.exchangeCodeForSession.mockResolvedValue({ error: { message: 'verifier missing' } })
    expect((await s.flow().complete()).error.code).toBe('email_link_restart')
  })
  it('classifies a verified callback as login even if initial session arrives first', async () => {
    const s = setup(); await s.flow().send('player@example.com')
    s.auth.exchangeCodeForSession.mockImplementation(async () => {
      s.emit('INITIAL_SESSION', s.session); s.emit('SIGNED_IN', s.session)
      return { data: { session: s.session }, error: null }
    })
    const controller = createPlayerAuthController({ auth: s.auth, verifiedOrigin: 'https://game.example', callbackUrl, emailLinkFlow: s.flow(), emailLinkConfigured: true })
    expect((await controller.bootstrap()).ok).toBe(true)
    expect(controller.getSnapshot().sessionOrigin).toBe('login')
    expect(s.auth.getSession).not.toHaveBeenCalled()
  })
  it('does not send without explicit link readiness', async () => {
    const s = setup(), controller = createPlayerAuthController({ auth: s.auth, verifiedOrigin: 'https://game.example', callbackUrl, emailLinkFlow: s.flow() })
    expect((await controller.requestEmailLink('player@example.com')).ok).toBe(false)
    expect(s.auth.signInWithOtp).not.toHaveBeenCalled()
  })
})
