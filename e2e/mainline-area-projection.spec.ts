import { expect, test, type Page } from '@playwright/test'

const sizes = [[390,844,.75],[412,915,.75],[844,390,.75],[768,1024,.75],[1280,800,.75],[1920,1080,1],[3440,1440,1.125]] as const

async function isolatedEntry(page: Page, scene = 'commercial-street', point = {x:34,y:50}) {
  await page.addInitScript(({scene,point}) => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version:2,currentSceneId:scene,currentPosition:point,scenePositions:{[scene]:point},phoneDevice:'inner',sceneState:{},
    }))
  }, {scene,point})
  await page.goto(`/?scene=${scene}&debugRuntimeEvidence=1`)
  await expect(page.locator('.mainline-scene-stage')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

async function readProjection(page: Page) {
  return page.evaluate(() => {
    const world=document.querySelector<HTMLElement>('.scene-mainline-world')!,stage=document.querySelector<HTMLElement>('.mainline-scene-stage')!
    const rect=stage.getBoundingClientRect(),r=world.getBoundingClientRect(),s=r.width/world.offsetWidth
    const actor=document.querySelector<HTMLElement>('.scene-protagonist')!
    const wall=document.querySelector<HTMLElement>('.scene-mainline-wall')!
    return {scale:s,policy:world.dataset.worldProjectionPolicy,width:rect.width,height:rect.height,stableHeight:document.querySelector('.scene-mainline-stable-viewport')!.getBoundingClientRect().height,
      visible:{width:rect.width/s,height:rect.height/s},font:getComputedStyle(wall).fontSize,fontScreen:parseFloat(getComputedStyle(wall).fontSize)*s,
      actor:{x:parseFloat(actor.style.left),y:parseFloat(actor.style.top)},
      camera:{x:50+(r.left-rect.left-rect.width/2)/(19.2*s),y:50+(r.top-rect.top-rect.height/2)/(10.8*s)},
      dpr:devicePixelRatio,pinch:visualViewport?.scale}
  })
}

for(const [width,height,scale] of sizes) test(`${width}x${height} area formula and real world projection`,async({page},info)=>{
  await page.setViewportSize({width,height});await isolatedEntry(page)
  await expect.poll(async()=>Number((await readProjection(page)).scale.toFixed(5))).toBe(scale)
  const actual=await readProjection(page)
  expect(actual.width).toBe(width);expect(actual.height).toBe(height)
  expect(actual.font).toBe('16px');expect(actual.fontScreen).toBeCloseTo(16*scale,3)
  expect(actual.visible.width).toBeCloseTo(width/scale,3);expect(actual.visible.height).toBeCloseTo(height/scale,3)
  await info.attach('projection.json',{body:JSON.stringify(actual,null,2),contentType:'application/json'})
  await page.screenshot({path:info.outputPath('projection.png')})
})

test('orientation and window resize retain world coordinates and update the one inverse',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await isolatedEntry(page)
  const observations=[]
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1280,height:800},{width:1920,height:1080},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(400)
    const projection=await readProjection(page);observations.push(projection)
    expect(projection.actor.x).toBeCloseTo(34,3);expect(projection.actor.y).toBeCloseTo(50,3)
    expect(projection.scale).toBeCloseTo(Math.max(.75,Math.min(1.125,Math.sqrt(viewport.width*viewport.height/2073600))),5)
  }
  const world=await page.locator('.scene-mainline-world').boundingBox()
  await page.mouse.click(world!.x+world!.width*.4,world!.y+world!.height*.5)
  await expect.poll(async()=>Math.abs((await readProjection(page)).actor.x-40)).toBeLessThan(.15)
  await info.attach('resize-and-click.json',{body:JSON.stringify(observations,null,2),contentType:'application/json'})
})

test('stable-height probe resists simulated browser-toolbar expansion',async({page},info)=>{
  await page.setViewportSize({width:1600,height:1000});await isolatedEntry(page)
  // Simulation of distinct svh and dvh, not a real mobile browser toolbar test.
  await page.locator('.scene-mainline-stable-viewport').evaluate(e=>(e as HTMLElement).style.height='900px')
  await expect.poll(async()=>Number((await readProjection(page)).scale.toFixed(5))).toBe(.83333)
  const before=await readProjection(page)
  await page.setViewportSize({width:1600,height:1100});await page.waitForTimeout(300)
  const after=await readProjection(page)
  expect(after.scale).toBeCloseTo(before.scale,5);expect(after.visible.height).toBeGreaterThan(before.visible.height)
  await info.attach('simulated-toolbar.json',{body:JSON.stringify({before,after},null,2),contentType:'application/json'})
})

test('CDP pinch and ambiguous DPI changes preserve the auto basis rather than cancelling zoom',async({page},info)=>{
  await page.setViewportSize({width:1600,height:1000});await isolatedEntry(page)
  const before=await readProjection(page),cdp=await page.context().newCDPSession(page)
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2})
  await expect.poll(async()=>(await readProjection(page)).policy).toBe('preserved')
  const pinch=await readProjection(page);expect(pinch.pinch).toBe(2);expect(pinch.scale).toBeCloseTo(before.scale,5)
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1})
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:800,height:500,deviceScaleFactor:2,mobile:false})
  await page.waitForTimeout(300);const dpi=await readProjection(page)
  expect(dpi.dpr).toBe(2);expect(dpi.policy).toBe('preserved');expect(dpi.scale).toBeCloseTo(before.scale,5)
  await info.attach('emulated-pinch-dpi.json',{body:JSON.stringify({before,pinch,dpi},null,2),contentType:'application/json'})
  await cdp.detach()
})

for(const width of [1280,390]) test(`courtyard door crossing keeps the shared scale at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:width===390?844:800})
  await isolatedEntry(page,'jijia-ancestral-home',{x:96,y:51.28})
  const before=await readProjection(page),observations: unknown[]=[]
  for(const [source,target] of [['jijia-ancestral-home','jijia-ancestral-interior'],['jijia-ancestral-interior','jijia-ancestral-home']]){
    const root=page.locator(`.mainline-scene[data-mainline-scene="${source}"]`)
    await root.locator('[data-focus-target-group="door:jijia-main-door"]').first().click()
    await expect(page.locator(`.mainline-scene[data-mainline-scene="${target}"]`)).toHaveCount(1)
    await expect(root).toHaveCount(0)
    const after=await readProjection(page);expect(after.scale).toBeCloseTo(before.scale,5);observations.push(after)
    await page.screenshot({path:info.outputPath(`${target}.png`)})
  }
  await info.attach('crossings.json',{body:JSON.stringify({before,observations},null,2),contentType:'application/json'})
})

for(const width of [1280,390])for(const side of ['left','right'] as const) test(`street ${side} endpoint is visible and walkable at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:width===390?844:800})
  await isolatedEntry(page,'commercial-street',{x:side==='left'?10:160,y:50})
  await page.waitForTimeout(500)
  const world=await page.locator('.scene-mainline-world').boundingBox(),target={x:side==='left'?9.5:161,y:50}
  await page.mouse.click(world!.x+world!.width*target.x/100,world!.y+world!.height*target.y/100)
  await expect.poll(async()=>Math.abs((await readProjection(page)).actor.x-target.x)).toBeLessThan(.15)
  const projection=await readProjection(page),edge=side==='left'?8:162.9134
  const pixel=projection.width/2+(edge+projection.camera.x-50)*19.2*projection.scale
  expect(pixel).toBeGreaterThan(8);expect(pixel).toBeLessThan(projection.width-8)
  await info.attach('endpoint.json',{body:JSON.stringify({projection,edge,pixel},null,2),contentType:'application/json'})
  await page.screenshot({path:info.outputPath(`${side}-endpoint.png`)})
})
