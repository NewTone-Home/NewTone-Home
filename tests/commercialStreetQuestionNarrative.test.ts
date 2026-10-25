import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialStreetQuestionNarrativeAnchor, commercialStreetQuestionNarrativeCompleted, commercialStreetQuestionNarrativeLines, commercialStreetQuestionNarrativeShouldTrigger, nextCommercialStreetQuestionNarrative } from '../src/center/runtime/commercialStreetQuestionNarrative'
import { createFreeRoamController, freeRoamWaypointArrivalRadius } from '../src/center/runtime/useFreeRoamMovement'

describe('Commercial Street question-mark narration', () => {
  const street = mainlineScenes['commercial-street']

  it('anchors at the actual centre of the navigable street lane without adding geometry', () => {
    const anchor = commercialStreetQuestionNarrativeAnchor(street)
    expect(anchor).toEqual({
      x: street.walkBounds.x + street.walkBounds.width / 2,
      y: street.walkBounds.y + street.walkBounds.height / 2,
    })
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, anchor)).toBe(false)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, anchor, anchor)).toBe(false)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, { x: anchor.x + freeRoamWaypointArrivalRadius * 2, y: anchor.y })).toBe(false)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + freeRoamWaypointArrivalRadius * 2, y: anchor.y },
      { x: anchor.x + freeRoamWaypointArrivalRadius * 3, y: anchor.y })).toBe(false)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + freeRoamWaypointArrivalRadius, y: anchor.y },
      { x: anchor.x + freeRoamWaypointArrivalRadius * 2, y: anchor.y })).toBe(true)
    // A position reset inside the tolerance does not consume the event; walking afterwards does.
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + freeRoamWaypointArrivalRadius / 2, y: anchor.y },
      { x: anchor.x + freeRoamWaypointArrivalRadius, y: anchor.y })).toBe(true)
    expect(street.passages).not.toContainEqual(expect.objectContaining({ entityId: 'commercial-street-question-mark' }))
  })

  it('triggers when an actual movement segment crosses the mark, including a step that passes over it', () => {
    const anchor = commercialStreetQuestionNarrativeAnchor(street)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + 1, y: anchor.y }, { x: anchor.x - 1, y: anchor.y })).toBe(true)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x, y: anchor.y + 1 }, { x: anchor.x, y: anchor.y - 1 })).toBe(true)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + 1, y: anchor.y + 1 }, { x: anchor.x - 1, y: anchor.y - 1 })).toBe(true)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + 1, y: anchor.y + 1 }, { x: anchor.x - 1, y: anchor.y + 1 })).toBe(false)
    expect(commercialStreetQuestionNarrativeShouldTrigger(mainlineScenes['yonghe-eatery'], anchor,
      { x: anchor.x - 1, y: anchor.y })).toBe(false)
  })

  it('stops at the real movement position when crossing the mark and never restores the prior position on exit', () => {
    const anchor = commercialStreetQuestionNarrativeAnchor(street)
    const start = { x: anchor.x - .35, y: anchor.y }
    const destination = { x: anchor.x + 5, y: anchor.y }
    const movement = createFreeRoamController(start)
    let previous = start
    let triggeredAt: { x: number; y: number } | null = null
    movement.moveAlong([start, destination], undefined, {
      maxSpeed: .018,
      canOccupy: () => true,
      onMove: position => {
        if (commercialStreetQuestionNarrativeShouldTrigger(street, position, previous)) {
          triggeredAt = position
          movement.stopMovement()
        }
        previous = position
      },
    })
    movement.tick(performance.now() + 30)
    expect(triggeredAt).not.toBeNull()
    expect(Math.hypot(triggeredAt!.x - anchor.x, triggeredAt!.y - anchor.y)).toBeLessThanOrEqual(freeRoamWaypointArrivalRadius)
    expect(triggeredAt).not.toEqual(anchor)
    expect(movement.getCurrentPosition()).toEqual(triggeredAt)
    expect(movement.isMoving()).toBe(false)

    let narrative = { phase: 'active' as const, segmentIndex: 0 }
    narrative = nextCommercialStreetQuestionNarrative(narrative)
    narrative = nextCommercialStreetQuestionNarrative(narrative)
    narrative = nextCommercialStreetQuestionNarrative(narrative)
    expect(narrative.phase).toBe('leaving')
    expect(movement.getCurrentPosition()).toEqual(triggeredAt)
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
    const anchor = commercialStreetQuestionNarrativeAnchor(street)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, anchor,
      { x: anchor.x + freeRoamWaypointArrivalRadius * 2, y: anchor.y }, true)).toBe(false)
  })
})
