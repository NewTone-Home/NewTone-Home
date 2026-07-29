import { describe, expect, it } from 'vitest'
import {
  PLACE_DRAG_CLICK_THRESHOLD,
  PLACE_MAX_WHEEL_DELTA,
  discreteDragStep,
  dominantWheelDelta,
  dragPositionDelta,
  exceedsDragThreshold,
  intentDirection,
  normalizeDepthWheelDelta,
  stridePixels,
  wheelPositionDelta,
} from './placeStageInputModel'

describe('stridePixels', () => {
  it('非法宽度退化为 1，不产生 NaN 位置', () => {
    expect(stridePixels(0)).toBe(1)
    expect(stridePixels(Number.NaN)).toBe(1)
    expect(stridePixels(-500)).toBe(1)
  })
})

describe('dominantWheelDelta', () => {
  it('普通滚轮取 deltaY，横向触控板取占优的 deltaX', () => {
    expect(dominantWheelDelta(10, 40)).toBe(40)
    expect(dominantWheelDelta(0, -40)).toBe(-40)
    expect(dominantWheelDelta(40, 10)).toBe(40)
  })
})

describe('normalizeDepthWheelDelta', () => {
  it('异常巨量 delta 被夹住', () => {
    expect(normalizeDepthWheelDelta(0, 99999, 0, 1000)).toBe(PLACE_MAX_WHEEL_DELTA)
    expect(normalizeDepthWheelDelta(0, -99999, 0, 1000)).toBe(-PLACE_MAX_WHEEL_DELTA)
  })
})

describe('dragPositionDelta / wheelPositionDelta', () => {
  it('向左拖使索引增大，拖满一个 stride 恰好一个地点', () => {
    expect(dragPositionDelta(-620, 620)).toBe(1)
    expect(dragPositionDelta(620, 620)).toBe(-1)
  })

  it('滚轮正值深入下一 index，负值返回历史 index', () => {
    expect(wheelPositionDelta(620, 620)).toBe(1)
    expect(wheelPositionDelta(-620, 620)).toBe(-1)
  })

  it('非法输入不产生 NaN', () => {
    expect(dragPositionDelta(Number.NaN, 620)).toBe(0)
    expect(wheelPositionDelta(10, 0)).toBe(0)
  })
})

describe('exceedsDragThreshold', () => {
  it('超过阈值才屏蔽松手的 click', () => {
    expect(exceedsDragThreshold(PLACE_DRAG_CLICK_THRESHOLD)).toBe(false)
    expect(exceedsDragThreshold(PLACE_DRAG_CLICK_THRESHOLD + 1)).toBe(true)
  })
})

describe('discreteDragStep', () => {
  it('Reduced motion 下一次拖动最多换一个地点', () => {
    expect(discreteDragStep(-620, 620)).toBe(1)
    expect(discreteDragStep(-2000, 620)).toBe(1)
    expect(discreteDragStep(-10, 620)).toBe(0)
  })
})

describe('intentDirection', () => {
  it('只取方向，不取速度大小', () => {
    expect(intentDirection(-0.001)).toBe(-1)
    expect(intentDirection(4)).toBe(1)
  })
})
