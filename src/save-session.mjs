export const JOURNAL = 'newtone-save-entry-authority-v2';
export const SESSION_LOCK = 'newtone-prototype-migration-v2';
export const PUBLICATION_KEY = 'newtone-reader-publication-v1';
let activeStorage=null;
export function getGameStorage(){if(activeStorage)return activeStorage;if(typeof window==='undefined')return null;throw Error('save-session-not-open');}
export function installGameStorage(storage){activeStorage=storage;}
export function assertGameSession(){const storage=getGameStorage();storage?.check?.();return storage;}
export function rethrowStoppedSession(storage=activeStorage){storage?.check?.();}
export function runSaveTransaction(storage,callback){return storage?.transaction?storage.transaction(callback):callback();}
export function runGameTransaction(callback){return runSaveTransaction(assertGameSession(),callback);}
export function afterSaveCommit(callback,key=callback){const storage=assertGameSession();return storage?.afterCommit?storage.afterCommit(key,callback):callback();}
export function commitStoreState(storage,key,get,set,update,persist){
  return runSaveTransaction(storage,()=>{
    storage?.check?.();
    const current=storage?.pendingState?.(key)??get();
    const change=typeof update==='function'?update(current):update;
    const next={...current,...change};
    persist(next);
    if(storage?.stageState)storage.stageState(key,next,()=>set(next));else set(next);
    return next;
  });
}
export function memoryStorage(values={}){
  const data=new Map(Object.entries(values));
  return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i]??null,get length(){return data.size;}};
}
export function createJournalStorage(raw,initial,sourceSnapshot,readSources,onStop=()=>{}){
  // This baseline MUST correspond to initial, never a newly re-read disk value.
  let expected=JSON.stringify(initial);
  let journal=structuredClone(initial);
  const sources=structuredClone(sourceSnapshot);
  let stopped=false,transaction=null,validateValues=()=>{};
  const stop=reason=>{if(!stopped){stopped=true;onStop(reason);}throw Error(reason);};
  const check=()=>{
    if(stopped)throw Error('save-session-stopped');
    try{
      if(JSON.stringify(readSources(raw))!==JSON.stringify(sources))return stop('legacy-or-bootstrap-slot-changed');
      if(raw.getItem(JOURNAL)!==expected)return stop('journal-changed-outside-session');
    }catch(error){if(stopped)throw error;return stop('storage-read-failed');}
  };
  const commit=values=>{
    check();
    try{validateValues(values);}catch(error){return stop('save-consistency-failed: '+error.message);}
    const next={...journal,revision:journal.revision+1,values};
    if(journal.recoveryHolds)next.recoveryHolds=journal.recoveryHolds.filter(hold=>hold.domain!=='cafe'||JSON.parse(values['newtone-player-save-v1']).sceneState['commercial-street']?.saveEntrySpatialHold===true);
    const serialized=JSON.stringify(next);
    try{raw.setItem(JOURNAL,serialized);}catch{return stop('storage-write-failed');}
    // One setItem is atomic. The lock coordinates cooperating NEW sessions;
    // old code can still race it, retaining a divergent source that we detect.
    try{if(raw.getItem(JOURNAL)!==serialized)return stop('journal-verification-failed');}
    catch(error){if(stopped)throw error;return stop('storage-read-failed');}
    journal=next;expected=serialized;
    check();
  };
  const transact=callback=>{
    check();
    if(transaction){
      const savepoint={values:{...transaction.values},states:new Map(transaction.states),publish:new Map(transaction.publish),changed:transaction.changed};
      try{const result=callback();if(result&&typeof result.then==='function')throw Error('save-transaction-must-be-synchronous');return result;}
      catch(error){Object.assign(transaction,savepoint);throw error;}
    }
    const pending={values:{...journal.values},states:new Map(),publish:new Map(),changed:false};
    transaction=pending;let result;
    try{
      result=callback();
      if(result&&typeof result.then==='function')throw Error('save-transaction-must-be-synchronous');
      if(pending.changed)commit(pending.values);
      transaction=null;
    }catch(error){transaction=null;throw error;}
    try{for(const callback of pending.publish.values()){check();callback();}}
    catch(error){if(stopped)throw error;return stop('state-publication-failed');}
    return result;
  };
  const write=(key,value)=>transact(()=>{
    if(!isWritableGameKey(key))return stop('unexpected-game-key:'+key);
    if(value===null){if(key==='newtone-player-save-v1'||key===PUBLICATION_KEY)return stop('save-reset-requires-explicit-recovery');delete transaction.values[key];}
    else transaction.values[key]=String(value);
    transaction.changed=true;
  });
  check(); // Reject the verified-write -> facade-construction interleaving.
  return {
    getItem(key){check();const values=transaction?.values??journal.values;return Object.hasOwn(values,key)?values[key]:null;},
    setItem:(key,value)=>write(key,String(value)),removeItem:key=>write(key,null),clear:()=>stop('save-reset-requires-explicit-recovery'),
    key(i){check();return Object.keys(transaction?.values??journal.values)[i]??null;},get length(){check();return Object.keys(transaction?.values??journal.values).length;},
    transaction:transact,
    afterCommit(key,callback){if(transaction)transaction.publish.set(key,callback);else{check();callback();}},
    pendingState(key){return transaction?.states.get(key);},
    stageState(key,state,publish){if(!transaction)throw Error('state-publication-outside-transaction');transaction.states.set(key,state);transaction.publish.set(key,publish);},
    setValidator(validate){check();try{validate(journal.values);}catch(error){return stop('save-consistency-failed: '+error.message);}validateValues=validate;},
    check,stop:(reason='save-session-closed')=>stop(reason),get revision(){return journal.revision;},
  };
}
export function isWritableGameKey(key){return key===PUBLICATION_KEY||key==='newtone-player-save-v1'||/^newtone-(progress-v[1-4]|narrative-progress-v[12]|reader-exit-tutorial-v1|landing-intro-v1)$/.test(key)||key==='newtone-choice-wheel-hint-seen'||key==='newtone-scene-motion-enabled'||key.startsWith('newtone:center:scene-layout:')||key.startsWith('newtone-layout-');}
export async function acquireSaveSession(locks,run,onFailure){if(!locks?.request)return onFailure('locking-unavailable');try{return await locks.request(SESSION_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>lock?await run():onFailure('another-tab-active'));}catch(error){return onFailure('locking-failed',String(error));}}
