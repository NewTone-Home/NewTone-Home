import { z } from 'zod'
import { readerContent } from '../data/readerContent'
const narrativeEventMapDefinition = Object.freeze({
  schemaVersion: 2,
  readerRoute: Object.freeze({ phaseId: 'M1' }),
  eventMapVersion: 1,
  events: Object.freeze([]),
})

const identifierSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const phaseIdSchema = z.string().regex(/^[A-Z][A-Z0-9]*$/)

export const narrativeBeatAddressSchema = z.object({
  phaseId: phaseIdSchema,
  pageId: identifierSchema,
  beatId: identifierSchema,
}).strict()

export const narrativeBlockAddressSchema = narrativeBeatAddressSchema.extend({
  blockId: z.string().regex(/^block-\d+$/),
}).strict()

const sourceAnchorSchema = z.object({
  chapterId: identifierSchema,
  paragraphId: z.string().regex(/^p-\d{3}$/),
}).strict()

export const narrativeSegmentSchema = z.object({
  id: identifierSchema,
  text: z.string().min(1),
}).strict()

const narrativeTextFrameSchema = z.object({
  before: z.string(),
  between: z.array(z.string()),
  after: z.string(),
}).strict()

const narrativePauseTextFrameSchema = z.object({
  before: z.string(),
  delayed: z.string().min(1),
  after: z.string(),
}).strict()

const narrativeTypewriterTextFrameSchema = z.object({
  before: z.string(),
  typed: z.string().min(1),
  after: z.string(),
}).strict()

const triggerSchema = z.object({
  type: z.literal('enter-beat'),
  direction: z.literal('forward'),
  from: narrativeBeatAddressSchema.optional(),
  to: narrativeBeatAddressSchema,
}).strict()

const sharedRepeatPolicy = {
  activation: z.literal('chapter_first_time'),
  onReenter: z.literal('deliver_immediately'),
  onRestart: z.literal('offer_replay'),
  completionScope: z.literal('chapter'),
}

const targetBaseSchema = narrativeBlockAddressSchema.extend({ sourceAnchor: sourceAnchorSchema })

const pauseEventSchema = z.object({
  id: identifierSchema,
  chapterId: identifierSchema,
  type: z.literal('pause'),
  durationMs: z.number().int().positive(),
  trigger: triggerSchema,
  target: targetBaseSchema.extend({ textFrame: narrativePauseTextFrameSchema.optional() }).strict(),
  repeatPolicy: z.object({ ...sharedRepeatPolicy, onReview: z.literal('deliver_immediately') }).strict(),
}).strict()

const revealEventSchema = z.object({
  id: identifierSchema,
  chapterId: identifierSchema,
  type: z.literal('reveal'),
  delivery: z.enum(['sequence', 'clarify']),
  presentation: z.enum(['core-fact', 'suspense']),
  stepDurationMs: z.number().int().positive(),
  trigger: triggerSchema,
  target: targetBaseSchema.extend({
    segments: z.array(narrativeSegmentSchema).min(1),
    textFrame: narrativeTextFrameSchema,
  }).strict(),
  repeatPolicy: z.object({ ...sharedRepeatPolicy, onReview: z.literal('show_confirmed') }).strict(),
}).strict()

const typewriterEventSchema = z.object({
  id: identifierSchema,
  chapterId: identifierSchema,
  type: z.literal('typewriter'),
  characterDurationMs: z.number().int().positive(),
  trigger: triggerSchema,
  target: targetBaseSchema.extend({ textFrame: narrativeTypewriterTextFrameSchema }).strict(),
  repeatPolicy: z.object({ ...sharedRepeatPolicy, onReview: z.literal('show_completed') }).strict(),
}).strict()

export const narrativeEventSchema = z.discriminatedUnion('type', [pauseEventSchema, revealEventSchema, typewriterEventSchema])

export const narrativeEventMapSchema = z.object({
  schemaVersion: z.literal(2),
  readerRoute: z.object({ phaseId: phaseIdSchema }).strict(),
  eventMapVersion: z.number().int().positive(),
  events: z.array(narrativeEventSchema),
}).strict()

function freezeDeep(value) {
  Object.values(value).forEach(child => {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) freezeDeep(child)
  })
  return Object.freeze(value)
}

const beatAddressFields = address => ({ phaseId: address?.phaseId, pageId: address?.pageId, beatId: address?.beatId })
const blockAddressFields = address => ({ ...beatAddressFields(address), blockId: address?.blockId })

export function resolveNarrativeBeatAddress(address, content = readerContent) {
  const parsedAddress = narrativeBeatAddressSchema.parse(beatAddressFields(address))
  const phase = content.find(candidate => candidate.id === parsedAddress.phaseId)
  if (!phase) throw new RangeError(`Narrative address has unknown phase: ${parsedAddress.phaseId}`)
  const page = phase.pages.find(candidate => candidate.id === parsedAddress.pageId)
  if (!page) throw new RangeError(`Narrative address has unknown page ${parsedAddress.pageId} in phase ${parsedAddress.phaseId}`)
  const beatIndex = page.beats.findIndex(candidate => candidate.id === parsedAddress.beatId)
  if (beatIndex < 0) throw new RangeError(`Narrative address has unknown beat ${parsedAddress.beatId} in page ${parsedAddress.pageId}`)
  return Object.freeze({ phase, page, beat: page.beats[beatIndex], beatIndex })
}

export function resolveNarrativeBlockAddress(address, content = readerContent) {
  const parsedAddress = narrativeBlockAddressSchema.parse(blockAddressFields(address))
  const resolvedBeat = resolveNarrativeBeatAddress(parsedAddress, content)
  const blockIndex = resolvedBeat.beat.blocks.findIndex(candidate => candidate.id === parsedAddress.blockId)
  if (blockIndex < 0) throw new RangeError(`Narrative address has unknown block ${parsedAddress.blockId} in beat ${parsedAddress.beatId}`)
  return Object.freeze({ ...resolvedBeat, block: resolvedBeat.beat.blocks[blockIndex], blockIndex })
}

export function resolveNarrativeSegmentAddress(eventMap, address, content = readerContent) {
  const parsedAddress = narrativeBlockAddressSchema.extend({ segmentId: identifierSchema }).strict().parse(address)
  const event = eventMap.events.find(candidate => (
    candidate.type === 'reveal'
    && candidate.target.phaseId === parsedAddress.phaseId
    && candidate.target.pageId === parsedAddress.pageId
    && candidate.target.beatId === parsedAddress.beatId
    && candidate.target.blockId === parsedAddress.blockId
  ))
  if (!event) throw new RangeError(`Narrative segment address has no Reveal target in beat ${parsedAddress.beatId}`)
  const segmentIndex = event.target.segments.findIndex(candidate => candidate.id === parsedAddress.segmentId)
  if (segmentIndex < 0) throw new RangeError(`Narrative address has unknown segment ${parsedAddress.segmentId} in beat ${parsedAddress.beatId}`)
  const resolvedBlock = resolveNarrativeBlockAddress(parsedAddress, content)
  return Object.freeze({ ...resolvedBlock, segment: event.target.segments[segmentIndex], segmentIndex, event })
}

function reconstructedText(event) {
  if (event.type === 'pause') {
    return event.target.textFrame
      ? event.target.textFrame.before + event.target.textFrame.delayed + event.target.textFrame.after
      : null
  }
  if (event.type === 'typewriter') {
    return event.target.textFrame.before + event.target.textFrame.typed + event.target.textFrame.after
  }
  return event.target.segments.reduce((text, segment, index) => (
    text + segment.text + (event.target.textFrame.between[index] ?? '')
  ), event.target.textFrame.before) + event.target.textFrame.after
}

export function validateNarrativeEventMap(eventMap, content = readerContent) {
  const parsedMap = narrativeEventMapSchema.parse(eventMap)
  const eventIds = new Set()

  for (const event of parsedMap.events) {
    if (eventIds.has(event.id)) throw new Error(`Duplicate Narrative event ID: ${event.id}`)
    eventIds.add(event.id)
    if (event.trigger.to.phaseId !== parsedMap.readerRoute.phaseId) throw new Error(`Event ${event.id} targets a different Reader phase`)
    resolveNarrativeBeatAddress(event.trigger.to, content)
    if (event.trigger.from) resolveNarrativeBeatAddress(event.trigger.from, content)
    const { block, page } = resolveNarrativeBlockAddress(event.target, content)
    if (event.chapterId !== event.target.sourceAnchor.chapterId || page.chapterId !== event.chapterId) {
      throw new Error(`Narrative chapter anchor mismatch for ${event.id}`)
    }
    if (block.source?.paragraphId !== event.target.sourceAnchor.paragraphId) {
      throw new Error(`Narrative paragraph anchor mismatch for ${event.id}`)
    }
    if (event.type === 'reveal') {
      const segmentIds = new Set()
      event.target.segments.forEach(segment => {
        if (segmentIds.has(segment.id)) throw new Error(`Duplicate segment ID ${segment.id} in event ${event.id}`)
        segmentIds.add(segment.id)
      })
      if (event.target.textFrame.between.length !== event.target.segments.length - 1) {
        throw new Error(`Reveal text frame does not match segment count for event ${event.id}`)
      }
    }
    const framedText = reconstructedText(event)
    if (framedText !== null && framedText !== block.text) {
      throw new Error(`Narrative text anchor does not reproduce source paragraph for ${event.id}`)
    }
  }

  return freezeDeep(parsedMap)
}

export const readerNarrativeEventMap = validateNarrativeEventMap(narrativeEventMapDefinition)
export const xiujieNarrativeEventMap = readerNarrativeEventMap
