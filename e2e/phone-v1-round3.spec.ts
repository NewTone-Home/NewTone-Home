import {registerPhoneTestNetwork} from './phoneTestNetwork'
registerPhoneTestNetwork()
import {expect,test,type Page} from '@playwright/test'
import {mainlineRidePickupPositions} from '../src/center/runtime/mainlineRide'
import {mainlineScenes} from '../src/center/runtime/mainlineScenes'
import {join} from 'node:path'

async function seed(page:Page,scene='commercial-street'){
 await page.addInitScript(scene=>{localStorage.setItem('newtone-public-release-cutover-v1','center-v1');if(!localStorage.getItem('newtone-player-save-v1'))localStorage.setItem('newtone-player-save-v1',JSON.stringify({currentSceneId:scene,currentPosition:scene==='commercial-street'?{x:184,y:65}:null,phoneDevice:'inner',sceneState:{'commercial-cafe':{commercialCafeStoryStatus:'complete'}},updatedAt:100}));},scene)
 await page.goto('/?scene='+scene)
}
async function reading(page:Page){for(let i=0;i<25;i++){const shield=page.locator('[data-scene-dialogue-shield=true]');if(!await shield.count())return;await expect(page.locator('[data-scene-observation-typing=true]')).toHaveCount(0,{timeout:15000});await shield.click({force:true});}}
async function point(page:Page,p:{x:number;y:number}){const s=await page.locator('.mainline-scene-stage').evaluate((e,p)=>{const r=e.getBoundingClientRect(),w=e.querySelector<HTMLElement>('.scene-mainline-world')!,m=w.style.transform.match(/translate\(([-\d.]+)%, ([-\d.]+)%\)/)!;return{x:Math.max(r.left+15,Math.min(r.right-15,r.left+r.width*(p.x+Number(m[1]))/100)),y:r.top+r.height*(p.y+Number(m[2]))/100}},p);await page.mouse.click(s.x,s.y)}
async function walkStreet(page:Page,target:number){for(let step=0;step<30;step++){await reading(page);const actor=page.locator('[data-actor-id=protagonist]');const x=await actor.evaluate(e=>parseFloat((e as HTMLElement).style.left));if(Math.abs(x-target)<2)return;await point(page,{x:x+Math.sign(target-x)*Math.min(22,Math.abs(target-x)),y:46});await expect.poll(()=>actor.evaluate(e=>parseFloat((e as HTMLElement).style.left))).not.toBe(x);await expect(actor).not.toHaveClass(/is-moving/,{timeout:15000});}throw new Error('Street destination unreachable')}
async function capture(page:Page,name:string){await expect(page.locator('.world-phone__app-view')).toHaveCSS('transform','none');await page.screenshot({animations:'disabled',path:process.env.PHONE_SCREENSHOT_DIR?join(process.env.PHONE_SCREENSHOT_DIR,name+'.png'):test.info().outputPath(name+'.png')})}
for(const viewport of [{width:1440,height:900},{width:390,height:844}])test(`${viewport.width} Street to seated Cafe order persists and boards only at the official exit`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize(viewport);await seed(page)
 await walkStreet(page,185);await page.locator('[data-focus-target-group="door:street-cafe-entry"]').first().click()
 await expect(page.locator('.scene-shell[data-mainline-scene=commercial-cafe]')).toBeVisible({timeout:20000})
 await reading(page);await page.locator('[data-object-id="commercial-cafe-bottom-right-group-chair-right"]').click()
 await expect(page.getByLabel('修杰，已坐下')).toBeVisible({timeout:15000})
 await page.getByLabel('打开手机').click();const phone=page.locator('.world-phone')
 await phone.locator('[data-app=ride]').click();await phone.getByRole('button',{name:/中枢院.*从当前位置出发/}).click()
 await expect(phone.getByRole('button',{name:'更换目的地',exact:true})).toHaveCSS('border-top-style','solid')
 await phone.getByRole('button',{name:/^舒适型/}).click();await phone.getByRole('button',{name:'确认叫车',exact:true}).click()
 await expect(phone.getByText('正在叫车…',{exact:true})).toBeVisible()
 const order=phone.locator('[data-ride-order=true]');await expect(order).toBeVisible();await expect(order).toContainText('舒适型');await expect(order).toContainText('中枢院');await expect(order).not.toContainText(/商业街口|办公室出口|矿区入口/)
 const arrival=await order.locator('dd').last().textContent();await capture(page,`${viewport.width}-round3-cafe-order`)
 const pickupLabel=await phone.locator('[data-map-region^=exit] span').boundingBox(),controls=await phone.getByRole('group',{name:'地图缩放',exact:true}).boundingBox()
 if(pickupLabel&&controls&&pickupLabel.y<controls.y+controls.height)expect(pickupLabel.x+pickupLabel.width).toBeLessThanOrEqual(controls.x)
 await page.keyboard.press('Escape');await expect(phone).toHaveAttribute('data-phone-phase','closed');await page.getByLabel('打开手机').click()
 if(await phone.locator('[data-notification-app=ride]').isVisible())await phone.locator('[data-notification-app=ride]').click();else await phone.locator('[data-app=ride]').click()
 await expect(order).toContainText('舒适型');await expect(order.locator('dd').last()).toHaveText(arrival!)
 await page.reload();await reading(page);await page.getByLabel('打开手机').click()
 if(await phone.locator('[data-notification-app=ride]').isVisible())await phone.locator('[data-notification-app=ride]').click();else await phone.locator('[data-app=ride]').click()
 await expect(order).toContainText('舒适型');await expect(order.locator('dd').last()).toHaveText(arrival!)
 await expect(order).toContainText('司机已到达',{timeout:30000});await expect(page.locator('.center-long-distance-travel')).toHaveCount(0)
 await expect(phone.locator('[data-map-region^=exit]')).toHaveAttribute('aria-label',/上车点/)
 await page.keyboard.press('Escape');await page.locator('[data-focus-target-group="door:street-cafe-entry"]').first().click()
 await expect(page.locator('.scene-shell[data-mainline-scene=commercial-street]')).toBeVisible({timeout:20000})
 const exit=mainlineRidePickupPositions('commercial-street')[0],contract=mainlineScenes['commercial-street'].externalExits[0]
 await walkStreet(page,exit.x+3);await point(page,{...exit,[contract.axis]:exit[contract.axis]+contract.direction})
 await expect(page.locator('.scene-shell[data-mainline-scene=zhongshuyuan-office]')).toBeVisible({timeout:20000})
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('newtone-player-save-v1')!).sceneState['commercial-street'].rideVehicle)).toBeNull()
})

test('real rejection reports a visible failure instead of silently restoring confirmation',async({page})=>{
 await page.route('**/src/center/runtime/mainlineRide.ts*',async route=>{const response=await route.fetch();const body=await response.text();const marker='function mainlineRideWalkingEtaMs(sceneId, position, context) {';expect(body).toContain(marker);await route.fulfill({response,body:body.replace(marker,marker+' return null;')})})
 await seed(page,'commercial-cafe');await page.getByLabel('打开手机').click();const phone=page.locator('.world-phone');await phone.locator('[data-app=ride]').click();await phone.getByRole('button',{name:/中枢院.*从当前位置出发/}).click();await phone.getByRole('button',{name:/^快车/}).click();await phone.getByRole('button',{name:'确认叫车',exact:true}).click()
 await expect(phone.getByRole('alert')).toContainText('暂时无法找到通往上车点的路线');await expect(phone.locator('[data-ride-order=true]')).toHaveCount(0);await expect(phone.getByRole('button',{name:'确认叫车',exact:true})).toBeEnabled()
})

test('destination motion, notification flow, copy and scrolling remain bounded',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page,'commercial-cafe');await page.getByLabel('打开手机').click();const phone=page.locator('.world-phone');await phone.locator('[data-app=map]').click();await expect(phone).not.toContainText('区域示意 · 连线表示交通关联')
 const target=phone.locator('[data-map-region=zhongshuyuan]');await target.dispatchEvent('pointerdown',{pointerId:1,button:0,clientX:200,clientY:300});expect(await phone.locator('.world-phone__map').evaluate(e=>getComputedStyle(e).transitionDuration)).not.toBe('0s');await target.dispatchEvent('pointerup',{pointerId:1});await target.click();await expect(phone.locator('.world-phone__map-viewport')).toHaveAttribute('data-dragging','false')
 await phone.getByText('叫车前往',{exact:true}).click();await expect(phone.locator('.world-phone__ride-sheet')).toHaveCSS('scrollbar-width','none');await phone.getByRole('button',{name:'更换目的地',exact:true}).click();await phone.getByRole('button',{name:/矿区.*从当前位置出发/}).click();await expect(phone.locator('[data-trip-minutes]')).toHaveAttribute('data-trip-minutes','18')
 await phone.getByRole('button',{name:/^商务型/}).click();await phone.getByRole('button',{name:'确认叫车',exact:true}).click();await expect(phone.locator('[data-ride-order=true]')).toBeVisible();await page.keyboard.press('Escape')
 await expect(phone.locator('.world-phone__notification-flow')).toBeVisible({timeout:30000});await expect(phone.locator('.world-phone__notification-flow')).toHaveCount(0);await expect(phone.locator('.world-phone__notification-dot')).toBeVisible();await expect(phone).toHaveAttribute('data-phone-phase','closed')
 await page.screenshot({path:process.env.PHONE_SCREENSHOT_DIR?join(process.env.PHONE_SCREENSHOT_DIR,'390-round3-metal-capsule.png'):test.info().outputPath('capsule.png')})
 await page.reload();await expect(phone.locator('.world-phone__notification-dot')).toBeVisible();await expect(phone.locator('.world-phone__notification-flow')).toHaveCount(0)
 await page.getByLabel('打开手机').click();await phone.locator('.world-phone__lock-hint').click();await phone.locator('[data-app=contacts]').click();await phone.locator('.world-phone__contact-row').click();await expect(phone.getByLabel('联系人备注')).toHaveAttribute('placeholder','添加备注');await expect(phone).not.toContainText('我的备注')
})
