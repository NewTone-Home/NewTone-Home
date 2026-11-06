import {writeFile} from 'node:fs/promises'
import {test,expect} from '@playwright/test'
for(const viewport of [{width:390,height:844},{width:1366,height:768}])test.describe(`timeline ${viewport.width}`,()=>{
 test.use({viewport,hasTouch:viewport.width<500,isMobile:viewport.width<500})
 test('real Landing, game, app interaction, refresh and leaving remain one visit',async({page},info)=>{
  const rows:any[]=[],errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  // Every analytics write is captured locally. No real Supabase project is contacted.
  await page.route('**/rest/v1/**',async route=>{
   if(route.request().method()==='POST'&&route.request().url().includes('/analytics_events')){
    const body=route.request().postDataJSON();rows.push(...(Array.isArray(body)?body:[body]))
    await route.fulfill({status:201,body:'',headers:{'access-control-allow-origin':'*'}})
   }else await route.fulfill({status:200,contentType:'application/json',body:'[]'})
  })
  await page.goto('/')
  const begin=page.locator('[data-entry-id="begin"]')
  await expect(begin).toBeEnabled({timeout:25000})
  await expect.poll(()=>rows.some(r=>r.event_name==='web_visit_state')).toBe(true)
  const visit=rows.find(r=>r.event_name==='web_visit_state').event_data.webVisitId
  await page.waitForTimeout(1100)
  await begin.click()
  await expect.poll(()=>rows.some(r=>r.event_name==='center_entry_completed'),{timeout:30000}).toBe(true)
  const entered=rows.find(r=>r.event_name==='center_entry_completed')
  expect(entered.event_data.webVisitId).toBe(visit)
  expect(entered.event_data.gameTimeMs).toBeGreaterThanOrEqual(0)
  const home=page.locator('.world-phone__home-indicator')
  if(await home.isVisible())await home.click();else await page.locator('.world-phone__handle').click()
  await page.locator('.world-phone__apps [data-app="map"]').click()
  await page.waitForTimeout(1100)
  await home.click()
  await expect.poll(()=>rows.some(r=>r.event_name==='center_object_interacted'&&r.object_id==='phone-app:map'),{timeout:15000}).toBe(true)
  const end=rows.find(r=>r.event_name==='center_object_interacted'&&r.object_id==='phone-app:map')
  const starts=rows.filter(r=>r.event_name==='interaction_started'&&r.event_data.interactionId===end.event_data.interactionId)
  expect(starts).toHaveLength(1)
  expect(end.dwell_ms).toBeGreaterThanOrEqual(900)
  expect(end.event_data.gameTimeStartedMs).toBeGreaterThanOrEqual(0)
  expect(end.event_data.gameTimeEndedMs).toBeGreaterThanOrEqual(end.event_data.gameTimeStartedMs)
  expect(end.event_data.roomId).toBeTruthy()
  const foreground=rows.find(r=>r.event_name==='foreground_no_operation'&&r.event_data.durationMs>=1000)
  expect(foreground).toBeTruthy();expect(foreground.event_data.possibleAfk).toBe(false)
  await page.screenshot({path:info.outputPath('real-game.png')})
  await page.reload();await expect(begin).toBeEnabled({timeout:25000})
  await expect.poll(()=>rows.some(r=>r.event_name==='web_visit_state'&&r.event_data.reason==='document-resumed')).toBe(true)
  const resumed=rows.find(r=>r.event_name==='web_visit_state'&&r.event_data.reason==='document-resumed')
  expect(resumed.event_data.webVisitId).toBe(visit)
  expect(resumed.event_data.documentId).not.toBe(entered.event_data.documentId)
  await begin.click();await expect(page.locator('[data-entry-id="continue"]')).toBeEnabled()
  await page.locator('[data-entry-id="continue"]').click()
  await expect.poll(()=>rows.filter(r=>r.event_name==='center_entry_completed').length,{timeout:30000}).toBe(2)
  await page.goto('about:blank');await page.waitForTimeout(500)
  expect(rows.some(r=>r.event_name==='web_visit_state'&&r.event_data.reason==='page-leaving-signal'&&r.event_data.endConfirmed===false)).toBe(true)
  expect(rows.every(r=>r.event_data.webVisitId===visit)).toBe(true)
  expect(errors).toEqual([])
  const eventsPath=info.outputPath('captured-local-only-events.json');await writeFile(eventsPath,JSON.stringify(rows,null,2));await info.attach('captured-local-only-events',{path:eventsPath,contentType:'application/json'})
 })
})

test('owner timeline component renders visit grouping, player search and dual clocks using local RPC fixtures',async({page},info)=>{
 const requests:any[]=[]
 const visitor='00000000-0000-4000-8000-000000000001'
 await page.route('**/rest/v1/**',async route=>{
  const request=route.request()
  if(request.url().includes('/rpc/owner_player_history_v2')){
   const payload=request.postDataJSON();requests.push(payload)
   const event_data={webVisitId:'one-visit',documentId:'document-two',historyProtocol:2,internalTest:true,buildSha:'a'.repeat(40),gameTimeMs:32100,roomId:'commercial-north-cafe-interior',lastShown:{lineId:'laozhou-test',sentenceIndex:1},lastConfirmed:{lineId:'laozhou-test',sentenceIndex:0}}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{client_event_id:'event-one',visitor_id:visitor,session_id:visitor,event_name:'center_object_interacted',object_id:'lao-zhou',scene_id:'commercial-street',outcome:'interrupted',dwell_ms:2000,sequence:1,occurred_at:'2026-11-06T12:00:00Z',event_data}],players:[{visitor_id:visitor}],daily:[{day:'2026-11-06',players:1,foreground_ms:5000,no_operation_ms:1000,interactions:1,story_completions:0}],locations:[{scene_id:'commercial-street',room_id:'commercial-north-cafe-interior',foreground_ms:5000}],nextCursor:null})})
  }else if(request.url().includes('/rpc/owner_release_analytics'))await route.fulfill({status:200,contentType:'application/json',body:'{}'})
  else await route.fulfill({status:201,body:''})
 })
 await page.goto('/')
 await page.evaluate(async()=>{
  const reactModule='/.history-vite-cache/deps/react.js',domModule='/.history-vite-cache/deps/react-dom_client.js',component='/src/admin/ReleaseAnalyticsDashboard.jsx',css='/src/admin/AdminApp.css'
  const React=(await import(reactModule)).default,{createRoot}=(await import(domModule)).default,{default:Dashboard}=await import(component)
  await import(css)
  const host=document.createElement('div');host.id='qa-owner-dashboard';host.className='admin-analytics';host.style.cssText='position:fixed;inset:0;z-index:999999;overflow:auto'
  document.body.append(host);createRoot(host).render(React.createElement(Dashboard))
 })
 const host=page.locator('#qa-owner-dashboard')
 await expect(host.getByLabel('搜索匿名玩家')).toBeVisible()
 await expect(host.getByText('网页访问 one-visit',{exact:false})).toBeVisible()
 await expect(host.getByText('游戏时钟 32.1秒',{exact:false})).toBeVisible()
 await host.getByLabel('搜索匿名玩家').fill('00000000')
 await expect.poll(()=>requests.at(-1)?.p_search).toBe('00000000')
 await host.getByLabel('测试标记').selectOption('internal')
 await expect.poll(()=>requests.at(-1)?.p_internal).toBe('internal')
 await expect(host.getByText('最后显示：',{exact:false})).toBeVisible()
 await page.screenshot({path:info.outputPath('owner-timeline-local-fixture.png'),fullPage:true})
 const filtersPath=info.outputPath('rpc-filters.json');await writeFile(filtersPath,JSON.stringify(requests,null,2));await info.attach('rpc-filters',{path:filtersPath,contentType:'application/json'})
})
