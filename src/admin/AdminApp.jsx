import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { trackEvent } from '../services/analytics'
import { loadOwnerDraft, publishOwnerDraft, saveOwnerDraft } from './adminContentService'
import OwnerWorkbench from './OwnerWorkbench'
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
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/admin` } })
    setBusy(false); setMessage(error ? error.message : '登录链接已发送。请在同一浏览器中打开邮件链接。')
  }
  const save = async workspace => { setBusy(true); try { const saved = await saveOwnerDraft(draft.id, workspace); setDraft(current => ({ ...current, ...saved, workspace })); trackEvent('admin_draft_saved', { stepId: 'main-reader' }) } finally { setBusy(false) } }
  const publish = async (workspace, content) => { await save(workspace); setBusy(true); try { const publication = await publishOwnerDraft(draft.id, content); setDraft(current => ({ ...current, workspace, base_publication_id: publication.base_publication_id, published_version: publication.published_version })); trackEvent('admin_published', { stepId: `version:${publication.published_version}` }) } finally { setBusy(false) } }

  if (phase === 'ready' && draft) return previewRoute
    ? <OwnerReaderPreview />
    : <><div className="admin-session"><span>Owner session</span><button onClick={() => supabase.auth.signOut()}>退出</button></div><OwnerWorkbench initialWorkspace={draft.workspace} onSave={save} onPublish={publish} busy={busy} /></>
  return <main className="admin-access"><section><p>NewTone / Admin</p><h1>Owner 工作台</h1>{phase === 'configuration-missing' && <p>Supabase 环境变量尚未配置。</p>}{phase === 'checking' && <p>正在验证 owner 权限…</p>}{phase === 'unauthorized' && <><p>此账户已登录，但不在 owner allow-list 中，无法读取或写入草稿。</p><button onClick={() => supabase.auth.signOut()}>退出</button></>}{phase === 'error' && <p role="alert">{message || '无法验证管理权限。'}</p>}{phase === 'signed-out' && <form onSubmit={requestLink}><label>Owner 邮箱<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label><button disabled={busy}>{busy ? '发送中…' : '发送 Magic Link'}</button></form>}{message && phase !== 'error' && <p role="status">{message}</p>}<a href="/">返回公开页面</a></section></main>
}

export default AdminApp
