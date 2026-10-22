import { expect, test, type Page } from '@playwright/test'
import { commercialStreetCameraPages, commercialStreetPageIndex } from '../src/center/runtime/commercialStreetCamera'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const sizes = [[390,844,.65],[412,915,.65],[844,390,.65],[768,1024,.72571],[1280,800,1],[1920,1080,1],[3440,1440,1]] as const

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
    return {scale:s,policy:world.dataset.worldProjectionPolicy,left:rect.left,top:rect.top,width:rect.width,height:rect.height,cameraState:{x:Number(stage.dataset.cameraOffsetX),y:Number(stage.dataset.cameraOffsetY)},stableHeight:document.querySelector('.scene-mainline-stable-viewport')!.getBoundingClientRect().height,
      visible:{width:rect.width/s,height:rect.height/s},font:getComputedStyle(wall).fontSize,fontScreen:parseFloat(getComputedStyle(wall).fontSize)*s,
      actor:{x:parseFloat(actor.style.left),y:parseFloat(actor.style.top)},
      camera:{x:50+(r.left-rect.left-rect.width/2)/(19.2*s),y:50+(r.top-rect.top-rect.height/2)/(10.8*s)},
      dpr:devicePixelRatio,pinch:visualViewport?.scale}
  })
}

function documentTextMapped(text: string | null) {
  const match = text?.match(/mapped：([\d.]+)%, ([\d.]+)%/)
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null
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
    const widthScale=viewport.width<=480?.65:viewport.width<=720?.65+(viewport.width-480)*.05/240:Math.min(1,.70+(viewport.width-720)*.30/560)
    expect(projection.scale).toBeCloseTo(Math.min(widthScale,Math.max(.65,viewport.height/720)),5)
  }
  const world=await page.locator('.scene-mainline-world').boundingBox()
  await page.mouse.click(world!.x+world!.width*.4,world!.y+world!.height*.5)
  await expect.poll(async()=>Math.abs((await readProjection(page)).actor.x-40)).toBeLessThan(.15)
  await info.attach('resize-and-click.json',{body:JSON.stringify(observations,null,2),contentType:'application/json'})
})

test('development formula lab switches old and new camera scale in place',async({page},info)=>{
  await page.setViewportSize({width:1920,height:1080})
  await page.addInitScript(({scene,point})=>{
    localStorage.setItem('newtone-public-release-cutover-v1','center-v1')
    localStorage.setItem('newtone-player-save-v1',JSON.stringify({_version:2,currentSceneId:scene,currentPosition:point,scenePositions:{[scene]:point},phoneDevice:'inner',sceneState:{}}))
  },{scene:'commercial-street',point:{x:34,y:50}})
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1&debugInput=1&viewportFormulaLab=1')
  await expect(page.locator('.mainline-scene-stage')).toBeVisible()
  await expect(page.locator('[data-viewport-formula-lab]')).toBeVisible()
  const originalUrl=page.url()
  let previousCamera: {x:number;y:number}|undefined
  let stableCameraSamples=0
  const waitForCameraSettled=async()=>{
    previousCamera=undefined
    stableCameraSamples=0
    await expect.poll(async()=>{
      const projection=await readProjection(page)
      const camera=projection.cameraState
      const pages=commercialStreetCameraPages(mainlineScenes['commercial-street']!,{width:projection.width,height:projection.height,projectionScale:projection.scale})
      const pageIndex=commercialStreetPageIndex(pages.centers,projection.actor.x,pages.span)
      const target={x:50-pages.centers[pageIndex]!,y:pages.yOffset}
      const atTarget=Math.abs(camera.x-target.x)<.01&&Math.abs(camera.y-target.y)<.01
      if(previousCamera&&Math.abs(camera.x-previousCamera.x)<.01&&Math.abs(camera.y-previousCamera.y)<.01&&atTarget) stableCameraSamples++
      else stableCameraSamples=0
      previousCamera=camera
      return stableCameraSamples
    },{timeout:5000,intervals:[50,75,100]}).toBeGreaterThanOrEqual(3)
  }
  const setMode=async(mode:'legacy'|'device')=>{
    await page.getByRole('button',{name:mode==='legacy'?'旧公式':'新公式'}).click()
    await expect.poll(async()=>(await readProjection(page)).policy).toBe(mode)
    await waitForCameraSettled()
    return readProjection(page)
  }
  const expected=(width:number,height:number)=>{
    const byWidth=width<=480?.65:width<=720?.65+(width-480)*.05/240:Math.min(1,.70+(width-720)*.30/560)
    return Math.min(byWidth,Math.max(.65,height/720))
  }
  const cameraDiagnostics=(viewport:{width:number;height:number},projection:Awaited<ReturnType<typeof readProjection>>,mode:'legacy'|'device')=>{
    const pages=commercialStreetCameraPages(mainlineScenes['commercial-street']!,{...viewport,projectionScale:projection.scale})
    const pageIndex=commercialStreetPageIndex(pages.centers,projection.actor.x,pages.span)
    const xBoundary=pages.centers.length===1?'start+end':pageIndex===0?'start':pageIndex===pages.centers.length-1?'end':'none'
    return {mode,viewport,playerWorldXY:projection.actor,cameraFocusXY:{x:50-projection.cameraState.x,y:50-projection.cameraState.y},cameraTargetXY:{x:pages.centers[pageIndex],y:50-pages.yOffset},offsetX:projection.cameraState.x,scale:projection.scale,edgeClamp:{x:xBoundary,y:'scene-centered'},pageIndex,pageCount:pages.centers.length,settle:'camera stable for 3 samples under 0.01 and target tolerance after mode or resize',playerScreenXY:(()=>{const actorCenter=projection.left+projection.width/2+(projection.actor.x+projection.cameraState.x-50)*19.2*projection.scale;return {x:actorCenter}})()}
  }
  const legacyExpected=(width:number,height:number)=>Math.max(.75,Math.min(1.125,Math.sqrt(width*height/2073600)))
  const observations=[]
  for(const viewport of [
    {width:360,height:800},{width:375,height:550},{width:375,height:667},{width:411,height:914},
    {width:480,height:800},{width:481,height:800},{width:600,height:900},{width:720,height:900},
    {width:1024,height:768},{width:1280,height:800},{width:528,height:393},{width:707,height:823},
    {width:1920,height:1080},{width:3440,height:1440},
  ]){
    await page.setViewportSize(viewport)
    await expect.poll(async()=>Number((await readProjection(page)).scale.toFixed(5))).toBe(Number(expected(viewport.width,viewport.height).toFixed(5)))
    await waitForCameraSettled()
    const candidate=await readProjection(page)
    expect(candidate.width).toBe(viewport.width);expect(candidate.height).toBe(viewport.height)
    let oldScale=legacyExpected(viewport.width,viewport.height)
    if(viewport.width===1920||viewport.width===411||viewport.width===3440){
      const old=await setMode('legacy')
      expect(old.actor).toEqual(candidate.actor)
      oldScale=old.scale
      const oldDiagnostics=cameraDiagnostics(viewport,old,'legacy')
      console.log('[CAMERA_SCREENSHOT_DIAGNOSTIC] '+JSON.stringify(oldDiagnostics))
      await page.screenshot({path:info.outputPath(`${viewport.width}-old.png`)})
      const restored=await setMode('device')
      expect(restored.actor).toEqual(candidate.actor)
      const newDiagnostics=cameraDiagnostics(viewport,restored,'device')
      console.log('[CAMERA_SCREENSHOT_DIAGNOSTIC] '+JSON.stringify(newDiagnostics))
      await page.screenshot({path:info.outputPath(`${viewport.width}-new.png`)})
    }
    observations.push({viewport,oldScale,newScale:candidate.scale,actor:candidate.actor})
  }
  expect(page.url()).toBe(originalUrl)
  await page.setViewportSize({width:411,height:914})
  await expect.poll(async()=>Number((await readProjection(page)).scale.toFixed(5))).toBe(.65)
  await waitForCameraSettled()
  const projection=await readProjection(page)
  const actorBefore=projection.actor
  const target={x:actorBefore.x+3,y:actorBefore.y}
  const client={x:projection.left+projection.width/2+(target.x+projection.cameraState.x-50)*19.2*projection.scale,y:projection.top+projection.height/2+(target.y+projection.cameraState.y-50)*10.8*projection.scale}
  const hit=await page.evaluate(({x,y})=>{
    const element=document.elementFromPoint(x,y),stage=document.querySelector<HTMLElement>('.mainline-scene-stage')!,rect=stage.getBoundingClientRect()
    return {element:element?.tagName,className:typeof element?.className==='string'?element.className:'',withinStage:!!element?.closest('.mainline-scene-stage'),rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}}
  },client)
  expect(hit.withinStage).toBe(true)
  console.log('[REAL_CLICK_HIT] '+JSON.stringify({client,hit,target,projection:{width:projection.width,height:projection.height,scale:projection.scale,cameraState:projection.cameraState,camera:projection.camera}}))
  await page.mouse.click(client.x,client.y)
  await expect.poll(async()=>documentTextMapped(await page.locator('.scene-input-debug').textContent())).not.toBeNull()
  const diagnosticText=await page.locator('.scene-input-debug').textContent()
  console.log('[REAL_CLICK_RESULT] '+diagnosticText)
  const mapped=documentTextMapped(diagnosticText)
  expect(mapped?.x).toBeCloseTo(target.x,1);expect(mapped?.y).toBeCloseTo(target.y,1)
  await expect.poll(async()=>Math.abs((await readProjection(page)).actor.x-target.x)).toBeLessThan(1)
  const afterClick=await readProjection(page)
  expect(afterClick.actor.x).toBeGreaterThan(actorBefore.x)
  await info.attach('formula-comparison.json',{body:JSON.stringify({observations,click:{client,target,hit,mapped,actorBefore,actorAfter:afterClick.actor}},null,2),contentType:'application/json'})
})

test('stable-height probe resists simulated browser-toolbar expansion',async({page},info)=>{
  await page.setViewportSize({width:1600,height:1000});await isolatedEntry(page)
  // Simulation of distinct svh and dvh, not a real mobile browser toolbar test.
  await page.locator('.scene-mainline-stable-viewport').evaluate(e=>(e as HTMLElement).style.height='900px')
  await expect.poll(async()=>Number((await readProjection(page)).scale.toFixed(5))).toBe(1)
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

test('pinch recovery resumes phone, rotation and ultrawide adaptation without refresh',async({page},info)=>{
  await page.setViewportSize({width:1920,height:1080});await isolatedEntry(page)
  await expect.poll(async()=>(await readProjection(page)).scale).toBe(1)
  const cdp=await page.context().newCDPSession(page),observations=[]
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2})
  await expect.poll(async()=>(await readProjection(page)).policy).toBe('preserved')
  expect((await readProjection(page)).scale).toBe(1)
  observations.push(await readProjection(page))
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1})
  await expect.poll(async()=>(await readProjection(page)).policy).toBe('device')
  for(const [width,height,scale] of [[390,844,.65],[844,390,.65],[3440,1440,1]]){
    await page.setViewportSize({width,height})
    await expect.poll(async()=>Number((await readProjection(page)).scale.toFixed(5))).toBe(scale)
    observations.push(await readProjection(page))
  }
  await info.attach('pinch-recovery.json',{body:JSON.stringify(observations,null,2),contentType:'application/json'})
  await cdp.detach()
})

test('DPR guard recovers on distinct resize and baseline reset without cancelling immediate page zoom',async({page},info)=>{
  await page.setViewportSize({width:1920,height:1080});await isolatedEntry(page)
  await expect.poll(async()=>(await readProjection(page)).scale).toBe(1)
  const cdp=await page.context().newCDPSession(page),observations=[]
  // Split DPR and reciprocal CSS resize to exercise non-atomic event delivery.
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1.25,mobile:false})
  // Pure CDP DPR override changes the value without dispatching resize/media
  // events until layout changes. Explicitly simulate the browser notification
  // for this ordering test; this is not a real OS-DPI-switch claim.
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')))
  await expect.poll(async()=>(await readProjection(page)).policy).toBe('preserved')
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1536,height:864,deviceScaleFactor:1.25,mobile:false})
  await page.waitForTimeout(250)
  const active=await readProjection(page);expect(active.scale).toBe(1);expect(active.policy).toBe('preserved');observations.push(active)
  for(const [width,height,scale] of [[390,844,.65],[844,390,.65],[3440,1440,1]]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1.25,mobile:false})
    await expect.poll(async()=>Number((await readProjection(page)).scale.toFixed(5))).toBe(scale)
    expect((await readProjection(page)).policy).toBe('device');observations.push(await readProjection(page))
  }
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false})
  await expect.poll(async()=>Number((await readProjection(page)).scale.toFixed(5))).toBe(1)
  expect((await readProjection(page)).policy).toBe('device');observations.push(await readProjection(page))
  await info.attach('dpi-recovery.json',{body:JSON.stringify(observations,null,2),contentType:'application/json'})
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
