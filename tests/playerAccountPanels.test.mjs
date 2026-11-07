import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PlayerAuthPanel from '../src/components/player/PlayerAuthPanel.jsx'
import PlayerSaveSlots from '../src/components/player/PlayerSaveSlots.jsx'

const signedOut = { status: 'signed_out', pending: null, user: null, email: null, error: null }
const callbacks = { onRequestOtp: vi.fn(), onVerifyOtp: vi.fn(), onGoogle: vi.fn(), onLogout: vi.fn(), onCancel: vi.fn(), onGuest: vi.fn(), onEmailChange: vi.fn(), onCodeChange: vi.fn() }
const authHtml = props => renderToStaticMarkup(createElement(PlayerAuthPanel, { snapshot: signedOut, language: 'en', ...callbacks, ...props }))
const slotsHtml = props => renderToStaticMarkup(createElement(PlayerSaveSlots, { language: 'en', onSelect: vi.fn(), onCreate: vi.fn(), ...props }))
const button = (html, label) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]).find(value => value.includes(label))

describe('player authentication candidate UI', () => {
  it('is fail closed until OTP readiness is exact true, without blocking guest play', () => {
    for (const otpReady of [undefined, false, 'true']) {
      const html = authHtml({ otpReady, emailInput: 'player@example.com' })
      expect(html).toContain('Email sign-in is not available yet')
      expect(button(html, 'Send code')).toContain('disabled')
      expect(button(html, 'Continue as guest')).not.toContain('disabled')
    }
  })
  it('renders email entry with no password or magic-link controls', () => {
    const html = authHtml({ otpReady: true, emailInput: 'player@example.com' })
    expect(button(html, 'Send code')).not.toContain('disabled')
    expect(html).toContain('type="email"')
    expect(html).toContain('autoComplete="email"')
    expect(html).not.toContain('type="password"')
    expect(html).not.toContain('magic link')
    expect(html).toContain('automatically keep your current save')
    expect(html).not.toMatch(/<button[^>]*>[^<]*[Bb]ind/)
  })
  it('renders delivered OTP state and supports leading-zero codes', () => {
    const html = authHtml({ otpReady: true, snapshot: { ...signedOut, email: 'player@example.com' }, codeInput: '012345' })
    expect(html).toContain('Code sent to')
    expect(html).toContain('autoComplete="one-time-code"')
    expect(html).toContain('inputMode="numeric"')
    expect(button(html, 'Verify and sign in')).not.toContain('disabled')
    expect(button(html, 'Resend code')).not.toContain('disabled')
    expect(button(html, 'Change email')).not.toContain('disabled')
  })
  it.each(['', '123', 'abcdef', '12345678901'])('does not submit invalid OTP %s', codeInput => {
    expect(button(authHtml({ otpReady: true, snapshot: { ...signedOut, email: 'a@b.com' }, codeInput }), 'Verify and sign in')).toContain('disabled')
  })
  it('disables auth actions while pending and leaves guest exit available', () => {
    const html = authHtml({ otpReady: true, googleReady: true, snapshot: { ...signedOut, email: 'a@b.com', pending: 'verify_otp' }, codeInput: '012345' })
    for (const label of ['Verify and sign in', 'Resend code', 'Change email', 'Continue with Google']) expect(button(html, label)).toContain('disabled')
    expect(button(html, 'Continue as guest')).not.toContain('disabled')
    expect(html).toContain('aria-busy="true"')
  })
  it('keeps unknown session state distinct from signed out', () => {
    const html = authHtml({ otpReady: true, snapshot: { status: 'unknown' }, emailInput: 'a@b.com' })
    expect(html).toContain('Checking sign-in status')
    expect(button(html, 'Send code')).toContain('disabled')
  })
  it('shows authenticated identity and logout without login form', () => {
    const html = authHtml({ snapshot: { status: 'authenticated', user: { id: 'real-user', email: 'a@b.com' } } })
    expect(html).toContain('Signed in')
    expect(button(html, 'Sign out')).not.toContain('disabled')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('Continue as guest')
  })
  it('does not enable Google unless configured, and shows escaped errors', () => {
    expect(authHtml()).not.toContain('Continue with Google')
    const html = authHtml({ googleReady: true, error: { message: '<script>alert(1)</script>' } })
    expect(html).toContain('Continue with Google')
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('<script>')
  })
  it('does not dispatch any auth operation just by rendering', () => {
    authHtml({ otpReady: true, googleReady: true })
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled()
  })
  it('supports Chinese and keeps input labels accessible', () => {
    const html = authHtml({ language: 'zh' })
    expect(html).toContain('玩家账号')
    expect(html).toContain('<label for=')
    expect(html).toContain('aria-labelledby=')
  })
})

describe('three-slot candidate UI', () => {
  it('shows signed-out guidance without exposing a supplied stale catalogue', () => {
    const html = slotsHtml({ status: 'signed_out', slots: [{ slotId: 'private', label: 'Private save' }] })
    expect(html).toContain('guest save remains playable')
    expect(html).not.toContain('Private save')
    expect(html).not.toContain('data-slot-id')
  })
  it.each(['loading', 'adopting'])('never renders empty/create slots during %s', status => {
    const html = slotsHtml({ status })
    expect(html).toContain('role="status"')
    expect(html).not.toContain('Create new save')
    expect(html).not.toContain('Empty slot')
  })
  it('renders exactly three empty placeholders for an authenticated empty catalogue', () => {
    const html = slotsHtml({ status: 'ready', slots: [] })
    expect(html.match(/player-slot-empty/g)).toHaveLength(3)
    expect(button(html, 'Create new save')).not.toContain('disabled')
  })
  it('shows real selected slot and remaining placeholders without invented progress', () => {
    const html = slotsHtml({ status: 'ready', slots: [{ slotId: 'slot-a', label: 'My journey', summary: 'Provided summary' }], selectedSlotId: 'slot-a' })
    expect(html).toContain('data-slot-id="slot-a" aria-pressed="true"')
    expect(html.match(/player-slot-empty/g)).toHaveLength(2)
    expect(html).toContain('Provided summary')
    expect(html).not.toContain('Chapter')
  })
  it('hides create at capacity but never discards overflow saves', () => {
    for (const count of [3, 4]) {
      const html = slotsHtml({ status: 'ready', slots: Array.from({ length: count }, (_, i) => ({ slotId: `s${i}` })) })
      expect(html.match(/data-slot-id=/g)).toHaveLength(count)
      expect(html).not.toContain('Create new save')
      expect(html).not.toContain('player-slot-empty')
    }
  })
  it('blocks selection and creation during a pending operation', () => {
    const html = slotsHtml({ status: 'ready', pending: true, slots: [{ slotId: 'a' }] })
    expect(button(html, 'Select save')).toContain('disabled')
    expect(button(html, 'Create new save')).toContain('disabled')
  })
  it('fails closed on unknown or malformed catalogue instead of offering replacement', () => {
    for (const slots of [null, [{ slotId: '' }], [{ slotId: 'a' }, { slotId: 'a' }]]) {
      const html = slotsHtml({ status: 'ready', slots })
      expect(html).toContain('role="alert"')
      expect(html).not.toContain('Create new save')
    }
    expect(slotsHtml({ status: 'unknown' })).not.toContain('Create new save')
  })
  it('shows recoverable load errors without delete, overwrite, or bind actions', () => {
    const html = slotsHtml({ status: 'error', onRetry: vi.fn() })
    expect(html).toContain('Existing saves will not be overwritten')
    expect(button(html, 'Reload saves')).not.toContain('disabled')
    expect(html).not.toMatch(/<button[^>]*>[^<]*(Delete|Overwrite|Bind)/)
  })
})
