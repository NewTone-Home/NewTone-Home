import { READER_PAGE_MODES, READER_TRANSITION_TYPES, validateReaderContent } from './readerContent.js'

export const SCENE_SCHEMA_VERSION = 2
export const SCENE_LANGUAGES = Object.freeze(['zh', 'en', 'ja', 'ko', 'fr'])

function text(value) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : ''
}

function languageMap(value) {
  return Object.fromEntries(SCENE_LANGUAGES.map(language => [language, text(value?.[language])]))
}

function identifier(value, fallback) {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  return normalized || fallback
}

export function createSceneId(chapterId, sequence) {
  const chapter = identifier(chapterId, 'chapter_01')
  return `${chapter}_scene_${String(sequence).padStart(2, '0')}`
}

export function createScene(chapterId, sequence) {
  return { id: createSceneId(chapterId, sequence), order: sequence, content: languageMap() }
}

export function createChapter(sequence) {
  const id = `chapter_${String(sequence).padStart(2, '0')}`
  return { id, order: sequence, title: languageMap(), protagonistId: '', scenes: [] }
}

export function createEmptySceneWorkspace() {
  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
    storyId: 'main-reader',
    languages: [...SCENE_LANGUAGES],
    chapters: [],
  }
}

function normalizeScene(chapterId, scene, index) {
  return {
    id: typeof scene?.id === 'string' && scene.id.trim() ? scene.id.trim() : createSceneId(chapterId, index + 1),
    order: index + 1,
    content: languageMap(scene?.content ?? scene?.contentByLanguage),
  }
}

function normalizeV1Workspace(value) {
  return {
    ...createEmptySceneWorkspace(),
    chapters: (Array.isArray(value?.chapters) ? value.chapters : []).map((chapter, chapterIndex) => {
      const chapterId = identifier(chapter?.id, `chapter_${String(chapterIndex + 1).padStart(2, '0')}`)
      return {
        id: chapterId,
        order: chapterIndex + 1,
        title: languageMap({ zh: chapter?.title, en: chapter?.titleEn }),
        protagonistId: typeof chapter?.protagonistId === 'string' ? chapter.protagonistId : '',
        scenes: (Array.isArray(chapter?.pages) ? chapter.pages : []).map((page, pageIndex) => ({
          id: createSceneId(chapterId, pageIndex + 1),
          order: pageIndex + 1,
          content: languageMap({ zh: page?.text, en: page?.textEn }),
        })),
      }
    }),
  }
}

export function normalizeSceneWorkspace(value) {
  if (!value || value.schemaVersion !== SCENE_SCHEMA_VERSION || !Array.isArray(value.chapters)) {
    return normalizeV1Workspace(value)
  }
  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
    storyId: identifier(value.storyId, 'main-reader'),
    languages: [...SCENE_LANGUAGES],
    chapters: value.chapters.map((chapter, chapterIndex) => {
      const chapterId = typeof chapter?.id === 'string' && chapter.id.trim()
        ? chapter.id.trim()
        : `chapter_${String(chapterIndex + 1).padStart(2, '0')}`
      return {
        id: chapterId,
        order: chapterIndex + 1,
        title: languageMap(chapter?.title ?? chapter?.titleByLanguage),
        protagonistId: typeof chapter?.protagonistId === 'string' ? chapter.protagonistId : '',
        scenes: (Array.isArray(chapter?.scenes) ? chapter.scenes : []).map((scene, sceneIndex) => normalizeScene(chapterId, scene, sceneIndex)),
      }
    }),
  }
}

function sceneIdIsStable(id) {
  return /^[a-zA-Z0-9_]+_scene_\d{2,}$/.test(id)
}

export function validateScenePublication(publication, { requireCompleteLanguages = false } = {}) {
  if (!publication || publication.schemaVersion !== SCENE_SCHEMA_VERSION) throw new Error('内容必须使用 Scene schemaVersion 2。')
  if (typeof publication.storyId !== 'string' || !publication.storyId.trim()) throw new Error('缺少 Story ID。')
  if (!Array.isArray(publication.languages) || publication.languages.join('|') !== SCENE_LANGUAGES.join('|')) {
    throw new Error('语言清单必须固定为 zh、en、ja、ko、fr。')
  }
  if (!Array.isArray(publication.chapters) || publication.chapters.length === 0) throw new Error('至少需要一个章节。')

  const chapterIds = new Set()
  const sceneIds = new Set()
  publication.chapters.forEach((chapter, chapterIndex) => {
    if (!chapter?.id || chapterIds.has(chapter.id)) throw new Error(`章节 ID 无效或重复：${chapter?.id ?? ''}`)
    if (chapter.order !== chapterIndex + 1) throw new Error(`章节顺序无效：${chapter.id}`)
    if (!chapter.title?.zh?.trim()) throw new Error(`${chapter.id} 缺少中文标题。`)
    if (!Array.isArray(chapter.scenes) || chapter.scenes.length === 0) throw new Error(`${chapter.id} 至少需要一个 Scene。`)
    chapterIds.add(chapter.id)

    chapter.scenes.forEach((scene, sceneIndex) => {
      if (!scene?.id || !sceneIdIsStable(scene.id) || sceneIds.has(scene.id)) throw new Error(`Scene ID 无效或重复：${scene?.id ?? ''}`)
      if (scene.order !== sceneIndex + 1) throw new Error(`Scene 顺序无效：${scene.id}`)
      if (!scene.content?.zh?.trim()) throw new Error(`${scene.id} 缺少中文正文。`)
      if (requireCompleteLanguages && SCENE_LANGUAGES.some(language => !scene.content?.[language]?.trim())) {
        throw new Error(`${scene.id} 的所有语言正文必须一起提供。`)
      }
      sceneIds.add(scene.id)
    })
  })
  return publication
}

function sceneWorldState(scene, chapter) {
  return {
    worldLayer: 'surface', time: 'unknown', weather: 'unknown', light: 'neutral',
    locationId: scene.id, locationLabel: chapter.title.zh,
    characters: [],
    evidence: {
      worldLayer: { sourceType: 'scene-schema-default' },
      weather: { sourceType: 'scene-schema-default' },
    },
    locationLabels: { zh: chapter.title.zh, en: chapter.title.en || chapter.title.zh },
  }
}

export function compileScenePublicationToReader(publication) {
  validateScenePublication(publication)
  const pages = publication.chapters.map((chapter, chapterIndex) => {
    const nextChapter = publication.chapters[chapterIndex + 1]
    const title = chapter.title.zh.trim()
    const page = {
      id: chapter.id,
      chapterId: chapter.id,
      chapterTitle: title,
      chapterTitleByLanguage: chapter.title,
      protagonistId: identifier(chapter.protagonistId, 'protagonist'),
      mode: READER_PAGE_MODES.FOCUS_SEQUENCE,
      supportedModes: [READER_PAGE_MODES.FOCUS_SEQUENCE],
      scene: { id: chapter.id, label: title, labelByLanguage: chapter.title },
      beats: chapter.scenes.map(scene => {
        const blocks = [{ id: 'block-0', type: 'paragraph', text: scene.content.zh.trim(), source: { chapterId: chapter.id, sceneId: scene.id } }]
        const translations = {}
        // The current public Reader UI exposes zh/en. Other translations remain in the
        // canonical Scene payload and can be projected when their UI is enabled.
        SCENE_LANGUAGES.filter(language => language === 'en' && scene.content[language]?.trim()).forEach(language => {
          translations[language] = {
            blocks: [{ id: 'block-0', type: 'paragraph', text: scene.content[language].trim(), source: { chapterId: chapter.id, sceneId: scene.id } }],
          }
        })
        return {
          id: scene.id,
          source: { chapterId: chapter.id, sceneId: scene.id },
          blocks,
          translations,
          worldState: sceneWorldState(scene, chapter),
        }
      }),
      transitionType: nextChapter ? READER_TRANSITION_TYPES.STANDARD : READER_TRANSITION_TYPES.CHAPTER_END,
      boundary: {
        kind: 'continuous',
        transitionType: nextChapter ? READER_TRANSITION_TYPES.STANDARD : READER_TRANSITION_TYPES.CHAPTER_END,
        ...(nextChapter ? { target: { phaseId: 'M1', pageId: nextChapter.id, beatIndex: 0 } } : {}),
      },
    }
    return page
  })
  return validateReaderContent([{ id: 'M1', title: 'Reader', pages }])
}
