import { useMemo, useState } from 'react'
import {
  compileReaderWorkspace,
  compileWorkspace,
  createChapter,
  deleteScene,
  getChapterText,
  insertScene,
  normalizeWorkspace,
  SCENE_LANGUAGES,
} from './sceneWorkspace'
import { writeAdminPreview } from './adminPreview'
import './OwnerWorkbench.css'

const LANGUAGE_LABELS = { zh: '中文', en: 'English' }
const WORLD_LAYER_LABELS = { surface: '表世界', inner: '里世界', transition: '暗道', unknown: '未知' }
const TIME_OPTIONS = [
  { value: 'unknown', label: '未知' },
  { value: 'morning', label: '上午' },
  { value: 'noon', label: '中午' },
  { value: 'dusk', label: '傍晚' },
  { value: 'night', label: '夜晚' },
]
const WEATHER_OPTIONS = [
  { value: 'unknown', label: '未知' },
  { value: 'clear', label: '晴' },
  { value: 'rain', label: '雨' },
  { value: 'snow', label: '雪' },
]

function OwnerSceneWorkbench({ initialWorkspace, onSave, onPublish, busy }) {
  const normalizedInitial = useMemo(() => normalizeWorkspace(initialWorkspace), [initialWorkspace])
  const [workspace, setWorkspace] = useState(normalizedInitial)
  const [baseline, setBaseline] = useState(normalizedInitial)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [editingLanguage, setEditingLanguage] = useState('zh')
  const [message, setMessage] = useState('')
  const chapter = workspace.chapters[chapterIndex]
  const scene = chapter?.scenes[sceneIndex]
  const chapterText = useMemo(() => getChapterText(workspace, chapterIndex, editingLanguage), [workspace, chapterIndex, editingLanguage])

  const updateChapter = patch => setWorkspace(current => ({
    ...current,
    chapters: current.chapters.map((item, index) => index === chapterIndex ? { ...item, ...patch } : item),
  }))
  const updateScene = patch => updateChapter({
    scenes: chapter.scenes.map((item, index) => index === sceneIndex ? { ...item, ...patch } : item),
  })
  const updateSceneText = value => updateScene({ content: { ...scene.content, [editingLanguage]: value } })
  const updateSceneContext = patch => updateScene({ context: { ...scene.context, ...patch } })
  const updateLocationLabel = value => updateSceneContext({
    locationLabels: { ...scene.context.locationLabels, [editingLanguage]: value },
  })

  const addChapter = () => {
    const next = createChapter(workspace.chapters.length + 1)
    setWorkspace(current => ({ ...current, chapters: [...current.chapters, next] }))
    setChapterIndex(workspace.chapters.length)
    setSceneIndex(0)
    setMessage('已建立空章节。接下来可以逐个加入 Scene。')
  }
  const addScene = () => {
    try {
      const result = insertScene(workspace, chapterIndex)
      setWorkspace(result.workspace)
      setSceneIndex(result.selectedSceneIndex)
      setMessage('已加入新的空 Scene。')
    } catch (error) { setMessage(error.message) }
  }
  const removeScene = () => {
    try {
      const result = deleteScene(workspace, chapterIndex, sceneIndex)
      setWorkspace(result.workspace)
      setSceneIndex(result.selectedSceneIndex)
      setMessage('当前 Scene 已移除。')
    } catch (error) { setMessage(error.message) }
  }
  const runSave = async () => {
    try { setMessage(''); await onSave(workspace); setBaseline(normalizeWorkspace(workspace)); setMessage('草稿已安全保存到 Supabase。') }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存失败。') }
  }
  const runPublish = async () => {
    try {
      setMessage('')
      const publication = compileWorkspace(workspace)
      await onPublish(workspace, publication)
      setBaseline(normalizeWorkspace(workspace))
      setMessage('章节 Scene 结构和中英文正文已通过验证，新的 Release 已发布。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '发布失败。') }
  }
  const openPreview = () => {
    try { writeAdminPreview(compileReaderWorkspace(workspace)); window.location.assign('/admin/preview') }
    catch (error) { setMessage(error instanceof Error ? error.message : '预览失败。') }
  }

  if (!chapter) return <main className="developer-workbench developer-empty-workbench"><header className="developer-workbench-header"><div><strong>Scene 内容工作台</strong><small>Story → Chapter / Release → Scene</small></div><a href="/">返回公开页面</a></header><section><h1>还没有章节</h1><p>先建立一个章节，然后按 Scene 01、Scene 02 的顺序逐个加入正文。</p><button type="button" onClick={addChapter}>新建第一个章节</button></section></main>

  return <main className="developer-workbench" aria-label="管理员 Scene 内容工作台">
    <header className="developer-workbench-header"><div><strong>Scene 内容工作台</strong><small>Story → Chapter / Release → Scene · Supabase 管理员草稿</small></div><div className="developer-header-actions"><button type="button" disabled={busy} onClick={openPreview}>Reader 临时预览</button><button type="button" disabled={busy} onClick={runSave}>保存草稿</button><button type="button" disabled={busy} onClick={runPublish}>验证并发布章节</button><a href="/">返回公开页面</a></div></header>
    <div className="developer-workbench-layout">
      <section className="developer-page-workspace">
        <div className="developer-page-heading"><div><label>章节标题（中文）<input value={chapter.title.zh} onChange={event => updateChapter({ title: { ...chapter.title, zh: event.target.value } })} /></label><label>Chapter title (English)<input value={chapter.title.en} onChange={event => updateChapter({ title: { ...chapter.title, en: event.target.value } })} /></label><small>当前章节：{chapter.id}</small></div><div className="developer-page-tabs" aria-label="Scene 列表">{chapter.scenes.map((item, index) => <button type="button" key={item.id} aria-pressed={index === sceneIndex} onClick={() => setSceneIndex(index)}>Scene {String(index + 1).padStart(2, '0')}</button>)}<button type="button" onClick={addScene}>＋ 新建 Scene</button></div></div>
        {!scene ? <div className="developer-no-page"><p>本章还没有 Scene。</p><button type="button" onClick={addScene}>新建 Scene 01</button></div> : <>
          <section className="developer-current-page-info"><h2>当前 Scene</h2><p><code>{scene.id}</code> · 第 {scene.order} 个 Scene</p><div className="developer-environment-fields" aria-label="Scene 场景状态"><label>世界<select value={scene.context.worldLayer} onChange={event => updateSceneContext({ worldLayer: event.target.value })}>{Object.entries(WORLD_LAYER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>地点 ID<input value={scene.context.locationId} onChange={event => updateSceneContext({ locationId: event.target.value })} placeholder="ancestral-home-courtyard" /></label><label>{LANGUAGE_LABELS[editingLanguage]}地点显示名<input value={scene.context.locationLabels[editingLanguage]} onChange={event => updateLocationLabel(event.target.value)} placeholder="祖宅院落" /></label><label>时间<select value={scene.context.time} onChange={event => updateSceneContext({ time: event.target.value })}>{!TIME_OPTIONS.some(option => option.value === scene.context.time) && <option value={scene.context.time}>{scene.context.time}</option>}{TIME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>天气<select value={scene.context.weather} onChange={event => updateSceneContext({ weather: event.target.value })}>{!WEATHER_OPTIONS.some(option => option.value === scene.context.weather) && <option value={scene.context.weather}>{scene.context.weather}</option>}{WEATHER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><small>这些字段只描述 Scene 的稳定状态；不会把 Reader 切页。缺少资料时保留“未知 / unknown”，不要补写设定。Scene 的边界本身由你确定，不额外保存事件标记。</small><div className="developer-page-tabs" aria-label="Scene 正文语言">{SCENE_LANGUAGES.map(language => <button type="button" key={language} aria-pressed={editingLanguage === language} onClick={() => setEditingLanguage(language)}>{LANGUAGE_LABELS[language]}</button>)}</div><textarea className="developer-page-editor" aria-label={`${LANGUAGE_LABELS[editingLanguage]} Scene 正文`} spellCheck="false" value={scene.content[editingLanguage]} onChange={event => updateSceneText(event.target.value)} placeholder={`${LANGUAGE_LABELS[editingLanguage]} 正文`} /><div className="developer-page-tools"><button type="button" onClick={addScene}>在后面加入下一个 Scene</button><button type="button" onClick={removeScene}>移除当前 Scene</button></div></section>
        </>}
        <div className="developer-workbench-actions"><button type="button" onClick={openPreview}>应用 Reader 预览</button><button type="button" disabled={busy} onClick={runSave}>保存草稿</button><button type="button" onClick={() => setWorkspace(baseline)}>恢复最近保存版本</button></div>
        {message && <p className="developer-workbench-message" role="status">{message}</p>}
      </section>
      <aside className="developer-chapter-library"><nav className="developer-chapter-list"><h2>章节 / Release</h2>{workspace.chapters.map((item, index) => <button type="button" key={item.id} aria-pressed={index === chapterIndex} onClick={() => { setChapterIndex(index); setSceneIndex(0); setMessage('') }}>{item.title.zh || `未命名章节 ${index + 1}`}</button>)}<button type="button" onClick={addChapter}>＋ 新建章节</button></nav><div className="developer-chapter-reference"><div><span>{chapter.title[editingLanguage] || chapter.title.zh || '未命名章节'}</span><small>当前章节的连续参考文本 · Scene 之间只在后台分隔</small></div><textarea aria-label="章节连续正文参考" readOnly value={chapterText} /></div></aside>
    </div>
  </main>
}

export default OwnerSceneWorkbench
