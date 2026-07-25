import type {
  CenterCameraSnapshot,
  CenterDefinition,
  CenterProjectionMap,
  CenterViewSnapshot,
  CenterWorldSnapshot,
} from '../domain/contracts'

export type CenterRuntimeEvent =
  | { type: 'runtime/ready' }
  | { type: 'runtime/error'; message: string }
  | { type: 'landmark/hover'; landmarkId: string | null }
  | { type: 'landmark/open'; landmarkId: string }
  | { type: 'projection/update'; anchors: CenterProjectionMap }
  | { type: 'camera/commit'; camera: CenterCameraSnapshot }

export interface CenterRuntimeInitialState {
  definition: CenterDefinition
  world: CenterWorldSnapshot
  view: CenterViewSnapshot
}

/**
 * Framework-neutral contract between React and the future Phaser runtime.
 * It deliberately excludes routing, persistence and product progress actions.
 */
export interface CenterRuntimePort {
  start(initialState: CenterRuntimeInitialState): void
  pushWorld(snapshot: CenterWorldSnapshot): void
  pushView(snapshot: CenterViewSnapshot): void
  subscribe(listener: (event: CenterRuntimeEvent) => void): () => void
  destroy(): void
}
