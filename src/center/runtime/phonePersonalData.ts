import type { MainlineStoryStage } from './mainlineStoryClock'

export type PhoneNoteKind = 'story' | 'player'
export type PhoneNoteStatus = 'current' | 'history'
export type PhoneNote = {
  id: string
  kind: PhoneNoteKind
  title: string
  body: string
  status: PhoneNoteStatus
  pinned: boolean
  pinAvailable?: boolean
  storyStage?: MainlineStoryStage
  createdAt: number
  updatedAt: number
}

export type PhoneCallRecord = {
  id: string
  contactId: string
  startedAt: number
  endedAt: number
  durationMs: number
  result: 'cancelled'
}

const storyStageLabels: Record<MainlineStoryStage, string> = {
  opening: '祖宅',
  'commercial-street': '商业街',
  cafe: '咖啡馆',
  yonghe: '永和小馆',
}

export function createInitialPhoneNotes(now = 0): PhoneNote[] {
  return [{
    id: 'story-opening', kind: 'story', title: '当前事项',
    body: '去里世界商业街咖啡馆找老周。', status: 'current', pinned: false, pinAvailable: false,
    storyStage: 'opening', createdAt: now, updatedAt: now,
  }]
}

export function cleanPhoneNotes(value: unknown): PhoneNote[] {
  if (!Array.isArray(value)) return createInitialPhoneNotes()
  const notes = value.flatMap((entry): PhoneNote[] => {
    if (!entry || typeof entry !== 'object') return []
    const source = entry as Partial<PhoneNote>
    if (typeof source.id !== 'string' || !source.id || typeof source.title !== 'string' || typeof source.body !== 'string') return []
    if (source.kind !== 'story' && source.kind !== 'player') return []
    const createdAt = Number(source.createdAt)
    const updatedAt = Number(source.updatedAt)
    return [{
      id: source.id.slice(0, 100), kind: source.kind,
      title: source.title.slice(0, 80), body: source.body.slice(0, 2000),
      status: source.kind === 'story' && source.status === 'history' ? 'history' : 'current',
      pinned: source.kind === 'story' && source.status !== 'history' && source.pinAvailable === true && source.pinned === true,
      pinAvailable: source.kind === 'story' && source.status !== 'history' && source.pinAvailable === true,
      ...(source.storyStage && source.kind === 'story' ? { storyStage: source.storyStage } : {}),
      createdAt: Number.isFinite(createdAt) ? Math.max(0, Math.round(createdAt)) : 0,
      updatedAt: Number.isFinite(updatedAt) ? Math.max(0, Math.round(updatedAt)) : 0,
    }]
  }).slice(-100)
  const pinnedIndex = notes.findIndex(note => note.pinned)
  return notes.map((note, index) => ({ ...note, pinned: note.pinned && index === pinnedIndex }))
}

export function cleanPhoneContactNotes(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([id, note]) => (
    typeof note === 'string' && id.length <= 100 ? [[id, note.slice(0, 1000)]] : []
  )))
}

export function cleanPhoneCallHistory(value: unknown): PhoneCallRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry): PhoneCallRecord[] => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Partial<PhoneCallRecord>
    if (typeof record.id !== 'string' || typeof record.contactId !== 'string' || record.result !== 'cancelled') return []
    const startedAt = Number(record.startedAt)
    const endedAt = Number(record.endedAt)
    const durationMs = Number(record.durationMs)
    if (![startedAt, endedAt, durationMs].every(Number.isFinite)) return []
    return [{ id: record.id.slice(0, 100), contactId: record.contactId.slice(0, 100), startedAt, endedAt, durationMs: Math.max(0, durationMs), result: 'cancelled' }]
  }).slice(-50)
}

export function advancePhoneStoryNotes(notes: readonly PhoneNote[], stage: MainlineStoryStage, now = 0): PhoneNote[] {
  if (notes.some(note => note.kind === 'story' && note.id === `story-${stage}` && note.status === 'current')) return notes as PhoneNote[]
  const updated = notes.map(note => note.kind === 'story' && note.status === 'current'
    ? { ...note, status: 'history' as const, pinned: false, updatedAt: now }
    : note)
  const nextStoryNote: PhoneNote = {
    id: `story-${stage}`, kind: 'story', title: `${storyStageLabels[stage]}记录`,
    body: `来到了${storyStageLabels[stage]}。`, status: 'current', pinned: false, pinAvailable: false,
    storyStage: stage, createdAt: now, updatedAt: now,
  }
  return [...updated, nextStoryNote]
}

export function createPlayerPhoneNote(notes: readonly PhoneNote[], title: string, body: string, now = Date.now()): PhoneNote[] {
  const cleanTitle = title.trim().slice(0, 80)
  const cleanBody = body.trim().slice(0, 2000)
  if (!cleanTitle && !cleanBody) return notes as PhoneNote[]
  const playerNote: PhoneNote = {
    id: `player-${now}-${Math.random().toString(36).slice(2, 8)}`, kind: 'player',
    title: cleanTitle || '未命名备忘', body: cleanBody, status: 'current', pinned: false, pinAvailable: false,
    createdAt: now, updatedAt: now,
  }
  return [...notes, playerNote].slice(-100)
}

export function updatePhoneNote(notes: readonly PhoneNote[], id: string, update: Partial<Pick<PhoneNote, 'title' | 'body' | 'status'>>, now = Date.now()): PhoneNote[] {
  return notes.map(note => note.id !== id || note.kind !== 'player' ? note : {
    ...note,
    title: update.title?.trim().slice(0, 80) ?? note.title,
    body: update.body?.slice(0, 2000) ?? note.body,
    status: 'current',
    pinned: false,
    updatedAt: now,
  })
}

export function pinPhoneStoryNote(notes: readonly PhoneNote[], id: string, now = Date.now()): PhoneNote[] {
  if (!notes.some(note => note.id === id && note.kind === 'story' && note.status === 'current' && note.pinAvailable)) return notes as PhoneNote[]
  return notes.map(note => ({ ...note, pinned: note.id === id, updatedAt: now }))
}

export function ensurePhoneYongheLead(notes: readonly PhoneNote[], now = 0): PhoneNote[] {
  if (notes.some(note => note.id === 'story-yonghe-lead')) return notes as PhoneNote[]
  const archived = notes.map(note => note.kind === 'story' && note.status === 'current'
    ? { ...note, status: 'history' as const, pinned: false, updatedAt: now }
    : note)
  const lead: PhoneNote = {
    id: 'story-yonghe-lead', kind: 'story', title: '永和线索',
    body: '查不到去了哪里。不过我在那边有个线人，据说有人好像在永和小馆那块见过陈副部长。', status: 'current', pinned: false,
    pinAvailable: true, storyStage: 'cafe', createdAt: now, updatedAt: now,
  }
  return [...archived, lead]
}

export function phoneStoryHistory(notes: readonly PhoneNote[]) {
 const story = notes.filter(note => note.kind === 'story')
 return story.flatMap((note,index) => {
  if (note.status !== 'history') return []
  const next = story[index + 1]
  if (!next) return []
  const event = next.id === 'story-yonghe-lead'
    ? { title: '获得了永和小馆相关线索', summary: '老周提到了矿区的永和小馆。', stage: 'cafe' as const }
    : { title: `来到${storyStageLabels[next.storyStage ?? 'opening']}`, summary: next.body, stage: next.storyStage ?? 'opening' }
  return [{ id:note.id, ...event, notes:[note] }]
 })
}
