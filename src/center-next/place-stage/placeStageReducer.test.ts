import { describe, expect, it } from 'vitest'
import {
  createPlaceStageState,
  isStageSettled,
  placeStageReducer,
  positionOf,
} from './placeStageReducer'
import type { PlaceStageAction } from './placeStageReducer'
import type { PlaceStageState } from './placeStageTypes'

const COUNT = 3

function run(state: PlaceStageState, ...actions: PlaceStageAction[]): PlaceStageState {
  return actions.reduce(placeStageReducer, state)
}

function drag(progress: number): PlaceStageAction {
  return {
    type: 'intent',
    intent: { type: 'continuous', source: 'pointer-drag', progress, direction: progress < 0 ? -1 : 1 },
    placeCount: COUNT,
    reduced: false,
  }
}

function commitTo(targetIndex: number, reduced = false): PlaceStageAction {
  return {
    type: 'intent',
    intent: { type: 'commit', source: 'index-jump', targetIndex },
    placeCount: COUNT,
    reduced,
  }
}

describe('createPlaceStageState', () => {
  it('初始构图就是稳定的 80/20', () => {
    const state = createPlaceStageState(0, COUNT)
    expect(state).toMatchObject({
      phase: 'idle',
      settledIndex: 0,
      fromIndex: 0,
      toIndex: 1,
      transitionProgress: 0,
      commit: null,
    })
  })
})

describe('连续输入', () => {
  it('1:1 直接控制推进量，可停在中间态', () => {
    const state = run(createPlaceStageState(0, COUNT), drag(0.4))
    expect(state.phase).toBe('continuous')
    expect(positionOf(state)).toBeCloseTo(0.4, 6)
    expect(isStageSettled(state, COUNT)).toBe(false)
  })

  it('可以回拉', () => {
    const state = run(createPlaceStageState(0, COUNT), drag(0.7), drag(-0.5))
    expect(positionOf(state)).toBeCloseTo(0.2, 6)
  })

  it('跨过整数位后重新锚定，高位永远是主体右后方那一个', () => {
    const state = run(createPlaceStageState(0, COUNT), drag(1.3))
    expect(state.fromIndex).toBe(1)
    expect(state.toIndex).toBe(2)
    expect(state.transitionProgress).toBeCloseTo(0.3, 6)
  })

  it('末端夹住：边界不能被拖成主体', () => {
    const state = run(createPlaceStageState(0, COUNT), drag(9))
    expect(positionOf(state)).toBe(2)
    expect(state.toIndex).toBeNull()
  })

  it('起点夹住：向左返回历史 index，不循环到链尾', () => {
    const state = run(createPlaceStageState(1, COUNT), drag(-1))
    expect(positionOf(state)).toBe(0)

    const clamped = run(state, drag(-9))
    expect(positionOf(clamped)).toBe(0)
    expect(clamped.fromIndex).toBe(0)
    expect(clamped.toIndex).toBe(1)
  })

  it('Reduced motion 下拖动期间不移动构图', () => {
    const state = placeStageReducer(createPlaceStageState(0, COUNT), {
      ...drag(0.6),
      reduced: true,
    } as PlaceStageAction)
    expect(positionOf(state)).toBe(0)
  })
})

describe('释放与弱吸附', () => {
  it('靠近整数位则归位并结算', () => {
    const state = run(
      createPlaceStageState(0, COUNT),
      drag(1.06),
      { type: 'release', placeCount: COUNT, reduced: false, discreteStep: 0 },
    )
    expect(positionOf(state)).toBe(1)
    expect(state.settledIndex).toBe(1)
    expect(isStageSettled(state, COUNT)).toBe(true)
  })

  it('吸附半径之外原样保留：50/50 可以长期停留，且不算已结算', () => {
    const state = run(
      createPlaceStageState(0, COUNT),
      drag(0.5),
      { type: 'release', placeCount: COUNT, reduced: false, discreteStep: 0 },
    )
    expect(positionOf(state)).toBeCloseTo(0.5, 6)
    expect(state.settledIndex).toBe(0)
    expect(isStageSettled(state, COUNT)).toBe(false)
  })

  it('Reduced motion 下释放时离散换一格', () => {
    const state = run(
      createPlaceStageState(0, COUNT),
      { type: 'release', placeCount: COUNT, reduced: true, discreteStep: 1 },
    )
    expect(positionOf(state)).toBe(1)
    expect(state.settledIndex).toBe(1)
  })
})

describe('离散切换', () => {
  it('补间途中 settledIndex 不提前更新 —— 50/50 不是「当前地点」', () => {
    let state = run(createPlaceStageState(0, COUNT), commitTo(1))
    expect(state.phase).toBe('committing')
    expect(state.settledIndex).toBe(0)

    state = placeStageReducer(state, { type: 'commit-tick', progress: 0.5, placeCount: COUNT })
    expect(positionOf(state)).toBeCloseTo(0.5, 6)
    expect(state.settledIndex).toBe(0)
    expect(isStageSettled(state, COUNT)).toBe(false)

    state = placeStageReducer(state, { type: 'commit-complete', placeCount: COUNT })
    expect(state.settledIndex).toBe(1)
    expect(state.phase).toBe('idle')
    expect(positionOf(state)).toBe(1)
  })

  it('补间期间忽略连续输入：不允许在中间停住', () => {
    const committing = run(createPlaceStageState(0, COUNT), commitTo(1), {
      type: 'commit-tick',
      progress: 0.5,
      placeCount: COUNT,
    })
    const dragged = placeStageReducer(committing, drag(0.3))
    expect(dragged).toBe(committing)

    const released = placeStageReducer(committing, {
      type: 'release',
      placeCount: COUNT,
      reduced: false,
      discreteStep: 1,
    })
    expect(released).toBe(committing)
  })

  it('从稳定 80/20 到稳定 80/20，终点是整数位', () => {
    const state = run(
      createPlaceStageState(0, COUNT),
      commitTo(2),
      { type: 'commit-tick', progress: 1, placeCount: COUNT },
      { type: 'commit-complete', placeCount: COUNT },
    )
    expect(positionOf(state)).toBe(2)
    expect(state.toIndex).toBeNull()
    expect(state.settledIndex).toBe(2)
  })

  it('Reduced motion 下瞬时到位，不产生补间', () => {
    const state = run(createPlaceStageState(0, COUNT), commitTo(1, true))
    expect(state.phase).toBe('idle')
    expect(state.commit).toBeNull()
    expect(state.settledIndex).toBe(1)
  })
})

describe('activate', () => {
  it('打开信息层不改变构图，也不改变结算索引', () => {
    const base = createPlaceStageState(1, COUNT)
    const state = placeStageReducer(base, {
      type: 'intent',
      intent: { type: 'activate', source: 'active-click', placeId: 'ji-manor' },
      placeCount: COUNT,
      reduced: false,
    })
    expect(state).toBe(base)
  })
})

describe('HUD 跳转', () => {
  it('直接落位，不吸附到任何调试档位', () => {
    const state = placeStageReducer(createPlaceStageState(0, COUNT), {
      type: 'set-position',
      position: 1.37,
      phase: 'idle',
      placeCount: COUNT,
    })
    expect(positionOf(state)).toBeCloseTo(1.37, 6)
    expect(state.settledIndex).toBe(0)
  })

  it('补间途中拒绝外部位置驱动', () => {
    const committing = run(createPlaceStageState(0, COUNT), commitTo(1))
    const jumped = placeStageReducer(committing, {
      type: 'set-position',
      position: 2,
      phase: 'idle',
      placeCount: COUNT,
    })
    expect(jumped).toBe(committing)
  })
})
