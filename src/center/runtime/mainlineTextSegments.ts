const strongBoundaries = new Set(['。', '！', '!', '？', '?', '；', ';'])
const weakBoundaries = new Set(['，', ',', '、', '：', ':'])
const closingMarks = new Set(['”', '’', '"', "'", '」', '』', '）', ')', '】', '〕', '］', '》', '〉'])

export const mainlineTextSegmentMinClauseLength = 5

/** Text shown in the reading UI may omit a terminal Chinese full stop. Keep
 * the authored source elsewhere; normalize before either segmentation path
 * measures or stores display pages. Internal punctuation is left untouched. */
export function mainlineDisplaySourceText(source: string) {
  const trailingWhitespace = source.match(/\s*$/u)?.[0] ?? ''
  const content = trailingWhitespace ? source.slice(0, -trailingWhitespace.length) : source
  return content.endsWith('。') ? `${content.slice(0, -1)}${trailingWhitespace}` : source
}
function characterLength(value: string) {
  return Array.from(value.replace(/[\s。！？!?；;，,、：:“”‘’"'「」『』（）()【】〔〕［］《》〈〉]+$/gu, '').replace(/\s/g, '')).length
}

function rebalanceShortFinalPage(pages: readonly string[], maxWidthPx: number, measure: (value: string) => number) {
  if (pages.length < 2) return pages
  const previous = pages[pages.length - 2]!
  const last = pages[pages.length - 1]!
  const lastLength = characterLength(last)
  const targetLength = 3
  if (lastLength < 1 || lastLength >= targetLength) return pages

  const transferCount = targetLength - lastLength
  const previousCharacters = Array.from(previous)
  let start = previousCharacters.length
  let movedLength = 0
  while (start > 0 && movedLength < transferCount) {
    start -= 1
    const character = previousCharacters[start]!
    movedLength += character.trim() && !/[\p{P}\p{S}]/u.test(character) ? 1 : 0
  }
  // Move a literal suffix, including punctuation in its original place.
  // If balancing cannot keep both pages readable and within width, retain the
  // short tail rather than move punctuation across the characters it follows.
  const moved = previousCharacters.slice(start).join('')
  const balancedPrevious = previousCharacters.slice(0, start).join('')
  const balancedLast = `${moved}${last}`
  if (characterLength(balancedPrevious) < targetLength
    || characterLength(balancedLast) < targetLength
    || Array.from(balancedPrevious.replace(/\s/gu, '')).length < targetLength
    || measure(balancedPrevious) > maxWidthPx
    || measure(balancedLast) > maxWidthPx) return pages

  return [...pages.slice(0, -2), balancedPrevious, balancedLast]
}

/** Preserve punctuation while keeping short vocatives and particles attached. */
export function splitMainlineInteractionText(text: string): readonly string[] {
  const displayText = mainlineDisplaySourceText(text)
  const clauses: string[] = []
  let buffer = ''
  for (const character of displayText) {
    buffer += character
    if (character === '\n' || strongBoundaries.has(character) || weakBoundaries.has(character)) {
      if (buffer) clauses.push(buffer)
      buffer = ''
    }
  }
  if (buffer) clauses.push(buffer)
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
  return segments.length ? segments : [displayText]
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
  const displayText = mainlineDisplaySourceText(text)
  if (measure(displayText) <= maxWidthPx) return [displayText]
  const characters = Array.from(displayText)
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
  return output.length ? rebalanceShortFinalPage(output, maxWidthPx, measure) : [displayText]
}
