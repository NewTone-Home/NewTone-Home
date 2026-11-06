import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/visualTokens.css'
import './views/EmptyContentApp.css'
import App from './App.jsx'
import { installDwellTracking } from './services/analytics'

// Retired Reader publication loading and reset controls must not initialize game storage.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
const adminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
const disposeAnalytics = adminRoute ? () => {} : installDwellTracking()
if (import.meta.hot) import.meta.hot.dispose(disposeAnalytics)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {adminRoute ? <Suspense fallback={<p>正在打开管理界面…</p>}><AdminApp /></Suspense> : <App />}
  </StrictMode>,
)
