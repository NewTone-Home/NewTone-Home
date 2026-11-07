import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/visualTokens.css'
import './views/EmptyContentApp.css'
import App from './App.jsx'
import PlayerAccountApp from './components/player/PlayerAccountApp.jsx'
import { createPlayerAccountRuntime } from './services/playerAccountRuntime.js'
import { installDwellTracking } from './services/analytics'

// Retired Reader publication loading and reset controls must not initialize game storage.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
const adminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
const disposeAnalytics = adminRoute ? () => {} : installDwellTracking()
if (import.meta.hot) import.meta.hot.dispose(disposeAnalytics)
// Both deployment gates must be explicit before any player client is constructed.
// Admin keeps its own client/routes; disabled deployments retain the original App.
const playerRuntime = adminRoute ? null : createPlayerAccountRuntime({ env: import.meta.env, currentOrigin: window.location.origin, currentUrl: window.location.href })
if (import.meta.hot && playerRuntime?.enabled) import.meta.hot.dispose(() => { void playerRuntime.dispose() })
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {adminRoute ? <Suspense fallback={<p>正在打开管理界面…</p>}><AdminApp /></Suspense>
      : playerRuntime?.enabled ? <PlayerAccountApp authController={playerRuntime.authController} saveCoordinator={playerRuntime.saveCoordinator}
        otpReady={playerRuntime.otpReady} googleReady={playerRuntime.googleReady} navigate={url => window.location.assign(url)} /> : <App />}
  </StrictMode>,
)
