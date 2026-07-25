export const CENTER_LANGUAGE_CODES = ['zh', 'en', 'ja', 'ko', 'fr'] as const

export type CenterLanguageCode = typeof CENTER_LANGUAGE_CODES[number]
export type WorldLayer = 'surface' | 'inner'

/** Stable Reader position owned by the existing V0.0 Reader protocol. */
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
  assetId: string | null
  fallbackPalette: {
    background: number
    line: number
    accent: number
  }
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

/** Deterministic checkpoint resolved against V0.0 reader linear positions. */
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
  id: string
  title: CenterLocalizedText
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
  definitionId: string
  progressKey: string
  surfaceVariant: string
  innerVariant: string
  unlockedLandmarkIds: string[]
  visitedLandmarkIds: string[]
  contextualLandmarkIds: string[]
}

/** Stable camera values expressed in Phaser world coordinates. */
export interface CenterCameraSnapshot {
  scrollX: number
  scrollY: number
  zoom: number
}

/** Stable presentation state. Hover, pointer, projection and tween state are excluded. */
export interface CenterViewSnapshot {
  camera: CenterCameraSnapshot | null
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

export interface CenterAssetDescriptor {
  id: string
  path: string
  mimeType: string
}

export interface CenterPackageManifest {
  schemaVersion: 1
  id: string
  version: string
  title: CenterLocalizedText
  centerDefinitionPath: string
  assets: CenterAssetDescriptor[]
}

export interface StoredCenterPackage {
  manifest: CenterPackageManifest
  definition: CenterDefinition
  importedAt: string
}
