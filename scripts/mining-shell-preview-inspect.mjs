import { chromium } from '@playwright/test'
import fs from 'node:fs'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
  const context = await browser.newContext({viewport})
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto('http://127.0.0.1:4175/?scene=yonghe-mining-perimeter', {waitUntil:'networkidle',timeout:25000})
    await page.waitForTimeout(1000)
    results.push({viewport,title:await page.title(),scenes:await page.locator('[data-mainline-scene]').evaluateAll(nodes=>nodes.map(node=>node.dataset.mainlineScene)),text:(await page.locator('body').innerText()).slice(0,800),errors})
    await page.screenshot({path:`.mining-evidence/initial-${viewport.width}.png`})
  } catch(error) {results.push({viewport,error:error.message,errors})}
  await context.close()
}
await browser.close()
fs.writeFileSync('.mining-evidence/browser-initial.json',JSON.stringify(results,null,2))
console.log(JSON.stringify(results))
