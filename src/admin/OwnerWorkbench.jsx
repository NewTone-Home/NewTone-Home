import { useMemo, useState } from 'react'
import { compileWorkspace, createChapter, createPage, normalizeWorkspace } from './contentWorkspace'
import './OwnerWorkbench.css'

function OwnerWorkbench({ initialWorkspace, onSave, onPublish, busy }) {
  const [workspace, setWorkspace] = useState(() => normalizeWorkspace(initialWorkspace))
  const [chapterIndex, setChapterIndex] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [message, setMessage] = useState('')
  const chapter = workspace.chapters[chapterIndex]
  const page = chapter?.pages[pageIndex]

  const updateChapter = patch => setWorkspace(current => ({ ...current, chapters: current.chapters.map((item, index) => index === chapterIndex ? { ...item, ...patch } : item) }))
  const updatePage = patch => updateChapter({ pages: chapter.pages.map((item, index) => index === pageIndex ? { ...item, ...patch } : item) })
  const addChapter = () => {
    const next = createChapter(workspace.chapters.length + 1)
    setWorkspace(current => ({ ...current, chapters: [...current.chapters, next] }))
    setChapterIndex(workspace.chapters.length); setPageIndex(0); setMessage('已建立空章节。')
  }
  const addPage = () => {
    if (!chapter) return
    const next = createPage(chapter.id, chapter.pages.length + 1)
    updateChapter({ pages: [...chapter.pages, next] }); setPageIndex(chapter.pages.length); setMessage('已建立空白页。')
  }
  const removePage = () => {
    if (!page) return
    updateChapter({ pages: chapter.pages.filter((_, index) => index !== pageIndex) })
    setPageIndex(Math.max(0, pageIndex - 1)); setMessage('当前页已移除。')
  }
  const run = async (action, success) => {
    try { setMessage(''); await action(workspace); setMessage(success) }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作失败。') }
  }
  const previewParagraphs = useMemo(() => page?.text.split(/\n\s*\n/).filter(text => text.trim()) ?? [], [page?.text])

  return (
    <main className="owner-workbench">
      <header><div><p>NewTone / Owner</p><h1>内容、分页与实验控制台</h1></div><div className="owner-actions"><button disabled={busy} onClick={() => run(onSave, '草稿已安全保存到 Supabase。')}>保存草稿</button><button className="publish" disabled={busy} onClick={() => run(async value => onPublish(value, compileWorkspace(value)), '新版本已发布。')}>验证并发布</button></div></header>
      <div className="owner-layout">
        <aside className="owner-library"><h2>章节</h2>{workspace.chapters.map((item, index) => <button key={`${item.id}-${index}`} aria-pressed={index === chapterIndex} onClick={() => { setChapterIndex(index); setPageIndex(0) }}>{item.title || `未命名章节 ${index + 1}`}</button>)}<button onClick={addChapter}>＋ 新建章节</button></aside>
        <section className="owner-editor">
          {!chapter ? <div className="owner-empty"><h2>正文为空</h2><p>这里没有导入旧稿或占位正文。请新建章节开始创作。</p><button onClick={addChapter}>新建第一个章节</button></div> : <>
            <div className="owner-fields"><label>章节标题<input value={chapter.title} onChange={event => updateChapter({ title: event.target.value })} /></label><label>章节 ID<input value={chapter.id} onChange={event => updateChapter({ id: event.target.value })} /></label><label>主角 ID<input value={chapter.protagonistId} onChange={event => updateChapter({ protagonistId: event.target.value })} /></label></div>
            <nav className="owner-pages" aria-label="分页">{chapter.pages.map((item, index) => <button key={`${item.id}-${index}`} aria-pressed={index === pageIndex} onClick={() => setPageIndex(index)}>第 {index + 1} 页</button>)}<button onClick={addPage}>＋ 新建页</button></nav>
            {!page ? <div className="owner-empty"><p>本章还没有页面。</p><button onClick={addPage}>新建第一页</button></div> : <>
              <textarea className="owner-text" aria-label="当前页正文" placeholder="" value={page.text} onChange={event => updatePage({ text: event.target.value })} />
              <div className="owner-page-actions"><button onClick={addPage}>在章末新建页</button><button onClick={removePage}>删除当前页</button></div>
            </>}
          </>}
          {message && <p className="owner-message" role="status">{message}</p>}
        </section>
        <aside className="owner-preview"><h2>实验预览</h2>{page ? <><div className="owner-fields"><label>场景标签<input value={page.sceneLabel} onChange={event => updatePage({ sceneLabel: event.target.value })} /></label><label>世界层<select value={page.worldLayer} onChange={event => updatePage({ worldLayer: event.target.value })}><option value="surface">表世界</option><option value="inner">里世界</option></select></label><label>时间<select value={page.time} onChange={event => updatePage({ time: event.target.value })}><option value="morning">上午</option><option value="noon">中午</option><option value="dusk">傍晚</option><option value="night">夜晚</option></select></label><label>天气<select value={page.weather} onChange={event => updatePage({ weather: event.target.value })}><option value="clear">晴</option><option value="overcast">阴</option><option value="rain">雨</option><option value="snow">雪</option></select></label></div><article data-world={page.worldLayer}>{previewParagraphs.length ? previewParagraphs.map((text, index) => <p key={index}>{text}</p>) : <p className="muted">当前页尚无正文。</p>}</article></> : <p className="muted">选择一个页面后可调整环境并预览排版。</p>}</aside>
      </div>
    </main>
  )
}

export default OwnerWorkbench
