import { READER_PAGE_MODES, READER_TRANSITION_TYPES, validateReaderContent } from './readerContent.js'

export const SCENE_SCHEMA_VERSION = 3
export const SCENE_LANGUAGES = Object.freeze(['zh', 'en'])
export const SCENE_WORLD_LAYERS = Object.freeze(['surface', 'inner', 'transition', 'unknown'])

function text(value) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : ''
}

export function splitSceneTextIntoReaderBlocks(value, source) {
  const paragraphs = text(value)
    .trim()
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)

  return paragraphs.map((paragraph, index) => ({
    id: `block-${index}`,
    type: 'paragraph',
    text: paragraph,
    source,
  }))
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

export function createSceneContext() {
  return {
    worldLayer: 'unknown',
    locationId: '',
    locationLabels: languageMap(),
    time: 'unknown',
    weather: 'unknown',
  }
}

export function createScene(chapterId, sequence) {
  return { id: createSceneId(chapterId, sequence), order: sequence, context: createSceneContext(), content: languageMap() }
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
  const sourceContext = scene?.context ?? scene?.sceneContext
  return {
    id: typeof scene?.id === 'string' && scene.id.trim() ? scene.id.trim() : createSceneId(chapterId, index + 1),
    order: index + 1,
    context: {
      worldLayer: SCENE_WORLD_LAYERS.includes(sourceContext?.worldLayer) ? sourceContext.worldLayer : 'unknown',
      locationId: identifier(sourceContext?.locationId, ''),
      locationLabels: languageMap(sourceContext?.locationLabels ?? sourceContext?.locationLabelByLanguage),
      time: text(sourceContext?.time).trim() || 'unknown',
      weather: text(sourceContext?.weather).trim() || 'unknown',
    },
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
        scenes: (Array.isArray(chapter?.pages) ? chapter.pages : []).map((page, pageIndex) => normalizeScene(chapterId, {
          id: createSceneId(chapterId, pageIndex + 1),
          context: {
            worldLayer: page?.worldLayer,
            locationId: page?.id,
            locationLabels: { zh: page?.sceneLabel, en: page?.sceneLabelEn },
            time: page?.time,
            weather: page?.weather,
          },
          content: { zh: page?.text, en: page?.textEn },
        }, pageIndex)),
      }
    }),
  }
}

export function normalizeSceneWorkspace(value) {
  if (!value || ![2, SCENE_SCHEMA_VERSION].includes(value.schemaVersion) || !Array.isArray(value.chapters)) {
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
  if (!publication || publication.schemaVersion !== SCENE_SCHEMA_VERSION) throw new Error('内容必须使用 Scene schemaVersion 3。')
  if (typeof publication.storyId !== 'string' || !publication.storyId.trim()) throw new Error('缺少 Story ID。')
  if (!Array.isArray(publication.languages) || publication.languages.join('|') !== SCENE_LANGUAGES.join('|')) {
    throw new Error('语言清单必须固定为 zh、en。')
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
      if (!scene.context || !SCENE_WORLD_LAYERS.includes(scene.context.worldLayer)) throw new Error(`${scene.id} 的世界状态无效。`)
      if (typeof scene.context.locationId !== 'string') throw new Error(`${scene.id} 的地点 ID 无效。`)
      if (!scene.context.locationLabels || typeof scene.context.locationLabels !== 'object') throw new Error(`${scene.id} 缺少地点显示名。`)
      if (typeof scene.context.time !== 'string' || !scene.context.time.trim() || typeof scene.context.weather !== 'string' || !scene.context.weather.trim()) {
        throw new Error(`${scene.id} 缺少时间或天气状态。`)
      }
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
  const context = scene.context
  return {
    worldLayer: context.worldLayer, time: context.time, weather: context.weather, light: 'neutral',
    locationId: context.locationId || scene.id,
    locationLabel: context.locationLabels.zh || chapter.title.zh,
    locationLabels: Object.fromEntries(SCENE_LANGUAGES.map(language => [
      language,
      context.locationLabels[language] || chapter.title[language] || chapter.title.zh,
    ])),
    characters: [],
    evidence: {
      worldLayer: { sourceType: 'scene-schema' },
      weather: { sourceType: 'scene-schema' },
    },
  }
}

export function compileScenePublicationToReader(publication) {
  const normalized = normalizeSceneWorkspace(publication)
  validateScenePublication(normalized)
  const pages = normalized.chapters.map((chapter, chapterIndex) => {
    const nextChapter = normalized.chapters[chapterIndex + 1]
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
        const source = { chapterId: chapter.id, sceneId: scene.id }
        const blocks = splitSceneTextIntoReaderBlocks(scene.content.zh, source)
        const translations = {}
        // Scene remains the persisted unit; paragraph blocks are Reader-only compatibility output.
        SCENE_LANGUAGES.filter(language => language === 'en' && scene.content[language]?.trim()).forEach(language => {
          translations[language] = {
            blocks: splitSceneTextIntoReaderBlocks(scene.content[language], source),
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
