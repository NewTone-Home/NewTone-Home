import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { trackEvent } from '../services/analytics'
import { requestAdminMagicLink, signInAdminWithGitHub } from './adminAuth'
import CenterAnalyticsDashboard from './CenterAnalyticsDashboard'
import './AdminApp.css'

function AdminApp() {
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState(isSupabaseConfigured ? 'checking' : 'configuration-missing')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase) return
    if (!session) { setPhase('signed-out'); return }
    let live = true
    setPhase('checking')
    // This existing read-only RPC checks private.is_owner before returning data.
    // Do not recreate Reader drafts merely to authorize the analytics surface.
    supabase.rpc('owner_center_analytics_v2').then(({ error }) => {
      if (!live) return
      if (error) throw error
      setPhase('ready')
      trackEvent('admin_login')
    }).catch(error => {
      if (live) { setMessage(error.message); setPhase(error.code === '42501' ? 'unauthorized' : 'error') }
    })
    return () => { live = false }
  }, [session])
  const requestLink = async event => {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await requestAdminMagicLink(supabase, email, location.origin)
    setBusy(false); setMessage(error ? error.message : '登录链接已发送。请在同一浏览器中打开邮件链接。')
  }
  const requestGitHubLogin = async () => {
    setBusy(true); setMessage('')
    const { error } = await signInAdminWithGitHub(supabase, location.origin)
    if (error) { setBusy(false); setMessage(error.message) }
  }
  if (phase === 'ready' && session) return <><div className="admin-session"><span>管理员已登录</span><button onClick={() => supabase.auth.signOut()}>退出</button></div><CenterAnalyticsDashboard /></>
  return <main className="admin-access"><section><p>NewTone / Studio</p><h1>数据管理</h1>{phase === 'configuration-missing' && <p>Supabase 环境变量尚未配置。</p>}{phase === 'checking' && <p>正在验证管理员权限…</p>}{phase === 'unauthorized' && <><p>此账户已登录，但不在管理员授权名单中，无法读取数据。</p><button onClick={() => supabase.auth.signOut()}>退出</button></>}{phase === 'error' && <p role="alert">{message || '无法验证管理权限。'}</p>}{phase === 'signed-out' && <><form onSubmit={requestLink}><label>管理员邮箱<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label><button disabled={busy}>{busy ? '发送中…' : '发送登录链接'}</button></form><div className="admin-auth-divider" aria-hidden="true">或</div><button type="button" disabled={busy} onClick={requestGitHubLogin}>使用 GitHub 登录</button><p className="admin-auth-note">登录后仍须通过管理员授权名单验证。</p></>}{message && phase !== 'error' && <p role="status">{message}</p>}<a href="/">返回公开页面</a></section></main>
}

export default AdminApp
