import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/visualTokens.css'
import './views/EmptyContentApp.css'
import App from './App.jsx'
import StagingResetControl from './components/StagingResetControl.jsx'
import { installDwellTracking, trackEvent } from './services/analytics'
import { loadPublishedContent } from './services/publishedContent'
import { detectBrowserReaderLanguage } from './i18n/languages'

function LoadingShell() {
  const language = detectBrowserReaderLanguage(navigator.languages || [navigator.language])
  return <main className="empty-content-shell"><section><p className="empty-content-mark">NewTone</p><p>{language === 'en' ? 'Preparing the latest chapter…' : '正在确认已发布正文…'}</p></section></main>
}

function PublicRoot() {
  const [result, setResult] = useState({ status: 'loading' })
  const load = useCallback(() => {
    setResult({ status: 'loading' })
    loadPublishedContent().then(setResult)
  }, [])
  useEffect(load, [load])
  useEffect(() => {
    if (result.status === 'loading') return
    const version = Number(result.publication?.version)
    const versionSuffix = Number.isInteger(version) ? `:v${version}` : ''
    trackEvent('content_status', { stepId: `content:${result.status}${versionSuffix}` })
  }, [result.publication?.version, result.status])
  return <App contentStatus={result.status} onRetryContent={load} />
}

function Root() {
  const [AdminApp, setAdminApp] = useState(null)
  const adminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
  useEffect(() => {
    const removeTracking = installDwellTracking()
    if (adminRoute) import('./admin/AdminApp.jsx').then(module => setAdminApp(() => module.default))
    return removeTracking
  }, [adminRoute])
  if (adminRoute) return AdminApp ? <AdminApp /> : <LoadingShell />
  return <PublicRoot />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
    <StagingResetControl />
  </StrictMode>,
)
