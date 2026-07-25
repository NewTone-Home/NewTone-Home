import type { CenterCameraSnapshot, CenterWorldSize, WorldPoint } from '../domain/contracts'
import { clampCenterZoom } from '../domain/invariants'

export interface CameraLike extends CenterCameraSnapshot {
  width: number
  height: number
}

export function clampCameraScroll(
  scrollX: number,
  scrollY: number,
  camera: CameraLike,
  world: CenterWorldSize,
): Pick<CenterCameraSnapshot, 'scrollX' | 'scrollY'> {
  const zoom = clampCenterZoom(camera.zoom)
  const visibleWidth = camera.width / zoom
  const visibleHeight = camera.height / zoom
  return {
    scrollX: Math.max(0, Math.min(Math.max(0, world.width - visibleWidth), scrollX)),
    scrollY: Math.max(0, Math.min(Math.max(0, world.height - visibleHeight), scrollY)),
  }
}

export function fitCameraSnapshot(
  viewport: { width: number; height: number },
  world: CenterWorldSize,
): CenterCameraSnapshot {
  const zoom = Math.max(viewport.width / world.width, viewport.height / world.height)
  return {
    zoom,
    scrollX: world.width / 2 - (viewport.width / 2) / zoom,
    scrollY: world.height / 2 - (viewport.height / 2) / zoom,
  }
}

export function projectWorldPoint(
  point: WorldPoint,
  camera: CenterCameraSnapshot,
): WorldPoint {
  return {
    x: (point.x - camera.scrollX) * camera.zoom,
    y: (point.y - camera.scrollY) * camera.zoom,
  }
}
