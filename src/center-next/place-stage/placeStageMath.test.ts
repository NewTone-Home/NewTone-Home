import { describe, expect, it } from 'vitest'
import {
  DEEP_PRESET,
  DEPTH_LIMIT,
  FOREGROUND_PRESET,
  NEIGHBOR_PRESET,
  clampPlacePosition,
  depthOfOffset,
  derivePosition,
  describeWeights,
  hiddenSlotVisual,
  isSettledAt,
  nearestPlaceIndex,
  poseAtDepth,
  resolveComposition,
  resolveMountWindow,
  resolvePlaceSlots,
  slotAtDepth,
  weakSnapTarget,
} from './placeStageMath'
import type { PlaceSlotVisual } from './placeStageTypes'

const COUNT = 3

const realPlaces = (slots: PlaceSlotVisual[]) => slots.filter(s => s.placeIndex !== null)
const visible = (slots: PlaceSlotVisual[]) => slots.filter(s => s.visible > 0)
const byIndex = (slots: PlaceSlotVisual[], index: number | null) =>
  slots.find(s => s.placeIndex === index)

describe('clampPlacePosition', () => {
  it('把 NaN 落回第一个地点，把 ±Infinity 按方向夹住', () => {
    expect(clampPlacePosition(Number.NaN, COUNT)).toBe(0)
    expect(clampPlacePosition(Number.POSITIVE_INFINITY, COUNT)).toBe(2)
    expect(clampPlacePosition(Number.NEGATIVE_INFINITY, COUNT)).toBe(0)
  })
})

describe('resolveComposition / derivePosition', () => {
  it('整数位重新锚定，推进量落在 [0, 1)', () => {
    expect(resolveComposition(0, COUNT)).toEqual({ fromIndex: 0, toIndex: 1, transitionProgress: 0 })
    expect(resolveComposition(1, COUNT)).toEqual({ fromIndex: 1, toIndex: 2, transitionProgress: 0 })
  })

  it('末端的高位不是地点，而是未知边界', () => {
    expect(resolveComposition(2, COUNT)).toEqual({ fromIndex: 2, toIndex: null, transitionProgress: 0 })
  })

  it('position 是构图状态的派生量，往返一致', () => {
    for (const position of [0, 0.25, 0.5, 1, 1.75, 2]) {
      expect(derivePosition(resolveComposition(position, COUNT))).toBeCloseTo(position, 6)
    }
  })

  it('边界不可成为主体：toIndex 为 null 时推进恒不生效', () => {
    expect(derivePosition({ fromIndex: 2, toIndex: null, transitionProgress: 0.9 })).toBe(2)
  })
})

describe('深度轨', () => {
  it('后来者一格位置换一个深度；离场者同一格里走完两个深度', () => {
    expect(depthOfOffset(0)).toBe(0)
    expect(depthOfOffset(1)).toBe(1)
    expect(depthOfOffset(2)).toBe(2)
    // 离场：offset -0.5 正好落在邻居位上
    expect(depthOfOffset(-0.5)).toBe(1)
    expect(depthOfOffset(-1)).toBe(2)
  })

  it('三个构图预设分别锚在 t = 0 / 1 / 2 上', () => {
    expect(poseAtDepth(0).scale).toBe(FOREGROUND_PRESET.scale)
    expect(poseAtDepth(1).scale).toBe(NEIGHBOR_PRESET.scale)
    expect(poseAtDepth(2).scale).toBe(DEEP_PRESET.scale)
  })

  it('沿深度轨单调后退：越深越小、越淡、越褪色、越靠右', () => {
    let previous = poseAtDepth(0)
    for (let t = 0.1; t <= DEPTH_LIMIT; t += 0.1) {
      const pose = poseAtDepth(t)
      expect(pose.scale).toBeLessThan(previous.scale)
      expect(pose.opacity).toBeLessThanOrEqual(previous.opacity)
      expect(pose.translateXPct).toBeGreaterThan(previous.translateXPct)
      previous = pose
    }
  })

  it('景深不靠 blur 制造：三个预设的 blurPx 都是 0', () => {
    for (const t of [0, 1, 2]) expect(poseAtDepth(t).blurPx).toBe(0)
  })
})

describe('resolvePlaceSlots · 稳定状态', () => {
  it('稳定态恰好一个前景主体 + 一个侧后方邻居，不出现 20/60/20', () => {
    for (let index = 0; index < COUNT; index += 1) {
      const slots = visible(resolvePlaceSlots(index, COUNT))
      expect(slots).toHaveLength(2)
      expect(slots.filter(s => s.role === 'active')).toHaveLength(1)
      expect(slots.filter(s => s.role !== 'active')).toHaveLength(1)
    }
  })

  it('稳定态是 80/20 而不是 100/0：邻居停在邻居预设上', () => {
    const slots = resolvePlaceSlots(0, COUNT)
    const active = byIndex(slots, 0)!
    const neighbor = byIndex(slots, 1)!
    expect(active.depth).toBe(0)
    expect(active.scale).toBe(FOREGROUND_PRESET.scale)
    expect(neighbor.depth).toBe(1)
    expect(neighbor.scale).toBe(NEIGHBOR_PRESET.scale)
    expect(neighbor.opacity).toBe(NEIGHBOR_PRESET.opacity)
  })

  it('主体与邻居不在同一条平行线上，且靠六项同时区分', () => {
    const slots = resolvePlaceSlots(0, COUNT)
    const active = byIndex(slots, 0)!
    const neighbor = byIndex(slots, 1)!
    expect(neighbor.scale).toBeLessThan(active.scale)
    expect(neighbor.translateXPct).not.toBe(active.translateXPct)
    expect(neighbor.translateYPct).not.toBe(active.translateYPct)
    expect(neighbor.zIndex).toBeLessThan(active.zIndex)
    expect(neighbor.opacity).toBeLessThan(active.opacity)
    expect(neighbor.veil).toBeGreaterThan(active.veil)
  })

  it('稳定态没有任何真实地点停在深处', () => {
    for (let index = 0; index < COUNT; index += 1) {
      for (const slot of visible(resolvePlaceSlots(index, COUNT))) {
        expect(slot.depth).toBeLessThan(DEPTH_LIMIT)
      }
    }
  })
})

describe('resolvePlaceSlots · 空间推进', () => {
  it('原主体连续经历 foreground → neighbor → 深处，不瞬切、不掉包', () => {
    const track = [0, 0.25, 0.5, 0.75, 1].map(p => byIndex(resolvePlaceSlots(p, COUNT), 0))

    // 全程都在构图里，直到真正退到深处才消失
    expect(track[0]!.depth).toBe(0)
    expect(track[1]!.depth).toBeCloseTo(0.5, 6)
    // 深度连续经过中点，但平面路径不再复用右侧邻居预设
    expect(track[2]!.depth).toBeCloseTo(1, 6)
    expect(track[2]!.scale).toBeLessThan(FOREGROUND_PRESET.scale)
    expect(track[2]!.translateXPct).toBeLessThan(FOREGROUND_PRESET.translateXPct)
    expect(track[3]!.depth).toBeCloseTo(1.5, 6)
    // 终点退进深处，退出视觉
    expect(track[4]).toBeUndefined()
  })

  it('原主体缩小、淡化并向左滑出，不复用右侧邻居轨迹', () => {
    const track = [0, 0.25, 0.5, 0.75].map(p => byIndex(resolvePlaceSlots(p, COUNT), 0)!)

    for (let index = 1; index < track.length; index += 1) {
      expect(track[index].translateXPct).toBeLessThan(track[index - 1].translateXPct)
      expect(track[index].scale).toBeLessThan(track[index - 1].scale)
      expect(track[index].opacity).toBeLessThan(track[index - 1].opacity)
      expect(track[index].veil).toBeGreaterThan(track[index - 1].veil)
    }
  })

  it('新主体连续从 20% 推进到 80%，同时新邻居从深处浮出', () => {
    const b = [0, 0.5, 1].map(p => byIndex(resolvePlaceSlots(p, COUNT), 1)!)
    expect(b[0].depth).toBe(1)
    expect(b[1].depth).toBeCloseTo(0.5, 6)
    expect(b[2].depth).toBe(0)
    // B 放大、清晰度回升 —— 不是把 A crossfade 成 B
    expect(b[0].scale).toBeLessThan(b[2].scale)
    expect(b[0].veil).toBeGreaterThan(b[2].veil)

    const c = [0, 0.5, 1].map(p => byIndex(resolvePlaceSlots(p, COUNT), 2))
    expect(c[0]).toBeUndefined() // 还在深处之外
    expect(c[1]!.depth).toBeCloseTo(1.5, 6)
    expect(c[2]!.depth).toBe(1) // 接上 20% 位
  })

  it('推进途中不出现跳变：每个地点的深度都连续', () => {
    const previous = new Map<number, number>()
    for (let position = 0; position <= COUNT - 1; position += 0.02) {
      for (const slot of realPlaces(resolvePlaceSlots(position, COUNT))) {
        const last = previous.get(slot.placeIndex!)
        if (last !== undefined) expect(Math.abs(slot.depth - last)).toBeLessThan(0.1)
        previous.set(slot.placeIndex!, slot.depth)
      }
    }
  })

  it('z-index 在中途真正翻转，而不是靠透明度伪装', () => {
    expect(byIndex(resolvePlaceSlots(0.2, COUNT), 0)!.zIndex)
      .toBeGreaterThan(byIndex(resolvePlaceSlots(0.2, COUNT), 1)!.zIndex)
    expect(byIndex(resolvePlaceSlots(0.6, COUNT), 1)!.zIndex)
      .toBeGreaterThan(byIndex(resolvePlaceSlots(0.6, COUNT), 0)!.zIndex)
  })

  it('擦身而过时「谁在前」严格由深度决定，不靠 DOM 顺序碰运气', () => {
    for (let position = 0.05; position < 1; position += 0.05) {
      const slots = realPlaces(resolvePlaceSlots(position, COUNT))
        .sort((a, b) => a.depth - b.depth)
      for (let i = 1; i < slots.length; i += 1) {
        expect(slots[i].zIndex).toBeLessThanOrEqual(slots[i - 1].zIndex)
      }
    }
  })
})

describe('resolvePlaceSlots · 未知世界边界', () => {
  it('末端稳定在 20% 位：不占 index、无地点', () => {
    const slots = resolvePlaceSlots(COUNT - 1, COUNT)
    const boundary = byIndex(slots, null)!
    expect(boundary.role).toBe('boundary')
    expect(boundary.depth).toBe(1)
    expect(realPlaces(visible(slots))).toHaveLength(1)
  })

  it('边界走的是同一条深度轨，没有任何特判', () => {
    expect(byIndex(resolvePlaceSlots(1, COUNT), null)).toBeUndefined()
    expect(byIndex(resolvePlaceSlots(1.5, COUNT), null)!.depth).toBeCloseTo(1.5, 6)
  })

  it('加入新地点后自然被真实地点替换', () => {
    const slots = resolvePlaceSlots(2, 4)
    expect(byIndex(slots, null)).toBeUndefined()
    expect(byIndex(slots, 3)!.role).toBe('neighbor')
  })
})

describe('slotAtDepth', () => {
  it('unfold 随深度单调收起，剪影与多层主体是同一套模型的两端', () => {
    expect(slotAtDepth(0, 0).unfold).toBe(FOREGROUND_PRESET.unfold)
    expect(slotAtDepth(0, 1).unfold).toBe(NEIGHBOR_PRESET.unfold)
    expect(slotAtDepth(0, 2).unfold).toBe(DEEP_PRESET.unfold)
  })

  it('剪影属于深处，不属于邻居位 —— 邻居仍然是一个真实地点', () => {
    // 退场序列是 foreground → neighbor → silhouette，剪影在邻居之后
    expect(slotAtDepth(0, 1).unfold).toBeGreaterThan(0.4)
    expect(slotAtDepth(0, 2).unfold).toBe(0)
  })
})

describe('resolveMountWindow / hiddenSlotVisual', () => {
  it('挂载窗口比可见槽位宽，让 DOM 在角色切换期间保持不变', () => {
    expect(resolveMountWindow(1, COUNT)).toEqual([0, 1, 2])
    expect(resolveMountWindow(0, COUNT)).toEqual([0, 1, 2])
  })

  it('窗口内但不在槽位里的地点保留 DOM、视觉完全退出', () => {
    expect(hiddenSlotVisual(0).visible).toBe(0)
  })
})

describe('weakSnapTarget', () => {
  it('靠近整数位才归位，中间态原样保留', () => {
    expect(weakSnapTarget(1.05, COUNT)).toBe(1)
    expect(weakSnapTarget(1.5, COUNT)).toBe(1.5)
    expect(weakSnapTarget(0.45, COUNT)).toBe(0.45)
  })
})

describe('nearestPlaceIndex / isSettledAt / describeWeights', () => {
  it('只有足够靠近主体位才算已结算', () => {
    expect(isSettledAt(nearestPlaceIndex(1.02, COUNT), 1.02)).toBe(true)
    expect(isSettledAt(nearestPlaceIndex(1.3, COUNT), 1.3)).toBe(false)
  })

  it('权重读数是视觉前后权重：稳定态是 80/20，不是 100/0', () => {
    expect(describeWeights(0, COUNT)).toEqual({ low: 80, high: 20 })
    expect(describeWeights(1, COUNT)).toEqual({ low: 80, high: 20 })
    expect(describeWeights(0.5, COUNT)).toEqual({ low: 50, high: 50 })
    expect(describeWeights(0.999, COUNT)).toEqual({ low: 20, high: 80 })
  })
})
