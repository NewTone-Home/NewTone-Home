import { describe, expect, it, vi } from 'vitest'
import { createPlayerOAuthFlow, PLAYER_OAUTH_INTENT_KEY } from '../src/services/playerOAuthFlow.mjs'
import { createPlayerAuthController } from '../src/services/playerAuth.mjs'

const callbackUrl = 'https://game.example/auth/callback'
function setup(currentUrl = `${callbackUrl}?code=test-code`) {
  const values = new Map(), storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key) }
  const session = { user: { id: 'test-user' }, access_token: `a.${btoa(JSON.stringify({ session_id: 'test-session' }))}.b` }
  let notify
  const auth = { exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }), onAuthStateChange: cb => { notify = cb; return { data: { subscription: { unsubscribe() {} } } } },
  }
  const replaceUrl = vi.fn(), flow = createPlayerOAuthFlow({ auth, callbackUrl, currentUrl, storage, now: () => 1000, replaceUrl })
  return { auth, flow, storage, replaceUrl, session, emit: (...args) => notify(...args) }
}
describe('explicit OAuth callback proof', () => {
  it('does not exchange a callback without explicit same-tab intent', async () => {
    const s = setup()
    expect(await s.flow.complete()).toBeNull()
    expect(s.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })
  it('exchanges through SDK, consumes successful intent and cleans the URL once', async () => {
    const s = setup(); s.flow.prepare()
    const [first, second] = await Promise.all([s.flow.complete(), s.flow.complete()])
    expect(first.data.session).toBe(s.session)
    expect(second.data.session).toBe(s.session)
    expect(s.auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith('test-code')
    expect(s.storage.getItem(PLAYER_OAUTH_INTENT_KEY)).toBeNull()
    expect(s.replaceUrl).toHaveBeenCalledExactlyOnceWith(callbackUrl)
    expect(await s.flow.complete()).toBeNull()
  })
  it.each(['https://evil.example/auth/callback?code=x', 'https://game.example/other?code=x', `${callbackUrl}?code=x&code=y`, `${callbackUrl}?error=denied`, `${callbackUrl}?code=x#token`])('rejects unmatched callback %s', async currentUrl => {
    const s = setup(currentUrl); s.flow.prepare()
    expect(await s.flow.complete()).toBeNull()
    expect(s.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })
  it('rejects expired or future intent', async () => {
    for (const createdAt of [-1000000, 2000]) {
      const s = setup()
      s.storage.setItem(PLAYER_OAUTH_INTENT_KEY, JSON.stringify({ version: 1, callbackUrl, createdAt }))
      expect(await s.flow.complete()).toBeNull()
    }
  })
  it('never marks failed exchange complete or repeatedly exchanges during bootstrap', async () => {
    const s = setup(); s.flow.prepare()
    const error = { message: 'SDK rejected code' }
    s.auth.exchangeCodeForSession.mockResolvedValue({ error })
    expect((await s.flow.complete()).error).toBe(error)
    await s.flow.complete()
    expect(s.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
    expect(s.storage.getItem(PLAYER_OAUTH_INTENT_KEY)).not.toBeNull()
    expect(s.replaceUrl).not.toHaveBeenCalled()
  })
  it('marks verified callback login even when INITIAL_SESSION with same session arrives first', async () => {
    const s = setup(); s.flow.prepare()
    s.auth.onAuthStateChange = cb => { cb('INITIAL_SESSION', s.session); return { data: { subscription: { unsubscribe() {} } } } }
    const controller = createPlayerAuthController({ auth: s.auth, verifiedOrigin: 'https://game.example', callbackUrl, oauthFlow: s.flow })
    expect((await controller.bootstrap()).ok).toBe(true)
    expect(controller.getSnapshot().sessionOrigin).toBe('login')
    expect(s.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
  })
  it('keeps callback without intent restored, never guessed login', async () => {
    const s = setup()
    const controller = createPlayerAuthController({ auth: s.auth, verifiedOrigin: 'https://game.example', callbackUrl, oauthFlow: s.flow })
    await controller.bootstrap()
    expect(controller.getSnapshot().sessionOrigin).toBe('restored')
  })
  it('never lets an old verified callback reclassify a newer same-user restored session', async () => {
    const s = setup(); s.flow.prepare()
    let finish
    s.auth.exchangeCodeForSession.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const controller = createPlayerAuthController({ auth: s.auth, verifiedOrigin: 'https://game.example', callbackUrl, oauthFlow: s.flow })
    const result = controller.bootstrap()
    await Promise.resolve()
    s.emit('INITIAL_SESSION', { ...s.session, user: { id: 'test-user', email: 'new@example.com' }, access_token: `a.${btoa(JSON.stringify({ session_id: 'newer-session' }))}.b` })
    finish({ data: { session: s.session }, error: null })
    await result
    expect(controller.getSnapshot()).toMatchObject({ sessionOrigin: 'restored', user: { email: 'new@example.com' } })
  })
})
