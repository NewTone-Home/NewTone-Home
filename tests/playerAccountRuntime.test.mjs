import { describe, expect, it, vi } from 'vitest'
import { createPlayerAccountRuntime } from '../src/services/playerAccountRuntime.js'

function setup(env = {}) {
  let snapshot = { status: 'signed_out' }
  const client = { auth: { stopAutoRefresh: vi.fn().mockResolvedValue(undefined) }, rpc: vi.fn() }
  const auth = { getSnapshot: () => snapshot, dispose: vi.fn() }
  const coordinator = { dispose: vi.fn().mockResolvedValue(undefined) }
  const options = { env: { VITE_PLAYER_ACCOUNTS_ENABLED: 'true', VITE_PLAYER_CLOUD_CONFIGURED: 'true', ...env }, currentOrigin: 'https://game.example',
    storage: {}, locks: { request: vi.fn() },
    makeClient: vi.fn().mockReturnValue({ enabled: true, client, verifiedOrigin: 'https://game.example', callbackUrl: 'https://game.example/callback', otpReady: true }),
    makeAuth: vi.fn().mockReturnValue(auth), makeBackend: vi.fn().mockReturnValue({}), makeCoordinator: vi.fn().mockReturnValue(coordinator),
  }
  return { options, client, auth, coordinator, setSnapshot: value => { snapshot = value } }
}
describe('explicit player runtime composition', () => {
  it.each([{ VITE_PLAYER_ACCOUNTS_ENABLED: 'false' }, { VITE_PLAYER_CLOUD_CONFIGURED: 'false' }, { VITE_PLAYER_CLOUD_CONFIGURED: true }])('never constructs client without both exact flags: %o', flags => {
    const s = setup(flags)
    expect(createPlayerAccountRuntime(s.options).enabled).toBe(false)
    expect(s.options.makeClient).not.toHaveBeenCalled()
    expect(s.options.makeCoordinator).not.toHaveBeenCalled()
  })
  it('retains original App fallback when client readiness is blocked', () => {
    const s = setup()
    s.options.makeClient.mockReturnValue({ enabled: false, client: null })
    expect(createPlayerAccountRuntime(s.options).enabled).toBe(false)
    expect(s.options.makeAuth).not.toHaveBeenCalled()
  })
  it('assembles only injected factories and does not bootstrap or authenticate', () => {
    const s = setup(), runtime = createPlayerAccountRuntime(s.options)
    expect(runtime.enabled).toBe(true)
    expect(s.options.makeAuth).toHaveBeenCalledWith({ auth: s.client.auth, verifiedOrigin: 'https://game.example', callbackUrl: 'https://game.example/callback', otpEmailConfigured: true, oauthFlow: undefined, emailLinkFlow: undefined, emailLinkConfigured: false })
    const backendOptions = s.options.makeBackend.mock.calls[0][0]
    expect(backendOptions.getIdentity()).toBeNull()
    s.setSnapshot({ status: 'authenticated', user: { id: 'verified-user' }, sessionEpoch: 7 })
    expect(backendOptions.getIdentity()).toEqual({ ownerId: 'verified-user', sessionEpoch: 7 })
    backendOptions.rpc('mock_rpc', { test: true })
    expect(s.client.rpc).toHaveBeenCalledWith('mock_rpc', { test: true })
    expect(runtime.googleReady).toBe(false)
  })
  it('exposes the shell with email and Google unavailable while OTP setup is pending', () => {
    const s = setup({ VITE_PLAYER_GOOGLE_CONFIGURED: 'true' })
    const configured = s.options.makeClient.getMockImplementation()()
    s.options.makeClient.mockReturnValue({ ...configured, otpReady: false, oauthFlow: { available: true } })
    const runtime = createPlayerAccountRuntime(s.options)
    expect(runtime.enabled).toBe(true)
    expect(runtime.otpReady).toBe(false)
    expect(runtime.googleReady).toBe(false)
    expect(s.options.makeAuth.mock.calls[0][0].otpEmailConfigured).toBe(false)
    expect(s.options.makeCoordinator).toHaveBeenCalledTimes(1)
    expect(s.client.rpc).not.toHaveBeenCalled()
  })
  it('never offers Google alongside email-link callback routing', () => {
    const s = setup({ VITE_PLAYER_GOOGLE_CONFIGURED: 'true' })
    const configured = s.options.makeClient.getMockImplementation()()
    s.options.makeClient.mockReturnValue({ ...configured, emailMode: 'link', otpReady: true, linkReady: true, oauthFlow: { available: true } })
    const runtime = createPlayerAccountRuntime(s.options)
    expect(runtime.enabled).toBe(true)
    expect(runtime.linkReady).toBe(true)
    expect(runtime.googleReady).toBe(false)
  })
  it('disposes resources once without signing out or deleting saved credentials', async () => {
    const s = setup(), runtime = createPlayerAccountRuntime(s.options)
    await runtime.dispose(); await runtime.dispose()
    expect(s.coordinator.dispose).toHaveBeenCalledTimes(1)
    expect(s.auth.dispose).toHaveBeenCalledTimes(1)
    expect(s.client.auth.stopAutoRefresh).toHaveBeenCalledTimes(1)
  })
  it('cleans up auth/client if assembly fails and safely falls back', async () => {
    const s = setup()
    s.options.makeCoordinator.mockImplementation(() => { throw new Error('internal details') })
    const result = createPlayerAccountRuntime(s.options)
    expect(result.enabled).toBe(false)
    expect(JSON.stringify(result)).not.toContain('internal details')
    expect(s.auth.dispose).toHaveBeenCalledTimes(1)
    expect(s.client.auth.stopAutoRefresh).toHaveBeenCalledTimes(1)
  })
})
