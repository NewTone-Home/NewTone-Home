import { useEffect } from 'react'
import { useProgressStore } from '../stores/progressStore'
import './ReaderUnavailable.css'

const COPY = {
  empty: ['正文尚未发布', '新的正文仍在创作与校对中。公开入口会保留，正文发布后即可从这里继续阅读。'],
  error: ['暂时无法读取正文', '连接没有成功，请稍后重试。'],
  invalid: ['正文暂时不可用', '当前发布版本未通过完整性检查。'],
  'configuration-missing': ['正文服务尚未连接', '公开体验已经就绪，正文服务仍在配置中。'],
}

function ReaderUnavailable({ status, onRetry, onReaderReady }) {
  const [title, description] = COPY[status] ?? COPY.error
  useEffect(() => { onReaderReady?.() }, [onReaderReady])
  return (
    <main className="reader-unavailable" aria-labelledby="reader-unavailable-title">
      <section>
        <p className="reader-unavailable-mark">NewTone / Reader</p>
        <h1 id="reader-unavailable-title">{title}</h1>
        <p>{description}</p>
        <div>
          {status !== 'empty' && <button type="button" onClick={onRetry}>重新检查</button>}
          <button type="button" onClick={() => useProgressStore.getState().goLanding()}>返回入口</button>
        </div>
      </section>
    </main>
  )
}

export default ReaderUnavailable
