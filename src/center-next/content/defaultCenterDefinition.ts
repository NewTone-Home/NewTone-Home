import type {
  CenterDefinition,
  CenterLanguageCode,
  CenterLocalizedText,
  ReaderPosition,
} from '../domain/contracts'

function localized(zh: string, en: string): CenterLocalizedText {
  return {
    zh,
    en,
    ja: zh,
    ko: zh,
    fr: en,
  }
}

function position(pageId: string, beatIndex = 0): ReaderPosition {
  return { phaseId: 'M1', pageId, beatIndex }
}

export const DEFAULT_CENTER_PACKAGE_ID = 'builtin:newtone-first-world'

export const defaultCenterDefinition: CenterDefinition = {
  schemaVersion: 1,
  id: DEFAULT_CENTER_PACKAGE_ID,
  title: localized('NewTone 世界中枢', 'NewTone World Center'),
  worldSize: { width: 1200, height: 800 },
  layers: {
    surface: {
      id: 'surface',
      defaultVariant: 'surface-spring',
      variants: [
        {
          id: 'surface-spring',
          assetId: null,
          fallbackPalette: { background: 0xd8c9a8, line: 0x75664d, accent: 0xb5844e },
        },
        {
          id: 'surface-quiet',
          assetId: null,
          fallbackPalette: { background: 0xb8b3a7, line: 0x5f625f, accent: 0x8e765d },
        },
        {
          id: 'surface-pursuit',
          assetId: null,
          fallbackPalette: { background: 0x9ca2a0, line: 0x4a5454, accent: 0xc39a65 },
        },
      ],
    },
    inner: {
      id: 'inner',
      defaultVariant: 'inner-dormant',
      variants: [
        {
          id: 'inner-dormant',
          assetId: null,
          fallbackPalette: { background: 0x243132, line: 0x71888a, accent: 0x89b3ad },
        },
        {
          id: 'inner-open',
          assetId: null,
          fallbackPalette: { background: 0x1f3b3e, line: 0x77a3a1, accent: 0x9bd9ca },
        },
        {
          id: 'inner-signal',
          assetId: null,
          fallbackPalette: { background: 0x272f3f, line: 0x8797b4, accent: 0xe5d6a7 },
        },
      ],
    },
  },
  landmarks: [
    {
      id: 'ancestral-home',
      layer: 'surface',
      title: localized('姬家祖宅', 'Ancestral Home'),
      annotation: localized('三炷香熄灭以后，暗门仍在画像后等待。', 'Behind the portrait, the passage waits after the incense dies.'),
      polygon: [{ x: 145, y: 185 }, { x: 330, y: 155 }, { x: 355, y: 290 }, { x: 170, y: 315 }],
      anchor: { x: 260, y: 165 },
      contentTarget: { type: 'reader-position', id: 'ancestral-home', position: position('ancestral-home', 0) },
    },
    {
      id: 'threshold-gate',
      layer: 'surface',
      title: localized('暗门通道', 'Threshold Passage'),
      annotation: localized('十几步的距离，把两种空气切成两个世界。', 'A dozen steps divide one atmosphere from another world.'),
      polygon: [{ x: 420, y: 250 }, { x: 535, y: 220 }, { x: 575, y: 370 }, { x: 455, y: 390 }],
      anchor: { x: 510, y: 225 },
      contentTarget: { type: 'reader-position', id: 'threshold-passage', position: position('threshold-passage', 0) },
    },
    {
      id: 'inner-street',
      layer: 'inner',
      title: localized('里世界街道', 'Inner-World Street'),
      annotation: localized('阳光过分地白，颜色像被抽走了一半。', 'The light is too white, as if half the color has been removed.'),
      polygon: [{ x: 110, y: 470 }, { x: 405, y: 420 }, { x: 450, y: 555 }, { x: 155, y: 620 }],
      anchor: { x: 305, y: 435 },
      contentTarget: { type: 'reader-position', id: 'inner-street', position: position('inner-street', 0) },
    },
    {
      id: 'commercial-signal',
      layer: 'inner',
      title: localized('白色信物', 'The White Token'),
      annotation: localized('那一点热度证明，刚才的脸不是错觉。', 'Its heat proves the face in the crowd was not imagined.'),
      polygon: [{ x: 600, y: 430 }, { x: 760, y: 405 }, { x: 790, y: 535 }, { x: 630, y: 560 }],
      anchor: { x: 710, y: 410 },
      contentTarget: { type: 'reader-position', id: 'commercial-street', position: position('commercial-street', 4) },
    },
    {
      id: 'crowd-corner',
      layer: 'inner',
      title: localized('人群拐角', 'Crowd Corner'),
      annotation: localized('她消失得干干净净，只留下正在冷下去的余温。', 'She vanishes completely, leaving only warmth that is already fading.'),
      polygon: [{ x: 825, y: 480 }, { x: 1060, y: 445 }, { x: 1100, y: 620 }, { x: 865, y: 650 }],
      anchor: { x: 990, y: 455 },
      contentTarget: { type: 'reader-position', id: 'crowd-corner', position: position('crowd-corner', 1) },
    },
  ],
  progressStates: [
    {
      key: 'opening',
      startsAt: position('ancestral-home', 0),
      surfaceVariant: 'surface-spring',
      innerVariant: 'inner-dormant',
      unlockedLandmarkIds: ['ancestral-home'],
      contextualLandmarkIds: ['ancestral-home'],
    },
    {
      key: 'threshold',
      startsAt: position('threshold-passage', 0),
      surfaceVariant: 'surface-quiet',
      innerVariant: 'inner-dormant',
      unlockedLandmarkIds: ['ancestral-home', 'threshold-gate'],
      contextualLandmarkIds: ['threshold-gate'],
    },
    {
      key: 'inner-world',
      startsAt: position('inner-street', 0),
      surfaceVariant: 'surface-quiet',
      innerVariant: 'inner-open',
      unlockedLandmarkIds: ['ancestral-home', 'threshold-gate', 'inner-street'],
      contextualLandmarkIds: ['inner-street'],
    },
    {
      key: 'signal',
      startsAt: position('commercial-street', 4),
      surfaceVariant: 'surface-pursuit',
      innerVariant: 'inner-signal',
      unlockedLandmarkIds: ['ancestral-home', 'threshold-gate', 'inner-street', 'commercial-signal'],
      contextualLandmarkIds: ['commercial-signal'],
    },
    {
      key: 'aftermath',
      startsAt: position('crowd-corner', 1),
      surfaceVariant: 'surface-quiet',
      innerVariant: 'inner-signal',
      unlockedLandmarkIds: ['ancestral-home', 'threshold-gate', 'inner-street', 'commercial-signal', 'crowd-corner'],
      contextualLandmarkIds: ['crowd-corner'],
    },
  ],
}

export function getLocalizedCenterText(text: CenterLocalizedText, language: string): string {
  const code = (language in text ? language : 'zh') as CenterLanguageCode
  return text[code]
}
