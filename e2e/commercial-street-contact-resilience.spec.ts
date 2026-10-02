import { expect, test } from '@playwright/test'
import { mainlineStorefrontInteractionCandidates, mainlineScenes } from '../src/center/runtime/mainlineScenes'

test.use({ viewport: { width: 1280, height: 720 } })

const street = mainlineScenes['commercial-street']
const northClothing = street.storefronts.find((storefront) => storefront.id === 'commercial-north-slot-2')!
const [centredContact, fallbackContact] = mainlineStorefrontInteractionCandidates(street, northClothing)

test('an ambient pedestrian occupying the centred storefront contact leaves a real fallback for the protagonist', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  const pedestrian = page.locator('[data-npc-id="commercial-street-pedestrian-west-north"]')
  const echo = page.locator('[data-scene-echo="commercial-north-slot-2"]')
  let resolveCentredContact!: () => void
  const centredContactReached = new Promise<void>((resolve) => { resolveCentredContact = resolve })
  await page.exposeBinding('__storefrontContactReached', () => resolveCentredContact())
  await page.evaluate(({ contactX }) => {
    const actor = document.querySelector<HTMLElement>('[data-npc-id="commercial-street-pedestrian-west-north"]')
    if (!actor) throw new Error('Expected the west-north ambient pedestrian')
    const reached = () => Math.abs(Number(actor.dataset.runtimeX) - contactX) < .75
    const notify = () => (window as Window & { __storefrontContactReached: () => void }).__storefrontContactReached()
    if (reached()) {
      notify()
      return
    }
    const observer = new MutationObserver(() => {
      if (!reached()) return
      observer.disconnect()
      notify()
    })
    observer.observe(actor, { attributes: true, attributeFilter: ['data-runtime-x'] })
  }, { contactX: centredContact.x })

  await Promise.race([
    centredContactReached,
    page.waitForTimeout(30_000).then(() => { throw new Error('Ambient pedestrian did not reach the storefront contact') }),
  ])

  await page.getByRole('button', { name: '服装店', exact: true }).first().click()
  await expect(echo).toBeVisible({ timeout: 15_000 })
  await expect(protagonist).toHaveAttribute('data-runtime-y', new RegExp(`^${fallbackContact.y}(?:\\.|$)`))
  await expect(protagonist).toHaveAttribute('data-runtime-x', `${fallbackContact.x}`)
  await page.screenshot({ path: testInfo.outputPath('commercial-street-fallback-contact.png') })
  expect(consoleErrors).toEqual([])
})
