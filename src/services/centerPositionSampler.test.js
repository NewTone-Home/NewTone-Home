import { describe, expect, it } from 'vitest'
import { CENTER_POSITION_SAMPLE_DISTANCE, createCenterPositionSampler } from './centerPositionSampler.js'
import { mainlineScenes } from '../center/runtime/mainlineScenes'

describe('Center position sampler', () => {
  it('requires both one second and 1.5 world units for movement samples', () => {
    let now = 0
    const samples = []
    const origin = mainlineScenes['jijia-ancestral-home'].initialPlayerPosition
    const sampler = createCenterPositionSampler({ now: () => now, onSample: sample => samples.push(sample) })
    expect(sampler.sample('office', origin)).toBe(true)
    now = 999
    expect(sampler.sample('office', { x: origin.x + CENTER_POSITION_SAMPLE_DISTANCE + 1, y: origin.y })).toBe(false)
    now = 1000
    expect(sampler.sample('office', { x: origin.x + CENTER_POSITION_SAMPLE_DISTANCE / 2, y: origin.y })).toBe(false)
    expect(sampler.sample('office', { x: origin.x + CENTER_POSITION_SAMPLE_DISTANCE, y: origin.y })).toBe(true)
    expect(samples).toHaveLength(2)
  })

  it('does not spam while stationary and emits one scene-boundary sample', () => {
    let now = 0
    const samples = []
    const origin = mainlineScenes['jijia-ancestral-home'].initialPlayerPosition
    const sampler = createCenterPositionSampler({ now: () => now, onSample: sample => samples.push(sample) })
    sampler.sample('yard', origin)
    now = 8000
    expect(sampler.sample('yard', origin)).toBe(false)
    expect(sampler.sample('office', origin, { boundary: true })).toBe(true)
    expect(sampler.sample('office', origin, { boundary: true })).toBe(false)
    expect(samples.map(sample => sample.sceneId)).toEqual(['yard', 'office'])
  })

  it('emits a single seated anchor transition and stores world coordinates only', () => {
    let now = 0
    const samples = []
    const anchor = mainlineScenes['commercial-cafe'].initialPlayerPosition
    const sampler = createCenterPositionSampler({ now: () => now, onSample: sample => samples.push(sample) })
    sampler.sample('cafe', anchor)
    now = 1500
    const seatedAnchor = { x: anchor.x, y: anchor.y + CENTER_POSITION_SAMPLE_DISTANCE }
    expect(sampler.sample('cafe', seatedAnchor, { boundary: true })).toBe(true)
    expect(sampler.sample('cafe', seatedAnchor, { boundary: true })).toBe(false)
    expect(samples.at(-1)).toEqual({ sceneId: 'cafe', positionX: seatedAnchor.x, positionY: seatedAnchor.y })
    expect(samples.at(-1)).not.toHaveProperty('screenX')
  })
})
