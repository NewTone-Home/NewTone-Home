import { useEffect, useState } from 'react'
import { setReaderContent } from '../data/readerContent'
import { expandSceneReaderFocusUnits } from '../data/scenePublication'
import { readAdminPreview } from './adminPreview'

export default function OwnerReaderPreview() {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true, session = null
    async function prepare() {
      try {
        const content = readAdminPreview()
        if (!content) throw Error('当前会话没有 Reader 临时预览，请从管理台重新生成。')
        const expanded = expandSceneReaderFocusUnits(content)
        setReaderContent(expanded)
        const { openOwnerPreviewSession } = await import('./ownerPreviewSession.mjs')
        if (!live) return
        session = openOwnerPreviewSession()
        const host = await import('./OwnerReaderPreviewHost.jsx')
        if (!live) { session.release(); return }
        setPreview({ Host: host.default, session })
      } catch (reason) {
        session?.release()
        if (live) setError(reason instanceof Error ? reason.message : '无法打开 Reader 预览。')
      }
    }
    prepare()
    return () => { live = false; session?.release() }
  }, [])
  if (error) return <main className="admin-access"><section><p>NewTone / Draft Preview</p><h1>无法打开临时预览</h1><p role="alert">{error}</p><a href="/admin">返回管理台</a></section></main>
  if (!preview) return <main className="admin-access"><section><p>正在准备 Reader 临时预览…</p></section></main>
  const Host = preview.Host
  return <Host session={preview.session} />
}
