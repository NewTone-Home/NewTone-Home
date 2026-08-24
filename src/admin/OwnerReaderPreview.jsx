import { useEffect, useState } from 'react'
import { setReaderContent } from '../data/readerContent'
import { expandSceneReaderFocusUnits } from '../data/scenePublication'
import { readAdminPreview } from './adminPreview'

function OwnerReaderPreview() {
  const [App, setApp] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const content = readAdminPreview()
    if (!content) { setError('当前会话没有 Reader 临时预览。请从工作台重新生成。'); return }
    try { setReaderContent(expandSceneReaderFocusUnits(content)) } catch (reason) { setError(reason instanceof Error ? reason.message : '临时预览无效。'); return }
    Promise.all([import('../App.jsx'), import('../stores/progressStore')]).then(([appModule, storeModule]) => {
      storeModule.useProgressStore.setState({ currentView: 'reader', readerStarted: true, resumeRequested: false, hasInitializedLanguage: true, hasInitializedReadingMode: true })
      setApp(() => appModule.default)
    }).catch(reason => setError(reason instanceof Error ? reason.message : '无法启动 Reader 预览。'))
  }, [])
  if (error) return <main className="admin-access"><section><p>NewTone / Draft Preview</p><h1>无法打开临时预览</h1><p role="alert">{error}</p><a href="/admin">返回工作台</a></section></main>
  if (!App) return <main className="admin-access"><section><p>正在准备 Reader 临时预览…</p></section></main>
  return <><App contentStatus="ready" /><a className="admin-preview-return" href="/admin">返回工作台</a></>
}

export default OwnerReaderPreview
