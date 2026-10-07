import { describe, expect, it } from 'vitest'
import {
  advancePhoneStoryNotes,
  cleanPhoneCallHistory,
  cleanPhoneContactNotes,
  cleanPhoneNotes,
  createInitialPhoneNotes,
  createPlayerPhoneNote,
  ensurePhoneYongheLead,
  pinPhoneStoryNote,
  updatePhoneNote,
} from '../src/center/runtime/phonePersonalData'

describe('persistent Phone notes and personal data', () => {
  it('keeps a single current story record and moves the previous stage into history', () => {
    const opening = createInitialPhoneNotes()
    const cafe = advancePhoneStoryNotes(opening, 'cafe', 100)
    expect(cafe.find(note => note.id === 'story-opening')).toMatchObject({ status: 'history', pinned: false })
    expect(cafe.find(note => note.id === 'story-cafe')).toMatchObject({ kind: 'story', status: 'current', body: '剧情已推进至咖啡馆。' })
    expect(advancePhoneStoryNotes(cafe, 'cafe')).toBe(cafe)
  })

  it('limits pinning to one current story record and archives completed items', () => {
    const notes = advancePhoneStoryNotes(createInitialPhoneNotes(), 'commercial-street')
    expect(pinPhoneStoryNote(notes, 'story-commercial-street', 10)).toBe(notes)
    const withLead = ensurePhoneYongheLead(notes, 10)
    const pinned = pinPhoneStoryNote(withLead, 'story-yonghe-lead', 15)
    expect(pinned.filter(note => note.pinned).map(note => note.id)).toEqual(['story-yonghe-lead'])
    const completed = updatePhoneNote(pinned, 'story-yonghe-lead', { status: 'history' }, 20)
    expect(completed.find(note => note.id === 'story-yonghe-lead')).toMatchObject({ status: 'history', pinned: false })
  })

  it('creates editable player notes and sanitizes persisted personal fields', () => {
    const notes = createPlayerPhoneNote(createInitialPhoneNotes(), '买咖啡', '记得问老周。', 42)
    const playerNote = notes.find(note => note.kind === 'player')!
    expect(playerNote).toMatchObject({ title: '买咖啡', body: '记得问老周。', status: 'current', createdAt: 42 })
    expect(cleanPhoneNotes([{ ...playerNote, pinned: true, body: 'x'.repeat(3000) }])[0]).toMatchObject({ pinned: false, body: 'x'.repeat(2000) })
    expect(cleanPhoneContactNotes({ 'lao-zhou': '我的备注', bad: { nested: true } })).toEqual({ 'lao-zhou': '我的备注' })
    expect(cleanPhoneCallHistory([{ id: 'call-1', contactId: 'lao-zhou', startedAt: 1, endedAt: 20, durationMs: 19, result: 'cancelled' }, { bad: true }])).toHaveLength(1)
  })
})
