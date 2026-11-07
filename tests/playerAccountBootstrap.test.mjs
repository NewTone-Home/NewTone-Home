import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createPlayerAccountRuntimeCache, loadPlayerAccountModule, playerAccountsRequested } from '../src/components/player/playerAccountBootstrapState.mjs'
import PlayerAccountBootstrap, { PlayerAccountBootstrapView } from '../src/components/player/PlayerAccountBootstrap.jsx'

const env = { VITE_PLAYER_ACCOUNTS_ENABLED: 'true', VITE_PLAYER_CLOUD_CONFIGURED: 'true' }
describe('flag-isolated account bootstrap', () => {
  it('uses the original guest component if the lazy chunk cannot load', async () => {
    const Guest = () => null
    const load = vi.fn().mockRejectedValue(new Error('chunk unavailable'))
    expect(await loadPlayerAccountModule(load, Guest)).toEqual({ default: Guest })
    expect(load).toHaveBeenCalledTimes(1)
  })
  it.each([undefined, {}, { ...env, VITE_PLAYER_ACCOUNTS_ENABLED: true }, { ...env, VITE_PLAYER_CLOUD_CONFIGURED: 'false' }])('does not request/load/create accounts for flags %o', flags => {
    expect(playerAccountsRequested(flags)).toBe(false)
    const makeRuntime = vi.fn(), cache = createPlayerAccountRuntimeCache(makeRuntime)
    expect(cache.get({ env: flags }).enabled).toBe(false)
    expect(makeRuntime).not.toHaveBeenCalled()
  })
  it('creates exactly once across repeated StrictMode-style effect setups', async () => {
    const runtime = { enabled: true, dispose: vi.fn() }, makeRuntime = vi.fn().mockReturnValue(runtime)
    const cache = createPlayerAccountRuntimeCache(makeRuntime)
    expect(playerAccountsRequested(env)).toBe(true)
    expect(cache.get({ env })).toBe(runtime)
    expect(cache.get({ env })).toBe(runtime)
    expect(makeRuntime).toHaveBeenCalledTimes(1)
    await cache.dispose(); await cache.dispose()
    expect(runtime.dispose).toHaveBeenCalledTimes(1)
    expect(cache.get({ env }).enabled).toBe(false)
    expect(makeRuntime).toHaveBeenCalledTimes(1)
  })
  it('caches configuration failure instead of creating duplicate clients', () => {
    const makeRuntime = vi.fn().mockReturnValue({ enabled: false }), cache = createPlayerAccountRuntimeCache(makeRuntime)
    expect(cache.get({ env }).enabled).toBe(false)
    expect(cache.get({ env }).enabled).toBe(false)
    expect(makeRuntime).toHaveBeenCalledTimes(1)
  })
  it('contains initialization exceptions and renders the unchanged guest component fallback', () => {
    const cache = createPlayerAccountRuntimeCache(() => { throw Error('fixture initialization failed') })
    const runtime = cache.get({ env })
    const html = renderToStaticMarkup(createElement(PlayerAccountBootstrapView, { runtime, GuestComponent: () => createElement('p', {}, 'Original guarded guest App') }))
    expect(html).toContain('Original guarded guest App')
  })
  it('forwards the single ready runtime without reconstructing dependencies', () => {
    const AccountComponent = vi.fn(() => createElement('p', {}, 'Account host'))
    const runtime = { enabled: true, authController: {}, saveCoordinator: {}, otpReady: true, googleReady: false }
    renderToStaticMarkup(createElement(PlayerAccountBootstrapView, { runtime, AccountComponent }))
    expect(AccountComponent.mock.calls[0][0]).toMatchObject({ authController: runtime.authController, saveCoordinator: runtime.saveCoordinator, otpReady: true })
  })
  it('does not create a browser/client during server rendering', () => {
    const html = renderToStaticMarkup(createElement(PlayerAccountBootstrap))
    expect(html).toContain('role="status"')
    expect(html).toContain('正在准备账号与存档')
  })
})
