import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PlayerAccountGate from '../src/components/player/PlayerAccountGate.jsx'
import { createPlayerAccountGateActions } from '../src/services/playerAccountGateActions.mjs'

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const ok = { ok: true }
function setup() {
  const authController = Object.fromEntries(['requestEmailOtp', 'verifyEmailOtp', 'beginGoogleOAuth', 'logout'].map(name => [name, vi.fn().mockResolvedValue(ok)]))
  authController.cancel = vi.fn()
  const saveCoordinator = Object.fromEntries(['logout', 'continueGuest', 'selectSlot', 'createSlot', 'bootstrap'].map(name => [name, vi.fn().mockResolvedValue(ok)]))
  const onPending = vi.fn(), onError = vi.fn(), onCodeClear = vi.fn(), navigate = vi.fn()
  const actions = createPlayerAccountGateActions({ authController, saveCoordinator, onPending, onError, onCodeClear, navigate })
  return { actions, authController, saveCoordinator, onPending, onError, onCodeClear, navigate }
}
describe('player account gate callbacks', () => {
  it('routes OTP values and surfaces returned readiness/validation errors', async () => {
    const s = setup()
    const result = { ok: false, error: { code: 'otp_not_configured', message: 'Code delivery unavailable.' } }
    s.authController.requestEmailOtp.mockResolvedValue(result)
    expect(await s.actions.requestOtp('a@b.com')).toEqual(result)
    expect(s.onError).toHaveBeenLastCalledWith(result.error)
    expect(s.authController.requestEmailOtp).toHaveBeenCalledWith('a@b.com')
    await s.actions.verifyOtp('a@b.com', '012345')
    expect(s.authController.verifyEmailOtp).toHaveBeenCalledWith('a@b.com', '012345')
    expect(s.onCodeClear).toHaveBeenCalledTimes(1)
  })
  it('waits for safe runtime release before auth logout', async () => {
    const s = setup(), wait = deferred()
    s.saveCoordinator.logout.mockReturnValue(wait.promise)
    const pending = s.actions.logout()
    expect(s.authController.logout).not.toHaveBeenCalled()
    wait.resolve(ok)
    expect(await pending).toEqual(ok)
    expect(s.authController.logout).toHaveBeenCalledTimes(1)
  })
  it('never logs auth out when runtime release failed or had uncertain outcome', async () => {
    for (const result of [undefined, { ok: false, error: { message: 'Still saving.' } }]) {
      const s = setup()
      s.saveCoordinator.logout.mockResolvedValue(result)
      expect((await s.actions.logout()).ok).toBe(false)
      expect(s.authController.logout).not.toHaveBeenCalled()
    }
  })
  it('guards repeated actions synchronously', async () => {
    const s = setup(), wait = deferred()
    s.saveCoordinator.createSlot.mockReturnValue(wait.promise)
    const first = s.actions.createSlot()
    expect((await s.actions.createSlot()).error.code).toBe('busy')
    expect(s.saveCoordinator.createSlot).toHaveBeenCalledTimes(1)
    wait.resolve(ok); await first
  })
  it('uses selected IDs and explicit coordinator actions', async () => {
    const s = setup()
    await s.actions.selectSlot('slot-2'); await s.actions.createSlot(); await s.actions.retry()
    expect(s.saveCoordinator.selectSlot).toHaveBeenCalledWith('slot-2')
    expect(s.saveCoordinator.createSlot).toHaveBeenCalledTimes(1)
    expect(s.saveCoordinator.bootstrap).toHaveBeenCalledTimes(1)
  })
  it('navigates only through explicit injected callback for successful HTTPS OAuth', async () => {
    const s = setup()
    s.authController.beginGoogleOAuth.mockResolvedValue({ ok: true, data: { url: 'https://auth.example/authorize' } })
    await s.actions.google()
    expect(s.navigate).toHaveBeenCalledWith('https://auth.example/authorize')
    const actions = createPlayerAccountGateActions({ authController: s.authController })
    expect((await actions.google()).ok).toBe(false)
    expect(s.authController.beginGoogleOAuth).toHaveBeenCalledTimes(1)
  })
  it('does not navigate for invalid URL or failed OAuth', async () => {
    const s = setup()
    for (const result of [{ ok: false, error: { message: 'Not configured.' } }, { ok: true, data: { url: 'javascript:alert(1)' } }]) {
      s.authController.beginGoogleOAuth.mockResolvedValue(result)
      expect((await s.actions.google()).ok).toBe(false)
    }
    expect(s.navigate).not.toHaveBeenCalled()
  })
  it('guest continuation dismisses an older OAuth result and keeps guest playable', async () => {
    const s = setup(), wait = deferred()
    s.authController.beginGoogleOAuth.mockReturnValue(wait.promise)
    const first = s.actions.google()
    expect(await s.actions.continueGuest()).toEqual(ok)
    expect(s.authController.cancel).toHaveBeenCalledTimes(1)
    expect(s.saveCoordinator.continueGuest).toHaveBeenCalledTimes(1)
    wait.resolve({ ok: true, data: { url: 'https://auth.example/authorize' } })
    expect((await first).error.code).toBe('cancelled')
    expect(s.navigate).not.toHaveBeenCalled()
  })
  it('disposing a view stops downstream logout and reporting without owning controllers', async () => {
    const s = setup(), wait = deferred()
    s.saveCoordinator.logout.mockReturnValue(wait.promise)
    const first = s.actions.logout()
    s.actions.dispose()
    const count = s.onPending.mock.calls.length
    wait.resolve(ok); await first
    expect(s.authController.logout).not.toHaveBeenCalled()
    expect(s.onPending).toHaveBeenCalledTimes(count)
    expect((await s.actions.requestOtp('a@b.com')).error.code).toBe('disposed')
  })
  it('catches thrown errors without leaking raw error details', async () => {
    const s = setup()
    s.authController.requestEmailOtp.mockRejectedValue(new Error('private raw response'))
    const result = await s.actions.requestOtp('a@b.com')
    expect(result.ok).toBe(false)
    expect(result.error.message).not.toContain('private')
    expect(s.onPending).toHaveBeenLastCalledWith(null)
  })
})
describe('account entry shell rendering', () => {
  it('starts as a compact disclosure and performs no bootstrapping during render', () => {
    const source = { status: 'guest', slots: [], source: null }
    const coordinator = { getSnapshot: () => source, subscribe: () => () => {}, bootstrap: vi.fn() }
    const html = renderToStaticMarkup(createElement(PlayerAccountGate, { saveCoordinator: coordinator, language: 'en' }))
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('<form')
    expect(coordinator.bootstrap).not.toHaveBeenCalled()
  })
  it('shows real injected states and disables account controls while switching', () => {
    const auth = { status: 'authenticated', user: { id: 'real', email: 'a@b.com' } }
    const saves = { status: 'switching', slots: [{ slotId: 'a' }], source: null }
    const store = snapshot => ({ getSnapshot: () => snapshot, subscribe: () => () => {} })
    const html = renderToStaticMarkup(createElement(PlayerAccountGate, { authController: store(auth), saveCoordinator: store(saves), language: 'en', initiallyOpen: true }))
    expect(html).toContain('Signed in')
    expect(html).toContain('Loading saves')
    expect(html).not.toContain('data-slot-id')
  })
})
