import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = path => readFileSync(`${root}/${path}`, 'utf8')

describe('first-release boundary', () => {
  it('has no bundled legacy manuscript or generated content seed', () => {
    const manuscriptDir = `${root}/src/content/manuscripts`
    expect(existsSync(manuscriptDir) ? readdirSync(manuscriptDir) : []).toEqual([])
    expect(existsSync(`${root}/supabase/seed/reader-content-v1.json`)).toBe(false)
  })

  it('keeps admin authenticated and independent of the public Center entry', () => {
    expect(source('src/main.jsx')).toContain("window.location.pathname === '/admin'")
    expect(source('src/views/Landing.jsx')).not.toContain('/admin')
    expect(source('src/admin/AdminApp.jsx')).toContain("phase === 'ready' && draft")
    expect(source('src/admin/AdminApp.jsx')).toContain('loadOwnerDraft(session.user.id)')
    expect(source('src/admin/OwnerReaderPreview.jsx')).not.toContain("import('../App.jsx')")
    expect(source('src/admin/ownerPreviewSession.mjs')).toContain('createReaderPreviewStores')
    expect(source('src/admin/ownerPreviewSession.mjs')).not.toContain('installGameStorage')
  })

  it('keeps Center independent of Reader availability while preserving owner authentication and Reader tools', () => {
    expect(source('src/main.jsx')).not.toContain('loadPublishedContent')
    expect(source('src/main.jsx')).not.toContain('<EmptyContentApp')
    expect(source('src/App.jsx')).toContain('<EntrySurface')
    expect(source('src/components/EntrySurface.jsx')).toContain('<Landing')
    expect(source('src/admin/OwnerReaderPreviewHost.jsx')).toContain('<Reader')
    expect(source('src/views/ReaderOrchestrator.jsx')).toContain('<EmptyReaderOrchestrator')
    expect(source('src/views/ReaderStage.jsx')).toContain('<ReaderTools')
    expect(source('src/views/ReaderStage.jsx')).toContain('reader-empty-document')
    expect(source('src/views/ReaderStage.jsx')).not.toContain('ReaderUnavailable')
    expect(source('src/admin/adminAccessSequence.js')).toContain("ADMIN_ACCESS_SEQUENCE = '9989'")
    expect(source('src/admin/adminAccessSequence.js')).not.toContain('credential')
    expect(source('src/admin/AdminSequenceGate.jsx')).toContain("window.location.assign('/admin')")
    expect(source('src/admin/AdminApp.jsx')).toContain('loadOwnerDraft(session.user.id)')
  })

  it('allows only the dedicated release branch to create a protected Preview', () => {
    const vercel = JSON.parse(source('vercel.json'))
    expect(vercel.git.deploymentEnabled).toEqual({
      'codex/release-landing-reader-vercel': true,
    })
  })
})
