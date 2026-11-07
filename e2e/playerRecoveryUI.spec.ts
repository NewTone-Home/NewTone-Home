import { expect, test } from '@playwright/test'

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL, trace: 'off', screenshot: 'off', viewport: { width: 390, height: 844 } })

test('explicit conflict and restore confirmations reject stale displayed tokens', async ({ page, context }) => {
  await context.route('**/player-recovery-fixture', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html>
    <html lang="zh"><meta charset="utf-8"><title>Recovery UI fixture</title><div id="root"></div>
    <script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
      const {default:React}=await import('/node_modules/.vite/deps/react.js');
      const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
      const {default:Gate}=await import('/src/components/player/PlayerAccountGate.jsx');
      const listeners=new Set(),authState={status:'authenticated',user:{id:'fixture-user',email:'test@example.com'},sessionEpoch:1};
      let state={status:'conflict',source:null,slots:[{slotId:'slot-2'}],conflict:{slotId:'slot-2',token:'conflict-1',local:{summary:{generationId:'private-generation',localRevision:4,currentSceneId:'commercial-street',storyClock:{year:2025,month:4,day:12},gameTimeMs:41100000,updatedAt:1794038950000}},cloud:{summary:{generationId:'private-generation',localRevision:8,currentSceneId:'zhongshuyuan-office',storyClock:{year:2025,month:4,day:12},gameTimeMs:54000000,updatedAt:1794039050000}}},error:null};
      const notify=()=>{for(const fn of listeners)fn()};
      const calls={resolve:[],restore:[],list:[]};window.recoveryCalls=calls;
      window.changeConflict=()=>{state={...state,conflict:{...state.conflict,token:'conflict-2'}};notify()};
      window.changeRecovery=()=>{state={...state,recovery:{...state.recovery,token:'backups-2'}};notify()};
      window.setPendingChoice=choice=>{state={...state,conflict:{...state.conflict,pendingChoice:choice}};notify()};
      const coordinator={getSnapshot:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},bootstrap:async()=>({ok:true}),
        resolveConflict:async request=>{calls.resolve.push(request);return{ok:true}},
        listBackups:async slotId=>{calls.list.push(slotId);state={...state,recovery:{status:'ready',slotId,token:'backups-1',backups:[{backupId:'backup-a',summary:{kind:'local-conflict-snapshot',createdAt:'2026-11-07T08:09:10+00:00',sourceFingerprint:'private-fingerprint'}},{backupId:'backup-b',summary:{kind:'cloud-before-replace',createdAt:'2026-11-07T08:10:10+00:00',sourceFingerprint:'private-fingerprint'}}]}};notify();return{ok:true}},
        restoreBackup:async request=>{calls.restore.push(request);return{ok:true}}};
      const auth={getSnapshot:()=>authState,subscribe:()=>()=>{}};
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Gate,{authController:auth,saveCoordinator:coordinator,language:'zh',initiallyOpen:true}));
    </script></html>` }))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/player-recovery-fixture')
  await expect(page.getByRole('heading', { name: '选择要继续的存档' })).toBeVisible()
  await expect(page.getByText(/位置：商业街/)).toBeVisible()
  await expect(page.getByText(/位置：中枢院内部楼层/)).toBeVisible()
  await expect(page.getByRole('button', { name: '保留备份并确认选择' })).toHaveCount(0)
  await page.getByRole('button', { name: '查看并选择 · 本地存档' }).click()
  await expect(page.getByRole('button', { name: '保留备份并确认选择' })).toBeVisible()
  expect(await page.evaluate(() => (window as any).recoveryCalls.resolve)).toEqual([])
  await page.evaluate(() => (window as any).changeConflict())
  await expect(page.getByRole('button', { name: '保留备份并确认选择' })).toHaveCount(0)
  await page.getByRole('button', { name: '查看并选择 · 云端存档' }).click()
  await page.getByRole('button', { name: '保留备份并确认选择' }).click()
  expect(await page.evaluate(() => (window as any).recoveryCalls.resolve)).toEqual([{ slotId: 'slot-2', token: 'conflict-2', choice: 'cloud' }])
  await page.evaluate(() => (window as any).setPendingChoice('local'))
  await expect(page.getByRole('button', { name: '查看并选择 · 云端存档' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '恢复上次选择' })).toBeVisible()
  await page.evaluate(() => (window as any).setPendingChoice(null))
  await page.screenshot({ path: 'test-results/player-conflict-mobile-zh.png', fullPage: true })
  await page.getByRole('button', { name: '备份与恢复', exact: true }).click()
  expect(await page.evaluate(() => (window as any).recoveryCalls.list)).toEqual(['slot-2'])
  await page.getByRole('button', { name: /冲突时保留的本地版本/ }).click()
  await expect(page.getByRole('button', { name: '保留当前版本并恢复备份' })).toBeVisible()
  expect(await page.evaluate(() => (window as any).recoveryCalls.restore)).toEqual([])
  await page.evaluate(() => (window as any).changeRecovery())
  await expect(page.getByRole('button', { name: '保留当前版本并恢复备份' })).toHaveCount(0)
  await page.getByRole('button', { name: /替换前的云端版本/ }).click()
  await page.getByRole('button', { name: '保留当前版本并恢复备份' }).focus()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => (window as any).recoveryCalls.restore)).toEqual([{ slotId: 'slot-2', backupId: 'backup-b', token: 'backups-2' }])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.locator('body').innerText()).not.toContain('\uFFFD')
  expect(await page.locator('body').innerText()).not.toContain('private-fingerprint')
  await page.screenshot({ path: 'test-results/player-recovery-mobile-zh.png', fullPage: true })
  expect(errors).toEqual([])
})
