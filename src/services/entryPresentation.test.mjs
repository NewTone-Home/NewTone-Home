import { describe, it, expect } from 'vitest'
import { entryPreferences, entryPresentation, landingIntroState } from './entryPresentation.mjs'
describe('entry preference consumption', () => {
  it('keeps invalid or missing intro evidence unknown instead of treating it as first use', () => {
    expect(landingIntroState({ status: 'unknown', learned: null })).toBe('unknown')
    expect(landingIntroState(undefined)).toBe('unknown')
    expect(landingIntroState({ status: 'not-learned', learned: true })).toBe('unknown')
    expect(landingIntroState({ status: 'not-learned', learned: false })).toBe('not-learned')
    expect(landingIntroState({ status: 'learned', learned: true })).toBe('learned')
  })
  it('preserves all valid UI preferences and excludes game progress', () => {
    const prefs = { language: 'en', hasInitializedLanguage: true, hasInitializedReadingMode: true, readingMode: 'standard', themePosition: .8, standardTheme: 'dark', motionMode: 'reduced' }
    expect(entryPreferences({ ...prefs, readerCompleted: true, currentSceneId: 'commercial-street' })).toEqual(prefs)
  })
  it('uses saved language rather than browser language once initialized', () => {
    expect(entryPresentation({ language: 'en', hasInitializedLanguage: true }, ['zh-CN']).text.cancel).toBe('Cancel')
    expect(entryPresentation({ language: 'zh', hasInitializedLanguage: true }, ['en']).text.cancel).toBe('取消')
  })
  it('uses the existing browser-language fallback before language initialization', () => {
    expect(entryPresentation({}, ['en-US']).text.continue).toBe('Continue')
  })
  it('rejects invalid UI preference values without importing a progress store', () => {
    expect(entryPreferences({ themePosition: 2, motionMode: 'invalid', hasInitializedLanguage: 'yes' })).toEqual({})
  })
})

it('shows explicit previous-test restart copy in both languages without promising cloud/permanent storage',()=>{
 const zh=entryPresentation({language:'zh',hasInitializedLanguage:true}).text;
 const en=entryPresentation({language:'en',hasInitializedLanguage:true}).text;
 expect(zh.restart).toBe('开始新游戏');expect(zh['legacy-ready']).toContain('此前测试进度本次不沿用');expect(en.restart).toBe('Start new game');expect(en['legacy-ready']).toContain('will not carry over');
})
