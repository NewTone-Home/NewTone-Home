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
