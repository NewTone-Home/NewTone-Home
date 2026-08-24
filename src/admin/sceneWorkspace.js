import {
  createChapter,
  createEmptySceneWorkspace,
  createScene,
  compileScenePublicationToReader,
  normalizeSceneWorkspace,
  SCENE_LANGUAGES,
  validateScenePublication,
} from '../data/scenePublication.js'

export const EMPTY_WORKSPACE = Object.freeze(createEmptySceneWorkspace())

export function normalizeWorkspace(value) {
  return normalizeSceneWorkspace(value)
}

export function compileWorkspace(workspace) {
  const normalized = normalizeWorkspace(workspace)
  validateScenePublication(normalized, { requireCompleteLanguages: true })
  return normalized
}

export function compileReaderWorkspace(workspace) {
  return compileScenePublicationToReader(normalizeWorkspace(workspace))
}

export { SCENE_LANGUAGES, createChapter, createScene }

function editChapter(workspace, chapterIndex, operation) {
  const normalized = normalizeWorkspace(workspace)
  const chapter = normalized.chapters[chapterIndex]
  if (!chapter) throw new Error('找不到当前章节。')
  normalized.chapters[chapterIndex] = operation(chapter)
  return normalized
}

export function insertScene(workspace, chapterIndex) {
  const normalized = normalizeWorkspace(workspace)
  const chapter = normalized.chapters[chapterIndex]
  if (!chapter) throw new Error('找不到当前章节。')
  const nextSequence = chapter.scenes.reduce((highest, scene) => {
    const match = scene.id.match(/_scene_(\d+)$/)
    return Math.max(highest, match ? Number(match[1]) : 0)
  }, 0) + 1
  const nextScene = createScene(chapter.id, nextSequence)
  return {
    workspace: editChapter(normalized, chapterIndex, current => ({ ...current, scenes: [...current.scenes, nextScene] })),
    selectedSceneIndex: chapter.scenes.length,
  }
}

export function deleteScene(workspace, chapterIndex, sceneIndex) {
  const normalized = normalizeWorkspace(workspace)
  const chapter = normalized.chapters[chapterIndex]
  if (!chapter || !chapter.scenes[sceneIndex]) throw new Error('找不到当前 Scene。')
  const scenes = chapter.scenes.filter((_, index) => index !== sceneIndex)
  return {
    workspace: editChapter(normalized, chapterIndex, current => ({
      ...current,
      scenes: scenes.map((scene, index) => ({ ...scene, order: index + 1 })),
    })),
    selectedSceneIndex: Math.min(Math.max(0, sceneIndex - 1), Math.max(0, scenes.length - 1)),
  }
}

export function getChapterText(workspace, chapterIndex, language = 'zh') {
  return normalizeWorkspace(workspace).chapters[chapterIndex]?.scenes
    .map(scene => scene.content[language] || '')
    .filter(Boolean)
    .join('\n\n') ?? ''
}
