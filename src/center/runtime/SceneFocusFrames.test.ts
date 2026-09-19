import { describe, expect, it } from 'vitest'
import { sceneFocusFrameGeometry } from './SceneFocusFrames'

const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const

describe('sceneFocusFrameGeometry', () => {
  it('keeps a near-square interaction frame proportional', () => {
    const geometry = sceneFocusFrameGeometry(46, 28)

    expect(geometry.viewBox).toBe('0 0 46 28')
    expect(geometry.paths['top-left']).toBe('M1 1 H45 V27 H1 V1 Z')
  })

  it('uses the measured wide geometry for dialogue and echo frames', () => {
    const geometry = sceneFocusFrameGeometry(176.03125, 78.28125)

    expect(geometry.viewBox).toBe('0 0 176.031 78.281')
    expect(geometry.paths['bottom-right']).toBe('M172.511 76.716 H3.521 V1.566 H172.511 V76.716 Z')
  })

  it('updates viewBox and paths when the measured frame size changes', () => {
    const first = sceneFocusFrameGeometry(169, 67.40625)
    const second = sceneFocusFrameGeometry(232, 104)

    expect(first.viewBox).not.toBe(second.viewBox)
    expect(first.paths['top-left']).not.toBe(second.paths['top-left'])
  })

  it.each(corners)('keeps the %s path closed', (corner) => {
    const geometry = sceneFocusFrameGeometry(176.03125, 78.28125)

    expect(geometry.paths[corner]).toMatch(/ Z$/)
  })
})
