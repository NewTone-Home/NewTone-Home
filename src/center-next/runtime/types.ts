import type {
  CenterCameraSnapshot,
  CenterDefinition,
  CenterProjectionMap,
  CenterViewSnapshot,
  CenterWorldSnapshot,
  WorldLayer,
} from '../domain/contracts'

export type CenterRuntimeEvent =
  | { type: 'runtime/ready' }
  | { type: 'runtime/error'; message: string }
  | { type: 'landmark/hover'; landmarkId: string | null }
  | { type: 'landmark/open'; landmarkId: string }
  | { type: 'projection/update'; anchors: CenterProjectionMap }
  | { type: 'camera/commit'; camera: CenterCameraSnapshot }
  | { type: 'view/commit'; view: Partial<Pick<CenterViewSnapshot, 'expansion' | 'activeLayer' | 'selectedLandmarkId'>> }

export interface CenterRuntimeInitialState {
  definition: CenterDefinition
  world: CenterWorldSnapshot
  view: CenterViewSnapshot
  assetUrls: Record<string, string>
}

export interface CenterRuntimePort {
  start(initialState: CenterRuntimeInitialState): void
  pushWorld(snapshot: CenterWorldSnapshot): void
  pushView(snapshot: CenterViewSnapshot): void
  subscribe(listener: (event: CenterRuntimeEvent) => void): () => void
  destroy(): void
}

export interface CenterRuntimeControls {
  setExpansion(value: number): void
  setActiveLayer(layer: WorldLayer | null): void
  resetCamera(): void
}
