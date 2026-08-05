export const THEME_NODES = Object.freeze([0, 0.5, 1])

export const THEME_LABELS = Object.freeze({
  0: '明亮',
  0.5: '柔和',
  1: '夜间',
})

const LEGACY_THEME_POSITIONS = Object.freeze({ light: 0, soft: 0.5, dark: 1 })

const THEME_ANCHORS = Object.freeze([
  {
    position: 0,
    paper: [245, 241, 232],
    ink: [41, 39, 34],
    muted: [113, 109, 101],
    control: [91, 84, 74],
    border: [185, 176, 162],
    surface: [238, 232, 220],
    line: [91, 77, 62],
  },
  {
    position: 0.5,
    paper: [233, 225, 211],
    ink: [48, 44, 39],
    muted: [117, 109, 98],
    control: [96, 87, 75],
    border: [171, 159, 142],
    surface: [224, 214, 197],
    line: [91, 77, 62],
  },
  {
    position: 1,
    paper: [25, 24, 23],
    ink: [238, 233, 223],
    muted: [161, 154, 143],
    control: [200, 189, 169],
    border: [79, 75, 69],
    surface: [39, 37, 34],
    line: [200, 189, 169],
  },
])

export function clampThemePosition(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0.5
}

export function migrateThemePosition(value, legacyTheme) {
  if (typeof value === 'number' && Number.isFinite(value)) return clampThemePosition(value)
  if (typeof value === 'string' && value in LEGACY_THEME_POSITIONS) return LEGACY_THEME_POSITIONS[value]
  if (typeof legacyTheme === 'string' && legacyTheme in LEGACY_THEME_POSITIONS) return LEGACY_THEME_POSITIONS[legacyTheme]
  return 0.5
}

export function nearestThemeNode(value) {
  const position = clampThemePosition(value)
  return THEME_NODES.reduce((nearest, node) => (
    Math.abs(node - position) < Math.abs(nearest - position) ? node : nearest
  ), THEME_NODES[0])
}

export function magnetizeThemePosition(value, threshold = 0.035) {
  const position = clampThemePosition(value)
  const node = nearestThemeNode(position)
  return Math.abs(node - position) <= threshold ? node : position
}

export function themePositionFromPointer(clientY, trackRect, thumbSize) {
  const thumbRadius = Math.max(0, Number(thumbSize) || 0) / 2
  const usableTop = Number(trackRect?.top) + thumbRadius
  const usableBottom = Number(trackRect?.bottom) - thumbRadius
  const usableHeight = usableBottom - usableTop
  if (!Number.isFinite(usableHeight) || usableHeight <= 0) return 0.5
  return clampThemePosition((Number(clientY) - usableTop) / usableHeight)
}

export function themePositionFromPointerX(clientX, trackRect, thumbSize) {
  const thumbRadius = Math.max(0, Number(thumbSize) || 0) / 2
  const usableLeft = Number(trackRect?.left) + thumbRadius
  const usableRight = Number(trackRect?.right) - thumbRadius
  const usableWidth = usableRight - usableLeft
  if (!Number.isFinite(usableWidth) || usableWidth <= 0) return 0.5
  return clampThemePosition((Number(clientX) - usableLeft) / usableWidth)
}

export function themePositionForWheel(value, deltaY, motionMode, fullStep = 0.04) {
  const direction = deltaY > 0 ? 1 : -1
  if (motionMode === 'full') {
    return magnetizeThemePosition(clampThemePosition(value) + direction * fullStep)
  }
  const currentIndex = THEME_NODES.indexOf(nearestThemeNode(value))
  const nextIndex = Math.min(THEME_NODES.length - 1, Math.max(0, currentIndex + direction))
  return THEME_NODES[nextIndex]
}

export function themeName(value) {
  const position = clampThemePosition(value)
  const node = nearestThemeNode(position)
  return Math.abs(node - position) <= 0.000001 ? THEME_LABELS[node] : ''
}

export function legacyThemeName(value) {
  const node = nearestThemeNode(value)
  if (node === 0) return 'light'
  if (node === 1) return 'dark'
  return 'soft'
}

function interpolateChannel(from, to, progress) {
  return Math.round(from + (to - from) * progress)
}

function interpolateColor(from, to, progress) {
  return `rgb(${from.map((channel, index) => interpolateChannel(channel, to[index], progress)).join(', ')})`
}

export function getReaderThemeVariables(value) {
  const position = clampThemePosition(value)
  const [from, to] = position <= 0.5 ? THEME_ANCHORS : THEME_ANCHORS.slice(1)
  const span = to.position - from.position
  const progress = span === 0 ? 0 : (position - from.position) / span

  return {
    '--reader-paper': interpolateColor(from.paper, to.paper, progress),
    '--reader-ink': interpolateColor(from.ink, to.ink, progress),
    '--reader-muted': interpolateColor(from.muted, to.muted, progress),
    '--reader-control': interpolateColor(from.control, to.control, progress),
    '--reader-border': interpolateColor(from.border, to.border, progress),
    '--reader-surface': interpolateColor(from.surface, to.surface, progress),
    '--reader-line-rgb': from.line.map((channel, index) => interpolateChannel(channel, to.line[index], progress)).join(', '),
  }
}
