import { describe, expect, it } from 'vitest'
import { compileWorkspace, EMPTY_WORKSPACE } from '../src/admin/contentWorkspace'

describe('owner content workspace', () => {
  it('starts intentionally empty and cannot publish empty content', () => {
    expect(EMPTY_WORKSPACE.chapters).toEqual([])
    expect(() => compileWorkspace(EMPTY_WORKSPACE)).toThrow('至少需要一个章节')
  })

  it('compiles owner-authored pages without adding prose', () => {
    const content = compileWorkspace({ schemaVersion: 1, chapters: [{
      id: 'chapter-one', title: 'Test', protagonistId: 'owner-test',
      pages: [{ id: 'page-one', sceneLabel: 'Scene', text: 'alpha\n\nbeta', worldLayer: 'surface', time: 'noon', weather: 'clear', light: 'neutral' }],
    }] })
    expect(content[0].pages[0].beats.map(beat => beat.blocks[0].text)).toEqual(['alpha', 'beta'])
  })
})
