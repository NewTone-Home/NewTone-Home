import {expect,test,type Page} from '@playwright/test'
import {registerPhoneTestNetwork} from './phoneTestNetwork'
registerPhoneTestNetwork()
async function open(page:Page) {
 await page.addInitScript(()=>{
  localStorage.setItem('newtone-public-release-cutover-v1','center-v1')
  localStorage.setItem('newtone-player-save-v1',JSON.stringify({currentSceneId:'commercial-cafe',phoneDevice:'inner',sceneState:{'commercial-cafe':{commercialCafeStoryStatus:'complete'}},updatedAt:100}))
 })
 await page.goto('/?scene=commercial-cafe')
 await page.getByLabel('打开手机').click()
}
for(const viewport of [{width:1440,height:900},{width:390,height:844}])test(`${viewport.width} contact footer read-only reproduction`,async({page},info)=>{
 await page.setViewportSize(viewport);await open(page)
 const phone=page.locator('.world-phone')
 await phone.locator('[data-app=contacts]').click();await phone.locator('.world-phone__contact-row').click()
 const content=phone.locator('.world-phone__app-content')
 await content.focus();await page.keyboard.press('End')
 await expect(phone.locator('.world-phone__call-history')).toContainText('暂无通话记录')
 await page.waitForTimeout(300)
 const evidence=await phone.evaluate(e=>{
  const rect=(selector:string)=>{const node=e.querySelector(selector)!;const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,scrollHeight:node.scrollHeight,overflow:getComputedStyle(node).overflow}}
  const indicator=e.querySelector('.world-phone__home-indicator')!.getBoundingClientRect()
  return {content:rect('.world-phone__app-content'),history:rect('.world-phone__call-history'),indicator:rect('.world-phone__home-indicator'),homeCount:e.querySelectorAll('.world-phone__home-screen').length,underIndicator:document.elementsFromPoint(indicator.x+indicator.width/2,indicator.y+indicator.height/2).map(n=>n.className)}
 })
 await info.attach('footer-geometry',{body:JSON.stringify(evidence),contentType:'application/json'})
 expect(evidence.homeCount).toBe(0)
 expect(evidence.content.bottom).toBeLessThanOrEqual(evidence.indicator.top+1)
 expect(evidence.underIndicator.some(c=>String(c).includes('call-history'))).toBe(false)
 await page.screenshot({path:info.outputPath('contact-footer.png')})
})

test('zoom buttons, dragging and pinch relinquish map restore ownership',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page)
 const phone=page.locator('.world-phone');await phone.locator('[data-app=map]').click()
 const canvas=phone.locator('.world-phone__map-viewport'),map=phone.locator('.world-phone__map')
 for(const mode of ['button','drag','pinch']) {
  await phone.getByLabel('回到地图概览').click();await phone.locator('[data-map-region=commercial]').click()
  await expect(map).toHaveAttribute('data-map-zoom','1.650');await expect(canvas).toHaveAttribute('data-camera-moving','false')
  const box=(await canvas.boundingBox())!
  if(mode==='button')await phone.getByLabel('放大地图').click()
  if(mode==='drag'){await page.mouse.move(box.x+25,box.y+35);await page.mouse.down();await page.mouse.move(box.x+60,box.y+55);await page.mouse.up()}
  if(mode==='pinch') {
   const cdp=await page.context().newCDPSession(page),x=box.x+box.width/2,y=box.y+70
   await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true})
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:x-20,y},{id:2,x:x+20,y}]})
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:x-35,y},{id:2,x:x+35,y}]})
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
   await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach()
  }
  await page.waitForTimeout(260)
  const before=await map.getAttribute('style')
  await canvas.click({position:{x:15,y:35}});await expect(phone.locator('.world-phone__map-detail')).toHaveCount(0)
  await page.waitForTimeout(400);await expect(map).toHaveAttribute('style',before!)
 }
})

for(const viewport of [{width:1440,height:900},{width:390,height:844}])test(`${viewport.width} screen island and map restore ownership`,async({page},info)=>{
 await page.setViewportSize(viewport);await open(page)
 const phone=page.locator('.world-phone'),island=phone.locator('.world-phone__handle-mark')
 const relative=()=>island.evaluate(e=>{const r=e.getBoundingClientRect(),screen=e.closest('.world-phone__panel')!.getBoundingClientRect();return {x:r.x-screen.x,y:r.y-screen.y,bottom:r.bottom}})
 await expect(phone).toHaveAttribute('data-phone-phase','open')
 const openPosition=await relative()
 expect(openPosition.y).toBeLessThan(2)
 const header=await phone.locator('.world-phone__header').boundingBox()
 expect(openPosition.bottom).toBeLessThan(header!.y)
 await page.screenshot({path:info.outputPath('open-screen.png')})
 await page.keyboard.press('Escape');await expect(phone).toHaveAttribute('data-phone-phase','closed')
 expect(await phone.locator('.world-phone__body').getAttribute('inert')).not.toBeNull()
 const closedPosition=await relative()
 expect(closedPosition.x).toBeCloseTo(openPosition.x,1);expect(closedPosition.y).toBeCloseTo(openPosition.y,1)
 expect(closedPosition.bottom).toBeLessThanOrEqual(viewport.height)
 await page.screenshot({path:info.outputPath('closed-screen.png')})
 await phone.getByLabel('打开手机').click();await phone.locator('[data-app=map]').click()
 const map=phone.locator('.world-phone__map'),canvas=phone.locator('.world-phone__map-viewport')
 const pose=()=>map.evaluate(e=>{const m=new DOMMatrix(getComputedStyle(e).transform);return {zoom:m.a,x:m.e,y:m.f}})
 await phone.getByLabel('放大地图').click();await page.waitForTimeout(260)
 const box=(await canvas.boundingBox())!
 await page.mouse.move(box.x+25,box.y+35);await page.mouse.down();await page.mouse.move(box.x+50,box.y+50);await page.mouse.up();await page.waitForTimeout(260)
 const before=await pose()
 expect(before.zoom).toBeCloseTo(1.25,2);expect(Math.abs(before.x)+Math.abs(before.y)).toBeGreaterThan(10)
 await phone.locator('[data-map-region=commercial]').click()
 await expect(canvas).toHaveAttribute('data-camera-moving','false');await expect(map).toHaveAttribute('data-map-zoom','1.650')
 await expect(phone.locator('[data-map-region=commercial]')).toHaveCount(0)
 await expect(phone.locator('[data-map-poi]')).toHaveCount(1)
 await expect(phone.locator('[data-map-poi=commercial-cafe]')).toBeVisible()
 await page.screenshot({path:info.outputPath('commercial-tier.png')})
 await phone.locator('[data-map-region=zhongshuyuan]').click();await expect(canvas).toHaveAttribute('data-camera-moving','false')
 await expect(phone.locator('[data-map-region=zhongshuyuan]')).toBeVisible();await expect(phone.locator('[data-map-poi]')).toHaveCount(0)
 await canvas.click({position:{x:15,y:35}})
 await expect(phone.locator('.world-phone__map-detail')).toHaveCount(0);await expect(canvas).toHaveAttribute('data-camera-moving','false')
 await expect.poll(async()=>Math.abs((await pose()).zoom-before.zoom)).toBeLessThan(.005)
 await expect.poll(async()=>Math.abs((await pose()).x-before.x)).toBeLessThan(.05)
 await expect.poll(async()=>Math.abs((await pose()).y-before.y)).toBeLessThan(.05)
 await phone.locator('[data-map-region=mine]').click();await expect(canvas).toHaveAttribute('data-camera-moving','false')
 await expect(phone.locator('[data-map-region=mine]')).toHaveCount(0);await expect(phone.locator('[data-map-poi]')).toHaveCount(1)
 await page.screenshot({path:info.outputPath('mine-tier.png')})
 await canvas.hover({position:{x:20,y:40}});await page.mouse.wheel(0,-80);await page.waitForTimeout(260)
 const manual=await pose();await canvas.click({position:{x:15,y:35}});await page.waitForTimeout(500)
 expect(await pose()).toEqual(manual)
})
