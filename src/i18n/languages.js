export const READER_LANGUAGES = Object.freeze([
  Object.freeze({ code: 'zh', label: '中文', mark: '中文' }),
  Object.freeze({ code: 'en', label: 'English', mark: 'EN' }),
])

export const READER_LANGUAGE_CODES = Object.freeze(READER_LANGUAGES.map(language => language.code))

function getSupportedBrowserReaderLanguage(browserLanguages = []) {
  for (const candidate of browserLanguages) {
    const code = String(candidate || '').slice(0, 2).toLowerCase()
    if (READER_LANGUAGE_CODES.includes(code)) return code
  }
  return null
}

export function getReaderLanguage(code) {
  return READER_LANGUAGES.find(language => language.code === code) ?? READER_LANGUAGES[0]
}

export function getNextReaderLanguage(code) {
  const currentIndex = READER_LANGUAGES.findIndex(language => language.code === code)
  return READER_LANGUAGES[(currentIndex + 1 + READER_LANGUAGES.length) % READER_LANGUAGES.length]
}

export function detectBrowserReaderLanguage(browserLanguages = []) {
  return getSupportedBrowserReaderLanguage(browserLanguages) ?? 'zh'
}

export function resolveDisplayedReaderLanguage({
  language,
  hasInitializedLanguage,
  browserLanguages = [],
}) {
  if (hasInitializedLanguage && READER_LANGUAGE_CODES.includes(language)) {
    return { language, source: 'user_selected' }
  }

  const browserLanguage = getSupportedBrowserReaderLanguage(browserLanguages)
  if (browserLanguage) return { language: browserLanguage, source: 'browser_default' }
  return { language: 'zh', source: 'product_default' }
}
