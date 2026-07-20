import { THEME_LAB_THEMES, themeKeyFromPosition, themeLabelFromPosition } from '../../theme/themeLabModel'

function ThemeLabToolbar({
  themePosition,
  motionMode,
  systemReducedMotion,
  onThemePosition,
  onMotionToggle,
  onReplay,
}) {
  const activeKey = themeKeyFromPosition(themePosition)

  return (
    <header className="lab-toolbar">
      <div className="lab-toolbar-lead">
        <span className="lab-toolbar-name">NewTone 场景实验室</span>
        <span className="lab-toolbar-note">此页仅用于视觉验收,不属于正式产品导航</span>
      </div>
      <div className="lab-toolbar-controls">
        <div className="lab-theme-switch" role="radiogroup" aria-label="主题">
          {THEME_LAB_THEMES.map(theme => (
            <button
              key={theme.key}
              type="button"
              role="radio"
              aria-checked={activeKey === theme.key}
              className={`lab-chip${activeKey === theme.key ? ' is-active' : ''}`}
              onClick={() => onThemePosition(theme.position)}
            >{theme.label}</button>
          ))}
        </div>
        <button
          type="button"
          className={`lab-chip lab-motion-toggle${motionMode === 'reduced' ? ' is-active' : ''}`}
          aria-pressed={motionMode === 'reduced'}
          onClick={onMotionToggle}
        >{motionMode === 'full' ? '动态完整' : '动态减弱'}</button>
        <button type="button" className="lab-chip lab-replay-all" onClick={onReplay}>重播动效</button>
        <span className="lab-toolbar-state" role="status">
          当前 token 主题:{themeLabelFromPosition(themePosition)}
          {systemReducedMotion ? '(系统要求减弱动态)' : ''}
        </span>
      </div>
    </header>
  )
}

export default ThemeLabToolbar
