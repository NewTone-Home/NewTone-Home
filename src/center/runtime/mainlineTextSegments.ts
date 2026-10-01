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
