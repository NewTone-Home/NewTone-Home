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

const CAMERA_EPSILON = 1e-3

/**
 * 相机快照必须按值比较：store 每次都会重建 camera 对象，
 * 用对象 identity 比较会让任何一次 view 更新都强写相机。
 */
export function cameraSnapshotsEqual(
  a: CenterCameraSnapshot | null | undefined,
  b: CenterCameraSnapshot | null | undefined,
  epsilon: number = CAMERA_EPSILON,
): boolean {
  if (!a || !b) return !a && !b
  return Math.abs(a.scrollX - b.scrollX) <= epsilon
    && Math.abs(a.scrollY - b.scrollY) <= epsilon
    && Math.abs(a.zoom - b.zoom) <= epsilon
}

export interface CameraAdoptionContext {
  /** 相机当前的真实状态。 */
  current: CenterCameraSnapshot
  /** 最近一次被请求应用的快照（clamp 之前的原始值）。 */
  requested: CenterCameraSnapshot | null
  /** 最近一次由 runtime 自己提交出去的快照。 */
  committed: CenterCameraSnapshot | null
}

/**
 * 决定一份外部推入的相机快照是否需要真的写进相机。
 * 拒绝三种情况：等于自己刚提交的（回声）、等于上次已请求过的（边界 clamp 后的重复推送）、
 * 以及等于当前真实状态（无变化）。
 */
export function shouldAdoptCamera(
  incoming: CenterCameraSnapshot,
  context: CameraAdoptionContext,
  epsilon: number = CAMERA_EPSILON,
): boolean {
  if (cameraSnapshotsEqual(incoming, context.committed, epsilon)) return false
  if (cameraSnapshotsEqual(incoming, context.requested, epsilon)) return false
  if (cameraSnapshotsEqual(incoming, context.current, epsilon)) return false
  return true
}

/** 相机停在同一处（例如一直顶着世界边界拖动）时不重复提交。 */
export function shouldCommitCamera(
  next: CenterCameraSnapshot,
  committed: CenterCameraSnapshot | null,
  epsilon: number = CAMERA_EPSILON,
): boolean {
  return !cameraSnapshotsEqual(next, committed, epsilon)
}

export function fitCameraSnapshot(
  viewport: { width: number; height: number },
  world: CenterWorldSize,
): CenterCameraSnapshot {
  // zoom 必须与 normalizeCenterCamera 用同一个区间，否则首帧与首次 commit 之后会跳变。
  const zoom = clampCenterZoom(Math.max(viewport.width / world.width, viewport.height / world.height))
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
