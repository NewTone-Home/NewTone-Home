import {
  clampThemePosition,
  legacyThemeName,
  magnetizeThemePosition,
  nearestThemeNode,
  THEME_LABELS,
  THEME_NODES,
} from '../reader/readerTheme'

export const THEME_LAB_QUERY_KEY = 'theme-lab'

export const THEME_LAB_THEMES = Object.freeze([
  Object.freeze({ key: 'light', label: THEME_LABELS[0], position: 0 }),
  Object.freeze({ key: 'soft', label: THEME_LABELS[0.5], position: 0.5 }),
  Object.freeze({ key: 'dark', label: THEME_LABELS[1], position: 1 }),
])

export function isThemeLabEnabled(search) {
  try {
    const value = new URLSearchParams(search).get(THEME_LAB_QUERY_KEY)
    return value !== null && value !== '0'
  } catch {
    return false
  }
}

export function themeKeyFromPosition(position) {
  return legacyThemeName(position)
}

export function themeLabelFromPosition(position) {
  return THEME_LABELS[nearestThemeNode(position)]
}

export function resolveEffectiveMotion(motionMode, systemReducedMotion) {
  return motionMode === 'reduced' || systemReducedMotion === true ? 'reduced' : 'full'
}

export function commitRingPosition(value, effectiveMotion) {
  const position = clampThemePosition(value)
  return effectiveMotion === 'reduced'
    ? nearestThemeNode(position)
    : magnetizeThemePosition(position)
}

export function ringStepPosition(value, direction, effectiveMotion, fullStep = 0.05) {
  const step = direction >= 0 ? 1 : -1
  if (effectiveMotion !== 'reduced') {
    return magnetizeThemePosition(clampThemePosition(value) + step * fullStep)
  }
  const currentIndex = THEME_NODES.indexOf(nearestThemeNode(value))
  const nextIndex = Math.min(THEME_NODES.length - 1, Math.max(0, currentIndex + step))
  return THEME_NODES[nextIndex]
}
