import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaveEntryMenu from './SaveEntryMenu.jsx'
import { entryPresentation } from '../services/entryPresentation.mjs'

const captured = vi.hoisted(() => [])
vi.mock('./EntryButtonSurface', () => ({ default: props => { captured.push(props); return null } }))

const { text } = entryPresentation({ language: 'zh', hasInitializedLanguage: true })
describe('Start surface activation contract at its real menu call site', () => {
  beforeEach(() => { captured.length = 0 })
  it.each(['start-ready', 'choice-ready', 'legacy-ready', 'overwrite-confirm'])('explicitly activates Start in %s', phase => {
    const entry = { phase, epoch: 1, reasons: [], inspection: { snapshotToken: 'valid', allowedActions: ['create', 'continue', 'restart', 'request-replace'] } }
    renderToStaticMarkup(React.createElement(SaveEntryMenu, { entry, language: 'zh', text, warnings: [], onAction: vi.fn() }))
    const start = captured.filter(props => props.entryId === 'begin')
    expect(start).toHaveLength(1)
    // Omitted visible must fail: the real surface defaults to false, so mere
    // existence of SSR markup is insufficient to activate its entry lifecycle.
    expect(start[0].visible).toBe(true)
    expect(start[0].disabled).not.toBe(true)
    expect(typeof start[0].onActionComplete).toBe('function')
    expect(start[0].retainOnAction).toBe(phase !== 'start-ready')
  })
})
