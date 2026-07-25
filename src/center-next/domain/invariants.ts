import type {
  CenterCameraSnapshot,
  CenterViewSnapshot,
  ReaderPosition,
  WorldLayer,
} from './contracts'

const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

export function clampCenterExpansion(value: number): number {
  return Math.min(1, Math.max(0, finiteOr(value, 0)))
}

export function clampCenterZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, finiteOr(value, DEFAULT_ZOOM)))
}

export function normalizeCenterCamera(
  value: Partial<CenterCameraSnapshot> | null | undefined,
): CenterCameraSnapshot {
  return {
    scrollX: finiteOr(value?.scrollX ?? 0, 0),
    scrollY: finiteOr(value?.scrollY ?? 0, 0),
    zoom: clampCenterZoom(value?.zoom ?? DEFAULT_ZOOM),
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
    camera: normalizeCenterCamera(null),
    expansion: 0,
    activeLayer: null,
    selectedLandmarkId: null,
  }
}

export function normalizeCenterViewSnapshot(
  value: Partial<CenterViewSnapshot> | null | undefined,
): CenterViewSnapshot {
  return {
    camera: normalizeCenterCamera(value?.camera),
    expansion: clampCenterExpansion(value?.expansion ?? 0),
    activeLayer: isWorldLayer(value?.activeLayer) ? value.activeLayer : null,
    selectedLandmarkId: typeof value?.selectedLandmarkId === 'string'
      ? value.selectedLandmarkId
      : null,
  }
}
