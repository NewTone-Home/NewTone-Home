import { createReaderIndex, getReaderSceneId, resolvePosition } from './readerPosition'
import { READER_STEP_ACTIONS } from './readerAdvance'

function positionKey(position) {
  return `${position.phaseId}/${position.pageId}/${position.beatIndex}`
}

function fallbackSceneId(phaseId, pageId, beat) {
  return `${phaseId}/${pageId}/${beat?.id ?? 'beat'}`
}

/**
 * Builds the Reader's runtime model from the persisted Chapter/Release
 * compatibility projection. Persistence stays Story -> Chapter -> Scene;
 * this model makes Scene the only presentation and navigation unit.
 */
export function createReaderSceneModel(content) {
  const readerIndex = createReaderIndex(content, { allowEmpty: true })
  const scenes = []
  const scenesById = new Map()
  const sceneIdByLocation = new Map()

  for (const phase of content) {
    for (const page of phase.pages) {
      const pageEntries = readerIndex.pageLookup[`${phase.id}/${page.id}`] ?? []
      page.beats.forEach((beat, beatIndex) => {
        const location = pageEntries[beatIndex]
        const id = getReaderSceneId(beat) ?? fallbackSceneId(phase.id, page.id, beat)
        let scene = scenesById.get(id)
        if (!scene) {
          scene = {
            id,
            phaseId: phase.id,
            pageId: page.id,
            chapterId: page.chapterId,
            page,
            beats: [],
            locations: [],
          }
          scenesById.set(id, scene)
          scenes.push(scene)
        }
        scene.beats.push(beat)
        scene.locations.push(location)
        sceneIdByLocation.set(positionKey(location), id)
      })
    }
  }

  const finalizedScenes = scenes.map((scene, index) => ({
    ...scene,
    index,
    firstLocation: scene.locations[0] ?? null,
    lastLocation: scene.locations[scene.locations.length - 1] ?? null,
    previous: null,
    next: null,
  }))

  const sceneLookup = new Map(finalizedScenes.map(scene => [scene.id, scene]))
  const sceneByLocation = new Map(
    [...sceneIdByLocation.entries()].map(([key, id]) => [key, sceneLookup.get(id)]),
  )
  finalizedScenes.forEach((scene, index) => {
    scene.previous = finalizedScenes[index - 1] ?? null
    scene.next = finalizedScenes[index + 1] ?? null
  })

  finalizedScenes.forEach(scene => {
    Object.freeze(scene.beats)
    Object.freeze(scene.locations)
    Object.freeze(scene)
  })

  return Object.freeze({
    content,
    readerIndex,
    scenes: Object.freeze(finalizedScenes),
    sceneById: sceneLookup,
    sceneByLocation,
  })
}

export function getReaderSceneFocus(model, location) {
  if (!model || !location) return null
  const resolved = resolvePosition(location, model.content)
  const scene = model.sceneByLocation.get(positionKey(resolved))
  if (!scene) return null
  const localBeatIndex = scene.locations.findIndex(candidate => positionKey(candidate) === positionKey(resolved))
  if (localBeatIndex < 0) return null
  return Object.freeze({ scene, location: resolved, localBeatIndex })
}

export function getReaderSceneAtLocation(model, location) {
  return getReaderSceneFocus(model, location)?.scene ?? null
}

export function resolveReaderSceneStep({ sceneModel, location, steps, chapterTrialEnded = false }) {
  const direction = Math.sign(steps)
  if (direction === 0) return { type: READER_STEP_ACTIONS.NONE }

  const focus = getReaderSceneFocus(sceneModel, location)
  if (!focus) return { type: READER_STEP_ACTIONS.NONE }

  const { scene, localBeatIndex } = focus
  const boundaryIndex = direction > 0 ? scene.beats.length - 1 : 0
  const available = Math.abs(boundaryIndex - localBeatIndex)
  if (available > 0) {
    const distance = Math.min(Math.abs(steps), available)
    const nextLocalBeatIndex = localBeatIndex + direction * distance
    return {
      type: READER_STEP_ACTIONS.BEAT,
      location: scene.locations[nextLocalBeatIndex],
      reachedBoundary: nextLocalBeatIndex === boundaryIndex,
    }
  }

  if (direction > 0) {
    if (scene.next) {
      return {
        type: READER_STEP_ACTIONS.SCENE,
        location: scene.next.firstLocation,
        scene: scene.next,
        boundaryVisual: scene.beats[localBeatIndex]?.sceneState?.boundaryVisual ?? null,
      }
    }
    if (chapterTrialEnded) return { type: READER_STEP_ACTIONS.NONE }
    return { type: READER_STEP_ACTIONS.CHAPTER_END }
  }

  if (!scene.previous) return { type: READER_STEP_ACTIONS.NONE }
  return {
    type: READER_STEP_ACTIONS.SCENE,
    location: scene.previous.lastLocation,
    scene: scene.previous,
    boundaryVisual: null,
  }
}

export function isFinalReaderScene(scene) {
  return Boolean(scene && !scene.next)
}

export function isFinalReaderSceneBeat(localBeatIndex, scene) {
  return Boolean(scene && localBeatIndex === scene.beats.length - 1)
}
