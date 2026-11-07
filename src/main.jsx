import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/visualTokens.css'
import './views/EmptyContentApp.css'
import App from './App.jsx'
import { loadPlayerAccountModule, playerAccountsRequested } from './components/player/playerAccountBootstrapState.mjs'
import { installDwellTracking } from './services/analytics'

// Retired Reader publication loading and reset controls must not initialize game storage.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
const PlayerAccountBootstrap = lazy(() => loadPlayerAccountModule(() => import('./components/player/PlayerAccountBootstrap.jsx'), App))
const adminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
const disposeAnalytics = adminRoute ? () => {} : installDwellTracking()
if (import.meta.hot) import.meta.hot.dispose(disposeAnalytics)
// Disabled deployments do not load player UI, backend or the dedicated client factory.
const playerEnabled = !adminRoute && playerAccountsRequested(import.meta.env)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {adminRoute ? <Suspense fallback={<p>正在打开管理界面…</p>}><AdminApp /></Suspense>
      : playerEnabled ? <Suspense fallback={<p role="status">正在准备账号与存档…</p>}><PlayerAccountBootstrap /></Suspense> : <App />}
  </StrictMode>,
)
