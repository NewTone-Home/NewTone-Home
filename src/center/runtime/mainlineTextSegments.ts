const SEGMENT_BOUNDARIES = new Set([
  '，', ',', '、',
  '。', '.', '！', '!', '？', '?',
  '；', ';', '：', ':',
  '…',
])

const CLOSING_MARKS = new Set(['”', '’', '"', "'", '」', '』', '）', ')', '】', '〕', '］', '》', '〉'])

function pushSegment(segments: string[], value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized) segments.push(normalized)
}

/**
 * Split one Center interaction into deliberate, one-line display units.
 * Commas are control punctuation only and are intentionally omitted from the
 * rendered unit. Sentence-ending punctuation remains part of the visible
 * unit so the copy keeps its authored cadence.
 */
export function splitMainlineInteractionText(text: string): readonly string[] {
  const segments: string[] = []
  let buffer = ''

  for (const character of text.replace(/\r\n?/g, '\n')) {
    if (character === '\n') {
      pushSegment(segments, buffer)
      buffer = ''
      continue
    }
    if (!SEGMENT_BOUNDARIES.has(character)) {
      buffer += character
      continue
    }

    if (character === '，' || character === ',') {
      pushSegment(segments, buffer)
    }
    else {
      pushSegment(segments, `${buffer}${character}`)
    }
    buffer = ''
  }

  pushSegment(segments, buffer)

  if (segments.length === 0) return [text.trim()]

  // Keep a closing quote/bracket with the segment it closes instead of
  // creating a one-character display unit.
  return segments.reduce<string[]>((result, segment) => {
    if (segment.length === 1 && CLOSING_MARKS.has(segment) && result.length > 0) {
      result[result.length - 1] += segment
    }
    else result.push(segment)
    return result
  }, [])
}

export function longestMainlineInteractionSegment(text: string) {
  return splitMainlineInteractionText(text).reduce((longest, segment) => (
    Array.from(segment).length > Array.from(longest).length ? segment : longest
  ), '')
}
