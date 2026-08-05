import { useMemo, useRef, useState } from 'react'
import {
  compileWorkspace, createChapter, createPage, deleteWorkspacePage, getWorkspaceChapterText,
  insertWorkspacePage, mergeWorkspacePage, normalizeWorkspace, restoreWorkspacePage, splitWorkspacePage,
} from './contentWorkspace'
import { writeAdminPreview } from './adminPreview'
import './OwnerWorkbench.css'

const ENVIRONMENT_OPTIONS = {
  worldLayer: [['surface', '表世界'], ['inner', '里世界']],
  time: [['unknown', '未指定'], ['morning', '上午'], ['noon', '中午'], ['afternoon', '下午'], ['dusk', '傍晚'], ['night', '夜晚']],
  weather: [['unknown', '未指定'], ['clear', '晴'], ['overcast', '阴'], ['rain', '雨'], ['snow', '雪']],
  light: [['neutral', '自然'], ['interior-dim', '室内昏暗'], ['passage-dark', '通道暗光'], ['threshold-white', '白色强光'], ['interior-warm', '室内暖光'], ['interior-daylight', '室内日光']],
}

function OwnerWorkbench({ initialWorkspace, onSave, onPublish, busy }) {
  const normalizedInitial = useMemo(() => normalizeWorkspace(initialWorkspace), [initialWorkspace])
  const [workspace, setWorkspace] = useState(normalizedInitial)
  const [baseline, setBaseline] = useState(normalizedInitial)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [editingLanguage, setEditingLanguage] = useState('zh')
  const [message, setMessage] = useState('')
  const editorRef = useRef(null)
  const chapter = workspace.chapters[chapterIndex]
  const page = chapter?.pages[pageIndex]
  const chapterText = useMemo(() => getWorkspaceChapterText(workspace, chapterIndex, editingLanguage), [workspace, chapterIndex, editingLanguage])

  const updateChapter = patch => setWorkspace(current => ({ ...current, chapters: current.chapters.map((item, index) => index === chapterIndex ? { ...item, ...patch } : item) }))
  const updatePage = patch => updateChapter({ pages: chapter.pages.map((item, index) => index === pageIndex ? { ...item, ...patch } : item) })
  const updateEnglishText = textEn => {
    const paragraphCount = textEn.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean).length
    const mappedCount = page.translationParagraphCounts.en.reduce((sum, count) => sum + count, 0)
    updatePage({
      textEn,
      translationParagraphCounts: paragraphCount === mappedCount
        ? page.translationParagraphCounts
        : { en: [] },
    })
  }
  const addChapter = () => {
    const next = createChapter(workspace.chapters.length + 1)
    setWorkspace(current => ({ ...current, chapters: [...current.chapters, next] }))
    setChapterIndex(workspace.chapters.length); setPageIndex(0); setMessage('已建立空章节。')
  }
  const addFirstPage = () => {
    if (!chapter) return
    updateChapter({ pages: [createPage(chapter.id, 1)] }); setPageIndex(0); setMessage('已建立空白页。')
  }
  const replace = (result, success) => { setWorkspace(result.workspace); setPageIndex(result.selectedPageIndex); setMessage(success) }
  const splitAtCursor = () => {
    try { replace(splitWorkspacePage(workspace, chapterIndex, pageIndex, editorRef.current?.selectionStart ?? 0), '光标后的文字已移入新建的下一页。') }
    catch (error) { setMessage(error.message) }
  }
  const insertBlank = () => replace(insertWorkspacePage(workspace, chapterIndex, pageIndex), '已在当前页后新建空白页。')
  const mergeNext = () => replace(mergeWorkspacePage(workspace, chapterIndex, pageIndex), '下一页内容已合并到当前页。')
  const removePage = () => replace(deleteWorkspacePage(workspace, chapterIndex, pageIndex), '当前页已删除。')
  const restorePage = () => {
    try { setWorkspace(restoreWorkspacePage(workspace, baseline, chapterIndex, pageIndex)); setMessage('当前页已恢复到最近保存版本。') }
    catch (error) { setMessage(error.message) }
  }
  const runSave = async () => {
    try { setMessage(''); await onSave(workspace); setBaseline(normalizeWorkspace(workspace)); setMessage('草稿已安全保存到 Supabase。') }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存失败。') }
  }
  const runPublish = async () => {
    try { setMessage(''); const content = compileWorkspace(workspace); await onPublish(workspace, content); setBaseline(normalizeWorkspace(workspace)); setMessage('新版本已发布。') }
    catch (error) { setMessage(error instanceof Error ? error.message : '发布失败。') }
  }
  const openPreview = () => {
    try { writeAdminPreview(compileWorkspace(workspace)); window.location.assign('/admin/preview') }
    catch (error) { setMessage(error.message) }
  }

  if (!chapter) return <main className="developer-workbench developer-empty-workbench"><header className="developer-workbench-header"><div><strong>内容与分页工作台</strong><small>Supabase 管理员草稿 · 尚未发布</small></div><a href="/">返回公开页面</a></header><section><h1>正文为空</h1><p>没有导入旧稿或占位正文。请从空章节开始创作。</p><button type="button" onClick={addChapter}>新建第一个章节</button></section></main>

  return <main className="developer-workbench" aria-label="管理员内容与分页工作台">
    <header className="developer-workbench-header"><div><strong>内容与分页工作台</strong><small>Supabase 管理员草稿 · 尚未发布</small></div><div className="developer-header-actions"><button type="button" disabled={busy} onClick={openPreview}>Reader 临时预览</button><button type="button" disabled={busy} onClick={runSave}>保存草稿</button><button type="button" disabled={busy} onClick={runPublish}>验证并发布</button><a href="/">返回公开页面</a></div></header>
    <div className="developer-workbench-layout">
      <section className="developer-page-workspace">
        <div className="developer-page-heading"><div><label>章节标题（中文）<input value={chapter.title} onChange={event => updateChapter({ title: event.target.value })} /></label><label>Chapter title (English)<input value={chapter.titleEn} onChange={event => updateChapter({ titleEn: event.target.value })} /></label><small>当前编辑：第 {pageIndex + 1} 页</small></div><div className="developer-page-tabs">{chapter.pages.map((item, index) => <button type="button" key={`${item.id}-${index}`} aria-pressed={index === pageIndex} onClick={() => setPageIndex(index)}>第 {index + 1} 页</button>)}</div></div>
        <div className="developer-chapter-meta"><label>章节 ID<input value={chapter.id} onChange={event => updateChapter({ id: event.target.value })} /></label><label>主角 ID<input value={chapter.protagonistId} onChange={event => updateChapter({ protagonistId: event.target.value })} /></label></div>
        {!page ? <div className="developer-no-page"><p>本章还没有页面。</p><button type="button" onClick={addFirstPage}>新建第一页</button></div> : <>
          <div className="developer-page-tabs" aria-label="正文语言"><button type="button" aria-pressed={editingLanguage === 'zh'} onClick={() => setEditingLanguage('zh')}>中文</button><button type="button" aria-pressed={editingLanguage === 'en'} onClick={() => setEditingLanguage('en')}>English</button></div>
          <textarea ref={editorRef} className="developer-page-editor" aria-label={editingLanguage === 'en' ? 'Current page in English' : '当前页中文正文'} spellCheck="false" value={editingLanguage === 'en' ? page.textEn : page.text} onChange={event => editingLanguage === 'en' ? updateEnglishText(event.target.value) : updatePage({ text: event.target.value })} />
          <div className="developer-page-tools"><button type="button" onClick={splitAtCursor} disabled={editingLanguage === 'en'} title={editingLanguage === 'en' ? '请切换到中文，并在段落之间拆页。' : undefined}>从此处分到下一页</button><button type="button" onClick={insertBlank}>新建空白页</button><button type="button" onClick={mergeNext} disabled={pageIndex >= chapter.pages.length - 1}>与下一页合并</button><button type="button" onClick={removePage}>删除当前页</button></div>
          <section className="developer-current-page-info"><h2>当前页环境</h2><div className="developer-environment-fields">
            <label><span>世界层</span><select value={page.worldLayer} onChange={event => updatePage({ worldLayer: event.target.value })}>{ENVIRONMENT_OPTIONS.worldLayer.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>地点（中文）</span><input value={page.sceneLabel} onChange={event => updatePage({ sceneLabel: event.target.value })} /></label>
            <label><span>Setting (English)</span><input value={page.sceneLabelEn} onChange={event => updatePage({ sceneLabelEn: event.target.value })} /></label>
            <label><span>时间段</span><select value={page.time} onChange={event => updatePage({ time: event.target.value })}>{ENVIRONMENT_OPTIONS.time.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>天气</span><select value={page.weather} onChange={event => updatePage({ weather: event.target.value })}>{ENVIRONMENT_OPTIONS.weather.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>背景</span><select value={page.light} onChange={event => updatePage({ light: event.target.value })}>{ENVIRONMENT_OPTIONS.light.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div></section>
          <div className="developer-workbench-actions"><button type="button" onClick={openPreview}>应用 Reader 预览</button><button type="button" disabled={busy} onClick={runSave}>保存草稿</button><button type="button" onClick={restorePage}>恢复本页原值</button></div>
        </>}
        {message && <p className="developer-workbench-message" role="status">{message}</p>}
      </section>
      <aside className="developer-chapter-library"><nav className="developer-chapter-list"><h2>章节原文库</h2>{workspace.chapters.map((item,index) => <button type="button" key={`${item.id}-${index}`} aria-pressed={index === chapterIndex} onClick={() => { setChapterIndex(index); setPageIndex(0); setMessage('') }}>{item.title || `未命名章节 ${index + 1}`}</button>)}<button type="button" onClick={addChapter}>＋ 新建章节</button></nav><div className="developer-chapter-reference"><div><span>{editingLanguage === 'en' ? (chapter.titleEn || 'Untitled chapter') : (chapter.title || '未命名章节')}</span><small>当前管理员草稿整章参考 · 可选择复制</small></div><textarea aria-label={editingLanguage === 'en' ? 'Full chapter in English' : '章节连续中文原文'} readOnly value={chapterText} /></div></aside>
    </div>
  </main>
}

export default OwnerWorkbench
