import type { CenterLocalizedText } from '../domain/contracts'
import { getLocalizedCenterText } from '../content/defaultCenterDefinition'

/**
 * Shell 自己的界面文案。
 *
 * 复用 CenterLocalizedText 与 getLocalizedCenterText，不新开一套 i18n；
 * 未覆盖的语种按既有约定回落到中文。
 */
function text(zh: string, en: string): CenterLocalizedText {
  return { zh, en, ja: zh, ko: zh, fr: en }
}

export const shellCopy = {
  breadcrumbMap: text('城市地图', 'City Map'),

  readStateHeading: text('阅读状态', 'Reading State'),
  labelPlace: text('当前所在地', 'Current Place'),
  labelProgress: text('阅读进度', 'Progress'),
  labelFurthest: text('最远抵达', 'Furthest Reached'),
  labelKnown: text('已知区域', 'Known Ground'),
  labelStoryTime: text('故事内时间', 'Story Time'),
  labelCharacter: text('人物状态', 'Character'),

  valueUnknownPlace: text('尚未落地', 'not yet arrived'),
  valueUnknownProgress: text('尚未开卷', 'not yet begun'),
  valueTimeMissing: text('时间尚未显现', 'time has not yet surfaced'),
  valueCharacterMissing: text('人物状态尚未收录', 'character state not yet recorded'),
  valueKnownNone: text('尚未展开', 'nothing charted yet'),

  moduleHeading: text('世界', 'World'),
  moduleMap: text('世界地图', 'World Map'),
  moduleArchive: text('档案', 'Archive'),
  moduleCodex: text('人物图鉴', 'Codex'),
  moduleAchievements: text('成就', 'Marks'),

  lockedArchive: text('随阅读展开', 'unfolds as you read'),
  lockedCodex: text('遇见之后收录', 'recorded once met'),
  lockedAchievements: text('留待日后', 'left for later'),
} as const

export function t(entry: CenterLocalizedText, language: string): string {
  return getLocalizedCenterText(entry, language)
}

const ZH_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/** 十以内用中文数字，超出或非中文语种用阿拉伯数字。 */
export function numeral(value: number, language: string): string {
  if (language !== 'zh' && language !== 'ja' && language !== 'ko') return String(value)
  return value >= 0 && value <= 10 ? ZH_DIGITS[value] : String(value)
}

/** “第三节 · 共五节” / “section 3 of 5” —— 语义文本，不给百分比。 */
export function formatProgress(
  sectionOrdinal: number,
  sectionTotal: number,
  beatOrdinal: number,
  beatTotal: number,
  language: string,
): string | null {
  if (sectionOrdinal <= 0 || sectionTotal <= 0) return null
  if (language === 'zh' || language === 'ja' || language === 'ko') {
    const section = `第${numeral(sectionOrdinal, language)}节 · 共${numeral(sectionTotal, language)}节`
    if (beatTotal <= 0) return section
    return `${section}，第${numeral(beatOrdinal, language)}段`
  }
  const section = `section ${sectionOrdinal} of ${sectionTotal}`
  return beatTotal <= 0 ? section : `${section}, passage ${beatOrdinal}`
}

/** “已知三处 · 已至其二”。 */
export function formatKnown(knownCount: number, visitedCount: number, language: string): string | null {
  if (knownCount <= 0) return null
  if (language === 'zh' || language === 'ja' || language === 'ko') {
    const known = `已知${numeral(knownCount, language)}处`
    return visitedCount > 0 ? `${known} · 已至${numeral(visitedCount, language)}处` : known
  }
  const known = `${knownCount} charted`
  return visitedCount > 0 ? `${known} · ${visitedCount} visited` : known
}
