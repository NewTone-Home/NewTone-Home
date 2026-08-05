import { readerContent } from '../data/readerContent'
import { readerContentIndex } from './readerPosition'

function worldStateAt(entry) {
  const phase = readerContent.find(candidate => candidate.id === entry.phaseId)
  const page = phase?.pages.find(candidate => candidate.id === entry.pageId)
  return page?.beats[entry.beatIndex]?.worldState
}

export function createReaderSceneTrail() {
  const trail = []
  readerContentIndex.entries.forEach(entry => {
    const state = worldStateAt(entry)
    if (!state?.locationId) return
    const previous = trail[trail.length - 1]
    if (previous?.locationId === state.locationId) {
      previous.lastLinearIndex = entry.linearIndex
      return
    }
    trail.push({
      locationId: state.locationId,
      locationLabel: state.locationLabel,
      firstLinearIndex: entry.linearIndex,
      lastLinearIndex: entry.linearIndex,
    })
  })
  return trail.map(item => Object.freeze(item))
}

export const READER_SCENE_TRAIL = Object.freeze(createReaderSceneTrail())

export function getReaderSceneTrailState(linearIndex) {
  return READER_SCENE_TRAIL.map((item, index) => ({
    ...item,
    index,
    state: linearIndex > item.lastLinearIndex
      ? 'past'
      : linearIndex >= item.firstLinearIndex
        ? 'current'
        : 'future',
  }))
}
