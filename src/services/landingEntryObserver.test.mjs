import { describe,it,expect,vi } from 'vitest'
import { createLandingEntryObserver } from './landingEntryObserver.mjs'
describe('visible Landing observation',()=>{
  it('waits for read-only preferences and deduplicates StrictMode and language rerenders',()=>{
    const track=vi.fn(),observer=createLandingEntryObserver(track)
    observer.observe({visible:true,previewReady:false,preferences:{},browserLanguages:['en']})
    const shown={language:'en',hasInitializedLanguage:true,themePosition:1}
    const event={visible:true,previewReady:true,preferences:shown,browserLanguages:['zh']}
    observer.observe(event);observer.observe(event);observer.observe({...event,preferences:{language:'zh'}})
    expect(track).toHaveBeenCalledExactlyOnceWith(shown,['zh'])
    observer.observe({...event,visible:false});observer.observe(event)
    expect(track).toHaveBeenCalledTimes(2)
  })
})
