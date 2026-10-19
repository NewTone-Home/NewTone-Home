import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const defaultUrl = 'https://new-tone-8jf1b8sek-newtone-homes-projects.vercel.app/?scene=commercial-street'
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.join('=')]
}))
const url = args.get('url') ?? defaultUrl
const outDir = path.resolve(args.get('out-dir') ?? path.join(os.tmpdir(), 'newtone-commercial-street-profile'))
const chromePath = process.env.NEW_TONE_CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const targetCellId = 'commercial-north-slot-1-character-1'
const targetStorefrontId = 'commercial-north-slot-1'
const targetObjectSelector = '[data-object-id^="commercial-retail-n1-fruit-tea-"]'

const viteServer = await createServer({ configFile: 'vite.config.js', server: { middlewareMode: true }, appType: 'custom' })
let targetRoomBounds
let targetApproach
try {
  const { mainlineScenes } = await viteServer.ssrLoadModule('/src/center/runtime/mainlineScenes.ts')
  const street = mainlineScenes['commercial-street']
  const storefront = street.storefronts.find((candidate) => candidate.id === targetStorefrontId)
  const passage = street.passages.find((candidate) => candidate.portalId === storefront?.portalId)
  targetRoomBounds = street.rooms.find((room) => room.id === passage?.toRoomId)?.bounds
  targetApproach = passage?.thresholds[0]
} finally {
  await viteServer.close()
}
if (!targetRoomBounds || !targetApproach) throw new Error(`Could not resolve the authored room and threshold for ${targetStorefrontId}`)

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)].toFixed(2))
}

function summarize(values) {
  const samples = values.map((value) => typeof value === 'number' ? value : value.deltaMs)
  return {
    count: samples.length,
    p50Ms: percentile(samples, .5),
    p95Ms: percentile(samples, .95),
    p99Ms: percentile(samples, .99),
    maxMs: samples.length ? Number(Math.max(...samples).toFixed(2)) : null,
    over32ms: samples.filter((value) => value > 32).length,
    over50ms: samples.filter((value) => value > 50).length,
  }
}

function windowSamples(samples, start, end) {
  if (start == null || end == null || end <= start) return []
  return samples.filter((sample) => sample.t >= start && sample.t <= end)
}

function summarizeCpuProfile(profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]))
  const parents = new Map()
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) parents.set(child, node.id)
  }
  const selfTimeByNode = new Map()
  const selfTimeByStack = new Map()
  profile.samples.forEach((nodeId, index) => {
    const delta = profile.timeDeltas[index] ?? 0
    selfTimeByNode.set(nodeId, (selfTimeByNode.get(nodeId) ?? 0) + delta)
    const stack = []
    let current = nodeId
    while (current != null) {
      const node = nodes.get(current)
      if (!node) break
      const frame = node.callFrame
      stack.push(`${frame.functionName || '(anonymous)'} @ ${frame.url || '<runtime>'}:${(frame.lineNumber ?? -1) + 1}:${(frame.columnNumber ?? -1) + 1}`)
      current = parents.get(current)
    }
    const key = stack.reverse().join(' <- ')
    selfTimeByStack.set(key, (selfTimeByStack.get(key) ?? 0) + delta)
  })
  const describeNode = (nodeId, selfTimeUs) => {
    const frame = nodes.get(nodeId)?.callFrame
    return {
      functionName: frame?.functionName || '(anonymous)',
      url: frame?.url || '<runtime>',
      line: frame?.lineNumber == null ? null : frame.lineNumber + 1,
      column: frame?.columnNumber == null ? null : frame.columnNumber + 1,
      selfTimeMs: Number((selfTimeUs / 1000).toFixed(2)),
    }
  }
  return {
    sampleCount: profile.samples.length,
    sampledMs: Number((profile.timeDeltas.reduce((sum, delta) => sum + delta, 0) / 1000).toFixed(2)),
    topFunctions: [...selfTimeByNode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
      .map(([nodeId, duration]) => describeNode(nodeId, duration)),
    topStacks: [...selfTimeByStack.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
      .map(([stack, duration]) => ({ sampledMs: Number((duration / 1000).toFixed(2)), stack })),
  }
}

async function snapshot(page) {
  return page.evaluate((objectSelector) => {
    const stage = document.querySelector('.mainline-scene-stage')
    const glyphs = [...document.querySelectorAll('.scene-spatial-glyph')]
    const walls = [...document.querySelectorAll('.scene-mainline-wall')]
    const groups = new Set([...document.querySelectorAll('[data-focus-target-group]')]
      .map((node) => node.getAttribute('data-focus-target-group')))
    const objects = [...document.querySelectorAll('[data-object-id]')]
    return {
      scene: stage?.getAttribute('data-mainline-scene') ?? null,
      totalDomNodes: document.querySelectorAll('*').length,
      glyphCount: glyphs.length,
      wallCount: walls.length,
      focusGroupCount: groups.size,
      objectCount: objects.length,
      targetObjectCount: document.querySelectorAll(objectSelector).length,
      topNorthPedestrians: [...document.querySelectorAll('[data-actor-id]')]
        .filter((node) => /pedestrian-(west|mid-east)-north$/.test(node.getAttribute('data-actor-id') ?? ''))
        .map((node) => ({
          id: node.getAttribute('data-actor-id'),
          cssLeft: node.style.left,
          cssTop: node.style.top,
          parent: node.parentElement?.className ?? null,
        })),
    }
  }, targetObjectSelector)
}

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--disable-gpu'] })
const context = await browser.newContext({ viewport: { width: 1180, height: 757 }, deviceScaleFactor: 1 })
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
await cdp.send('Profiler.enable')
const cpuProfiles = {}
async function startCpuProfile(label) {
  await cdp.send('Profiler.start')
  await page.evaluate((name) => window.__commercialStreetProfile.mark(`cpu-profile-${name}-start`), label)
}
async function stopCpuProfile(label) {
  await page.evaluate((name) => window.__commercialStreetProfile.mark(`cpu-profile-${name}-end`), label)
  const { profile } = await cdp.send('Profiler.stop')
  const profilePath = path.join(outDir, `commercial-street-door-${label}.cpuprofile`)
  await writeFile(profilePath, JSON.stringify(profile))
  cpuProfiles[label] = { path: profilePath, ...summarizeCpuProfile(profile) }
}

await page.addInitScript(({ selector, cellId, roomBounds, approach }) => {
  const sample = { raf: [], longTasks: [], milestones: [], supportedEntryTypes: [] }
  Object.defineProperty(window, '__commercialStreetProfile', { value: sample })
  let previousFrame = null
  let previousRoomMembership = null
  let markedFirstRoomFrame = false
  let approachTrackingActive = false
  let activeRoomObservationRecorded = false
  const mark = (name, detail = {}) => {
    const t = performance.now()
    sample.milestones.push({ name, t, ...detail })
    performance.mark(name, { detail })
  }
  sample.mark = mark
  const tick = (t) => {
    if (previousFrame != null) sample.raf.push({ t, deltaMs: t - previousFrame })
    previousFrame = t
    const actor = document.querySelector('[data-actor-id="protagonist"]')
    const x = Number.parseFloat(actor?.style.left ?? '')
    const y = Number.parseFloat(actor?.style.top ?? '')
    const inTargetRoom = Number.isFinite(x) && Number.isFinite(y)
      && x >= roomBounds.x && x <= roomBounds.x + roomBounds.width
      && y >= roomBounds.y && y <= roomBounds.y + roomBounds.height
    const objectCount = document.querySelectorAll(selector).length
    if (previousRoomMembership === null) previousRoomMembership = inTargetRoom
    else if (inTargetRoom !== previousRoomMembership) {
      if (inTargetRoom && !activeRoomObservationRecorded) {
        mark('active-room-position-first-observed', { x, y, roomBounds })
        activeRoomObservationRecorded = true
      }
      mark(inTargetRoom ? 'active-room-position-entered-observed' : 'active-room-position-left-observed', { x, y, roomBounds })
      previousRoomMembership = inTargetRoom
    }
    if (approachTrackingActive && !sample.approachReached && Number.isFinite(x) && Number.isFinite(y)
      && Math.hypot(x - approach.x, y - approach.y) <= 1.25) {
      sample.approachReached = true
      mark('street-approach-reached', { x, y, approach })
      approachTrackingActive = false
    }
    if (objectCount > 0 && !markedFirstRoomFrame) {
      markedFirstRoomFrame = true
      mark('room-items-first-raf', { x, y, objectCount })
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  sample.supportedEntryTypes = PerformanceObserver.supportedEntryTypes ?? []
  if (sample.supportedEntryTypes.includes('longtask')) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) sample.longTasks.push({ t: entry.startTime, durationMs: entry.duration, end: entry.startTime + entry.duration })
    }).observe({ type: 'longtask', buffered: true })
  }

  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-storefront-cell-id]') : null
    if (target?.getAttribute('data-storefront-cell-id') === cellId) {
      const actor = document.querySelector('[data-actor-id="protagonist"]')
      const x = Number.parseFloat(actor?.style.left ?? '')
      const y = Number.parseFloat(actor?.style.top ?? '')
      previousRoomMembership = Number.isFinite(x) && Number.isFinite(y)
        && x >= roomBounds.x && x <= roomBounds.x + roomBounds.width
        && y >= roomBounds.y && y <= roomBounds.y + roomBounds.height
      approachTrackingActive = sample.milestones.every((milestone) => milestone.name !== 'room-items-mounted')
      mark('door-pointerdown', { cellId, x, y })
    }
  }, true)

  const inspect = () => {
    const target = document.querySelector(selector)
    const count = document.querySelectorAll(selector).length
    const present = count > 0
    if (present !== sample.roomItemsPresent) {
      sample.roomItemsPresent = present
      if (present) {
        approachTrackingActive = false
        const actor = document.querySelector('[data-actor-id="protagonist"]')
        const x = Number.parseFloat(actor?.style.left ?? '')
        const y = Number.parseFloat(actor?.style.top ?? '')
        const actorInsideRoomBounds = Number.isFinite(x) && Number.isFinite(y)
          && x >= roomBounds.x && x <= roomBounds.x + roomBounds.width
          && y >= roomBounds.y && y <= roomBounds.y + roomBounds.height
        mark('room-items-mounted', { objectCount: count, actorX: x, actorY: y, actorInsideRoomBounds, roomBounds })
      } else mark('room-items-unmounted', { objectCount: count })
    }
  }
  const observer = new MutationObserver(inspect)
  const observationOptions = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-focus-passage-phase', 'data-door-phase', 'data-storefront-presentation-phase'],
  }
  const attachObserver = () => {
    if (!document.documentElement) return false
    observer.observe(document.documentElement, observationOptions)
    inspect()
    return true
  }
  if (!attachObserver()) document.addEventListener('DOMContentLoaded', attachObserver, { once: true })
  sample.pollTimer = window.setInterval(inspect, 50)
}, { selector: targetObjectSelector, cellId: targetCellId, roomBounds: targetRoomBounds, approach: targetApproach })

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
await page.waitForSelector('.mainline-scene-stage[data-mainline-scene="commercial-street"]', { timeout: 30_000 })
await page.waitForSelector(`[data-storefront-cell-id="${targetCellId}"]`, { timeout: 30_000 })
await page.evaluate(() => document.fonts?.ready)
await page.waitForTimeout(1_500)
const before = await snapshot(page)
await page.evaluate(() => window.__commercialStreetProfile.mark('baseline-street-ready'))

await cdp.send('Tracing.start', {
  categories: 'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline.frame',
  transferMode: 'ReturnAsStream',
})
const traceComplete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve))

await startCpuProfile('entry')
await page.locator(`[data-storefront-cell-id="${targetCellId}"]`).click({ timeout: 15_000 })
await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 0, targetObjectSelector, { timeout: 45_000, polling: 100 })
await page.waitForFunction(() => window.__commercialStreetProfile.milestones.some(event => event.name === 'room-items-first-raf'), undefined, { timeout: 45_000, polling: 16 })
await stopCpuProfile('entry')
await page.evaluate(() => window.__commercialStreetProfile.mark('interior-fixtures-ready'))
await page.waitForTimeout(1_000)
const inside = await snapshot(page)

await startCpuProfile('return')
await page.locator(`[data-storefront-cell-id="${targetCellId}"]`).click({ timeout: 15_000 })
await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 0, targetObjectSelector, { timeout: 45_000, polling: 100 })
await stopCpuProfile('return')
await page.evaluate(() => window.__commercialStreetProfile.mark('street-fixtures-cleared'))
await page.waitForTimeout(1_000)
const returned = await snapshot(page)
const measurements = await page.evaluate(() => ({
  ...window.__commercialStreetProfile,
  end: performance.now(),
}))

await cdp.send('Tracing.end')
const { stream } = await traceComplete
const tracePath = path.join(outDir, 'commercial-street-door-trace.json')
let traceText = ''
for (;;) {
  const chunk = await cdp.send('IO.read', { handle: stream, size: 1 << 20 })
  traceText += chunk.data
  if (chunk.eof) break
}
await cdp.send('IO.close', { handle: stream })
await writeFile(tracePath, traceText)

const doorInputs = measurements.milestones.filter((event) => event.name === 'door-pointerdown')
const mounted = measurements.milestones.find((event) => event.name === 'room-items-mounted')
const approachReached = measurements.milestones.find((event) => event.name === 'street-approach-reached')
const activeRoomObserved = measurements.milestones.find((event) => event.name === 'active-room-position-first-observed')
const firstItemsFrame = measurements.milestones.find((event) => event.name === 'room-items-first-raf')
const unmounted = measurements.milestones.find((event) => event.name === 'room-items-unmounted' && mounted && event.t > mounted.t)
const entryInput = doorInputs[0]?.t
const returnInput = doorInputs[1]?.t
const entryPhaseBounds = (approachReached && mounted && approachReached.t < mounted.t
  ? [
    ['click-to-approach', entryInput, approachReached.t],
    ['approach-to-dom-mount', approachReached.t, mounted?.t],
    ['dom-mount-to-first-frame', mounted?.t, firstItemsFrame?.t],
  ]
  : [
    ['click-to-dom-mount', entryInput, mounted?.t],
    ['dom-mount-to-first-frame', mounted?.t, firstItemsFrame?.t],
  ]).filter(([, start, end]) => start != null && end != null)
const entryTasks = measurements.longTasks
  .filter((task) => entryInput != null && task.t >= entryInput && firstItemsFrame && task.t <= firstItemsFrame.t)
  .map((task) => {
    const taskEnd = task.end ?? task.t + task.durationMs
    const overlapByPhaseMs = Object.fromEntries(entryPhaseBounds.map(([phase, start, end]) => [
      phase,
      Number(Math.max(0, Math.min(taskEnd, end) - Math.max(task.t, start)).toFixed(2)),
    ]))
    return {
      ...task,
      relativeToClickMs: Number((task.t - entryInput).toFixed(2)),
      relativeToRoomMountMs: mounted ? Number((task.t - mounted.t).toFixed(2)) : null,
      overlapByPhaseMs,
    }
  })
const results = {
  url,
  viewport: { width: 1180, height: 757, deviceScaleFactor: 1 },
  browser: await browser.version(),
  source: 'page performance.now + requestAnimationFrame + PerformanceObserver longtask; CDP timeline trace + per-interval CPU sampling profiles; no screenshots',
  snapshots: { streetBefore: before, inside: inside, streetReturned: returned },
  intervals: {
    streetWalkAndEntry: {
      clickToRoomItemsMountedMs: entryInput != null && mounted ? Number((mounted.t - entryInput).toFixed(2)) : null,
      clickToFirstRoomItemsFrameMs: entryInput != null && firstItemsFrame ? Number((firstItemsFrame.t - entryInput).toFixed(2)) : null,
      clickToApproachObservedBeforeMountMs: entryInput != null && approachReached && mounted && approachReached.t < mounted.t ? Number((approachReached.t - entryInput).toFixed(2)) : null,
      clickToActiveRoomPositionFirstObservedMs: entryInput != null && activeRoomObserved ? Number((activeRoomObserved.t - entryInput).toFixed(2)) : null,
      activeRoomPositionObservationRelativeToMountMs: activeRoomObserved && mounted ? Number((activeRoomObserved.t - mounted.t).toFixed(2)) : null,
      mountToFirstFrameMs: mounted && firstItemsFrame ? Number((firstItemsFrame.t - mounted.t).toFixed(2)) : null,
      frameDeltas: summarize(windowSamples(measurements.raf, entryInput, firstItemsFrame?.t)),
      longTasks: entryTasks,
    },
    indoorExitAndReturn: {
      durationMs: returnInput != null && unmounted ? Number((unmounted.t - returnInput).toFixed(2)) : null,
      frameDeltas: summarize(windowSamples(measurements.raf, returnInput, unmounted?.t)),
      longTasks: measurements.longTasks.filter((task) => returnInput != null && unmounted && task.t >= returnInput && task.t <= unmounted.t),
    },
  },
  milestones: measurements.milestones,
  cpuProfiles,
  supportedEntryTypes: measurements.supportedEntryTypes,
  tracePath,
}
const resultPath = path.join(outDir, 'commercial-street-door-profile.json')
await writeFile(resultPath, JSON.stringify(results, null, 2))
console.log(JSON.stringify({ ...results, resultPath }, null, 2))
await context.close()
await browser.close()
