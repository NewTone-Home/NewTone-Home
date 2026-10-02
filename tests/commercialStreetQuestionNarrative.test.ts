import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialStreetQuestionNarrativeAnchor, commercialStreetQuestionNarrativeCompleted, commercialStreetQuestionNarrativeLines, commercialStreetQuestionNarrativeShouldTrigger, nextCommercialStreetQuestionNarrative } from '../src/center/runtime/commercialStreetQuestionNarrative'

describe('Commercial Street question-mark narration', () => {
  const street = mainlineScenes['commercial-street']

  it('anchors at the actual centre of the navigable street lane without adding geometry', () => {
    const anchor = commercialStreetQuestionNarrativeAnchor(street)
    expect(anchor).toEqual({
      x: street.walkBounds.x + street.walkBounds.width / 2,
      y: street.walkBounds.y + street.walkBounds.height / 2,
    })
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, anchor)).toBe(true)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, { x: anchor.x + street.walkBounds.height / 16, y: anchor.y })).toBe(false)
    expect(street.passages).not.toContainEqual(expect.objectContaining({ entityId: 'commercial-street-question-mark' }))
  })

  it('keeps the approved lines intact and advances to an exit only after the final line', () => {
    expect(commercialStreetQuestionNarrativeLines).toEqual([
      '难道刚刚是幻觉吗？',
      '不，不会认错的。',
      '那张脸修杰太过于熟悉。',
    ])
    const second = nextCommercialStreetQuestionNarrative({ phase: 'active', segmentIndex: 0 })
    const third = nextCommercialStreetQuestionNarrative(second)
    expect(second).toEqual({ phase: 'active', segmentIndex: 1 })
    expect(third).toEqual({ phase: 'active', segmentIndex: 2 })
    expect(nextCommercialStreetQuestionNarrative(third)).toEqual({ phase: 'leaving', segmentIndex: 2 })
  })

  it('recognizes only the completed persisted value, so interrupted narration restarts from the first line', () => {
    expect(commercialStreetQuestionNarrativeCompleted(true)).toBe(true)
    expect(commercialStreetQuestionNarrativeCompleted(false)).toBe(false)
    expect(commercialStreetQuestionNarrativeCompleted(undefined)).toBe(false)
  })
})
