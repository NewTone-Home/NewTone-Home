import { chromium } from '@playwright/test'
import fs from 'node:fs'
const browser = await chromium.launch({channel:'chrome',headless:true})
const results=[]
const gy=28/1080*100,gx=28/1920*100
const names=['修鞋','永和小馆','药店','五金店','小吃','面馆','修理','早点']
let cursor=8
const shops=names.map((label,index)=>{const n=Array.from(label).length;const top=cursor;cursor+=(n+3)*gy;return {label,index,n,y:top+(2+Math.floor(n/2))*gy,id:index===1?'yonghe-street-entry':`mining-shop-door-${index+1}`}})
for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 for(const shop of [shops[1],shops[2],shops[3]]){
  const context=await browser.newContext({viewport})
  const page=await context.newPage()
  const row={viewport,label:shop.label}
  try{
   await page.goto(`http://127.0.0.1:4175/?scene=yonghe-mining-perimeter&entryX=${40+1.5*gx}&entryY=${shop.y}&debugRuntimeEvidence=1`,{waitUntil:'networkidle',timeout:20000})
   await page.waitForTimeout(2200)
   const actor=page.locator('.scene-protagonist[data-runtime-x]').first()
   const pos=async()=>({x:Number(await actor.getAttribute('data-runtime-x')),y:Number(await actor.getAttribute('data-runtime-y'))})
   row.before=await pos()
   row.phase=await page.locator(`[data-storefront-id="yonghe-slot-${shop.index+1}"][data-storefront-label-phase]`).getAttribute('data-storefront-label-phase')
   await page.screenshot({path:`.mining-evidence/near-${shop.n}-${viewport.width}.png`})
   const door=page.locator(`button[data-focus-target-group="door:${shop.id}"]`).first()
   await door.click({timeout:5000})
   await page.waitForFunction(()=>Number(document.querySelector('.scene-protagonist[data-runtime-x]')?.getAttribute('data-runtime-x'))<39.8,{},{timeout:12000})
   row.inside=await pos()
   row.scene=await page.locator('.mainline-scene-stage').first().getAttribute('data-mainline-scene')
   await page.screenshot({path:`.mining-evidence/inside-${shop.n}-${viewport.width}.png`})
   await door.click({timeout:5000})
   await page.waitForFunction(()=>Number(document.querySelector('.scene-protagonist[data-runtime-x]')?.getAttribute('data-runtime-x'))>40.2,{},{timeout:12000})
   row.outside=await pos()
   row.pass=true
  }catch(e){row.error=e.message;row.pass=false;await page.screenshot({path:`.mining-evidence/failure-${shop.n}-${viewport.width}.png`}).catch(()=>{})}
  results.push(row)
  console.log(JSON.stringify(row))
  await context.close()
 }
}
await browser.close()
fs.writeFileSync('.mining-evidence/door-browser.json',JSON.stringify(results,null,2))
