const segmentBoundaries = new Set(Array.from('，。？！；：、,!?;:'))
const closingMarks = new Set(Array.from('”’\"\'」』）)】〕］》〉'))

/** Hide only the current segment's boundary, keeping its closing marks intact. */
export function mainlineVisiblePresentationText(source: string) {
  const characters = Array.from(source)
  let end = characters.length
  while (end > 0 && /\s/u.test(characters[end - 1]!)) end -= 1
  let boundary = end
  while (boundary > 0 && (segmentBoundaries.has(characters[boundary - 1]!) || closingMarks.has(characters[boundary - 1]!))) boundary -= 1
  return characters.slice(0, boundary).join('')
    + characters.slice(boundary, end).filter(character => !segmentBoundaries.has(character)).join('')
    + characters.slice(end).join('')
}

/** Compatibility name for callers presenting dialogue segments. */
export const dialoguePresentationText = mainlineVisiblePresentationText
