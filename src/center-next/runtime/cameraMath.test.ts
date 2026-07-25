import { describe, expect, it } from 'vitest'
import { clampCameraScroll, fitCameraSnapshot, projectWorldPoint } from './cameraMath'

describe('Center camera math', () => {
  it('fits the world without losing its center', () => {
    const camera = fitCameraSnapshot({ width: 600, height: 400 }, { width: 1200, height: 800 })
    expect(camera).toEqual({ scrollX: 0, scrollY: 0, zoom: 0.5 })
  })

  it('clamps camera scrolling to the visible world bounds', () => {
    expect(clampCameraScroll(900, -20, {
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      width: 600,
      height: 400,
    }, { width: 1200, height: 800 })).toEqual({ scrollX: 600, scrollY: 0 })
  })

  it('projects world anchors into React overlay coordinates', () => {
    expect(projectWorldPoint({ x: 250, y: 150 }, {
      scrollX: 100,
      scrollY: 50,
      zoom: 2,
    })).toEqual({ x: 300, y: 200 })
  })
})
