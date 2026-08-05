import { describe, expect, it } from 'vitest'
import {
  compileWorkspace, deleteWorkspacePage, EMPTY_WORKSPACE, getWorkspaceChapterText,
  insertWorkspacePage, mergeWorkspacePage, restoreWorkspacePage, splitWorkspacePage,
} from '../src/admin/contentWorkspace'

const draft = () => ({ schemaVersion: 1, chapters: [{
  id: 'chapter-one', title: 'Test', protagonistId: 'owner-test',
  pages: [
    { id: 'page-one', sceneLabel: 'Scene', text: 'alpha beta', worldLayer: 'surface', time: 'noon', weather: 'clear', light: 'neutral' },
    { id: 'page-two', sceneLabel: 'Scene 2', text: 'gamma', worldLayer: 'inner', time: 'night', weather: 'rain', light: 'dim' },
  ],
}] })

describe('owner content workspace', () => {
  it('starts intentionally empty and cannot publish empty content', () => {
    expect(EMPTY_WORKSPACE.chapters).toEqual([])
    expect(() => compileWorkspace(EMPTY_WORKSPACE)).toThrow('至少需要一个章节')
  })

  it('compiles owner-authored pages without adding prose', () => {
    const content = compileWorkspace({ schemaVersion: 1, chapters: [{
      id: 'chapter-one', title: '测试', titleEn: 'Test', protagonistId: 'owner-test',
      pages: [{ id: 'page-one', sceneLabel: '场景', sceneLabelEn: 'Scene', text: '甲\n\n乙', textEn: 'alpha\n\nbeta', translationParagraphCounts: { en: [1, 1] }, worldLayer: 'surface', time: 'noon', weather: 'clear', light: 'neutral' }],
    }] })
    expect(content[0].pages[0].beats.map(beat => beat.blocks[0].text)).toEqual(['甲', '乙'])
    expect(content[0].pages[0].beats.map(beat => beat.translations.en.blocks[0].text)).toEqual(['alpha', 'beta'])
  })

  it('preserves an explicit one-to-many English paragraph mapping', () => {
    const content = compileWorkspace({ schemaVersion: 1, chapters: [{
      id: 'chapter-one', title: '测试', titleEn: 'Test', protagonistId: 'owner-test',
      pages: [{ id: 'page-one', sceneLabel: '场景', sceneLabelEn: 'Scene', text: '甲\n\n乙', textEn: 'First.\n\nSecond.\n\nThird.', translationParagraphCounts: { en: [2, 1] }, worldLayer: 'surface', time: 'unknown', weather: 'unknown', light: 'neutral' }],
    }] })
    expect(content[0].pages[0].beats[0].translations.en.blocks.map(block => block.text)).toEqual(['First.', 'Second.'])
    expect(content[0].pages[0].beats[1].translations.en.blocks.map(block => block.text)).toEqual(['Third.'])
  })

  it('splits, inserts, merges, and deletes pages without inventing text', () => {
    const split = splitWorkspacePage(draft(), 0, 0, 5)
    expect(split.workspace.chapters[0].pages.map(page => page.text)).toEqual(['alpha', ' beta', 'gamma'])
    const merged = mergeWorkspacePage(split.workspace, 0, 0)
    expect(merged.workspace.chapters[0].pages.map(page => page.text)).toEqual(['alpha\n\n beta', 'gamma'])
    const inserted = insertWorkspacePage(merged.workspace, 0, 0)
    expect(inserted.workspace.chapters[0].pages[1].text).toBe('')
    const deleted = deleteWorkspacePage(inserted.workspace, 0, 1)
    expect(deleted.workspace.chapters[0].pages.map(page => page.text)).toEqual(['alpha\n\n beta', 'gamma'])
  })

  it('restores only from the persisted owner draft and derives continuous reference from it', () => {
    const baseline = draft()
    const edited = structuredClone(baseline)
    edited.chapters[0].pages[0].text = 'changed'
    const restored = restoreWorkspacePage(edited, baseline, 0, 0)
    expect(restored.chapters[0].pages[0].text).toBe('alpha beta')
    expect(getWorkspaceChapterText(restored, 0)).toBe('alpha beta\n\ngamma')
  })
})
