import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  commitRingPosition,
  isThemeLabEnabled,
  resolveEffectiveMotion,
  ringStepPosition,
  THEME_LAB_THEMES,
  themeKeyFromPosition,
  themeLabelFromPosition,
} from '../src/theme/themeLabModel'
import { THEME_NODES } from '../src/reader/readerTheme'
import { useProgressStore } from '../src/stores/progressStore'
import ThemeLab from '../src/views/ThemeLab'

const semanticCss = readFileSync(new URL('../src/styles/themeSemantic.css', import.meta.url), 'utf8')

beforeEach(() => {
  useProgressStore.getState().reset()
})

describe('theme lab entry', () => {
  it('activates only from the explicit query parameter', () => {
    expect(isThemeLabEnabled('?theme-lab=1')).toBe(true)
    expect(isThemeLabEnabled('?foo=1&theme-lab=1')).toBe(true)
    expect(isThemeLabEnabled('?theme-lab')).toBe(true)
    expect(isThemeLabEnabled('?theme-lab=0')).toBe(false)
    expect(isThemeLabEnabled('')).toBe(false)
    expect(isThemeLabEnabled('?themelab=1')).toBe(false)
  })

  it('does not pollute the official currentView when entering or rendering', () => {
    expect(useProgressStore.getState().currentView).toBe('landing')
    isThemeLabEnabled('?theme-lab=1')
    renderToStaticMarkup(createElement(ThemeLab))
    expect(useProgressStore.getState().currentView).toBe('landing')
  })
})

describe('theme lab theme switching', () => {
  it('maps the three theme buttons onto the existing themePosition scale', () => {
    expect(THEME_LAB_THEMES.map(theme => theme.position)).toEqual([0, 0.5, 1])
    expect(THEME_LAB_THEMES.map(theme => theme.label)).toEqual(['明亮', '柔和', '夜间'])

    const { setThemePosition } = useProgressStore.getState()
    setThemePosition(0)
    expect(useProgressStore.getState().themePosition).toBe(0)
    expect(useProgressStore.getState().standardTheme).toBe('light')
    setThemePosition(1)
    expect(useProgressStore.getState().themePosition).toBe(1)
    expect(useProgressStore.getState().standardTheme).toBe('dark')
  })

  it('derives the data attribute and display name from themePosition', () => {
    expect(themeKeyFromPosition(0)).toBe('light')
    expect(themeKeyFromPosition(0.5)).toBe('soft')
    expect(themeKeyFromPosition(1)).toBe('dark')
    expect(themeLabelFromPosition(0.9)).toBe('夜间')

    // renderToStaticMarkup 走 zustand 的 getInitialState,
    // 因此这里只断言属性存在;位置→主题键的映射由上面的纯函数断言覆盖。
    const html = renderToStaticMarkup(createElement(ThemeLab))
    expect(html).toMatch(/data-nt-theme="(light|soft|dark)"/)
  })

  it('defines the scene-lab semantic core for all three themes', () => {
    const requiredTokens = [
      '--surface-world', '--surface-float', '--surface-interactive',
      '--text-body', '--text-support', '--text-interactive', '--text-scene-emphasis',
      '--focus-ring', '--accent', '--state-warning',
    ]
    for (const themeKey of ['light', 'soft', 'dark']) {
      const start = semanticCss.indexOf(`[data-nt-theme='${themeKey}']`)
      expect(start).toBeGreaterThan(-1)
      const block = semanticCss.slice(start, semanticCss.indexOf('}', start))
      for (const token of requiredTokens) {
        expect(block, `${themeKey} 缺少 ${token}`).toContain(`${token}:`)
      }
    }
  })

  it('merges page and paper into the single world surface', () => {
    expect(semanticCss).toContain('--surface-page: var(--surface-world)')
    expect(semanticCss).toContain('--surface-paper: var(--surface-world)')
    expect(semanticCss).toContain('--surface-hover: var(--surface-interactive)')
  })
})

describe('theme lab motion mode', () => {
  it('reuses the existing motionMode via toggleMotionMode', () => {
    expect(useProgressStore.getState().motionMode).toBe('full')
    useProgressStore.getState().toggleMotionMode()
    expect(useProgressStore.getState().motionMode).toBe('reduced')
    useProgressStore.getState().toggleMotionMode()
    expect(useProgressStore.getState().motionMode).toBe('full')
  })

  it('reduces whenever either the store or the system asks for it', () => {
    expect(resolveEffectiveMotion('full', false)).toBe('full')
    expect(resolveEffectiveMotion('full', true)).toBe('reduced')
    expect(resolveEffectiveMotion('reduced', false)).toBe('reduced')
    expect(resolveEffectiveMotion('reduced', true)).toBe('reduced')
  })
})

describe('ring slider positions', () => {
  it('only allows the three nodes in reduced motion', () => {
    for (let value = 0; value <= 1.0001; value += 0.07) {
      expect(THEME_NODES).toContain(commitRingPosition(value, 'reduced'))
    }
    expect(commitRingPosition(0.2, 'reduced')).toBe(0)
    expect(commitRingPosition(0.4, 'reduced')).toBe(0.5)
    expect(commitRingPosition(0.9, 'reduced')).toBe(1)
  })

  it('keeps continuous values with node magnetism in full motion', () => {
    expect(commitRingPosition(0.37, 'full')).toBe(0.37)
    expect(commitRingPosition(0.51, 'full')).toBe(0.5)
    expect(commitRingPosition(0.99, 'full')).toBe(1)
  })

  it('steps by node in reduced motion and by small increments in full motion', () => {
    expect(ringStepPosition(0, 1, 'reduced')).toBe(0.5)
    expect(ringStepPosition(0.5, 1, 'reduced')).toBe(1)
    expect(ringStepPosition(1, 1, 'reduced')).toBe(1)
    expect(ringStepPosition(0.5, -1, 'reduced')).toBe(0)
    expect(ringStepPosition(0.2, 1, 'full')).toBeCloseTo(0.25, 10)
    expect(ringStepPosition(0.2, -1, 'full')).toBeCloseTo(0.15, 10)
  })
})

describe('theme lab isolation', () => {
  it('leaves language, reading progress, and center unlock untouched', () => {
    const before = useProgressStore.getState()
    const snapshot = {
      language: before.language,
      committedLocation: { ...before.committedLocation },
      furthestLocation: { ...before.furthestLocation },
      readerCompleted: before.readerCompleted,
      centerUnlocked: before.centerUnlocked,
      centerMode: before.centerMode,
      currentView: before.currentView,
      readingMode: before.readingMode,
    }

    useProgressStore.getState().setThemePosition(0)
    useProgressStore.getState().toggleMotionMode()
    useProgressStore.getState().setThemePosition(1)
    renderToStaticMarkup(createElement(ThemeLab))

    const after = useProgressStore.getState()
    expect(after.language).toBe(snapshot.language)
    expect(after.committedLocation).toEqual(snapshot.committedLocation)
    expect(after.furthestLocation).toEqual(snapshot.furthestLocation)
    expect(after.readerCompleted).toBe(snapshot.readerCompleted)
    expect(after.centerUnlocked).toBe(snapshot.centerUnlocked)
    expect(after.centerMode).toBe(snapshot.centerMode)
    expect(after.currentView).toBe(snapshot.currentView)
    expect(after.readingMode).toBe(snapshot.readingMode)
  })
})

describe('scene lab structure', () => {
  it('renders one continuous scene instead of a sample museum', () => {
    const html = renderToStaticMarkup(createElement(ThemeLab))
    // 场景主体
    expect(html).toContain('lab-scene')
    expect(html).toContain('lab-scene-emphasis')
    expect(html).toContain('lab-body-text')
    expect(html).toContain('lab-support-text')
    expect(html).toContain('lab-word-interactive')
    expect(html).toContain('lab-stack-warning')
    // 工具与滑块
    expect(html).toContain('此页仅用于视觉验收')
    expect(html).toContain('>明亮<')
    expect(html).toContain('>柔和<')
    expect(html).toContain('>夜间<')
    expect(html).toContain('动态完整')
    expect(html).toContain('重播动效')
    expect(html).toContain('role="slider"')
    expect(html).toContain('lab-ring-thumb')
    // 四类动效与故障限制
    expect(html).toContain('lab-anim--fade')
    expect(html).toContain('lab-anim--write')
    expect(html).toContain('lab-anim--glitch')
    expect(html).toContain('lab-anim--drawout')
    expect(html).toContain('只用于异常、里世界、数据矛盾、编码或语言重构')
  })

  it('drops the showcase blocks: state matrix, line board, paper cards, chapter titles', () => {
    const html = renderToStaticMarkup(createElement(ThemeLab))
    expect(html).not.toContain('lab-state-table')
    expect(html).not.toContain('lab-line-grid')
    expect(html).not.toContain('lab-demo-btn')
    expect(html).not.toContain('lab-paper-card')
    expect(html).not.toContain('lab-note-list')
    expect(html).not.toContain('第七封信')
    expect(html).not.toContain('lab-type-title-sample')
  })
})
