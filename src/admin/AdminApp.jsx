import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { trackEvent } from '../services/analytics'
import { requestAdminMagicLink, signInAdminWithGitHub } from './adminAuth'
import { loadOwnerDraft, publishOwnerDraft, saveOwnerDraft } from './adminContentService'
import OwnerWorkbench from './OwnerSceneWorkbench'
import OwnerReaderPreview from './OwnerReaderPreview'
import './AdminApp.css'

function AdminApp() {
  const previewRoute = window.location.pathname === '/admin/preview'
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState(isSupabaseConfigured ? 'checking' : 'configuration-missing')
  const [draft, setDraft] = useState(null)
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
    if (phase === 'configuration-missing') return
    if (!session) { setPhase('signed-out'); setDraft(null); return }
    setPhase('checking')
    loadOwnerDraft(session.user.id).then(next => {
      setDraft(next); setPhase('ready'); trackEvent('admin_login')
    }).catch(error => { setMessage(error.message); setPhase(error.code === 'OWNER_NOT_AUTHORIZED' ? 'unauthorized' : 'error') })
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
  const save = async workspace => { setBusy(true); try { const saved = await saveOwnerDraft(draft.id, workspace); setDraft(current => ({ ...current, ...saved, workspace })); trackEvent('admin_draft_saved', { stepId: 'main-reader' }) } finally { setBusy(false) } }
  const publish = async (workspace, content) => { await save(workspace); setBusy(true); try { const publication = await publishOwnerDraft(draft.id, content); setDraft(current => ({ ...current, workspace, base_publication_id: publication.base_publication_id, published_version: publication.published_version })); trackEvent('admin_published', { stepId: `version:${publication.published_version}` }) } finally { setBusy(false) } }

  if (phase === 'ready' && draft) return previewRoute
    ? <OwnerReaderPreview />
    : <><div className="admin-session"><span>管理员已登录</span><button onClick={() => supabase.auth.signOut()}>退出</button></div><OwnerWorkbench initialWorkspace={draft.workspace} onSave={save} onPublish={publish} busy={busy} /></>
  return <main className="admin-access"><section><p>NewTone / Studio</p><h1>管理员工作台</h1>{phase === 'configuration-missing' && <p>Supabase 环境变量尚未配置。</p>}{phase === 'checking' && <p>正在验证管理员权限…</p>}{phase === 'unauthorized' && <><p>此账户已登录，但不在管理员授权名单中，无法读取或写入草稿。</p><button onClick={() => supabase.auth.signOut()}>退出</button></>}{phase === 'error' && <p role="alert">{message || '无法验证管理权限。'}</p>}{phase === 'signed-out' && <><form onSubmit={requestLink}><label>管理员邮箱<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label><button disabled={busy}>{busy ? '发送中…' : '发送登录链接'}</button></form><div className="admin-auth-divider" aria-hidden="true">或</div><button type="button" disabled={busy} onClick={requestGitHubLogin}>使用 GitHub 登录</button><p className="admin-auth-note">登录后仍须通过管理员授权名单验证。</p></>}{message && phase !== 'error' && <p role="status">{message}</p>}<a href="/">返回公开页面</a></section></main>
}

export default AdminApp
