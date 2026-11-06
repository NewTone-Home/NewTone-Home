import {chromium} from '@playwright/test'
import fs from 'node:fs'
const b=await chromium.launch({channel:'chrome',headless:true})
const out=[]
for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 const c=await b.newContext({viewport});const p=await c.newPage();const r={viewport}
 try{
  await p.goto('http://127.0.0.1:4175/?scene=yonghe-mining-perimeter&debugRuntimeEvidence=1',{waitUntil:'networkidle'})
  const actor=p.locator('.scene-protagonist[data-runtime-x]').first()
  const pos=async()=>({x:Number(await actor.getAttribute('data-runtime-x')),y:Number(await actor.getAttribute('data-runtime-y'))})
  const door=p.locator('button[data-focus-target-group="door:yonghe-street-entry"]').first()
  await door.click({timeout:5000})
  await p.waitForFunction(()=>Number(document.querySelector('.scene-protagonist[data-runtime-x]')?.getAttribute('data-runtime-x'))<38.4,{},{timeout:15000})
  await p.waitForTimeout(1200)
  r.entered=await pos()
  const gy=28/1080*100,gx=28/1920*100,y=8+9*gy
  r.groundClicks=[]
  for(const x of [40-4*gx,40-8*gx,40-12*gx]){
   await p.waitForTimeout(800); let rect=await p.locator('.scene-mainline-world').first().boundingBox()
   let sx=rect.x+x/100*rect.width,sy=rect.y+y/100*rect.height
   for(let attempt=0;(sx<1||sx>viewport.width-1)&&attempt<6;attempt++){ const edgeX=sx<1?Math.max(15,viewport.width*.12):viewport.width*.88; await p.mouse.click(edgeX,sy); await p.waitForTimeout(1100); rect=await p.locator('.scene-mainline-world').first().boundingBox();sx=rect.x+x/100*rect.width;sy=rect.y+y/100*rect.height }
   if(sx<1||sx>viewport.width-1||sy<1||sy>viewport.height-1)throw Error(`target not visible ${sx},${sy}`)
   await p.mouse.click(sx,sy)
   await p.waitForFunction(target=>Math.abs(Number(document.querySelector('.scene-protagonist[data-runtime-x]')?.getAttribute('data-runtime-x'))-target)<.6,x,{timeout:8000})
   r.groundClicks.push(await pos())
  }
  await p.waitForTimeout(4500)
  r.deep=await pos()
  const host=p.locator('[data-storefront-id="yonghe-slot-2"][data-storefront-label-phase]')
  r.deepSignPhase=await host.getAttribute('data-storefront-label-phase')
  r.deepDoorFrame=await door.locator('.scene-focus-frame').first().getAttribute('data-focus-frame-phase').catch(()=>null)
  await p.screenshot({path:`.mining-evidence/deep-${viewport.width}.png`})
  await p.reload({waitUntil:'networkidle'});await p.waitForTimeout(1000);r.afterRefresh=await pos()
  await p.locator('button[data-focus-target-group="door:yonghe-street-entry"]').first().click({timeout:5000})
  await p.waitForFunction(()=>Number(document.querySelector('.scene-protagonist[data-runtime-x]')?.getAttribute('data-runtime-x'))>40.5,{},{timeout:15000})
  r.exited=await pos();r.sameScene=await p.locator('.mainline-scene-stage').first().getAttribute('data-mainline-scene')
 }catch(e){r.error=e.message;await p.screenshot({path:`.mining-evidence/deep-failure-${viewport.width}.png`}).catch(()=>{})}
 out.push(r);console.log(JSON.stringify(r));await c.close()
}
await b.close();fs.writeFileSync('.mining-evidence/deep-browser.json',JSON.stringify(out,null,2))
