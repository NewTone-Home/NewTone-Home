import { useEffect } from 'react'
import { trackEvent } from '../services/analytics'
import './EmptyContentApp.css'

function EmptyContentApp({ status, onRetry }) {
  useEffect(() => { trackEvent('landing_entry', { stepId: 'content-unavailable' }) }, [])
  const configurationMissing = status === 'configuration-missing'
  const temporaryError = status === 'error' || status === 'invalid'
  return (
    <main className="empty-content-shell">
      <section aria-labelledby="empty-content-title">
        <p className="empty-content-mark">NewTone</p>
        <h1 id="empty-content-title">正文尚未发布</h1>
        <p>{configurationMissing
          ? '阅读服务尚未完成配置。'
          : temporaryError
            ? '暂时无法读取已发布正文，请稍后重试。'
            : '新的正文仍在创作与校对中。当前没有向公开读者展示旧稿或占位内容。'}</p>
        {temporaryError && <button type="button" onClick={onRetry}>重新检查</button>}
      </section>
    </main>
  )
}

export default EmptyContentApp
