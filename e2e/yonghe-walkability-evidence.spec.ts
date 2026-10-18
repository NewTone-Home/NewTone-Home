import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { yongheMiningPerimeterLayout as perimeter } from '../src/center/runtime/yongheMiningPerimeterLayout'

const saveKey = 'newtone-player-save-v1'
const streetSelector = '.scene-shell[data-mainline-scene="yonghe-mining-perimeter"]'
const eaterySelector = '.scene-shell[data-mainline-scene="yonghe-eatery"]'

type TracePoint = { scene: string; x: number; y: number }
type Collider = { id: string; x: number; y: number; width: number; height: number }

async function clearTrace(page: Page) {
  await page.evaluate(() => { (window as any).__yongheEvidenceTrace = [] })
}

async function waitForActorNear(page: Page, scene: string, x: number, y: number) {
  await expect.poll(() => page.locator(`${scene} [data-actor-id="protagonist"]`).last().evaluate((actor, target) => {
    const actorX = Number((actor as HTMLElement).dataset.runtimeX)
    const actorY = Number((actor as HTMLElement).dataset.runtimeY)
    return Math.hypot(actorX - target.x, actorY - target.y)
  }, { x, y }), { timeout: 15_000 }).toBeLessThan(2)
}

function assertTraceClear(points: TracePoint[], colliders: Collider[], actorWidth: number, actorHeight: number) {
  for (const point of points) for (const box of colliders) {
    const overlaps = point.x - actorWidth / 2 < box.x + box.width
      && point.x + actorWidth / 2 > box.x
      && point.y - actorHeight / 2 < box.y + box.height
      && point.y + actorHeight / 2 > box.y
    expect(overlaps, `${point.scene} player ${point.x.toFixed(2)},${point.y.toFixed(2)} overlaps ${box.id}`).toBe(false)
  }
}

async function readTrace(page: Page, scene: string): Promise<TracePoint[]> {
  return page.evaluate((sceneId) => ((window as any).__yongheEvidenceTrace as TracePoint[])
    .filter((point) => point.scene === sceneId), scene)
}

async function readGeometry(page: Page, scene: string): Promise<{ colliders: Collider[]; stageWidth: number; stageHeight: number }> {
  return page.locator(`.scene-stage[data-mainline-scene="${scene}"]`).last().evaluate((stage) => {
    const colliders = [...stage.querySelectorAll<HTMLElement>('[data-object-id][data-collision-x]')]
      .map((element) => ({
        id: element.dataset.objectId ?? '',
        x: Number(element.dataset.collisionX),
        y: Number(element.dataset.collisionY),
        width: Number(element.dataset.collisionWidth),
        height: Number(element.dataset.collisionHeight),
      }))
      .filter((box) => box.id.startsWith('yonghe-') && [box.x, box.y, box.width, box.height].every(Number.isFinite))
    const bounds = stage.getBoundingClientRect()
    return { colliders, stageWidth: bounds.width, stageHeight: bounds.height }
  })
}

async function clickLogicalPoint(page: Page, x: number, y: number) {
  const actor = page.locator('[data-actor-id="protagonist"]')
  for (let step = 0; step < 24; step += 1) {
    const distance = await actor.evaluate((element, point) => Math.hypot(
      Number((element as HTMLElement).dataset.runtimeX) - point.x,
      Number((element as HTMLElement).dataset.runtimeY) - point.y,
    ), { x, y })
    if (distance < 1.5) return
    const stage = page.locator('.scene-stage').last()
    const box = await stage.boundingBox()
    if (!box) throw new Error('Scene stage is not visible')
    const projected = await stage.evaluate((element, point) => {
      const rect = element.getBoundingClientRect()
      const offsetX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
      const offsetY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
      const targetX = rect.x + rect.width * (point.x + offsetX) / 100
      const targetY = rect.y + rect.height * (point.y + offsetY) / 100
      return { x: Math.max(rect.x + 16, Math.min(rect.right - 16, targetX)), y: Math.max(rect.y + 16, Math.min(rect.bottom - 24, targetY)) }
    }, { x, y })
    const sceneBefore = await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene')
    await page.mouse.click(projected.x, projected.y)
    await expect.poll(async () => {
      const sceneAfter = await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene')
      const moving = await page.locator('[data-actor-id="protagonist"]').getAttribute('class')
      return sceneAfter !== sceneBefore || /is-moving/.test(moving ?? '')
    }, { timeout: 5_000 }).toBe(true)
    if (await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene') !== sceneBefore) return
    await expect(actor).not.toHaveClass(/is-moving/, { timeout: 15_000 })
  }
  throw new Error(`Player did not reach logical point ${x}, ${y}`)
}

async function clearObservation(page: Page, selector: string, point: string) {
  await page.locator(selector).click()
  await expect.poll(() => page.evaluate(({ saveKey, point }) =>
    JSON.parse(localStorage.getItem(saveKey) ?? '{}').sceneState?.['yonghe-mining-perimeter']?.[point] === true,
  { saveKey, point })).toBe(true)
  const shield = page.locator('[data-scene-dialogue-shield]')
  for (let attempt = 0; attempt < 6 && await shield.count(); attempt += 1) {
    if (await page.locator('[data-scene-observation-typing="true"]').count()) {
      await shield.click({ force: true })
      await expect(page.locator('[data-scene-observation-typing="true"]')).toHaveCount(0, { timeout: 5_000 })
    }
    await shield.click({ force: true })
  }
  await expect(page.locator('[data-scene-echo]')).toHaveCount(0, { timeout: 5_000 })
}

async function dismissSceneEcho(page: Page) {
  const shield = page.locator('[data-scene-dialogue-shield]')
  for (let attempt = 0; attempt < 8 && await shield.count(); attempt += 1) {
    if (await page.locator('[data-scene-observation-typing="true"]').count()) {
      await shield.click({ force: true })
      await expect(page.locator('[data-scene-observation-typing="false"]')).toBeVisible({ timeout: 10_000 })
    }
    await shield.click({ force: true })
  }
  await expect(shield).toHaveCount(0, { timeout: 5_000 })
}

function diagramSvg({
  title,
  subtitle,
  bounds,
  colliders,
  paths,
  doors,
  extra,
}: {
  title: string
  subtitle: string
  bounds: { x: number; y: number; width: number; height: number }
  colliders: Collider[]
  paths: { label: string; color: string; points: TracePoint[] }[]
  doors: { label: string; x: number; y: number; locked?: boolean; axis?: 'x' | 'y' }[]
  extra?: (project: { X: (x: number) => number; Y: (y: number) => number; scale: number }) => string
}) {
  const width = 1200
  const height = 880
  const pad = 110
  const scale = Math.min((width - pad * 2) / bounds.width, (height - pad * 2) / bounds.height)
  const left = (width - bounds.width * scale) / 2
  const top = (height - bounds.height * scale) / 2 + 20
  const X = (x: number) => left + (x - bounds.x) * scale
  const Y = (y: number) => top + (y - bounds.y) * scale
  const labelFor = (id: string) => id
    .replace(/^yonghe-outdoor-table-(\d+)$/, '门外桌$1')
    .replace(/^yonghe-outdoor-chair-(\d+)-top$/, '门外椅$1上')
    .replace(/^yonghe-outdoor-chair-(\d+)-bottom$/, '门外椅$1下')
    .replace(/^yonghe-(upper|lower)-(left|right)-group-table$/, (_, row, side) => `${row === 'upper' ? '上' : '下'}${side === 'left' ? '左' : '右'}桌`)
    .replace(/^yonghe-(upper|lower)-(left|right)-group-chair-top$/, (_, row, side) => `${row === 'upper' ? '上' : '下'}${side === 'left' ? '左' : '右'}椅上`)
    .replace(/^yonghe-(upper|lower)-(left|right)-group-chair-bottom$/, (_, row, side) => `${row === 'upper' ? '上' : '下'}${side === 'left' ? '左' : '右'}椅下`)
    .replace('yonghe-counter', '柜台')
    .replace('yonghe-stove', '灶台')
  const rect = (box: Collider, color: string, label: string) => `<rect x="${X(box.x)}" y="${Y(box.y)}" width="${box.width * scale}" height="${box.height * scale}" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="2"/><text x="${X(box.x) + 3}" y="${Y(box.y) + box.height * scale + 14}" class="small">${labelFor(label)}</text>`
  const path = (entry: { label: string; color: string; points: TracePoint[] }) => {
    const points = entry.points.filter((point) => point.x >= bounds.x - 1 && point.x <= bounds.x + bounds.width + 1 && point.y >= bounds.y - 1 && point.y <= bounds.y + bounds.height + 1)
    if (!points.length) return ''
    const d = points.map((point, index) => `${index ? 'L' : 'M'} ${X(point.x).toFixed(2)} ${Y(point.y).toFixed(2)}`).join(' ')
    const start = points[0]
    const end = points[points.length - 1]
    return `<path d="${d}" fill="none" stroke="${entry.color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><circle cx="${X(start.x)}" cy="${Y(start.y)}" r="8" fill="${entry.color}"/><circle cx="${X(end.x)}" cy="${Y(end.y)}" r="8" fill="white" stroke="${entry.color}" stroke-width="4"/><text x="${X(start.x) + 10}" y="${Y(start.y) - 8}" class="small">起</text><text x="${X(end.x) + 10}" y="${Y(end.y) - 8}" class="small">终</text>`
  }
  const door = (item: { label: string; x: number; y: number; locked?: boolean; axis?: 'x' | 'y' }) => `<rect x="${X(item.x) - (item.axis === 'x' ? 16 : 10)}" y="${Y(item.y) - (item.axis === 'x' ? 10 : 16)}" width="${item.axis === 'x' ? 32 : 20}" height="${item.axis === 'x' ? 20 : 32}" fill="${item.locked ? '#7c3434' : '#406f81'}" stroke="#d9cfaa" stroke-width="2"/><text x="${X(item.x) + 14}" y="${Y(item.y) + 5}" class="small">${item.label}${item.locked ? '（锁定）' : ''}</text>`
  const legend = paths.map((entry, index) => `<text x="${pad}" y="${88 + index * 26}" class="legend" fill="${entry.color}">━ ${entry.label}（采样 ${entry.points.length} 点）</text>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <style>text{font-family:'Microsoft YaHei',sans-serif;fill:#efe6cc}.title{font-size:28px;font-weight:700}.legend{font-size:17px}.small{font-size:13px}.foot{font-size:14px;fill:#d4cba9}</style>
    <rect width="100%" height="100%" fill="#11151a"/><text x="${pad}" y="36" class="title">${title}</text><text x="${pad}" y="61" class="foot">${subtitle}</text>${legend}
    <rect x="${X(bounds.x)}" y="${Y(bounds.y)}" width="${bounds.width * scale}" height="${bounds.height * scale}" fill="#1d2528" stroke="#98a39b" stroke-width="2"/>
    ${colliders.map((box) => rect(box, box.id.includes('counter') || box.id.includes('stove') ? '#e29a49' : '#c7b77f', box.id)).join('')}
    ${doors.map(door).join('')}${extra?.({ X, Y, scale }) ?? ''}${paths.map(path).join('')}
    <text x="${pad}" y="${height - 28}" class="foot">路径点来自本地 DEV 页面的运行时 data-runtime-x/y 采样；碰撞矩形取自同一画面的 data-collision-* 几何。仅为测试诊断叠图，不改变美术或占地。</text>
  </svg>`
}

test('captures measured Yonghe doorway, aisle, counter and locked-door routes with collider overlays', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('yonghe-walkability-fixture') !== 'ready') {
      localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
      localStorage.setItem(key, JSON.stringify({
        _version: 1,
        currentSceneId: 'yonghe-mining-perimeter',
        currentPosition: { x: 50, y: 56 },
        scenePositions: { 'yonghe-mining-perimeter': { x: 50, y: 56 } },
        phoneDevice: 'inner',
        sceneState: {},
        updatedAt: 1,
      }))
      sessionStorage.setItem('yonghe-walkability-fixture', 'ready')
    }
    ;(window as any).__yongheEvidenceTrace = []
    window.setInterval(() => {
      const trace = (window as any).__yongheEvidenceTrace as TracePoint[]
      for (const actor of document.querySelectorAll<HTMLElement>('[data-actor-id="protagonist"]')) {
        const stage = actor.closest<HTMLElement>('.scene-stage')
        const scene = stage?.dataset.mainlineScene
        const x = Number(actor.dataset.runtimeX)
        const y = Number(actor.dataset.runtimeY)
        if (!scene || !Number.isFinite(x) || !Number.isFinite(y)) continue
        const previous = [...trace].reverse().find((point) => point.scene === scene)
        if (!previous || Math.hypot(previous.x - x, previous.y - y) >= .06) trace.push({ scene, x, y })
      }
    }, 16)
  }, saveKey)

  await page.goto('/?debugRuntimeEvidence=1')
  const street = page.locator(streetSelector)
  const eatery = page.locator(eaterySelector)
  await expect(street).toHaveAttribute('data-debug-runtime-evidence', 'true')
  const streetGeometry = await readGeometry(page, 'yonghe-mining-perimeter')
  await expect.poll(() => page.locator('[data-actor-id="protagonist"]').getAttribute('data-runtime-x')).not.toBeNull()

  await clearTrace(page)
  const streetStage = street.locator('.mainline-scene-stage')
  for (const yRatio of [0.4, 0.2]) {
    const beforeY = Number(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').currentPosition?.y, saveKey))
    const stageBox = await streetStage.boundingBox()
    if (!stageBox) throw new Error('Mining street stage is not visible')
    await streetStage.click({ position: { x: stageBox.width * 0.45, y: stageBox.height * yRatio } })
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').currentPosition?.y, saveKey)).toBeLessThan(beforeY)
  }
  const streetDoor = street.locator('[data-storefront-cell-id][data-focus-target-policy="passage"]').first()
  await expect(streetDoor).toBeInViewport()
  await streetDoor.click()
  await expect(eatery).toBeVisible({ timeout: 15_000 })
  const approachTrace = await readTrace(page, 'yonghe-mining-perimeter')
  expect(approachTrace.length).toBeGreaterThan(3)
  const entryPoint = perimeter.entry.eateryEntryPosition
  const firstTable = streetGeometry.colliders.filter((box) => box.id.includes('outdoor-group-1') || box.id.includes('outdoor-table-1') || box.id.includes('outdoor-chair-1'))
  expect(firstTable.length).toBeGreaterThanOrEqual(3)

  // Let the portal's scene crossfade finish and reload the saved interior position
  // so DEV runtime evidence remains active on the newly mounted scene page.
  await page.evaluate(({ key, entry }) => localStorage.setItem(key, JSON.stringify({
    _version: 1,
    currentSceneId: 'yonghe-eatery',
    currentPosition: entry,
    scenePositions: { 'yonghe-eatery': entry },
    phoneDevice: 'inner',
    sceneState: {},
    updatedAt: 1,
  })), { key: saveKey, entry: entryPoint })
  await page.goto('/?debugRuntimeEvidence=1')
  await expect(eatery).toBeVisible()
  await expect(eatery.locator('[data-actor-id="protagonist"]')).toHaveAttribute('data-runtime-x', /.+/)
  await dismissSceneEcho(page)
  const indoorGeometry = await readGeometry(page, 'yonghe-eatery')
  const actorWidth = 11 / streetGeometry.stageWidth * 100
  const actorHeight = 11 / streetGeometry.stageHeight * 100
  const indoorActorWidth = 11 / indoorGeometry.stageWidth * 100
  const indoorActorHeight = 11 / indoorGeometry.stageHeight * 100
  const openingWidth = perimeter.entry.indoorWallOpening.end - perimeter.entry.indoorWallOpening.start
  await clearTrace(page)
  await clickLogicalPoint(page, 28.5, 36)
  await waitForActorNear(page, eaterySelector, 28.5, 36)
  const aisleTrace = await readTrace(page, 'yonghe-eatery')
  expect(aisleTrace.length).toBeGreaterThan(3)
  assertTraceClear(aisleTrace, indoorGeometry.colliders, indoorActorWidth, indoorActorHeight)
  await clearTrace(page)
  await clearObservation(page, '[data-object-id="yonghe-lower-right-group-table"]', 'yongheSurveyPoint:central-lane')
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').sceneState?.['yonghe-mining-perimeter']?.['yongheSurveyPoint:central-lane'] === true, saveKey)).toBe(true)
  await expect(eatery).toBeVisible()
  await dismissSceneEcho(page)
  const centralPoint = { x: 28.5, y: 36 }
  await clearTrace(page)

  await clickLogicalPoint(page, 27, 36)
  await waitForActorNear(page, eaterySelector, 27, 36)
  const counterTrace = await readTrace(page, 'yonghe-eatery')
  expect(counterTrace.length).toBeGreaterThan(2)
  assertTraceClear(counterTrace, indoorGeometry.colliders, indoorActorWidth, indoorActorHeight)
  await clearTrace(page)
  await clearObservation(page, '[data-object-id="yonghe-counter"]', 'yongheSurveyPoint:counter')
  await clearTrace(page)

  // Walk to a legal point just inside the locked door, then inspect it from there.
  // The locked-door interaction itself is intentionally non-traversable.
  await clickLogicalPoint(page, 16, 45)
  await waitForActorNear(page, eaterySelector, 16, 45)
  const doorApproachTrace = await readTrace(page, 'yonghe-eatery')
  expect(doorApproachTrace.length).toBeGreaterThan(2)
  assertTraceClear(doorApproachTrace, indoorGeometry.colliders, indoorActorWidth, indoorActorHeight)
  await clearTrace(page)

  await clearObservation(page, '[data-focus-target-group="door:yonghe-back-door"]', 'yongheSurveyPoint:back-door')
  await expect(eatery).toBeVisible()
  const backDoorTrace = await readTrace(page, 'yonghe-eatery')
  await clearTrace(page)

  await page.locator('[data-focus-target-group="door:yonghe-street-entry"]').click()
  await expect(street).toBeVisible({ timeout: 15_000 })
  const returnTrace = await readTrace(page, 'yonghe-eatery')
  expect(returnTrace.length).toBeGreaterThan(3)
  assertTraceClear(returnTrace, indoorGeometry.colliders, indoorActorWidth, indoorActorHeight)
  const survey = JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', saveKey))
  expect(survey.sceneState['yonghe-mining-perimeter']['yongheSurveyPoint:back-door']).toBe(true)
  expect(survey.sceneState['yonghe-mining-perimeter']['yongheSurveyPoint:counter']).toBe(true)

  // The scene crossing lands at the existing authored street entry point. From
  // that legal landing, walk outward on the street to record the reverse leg.
  const streetLanding = perimeter.entry.streetEntryPosition
  await page.evaluate(({ key, landing }) => localStorage.setItem(key, JSON.stringify({
    _version: 1,
    currentSceneId: 'yonghe-mining-perimeter',
    currentPosition: landing,
    scenePositions: { 'yonghe-mining-perimeter': landing },
    phoneDevice: 'inner',
    sceneState: {},
    updatedAt: 1,
  })), { key: saveKey, landing: streetLanding })
  await page.goto('/?debugRuntimeEvidence=1')
  await expect(street).toBeVisible()
  await dismissSceneEcho(page)
  const returnedStreetGeometry = await readGeometry(page, 'yonghe-mining-perimeter')
  await clearTrace(page)
  await clickLogicalPoint(page, 48, 56)
  await waitForActorNear(page, streetSelector, 48, 56)
  const doorToStreetTrace = await readTrace(page, 'yonghe-mining-perimeter')
  expect(doorToStreetTrace.length).toBeGreaterThan(3)

  const approachWidthAfterActor = perimeter.entry.approachClearance.width - actorWidth
  const openingWidthAfterActor = openingWidth - indoorActorHeight
  assertTraceClear(approachTrace, streetGeometry.colliders.filter((box) => box.id.includes('outdoor')), actorWidth, actorHeight)
  assertTraceClear(doorToStreetTrace, returnedStreetGeometry.colliders.filter((box) => box.id.includes('outdoor')), actorWidth, actorHeight)
  assertTraceClear(aisleTrace, indoorGeometry.colliders, indoorActorWidth, indoorActorHeight)
  assertTraceClear(counterTrace, indoorGeometry.colliders, indoorActorWidth, indoorActorHeight)
  const indoorBounds = { x: 8, y: 19, width: 32, height: 32 }
  const indoorObjects = indoorGeometry.colliders.filter((box) => /upper-left|upper-right|lower-left|lower-right|yonghe-counter|yonghe-stove/.test(box.id))
  const outsideSvg = diagramSvg({
    title: '永和门外：家具边界与实走进门路线',
    subtitle: `通行目标：门外街道 → 门口；真实桌椅碰撞框来自渲染几何。actor marker=11px 方形（stage ${streetGeometry.stageWidth.toFixed(0)}×${streetGeometry.stageHeight.toFixed(0)}px）。`,
    bounds: { x: 30, y: 28, width: 38, height: 48 },
    colliders: streetGeometry.colliders.filter((box) => box.id.includes('outdoor')),
    paths: [
      { label: '街道→前门', color: '#73d5f0', points: approachTrace },
      { label: '门口落点→沿街离开', color: '#f3b75b', points: doorToStreetTrace },
    ],
    doors: [{ label: '永和前门', x: perimeter.entry.doorPosition.x, y: perimeter.entry.doorPosition.y }],
    extra: ({ X, Y, scale }) => `<rect x="${X(perimeter.entry.approachClearance.x)}" y="${Y(perimeter.entry.approachClearance.y)}" width="${perimeter.entry.approachClearance.width * scale}" height="${perimeter.entry.approachClearance.height * scale}" fill="none" stroke="#62db95" stroke-width="2" stroke-dasharray="7 5"/><text x="${X(30.5)}" y="${Y(75)}" class="foot">入口净开口 ${openingWidth.toFixed(1)}u；11px 方形标记约 ${actorWidth.toFixed(2)}u × ${actorHeight.toFixed(2)}u；不把 actor footprint 当圆形半径。</text>`,
  })
  const indoorSvg = diagramSvg({
    title: '永和室内：入口转中央通路',
    subtitle: '从前门落点后点击中央通道观察点；路径来自真实运行时角色采样。',
    bounds: indoorBounds,
    colliders: indoorObjects,
    paths: [{ label: '入口→中央通道', color: '#73d5f0', points: [{ scene: 'yonghe-eatery', ...entryPoint }, ...aisleTrace] }],
    doors: [{ label: 'Front', x: perimeter.entry.indoorDoorPosition.x, y: perimeter.entry.indoorDoorPosition.y }, { label: 'Locked rear', x: perimeter.entry.rearDoorPosition.x, y: perimeter.entry.rearDoorPosition.y, locked: true, axis: 'x' }],
    extra: ({ X, Y, scale }) => `<rect x="${X(perimeter.entry.roomBounds.x)}" y="${Y(perimeter.entry.roomBounds.y)}" width="${perimeter.entry.roomBounds.width * scale}" height="${perimeter.entry.roomBounds.height * scale}" fill="none" stroke="#bac8b7" stroke-width="2"/><circle cx="${X(centralPoint.x)}" cy="${Y(centralPoint.y)}" r="1.2" fill="#f7d35f"/><text x="${X(centralPoint.x) + 1.5}" y="${Y(centralPoint.y)}" class="small">中央通道</text>`,
  })
  const interiorRouteSvg = diagramSvg({
    title: '右侧柜台与锁后门：接近观察后回前门',
    subtitle: '观察柜台/灶台与锁门后留在室内，沿既有前门退出；未进入柜台或越过锁门。',
    bounds: indoorBounds,
    colliders: indoorObjects,
    paths: [
      { label: '中央通路→柜台观察', color: '#f3b75b', points: counterTrace },
      { label: '柜台→锁门前接近点', color: '#d889db', points: doorApproachTrace },
      { label: '锁门观察→前门退出', color: '#73d5f0', points: [...backDoorTrace, ...returnTrace] },
    ],
    doors: [{ label: 'Front', x: perimeter.entry.indoorDoorPosition.x, y: perimeter.entry.indoorDoorPosition.y }, { label: 'Locked rear', x: perimeter.entry.rearDoorPosition.x, y: perimeter.entry.rearDoorPosition.y, locked: true, axis: 'x' }],
  })

  const evidencePage = await page.context().newPage()
  await evidencePage.setViewportSize({ width: 1200, height: 880 })
  for (const [name, svg] of [
    ['yonghe-outdoor-doorway-route.png', outsideSvg],
    ['yonghe-indoor-entry-to-aisle-route.png', indoorSvg],
    ['yonghe-counter-locked-door-return-route.png', interiorRouteSvg],
  ] as const) {
    await evidencePage.setContent(svg)
    await evidencePage.screenshot({ path: testInfo.outputPath(name) })
  }
  await evidencePage.close()

  await writeFile(testInfo.outputPath('yonghe-walkability-evidence.json'), JSON.stringify({
    source: 'DEV runtime data-runtime-x/y samples plus rendered data-collision-* geometry; only isolated Playwright localStorage was used',
    actorFootprintPx: { width: 11, height: 11 },
    stagePx: { width: streetGeometry.stageWidth, height: streetGeometry.stageHeight },
    actorFootprintSceneUnits: { street: { width: actorWidth, height: actorHeight }, eatery: { width: indoorActorWidth, height: indoorActorHeight } },
    clearances: {
      doorApproachAuthoredWidth: perimeter.entry.approachClearance.width,
      doorApproachAfterActorFootprint: approachWidthAfterActor,
      wallOpeningWidth: openingWidth,
      wallOpeningAfterActorFootprint: openingWidthAfterActor,
    },
    streetColliders: streetGeometry.colliders.filter((box) => box.id.includes('outdoor')),
    indoorColliders: indoorObjects,
    traces: { streetToFrontDoor: approachTrace, frontDoorStreetLandingToStreet: doorToStreetTrace, entryToCentralAisle: aisleTrace, aisleToCounter: counterTrace, counterToLockedDoorApproach: doorApproachTrace, lockedDoorToFrontDoorExit: returnTrace },
    outcome: { enteredEatery: true, enteredCounterCollider: false, backDoorRemainedClosed: true, exitedViaFrontDoor: true },
  }, null, 2))

  expect(openingWidth - actorHeight).toBeGreaterThan(0)
})
