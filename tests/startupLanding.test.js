import { createEntryController } from '../src/services/entryController.mjs'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

describe('public startup', () => {
  it('allows Center creation without waiting for a Reader publication', async () => {
    expect(source).toContain("import App from './App.jsx'")
    expect(source).toContain("import './views/EmptyContentApp.css'")
    expect(source).not.toContain('loadPublishedContent')
    expect(source).not.toContain('contentStatus=')
    const handle = { check() {} }
    const service = { getRecoveryState: async () => ({status:'no-pending-operation'}), inspectSave: async () => ({status:'ready',classification:'empty',allowedActions:['create'],snapshotToken:'opaque'}), prepareEntry: async () => ({status:'prepared',ticket:{opaque:true}}), commitEntry: async () => ({status:'committed',ticket:{opaque:true},receipt:{},snapshot:{values:{}},sessionHandle:handle}) }
    const controller = createEntryController(service)
    await controller.start(); expect(controller.getState().phase).toBe('start-ready')
    await controller.submit('create'); expect(controller.getState().phase).toBe('entering')
  })

})
