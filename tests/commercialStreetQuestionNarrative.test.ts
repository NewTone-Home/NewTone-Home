import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialStreetQuestionDialoguePosition, commercialStreetQuestionNarrativeAnchor, commercialStreetQuestionNarrativeCompleted, commercialStreetQuestionNarrativeLines, commercialStreetQuestionNarrativeShouldTrigger, commercialStreetQuestionTriggerHalfHeight, commercialStreetQuestionTriggerHalfWidth, nextCommercialStreetQuestionNarrative } from '../src/center/runtime/commercialStreetQuestionNarrative'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'
import { mainlineEchoLayout, mainlineSpeakerAnchor } from '../src/center/runtime/mainlineEchoLayout'
import { mainlineAvailableReadingWidthPx, mainlineMaximumReadingWidthPx, mainlineReadingBounds, mainlineReadingEnvelopeNeedsCameraPan } from '../src/center/runtime/mainlineTextReading'
import { commercialStreetCameraPages, commercialStreetPageIndex } from '../src/center/runtime/commercialStreetCamera'

describe('Commercial Street question-mark narration', () => {
  const street = mainlineScenes['commercial-street']

  it('anchors at the actual centre of the navigable street lane without adding geometry', () => {
    const anchor = commercialStreetQuestionNarrativeAnchor(street)
    expect(anchor).toEqual({
      x: street.walkBounds.x + street.walkBounds.width / 2,
      y: street.walkBounds.y + street.walkBounds.height / 2,
    })
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, anchor)).toBe(true)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, anchor, anchor)).toBe(true)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, { x: anchor.x + commercialStreetQuestionTriggerHalfWidth + 0.01, y: anchor.y })).toBe(false)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x, y: anchor.y + commercialStreetQuestionTriggerHalfHeight + 0.01 },
      { x: anchor.x + 80, y: anchor.y + commercialStreetQuestionTriggerHalfHeight + 0.01 })).toBe(false)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + 0.59, y: anchor.y + 0.74 },
      { x: anchor.x + 0.59, y: anchor.y + 0.74 })).toBe(true)
    expect(street.passages).not.toContainEqual(expect.objectContaining({ entityId: 'commercial-street-question-mark' }))
  })

  it('triggers for approach segments from every side of the visible marker footprint', () => {
    const anchor = commercialStreetQuestionNarrativeAnchor(street)
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      expect(commercialStreetQuestionNarrativeShouldTrigger(street,
        { x: anchor.x + dx * 40, y: anchor.y + dy * 40 },
        { x: anchor.x - dx * 40, y: anchor.y - dy * 40 })).toBe(true)
    }
    // Passing outside the displayed footprint does not trigger merely because a route crossed its center line.
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + 40, y: anchor.y + commercialStreetQuestionTriggerHalfHeight + 1 },
      { x: anchor.x - 40, y: anchor.y + commercialStreetQuestionTriggerHalfHeight + 1 })).toBe(false)
    // A loaded/stationary protagonist already overlapping the glyph triggers once the page evaluates its position.
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + 0.59, y: anchor.y + 0.74 })).toBe(true)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + 0.59, y: anchor.y + 0.74 }, { x: anchor.x + 0.59, y: anchor.y + 0.74 })).toBe(true)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street,
      { x: anchor.x + 1, y: anchor.y }, { x: anchor.x - 1, y: anchor.y })).toBe(true)
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
    expect(Math.abs(triggeredAt!.x - anchor.x)).toBeLessThanOrEqual(commercialStreetQuestionTriggerHalfWidth)
    expect(Math.abs(triggeredAt!.y - anchor.y)).toBeLessThanOrEqual(commercialStreetQuestionTriggerHalfHeight)
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

  it.each([
    ['desktop', 1920, 1080, 1],
    ['phone', 390, 844, .65],
  ] as const)('keeps the question dialogue in the current %s camera page when it fits', (_name, width, height, scale) => {
    const metrics = { width, height, viewportWidth: width, projectionScale: scale }
    const protagonist = { x: 85.284, y: 50.2591 }
    const pages = commercialStreetCameraPages(street, metrics)
    const page = commercialStreetPageIndex(pages.centers, protagonist.x, pages.span)
    const currentCameraOffset = { x: 50 - pages.centers[page]!, y: pages.yOffset }
    const position = commercialStreetQuestionDialoguePosition(
      street,
      protagonist,
      commercialStreetQuestionNarrativeLines.join('\n'),
      metrics,
      scale,
      currentCameraOffset,
    )
    const maximumWidth = mainlineMaximumReadingWidthPx(street, position, metrics, scale)
    const currentWidth = mainlineAvailableReadingWidthPx(street, position, metrics, scale, currentCameraOffset)
    const lineLayout = mainlineEchoLayout(commercialStreetQuestionNarrativeLines[0], metrics, { speaker: '修杰', maxWidthPx: maximumWidth })
    const speakerEnvelope = mainlineSpeakerAnchor(
      commercialStreetQuestionNarrativeLines.map(text => ({ text, speaker: '修杰' })),
      metrics,
      position,
      { x: 0, y: 0 },
      scale,
      maximumWidth,
    )
    const needsPanForEnvelope = mainlineReadingEnvelopeNeedsCameraPan(
      speakerEnvelope.left,
      speakerEnvelope.widthPx,
      metrics,
      scale,
      currentCameraOffset,
    )
    const needsPanForWidth = lineLayout.widthPx > currentWidth + 1
    const currentReadingBounds = mainlineReadingBounds(street, position, metrics, scale, currentCameraOffset)
    expect(position.x).toBeGreaterThanOrEqual(currentReadingBounds.x)
    expect(position.x).toBeLessThanOrEqual(currentReadingBounds.x + currentReadingBounds.width)
    expect(needsPanForWidth).toBe(false)
    expect(needsPanForEnvelope).toBe(false)
  })

  it('recognizes only the completed persisted value, so interrupted narration restarts from the first line', () => {
    expect(commercialStreetQuestionNarrativeCompleted(true)).toBe(true)
    expect(commercialStreetQuestionNarrativeCompleted(false)).toBe(false)
    expect(commercialStreetQuestionNarrativeCompleted(undefined)).toBe(false)
    const anchor = commercialStreetQuestionNarrativeAnchor(street)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, anchor, undefined, true)).toBe(false)
  })
})
