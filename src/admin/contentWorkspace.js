import { READER_PAGE_MODES, READER_TRANSITION_TYPES, validateReaderContent } from '../data/readerContent'

export const EMPTY_WORKSPACE = Object.freeze({ schemaVersion: 1, chapters: [] })

export function normalizeWorkspace(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.chapters)) return structuredClone(EMPTY_WORKSPACE)
  return {
    schemaVersion: 1,
    chapters: value.chapters.map(chapter => ({
      id: typeof chapter.id === 'string' ? chapter.id : '',
      title: typeof chapter.title === 'string' ? chapter.title : '',
      protagonistId: typeof chapter.protagonistId === 'string' ? chapter.protagonistId : '',
      pages: Array.isArray(chapter.pages) ? chapter.pages.map(page => ({
        id: typeof page.id === 'string' ? page.id : '',
        sceneLabel: typeof page.sceneLabel === 'string' ? page.sceneLabel : '',
        text: typeof page.text === 'string' ? page.text.replace(/\r\n?/g, '\n') : '',
        worldLayer: typeof page.worldLayer === 'string' ? page.worldLayer : 'surface',
        time: typeof page.time === 'string' ? page.time : 'noon',
        weather: typeof page.weather === 'string' ? page.weather : 'clear',
        light: typeof page.light === 'string' ? page.light : 'neutral',
      })) : [],
    })),
  }
}

function slug(value, fallback) {
  const normalized = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function compileWorkspace(workspace) {
  const normalized = normalizeWorkspace(workspace)
  if (normalized.chapters.length === 0) throw new Error('至少需要一个章节。')
  const pageDefinitions = normalized.chapters.flatMap((chapter, chapterIndex) => {
    if (!chapter.title.trim()) throw new Error(`第 ${chapterIndex + 1} 章缺少标题。`)
    if (!chapter.protagonistId.trim()) throw new Error(`第 ${chapterIndex + 1} 章缺少主角标识。`)
    if (chapter.pages.length === 0) throw new Error(`第 ${chapterIndex + 1} 章至少需要一页。`)
    const chapterId = slug(chapter.id, `chapter-${chapterIndex + 1}`)
    return chapter.pages.map((page, pageIndex) => {
      const pageId = slug(page.id, `${chapterId}-page-${pageIndex + 1}`)
      const paragraphs = page.text.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean)
      if (paragraphs.length === 0) throw new Error(`${chapter.title} 第 ${pageIndex + 1} 页没有正文。`)
      return {
        id: pageId, chapterId, chapterTitle: chapter.title.trim(), protagonistId: slug(chapter.protagonistId, 'protagonist'),
        mode: READER_PAGE_MODES.FOCUS_SEQUENCE,
        supportedModes: [READER_PAGE_MODES.FOCUS_SEQUENCE, READER_PAGE_MODES.FLOW],
        scene: { id: pageId, label: page.sceneLabel.trim() || chapter.title.trim() },
        beats: paragraphs.map((text, paragraphIndex) => ({
          id: `${pageId}-beat-${paragraphIndex + 1}`,
          source: { chapterId, paragraphIds: [`p-${String(paragraphIndex + 1).padStart(3, '0')}`] },
          blocks: [{
            id: 'block-0', type: 'paragraph', text,
            source: { chapterId, paragraphId: `p-${String(paragraphIndex + 1).padStart(3, '0')}` },
          }],
          worldState: {
            worldLayer: page.worldLayer, time: page.time, weather: page.weather,
            light: page.light, locationId: pageId, locationLabel: page.sceneLabel.trim() || chapter.title.trim(),
          },
        })),
      }
    })
  })
  const pages = pageDefinitions.map((page, index) => {
    const next = pageDefinitions[index + 1]
    const transitionType = next ? READER_TRANSITION_TYPES.STANDARD : READER_TRANSITION_TYPES.CHAPTER_END
    return {
      ...page, transitionType,
      boundary: {
        kind: 'continuous', transitionType,
        ...(next ? { target: { phaseId: 'M1', pageId: next.id, beatIndex: 0 } } : {}),
      },
    }
  })
  return validateReaderContent([{ id: 'M1', title: 'Reader', pages }])
}

export function createChapter(sequence) {
  return { id: `chapter-${sequence}`, title: '', protagonistId: '', pages: [] }
}

export function createPage(chapterId, sequence) {
  return { id: `${chapterId || 'chapter'}-page-${sequence}`, sceneLabel: '', text: '', worldLayer: 'surface', time: 'noon', weather: 'clear', light: 'neutral' }
}

function editChapter(workspace, chapterIndex, operation) {
  const normalized = normalizeWorkspace(workspace)
  const chapter = normalized.chapters[chapterIndex]
  if (!chapter) throw new Error('找不到当前章节。')
  normalized.chapters[chapterIndex] = operation(chapter)
  return normalized
}

function uniquePageId(chapter) {
  const used = new Set(chapter.pages.map(page => page.id))
  let sequence = chapter.pages.length + 1
  let id = `${chapter.id || 'chapter'}-page-${sequence}`
  while (used.has(id)) { sequence += 1; id = `${chapter.id || 'chapter'}-page-${sequence}` }
  return id
}

export function splitWorkspacePage(workspace, chapterIndex, pageIndex, cursorOffset) {
  let selectedPageIndex = pageIndex
  const nextWorkspace = editChapter(workspace, chapterIndex, chapter => {
    const page = chapter.pages[pageIndex]
    if (!page) throw new Error('找不到当前页。')
    const offset = Math.min(Math.max(Number(cursorOffset) || 0, 0), page.text.length)
    const nextPage = { ...page, id: uniquePageId(chapter), text: page.text.slice(offset) }
    const pages = chapter.pages.slice()
    pages.splice(pageIndex, 1, { ...page, text: page.text.slice(0, offset) }, nextPage)
    selectedPageIndex = pageIndex + 1
    return { ...chapter, pages }
  })
  return { workspace: nextWorkspace, selectedPageIndex }
}

export function insertWorkspacePage(workspace, chapterIndex, pageIndex) {
  let selectedPageIndex = pageIndex
  const nextWorkspace = editChapter(workspace, chapterIndex, chapter => {
    const current = chapter.pages[pageIndex]
    if (!current) throw new Error('找不到当前页。')
    const page = { ...createPage(chapter.id, chapter.pages.length + 1), id: uniquePageId(chapter), worldLayer: current.worldLayer, time: current.time, weather: current.weather, light: current.light }
    const pages = chapter.pages.slice()
    pages.splice(pageIndex + 1, 0, page)
    selectedPageIndex = pageIndex + 1
    return { ...chapter, pages }
  })
  return { workspace: nextWorkspace, selectedPageIndex }
}

export function mergeWorkspacePage(workspace, chapterIndex, pageIndex) {
  const nextWorkspace = editChapter(workspace, chapterIndex, chapter => {
    const page = chapter.pages[pageIndex]
    const following = chapter.pages[pageIndex + 1]
    if (!page || !following) throw new Error('当前页后没有可合并页面。')
    const separator = page.text && following.text ? '\n\n' : ''
    const pages = chapter.pages.slice()
    pages.splice(pageIndex, 2, { ...page, text: `${page.text}${separator}${following.text}` })
    return { ...chapter, pages }
  })
  return { workspace: nextWorkspace, selectedPageIndex: pageIndex }
}

export function deleteWorkspacePage(workspace, chapterIndex, pageIndex) {
  let selectedPageIndex = Math.max(0, pageIndex - 1)
  const nextWorkspace = editChapter(workspace, chapterIndex, chapter => {
    const pages = chapter.pages.filter((_, index) => index !== pageIndex)
    selectedPageIndex = Math.min(selectedPageIndex, Math.max(0, pages.length - 1))
    return { ...chapter, pages }
  })
  return { workspace: nextWorkspace, selectedPageIndex }
}

export function restoreWorkspacePage(workspace, baseline, chapterIndex, pageIndex) {
  const normalizedBaseline = normalizeWorkspace(baseline)
  const current = normalizeWorkspace(workspace)
  const page = current.chapters[chapterIndex]?.pages[pageIndex]
  const baselineChapter = normalizedBaseline.chapters.find(chapter => chapter.id === current.chapters[chapterIndex]?.id)
  const original = baselineChapter?.pages.find(candidate => candidate.id === page?.id)
  if (!page || !original) throw new Error('此页尚未保存，没有可恢复的版本。')
  return editChapter(current, chapterIndex, chapter => ({ ...chapter, pages: chapter.pages.map((candidate, index) => index === pageIndex ? structuredClone(original) : candidate) }))
}

export function getWorkspaceChapterText(workspace, chapterIndex) {
  return normalizeWorkspace(workspace).chapters[chapterIndex]?.pages.map(page => page.text).filter(Boolean).join('\n\n') ?? ''
}
