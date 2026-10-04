import { describe, expect, it } from 'vitest'
import { dialoguePresentationText } from '../src/center/runtime/dialoguePresentation'

describe('dialogue presentation text', () => {
  it('strips only visible Chinese dialogue punctuation without changing its source', () => {
    const source = '“你好，”他说：“你来了吗？！”'
    expect(dialoguePresentationText(source)).toBe('你好他说你来了吗')
    expect(source).toBe('“你好，”他说：“你来了吗？！”')
  })
})
