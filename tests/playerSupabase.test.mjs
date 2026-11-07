import { describe, expect, it, vi } from 'vitest'
import { createPlayerSupabase, PLAYER_AUTH_STORAGE_KEY } from '../src/lib/playerSupabase.js'

const env = {
  VITE_PLAYER_ACCOUNTS_ENABLED: 'true', VITE_PLAYER_OTP_CONFIGURED: 'true',
  VITE_PLAYER_AUTH_ORIGIN: 'https://game.example', VITE_PLAYER_AUTH_CALLBACK_URL: 'https://game.example/auth/callback',
  VITE_PLAYER_SUPABASE_URL: 'https://project.example', VITE_PLAYER_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_placeholder',
}
function setup(overrides = {}, currentOrigin = 'https://game.example') {
  const createClientImpl = vi.fn().mockReturnValue({ auth: {} })
  const result = createPlayerSupabase({ env: { ...env, ...overrides }, currentOrigin, createClientImpl })
  return { result, createClientImpl }
}
describe('dedicated gated player client factory', () => {
  it('constructs only an explicitly ready deployment with distinct storage and PKCE', () => {
    const { result, createClientImpl } = setup()
    expect(result.enabled).toBe(true)
    expect(createClientImpl).toHaveBeenCalledWith('https://project.example', env.VITE_PLAYER_SUPABASE_PUBLISHABLE_KEY, {
      db: { schema: 'public' }, auth: { storageKey: PLAYER_AUTH_STORAGE_KEY, flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
    expect(result.callbackUrl).toBe(env.VITE_PLAYER_AUTH_CALLBACK_URL)
  })
  it.each([undefined, false, true, 'false', 'TRUE'])('does not construct a client for non-exact enabled flag %s', flag => {
    const s = setup({ VITE_PLAYER_ACCOUNTS_ENABLED: flag })
    expect(s.result.enabled).toBe(false)
    expect(s.createClientImpl).not.toHaveBeenCalled()
  })
  it('does not use shared admin environment fallback', () => {
    for (const overrides of [{ VITE_PLAYER_SUPABASE_URL: undefined, VITE_SUPABASE_URL: 'https://admin.example' }]) {
      const s = setup(overrides)
      expect(s.result.enabled).toBe(false)
      expect(s.createClientImpl).not.toHaveBeenCalled()
    }
  })
  it.each([undefined, false, true, 'false', 'TRUE'])('keeps configured shell available but OTP disabled for %s', flag => {
    const s = setup({ VITE_PLAYER_OTP_CONFIGURED: flag })
    expect(s.result.enabled).toBe(true)
    expect(s.result.otpReady).toBe(false)
    expect(s.createClientImpl).toHaveBeenCalledTimes(1)
  })
  it.each(['https://other.example', 'https://game.example/unsafe', undefined])('rejects unverified current origin %s', currentOrigin => {
    const createClientImpl = vi.fn()
    expect(createPlayerSupabase({ env, currentOrigin, createClientImpl }).enabled).toBe(false)
    expect(createClientImpl).not.toHaveBeenCalled()
  })
  it.each(['https://evil.example/auth', 'javascript:alert(1)', 'https://game.example/auth?next=evil'])('rejects unsafe callback %s', callback => {
    const s = setup({ VITE_PLAYER_AUTH_CALLBACK_URL: callback })
    expect(s.result.enabled).toBe(false)
    expect(s.createClientImpl).not.toHaveBeenCalled()
  })
  it.each(['sb_secret_never_use', 'eyJhbGciOi.placeholder', '', undefined])('rejects non-publishable credentials', key => {
    const s = setup({ VITE_PLAYER_SUPABASE_PUBLISHABLE_KEY: key })
    expect(s.result.enabled).toBe(false)
    expect(s.createClientImpl).not.toHaveBeenCalled()
    expect(JSON.stringify(s.result)).not.toContain('sb_secret')
  })
  it.each(['http://project.example', 'https://user:password@project.example', 'https://project.example/path'])('rejects unsafe project URL %s', url => {
    const s = setup({ VITE_PLAYER_SUPABASE_URL: url })
    expect(s.result.enabled).toBe(false)
    expect(s.createClientImpl).not.toHaveBeenCalled()
  })
  it('enables explicit link mode independently of the numeric OTP template', () => {
    const auth = { exchangeCodeForSession: vi.fn() }
    const result = createPlayerSupabase({ env: { ...env, VITE_PLAYER_EMAIL_MODE: 'link', VITE_PLAYER_EMAIL_LINK_CONFIGURED: 'true', VITE_PLAYER_OTP_CONFIGURED: 'false' },
      currentOrigin: 'https://game.example', createClientImpl: () => ({ auth }),
      emailStorage: { getItem() {}, setItem() {}, removeItem() {} }, locks: { request() {} } })
    expect(result.enabled).toBe(true)
    expect(result.emailMode).toBe('link')
    expect(result.linkReady).toBe(true)
    expect(result.otpReady).toBe(false)
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })
  it.each([undefined, false, true, 'false', 'TRUE'])('requires exact verified link configuration flag %s', flag => {
    const result = createPlayerSupabase({ env: { ...env, VITE_PLAYER_EMAIL_MODE: 'link', VITE_PLAYER_EMAIL_LINK_CONFIGURED: flag },
      currentOrigin: 'https://game.example', createClientImpl: () => ({ auth: { exchangeCodeForSession() {} } }),
      emailStorage: { getItem() {}, setItem() {}, removeItem() {} }, locks: { request() {} } })
    expect(result.enabled).toBe(true)
    expect(result.emailMode).toBe('link')
    expect(result.linkReady).toBe(false)
  })
  it('contains initialization errors without exposing credentials', () => {
    const result = createPlayerSupabase({ env, currentOrigin: 'https://game.example', createClientImpl: () => { throw new Error('raw credential') } })
    expect(result.error.code).toBe('player_client_initialization_failed')
    expect(JSON.stringify(result)).not.toContain('raw credential')
  })
})
