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
  emit(event: CenterRuntimeEvent): void
  subscribe(listener: (event: CenterRuntimeEvent) => void): () => void
  subscribeWorld(listener: (snapshot: CenterWorldSnapshot) => void): () => void
  subscribeView(listener: (snapshot: CenterViewSnapshot) => void): () => void
  destroy(): void
}

export interface CenterRuntimeControls {
  setExpansion(value: number): void
  setActiveLayer(layer: WorldLayer | null): void
  resetCamera(): void
}

/**
 * Scene 的生命周期只有三个状态：
 * booting 尚未准备好接收快照，live 可以安全接收，dead 永久拒收。
 */
export type CenterSceneStatus = 'booting' | 'live' | 'dead'

/** Session 看到的 Scene：只能读状态、只能交付快照。 */
export interface CenterSceneHandle {
  readonly status: CenterSceneStatus
  applyWorld(snapshot: CenterWorldSnapshot): void
  applyView(snapshot: CenterViewSnapshot): void
}

/**
 * Scene 看到的 Session。Scene 不认识 Bridge，也不认识 React：
 * 所有出站事件都带上自己的 generation，由 Session 决定是否仍然有效。
 */
export interface CenterSceneOwner {
  currentWorld(): CenterWorldSnapshot
  currentView(): CenterViewSnapshot
  attachScene(generation: number, scene: CenterSceneHandle): void
  releaseScene(scene: CenterSceneHandle): void
  emitFromScene(generation: number, event: CenterRuntimeEvent): void
  reportSceneFailure(generation: number, error: unknown): void
}

/** 一个已启动的图形运行时实例（真实实现即 Phaser.Game 的包装）。 */
export interface CenterRuntimeInstance {
  destroy(): void
}

export interface CenterLaunchRequest {
  parent: HTMLElement
  generation: number
  definition: CenterDefinition
  assetUrls: Record<string, string>
  owner: CenterSceneOwner
  /** postBoot 之类的异步回调必须先问一次，过期的 generation 不得创建 Scene。 */
  shouldStartScene(generation: number): boolean
}

export interface CenterRuntimeLauncher {
  launch(request: CenterLaunchRequest): CenterRuntimeInstance
}
