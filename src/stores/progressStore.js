import { create } from 'zustand'
import { readerContent } from '../data/readerContent'
import { getNextReaderLanguage, READER_LANGUAGE_CODES } from '../i18n/languages'
import { comparePosition, resolvePosition } from '../reader/readerPosition'
import { clampThemePosition, legacyThemeName, migrateThemePosition } from '../reader/readerTheme'
import { useNarrativeProgressStore } from './narrativeProgressStore'
import { clearProgressStorage, createInitialProgressState, loadProgressState, saveProgressState } from './progressMigration'

const storage = typeof localStorage === 'undefined' ? null : localStorage
const initial = createInitialProgressState()
const persisted = loadProgressState(storage)
function storedLocation(value) { const item = resolvePosition(value); return { phaseId: item.phaseId, pageId: item.pageId, beatIndex: item.beatIndex } }
function chapterAt(value) { return readerContent.find(phase => phase.id === value.phaseId)?.pages.find(page => page.id === value.pageId)?.chapterId ?? readerContent[0]?.pages?.[0]?.chapterId ?? null }

export const useProgressStore = create((set, get) => ({
  ...initial, ...persisted, isFirstReaderSession: false,
  startReading: () => set(state => ({ currentView: 'reader', readerStarted: true, resumeRequested: false, isFirstReaderSession: state.readerStarted !== true })),
  continueReading: () => set({ currentView: 'reader', readerStarted: true, resumeRequested: true, isFirstReaderSession: false }),
  clearResumeRequest: () => set({ resumeRequested: false }),
  commitLocation: value => { let committedLocation; try { committedLocation = storedLocation(value) } catch { return false }; const state = get(); const furthestLocation = comparePosition(committedLocation, state.furthestLocation) > 0 ? { ...committedLocation } : state.furthestLocation; set({ committedLocation, furthestLocation, readerStarted: true, currentChapter: chapterAt(committedLocation), currentPage: committedLocation.pageId, currentBeat: committedLocation.beatIndex, readerScrollOffset: 0 }); return true },
  setReaderScrollOffset: value => set({ readerScrollOffset: Number.isFinite(value) ? Math.max(0, value) : 0 }),
  setReaderExitGestureLearned: () => set({ readerExitGestureLearned: true }),
  endChapterTrial: () => set({ chapterTrialEnded: true }),
  completeReader: () => { if (get().readerCompleted) return false; set({ readerCompleted: true }); return true },
  goLanding: () => set({ currentView: 'landing' }),
  setViewFromHistory: view => set(view === 'reader' ? { currentView: 'reader', readerStarted: true, resumeRequested: true } : { currentView: 'landing' }),
  setLanguage: language => { if (READER_LANGUAGE_CODES.includes(language)) set({ language }) },
  toggleLanguage: () => set({ language: getNextReaderLanguage(get().language).code }),
  setInitializedLanguage: () => set({ hasInitializedLanguage: true }),
  selectReadingMode: readingMode => { if (!['immersive', 'standard'].includes(readingMode)) return false; const themePosition = migrateThemePosition(get().themePosition, get().standardTheme); set({ readingMode, hasInitializedReadingMode: true, themePosition, standardTheme: legacyThemeName(themePosition) }); return true },
  toggleReadingMode: () => set({ readingMode: get().readingMode === 'immersive' ? 'standard' : 'immersive' }),
  setStandardTheme: standardTheme => { if (!['soft', 'light', 'dark'].includes(standardTheme)) return false; const themePosition = migrateThemePosition(standardTheme); set({ themePosition, standardTheme }); return true },
  setThemePosition: value => { const themePosition = clampThemePosition(value); set({ themePosition, standardTheme: legacyThemeName(themePosition) }); return true },
  toggleMotionMode: () => set({ motionMode: get().motionMode === 'full' ? 'reduced' : 'full' }),
  reset: () => { clearProgressStorage(storage); useNarrativeProgressStore.getState().reset(); set({ ...createInitialProgressState(), isFirstReaderSession: false }) },
}))
useProgressStore.subscribe((state, previous) => { if (state !== previous) saveProgressState(storage, state) })
useNarrativeProgressStore.getState().initialize({ furthestLocation: useProgressStore.getState().furthestLocation })
