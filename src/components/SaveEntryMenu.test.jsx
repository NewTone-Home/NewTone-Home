import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SaveEntryMenu from './SaveEntryMenu'
import { entryPresentation } from '../services/entryPresentation.mjs'

const { text } = entryPresentation({ language: 'zh', hasInitializedLanguage: true })
describe('actual SaveEntryMenu initial render', () => {
  it.each(['start-ready', 'choice-ready', 'legacy-ready'])('renders the framed Start, not the dormant options, in %s', phase => {
    const entry = { phase, epoch: 1, reasons: [], inspection: { snapshotToken: 'valid-token', allowedActions: ['create', 'continue', 'restart', 'request-replace'] } }
    const html = renderToStaticMarkup(<SaveEntryMenu entry={entry} language="zh" text={text} warnings={[]} onAction={() => {}} />)
    expect(html).toContain('data-entry-id="begin"')
    expect(html).toContain('开始游戏')
    expect(html).toContain('shared-entry-frame')
    expect(html).not.toContain('data-entry-id="continue"')
    expect(html).not.toContain('data-entry-id="request-replace"')
    expect(html).not.toContain('data-entry-id="restart"')
  })
  it('renders protection controls, never Start, for an unknown save', () => {
    const entry = { phase: 'unknown', epoch: 1, reasons: [], inspection: { classification: 'unknown', allowedActions: ['back', 'reinspect'] } }
    const html = renderToStaticMarkup(<SaveEntryMenu entry={entry} language="zh" text={text} warnings={[]} onAction={() => {}} />)
    expect(html).not.toContain('data-entry-id="begin"')
    expect(html).toContain('data-entry-id="back"')
    expect(html).toContain('data-entry-id="reinspect"')
  })
  it('retains Start and both vertical choices with confirm/cancel nested under new-save', () => {
    const entry = { phase: 'overwrite-confirm', epoch: 2, reasons: [], inspection: { snapshotToken: 'valid-token', allowedActions: ['continue', 'request-replace'] } }
    const html = renderToStaticMarkup(<SaveEntryMenu entry={entry} language="zh" text={text} warnings={[]} onAction={() => {}} />)
    for (const id of ['begin', 'continue', 'request-replace', 'replace', 'cancel']) expect(html).toContain(`data-entry-id="${id}"`)
    expect(html.indexOf('data-entry-id="begin"')).toBeLessThan(html.indexOf('data-entry-id="continue"'))
    expect(html.indexOf('save-entry-new-slot')).toBeLessThan(html.indexOf('save-entry-confirm'))
    expect(html).not.toContain('<p role="status"')
  })
})
