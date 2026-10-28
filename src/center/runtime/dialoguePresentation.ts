const closingMarks = new Set(Array.from('”’"\'」』）)】〕］》〉'))

/** Only a terminal Chinese full stop may be omitted from the display. */
export function mainlineVisiblePresentationText(source: string) {
  const characters = Array.from(source)
  let end = characters.length
  while (end > 0 && /\s/u.test(characters[end - 1]!)) end -= 1
  let boundary = end
  while (boundary > 0 && closingMarks.has(characters[boundary - 1]!)) boundary -= 1
  if (characters[boundary - 1] !== '。') return source
  return characters.slice(0, boundary - 1).join('') + characters.slice(boundary).join('')
}

/** Compatibility name for callers presenting dialogue segments. */
export const dialoguePresentationText = mainlineVisiblePresentationText
