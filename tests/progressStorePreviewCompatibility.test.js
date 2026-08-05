import { describe, expect, it } from 'vitest'
import { compileWorkspace } from '../src/admin/contentWorkspace.js'
import { setReaderContent } from '../src/data/readerContent.js'
import { chooseFurthestLocation } from '../src/stores/progressStore.js'

describe('preview progress compatibility', () => {
  it('uses the current preview location when saved progress references another publication', () => {
    setReaderContent(compileWorkspace({
      schemaVersion: 1,
      chapters: [{
        id: 'chapter-one',
        title: '第一章',
        titleEn: 'Chapter One',
        protagonistId: 'reader',
        pages: [{
          id: 'preview-page',
          sceneLabel: '预览',
          sceneLabelEn: 'Preview',
          text: '第一段\n\n第二段',
          textEn: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
          translationParagraphCounts: { en: [] },
          worldLayer: 'surface',
          time: 'morning',
          weather: 'clear',
          light: 'neutral',
        }],
      }],
    }))

    const current = { phaseId: 'M1', pageId: 'preview-page', beatIndex: 1 }
    expect(chooseFurthestLocation(current, { phaseId: 'M1', pageId: '', beatIndex: 0 }))
      .toEqual(current)
  })
})
