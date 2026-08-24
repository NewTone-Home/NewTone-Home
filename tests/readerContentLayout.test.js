import { describe, expect, it } from 'vitest'
import { collapseReaderPagesByChapter, validateReaderContent } from '../src/data/readerContent'

const page = ({ id, chapterId = 'chapter-01', chapterTitle = '第一章', beatId, text }) => ({
  id,
  chapterId,
  chapterTitle,
  protagonistId: 'reader',
  mode: 'focus-sequence',
  supportedModes: ['focus-sequence'],
  scene: { id, label: id },
  beats: [{
    id: beatId,
    blocks: [{ id: 'block-0', type: 'paragraph', text, source: { chapterId, paragraphId: beatId } }],
  }],
  transitionType: 'standard',
  boundary: { kind: 'continuous', transitionType: 'standard', target: { phaseId: 'M1', pageId: id, beatIndex: 0 } },
})

describe('Reader legacy page compatibility', () => {
  it('collapses all pages of one chapter into one continuous Reader page', () => {
    const content = [{ id: 'M1', title: 'Reader', pages: [
      page({ id: 'page-a', beatId: 'beat-a', text: '甲' }),
      page({ id: 'page-b', beatId: 'beat-b', text: '乙' }),
      page({ id: 'page-c', beatId: 'beat-c', text: '丙' }),
    ] }]

    const collapsed = collapseReaderPagesByChapter(content)
    validateReaderContent(collapsed)

    expect(collapsed[0].pages).toHaveLength(1)
    expect(collapsed[0].pages[0].id).toBe('chapter-01')
    expect(collapsed[0].pages[0].beats.map(beat => beat.id)).toEqual(['beat-a', 'beat-b', 'beat-c'])
    expect(collapsed[0].pages[0].transitionType).toBe('chapter-end')
  })

  it('keeps separate chapters as separate Reader pages', () => {
    const content = [{ id: 'M1', title: 'Reader', pages: [
      page({ id: 'chapter-01-page-a', beatId: 'beat-a', text: '甲' }),
      page({ id: 'chapter-02-page-a', chapterId: 'chapter-02', chapterTitle: '第二章', beatId: 'beat-b', text: '乙' }),
    ] }]

    const collapsed = collapseReaderPagesByChapter(content)
    expect(collapsed[0].pages.map(item => item.id)).toEqual(['chapter-01', 'chapter-02'])
    expect(collapsed[0].pages[0].boundary.target).toEqual({ phaseId: 'M1', pageId: 'chapter-02', beatIndex: 0 })
  })
})
