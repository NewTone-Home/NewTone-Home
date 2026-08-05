import { describe, expect, it } from 'vitest'
import {
  INTRO_STORAGE_KEY,
  TITLE_PHASE,
  clearIntroCompleted,
  isTitleDrawing,
  readIntroCompleted,
  resolveScrollIntent,
  writeIntroCompleted,
} from './landingIntro'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    dump: () => Object.fromEntries(values),
  }
}

describe('首次教学状态', () => {
  it('默认未完成', () => {
    expect(readIntroCompleted(memoryStorage())).toBe(false)
  })

  it('写入后读回为已完成', () => {
    const storage = memoryStorage()
    writeIntroCompleted(storage)
    expect(storage.dump()[INTRO_STORAGE_KEY]).toBe('true')
    expect(readIntroCompleted(storage)).toBe(true)
  })

  it('清除后回到未完成', () => {
    const storage = memoryStorage({ [INTRO_STORAGE_KEY]: 'true' })
    clearIntroCompleted(storage)
    expect(readIntroCompleted(storage)).toBe(false)
  })

  it('存储不可用时按未完成处理', () => {
    const hostile = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readIntroCompleted(hostile)).toBe(false)
  })
})

describe('滚动意图', () => {
  it('教学未完成时滚轮完全无效', () => {
    for (const phase of Object.values(TITLE_PHASE)) {
      expect(resolveScrollIntent({ phase, introCompleted: false })).toBe('blocked')
    }
  })

  it('首次描线进行中滚轮不打断也不进入', () => {
    expect(
      resolveScrollIntent({ phase: TITLE_PHASE.DRAWING, introCompleted: false }),
    ).toBe('blocked')
  })

  it('教学完成后静止态直接进入', () => {
    expect(resolveScrollIntent({ phase: TITLE_PHASE.IDLE, introCompleted: true })).toBe('enter')
    expect(resolveScrollIntent({ phase: TITLE_PHASE.REVEALED, introCompleted: true })).toBe('enter')
  })

  it('回访重描途中滚轮先收回再进入', () => {
    expect(
      resolveScrollIntent({ phase: TITLE_PHASE.DRAWING, introCompleted: true }),
    ).toBe('retract')
  })

  it('收回已在进行时忽略后续滚轮', () => {
    expect(
      resolveScrollIntent({ phase: TITLE_PHASE.RETRACTING, introCompleted: true }),
    ).toBe('ignore')
  })
})

describe('isTitleDrawing', () => {
  it('只在正向描线阶段为真', () => {
    expect(isTitleDrawing(TITLE_PHASE.DRAWING)).toBe(true)
    expect(isTitleDrawing(TITLE_PHASE.RETRACTING)).toBe(false)
    expect(isTitleDrawing(TITLE_PHASE.REVEALED)).toBe(false)
    expect(isTitleDrawing(TITLE_PHASE.IDLE)).toBe(false)
  })
})

describe('状态职责分离', () => {
  it('视觉阶段里不存在任何"是否首次"的编码', () => {
    // Nothing in the phase list may name a visit; that lives in storage alone.
    expect(Object.values(TITLE_PHASE)).toEqual(['idle', 'drawing', 'revealed', 'retracting'])
  })

  it('同一视觉阶段在首次与回访下只有滚轮意图不同', () => {
    expect(resolveScrollIntent({ phase: TITLE_PHASE.DRAWING, introCompleted: false })).toBe('blocked')
    expect(resolveScrollIntent({ phase: TITLE_PHASE.DRAWING, introCompleted: true })).toBe('retract')
  })
})
