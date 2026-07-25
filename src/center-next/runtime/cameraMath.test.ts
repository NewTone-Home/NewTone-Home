import { describe, expect, it } from 'vitest'
import {
  cameraSnapshotsEqual,
  clampCameraScroll,
  fitCameraSnapshot,
  projectWorldPoint,
  shouldAdoptCamera,
  shouldCommitCamera,
} from './cameraMath'

describe('Center camera math', () => {
  it('fits the world without losing its center', () => {
    const camera = fitCameraSnapshot({ width: 600, height: 400 }, { width: 1200, height: 800 })
    expect(camera).toEqual({ scrollX: 0, scrollY: 0, zoom: 0.5 })
  })

  it('keeps the fitted zoom inside the same range as the persisted camera', () => {
    // 小世界会算出越界 zoom；若不 clamp，首次 commit 之后画面会跳变。
    expect(fitCameraSnapshot({ width: 1200, height: 800 }, { width: 100, height: 80 }).zoom).toBe(3.5)
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

  it('compares camera snapshots by value, never by identity', () => {
    const a = { scrollX: 120, scrollY: 80, zoom: 1.4 }
    expect(cameraSnapshotsEqual(a, { ...a })).toBe(true)
    expect(cameraSnapshotsEqual(a, { ...a, scrollX: 121 })).toBe(false)
    expect(cameraSnapshotsEqual(null, null)).toBe(true)
    expect(cameraSnapshotsEqual(a, null)).toBe(false)
  })
})

describe('Center camera adoption', () => {
  const current = { scrollX: 120, scrollY: 80, zoom: 1.4 }

  it('ignores a repushed camera that only changed object identity', () => {
    // 切换图层 / 展开 / 地标时 store 会重建 view 与 camera 对象，值没变就不该强写相机。
    expect(shouldAdoptCamera({ ...current }, {
      current,
      requested: { ...current },
      committed: null,
    })).toBe(false)
  })

  it('ignores the echo of the camera this runtime just committed', () => {
    const committed = { scrollX: 300, scrollY: 200, zoom: 2 }
    expect(shouldAdoptCamera({ ...committed }, {
      current: committed,
      requested: committed,
      committed,
    })).toBe(false)
  })

  it('ignores a repushed out-of-bounds camera that was already clamped once', () => {
    const requested = { scrollX: 9999, scrollY: 0, zoom: 1 }
    const clampedCurrent = { scrollX: 600, scrollY: 0, zoom: 1 }
    expect(shouldAdoptCamera({ ...requested }, {
      current: clampedCurrent,
      requested,
      committed: null,
    })).toBe(false)
  })

  it('adopts a camera that genuinely differs', () => {
    expect(shouldAdoptCamera({ scrollX: 400, scrollY: 80, zoom: 1.4 }, {
      current,
      requested: current,
      committed: current,
    })).toBe(true)
  })

  it('does not commit the same camera twice', () => {
    expect(shouldCommitCamera({ ...current }, current)).toBe(false)
    expect(shouldCommitCamera({ ...current, zoom: 1.9 }, current)).toBe(true)
    expect(shouldCommitCamera(current, null)).toBe(true)
  })
})
