import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { compileWorkspace } from '../src/admin/contentWorkspace'
import { READER_STEP_ACTIONS } from '../src/reader/readerAdvance'
import { canCompleteReader, isReaderFinalLocation } from '../src/reader/readerCompletion'
import { createReaderIndex } from '../src/reader/readerPosition'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const orchestrator = read('../src/views/ReaderOrchestrator.jsx')
const stage = read('../src/views/ReaderStage.jsx')

describe('Reader completion prompt contract', () => {
  it('marks only the final reader location after a chapter-end action', () => {
    const content = compileWorkspace({
      schemaVersion: 1,
      chapters: [{
        id: 'chapter-one',
        title: '第一章',
        titleEn: 'Chapter One',
        protagonistId: 'reader',
        pages: [{
          id: 'final-page',
          sceneLabel: '终点',
          sceneLabelEn: 'The end',
          text: '最后一行',
          textEn: 'The final line',
          translationParagraphCounts: { en: [] },
          worldLayer: 'surface',
          time: 'morning',
          weather: 'clear',
          light: 'neutral',
        }],
      }],
    })
    const finalLocation = createReaderIndex(content).entries.at(-1)

    expect(isReaderFinalLocation(finalLocation, content)).toBe(true)
    expect(canCompleteReader({
      location: finalLocation,
      action: { type: READER_STEP_ACTIONS.CHAPTER_END },
      readerCompleted: false,
      content,
    })).toBe(true)
    expect(canCompleteReader({
      location: finalLocation,
      action: { type: READER_STEP_ACTIONS.CHAPTER_END },
      readerCompleted: true,
      content,
    })).toBe(false)
    expect(canCompleteReader({
      location: finalLocation,
      action: { type: READER_STEP_ACTIONS.PAGE },
      readerCompleted: false,
      content,
    })).toBe(false)
  })

  it('records completion without rendering a completion prompt', () => {
    expect(orchestrator).toContain('canCompleteReader({')
    expect(orchestrator).toContain("recordRuntimeAudit('reader-completion-marked'")
    expect(orchestrator).not.toContain('completionPromptVisible')
    expect(orchestrator).not.toContain('setCompletionPromptVisible')
    expect(stage).not.toContain('<ReaderCompletionPrompt')
    expect(stage).not.toContain('completionPromptVisible')
  })
})
