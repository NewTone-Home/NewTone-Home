import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineLabelFootprint } from '../src/center/runtime/sceneLayout'
import { navigationBarrierBlocksTravel } from '../src/center/runtime/scenePathfinding'

test.use({viewport:{width:1280,height:720}})
test('Floor Server uses authored service sides for 60 seconds without relation crossings', async ({page}, info)=>{
  test.setTimeout(85000)
  await page.goto('/?scene=commercial-cafe&debugRuntimeEvidence=1')
  const actor=page.locator('[data-actor-id="cafe-floor-server"]')
  await expect(actor).toBeVisible()
  const metrics=await page.locator('.mainline-scene-stage').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))
  const scene=mainlineScenes['commercial-cafe']
  const snapshot=createMainlineSceneGeometrySnapshot(scene,scene.initialPlayerPosition,{},metrics)
  const footprint=mainlineLabelFootprint('店员',scene.initialPlayerPosition,metrics,{lineHeight:1})
  const samplesPromise=page.evaluate(async()=>{
    const end=performance.now()+60000, samples:any[]=[]
    while(performance.now()<end){
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
      const a=document.querySelector<HTMLElement>('[data-actor-id="cafe-floor-server"]')!
      samples.push({t:performance.now(),x:Number(a.dataset.runtimeX),y:Number(a.dataset.runtimeY),target:a.dataset.npcTargetId,tx:Number(a.dataset.npcTargetX),ty:Number(a.dataset.npcTargetY),phase:a.dataset.npcPhase})
    }
    return samples
  })
  await page.waitForFunction(()=>{const a=document.querySelector<HTMLElement>('[data-actor-id="cafe-floor-server"]');return a?.dataset.npcTargetId?.startsWith('commercial-cafe-right-')&&a.dataset.npcPhase==='idle'},undefined,{timeout:50000})
  await page.screenshot({path:info.outputPath('floor-server-authored-service-side.png')})
  const samples=await samplesPromise
  const services:any[]=[], crossings:any[]=[]
  for(let i=1;i<samples.length;i++){
    const previous=samples[i-1],current=samples[i]
    for(const barrier of snapshot.navigationBarriers.filter(b=>b.kind!=='access-boundary')) if(navigationBarrierBlocksTravel(previous,current,barrier,footprint)) crossings.push({previous,current,barrier:barrier.id})
    if(previous.phase==='moving'&&current.phase==='idle'){
      const next=samples.slice(i+1).find(s=>s.phase==='moving')
      services.push({table:current.target,resolved:{x:current.tx,y:current.ty},arrival:{x:current.x,y:current.y},dwell:next?next.t-current.t:null})
      expect(Math.hypot(current.x-current.tx,current.y-current.ty)).toBeLessThan(.02)
      const table=scene.objects.find(o=>o.id===current.target)!
      if(table.id.startsWith('commercial-cafe-right-')){expect(current.x).toBeLessThan(table.position.x-1);expect(Math.abs(current.y-table.approach!.y)).toBeLessThan(2)}
    }
  }
  expect(crossings).toEqual([])
  expect(services.length).toBeGreaterThan(7)
  for(const name of ['inner-upper','inner-middle','inner-lower','window-lower']) expect(services.some(s=>s.table.includes(name))).toBe(true)
  const dwells=services.map(s=>s.dwell).filter((v):v is number=>v!==null)
  expect(dwells.every(ms=>ms>=950&&ms<5500)).toBe(true)
  expect(dwells.filter(ms=>ms>=1950&&ms<=4300).length/dwells.length).toBeGreaterThan(.5)
  const evidencePath=info.outputPath('floor-60s-services.json')
  await writeFile(evidencePath,JSON.stringify({durationMs:60000,services,crossings:0,gapArrivals:0},null,2))
  await info.attach('floor-60s-services',{path:evidencePath,contentType:'application/json'})
})

test('altar projected edge gaps agree in the actual desktop stage',async({page},info)=>{
  await page.goto('/?scene=jijia-ancestral-interior&debugRuntimeEvidence=1')
  await expect(page.locator('[data-object-id="jijia-incense-burner"]')).toBeVisible()
  const measure=await page.locator('.mainline-scene-stage').evaluate(stage=>{
    const rect=(id:string)=>stage.querySelector<HTMLElement>('[data-object-id="'+id+'"] .scene-mainline-object__label')?.getBoundingClientRect()
    const b=rect('jijia-incense-burner')!,n=rect('jijia-offering-table-north')!,e=rect('jijia-offering-table-east')!,s=rect('jijia-offering-table-south')!,w=rect('jijia-offering-table-west')!
    return {north:b.top-n.bottom,east:e.left-b.right,south:s.top-b.bottom,west:b.left-w.right}
  })
  expect(Math.max(...Object.values(measure))-Math.min(...Object.values(measure))).toBeLessThan(1.5)
  await writeFile(info.outputPath('altar-pixel-gaps.json'),JSON.stringify(measure))
  await page.screenshot({path:info.outputPath('altar-even-projected-ring.png')})
})
