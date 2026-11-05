import { registerPhoneTestNetwork } from './phoneTestNetwork'
registerPhoneTestNetwork()
import { expect, test } from '@playwright/test'
import { ACKNOWLEDGED, AUTHORITY, PENDING, SAVE_EPOCH } from '../src/services/saveEpoch.mjs'

test('Phone home uses story time and app navigation returns through the home indicator', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', error => consoleErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.route('**/rest/v1/analytics_events**', route => route.fulfill({ status:201, body:'' }))
  await page.goto('/')
  await expect(page.locator('[data-save-entry-phase="start-ready"]')).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), AUTHORITY)).toBeNull()
  await page.locator('[data-entry-group-entry="create"]').click()
  // Traces show ~5.1s entry handoffs, including lazy runtime loading and
  // cover/scene/ACK/reveal. Give only this composite boundary 10s, within the
  // unchanged 45s test budget. Keep the active, surface and ACK assertions below.
  await expect.poll(() => page.evaluate(({ AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH }) => {
    const authority = JSON.parse(localStorage.getItem(AUTHORITY) ?? 'null')
    const ack = JSON.parse(localStorage.getItem(ACKNOWLEDGED) ?? 'null')
    return {
      active: document.querySelector('.center-experience--active') !== null,
      surfaceGone: document.querySelector('.entry-surface') === null,
      acknowledged: Boolean(authority?.saveEpoch === SAVE_EPOCH && ack?.saveEpoch === SAVE_EPOCH
        && ack.generationId === authority.generation.id
        && ack.operationId === authority.operationReceipt.operationId),
      entryPhase: document.querySelector('[data-save-entry-phase]')?.getAttribute('data-save-entry-phase') ?? null,
      worldPhase: document.querySelector('[data-world-entry-phase]')?.getAttribute('data-world-entry-phase') ?? null,
      reasons: document.querySelector('[data-save-entry-reasons]')?.textContent ?? null,
    }
  }, { AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH }), {
    timeout: 10_000,
    message: 'Entry handoff must reach active, remove its surface and acknowledge the current save; last phases/reasons follow',
  }).toMatchObject({ active: true, surfaceGone: true, acknowledged: true })
  await expect(page.locator('.center-experience--active')).toBeVisible()
  await expect(page.locator('.entry-surface')).toHaveCount(0)
  await expect.poll(() => page.evaluate(({ AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH }) => {
    const authority = JSON.parse(localStorage.getItem(AUTHORITY) ?? 'null')
    const ack = JSON.parse(localStorage.getItem(ACKNOWLEDGED) ?? 'null')
    return Boolean(authority?.saveEpoch === SAVE_EPOCH && ack?.saveEpoch === SAVE_EPOCH
      && ack.generationId === authority.generation.id
      && ack.operationId === authority.operationReceipt.operationId)
  }, { AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH })).toBe(true)

  // The immutable create candidate is the initial time, not the already-ticking
  // live authority. Tie it to this committed operation and verify its fingerprint.
  const start = await page.evaluate(async ({ AUTHORITY, PENDING, SAVE_EPOCH }) => {
    const authority = JSON.parse(localStorage.getItem(AUTHORITY)!)
    const pending = JSON.parse(localStorage.getItem(PENDING)!)
    const candidate = JSON.parse(pending.candidateRaw)
    const player = JSON.parse(candidate.values['newtone-player-save-v1'])
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.candidateRaw))
    const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    return {
      linked: authority.saveEpoch === SAVE_EPOCH && pending.saveEpoch === SAVE_EPOCH
        && candidate.saveEpoch === SAVE_EPOCH && candidate.generation.id === authority.generation.id
        && pending.ticket.operationId === authority.operationReceipt.operationId
        && pending.ticket.requestHash === authority.operationReceipt.requestHash
        && fingerprint === pending.candidateSHA256,
      intent: pending.intent, generation: candidate.generation.id,
      year: player.storyClock.year, month: player.storyClock.month, day: player.storyClock.day,
      hour: player.storyClock.hour, minute: player.storyClock.minute, gameTimeMs: player.gameTimeMs,
    }
  }, { AUTHORITY, PENDING, SAVE_EPOCH })
  expect(start).toMatchObject({ linked: true, intent: 'create',
    year: 2025, month: 4, day: 12, hour: 10, minute: 0, gameTimeMs: 36_000_000 })

  const phone = page.locator('.world-phone')
  // New games open Lao Zhou's message; do not suppress the production prompt.
  await expect(phone).toHaveAttribute('data-phone-phase', 'open')
  await phone.getByRole('button', { name: '返回手机主屏', exact: true }).click()
  await expect(phone).toHaveAttribute('data-phone-phase', 'open')
  await expect(phone.getByLabel('剧情日历').locator(':scope > strong')).toHaveText('4月')
  await expect(phone.locator('[aria-current="date"]')).toHaveText('12')
  await expect(phone.getByLabel('剧情日历')).not.toContainText('故事日')
  // Normal gameplay persists its session clock every 10s. Observe a newer
  // authoritative checkpoint and its matching displayed minute in ONE JS turn.
  // A checkpoint/render minute boundary can disagree briefly; no +/- minute
  // tolerance, system clock, synthetic mode, pause or state mutation is used.
  await expect.poll(() => page.evaluate(({ AUTHORITY, SAVE_EPOCH, generation, initialTimeMs }) => {
    const authority = JSON.parse(localStorage.getItem(AUTHORITY)!)
    const player = JSON.parse(authority.values['newtone-player-save-v1'])
    const gameTimeMs = player.gameTimeMs
    const validTime = Number.isFinite(gameTimeMs) && gameTimeMs >= initialTimeMs
    const minuteOfDay = validTime ? Math.floor(gameTimeMs / 60_000) % (24 * 60) : null
    const expected = minuteOfDay === null ? null
      : `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`
    const displayed = document.querySelector('.world-phone__world-status')?.textContent?.split('　')[0] ?? null
    return {
      currentGeneration: authority.saveEpoch === SAVE_EPOCH && authority.generation.id === generation,
      advanced: validTime && gameTimeMs > initialTimeMs,
      matches: expected !== null && displayed === expected,
      savedGameTimeMs: gameTimeMs, expected, displayed,
    }
  }, { AUTHORITY, SAVE_EPOCH, generation: start.generation, initialTimeMs: start.gameTimeMs }), {
    timeout: 12_000,
    message: 'Live phone time must match an advanced normal game-clock checkpoint (10s persistence cadence)',
  }).toMatchObject({ currentGeneration: true, advanced: true, matches: true })
  await expect(phone.locator('.world-phone__apps button')).toHaveText(['地图', '叫车', '联系人', '反馈'])

  await phone.locator('[data-app="contacts"]').click()
  await expect(phone.getByRole('region', { name: '联系人' })).toBeVisible()
  await expect(phone.locator('.world-phone__app-back')).toHaveCount(0)
  const homeIndicator = phone.getByRole('button', { name: '返回手机主屏' })
  await expect(homeIndicator).toBeVisible()
  await homeIndicator.click()
  await expect(phone.getByLabel('剧情日历')).toBeVisible()
  expect(consoleErrors).toEqual([])
  await page.screenshot({ path: 'test-results/phone-os-shell-home.png' })
})
