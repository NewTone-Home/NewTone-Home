import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const source = read('../src/components/LandingUpdatesPage.jsx')
const data = source.slice(source.indexOf('const LANDING_UPDATES'), source.indexOf('const UPDATE_UI_COPY'))
const updates = Function(data + '; return LANDING_UPDATES')()
describe('v0.2.1 release preparation', () => {
  it('prepends the dated entry while keeping the earlier release order and collapsed contract', () => {
    expect(updates.map(update => update.version)).toEqual(['v0.2.1', 'v0.2.0', 'v0.1.2', 'v0.1.1'])
    expect(updates[0]).toMatchObject({ date: '2026.10.05', dateTime: '2026-10-05' })
    expect(source).toContain('useState(null)')
    expect(source).toContain('aria-hidden={!expanded}')
  })
  it('preserves the exact approved bilingual announcement', () => {
    expect(updates[0].zh).toEqual({
      summary: ['世界正在慢慢变得热闹起来。', '新的街道、新的人，以及一些还没有结束的事情，正在出现。'],
      details: ['· 我们开放了新的场景，现在大家可以去逛街了', '· 出现了一些NPC', '· 我们调整了一些视觉效果和交互体验。', '可惜的是，其他语言版本暂时还没有完成，目前仍在开发中。'],
    })
    expect(updates[0].en).toEqual({
      summary: ['The world is slowly starting to feel a little more alive.', 'New streets, new faces, and a few things still unfolding are beginning to appear.'],
      details: ['· We’ve opened up more places to explore. You can go wander the streets now.', '· A few new NPCs have appeared.', '· We’ve also refined some of the visuals and interactions.', 'The English version and other localizations aren’t ready just yet, but they’re still in development.'],
    })
  })
  it('keeps only the existing Lao Zhou contact and messages, with no Ruo Yu UI data', () => {
    const phone = read('../src/center/runtime/WorldPhone.tsx')
    const contacts = phone.slice(phone.indexOf('const innerContacts'), phone.indexOf('type WorldPhoneProps'))
    expect([...contacts.matchAll(/id: '([^']+)'/g)].map(match => match[1])).toEqual(['lao-zhou'])
    expect(contacts).toContain("messages: ['陈副部长失踪了。', '什么时候有空。', '周六。', '老地方。', '好。']")
    expect(phone).not.toContain('ruo-yu')
    expect(phone).not.toContain('若雨')
    expect(phone).toContain('当前手机没有里世界联系人。')
  })
})
