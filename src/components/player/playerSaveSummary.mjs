// Small presentation lookup; do not load the world geometry bundle just for a save card.
const scenes = {
  'commercial-street': ['商业街', 'Commercial street'],
  'commercial-cafe': ['商业街咖啡馆', 'Commercial street cafe'],
  'jijia-ancestral-home': ['姬家祖宅', 'Ji ancestral home'],
  'jijia-ancestral-interior': ['姬家祖宅内堂', 'Ji ancestral home interior'],
  'yonghe-mining-perimeter': ['永和矿区外围', 'Yonghe mining perimeter'],
  'yonghe-eatery': ['永和食堂', 'Yonghe eatery'],
  'zhongshuyuan-passage': ['中枢院窄暗道', 'Zhongshuyuan passage'],
  'zhongshuyuan-office': ['中枢院内部楼层', 'Zhongshuyuan office'],
}
const backupKinds = {
  'cloud-before-replace': ['替换前的云端版本', 'Cloud version before replacement'],
  'local-not-chosen': ['未采用的本地版本', 'Unselected local version'],
  'cloud-conflict-snapshot': ['冲突时保留的云端版本', 'Cloud version retained during conflict'],
  'local-conflict-snapshot': ['冲突时保留的本地版本', 'Local version retained during conflict'],
}
const text = value => typeof value === 'string' && value.trim() ? value.trim().slice(0, 240) : null
const int = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const pad = value => String(value).padStart(2, '0')
function timestamp(value, language) {
  if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)
    && !(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && value.length < 64)) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
  }).format(date) + ' UTC'
}

/** Allowlisted display fields only. Never stringify payloads, fingerprints or session metadata. */
export function formatPlayerSaveSummary(summary, { language = 'zh', sourceLabel } = {}) {
  const en = language === 'en', index = en ? 1 : 0, lines = []
  if (text(sourceLabel)) lines.push(text(sourceLabel))
  if (typeof summary === 'string') {
    if (text(summary)) lines.push(text(summary))
  } else if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
    const scene = text(summary.currentSceneId)
    if (scene) lines.push(`${en ? 'Location' : '位置'}：${Object.hasOwn(scenes, scene) ? scenes[scene][index] : scene}`)
    const clock = summary.storyClock
    if (clock && typeof clock === 'object') {
      if (int(clock.year, 1, 9999) && int(clock.month, 1, 12) && int(clock.day, 1, 31)) {
        const date = new Date(0); date.setUTCFullYear(clock.year, clock.month - 1, clock.day)
        if (date.getUTCMonth() === clock.month - 1 && date.getUTCDate() === clock.day) {
          lines.push(en ? `Story date: ${String(clock.year).padStart(4, '0')}-${pad(clock.month)}-${pad(clock.day)}` : `故事日期：${clock.year}年${clock.month}月${clock.day}日`)
        }
      }
    }
    let hour, minute
    if (typeof summary.gameTimeMs === 'number' && Number.isFinite(summary.gameTimeMs) && summary.gameTimeMs >= 0) {
      const minutes = Math.floor(summary.gameTimeMs / 60000) % 1440
      hour = Math.floor(minutes / 60); minute = minutes % 60
    } else if (int(clock?.hour, 0, 23) && int(clock?.minute, 0, 59)) { hour = clock.hour; minute = clock.minute }
    if (hour !== undefined) lines.push(`${en ? 'Story time: ' : '故事时间：'}${pad(hour)}:${pad(minute)}`)
    if (Number.isSafeInteger(summary.localRevision) && summary.localRevision >= 0) lines.push(`${en ? 'Save revision: ' : '存档修订：'}${summary.localRevision}`)
    if (text(summary.kind)) lines.push(`${en ? 'Backup: ' : '备份类型：'}${Object.hasOwn(backupKinds, summary.kind) ? backupKinds[summary.kind][index] : (en ? 'Other saved version' : '其他保留版本')}`)
    const recordedAt = timestamp(summary.createdAt ?? summary.updatedAt, language)
    if (recordedAt) lines.push(`${en ? 'Recorded: ' : '记录时间：'}${recordedAt}`)
  }
  return lines.length ? lines.join('\n') : (en ? 'Progress summary unavailable' : '暂无进度摘要')
}
