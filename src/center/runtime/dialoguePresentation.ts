/** Keep authored dialogue intact while removing punctuation from its visual presentation. */
export function dialoguePresentationText(source: string) {
  return source.replace(/[，。？！；：“”‘’]/g, '')
}
