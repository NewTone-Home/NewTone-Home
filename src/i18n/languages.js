export const READER_LANGUAGES = Object.freeze([
  Object.freeze({ code: 'zh', label: '中文', mark: '中文' }),
  Object.freeze({ code: 'en', label: 'English', mark: 'EN' }),
])

export const READER_LANGUAGE_CODES = Object.freeze(READER_LANGUAGES.map(language => language.code))

export function getReaderLanguage(code) {
  return READER_LANGUAGES.find(language => language.code === code) ?? READER_LANGUAGES[0]
}

export function getNextReaderLanguage(code) {
  const currentIndex = READER_LANGUAGES.findIndex(language => language.code === code)
  return READER_LANGUAGES[(currentIndex + 1 + READER_LANGUAGES.length) % READER_LANGUAGES.length]
}

export function detectBrowserReaderLanguage(browserLanguages = []) {
  for (const candidate of browserLanguages) {
    const code = String(candidate || '').slice(0, 2).toLowerCase()
    if (READER_LANGUAGE_CODES.includes(code)) return code
  }
  return 'zh'
}
