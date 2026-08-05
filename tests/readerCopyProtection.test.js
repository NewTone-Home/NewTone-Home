import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { preventReaderShortcut, preventReaderTransfer } from '../src/reader/readerCopyProtection'

const readerStageSource = readFileSync(new URL('../src/views/ReaderStage.jsx', import.meta.url), 'utf8')
const readerStageCss = readFileSync(new URL('../src/views/ReaderStage.css', import.meta.url), 'utf8')

describe('published Reader copy deterrence', () => {
  it('blocks copy-like transfers and common copy shortcuts', () => {
    const transfer = { preventDefault: vi.fn() }
    expect(preventReaderTransfer(transfer)).toBe(true)
    expect(transfer.preventDefault).toHaveBeenCalledOnce()

    for (const key of ['a', 'c', 'x']) {
      const event = { key, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault: vi.fn() }
      expect(preventReaderShortcut(event)).toBe(true)
      expect(event.preventDefault).toHaveBeenCalledOnce()
    }
  })

  it('does not intercept unrelated or modified browser shortcuts', () => {
    for (const event of [
      { key: 'v', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
      { key: 'c', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true },
      { key: 'c', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },
    ]) {
      event.preventDefault = vi.fn()
      expect(preventReaderShortcut(event)).toBe(false)
      expect(event.preventDefault).not.toHaveBeenCalled()
    }
  })

  it('applies only to the published Reader surface, not the owner workbench', () => {
    expect(readerStageSource).toContain('data-copy-protected="true"')
    expect(readerStageSource).toContain('onCopyCapture={preventReaderTransfer}')
    expect(readerStageSource).toContain('onContextMenu={preventReaderTransfer}')
    expect(readerStageSource).toContain('onKeyDownCapture={preventReaderShortcut}')
    expect(readerStageCss).toContain('.reader-stage-page[data-copy-protected="true"] .reader-stage')
    expect(readerStageCss).toContain('-webkit-touch-callout: none')
  })
})
