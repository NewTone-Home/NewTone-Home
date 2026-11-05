const sentenceEndings = new Set(['。', '！', '？', '!', '?', '…'])
const closingMarks = new Set(['”', '’', '」', '』', '》', '〉', '】', '〕', '］', '）', '｝', ')', ']', '}', '"', "'"])

/** Split display units at sentence endings while preserving every source character. */
export function mainlineDialogueSentenceFragments(source: string): readonly string[] {
  if (!source) return []
  const characters = Array.from(source)
  const fragments: string[] = []
  let fragmentStart = 0
  let index = 0

  while (index < characters.length) {
    const character = characters[index]!
    if (!sentenceEndings.has(character) && character !== '.') {
      index += 1
      continue
    }

    let endingEnd = index + 1
    if (character === '.') {
      if (/\p{N}/u.test(characters[index - 1] ?? '') && /\p{N}/u.test(characters[index + 1] ?? '')) {
        index += 1
        continue
      }
      while (characters[endingEnd] === '.') endingEnd += 1
      if (endingEnd - index < 3 && endingEnd === index + 1) {
        // A single decimal-safe Latin period can still end an ordinary sentence.
      } else if (endingEnd - index < 3) {
        index = endingEnd
        continue
      }
    } else if (character === '…') {
      while (characters[endingEnd] === '…') endingEnd += 1
    } else if (character === '!' || character === '?' || character === '！' || character === '？') {
      while (['!', '?', '！', '？'].includes(characters[endingEnd] ?? '')) endingEnd += 1
    }

    while (closingMarks.has(characters[endingEnd] ?? '')) endingEnd += 1
    let fragmentEnd = endingEnd
    while (/\s/u.test(characters[fragmentEnd] ?? '')) fragmentEnd += 1
    if (fragmentEnd < characters.length) {
      fragments.push(characters.slice(fragmentStart, fragmentEnd).join(''))
      fragmentStart = fragmentEnd
    }
    index = fragmentEnd
  }

  if (fragmentStart < characters.length) fragments.push(characters.slice(fragmentStart).join(''))
  return fragments.length ? fragments : [source]
}
