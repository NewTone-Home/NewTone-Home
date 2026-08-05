import { PHASES } from '../constants/phases.js'

export const READER_PAGE_MODES = Object.freeze({
  FOCUS_SEQUENCE: 'focus-sequence',
  FLOW: 'flow',
})

export const READER_TRANSITION_TYPES = Object.freeze({
  STANDARD: 'standard',
  CHAPTER_END: 'chapter-end',
})

function deepFreeze(value) {
  Object.values(value).forEach(child => {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) deepFreeze(child)
  })
  return Object.freeze(value)
}

function validateBlocks(blocks, beat, page, label = '') {
  if (!Array.isArray(blocks) || blocks.length === 0) throw new Error(`Beat ${beat.id}${label} must provide blocks`)
  const blockIds = new Set()
  for (const block of blocks) {
    if (!block || typeof block.id !== 'string' || !/^block-\d+$/.test(block.id)) throw new Error(`Invalid block ID in beat ${beat.id}${label}`)
    if (blockIds.has(block.id)) throw new Error(`Duplicate block ID ${block.id} in beat ${beat.id}${label}`)
    if (block.type !== 'paragraph' || typeof block.text !== 'string' || !block.text.trim()) throw new Error(`Invalid block ${block.id} in beat ${beat.id}${label}`)
    if (block.source?.chapterId !== page.chapterId || typeof block.source?.paragraphId !== 'string') throw new Error(`Invalid source metadata for ${beat.id}/${block.id}${label}`)
    blockIds.add(block.id)
  }
}

export let readerContent = Object.freeze([])

export function validateReaderContent(content, { allowEmpty = false } = {}) {
  if (!Array.isArray(content) || (!allowEmpty && content.length === 0)) {
    throw new TypeError('Reader content must be a non-empty array of phases')
  }
  const phaseIds = new Set()
  const pageIds = new Set()
  const beatIds = new Set()
  for (const phase of content) {
    if (!phase || typeof phase.id !== 'string' || !PHASES.includes(phase.id)) throw new Error(`Invalid phase ID: ${String(phase?.id)}`)
    if (phaseIds.has(phase.id)) throw new Error(`Duplicate phase ID: ${phase.id}`)
    phaseIds.add(phase.id)
    if (!Array.isArray(phase.pages) || phase.pages.length === 0) throw new Error(`Phase ${phase.id} must provide pages`)
    for (const page of phase.pages) {
      if (!page?.id || pageIds.has(page.id)) throw new Error(`Invalid or duplicate page ID: ${String(page?.id)}`)
      pageIds.add(page.id)
      if (!page.chapterId || !page.chapterTitle || !page.protagonistId) throw new Error(`Missing chapter metadata for page ${page.id}`)
      if (!Object.values(READER_PAGE_MODES).includes(page.mode)) throw new Error(`Invalid page mode: ${String(page.mode)}`)
      if (!Array.isArray(page.beats) || page.beats.length === 0) throw new Error(`Empty page: ${page.id}`)
      if (!page.scene?.label || !page.boundary || !page.transitionType) throw new Error(`Incomplete page configuration: ${page.id}`)
      for (const beat of page.beats) {
        if (!beat?.id || beatIds.has(beat.id)) throw new Error(`Invalid or duplicate beat ID: ${String(beat?.id)}`)
        beatIds.add(beat.id)
        validateBlocks(beat.blocks, beat, page)
        if (beat.translations !== undefined) {
          if (!beat.translations || typeof beat.translations !== 'object') throw new Error(`Invalid translations in beat ${beat.id}`)
          for (const [language, translation] of Object.entries(beat.translations)) {
            if (language !== 'en') throw new Error(`Unsupported translation language ${language} in beat ${beat.id}`)
            validateBlocks(translation?.blocks, beat, page, `/${language}`)
          }
        }
      }
    }
  }
  return content
}

export function setReaderContent(content) {
  validateReaderContent(content)
  readerContent = deepFreeze(structuredClone(content))
  return readerContent
}

export function hasReaderContent() {
  return readerContent.length > 0
}

export function resolveReaderDisplayLocation(location) {
  const phase = readerContent.find(candidate => candidate.id === location?.phaseId) ?? readerContent[0]
  if (!phase) throw new Error('Reader content is not loaded')
  const page = phase.pages.find(candidate => candidate.id === location?.pageId) ?? phase.pages[0]
  const beatIndex = location?.beatId
    ? Math.max(0, page.beats.findIndex(candidate => candidate.id === location.beatId))
    : Math.min(Math.max(location?.beatIndex ?? 0, 0), page.beats.length - 1)
  return { ...location, phaseId: phase.id, pageId: page.id, beatIndex }
}

export function resolveReaderEnvironmentState(location) {
  if (readerContent.length === 0) {
    return { worldLayer: 'surface', time: 'noon', weather: 'clear', light: 'neutral' }
  }
  const resolved = resolveReaderDisplayLocation(location)
  const phase = readerContent.find(candidate => candidate.id === resolved.phaseId)
  const page = phase.pages.find(candidate => candidate.id === resolved.pageId)
  return page.beats[resolved.beatIndex]?.worldState ?? page.beats[0].worldState ?? {
    worldLayer: 'surface', time: 'noon', weather: 'clear', light: 'neutral',
  }
}

export function getNarrativeReplayLocation(chapterId, beatId) {
  if (!chapterId) return null
  const pages = readerContent.flatMap(phase => phase.pages.map(page => ({ phaseId: phase.id, page })))
  const match = pages.find(({ page }) => page.chapterId === chapterId && (!beatId || page.beats.some(beat => beat.id === beatId)))
  if (!match) return null
  const beatIndex = beatId ? match.page.beats.findIndex(beat => beat.id === beatId) : 0
  return { phaseId: match.phaseId, pageId: match.page.id, beatIndex, beatId: match.page.beats[beatIndex].id }
}
