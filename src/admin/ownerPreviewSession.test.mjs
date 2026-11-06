import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ReaderPreviewStoreProvider, useProgressStoreApi } from '../stores/progressStore.js'
import { useTransitionStore } from '../stores/transitionStore.js'
import { describe,it,expect,vi,afterEach } from 'vitest'
import { compileWorkspace } from './contentWorkspace.js'
import { setReaderContent } from '../data/readerContent.js'
import { openOwnerPreviewSession } from './ownerPreviewSession.mjs'
import { getGameStorage,installGameStorage } from '../save-session.mjs'
function content() {
  setReaderContent(compileWorkspace({schemaVersion:1,chapters:[{id:'chapter-one',title:'草稿',titleEn:'Draft',protagonistId:'reader',pages:[{id:'draft-page',sceneLabel:'预览',sceneLabelEn:'Preview',text:'第一段。\n\n第二段。',textEn:'First.\n\nSecond.',translationParagraphCounts:{en:[]},worldLayer:'surface',time:'morning',weather:'clear',light:'neutral'}]}]}))
}
afterEach(()=>{vi.useRealTimers();installGameStorage(null)})
describe('owner preview private scope',()=>{
  it('routes hook and imperative reads through the same preview scope without a game session',()=>{
    content();const preview=openOwnerPreviewSession()
    preview.stores.progressStore.getState().setLanguage('en')
    function Probe() {
      const progress=useProgressStoreApi()
      const phase=useTransitionStore(state=>state.phase)
      return createElement('span',null,progress.getState().language+':'+phase)
    }
    const result=renderToString(createElement(ReaderPreviewStoreProvider,{stores:preview.stores},createElement(Probe)))
    expect(result).toContain('en:idle');preview.release()
  })
  it('never replaces or mutates a player storage capability',()=>{
    content();const player={getItem:vi.fn(),setItem:vi.fn(),removeItem:vi.fn()};installGameStorage(player)
    const preview=openOwnerPreviewSession()
    preview.stores.progressStore.getState().setLanguage('en')
    expect(getGameStorage()).toBe(player)
    expect(player.getItem).not.toHaveBeenCalled();expect(player.setItem).not.toHaveBeenCalled()
    expect(player.removeItem).not.toHaveBeenCalled();preview.release()
  })
  it('keeps return timers and navigation in the preview store',()=>{
    vi.useFakeTimers();content()
    const player={};installGameStorage(player)
    const preview=openOwnerPreviewSession(),other=openOwnerPreviewSession()
    preview.stores.transitionStore.getState().transitionTo('landing',{preset:'reader-to-surface',waitForReady:false})
    vi.runAllTimers()
    expect(preview.stores.progressStore.getState().currentView).toBe('landing')
    expect(other.stores.progressStore.getState().currentView).toBe('reader')
    expect(getGameStorage()).toBe(player)
    preview.release();other.release()
  })
})
