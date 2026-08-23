import { describe, expect, it } from 'vitest'
import {
  compileReaderWorkspace,
  compileWorkspace,
  createChapter,
  createScene,
  EMPTY_WORKSPACE,
  insertScene,
  normalizeWorkspace,
} from '../src/admin/sceneWorkspace'

function completeWorkspace() {
  const chapter = createChapter(2)
  chapter.title = { zh: '第二章', en: 'Chapter Two', ja: '第二章', ko: '제2장', fr: 'Chapitre Deux' }
  chapter.scenes = [createScene(chapter.id, 1), createScene(chapter.id, 2)]
  chapter.scenes[0].context = {
    worldLayer: 'inner',
    locationId: 'shopping_district_corner_cafe',
    locationLabels: { zh: '商业街拐角咖啡馆', en: 'Corner café on the shopping street', ja: '', ko: '', fr: '' },
    time: 'daylight',
    weather: 'clear_day_6',
  }
  chapter.scenes[0].content = { zh: '中文 Scene 1\n\n不要求英文段落对应。', en: 'English Scene 1 can have a different paragraph shape.', ja: '日本語 Scene 1', ko: '한국어 Scene 1', fr: 'Scène 1 en français' }
  chapter.scenes[1].content = { zh: '中文 Scene 2', en: 'English Scene 2', ja: '日本語 Scene 2', ko: '한국어 Scene 2', fr: 'Scène 2 en français' }
  return { ...EMPTY_WORKSPACE, chapters: [chapter] }
}

describe('Scene content workspace', () => {
  it('starts with an empty Story -> Chapter -> Scene workspace', () => {
    expect(EMPTY_WORKSPACE).toMatchObject({ schemaVersion: 3, storyId: 'main-reader', languages: ['zh', 'en', 'ja', 'ko', 'fr'], chapters: [] })
  })

  it('converts legacy pages into stable Scene IDs without paragraph mapping', () => {
    const normalized = normalizeWorkspace({
      schemaVersion: 1,
      chapters: [{ id: 'chapter-02', title: '第二章', titleEn: 'Chapter Two', pages: [{ id: 'old-page', text: '中文', textEn: 'English' }] }],
    })
    expect(normalized.schemaVersion).toBe(3)
    expect(normalized.chapters[0].scenes[0]).toMatchObject({ id: 'chapter_02_scene_01', context: { worldLayer: 'unknown', locationId: 'old_page', time: 'unknown', weather: 'unknown' }, content: { zh: '中文', en: 'English' } })
    expect(normalized.chapters[0].scenes[0].content).not.toHaveProperty('translationParagraphCounts')
  })

  it('upgrades a published v2 Scene without inventing scene context', () => {
    const normalized = normalizeWorkspace({
      schemaVersion: 2,
      storyId: 'main-reader',
      languages: ['zh', 'en', 'ja', 'ko', 'fr'],
      chapters: [{
        id: 'chapter_01', order: 1, title: { zh: '第一章' }, scenes: [{
          id: 'chapter_01_scene_01', order: 1,
          content: { zh: '中文', en: 'English', ja: '日本語', ko: '한국어', fr: 'Français' },
        }],
      }],
    })
    expect(normalized).toMatchObject({ schemaVersion: 3 })
    expect(normalized.chapters[0].scenes[0].context).toMatchObject({
      worldLayer: 'unknown', locationId: '', time: 'unknown', weather: 'unknown',
    })
  })

  it('appends one new Scene while preserving authored boundaries', () => {
    const workspace = completeWorkspace()
    const result = insertScene(workspace, 0)
    expect(result.workspace.chapters[0].scenes.map(scene => scene.id)).toEqual([
      'chapter_02_scene_01', 'chapter_02_scene_02', 'chapter_02_scene_03',
    ])
    expect(result.selectedSceneIndex).toBe(2)
  })

  it('publishes the canonical multilingual structure and derives Reader runtime separately', () => {
    const publication = compileWorkspace(completeWorkspace())
    expect(publication.chapters[0].scenes.map(scene => scene.id)).toEqual(['chapter_02_scene_01', 'chapter_02_scene_02'])
    expect(publication.chapters[0].scenes[0].content.zh).toContain('不要求英文段落对应')
    expect(publication.chapters[0].scenes[0].content.en).toContain('different paragraph shape')
    expect(Object.keys(publication.chapters[0].scenes[0].content)).toEqual(['zh', 'en', 'ja', 'ko', 'fr'])
    expect(JSON.stringify(publication)).not.toContain('"beats"')
    expect(JSON.stringify(publication)).not.toContain('"blocks"')

    const reader = compileReaderWorkspace(publication)
    expect(reader[0].pages).toHaveLength(1)
    expect(reader[0].pages[0].beats.map(beat => beat.id)).toEqual(['chapter_02_scene_01', 'chapter_02_scene_02'])
    expect(reader[0].pages[0].beats[0].blocks).toHaveLength(1)
    expect(reader[0].pages[0].beats[0].translations.en.blocks[0].text).toContain('different paragraph shape')
    expect(reader[0].pages[0].beats[0].worldState).toMatchObject({
      worldLayer: 'inner', locationId: 'shopping_district_corner_cafe', time: 'daylight', weather: 'clear_day_6',
    })
  })

  it('requires every declared language at publish time', () => {
    const workspace = completeWorkspace()
    workspace.chapters[0].scenes[0].content.fr = ''
    expect(() => compileWorkspace(workspace)).toThrow('所有语言正文必须一起提供')
  })
})
