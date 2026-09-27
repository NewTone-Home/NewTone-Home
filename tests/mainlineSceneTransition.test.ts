import { describe, expect, it } from 'vitest'
import { isLocalSlidePrototypeIntent, localSlideDirectionForCrossing } from '../src/center/runtime/mainlineSceneTransition'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

describe('walking-passage local-slide prototype metadata', () => {
  it('marks only the ancestral main-door pair for the first local-slide prototype', () => {
    expect(mainlineScenes['jijia-ancestral-home'].passages.find((passage) => passage.id === 'jijia-main-door')?.transitionPresentation).toBe('local-slide')
    expect(mainlineScenes['jijia-ancestral-interior'].passages.find((passage) => passage.id === 'jijia-main-door')?.transitionPresentation).toBe('local-slide')
    expect(mainlineScenes['commercial-cafe'].passages.find((passage) => passage.id === 'street-cafe-entry')?.transitionPresentation).toBeUndefined()
  })


  it('moves the world opposite to the actor crossing direction', () => {
    const yardDoor = mainlineScenes['jijia-ancestral-home'].passages.find((passage) => passage.id === 'jijia-main-door')!
    const interiorDoor = mainlineScenes['jijia-ancestral-interior'].passages.find((passage) => passage.id === 'jijia-main-door')!
    expect(localSlideDirectionForCrossing(yardDoor.thresholds[0], yardDoor.crossingTargets[0])).toBe('left')
    expect(localSlideDirectionForCrossing(interiorDoor.thresholds[0], interiorDoor.crossingTargets[0])).toBe('right')
  })

  it('recognises explicit walking-passage local-slide metadata only', () => {
    const passage = mainlineScenes['jijia-ancestral-home'].passages.find((candidate) => candidate.id === 'jijia-main-door')!
    expect(isLocalSlidePrototypeIntent({
      kind: 'walking-passage',
      presentation: 'local-slide',
      passageId: 'jijia-main-door',
      sourceSceneId: 'jijia-ancestral-home',
      targetSceneId: 'jijia-ancestral-interior',
      sourceCrossingPosition: passage.crossingTargets[0],
      safeEntryPosition: passage.entryPosition!,
      slideDirection: 'left',
    })).toBe(true)
    expect(isLocalSlidePrototypeIntent(undefined)).toBe(false)
  })
})
