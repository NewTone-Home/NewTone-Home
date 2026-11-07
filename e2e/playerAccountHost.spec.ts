import { expect, test } from '@playwright/test'

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL, trace: 'off', screenshot: 'off' })

test('isolated host renders Chinese correctly and routes guest action without live auth', async ({ page, context }) => {
  await context.route('**/player-account-host-fixture', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html>
    <html lang="zh"><meta charset="utf-8"><title>Player account host test</title><div id="root"></div>
    <script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const {default:React} = await import('/node_modules/.vite/deps/react.js');
      const {default:ReactDOM} = await import('/node_modules/.vite/deps/react-dom_client.js');
      const {createRoot} = ReactDOM;
      const {default:Host} = await import('/src/components/player/PlayerAccountApp.jsx');
      const listeners = new Set();
      let state = {status:'guest',slots:[],selectedSlotId:null,error:null,source:null};
      let authState = {status:'signed_out',user:null,email:null,pending:null,error:null};
      const auth = {getSnapshot:()=>authState,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},cancel:()=>{}};
      const coordinator = {getSnapshot:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},bootstrap:async()=>({ok:true}),
        continueGuest:async()=>{state={...state,source:{key:'fixture-guest',service:{marker:'guest-test'}}};for(const fn of listeners)fn();return{ok:true}},
        selectSlot:async slotId=>{state={...state,status:'switching',source:null};for(const fn of listeners)fn();await new Promise(resolve=>setTimeout(resolve,50));state={...state,status:'ready',selectedSlotId:slotId,source:{key:slotId,ownerId:'fixture-owner',service:{marker:slotId}}};for(const fn of listeners)fn();return{ok:true}},
        checkpoint:async()=>({ok:true}),suspend:async()=>({ok:true})};
      window.setAccountFixture=()=>{authState={status:'authenticated',user:{id:'fixture-owner',email:'test@example.com'},error:null};state={...state,status:'ready',slots:[{slotId:'slot-one'},{slotId:'slot-two'},{slotId:'slot-three'}]};for(const fn of listeners)fn()};
      const Game = ({saveService})=>React.createElement('p',{'data-testid':'guest-runtime'},'游客游戏 · '+saveService.marker);
      createRoot(document.getElementById('root')).render(React.createElement(Host,{authController:auth,saveCoordinator:coordinator,language:'zh',initiallyOpen:true,GameComponent:Game}));
    </script></html>` }))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/player-account-host-fixture')
  await expect(page.getByRole('heading', { name: '玩家账号' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '我的存档' })).toBeVisible()
  await expect(page.getByRole('button', { name: '发送验证码' })).toBeDisabled()
  await expect(page.getByText('注册后将自动保留当前存档，无需额外绑定。')).toBeVisible()
  expect(await page.locator('body').innerText()).not.toContain('\uFFFD')
  await page.getByRole('button', { name: '继续以游客游玩' }).click()
  await expect(page.getByTestId('guest-runtime')).toHaveText('游客游戏 · guest-test')
  await page.screenshot({ path: 'test-results/player-account-host-zh.png', fullPage: true })
  await page.getByRole('button', { name: '账号与存档', exact: true }).click()
  await expect(page.getByRole('heading', { name: '玩家账号' })).not.toBeVisible()
  await page.getByRole('button', { name: '账号与存档', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('heading', { name: '玩家账号' })).toBeVisible()
  await page.evaluate(() => (window as unknown as { setAccountFixture: () => void }).setAccountFixture())
  await page.locator('[data-slot-id="slot-two"]').click()
  await expect(page.getByTestId('guest-runtime')).toHaveText('游客游戏 · slot-two')
  await expect(page.locator('[data-slot-id="slot-two"]')).toHaveAttribute('aria-pressed', 'true')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.locator('[data-slot-id="slot-three"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/player-account-host-mobile-zh.png', fullPage: true })
  expect(errors).toEqual([])
})
