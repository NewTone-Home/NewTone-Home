import { resolveDisplayedReaderLanguage } from '../i18n/languages.js'
import { copy } from '../i18n/copy.js'
const valid = {
  language: v => ['zh', 'en'].includes(v),
  hasInitializedLanguage: v => typeof v === 'boolean',
  hasInitializedReadingMode: v => typeof v === 'boolean',
  readingMode: v => v === 'standard',
  themePosition: v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1,
  standardTheme: v => ['soft', 'light', 'dark'].includes(v),
  motionMode: v => ['full', 'reduced'].includes(v),
}
export function entryPreferences(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => valid[key]?.(item)))
}
const messages = {
  zh: { create: '开始', continue: '继续', replaceRequest: '新档', confirm: '确认', cancel: '取消', back: '返回', reinspect: '重新检查', resolve: '核实结果', overwrite: '新档将覆盖当前游戏进度，确定继续吗？', probing: '正在检查存档…', committing: '正在准备游戏，请稍候…', entering: '正在进入游戏…', uncertain: '操作结果尚未确定，请先核实结果。', unknown: '暂时无法安全读取这份存档。原始数据已保留，可返回或重新检查。', failed: '暂时无法进入游戏。请重新检查存档状态。' },
  en: { create: 'Start', continue: 'Continue', replaceRequest: 'New game', confirm: 'Confirm', cancel: 'Cancel', back: 'Back', reinspect: 'Check again', resolve: 'Check result', overwrite: 'A new game will replace your current progress. Continue?', probing: 'Checking your save…', committing: 'Preparing your game. Please wait…', entering: 'Entering the game…', uncertain: 'The operation result is not yet known. Please check it first.', unknown: 'This save cannot be read safely yet. The original data is preserved. Go back or check again.', failed: 'The game cannot be opened right now. Please check the save state again.' },
}
export function entryPresentation(preferences, browserLanguages = []) {
  const { language } = resolveDisplayedReaderLanguage({ ...preferences, browserLanguages })
  return { language, text: { ...messages[language], updates: copy[language].updates, runtimeStopped: language === 'en' ? 'The game was stopped to protect your save. You can go back or check the save state again.' : '为保护存档，游戏已停止。你可以返回，或重新检查存档状态。', recoveryActions: language === 'en' ? 'Save recovery actions' : '存档恢复操作' } }
}

// Unknown/invalid is not the same as a valid first-use record.
export function landingIntroState(preview) {
  if (preview?.status === 'learned' && preview.learned === true) return 'learned'
  if (preview?.status === 'not-learned' && preview.learned === false) return 'not-learned'
  return 'unknown'
}

export function entryWarningMessages(codes, language) {
  if (!codes?.includes('LAO_ZHOU_TRIGGER_UNKNOWN')) return []
  return [language === 'en'
    ? 'We couldn’t confirm whether you’ve already spoken with Lao Zhou, so the opening message won’t appear for now. You can continue playing.'
    : '暂时无法确认你是否已经和老周聊过，开场短信暂不弹出。其他游戏进度可以正常继续。']
}
export function currentEntryWarnings(state) {
  return state.warningSource === 'committed' ? state.committedWarnings
    : state.warningSource === 'operation' ? state.operationWarnings : state.inspectionWarnings
}
