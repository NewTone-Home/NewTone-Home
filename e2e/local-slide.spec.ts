import { expect, test } from '@playwright/test'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const yardId = 'jijia-ancestral-home'
const interiorId = 'jijia-ancestral-interior'
const sceneRoot = (sceneId: string) => `.mainline-scene[data-mainline-scene="${sceneId}"]`

type LocalSlideObservation = {
  className: string
  sceneCount: number
  actorCount: number
  inputFrozen: boolean
}

async function observeLocalSlides(page: import('@playwright/test').Page) {
  const observations: LocalSlideObservation[] = []
  let nextObservation: ((observation: LocalSlideObservation) => void) | null = null
  await page.exposeBinding('__recordLocalSlide', (_source, observation: LocalSlideObservation) => {
    observations.push(observation)
    nextObservation?.(observation)
    nextObservation = null
  })
  await page.evaluate(() => {
    const evidence = window as Window & { __recordLocalSlide: (observation: LocalSlideObservation) => void }
    let lastClassName = ''
    new MutationObserver(() => {
      const transition = document.querySelector<HTMLElement>('.center-local-slide--left, .center-local-slide--right')
      if (!transition) return
      if (lastClassName === transition.className) return
      lastClassName = transition.className
      evidence.__recordLocalSlide({
        className: transition.className,
        sceneCount: transition.querySelectorAll('.mainline-scene').length,
        actorCount: transition.querySelectorAll('.scene-protagonist').length,
        inputFrozen: getComputedStyle(document.querySelector('.center-experience__scene-layer')!).pointerEvents === 'none',
      })
    }).observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] })
  })
  return {
    waitForNext: () => new Promise<LocalSlideObservation>((resolve) => {
      nextObservation = resolve
    }),
    observations,
  }
}

async function crossMainDoor(page: import('@playwright/test').Page, observer: Awaited<ReturnType<typeof observeLocalSlides>>, sourceSceneId: string, targetSceneId: string) {
  const mainDoor = page.locator(`${sceneRoot(sourceSceneId)} [data-focus-target-group="door:jijia-main-door"]`).first()
  await expect(mainDoor).toBeVisible()
  const nextSlide = observer.waitForNext()
  await mainDoor.click()

  const observation = await nextSlide
  expect(observation).toMatchObject({ sceneCount: 2, actorCount: 1, inputFrozen: true })
  await expect(page.locator(sceneRoot(targetSceneId))).toHaveCount(1)
  await expect(page.locator(sceneRoot(sourceSceneId))).toHaveCount(0)
}

test('ancestral main door uses a short crossing-triggered local slide in both directions', async ({ page }) => {
  const yardDoor = mainlineScenes[yardId].passages.find((passage) => passage.id === 'jijia-main-door')!
  await page.goto(`/?scene=${yardId}&entryX=${yardDoor.thresholds[0].x}&entryY=${yardDoor.thresholds[0].y}&debugRuntimeEvidence=1`)
  const observer = await observeLocalSlides(page)

  await crossMainDoor(page, observer, yardId, interiorId)
  await crossMainDoor(page, observer, interiorId, yardId)
})

test('ancestral main door cleans each local-slide overlap across repeated crossings', async ({ page }) => {
  const yardDoor = mainlineScenes[yardId].passages.find((passage) => passage.id === 'jijia-main-door')!
  await page.goto(`/?scene=${yardId}&entryX=${yardDoor.thresholds[0].x}&entryY=${yardDoor.thresholds[0].y}&debugRuntimeEvidence=1`)
  const observer = await observeLocalSlides(page)

  for (let cycle = 0; cycle < 10; cycle += 1) {
    await crossMainDoor(page, observer, yardId, interiorId)
    await crossMainDoor(page, observer, interiorId, yardId)
  }
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('preserves the safe entry without creating a local-slide overlap', async ({ page }) => {
    const yardDoor = mainlineScenes[yardId].passages.find((passage) => passage.id === 'jijia-main-door')!
    await page.goto(`/?scene=${yardId}&entryX=${yardDoor.thresholds[0].x}&entryY=${yardDoor.thresholds[0].y}&debugRuntimeEvidence=1`)
    await observeLocalSlides(page)

    const mainDoor = page.locator(`${sceneRoot(yardId)} [data-focus-target-group="door:jijia-main-door"]`).first()
    await mainDoor.click()

    await expect(page.locator(sceneRoot(interiorId))).toHaveCount(1)
    await expect(page.locator(sceneRoot(yardId))).toHaveCount(0)
    await expect(page.locator('.center-local-slide--left, .center-local-slide--right')).toHaveCount(0)
    await expect(page.locator('[data-actor-id="protagonist"]')).toHaveAttribute('style', new RegExp(`left: ${yardDoor.entryPosition!.x}%`))
  })
})
