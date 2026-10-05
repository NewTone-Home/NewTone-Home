import {writeFile} from 'node:fs/promises'
import {expect,test,type Page} from '@playwright/test'
import {mainlineScenes} from '../src/center/runtime/mainlineScenes'
import {mainlineProtagonistDotFootprint} from '../src/center/runtime/sceneLayout'
import {createMainlineSceneGeometrySnapshot} from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import {navigationBarrierBlocksTravel,navigationBarrierIntersectsActor} from '../src/center/runtime/scenePathfinding'
import {isMainlineExternalExitTriggered} from '../src/center/runtime/mainlineExternalExit'
async function screenPoint(page:Page,p:{x:number,y:number}){
 return await page.locator('.mainline-scene-stage').evaluate((e,p)=>{const r=e.getBoundingClientRect(),o=e.querySelector<HTMLElement>('.scene-mainline-world')!.style.transform.match(/translate\(([-\d.]+)%, ([-\d.]+)%\)/)!;return {x:r.x+r.width*(p.x+Number(o[1]))/100,y:r.y+r.height*(p.y+Number(o[2]))/100}},p)
}
async function point(page:Page,p:{x:number,y:number}){const screen=await screenPoint(page,p);await page.mouse.click(screen.x,screen.y)}
async function arrived(page:Page,p:{x:number,y:number}){
 const metrics=await page.locator('.mainline-scene-stage').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))
 await expect.poll(async()=>{const a=await position(page);return Math.hypot((a.x-p.x)*metrics.width/100,(a.y-p.y)*metrics.height/100)},{timeout:15000}).toBeLessThan(1)
}
async function position(page:Page){return page.locator('[data-actor-id="protagonist"]').evaluate(e=>({x:parseFloat((e as HTMLElement).style.left),y:parseFloat((e as HTMLElement).style.top)}))}
async function finishObservation(page:Page){
 const echo=page.locator('[data-scene-echo]'),shield=page.locator('[data-scene-dialogue-shield="true"]')
 const count=Number(await echo.getAttribute('data-scene-segment-count'))
 for(let i=0;i<count;i++){
  await expect(echo).toHaveAttribute('data-scene-observation-typing','false',{timeout:15000})
  const index=Number(await echo.getAttribute('data-scene-segment-index'))
  await shield.click({force:true})
  if(index+1<count)await expect(echo).toHaveAttribute('data-scene-segment-index',String(index+1));else await expect(shield).toHaveCount(0)
 }
}
for(const height of [720,1080]) test('incense eight real approaches keep actual footprint clear '+height,async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1280,height})
 await page.goto('/?scene=jijia-ancestral-interior&debugRuntimeEvidence=1')
 const metrics={width:1280,height},scene=mainlineScenes['jijia-ancestral-interior'],snapshot=createMainlineSceneGeometrySnapshot(scene,scene.initialPlayerPosition,{},metrics),body=mainlineProtagonistDotFootprint(scene.initialPlayerPosition,metrics),records:any[]=[]
 for(const start of [{x:55.2,y:35},{x:70,y:50.2},{x:55.2,y:65},{x:40,y:50.2},{x:40,y:35},{x:70,y:35},{x:40,y:65},{x:70,y:65}]){
  await point(page,start);await arrived(page,start)
  const sampling=page.evaluate(async()=>{const samples:any[]=[];const end=performance.now()+15000;while(performance.now()<end){await new Promise<void>(r=>requestAnimationFrame(()=>r()));const a=document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')!;samples.push({x:Number(a.dataset.runtimeX),y:Number(a.dataset.runtimeY)});if(document.querySelector('[data-scene-echo="jijia-incense-burner"]'))break}return samples})
  await page.locator('[data-object-id="jijia-incense-burner"]').click()
  await expect(page.locator('[data-scene-echo="jijia-incense-burner"]')).toBeVisible({timeout:15000})
  const selected=await position(page),samples=await sampling
  expect(snapshot.navigationBarriers.some(b=>navigationBarrierIntersectsActor(selected,body,b))).toBe(false)
  const crossings=samples.slice(1).flatMap((p,i)=>snapshot.navigationBarriers.filter(b=>navigationBarrierBlocksTravel(samples[i],p,b,body)))
  expect(crossings).toEqual([]);records.push({start,selected,barrierCrossings:crossings.length})
  await finishObservation(page)
 }
 await writeFile(info.outputPath('incense-final-candidates.json'),JSON.stringify(records,null,2))
 await page.screenshot({path:info.outputPath('incense-legal-diagonal-stance.png')})
 // Offering-table interaction remains owned by the same ordinary resolver.
 await page.locator('[data-object-id="jijia-offering-table-south"]').click()
 await expect(page.locator('[data-scene-echo="jijia-offering-table-south"]')).toBeVisible({timeout:15000})
})
async function enablePhone(page:Page){
 await page.goto('/?scene=zhongshuyuan-office&debugRuntimeEvidence=1')
 await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
 await expect(page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')).toHaveAttribute('data-scene-observation-typing','false',{timeout:15000})
 await page.locator('[data-scene-dialogue-shield="true"]').click({force:true})
 await page.getByRole('button',{name:'换手机',exact:true}).click()
 await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-device','inner')
 await page.getByLabel('收起手机').click()
}
async function ride(page:Page,destination:string,close=true){
 if(!await page.locator('.world-phone.is-open').count())await page.getByLabel('打开手机').click()
 await page.locator('[data-app="ride"]').click()
 await page.getByRole('button',{name:new RegExp(destination+'.*从当前位置出发')}).click()
 await page.getByRole('button',{name:'呼叫车辆前往'+destination,exact:true}).click()
 if(close)await page.getByLabel('收起手机').click()
}
async function deadline(page:Page,id:string){return page.evaluate(id=>JSON.parse(localStorage.getItem('newtone-player-save-v1')!).sceneState[id].rideDriverArrivesAt,id)}
async function travel(page:Page,id:string){await expect(page.locator('.center-long-distance-travel')).toBeVisible({timeout:15000});await expect(page.locator('.scene-shell[data-mainline-scene="'+id+'"]')).toBeVisible({timeout:20000});await expect(page.locator('.center-long-distance-travel')).toHaveCount(0,{timeout:10000})}
test('Street stationary exit boards at real arrival deadline outside former circle',async({page},info)=>{
 test.setTimeout(60000);await enablePhone(page)
 await ride(page,'商业街');await expect(page.locator('[data-notification-app="ride"]')).toBeVisible({timeout:15000});await page.locator('[data-notification-app="ride"]').click();await page.getByLabel('收起手机').click();await point(page,{x:10,y:50});await travel(page,'commercial-street')
 // Normal walking to the entrance's upper public lane, no save/state injection.
 if(await page.locator('.world-phone.is-open').count())await page.getByLabel('收起手机').click()
 await point(page,{x:14,y:46});await arrived(page,{x:14,y:46})
 await point(page,{x:12.3,y:38});await arrived(page,{x:12.3,y:38})
 // Prepare both input locations before ordering; send genuine mouse clicks without post-click locator settling overhead.
 await page.getByLabel('打开手机').click();await page.locator('[data-app="ride"]').click()
 await page.getByRole('button',{name:/中枢院.*从当前位置出发/}).click()
 const orderButton=await page.getByRole('button',{name:'呼叫车辆前往中枢院',exact:true}).boundingBox(),exitScreen=await screenPoint(page,{x:11.8,y:38})
 const observation=page.evaluate(async()=>{
  const samples:any[]=[];let due=0
  while(true){await new Promise<void>(r=>requestAnimationFrame(()=>r()));const state=JSON.parse(localStorage.getItem('newtone-player-save-v1')!).sceneState['commercial-street'];due=state.rideDriverArrivesAt??due;const a=document.querySelector<HTMLElement>('.scene-shell[data-mainline-scene="commercial-street"] [data-actor-id="protagonist"]');if(!a||due&&Date.now()>due+200)break;samples.push({t:Date.now(),x:parseFloat(a.style.left),y:parseFloat(a.style.top),moving:a.classList.contains('is-moving')})}
  return {samples,due}
 })
 await page.mouse.click(orderButton!.x+orderButton!.width/2,orderButton!.y+orderButton!.height/2)
 await page.mouse.click(exitScreen.x,exitScreen.y)
 const {samples,due}=await observation,stationary=samples.find(p=>p.x<=12&&!p.moving),before=stationary
 expect(stationary).toBeDefined();expect(stationary.t).toBeLessThan(due)
 expect(isMainlineExternalExitTriggered(before,mainlineScenes['commercial-street'].externalExits[0],mainlineScenes['commercial-street'])).toBe(true)
 expect(Math.hypot((before.x-12)*12.8,(before.y-50)*7.2)).toBeGreaterThan(18)
 expect(samples.filter(p=>p.t>=stationary.t&&p.t<due).every(p=>!p.moving&&Math.hypot(p.x-stationary.x,p.y-stationary.y)<.01)).toBe(true)
 await travel(page,'zhongshuyuan-office')
 await writeFile(info.outputPath('stationary-exit.json'),JSON.stringify({before,stationary,driverArrivesAt:due,samples,noInputAfterArrival:true,boarded:true}))
})
for(const side of [0,1]) test('Office real exit '+side+' boards after driver arrival',async({page})=>{
 await enablePhone(page);await ride(page,'商业街')
 await expect(page.locator('[data-notification-app="ride"]')).toBeVisible({timeout:15000})
 await page.locator('[data-notification-app="ride"]').click();await page.getByLabel('收起手机').click()
 const exit=mainlineScenes['zhongshuyuan-office'].externalExits[side],y=exit.triggerSpan!.start+.5
 await point(page,{x:exit.threshold+exit.direction,y})
 await travel(page,'commercial-street')
})

test('real reading defers arrival notification and remains able to board after finishing',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await enablePhone(page)
 const plant=page.locator('[data-object-id="zhongshuyuan-office-port-plant-left-bottom"]')
 await plant.click();await expect(page.locator('[data-scene-echo="zhongshuyuan-office-port-plant-left-bottom"]')).toBeVisible();await finishObservation(page)
 await page.getByLabel('打开手机').click();await page.locator('[data-app="ride"]').click()
 await page.getByRole('button',{name:/商业街.*从当前位置出发/}).click()
 const button=await page.getByRole('button',{name:'呼叫车辆前往商业街',exact:true}).boundingBox(),plantRect=await plant.boundingBox()
 await page.mouse.click(button!.x+button!.width/2,button!.y+button!.height/2)
 await page.mouse.click(plantRect!.x+plantRect!.width/2,plantRect!.y+plantRect!.height/2)
 await expect(page.locator('[data-scene-echo="zhongshuyuan-office-port-plant-left-bottom"]')).toBeVisible()
 const due=await deadline(page,'zhongshuyuan-office'),at=await position(page)
 await expect.poll(()=>Date.now(),{timeout:15000}).toBeGreaterThanOrEqual(due)
 await expect(page.locator('[data-scene-dialogue-shield="true"]')).toBeVisible()
 await expect(page.locator('.center-long-distance-travel')).toHaveCount(0)
 expect(await position(page)).toEqual(at)
 await finishObservation(page)
 if(await page.locator('.world-phone.is-open').count())await page.getByLabel('收起手机').click()
 await point(page,{x:9,y:50});await travel(page,'commercial-street')
 await writeFile(info.outputPath('reading-arrival.json'),JSON.stringify({at,driverArrivesAt:due,readingUninterrupted:true,boardedAfterEnteringExit:true}))
})
