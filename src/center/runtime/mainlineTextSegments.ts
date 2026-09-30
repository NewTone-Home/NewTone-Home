const strongBoundaries = new Set(['。', '！', '!', '？', '?', '；', ';'])
const weakBoundaries = new Set(['，', ',', '、', '：', ':'])
const closingMarks = new Set(['”', '’', '"', "'", '」', '』', '）', ')', '】', '〕', '］', '》', '〉'])

export const mainlineTextSegmentMinClauseLength = 6
export const mainlineTextSegmentPreferredLength = 22
export const mainlineTextSegmentMaximumLength = 24

function normalized(value: string) { return value.replace(/\s+/g, ' ').trim() }
function characterLength(value: string) { return Array.from(value.replace(/\s/g, '')).length }

function splitLongSegment(value: string) {
  const source = normalized(value)
  if (characterLength(source) <= mainlineTextSegmentMaximumLength) return [source]
  const result: string[] = []
  const characters = Array.from(source)
  let start = 0
  while (characters.length - start > mainlineTextSegmentMaximumLength) {
    const maximumEnd = start + mainlineTextSegmentMaximumLength
    let splitAt = -1
    for (let index = maximumEnd - 1; index >= start + mainlineTextSegmentMinClauseLength - 1; index -= 1) {
      if (weakBoundaries.has(characters[index]) || strongBoundaries.has(characters[index])) {
        splitAt = index + 1
        break
      }
    }
    const end = splitAt > start ? splitAt : maximumEnd
    result.push(normalized(characters.slice(start, end).join('')))
    start = end
  }
  const remainder = normalized(characters.slice(start).join(''))
  if (remainder) result.push(remainder)
  return result
}

/** Preserve punctuation while keeping short vocatives and particles attached. */
export function splitMainlineInteractionText(text: string): readonly string[] {
  const clauses: string[] = []
  let buffer = ''
  for (const character of text.replace(/\r\n?/g, '\n')) {
    buffer += character
    if (character === '\n' || strongBoundaries.has(character)) {
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
  const segments = merged.flatMap(splitLongSegment).reduce<string[]>((result, segment) => {
    if (segment.length === 1 && closingMarks.has(segment) && result.length > 0) result[result.length - 1] += segment
    else result.push(segment)
    return result
  }, [])
  return segments.length ? segments : [normalized(text)]
}

export function longestMainlineInteractionSegment(text: string) {
  return splitMainlineInteractionText(text).reduce((longest, segment) => (
    Array.from(segment).length > Array.from(longest).length ? segment : longest
  ), '')
}
