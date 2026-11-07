import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PlayerAccountApp from '../src/components/player/PlayerAccountApp.jsx'

const store = snapshot => ({ subscribe: () => () => {}, getSnapshot: () => snapshot })
const authController = store({ status: 'signed_out', user: null, error: null })
function render(snapshot, extra = {}) {
  const GameComponent = vi.fn(({ saveService }) => createElement('div', { 'data-service': saveService.marker }, 'Injected game'))
  const html = renderToStaticMarkup(createElement(PlayerAccountApp, { authController, saveCoordinator: store({ slots: [], error: null, source: null, ...snapshot }), language: 'en', GameComponent, ...extra }))
  return { html, GameComponent }
}
describe('account-aware game host', () => {
  it('mounts the injected selected save service without creating another service', () => {
    const service = { marker: 'selected-slot' }
    const { html, GameComponent } = render({ status: 'ready', source: { key: 'account:user:slot:1', service } })
    expect(html).toContain('data-service="selected-slot"')
    expect(GameComponent.mock.calls[0][0].saveService).toBe(service)
    expect(html).toContain('Account &amp; saves')
  })
  it('keeps guest runtime playable with the same host', () => {
    expect(render({ status: 'guest', source: { key: 'guest:1', service: { marker: 'guest' } } }).html).toContain('data-service="guest"')
  })
  it.each(['loading', 'switching', 'adopting', 'error'])('never renders stale runtime in %s', status => {
    const { html, GameComponent } = render({ status, source: { key: 'stale', service: { marker: 'stale' } } })
    expect(GameComponent).not.toHaveBeenCalled()
    expect(html).toContain('Your next story')
    expect(html).toContain('Account &amp; saves')
  })
  it('provides a bounded nonblank prompt before a save is selected', () => {
    const { html } = render({ status: 'ready' })
    expect(html).toContain('choose a save or continue as a guest')
    expect(html).toContain('aria-live="polite"')
  })
  it('renders actual Unicode Chinese text, not replacement characters', () => {
    const { html } = render({ status: 'guest' }, { language: 'zh', initiallyOpen: true })
    expect(html).toContain('你的下一段故事')
    expect(html).toContain('账号与存档')
    expect(html).toContain('玩家账号')
    expect(html).not.toContain('\uFFFD')
  })
})
