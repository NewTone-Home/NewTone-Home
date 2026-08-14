import { readerContent, validateReaderContent } from '../data/readerContent'

export function createReaderIndex(content = readerContent, { allowEmpty = false } = {}) {
  validateReaderContent(content, { allowEmpty })

  const entries = []
  const pageLookup = Object.create(null)

  for (const phase of content) {
    for (const currentPage of phase.pages) {
      const pageKey = `${phase.id}/${currentPage.id}`
      const pageEntries = []

      currentPage.beats.forEach((beat, beatIndex) => {
        const entry = Object.freeze({
          phaseId: phase.id,
          pageId: currentPage.id,
          beatIndex,
          beatId: beat.id,
          linearIndex: entries.length,
        })
        entries.push(entry)
        pageEntries.push(entry)
      })

      pageLookup[pageKey] = Object.freeze(pageEntries)
    }
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    pageLookup: Object.freeze(pageLookup),
  })
}

let indexedContent = null
let currentIndex = null

function getCurrentReaderIndex() {
  if (indexedContent !== readerContent) {
    indexedContent = readerContent
    currentIndex = createReaderIndex(readerContent, { allowEmpty: true })
  }
  return currentIndex
}

export const readerContentIndex = Object.freeze({
  get entries() { return getCurrentReaderIndex().entries },
  get pageLookup() { return getCurrentReaderIndex().pageLookup },
})

function getIndex(content) {
  return content === readerContent
    ? getCurrentReaderIndex()
    : createReaderIndex(content)
}

export function resolvePosition(position, content = readerContent) {
  if (!position || typeof position !== 'object') {
    throw new TypeError('Reader position must be an object')
  }

  const index = getIndex(content)
  const { phaseId, pageId, beatIndex } = position

  if (typeof phaseId !== 'string' || !content.some(phase => phase.id === phaseId)) {
    throw new RangeError(`Invalid phase: ${String(phaseId)}`)
  }

  const phase = content.find(candidate => candidate.id === phaseId)
  if (typeof pageId !== 'string' || !phase.pages.some(currentPage => currentPage.id === pageId)) {
    throw new RangeError(`Invalid page ${String(pageId)} for phase ${phaseId}`)
  }

  if (!Number.isInteger(beatIndex)) {
    throw new RangeError(`Invalid beatIndex: ${String(beatIndex)}`)
  }

  const pageEntries = index.pageLookup[`${phaseId}/${pageId}`]
  if (beatIndex < 0 || beatIndex >= pageEntries.length) {
    throw new RangeError(`Invalid beatIndex ${beatIndex} for page ${pageId}`)
  }

  return pageEntries[beatIndex]
}

export function nextPosition(position, content = readerContent) {
  const index = getIndex(content)
  const current = resolvePosition(position, content)
  return index.entries[current.linearIndex + 1] ?? null
}

export function previousPosition(position, content = readerContent) {
  const index = getIndex(content)
  const current = resolvePosition(position, content)
  return index.entries[current.linearIndex - 1] ?? null
}

export function comparePosition(left, right, content = readerContent) {
  const leftIndex = resolvePosition(left, content).linearIndex
  const rightIndex = resolvePosition(right, content).linearIndex
  return Math.sign(leftIndex - rightIndex)
}

export function getOverallProgress(position, content = readerContent) {
  const index = getIndex(content)
  const current = resolvePosition(position, content)

  if (index.entries.length === 1) {
    return 1
  }

  return current.linearIndex / (index.entries.length - 1)
}

export function isFinalReaderBeat(focusBeatIndex, beats) {
  return Array.isArray(beats) && beats.length > 0 && focusBeatIndex === beats.length - 1
}
