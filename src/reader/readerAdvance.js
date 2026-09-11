import { READER_TRANSITION_TYPES } from '../data/readerContent'
import { previousPosition } from './readerPosition'

export const READER_STEP_ACTIONS = Object.freeze({
  NONE: 'none',
  BEAT: 'beat',
  SCENE: 'scene',
  PAGE: 'page',
  CHAPTER_END: 'chapter-end',
})

export function resolveReaderStep({ page, location, steps, chapterTrialEnded = false, content }) {
  const direction = Math.sign(steps)
  if (direction === 0) return { type: READER_STEP_ACTIONS.NONE }

  const isFinalBeat = page.transitionType === READER_TRANSITION_TYPES.CHAPTER_END
    && location.beatIndex === page.beats.length - 1
  if (chapterTrialEnded && direction > 0 && isFinalBeat) {
    return { type: READER_STEP_ACTIONS.NONE }
  }

  const boundaryIndex = direction > 0 ? page.beats.length - 1 : 0
  const available = Math.abs(boundaryIndex - location.beatIndex)
  if (available > 0) {
    const distance = Math.min(Math.abs(steps), available)
    const beatIndex = location.beatIndex + direction * distance
    return {
      type: READER_STEP_ACTIONS.BEAT,
      location: { ...location, beatIndex },
      reachedBoundary: beatIndex === boundaryIndex,
    }
  }

  if (direction > 0) {
    const forward = page.boundary
    if (forward.transitionType === READER_TRANSITION_TYPES.STANDARD) {
      return {
        type: READER_STEP_ACTIONS.PAGE,
        location: forward.target,
        boundaryVisual: page.beats[location.beatIndex]?.sceneState?.boundaryVisual ?? null,
      }
    }
    if (forward.transitionType === READER_TRANSITION_TYPES.CHAPTER_END) {
      return { type: READER_STEP_ACTIONS.CHAPTER_END }
    }
    return { type: READER_STEP_ACTIONS.NONE }
  }

  const previous = previousPosition(location, content)
  if (!previous) return { type: READER_STEP_ACTIONS.NONE }
  return { type: READER_STEP_ACTIONS.PAGE, location: previous, boundaryVisual: null }
}
