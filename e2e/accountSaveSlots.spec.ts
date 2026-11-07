import { expect, test } from '@playwright/test'

// CI can use its installed Playwright browser. A local run may explicitly use
// an installed browser without downloading or using any personal profile.
test.use({ channel: process.env.PLAYWRIGHT_CHANNEL, trace: 'off', screenshot: 'off' })

test('isolated account slots persist and respect a real cross-tab writer lease', async ({ page, context }) => {
  // Exercise only the new foundation, not a second unapproved App integration.
  await context.route('**/account-save-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Account save test</title>' }))
  await page.goto('/account-save-test')
  const other = await context.newPage()
  await other.goto('/account-save-test')
  const first = await page.evaluate(async () => {
    const { createAccountSaveSlots } = await import('/src/services/accountSaveSlots.mjs')
    const { createSaveEntryService, PLAYER } = await import('/src/services/saveEntryService.mjs')
    const ownerId = '11111111-1111-4111-8111-111111111111'
    const slotId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const repository = createAccountSaveSlots({ storage: localStorage, locks: navigator.locks, assertAccess: ({ ownerId: requested }) => requested === ownerId, canCreateSlot: () => true })
    const created = await repository.createSlot({ ownerId, slotId })
    const scoped = repository.openStorage({ ownerId, slotId })
    const service = createSaveEntryService({ storage: scoped, locks: navigator.locks })
    const inspection = await service.inspectSave()
    const prepared = await service.prepareEntry({ intent: 'create', snapshotToken: inspection.snapshotToken })
    const committed = await service.commitEntry({ ticket: prepared.ticket })
    if (committed.status !== 'committed') throw Error(JSON.stringify(committed))
    const player = JSON.parse(committed.sessionHandle.storage.getItem(PLAYER))
    committed.sessionHandle.storage.setItem(PLAYER, JSON.stringify({ ...player, walletBalance: 650 }))
    await service.acknowledgeEntry({ ticket: committed.ticket, sessionHandle: committed.sessionHandle })
    Object.assign(window, { accountTestHandle: committed.sessionHandle })
    return { created: created.status, inspection: inspection.classification, committed: committed.status, guestPlayer: localStorage.getItem(PLAYER) }
  })
  expect(first).toEqual({ created: 'created', inspection: 'empty', committed: 'committed', guestPlayer: null })
  const trySecond = () => other.evaluate(async () => {
    const { createAccountSaveSlots } = await import('/src/services/accountSaveSlots.mjs')
    const ownerId = '11111111-1111-4111-8111-111111111111'
    const repository = createAccountSaveSlots({ storage: localStorage, locks: navigator.locks, assertAccess: ({ ownerId: requested }) => requested === ownerId, canCreateSlot: () => true })
    return (await repository.createSlot({ ownerId, slotId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })).status
  })
  expect(await trySecond()).toBe('busy')
  await page.evaluate(async () => { await (window as unknown as { accountTestHandle: { close: () => Promise<void> } }).accountTestHandle.close() })
  expect(await trySecond()).toBe('created')
  await other.reload()
  const resumed = await other.evaluate(async () => {
    const { createAccountSaveSlots } = await import('/src/services/accountSaveSlots.mjs')
    const { createSaveEntryService, PLAYER } = await import('/src/services/saveEntryService.mjs')
    const ownerId = '11111111-1111-4111-8111-111111111111'
    let signedIn = true
    const repository = createAccountSaveSlots({ storage: localStorage, locks: navigator.locks, assertAccess: ({ ownerId: requested }) => signedIn && requested === ownerId, canCreateSlot: () => true })
    const scoped = repository.openStorage({ ownerId, slotId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
    const service = createSaveEntryService({ storage: scoped, locks: navigator.locks })
    const inspection = await service.inspectSave()
    const prepared = await service.prepareEntry({ intent: 'continue', snapshotToken: inspection.snapshotToken })
    const committed = await service.commitEntry({ ticket: prepared.ticket })
    if (committed.status !== 'committed') throw Error(JSON.stringify(committed))
    const balance = JSON.parse(committed.sessionHandle.storage.getItem(PLAYER)).walletBalance
    const count = repository.listSlots(ownerId).length
    const before = JSON.stringify({ ...localStorage })
    signedIn = false
    let denied = false
    try { committed.sessionHandle.storage.setItem(PLAYER, '{}') } catch { denied = true }
    const unchanged = before === JSON.stringify({ ...localStorage })
    await committed.sessionHandle.close()
    return { balance, count, denied, unchanged, stopped: !committed.sessionHandle.isOpen }
  })
  expect(resumed).toEqual({ balance: 650, count: 2, denied: true, unchanged: true, stopped: true })
})
