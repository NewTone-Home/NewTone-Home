import type { Point } from './sceneGeometry'
import { snapLayoutAnchor, type SceneLayout } from './sceneLayout'

const STORAGE_VERSION = 3
const STORAGE_PREFIX = 'newtone:center:scene-layout'

type StoredSceneLayout = {
  version: number
  sceneId: string
  items: Record<string, Point>
}

function storageKey(sceneId: string) {
  return `${STORAGE_PREFIX}:${sceneId}:v${STORAGE_VERSION}`
}

function urlKey(sceneId: string) {
  return `newtone-layout-${sceneId}`
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object') return false
  const point = value as Partial<Point>
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function normalizeLayout(items: Record<string, unknown>): SceneLayout {
  return Object.fromEntries(
    Object.entries(items)
      .filter((entry): entry is [string, Point] => isPoint(entry[1]))
      .map(([id, point]) => [id, snapLayoutAnchor(point)]),
  )
}

function decodeDocument(sceneId: string, encoded: string | null): SceneLayout | null {
  if (!encoded) return null
  try {
    const parsed = JSON.parse(window.atob(encoded)) as Partial<StoredSceneLayout>
    if (parsed.version !== STORAGE_VERSION || parsed.sceneId !== sceneId || !parsed.items || typeof parsed.items !== 'object') return null
    return normalizeLayout(parsed.items)
  } catch {
    return null
  }
}

function encodeDocument(document: StoredSceneLayout) {
  return window.btoa(JSON.stringify(document))
}

function readUrlLayout(sceneId: string): SceneLayout | null {
  if (typeof window === 'undefined') return null
  return decodeDocument(sceneId, new URL(window.location.href).searchParams.get(urlKey(sceneId)))
}

function writeUrlLayout(sceneId: string, document: StoredSceneLayout | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (document && Object.keys(document.items).length > 0) url.searchParams.set(urlKey(sceneId), encodeDocument(document))
  else url.searchParams.delete(urlKey(sceneId))
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

/**
 * Layout is authored separately from the scene definition. The saved value
 * stores absolute group anchors, so changing a scene's default coordinates
 * does not erase or reinterpret a layout the author already placed.
 */
export function loadSceneLayout(sceneId: string): SceneLayout {
  const fromUrl = readUrlLayout(sceneId)
  if (fromUrl) return fromUrl

  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(storageKey(sceneId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<StoredSceneLayout>
    if (parsed.version !== STORAGE_VERSION || parsed.sceneId !== sceneId || !parsed.items || typeof parsed.items !== 'object') return {}

    return normalizeLayout(parsed.items)
  } catch {
    return {}
  }
}

export function persistSceneLayout(sceneId: string, layout: SceneLayout) {
  const document: StoredSceneLayout = {
    version: STORAGE_VERSION,
    sceneId,
    items: normalizeLayout(layout),
  }

  // The URL is the durable local source for the editor. It survives refreshes
  // and embedded-browser tab recreation without requiring a backend.
  writeUrlLayout(sceneId, document)

  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey(sceneId), JSON.stringify(document))
  } catch {
    // Private browsing or a blocked storage policy should not stop editing.
  }
}

export function clearSceneLayout(sceneId: string) {
  writeUrlLayout(sceneId, null)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(sceneId))
  } catch {
    // Treat storage cleanup as best-effort; the in-memory reset still works.
  }
}
