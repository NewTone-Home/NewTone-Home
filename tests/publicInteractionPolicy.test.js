import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { preventPublicShortcut, preventPublicTransfer } from '../src/interactions/publicInteractionPolicy'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const pageShell = read('../src/components/PageShell.jsx')
const styles = read('../src/styles/publicInteractionPolicy.css')

function event(overrides = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: '',
    target: null,
    preventDefault: vi.fn(),
    ...overrides,
  }
}

describe('public interaction policy', () => {
  it('blocks public transfer and selection actions', () => {
    const transfer = event()

    expect(preventPublicTransfer(transfer)).toBe(true)
    expect(transfer.preventDefault).toHaveBeenCalledOnce()
  })

  it('blocks common copy, cut, paste, and select-all shortcuts', () => {
    for (const key of ['a', 'c', 'v', 'x']) {
      const shortcut = event({ ctrlKey: true, key })
      expect(preventPublicShortcut(shortcut)).toBe(true)
      expect(shortcut.preventDefault).toHaveBeenCalledOnce()
    }
  })

  it('leaves editable targets and unrelated shortcuts alone', () => {
    const editableTarget = { closest: vi.fn(() => ({ tagName: 'TEXTAREA' })) }
    const editableCopy = event({ target: editableTarget })
    const unrelatedShortcut = event({ ctrlKey: true, key: 'z' })

    expect(preventPublicTransfer(editableCopy)).toBe(false)
    expect(editableCopy.preventDefault).not.toHaveBeenCalled()
    expect(preventPublicShortcut(unrelatedShortcut)).toBe(false)
    expect(unrelatedShortcut.preventDefault).not.toHaveBeenCalled()
  })

  it('mounts only at the public PageShell boundary and leaves touch-action unchanged', () => {
    for (const handler of [
      'onCopyCapture={preventPublicTransfer}',
      'onCutCapture={preventPublicTransfer}',
      'onPasteCapture={preventPublicTransfer}',
      'onContextMenu={preventPublicTransfer}',
      'onDragStartCapture={preventPublicTransfer}',
      'onKeyDownCapture={preventPublicShortcut}',
    ]) expect(pageShell).toContain(handler)
    expect(styles).toContain('.page-shell *')
    expect(styles).not.toContain('touch-action')
  })
})
