export const CENTER_LANGUAGE_CODES = ['zh', 'en', 'ja', 'ko', 'fr'] as const

export type CenterLanguageCode = typeof CENTER_LANGUAGE_CODES[number]
export type WorldLayer = 'surface' | 'inner'

/**
 * Stable Reader position owned by the existing V0.0 Reader protocol.
 * Center must consume this shape instead of introducing chapter/block ratios.
 */
export interface ReaderPosition {
  phaseId: string
  pageId: string
  beatIndex: number
}

export interface WorldPoint {
  x: number
  y: number
}

export interface CenterWorldSize {
  width: number
  height: number
}

export interface CenterLayerVariantDefinition {
  id: string
  assetId: string
}

export interface CenterLayerDefinition {
  id: WorldLayer
  defaultVariant: string
  variants: CenterLayerVariantDefinition[]
}

export type CenterLocalizedText = Record<CenterLanguageCode, string>

export interface LandmarkDefinition {
  id: string
  layer: WorldLayer
  title: CenterLocalizedText
  annotation: CenterLocalizedText
  polygon: WorldPoint[]
  anchor: WorldPoint
  contentTarget?: {
    type: 'reader-position' | 'note'
    id: string
    position?: ReaderPosition
  }
}

/**
 * A deterministic world checkpoint. Resolution will later compare startsAt
 * against V0.0 readerContentIndex.linearIndex.
 */
export interface CenterProgressDefinition {
  key: string
  startsAt: ReaderPosition
  surfaceVariant: string
  innerVariant: string
  unlockedLandmarkIds: string[]
  contextualLandmarkIds?: string[]
}

export interface CenterDefinition {
  schemaVersion: 1
  worldSize: CenterWorldSize
  layers: {
    surface: CenterLayerDefinition
    inner: CenterLayerDefinition
  }
  landmarks: LandmarkDefinition[]
  progressStates: CenterProgressDefinition[]
}

/** Stable world facts that survive leaving Center and reloading the app. */
export interface CenterWorldSnapshot {
  progressKey: string
  surfaceVariant: string
  innerVariant: string
  unlockedLandmarkIds: string[]
  visitedLandmarkIds: string[]
}

/** Stable camera values expressed in Phaser world coordinates. */
export interface CenterCameraSnapshot {
  scrollX: number
  scrollY: number
  zoom: number
}

/** Stable Center presentation state. Hover, pointer and tween state are excluded. */
export interface CenterViewSnapshot {
  camera: CenterCameraSnapshot
  expansion: number
  activeLayer: WorldLayer | null
  selectedLandmarkId: string | null
}

export interface CenterPersistentSnapshot {
  world: CenterWorldSnapshot | null
  view: CenterViewSnapshot
}

export interface CenterProjectionMap {
  [landmarkId: string]: WorldPoint
}
