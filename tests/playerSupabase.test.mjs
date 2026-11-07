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
  it('requires explicit OTP setup and does not use shared admin environment fallback', () => {
    for (const overrides of [{ VITE_PLAYER_OTP_CONFIGURED: 'false' }, { VITE_PLAYER_SUPABASE_URL: undefined, VITE_SUPABASE_URL: 'https://admin.example' }]) {
      const s = setup(overrides)
      expect(s.result.enabled).toBe(false)
      expect(s.createClientImpl).not.toHaveBeenCalled()
    }
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
  it('contains initialization errors without exposing credentials', () => {
    const result = createPlayerSupabase({ env, currentOrigin: 'https://game.example', createClientImpl: () => { throw new Error('raw credential') } })
    expect(result.error.code).toBe('player_client_initialization_failed')
    expect(JSON.stringify(result)).not.toContain('raw credential')
  })
})
