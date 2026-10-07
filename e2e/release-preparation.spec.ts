import { expect, test } from '@playwright/test'
const copy = {
  zh: {
    summary: ['世界正在慢慢变得热闹起来。', '新的街道、新的人，以及一些还没有结束的事情，正在出现。'],
    details: ['· 我们开放了新的场景，现在大家可以去逛街了', '· 出现了一些NPC', '· 我们调整了一些视觉效果和交互体验。', '可惜的是，其他语言版本暂时还没有完成，目前仍在开发中。'],
  },
  en: {
    summary: ['The world is slowly starting to feel a little more alive.', 'New streets, new faces, and a few things still unfolding are beginning to appear.'],
    details: ['· We’ve opened up more places to explore. You can go wander the streets now.', '· A few new NPCs have appeared.', '· We’ve also refined some of the visuals and interactions.', 'The English version and other localizations aren’t ready just yet, but they’re still in development.'],
  },
}
for (const language of ['zh', 'en'] as const) test.describe(language + ' update notice', () => {
  test.use({ locale: language === 'en' ? 'en-US' : 'zh-CN' })
  test('exact copy, newest first, collapsed by default and reversible expansion', async ({ page }, info) => {
    await page.goto('/')
    if (language === 'en') {
      // Finish the existing first-visit migration normally before setting the language preference.
      await expect(page.locator('[data-entry-id="updates"]')).toBeVisible()
      await page.addInitScript(() => localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: 'en', hasInitializedLanguage: true, currentView: 'landing' })))
      await page.reload()
    }
    await page.locator('[data-entry-id="updates"]').click()
    const updates = page.locator('.landing-updates-page')
    await expect(updates).toHaveAttribute('data-updates-phase', 'updates')
    await expect(updates.locator('.landing-updates-page__timeline-version')).toHaveText(['v0.2.1', 'v0.2.0', 'v0.1.2', 'v0.1.1'])
    const first = updates.locator('.landing-updates-page__timeline-entry').first()
    await expect(first.locator('time')).toHaveText('2026.10.05')
    await expect(first.locator('time')).toHaveAttribute('datetime', '2026-10-05')
    await expect(first.locator('.landing-updates-page__summary > span')).toHaveText(copy[language].summary)
    const trigger = first.locator('button'), details = first.locator('.landing-updates-page__details-shell')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(details).toHaveAttribute('aria-hidden', 'true')
    await expect(details).toHaveCSS('opacity', '0')
    await expect(details).toHaveCSS('grid-template-rows', '0px')
    await page.screenshot({ path: info.outputPath(language + '-collapsed.png') })
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(details).toHaveCSS('opacity', '1')
    await expect(first.locator('.landing-updates-page__details p')).toHaveText(copy[language].details)
    for (const text of copy[language].details) await expect(first.getByText(text, { exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath(language + '-expanded.png') })
    await trigger.click()
    await expect(details).toHaveAttribute('aria-hidden', 'true')
    await expect(details).toHaveCSS('opacity', '0')
    await expect(details).toHaveCSS('grid-template-rows', '0px')
    for (const version of ['v0.2.0', 'v0.1.2', 'v0.1.1']) {
      const entry = updates.locator('.landing-updates-page__timeline-entry').filter({ hasText: version })
      await entry.locator('button').click()
      await expect(entry.locator('.landing-updates-page__details p').first()).toBeVisible()
      await entry.locator('button').click()
      await expect(entry.locator('button')).toHaveAttribute('aria-expanded', 'false')
    }
  })
})
test('Surface empty contacts and Inner Lao Zhou-only contacts with working messages', async ({ page }, info) => {
  await page.goto('/?scene=zhongshuyuan-office')
  await page.getByLabel('打开手机').click()
  await page.locator('[data-app="contacts"]').click()
  await expect(page.getByText('暂无联系人', { exact: true })).toBeVisible()
  await expect(page.getByText('当前手机没有里世界联系人。', { exact: true })).toBeVisible()
  await expect(page.locator('.world-phone__contact-row')).toHaveCount(0)
  await page.getByLabel('收起手机').click()
  await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
  await expect(page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')).toHaveAttribute('data-scene-observation-typing', 'false', { timeout: 15000 })
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await page.getByRole('button', { name: '换手机', exact: true }).click()
  await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-device', 'inner')
  await page.locator('[data-app="contacts"]').click()
  await expect(page.locator('.world-phone__contact-row')).toHaveCount(1)
  await expect(page.locator('.world-phone__contact-row strong')).toHaveText('老周')
  await expect(page.getByText('若雨', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('inner-contacts.png') })
  await page.locator('.world-phone__contact-row').click()
  await expect(page.getByRole('region', { name: '老周联系人详情' })).toBeVisible()
  await page.getByRole('button', { name: '信息' }).click()
  await expect(page.getByRole('region', { name: '与老周的短信' })).toBeVisible()
  await expect(page.locator('.world-phone__message-bubble')).toHaveText(['陈副部长失踪了。', '什么时候有空。', '周六。', '老地方。', '好。'])
  await expect(page.getByText('若雨', { exact: true })).toHaveCount(0)
  await page.getByLabel('返回联系人').click()
  await expect(page.locator('.world-phone__contact-row')).toHaveCount(1)
})
