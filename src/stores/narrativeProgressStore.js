import { getGameStorage, commitStoreState, runSaveTransaction } from '../save-session.mjs'
import { useStore } from 'zustand'
import { useReaderStoreScope } from './readerStoreScope'
import { createStore } from 'zustand/vanilla'
import { beginNarrativeEvent, completeNarrativeEvent, completeSkippedNarrativeEvent, createInitialNarrativeProgressState, loadNarrativeProgressState, saveNarrativeProgressState } from './narrativeProgressStorage'
function narrativeProgressStateCreator(storage){
  return (publish,get)=>{
    const owner={};
    const current=()=>storage?.pendingState?.(owner)??get();
    const set=update=>commitStoreState(storage,owner,get,publish,update,next=>saveNarrativeProgressState(storage,next));
    return {
      ...createInitialNarrativeProgressState(),initialized:false,
      initialize:readerProgress=>runSaveTransaction(storage,()=>{const loaded=loadNarrativeProgressState(storage,readerProgress);set({...loaded,initialized:true});return loaded}),
      beginEvent:id=>{const next=beginNarrativeEvent(current(),id);set(next);return next},
      completeEvent:id=>{const next=completeNarrativeEvent(current(),id);set(next);return next},
      completeSkippedEvent:id=>{const next=completeSkippedNarrativeEvent(current(),id);set(next);return next},
      reset:()=>runSaveTransaction(storage,()=>{storage?.removeItem('newtone-narrative-progress-v1');set({...createInitialNarrativeProgressState(),initialized:true})}),
    };
  };
}
export function createNarrativeProgressStore(storage){return createStore(narrativeProgressStateCreator(storage))}
const boundStores=new WeakMap();
export function getSessionNarrativeStore(storage){let store=boundStores.get(storage);if(!store){store=createNarrativeProgressStore(storage);boundStores.set(storage,store);}return store;}
function currentStore(){const storage=getGameStorage();if(!storage)throw Error('save-session-not-open');return getSessionNarrativeStore(storage);}
export function useNarrativeProgressStoreApi(){const preview=useReaderStoreScope();return preview?.narrativeStore??currentStore()}
export function useNarrativeProgressStore(selector){return useStore(useNarrativeProgressStoreApi(),selector)}
useNarrativeProgressStore.getState=()=>currentStore().getState();
useNarrativeProgressStore.subscribe=(...args)=>currentStore().subscribe(...args);
