import { describe, expect, it } from 'vitest'
import { defaultCenterDefinition } from '../content/defaultCenterDefinition'
import { resolveCenterWorld, validateCenterDefinitionPositions } from './worldResolver'

describe('Center world resolver', () => {
  it('uses furthest progress for irreversible facts and committed progress for context', () => {
    const world = resolveCenterWorld({
      definition: defaultCenterDefinition,
      furthestLocation: { phaseId: 'M1', pageId: 'commercial-street', beatIndex: 5 },
      committedLocation: { phaseId: 'M1', pageId: 'ancestral-home', beatIndex: 2 },
      visitedLandmarkIds: ['ancestral-home', 'unknown'],
    })

    expect(world.progressKey).toBe('signal')
    expect(world.unlockedLandmarkIds).toContain('commercial-signal')
    expect(world.contextualLandmarkIds).toEqual(['ancestral-home'])
    expect(world.visitedLandmarkIds).toEqual(['ancestral-home'])
  })

  it('resolves exact page and beat boundaries instead of progress ratios', () => {
    const before = resolveCenterWorld({
      definition: defaultCenterDefinition,
      furthestLocation: { phaseId: 'M1', pageId: 'commercial-street', beatIndex: 3 },
      committedLocation: { phaseId: 'M1', pageId: 'commercial-street', beatIndex: 3 },
    })
    const after = resolveCenterWorld({
      definition: defaultCenterDefinition,
      furthestLocation: { phaseId: 'M1', pageId: 'commercial-street', beatIndex: 4 },
      committedLocation: { phaseId: 'M1', pageId: 'commercial-street', beatIndex: 4 },
    })

    expect(before.progressKey).toBe('inner-world')
    expect(after.progressKey).toBe('signal')
  })

  it('validates every definition position against the active Reader content', () => {
    expect(validateCenterDefinitionPositions(defaultCenterDefinition)).toBe(defaultCenterDefinition)
    expect(() => validateCenterDefinitionPositions({
      ...defaultCenterDefinition,
      progressStates: [{
        ...defaultCenterDefinition.progressStates[0],
        startsAt: { phaseId: 'M1', pageId: 'missing-page', beatIndex: 0 },
      }],
    })).toThrow()
  })
})
