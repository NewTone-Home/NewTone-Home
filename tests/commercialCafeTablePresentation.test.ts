import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialCafeStoryTableId } from '../src/center/runtime/commercialCafeStory'

describe('Café plain table presentation contract', () => {
  it('keeps the story table as a plain labeled scene object without attached prop presentation', () => {
    const cafe = mainlineScenes['commercial-cafe']

    expect(cafe).not.toHaveProperty('attachedProps')
    expect(cafe.objects.find(({ id }) => id === commercialCafeStoryTableId)?.label).toBe('桌子')
    expect(cafe.objects.map(({ id }) => id)).not.toContain('commercial-cafe-banknote')
    expect(cafe.objects.map(({ id }) => id)).not.toContain('commercial-cafe-lao-zhou-coffee')
    expect(cafe.objects.map(({ id }) => id)).not.toContain('commercial-cafe-xiujie-coffee')
    expect(cafe.objects.map(({ id }) => id)).not.toContain('commercial-cafe-xiujie-milk-tea')
  })
})
