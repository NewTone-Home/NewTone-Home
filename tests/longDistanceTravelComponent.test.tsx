import { createElement, type AnimationEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  completeLongDistanceTravelOnVehicleAnimationEnd,
  LongDistanceTravel,
} from '../src/center/runtime/LongDistanceTravel'
import {
  longDistanceTravelStatusBeats,
  longDistanceTravelStatusPulseDurationMs,
  longDistanceTravelVehicleDurationMs,
} from '../src/center/runtime/longDistanceTravelContract'
import { mainlineMapLandmarksByWorld } from '../src/center/runtime/mainlineScenes'

describe('LongDistanceTravel core component', () => {
  it('renders the two phrase beats from the production travel contract', () => {
    const html = renderToStaticMarkup(createElement(LongDistanceTravel, { onTravelComplete: () => {} }))

    expect(longDistanceTravelVehicleDurationMs).toBe(1600)
    expect(longDistanceTravelStatusPulseDurationMs).toBe(360)
    expect(longDistanceTravelStatusBeats()).toEqual([
      { phrase: '行驶中.', delayMs: 200, visibleDurationMs: 650 },
      { phrase: '行驶中..', delayMs: 850, visibleDurationMs: 750 },
    ])
    expect(html).toContain('center-long-distance-travel__vehicle')
    expect(html).toContain('行驶中.')
    expect(html).toContain('行驶中..')
    expect(html).toContain('--long-distance-travel-duration:1600ms')
    expect(html).toContain('--long-distance-status-pulse-duration:360ms')
  })

  it('completes only when the continuous vehicle animation itself ends', () => {
    const onTravelComplete = vi.fn()

    expect(completeLongDistanceTravelOnVehicleAnimationEnd({
      target: {} as HTMLSpanElement,
      currentTarget: {} as HTMLSpanElement,
      animationName: 'unrelated-animation',
    } as AnimationEvent<HTMLSpanElement>, onTravelComplete)).toBe(false)
    expect(completeLongDistanceTravelOnVehicleAnimationEnd({
      target: {} as HTMLSpanElement,
      currentTarget: {} as HTMLSpanElement,
      animationName: 'center-long-distance-vehicle-drive',
    } as AnimationEvent<HTMLSpanElement>, onTravelComplete)).toBe(false)
    expect(onTravelComplete).not.toHaveBeenCalled()

    const vehicle = {} as HTMLSpanElement
    expect(completeLongDistanceTravelOnVehicleAnimationEnd({
      target: vehicle,
      currentTarget: vehicle,
      animationName: 'center-long-distance-vehicle-drive',
    } as AnimationEvent<HTMLSpanElement>, onTravelComplete)).toBe(true)
    expect(onTravelComplete).toHaveBeenCalledTimes(1)
  })

  it('keeps the Ancestral Home on the surface map and Office/Street rides bidirectional in the inner world', async () => {
    const { mainlineLongDistanceTravelIntentForRide } = await import('../src/center/runtime/longDistanceTravelContract')
    expect(mainlineMapLandmarksByWorld.inner.some(({ sceneId }) => sceneId === 'jijia-ancestral-home')).toBe(false)
    expect(mainlineMapLandmarksByWorld.surface.find(({ sceneId }) => sceneId === 'jijia-ancestral-home'))
      .toMatchObject({ id: 'jijia', label: '姬家祖宅' })
    expect(mainlineLongDistanceTravelIntentForRide('zhongshuyuan-office', 'commercial-street'))
      .toMatchObject({ sourceSceneId: 'zhongshuyuan-office', targetSceneId: 'commercial-street' })
    expect(mainlineLongDistanceTravelIntentForRide('commercial-street', 'zhongshuyuan-office'))
      .toMatchObject({ sourceSceneId: 'commercial-street', targetSceneId: 'zhongshuyuan-office' })
    expect(mainlineLongDistanceTravelIntentForRide('commercial-street', 'jijia-ancestral-home')).toBeNull()
  })
})
