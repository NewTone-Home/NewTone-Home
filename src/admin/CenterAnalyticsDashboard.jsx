import { useEffect, useState } from 'react'
import { loadCenterAnalytics } from './centerAnalyticsService'

function number(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function seconds(value) {
  return value == null ? '—' : `${value}s`
}

function CenterAnalyticsDashboard() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  const load = () => {
    setStatus('loading')
    setMessage('')
    loadCenterAnalytics().then(next => {
      setData(next)
      setStatus('ready')
    }).catch(error => {
      setMessage(error.message || '无法读取 Center 数据。')
      setStatus('error')
    })
  }

  useEffect(load, [])

  if (status === 'loading') return <main className="admin-analytics"><p>正在读取 Center 数据…</p></main>
  if (status === 'error') return <main className="admin-analytics"><p role="alert">{message}</p><button type="button" onClick={load}>重试</button><a href="/admin">返回工作台</a></main>

  const summary = data?.summary || {}
  return (
    <main className="admin-analytics">
      <header className="admin-analytics__header">
        <div><p>NewTone / Center</p><h1>匿名玩家数据</h1><small>仅管理员可见；数据来自真实埋点与反馈提交。</small></div>
        <nav><button type="button" onClick={load}>刷新</button><a href="/admin">返回工作台</a></nav>
      </header>
      <section className="admin-analytics__cards" aria-label="总体数据">
        <article><span>访客</span><strong>{number(summary.visitors)}</strong></article>
        <article><span>会话</span><strong>{number(summary.sessions)}</strong></article>
        <article><span>到达叫车节点</span><strong>{number(summary.reached_ride_boundary)}</strong></article>
        <article><span>反馈提交</span><strong>{number(summary.feedback_submissions)}</strong></article>
      </section>
      <section className="admin-analytics__section"><h2>场景停留</h2><div className="admin-analytics__table-wrap"><table><thead><tr><th>场景</th><th>访客</th><th>进入</th><th>退出</th><th>平均</th><th>最长</th></tr></thead><tbody>{(data?.scenes || []).map(row => <tr key={row.scene_id}><td>{row.scene_id}</td><td>{number(row.visitors)}</td><td>{number(row.entries)}</td><td>{number(row.exits)}</td><td>{seconds(row.average_seconds)}</td><td>{seconds(row.longest_seconds)}</td></tr>)}</tbody></table></div></section>
      <section className="admin-analytics__section"><h2>互动对象</h2><div className="admin-analytics__table-wrap"><table><thead><tr><th>场景</th><th>对象</th><th>类型</th><th>次数</th><th>访客</th><th>平均</th></tr></thead><tbody>{(data?.objects || []).map(row => <tr key={`${row.scene_id}:${row.object_id}`}><td>{row.scene_id}</td><td>{row.object_id}</td><td>{row.object_kind || '—'}</td><td>{number(row.interactions)}</td><td>{number(row.visitors)}</td><td>{seconds(row.average_seconds)}</td></tr>)}</tbody></table></div></section>
      <section className="admin-analytics__section"><h2>最近反馈</h2><div className="admin-analytics__table-wrap"><table><thead><tr><th>时间</th><th>来源</th><th>体验</th><th>竖屏适配</th><th>后续</th><th>文字</th></tr></thead><tbody>{(data?.feedback || []).map((row, index) => <tr key={`${row.created_at}:${index}`}><td>{new Date(row.created_at).toLocaleString('zh-CN')}</td><td>{row.source}</td><td>{row.experience_length || '—'}</td><td>{row.portrait_adaptation || '—'}</td><td>{row.continuation_interest || '—'}</td><td className="admin-analytics__feedback-text">{row.free_text || '—'}</td></tr>)}</tbody></table></div></section>
    </main>
  )
}

export default CenterAnalyticsDashboard
