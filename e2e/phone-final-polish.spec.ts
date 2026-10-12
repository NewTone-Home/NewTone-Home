import {expect,test,type Page} from '@playwright/test'
import {registerPhoneTestNetwork} from './phoneTestNetwork'
import {mainlineScenes} from '../src/center/runtime/mainlineScenes'
registerPhoneTestNetwork()
async function seed(page:Page,milkTeaUnlocked=false){
 await page.addInitScript(milkTeaUnlocked=>{localStorage.setItem('newtone-public-release-cutover-v1','center-v1');if(!localStorage.getItem('newtone-player-save-v1'))localStorage.setItem('newtone-player-save-v1',JSON.stringify({currentSceneId:'commercial-cafe',phoneDevice:'inner',sceneState:{'commercial-cafe':{commercialCafeStoryStatus:'complete'},'commercial-street':{commercialStreetMilkTeaAppUnlocked:milkTeaUnlocked}},updatedAt:100}))},milkTeaUnlocked)
 await page.goto('/?scene=commercial-cafe')
 for(let i=0;i<25;i++){const shield=page.locator('[data-scene-dialogue-shield=true]');if(!await shield.count())break;await expect(page.locator('[data-scene-observation-typing=true]')).toHaveCount(0,{timeout:15000});await shield.click({force:true})}
}
for(const viewport of [{width:1440,height:900},{width:390,height:844}])test(viewport.width+' camera frames, notification orbit and phone scroll',async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize(viewport);await seed(page);
 const phone=page.locator('.world-phone')
 await page.getByLabel('打开手机').click();await phone.locator('[data-app=ride]').click();
 await phone.getByRole('button',{name:/中枢院.*从当前位置出发/}).click()
 await expect(phone.locator('[data-map-world=inner]')).toHaveAttribute('data-map-zoom','1.650');
 await phone.getByRole('button',{name:'更换目的地',exact:true}).click()
 await phone.getByRole('button',{name:/矿区.*从当前位置出发/}).click()
 const framesPromise=phone.locator('.world-phone__map').evaluate(async e=>{
  const values:{time:number;scale:number;x:number;y:number}[]=[];const begin=performance.now()
  await new Promise<void>(resolve=>{const tick=()=>{const m=new DOMMatrix(getComputedStyle(e).transform);values.push({time:performance.now()-begin,scale:m.a,x:m.e,y:m.f});if(performance.now()-begin<1700)requestAnimationFrame(tick);else resolve()};tick()})
  return values
 })
 await page.waitForTimeout(350);await page.screenshot({path:info.outputPath('camera-pulled-out.png')})
 await page.waitForTimeout(650);await page.screenshot({path:info.outputPath('camera-approaching.png')})
 const frames=await framesPromise
 await info.attach('camera-frames',{body:JSON.stringify(frames),contentType:'application/json'})
 expect(Math.min(...frames.map(f=>f.scale))).toBeLessThan(1.1)
 expect(frames.at(-1)!.scale).toBeCloseTo(1.65,2)
 const finalArrival=frames.findIndex((f,i)=>i>20 && f.scale>1.64 && frames.slice(i).every(next=>next.scale>1.64))
 expect(frames[finalArrival].time).toBeGreaterThan(1100)
 expect(frames[finalArrival].time).toBeLessThan(1600)
 expect(frames.filter(f=>f.scale<1.1).some((f,i,all)=>i>0&&Math.hypot(f.x-all[0].x,f.y-all[0].y)>2)).toBe(true)
 await page.screenshot({path:info.outputPath('focused-map.png')})
 await phone.getByRole('button',{name:/^快车/}).click();await phone.getByRole('button',{name:'确认叫车',exact:true}).click()
 await expect(phone.locator('[data-ride-order=true]')).toBeVisible()
 const rideMap=phone.locator('[data-ride-map-scene="commercial-cafe"]')
 await expect(rideMap).toBeVisible();await expect(rideMap.locator('[data-map-region=player]')).toBeVisible();await expect(rideMap.locator('[data-map-region=ride-goal]')).toBeVisible()
 const mapBox=rideMap.locator('svg.world-phone__map')
 await expect(mapBox).toHaveAttribute('viewBox',`${mainlineScenes['commercial-cafe'].walkBounds.x} ${mainlineScenes['commercial-cafe'].walkBounds.y} ${mainlineScenes['commercial-cafe'].walkBounds.width} ${mainlineScenes['commercial-cafe'].walkBounds.height}`)
 const playerMarker=await rideMap.locator('[data-map-region=player]').boundingBox()
 expect(playerMarker?.width).toBe(44);expect(playerMarker?.height).toBe(44)
 await rideMap.screenshot({path:info.outputPath('ride-local-cafe-map.png')})
 await page.keyboard.press('Escape')
 const flow=phone.locator('.world-phone__notification-flow')
 await expect(flow).toBeVisible({timeout:30000})
 await flow.evaluate(e=>{for(const node of [e,...e.querySelectorAll('path')])for(const animation of node.getAnimations())animation.pause()})
 const endpoints=await flow.locator('path').first().evaluate(e=>{const path=e as SVGPathElement;const a=path.getPointAtLength(0),b=path.getPointAtLength(path.getTotalLength());return Math.hypot(a.x-b.x,a.y-b.y)})
 expect(endpoints).toBeGreaterThan(80)
 const route=await flow.locator('path').first().evaluate(e=>{const p=e as SVGPathElement,n=p.getTotalLength();return [0,.1,.5,.9,1].map(t=>{const point=p.getPointAtLength(n*t);return {x:point.x,y:point.y}})})
 expect(route[0].x).toBeLessThan(2);expect(route.at(-1)!.x).toBeGreaterThan(88)
 expect(route[2].y).toBe(9)
 await info.attach('notification-sweep-path',{body:JSON.stringify(route),contentType:'application/json'})
 const offsets:number[]=[]
 for(let index=0;index<4;index++){
  await flow.evaluate((e,time)=>{for(const node of [e,...e.querySelectorAll('path')])for(const animation of node.getAnimations())animation.currentTime=time},index*300)
  offsets.push(await flow.locator('path').first().evaluate(e=>parseFloat(getComputedStyle(e).strokeDashoffset)))
  await page.screenshot({path:info.outputPath('orbit-'+index+'.png')})
  await phone.locator('.world-phone__handle-mark').screenshot({path:info.outputPath('orbit-detail-'+index+'.png')})

 }
 expect(offsets[3]).toBeLessThan(offsets[0]-50)
 await flow.evaluate(e=>{for(const node of [e,...e.querySelectorAll('path')])for(const animation of node.getAnimations())animation.play()})
 await expect(flow).toHaveCount(0);await expect(phone.locator('.world-phone__notification-dot')).toBeVisible()
 const dot=phone.locator('.world-phone__notification-dot'),capsule=phone.locator('.world-phone__handle-mark')
 const centered=await dot.evaluate((e,parent)=>{const a=e.getBoundingClientRect(),b=parent.getBoundingClientRect();return Math.abs((a.top+a.height/2)-(b.top+b.height/2))},await capsule.elementHandle())
 expect(centered).toBeLessThanOrEqual(0.5)
 const fade=await dot.evaluate(e=>{const animation=e.getAnimations().find(a=>(a as CSSAnimation).animationName==='phone-notification-dot-enter') as CSSAnimation|undefined;if(!animation)return null;animation.pause();animation.currentTime=0;const start=Number(getComputedStyle(e).opacity);animation.currentTime=120;const middle=Number(getComputedStyle(e).opacity);animation.currentTime=240;const end=Number(getComputedStyle(e).opacity);animation.play();return {start,middle,end}})
 expect(fade).not.toBeNull();expect(fade!.start).toBeLessThan(fade!.middle);expect(fade!.middle).toBeLessThan(fade!.end)
 await expect(phone).toHaveAttribute('data-phone-phase','closed')
 await page.screenshot({path:info.outputPath('capsule.png')})
 await page.getByLabel('打开手机').click();await expect(phone.getByLabel('手机通知')).toContainText('司机已到达')
 await phone.locator('.world-phone__lock-hint').click()
 const home=phone.locator('.world-phone__home-screen');await expect(home).toHaveCSS('scrollbar-width','none')
 await phone.locator('[data-app=contacts]').click();await expect(phone.locator('.world-phone__app-content')).toHaveCSS('scrollbar-width','none')
 await page.keyboard.press('Escape');await page.reload();await expect(flow).toHaveCount(0);await expect(phone.locator('.world-phone__notification-dot')).toBeVisible()
})

for(const reduced of [false,true])test('visible notifications are consumed without replay; reduced motion='+reduced,async({page})=>{
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await seed(page)
 const phone=page.locator('.world-phone');await page.getByLabel('打开手机').click();await phone.locator('[data-app=ride]').click()
 await phone.getByRole('button',{name:/中枢院.*从当前位置出发/}).click();await phone.getByRole('button',{name:/^快车/}).click();await phone.getByRole('button',{name:'确认叫车',exact:true}).click()
 await expect(phone.locator('[data-ride-order=true]')).toContainText('司机已到达',{timeout:30000})
 await expect(phone.locator('.world-phone__notification-flow')).toHaveCount(0)
 await page.keyboard.press('Escape');await expect(phone).toHaveAttribute('data-phone-phase','closed')
 await expect(phone.locator('.world-phone__notification-dot')).toBeVisible();await expect(phone.locator('.world-phone__notification-flow')).toHaveCount(0)
 if(reduced)await expect(phone.locator('.world-phone__notification-dot')).toHaveCSS('animation-name','none')
})
test('home overflow remains keyboard and wheel accessible with no native scrollbar',async({page})=>{
 await page.setViewportSize({width:390,height:500});await seed(page);await page.getByLabel('打开手机').click()
 const home=page.locator('.world-phone__home-screen');await expect(home).toHaveCSS('scrollbar-width','none')
 expect(await home.evaluate(e=>e.scrollHeight-e.clientHeight)).toBeGreaterThan(0)
 await home.focus();await page.keyboard.press('End');await expect.poll(()=>home.evaluate(e=>e.scrollTop)).toBeGreaterThan(0)
 await page.keyboard.press('Home');await expect.poll(()=>home.evaluate(e=>e.scrollTop)).toBe(0)
 await home.hover();await page.mouse.wheel(0,300);await expect.poll(()=>home.evaluate(e=>e.scrollTop)).toBeGreaterThan(0)
 await expect(page.locator('.world-phone__home-indicator')).toHaveCount(0)
 await page.locator('.world-phone [data-app=contacts]').click();await expect(page.locator('.world-phone__home-indicator')).toBeVisible()
})

test('real milk tea ready deadline stays closed and opens notification only on demand',async({page})=>{
 test.setTimeout(60000);await seed(page,true);const phone=page.locator('.world-phone')
 await page.getByLabel('打开手机').click();await phone.locator('[data-app=milk-tea]').click()
 await phone.getByRole('button',{name:'黑糖珍珠奶茶',exact:true}).click();await phone.getByRole('button',{name:'正常',exact:true}).click();await phone.getByRole('button',{name:'少冰',exact:true}).click();await phone.getByRole('button',{name:'确认下单',exact:true}).click()
 await expect(phone.getByText('取餐号 001',{exact:true})).toBeVisible();await page.keyboard.press('Escape')
 await expect(phone.locator('.world-phone__notification-dot')).toBeVisible({timeout:45000});await expect(phone).toHaveAttribute('data-phone-phase','closed')
 await page.getByLabel('打开手机').click();await expect(phone.locator('[data-notification-app=milk-tea]')).toContainText('奶茶已制作完成')
 await phone.locator('[data-notification-app=milk-tea]').click();await expect(phone.getByText('已完成',{exact:true})).toBeVisible()
})

test('manual map input cancels automatic travel; sheet resize does not replay it',async({page})=>{
 await seed(page);const phone=page.locator('.world-phone');await page.getByLabel('打开手机').click();await phone.locator('[data-app=ride]').click()
 await phone.getByRole('button',{name:/中枢院.*从当前位置出发/}).click();const map=phone.locator('.world-phone__map'),viewport=phone.locator('.world-phone__map-viewport')
 await expect(viewport).toHaveAttribute('data-camera-moving','false');await phone.getByRole('button',{name:'更换目的地',exact:true}).click();await phone.getByRole('button',{name:/矿区.*从当前位置出发/}).click()
 await expect(viewport).toHaveAttribute('data-camera-moving','true');await viewport.hover({position:{x:30,y:40}});await page.mouse.wheel(0,100)
 await expect(viewport).toHaveAttribute('data-camera-moving','false');const interrupted=await map.getAttribute('data-map-zoom')
 await page.waitForTimeout(1600);await expect(map).toHaveAttribute('data-map-zoom',interrupted!)
 await phone.getByLabel('展开叫车面板').click();await expect(viewport).toHaveAttribute('data-camera-moving','false');await expect(map).toHaveAttribute('data-map-zoom',interrupted!)
})
