// Reader 工具区专用的语言视觉短标记。仅影响显示，
// 不改变语言数据、翻译内容或持久化范围；未公开的语言
// （不在 READER_LANGUAGES 中）不会因存在映射而进入界面。
export const LANGUAGE_MARKS = Object.freeze({
  zh: '中',
  en: 'EN',
  ja: '日',
  ko: '한',
  fr: 'FR',
  es: 'ES',
  id: 'ID',
})

export function getLanguageMark(code) {
  return LANGUAGE_MARKS[code] || String(code).toUpperCase()
}
