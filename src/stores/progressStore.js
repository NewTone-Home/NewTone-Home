import { getGameStorage, commitStoreState, runSaveTransaction } from '../save-session.mjs'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { readerContent } from '../data/readerContent'
import { getNextReaderLanguage, READER_LANGUAGE_CODES } from '../i18n/languages'
import { comparePosition, resolvePosition } from '../reader/readerPosition'
import { clampThemePosition, migrateThemePosition, legacyThemeName } from '../reader/readerTheme'
import { useNarrativeProgressStore, getSessionNarrativeStore } from './narrativeProgressStore'
import { createInitialProgressState, loadProgressState, saveProgressState, PROGRESS_STORAGE_KEYS } from './progressMigration'

function storedLocation(value){const item=resolvePosition(value);return {phaseId:item.phaseId,pageId:item.pageId,beatIndex:item.beatIndex}}
function chapterAt(value){return readerContent.find(phase=>phase.id===value.phaseId)?.pages.find(page=>page.id===value.pageId)?.chapterId??readerContent[0]?.pages?.[0]?.chapterId??null}
export function chooseFurthestLocation(committed,previous){return comparePosition(committed,previous)>0?{...committed}:previous}
function progressStateCreator(storage,narrative=useNarrativeProgressStore){
  return (publish,get)=>{
    const owner={};
    const current=()=>storage?.pendingState?.(owner)??get();
    const set=update=>commitStoreState(storage,owner,get,publish,update,next=>saveProgressState(storage,next));
    return {
      ...createInitialProgressState(),...loadProgressState(storage),isFirstReaderSession:false,
      startReading:()=>set(s=>({currentView:'reader',readerStarted:true,resumeRequested:false,isFirstReaderSession:s.readerStarted!==true})),
      continueReading:()=>set({currentView:'reader',readerStarted:true,resumeRequested:true,isFirstReaderSession:false}),
      clearResumeRequest:()=>set({resumeRequested:false}),
      commitLocation:value=>{
        let committed;try{committed=storedLocation(value)}catch{return false}
        set(s=>({committedLocation:committed,furthestLocation:chooseFurthestLocation(committed,s.furthestLocation),readerStarted:true,currentChapter:chapterAt(committed),currentPage:committed.pageId,currentBeat:committed.beatIndex,readerScrollOffset:0}));return true;
      },
      setReaderScrollOffset:value=>set({readerScrollOffset:Number.isFinite(value)?Math.max(0,value):0}),
      setReaderExitGestureLearned:()=>set({readerExitGestureLearned:true}),
      endChapterTrial:()=>set({chapterTrialEnded:true}),
      completeReader:()=>{if(current().readerCompleted)return false;set({readerCompleted:true});return true},
      goLanding:()=>set({currentView:'landing'}),
      setViewFromHistory:view=>set(view==='reader'?{currentView:'reader',readerStarted:true,resumeRequested:true}:{currentView:'landing'}),
      setLanguage:language=>{if(READER_LANGUAGE_CODES.includes(language))set({language})},
      toggleLanguage:()=>set({language:getNextReaderLanguage(current().language).code}),
      setInitializedLanguage:()=>set({hasInitializedLanguage:true}),
      selectReadingMode:mode=>{if(mode!=='standard')return false;const themePosition=migrateThemePosition(current().themePosition,current().standardTheme);set({readingMode:'standard',hasInitializedReadingMode:true,themePosition,standardTheme:legacyThemeName(themePosition)});return true},
      toggleReadingMode:()=>false,
      setStandardTheme:theme=>{if(!['soft','light','dark'].includes(theme))return false;set({themePosition:migrateThemePosition(theme),standardTheme:theme});return true},
      setThemePosition:value=>{const themePosition=clampThemePosition(value);set({themePosition,standardTheme:legacyThemeName(themePosition)})},
      toggleMotionMode:()=>set({motionMode:current().motionMode==='full'?'reduced':'full'}),
      reset:()=>runSaveTransaction(storage,()=>{
        for(const key of Object.values(PROGRESS_STORAGE_KEYS))if(key!==PROGRESS_STORAGE_KEYS.V4)storage?.removeItem(key);
        narrative.getState().reset();set({...createInitialProgressState(),isFirstReaderSession:false});
      }),
    };
  };
}
export function createProgressStore(storage,narrative){return createStore(progressStateCreator(storage,narrative))}
const boundStores=new WeakMap();
function currentStore(){const storage=getGameStorage();if(!storage)throw Error('save-session-not-open');let store=boundStores.get(storage);if(!store){store=createProgressStore(storage,getSessionNarrativeStore(storage));boundStores.set(storage,store);runSaveTransaction(storage,()=>getSessionNarrativeStore(storage).getState().initialize({furthestLocation:store.getState().furthestLocation}));}return store;}
export function useProgressStore(selector){return useStore(currentStore(),selector)}
useProgressStore.getState=()=>currentStore().getState();
useProgressStore.subscribe=(...args)=>currentStore().subscribe(...args);
