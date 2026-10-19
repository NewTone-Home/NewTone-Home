import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const defaultUrl = 'https://new-tone-p9axim4lz-newtone-homes-projects.vercel.app/?scene=commercial-street'
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.join('=')]
}))
const url = args.get('url') ?? defaultUrl
const outDir = path.resolve(args.get('out-dir') ?? path.join(os.tmpdir(), 'newtone-commercial-street-profile'))
const chromePath = process.env.NEW_TONE_CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const targetCellId = 'commercial-north-slot-1-character-1'
const targetObjectSelector = '[data-object-id^="commercial-retail-n1-fruit-tea-"]'

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

await page.addInitScript(({ selector, cellId }) => {
  const sample = { raf: [], longTasks: [], milestones: [], doorPhases: [], supportedEntryTypes: [] }
  Object.defineProperty(window, '__commercialStreetProfile', { value: sample })
  let previousFrame = null
  const mark = (name, detail = {}) => sample.milestones.push({ name, t: performance.now(), ...detail })
  sample.mark = mark
  const tick = (t) => {
    if (previousFrame != null) sample.raf.push({ t, deltaMs: t - previousFrame })
    previousFrame = t
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  sample.supportedEntryTypes = PerformanceObserver.supportedEntryTypes ?? []
  if (sample.supportedEntryTypes.includes('longtask')) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) sample.longTasks.push({ t: entry.startTime, durationMs: entry.duration })
    }).observe({ type: 'longtask', buffered: true })
  }

  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-storefront-cell-id]') : null
    if (target?.getAttribute('data-storefront-cell-id') === cellId) mark('door-pointerdown', { cellId })
  }, true)

  const inspect = () => {
    const target = document.querySelector(selector)
    const count = document.querySelectorAll(selector).length
    const present = count > 0
    if (present !== sample.roomItemsPresent) {
      sample.roomItemsPresent = present
      mark(present ? 'room-items-mounted' : 'room-items-unmounted', { objectCount: count })
    }
    const phase = target?.getAttribute('data-focus-passage-phase')
      ?? target?.getAttribute('data-door-phase')
      ?? target?.getAttribute('data-storefront-presentation-phase')
      ?? null
    if (phase && phase !== sample.lastDoorPhase) {
      sample.lastDoorPhase = phase
      sample.doorPhases.push({ t: performance.now(), phase })
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
}, { selector: targetObjectSelector, cellId: targetCellId })

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

await page.locator(`[data-storefront-cell-id="${targetCellId}"]`).click({ timeout: 15_000 })
await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 0, targetObjectSelector, { timeout: 45_000, polling: 100 })
await page.evaluate(() => window.__commercialStreetProfile.mark('interior-fixtures-ready'))
await page.waitForTimeout(1_000)
const inside = await snapshot(page)

await page.locator(`[data-storefront-cell-id="${targetCellId}"]`).click({ timeout: 15_000 })
await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 0, targetObjectSelector, { timeout: 45_000, polling: 100 })
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
const unmounted = measurements.milestones.find((event) => event.name === 'room-items-unmounted' && mounted && event.t > mounted.t)
const entryInput = doorInputs[0]?.t
const returnInput = doorInputs[1]?.t
const results = {
  url,
  viewport: { width: 1180, height: 757, deviceScaleFactor: 1 },
  browser: await browser.version(),
  source: 'page performance.now + requestAnimationFrame + PerformanceObserver longtask; CDP timeline trace; no screenshots',
  snapshots: { streetBefore: before, inside: inside, streetReturned: returned },
  intervals: {
    streetWalkAndEntry: {
      durationMs: entryInput != null && mounted ? Number((mounted.t - entryInput).toFixed(2)) : null,
      frameDeltas: summarize(windowSamples(measurements.raf, entryInput, mounted?.t)),
      longTasks: measurements.longTasks.filter((task) => entryInput != null && mounted && task.t >= entryInput && task.t <= mounted.t),
    },
    indoorExitAndReturn: {
      durationMs: returnInput != null && unmounted ? Number((unmounted.t - returnInput).toFixed(2)) : null,
      frameDeltas: summarize(windowSamples(measurements.raf, returnInput, unmounted?.t)),
      longTasks: measurements.longTasks.filter((task) => returnInput != null && unmounted && task.t >= returnInput && task.t <= unmounted.t),
    },
  },
  milestones: measurements.milestones,
  doorPhases: measurements.doorPhases,
  supportedEntryTypes: measurements.supportedEntryTypes,
  tracePath,
}
const resultPath = path.join(outDir, 'commercial-street-door-profile.json')
await writeFile(resultPath, JSON.stringify(results, null, 2))
console.log(JSON.stringify({ ...results, resultPath }, null, 2))
await context.close()
await browser.close()
