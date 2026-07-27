import { shellCopy, t } from './shellCopy'

/**
 * 右栏：视口入口。
 * P0 只显示词条与解锁状态,不做路由 —— 只有“世界地图”是激活态,其余三项不可点。
 */
export function CenterModuleRail({ language }: { language: string }) {
  const modules = [
    { key: 'map', label: t(shellCopy.moduleMap, language), hint: null, active: true },
    { key: 'archive', label: t(shellCopy.moduleArchive, language), hint: t(shellCopy.lockedArchive, language), active: false },
    { key: 'codex', label: t(shellCopy.moduleCodex, language), hint: t(shellCopy.lockedCodex, language), active: false },
    { key: 'achievements', label: t(shellCopy.moduleAchievements, language), hint: t(shellCopy.lockedAchievements, language), active: false },
  ]

  return (
    <nav className="center-shell-rail center-shell-rail--modules" aria-label={t(shellCopy.moduleHeading, language)}>
      <p className="center-shell-rail-heading">{t(shellCopy.moduleHeading, language)}</p>
      <ul>
        {modules.map(item => (
          <li key={item.key} data-active={item.active ? 'true' : 'false'} aria-current={item.active ? 'page' : undefined}>
            <span>{item.label}</span>
            {item.hint && <small>{item.hint}</small>}
          </li>
        ))}
      </ul>
    </nav>
  )
}
