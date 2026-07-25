import type {
  CenterCameraSnapshot,
  CenterViewSnapshot,
  CenterWorldSnapshot,
  ReaderPosition,
  WorldLayer,
} from './contracts'

const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.35
const MAX_ZOOM = 3.5

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
}

export function clampCenterExpansion(value: number): number {
  return Math.min(1, Math.max(0, finiteOr(value, 0)))
}

export function clampCenterZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, finiteOr(value, DEFAULT_ZOOM)))
}

export function normalizeCenterCamera(
  value: Partial<CenterCameraSnapshot> | null | undefined,
): CenterCameraSnapshot | null {
  if (!value) return null
  return {
    scrollX: finiteOr(value.scrollX ?? 0, 0),
    scrollY: finiteOr(value.scrollY ?? 0, 0),
    zoom: clampCenterZoom(value.zoom ?? DEFAULT_ZOOM),
  }
}

export function isWorldLayer(value: unknown): value is WorldLayer {
  return value === 'surface' || value === 'inner'
}

export function isReaderPosition(value: unknown): value is ReaderPosition {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ReaderPosition>
  return typeof candidate.phaseId === 'string'
    && candidate.phaseId.length > 0
    && typeof candidate.pageId === 'string'
    && candidate.pageId.length > 0
    && Number.isInteger(candidate.beatIndex)
    && (candidate.beatIndex ?? -1) >= 0
}

export function createDefaultCenterViewSnapshot(): CenterViewSnapshot {
  return {
    camera: null,
    expansion: 0.42,
    activeLayer: null,
    selectedLandmarkId: null,
  }
}

export function normalizeCenterViewSnapshot(
  value: Partial<CenterViewSnapshot> | null | undefined,
): CenterViewSnapshot {
  return {
    camera: normalizeCenterCamera(value?.camera),
    expansion: clampCenterExpansion(value?.expansion ?? 0.42),
    activeLayer: isWorldLayer(value?.activeLayer) ? value.activeLayer : null,
    selectedLandmarkId: typeof value?.selectedLandmarkId === 'string'
      ? value.selectedLandmarkId
      : null,
  }
}

export function normalizeCenterWorldSnapshot(
  value: Partial<CenterWorldSnapshot> | null | undefined,
): CenterWorldSnapshot | null {
  if (!value || typeof value.definitionId !== 'string' || typeof value.progressKey !== 'string') return null
  if (typeof value.surfaceVariant !== 'string' || typeof value.innerVariant !== 'string') return null
  return {
    definitionId: value.definitionId,
    progressKey: value.progressKey,
    surfaceVariant: value.surfaceVariant,
    innerVariant: value.innerVariant,
    unlockedLandmarkIds: uniqueStrings(value.unlockedLandmarkIds),
    visitedLandmarkIds: uniqueStrings(value.visitedLandmarkIds),
    contextualLandmarkIds: uniqueStrings(value.contextualLandmarkIds),
  }
}
