const strongBoundaries = new Set(['。', '！', '!', '？', '?', '；', ';'])
const weakBoundaries = new Set(['，', ',', '、', '：', ':'])
const closingMarks = new Set(['”', '’', '"', "'", '」', '』', '）', ')', '】', '〕', '］', '》', '〉'])

export const mainlineTextSegmentMinClauseLength = 5

function normalized(value: string) { return value.replace(/\s+/g, ' ').trim() }
function characterLength(value: string) {
  return Array.from(value.replace(/[\s。！？!?；;，,、：:“”‘’"'「」『』（）()【】〔〕［］《》〈〉]+$/gu, '').replace(/\s/g, '')).length
}

/** Preserve punctuation while keeping short vocatives and particles attached. */
export function splitMainlineInteractionText(text: string): readonly string[] {
  const clauses: string[] = []
  let buffer = ''
  for (const character of text.replace(/\r\n?/g, '\n')) {
    buffer += character
    if (character === '\n' || strongBoundaries.has(character) || weakBoundaries.has(character)) {
      if (normalized(buffer)) clauses.push(normalized(buffer))
      buffer = ''
    }
  }
  if (normalized(buffer)) clauses.push(normalized(buffer))
  const merged = clauses.reduce<string[]>((result, clause) => {
    const previous = result[result.length - 1]
    if (previous && characterLength(previous) < mainlineTextSegmentMinClauseLength) result[result.length - 1] = `${previous}${clause}`
    else result.push(clause)
    return result
  }, [])
  const segments = merged.reduce<string[]>((result, segment) => {
    if (segment.length === 1 && closingMarks.has(segment) && result.length > 0) result[result.length - 1] += segment
    else result.push(segment)
    return result
  }, [])
  if (segments.length > 1 && characterLength(segments[segments.length - 1]!) < mainlineTextSegmentMinClauseLength) {
    segments[segments.length - 2] += segments.pop()!
  }
  return segments.length ? segments : [normalized(text)]
}

export function longestMainlineInteractionSegment(text: string) {
  return splitMainlineInteractionText(text).reduce((longest, segment) => (
    Array.from(segment).length > Array.from(longest).length ? segment : longest
  ), '')
}

/** Measure the rendered Chinese serif face in browsers. The fallback is only
 * used in non-browser callers; the scene renderer always has Canvas metrics. */
export function mainlineMeasuredTextWidth(text: string, fontSizePx: number, fontFamily = '"Noto Serif SC", Georgia, serif') {
  if (typeof document !== 'undefined') {
    const context = document.createElement('canvas').getContext('2d')
    if (context) {
      context.font = `${fontSizePx}px ${fontFamily}`
      return context.measureText(text).width
    }
  }
  return Array.from(text).length * fontSizePx
}

/** Split only when the real rendered line is wider than its available box.
 * Keeps every original character and punctuation mark in display order. */
export function splitMainlineInteractionTextToFit(text: string, maxWidthPx: number, fontSizePx: number, measure = (value: string) => mainlineMeasuredTextWidth(value, fontSizePx)): readonly string[] {
  if (measure(text) <= maxWidthPx) return [text]
  const characters = Array.from(text)
  const preferredBreaks = new Set(['。', '！', '!', '？', '?', '；', ';', '，', ',', '、', '：', ':', '\n'])
  const output: string[] = []
  let start = 0
  while (start < characters.length) {
    let end = start + 1
    while (end <= characters.length && measure(characters.slice(start, end).join('')) <= maxWidthPx) end += 1
    const fitEnd = Math.max(start + 1, end - 1)
    let breakEnd = fitEnd
    for (let index = fitEnd - 1; index > start; index -= 1) {
      if (preferredBreaks.has(characters[index]!)) { breakEnd = index + 1; break }
    }
    output.push(characters.slice(start, breakEnd).join(''))
    start = breakEnd
  }
  return output.length ? output : [text]
}
