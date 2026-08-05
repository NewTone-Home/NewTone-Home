const EVENT_BEAT_IDS = new Set([
  'home-02',
  'commercial-06',
  'commercial-14',
  'corner-01',
  'corner-08',
  'xj2-p-014',
  'xj3-p-005',
  'xj3-p-014',
  'xj3-p-023',
  'ry1-p-009',
  'ry1-p-016',
  'ry2-p-004',
  'ry2-p-017',
])

const SENTENCE_END = new Set(['。', '！', '？', '!', '?', '；', ';'])
const CLAUSE_END = new Set(['，', ',', '：', ':'])
const CLOSING_QUOTE = new Set(['”', '’', '"', "'"])
const TARGET_UNIT_LENGTH = 42

export function isDialogueDisplayText(text) {
  const trimmed = text.trim()
  const quoteCount = (trimmed.match(/[“”"「」『』]/g) ?? []).length
  return /^[“"「『]/.test(trimmed) || (quoteCount >= 2 && trimmed.length <= 120)
}

function rawSemanticSlices(text) {
  const slices = []
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    if (!SENTENCE_END.has(text[index])) continue
    let end = index + 1
    while (end < text.length && CLOSING_QUOTE.has(text[end])) end += 1
    slices.push(text.slice(start, end))
    start = end
    index = end - 1
  }
  if (start < text.length) slices.push(text.slice(start))
  return slices.filter(Boolean)
}

function splitLongSlice(text) {
  if (text.length <= TARGET_UNIT_LENGTH) return [text]
  const slices = []
  let start = 0
  let lastClauseEnd = -1
  for (let index = 0; index < text.length; index += 1) {
    if (CLAUSE_END.has(text[index])) lastClauseEnd = index + 1
    if (index - start + 1 < TARGET_UNIT_LENGTH || lastClauseEnd <= start) continue
    slices.push(text.slice(start, lastClauseEnd))
    start = lastClauseEnd
    lastClauseEnd = -1
  }
  if (start < text.length) slices.push(text.slice(start))
  return slices
}

export function splitReaderDisplayText(text) {
  if (isDialogueDisplayText(text)) return [text]
  const units = rawSemanticSlices(text).flatMap(splitLongSlice)
  return units.length > 0 ? units : [text]
}

export function shouldPreserveReaderBeat(beatId) {
  return EVENT_BEAT_IDS.has(beatId)
}
