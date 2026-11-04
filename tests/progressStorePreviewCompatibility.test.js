import { describe, expect, it, vi, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { compileWorkspace } from '../src/admin/contentWorkspace.js'
import { setReaderContent } from '../src/data/readerContent.js'
import { chooseFurthestLocation, createReaderPreviewStores, ReaderPreviewStoreProvider, useProgressStore, useProgressStoreApi } from '../src/stores/progressStore.js'
import { useNarrativeProgressStoreApi } from '../src/stores/narrativeProgressStore.js'

function setPreview() {
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
}
afterEach(() => vi.unstubAllGlobals())

describe('preview progress compatibility', () => {
  it('uses the current preview location when saved progress references another publication', () => {
    setPreview()

    const current = { phaseId: 'M1', pageId: 'preview-page', beatIndex: 1 }
    expect(chooseFurthestLocation(current, { phaseId: 'M1', pageId: '', beatIndex: 0 }))
      .toEqual(current)
  })
})

describe('bounded stale Reader comparison', () => {
  it('preserves a valid later previous address without moving backwards', () => {
    setPreview()
    const current = { phaseId: 'M1', pageId: 'preview-page', beatIndex: 0 }
    const previous = { ...current, beatIndex: 1 }
    expect(chooseFurthestLocation(current, previous)).toBe(previous)
  })
  it('rejects an invalid current address even when the previous publication is stale', () => {
    setPreview()
    expect(() => chooseFurthestLocation({ phaseId: 'M1', pageId: 'missing-current', beatIndex: 0 }, { phaseId: 'M1', pageId: '', beatIndex: 0 })).toThrow(RangeError)
  })
  it('does not classify malformed previous data or arbitrary getters as stale addresses', () => {
    setPreview()
    const current = { phaseId: 'M1', pageId: 'preview-page', beatIndex: 0 }
    expect(() => chooseFurthestLocation(current, null)).toThrow(TypeError)
    expect(() => chooseFurthestLocation(current, { phaseId: 'M1', pageId: 'preview-page', beatIndex: '0' })).toThrow(RangeError)
    const failure = RangeError('unrelated accessor failure')
    expect(() => chooseFurthestLocation(current, { get phaseId() { throw failure } })).toThrow(failure)
  })
})
describe('owner Reader stores stay in a root-local memory scope', () => {
  it('uses current preview content and never opens player storage or a game handle', () => {
    setPreview()
    const physicalRead = vi.fn(() => { throw Error('player storage must stay closed') })
    vi.stubGlobal('localStorage', { getItem: physicalRead, setItem: physicalRead, removeItem: physicalRead })
    const first = createReaderPreviewStores({ language: 'en', themePosition: .75, motionMode: 'reduced' })
    const second = createReaderPreviewStores()
    expect(first.progressStore.getState()).toMatchObject({ currentView: 'reader', readerStarted: true, language: 'en', motionMode: 'reduced', hasInitializedLanguage: true, hasInitializedReadingMode: true, committedLocation: { phaseId: 'M1', pageId: 'preview-page', beatIndex: 0 } })
    first.progressStore.getState().setLanguage('zh')
    first.progressStore.getState().commitLocation({ phaseId: 'M1', pageId: 'preview-page', beatIndex: 1 })
    expect(second.progressStore.getState().committedLocation.beatIndex).toBe(0)
    expect(first.narrativeStore).not.toBe(second.narrativeStore)
    expect(useProgressStore.setState).toBeUndefined()
    expect(physicalRead).not.toHaveBeenCalled()
  })
  it('resolves hook and command APIs from the provider instead of ambient player storage', () => {
    setPreview()
    const physicalRead = vi.fn(() => { throw Error('player storage must stay closed') })
    vi.stubGlobal('localStorage', { getItem: physicalRead, setItem: physicalRead })
    const stores = createReaderPreviewStores({ language: 'en' })
    function PreviewProbe() {
      expect(useProgressStoreApi()).toBe(stores.progressStore)
      expect(useNarrativeProgressStoreApi()).toBe(stores.narrativeStore)
      return createElement('span', null, useProgressStore(state => state.language))
    }
    const html = renderToString(createElement(ReaderPreviewStoreProvider, { stores }, createElement(PreviewProbe)))
    expect(html).toContain('en')
    expect(physicalRead).not.toHaveBeenCalled()
  })
})
