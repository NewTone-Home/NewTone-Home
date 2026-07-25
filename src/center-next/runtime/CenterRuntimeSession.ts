import type {
  CenterDefinition,
  CenterViewSnapshot,
  CenterWorldSnapshot,
} from '../domain/contracts'
import type {
  CenterRuntimeEvent,
  CenterRuntimeInstance,
  CenterRuntimeLauncher,
  CenterRuntimePort,
  CenterSceneHandle,
  CenterSceneOwner,
} from './types'

export type CenterSessionStatus = 'idle' | 'running' | 'stopped'

export interface CenterRuntimeSessionOptions {
  bridge: CenterRuntimePort
  definition: CenterDefinition
  assetUrls: Record<string, string>
  world: CenterWorldSnapshot
  view: CenterViewSnapshot
  launcher: CenterRuntimeLauncher
  logger?: (message: string, error: unknown) => void
}

/**
 * Center 运行时唯一的所有者。
 *
 * 它拥有：图形运行时实例的创建与销毁、Bridge 上 world/view 订阅的注册与解除、
 * Scene ready 之前的最新快照、以及 generation（用于让所有在飞的异步回调失效）。
 *
 * 它刻意不认识 Phaser，也不认识 React：
 * 图形侧通过 CenterRuntimeLauncher 注入，React 侧只调用 start / stop。
 */
export class CenterRuntimeSession implements CenterSceneOwner {
  private status: CenterSessionStatus = 'idle'
  private generation = 0
  private world: CenterWorldSnapshot
  private view: CenterViewSnapshot
  private scene: CenterSceneHandle | null = null
  private instance: CenterRuntimeInstance | null = null
  private unsubscribers: Array<() => void> = []

  constructor(private readonly options: CenterRuntimeSessionOptions) {
    this.world = options.world
    this.view = options.view
  }

  get sessionStatus(): CenterSessionStatus {
    return this.status
  }

  get sceneGeneration(): number {
    return this.generation
  }

  get liveScene(): CenterSceneHandle | null {
    return this.scene
  }

  /** 幂等：已经在运行时重复调用不会产生第二个运行时实例。 */
  start(parent: HTMLElement): void {
    if (this.status === 'running') return
    this.status = 'running'
    this.generation += 1
    const generation = this.generation

    this.options.bridge.start({
      definition: this.options.definition,
      world: this.world,
      view: this.view,
      assetUrls: this.options.assetUrls,
    })

    this.unsubscribers.push(this.options.bridge.subscribeWorld(snapshot => this.receiveWorld(snapshot)))
    this.unsubscribers.push(this.options.bridge.subscribeView(snapshot => this.receiveView(snapshot)))

    this.instance = this.options.launcher.launch({
      parent,
      generation,
      definition: this.options.definition,
      assetUrls: this.options.assetUrls,
      owner: this,
      shouldStartScene: candidate => this.shouldStartScene(candidate),
    })
  }

  /** 幂等。顺序是硬要求：先退订，再让本代失效，最后销毁运行时。 */
  stop(): void {
    if (this.status !== 'running') {
      this.status = 'stopped'
      return
    }
    this.unsubscribers.forEach(unsubscribe => unsubscribe())
    this.unsubscribers = []
    this.status = 'stopped'
    this.generation += 1
    this.scene = null
    const instance = this.instance
    this.instance = null
    instance?.destroy()
  }

  /** 过期的 postBoot / create 回调不得再创建 Scene。 */
  shouldStartScene(generation: number): boolean {
    return this.status === 'running' && generation === this.generation
  }

  currentWorld(): CenterWorldSnapshot {
    return this.world
  }

  currentView(): CenterViewSnapshot {
    return this.view
  }

  attachScene(generation: number, scene: CenterSceneHandle): void {
    if (!this.shouldStartScene(generation)) return
    this.scene = scene
  }

  releaseScene(scene: CenterSceneHandle): void {
    if (this.scene === scene) this.scene = null
  }

  emitFromScene(generation: number, event: CenterRuntimeEvent): void {
    if (this.status !== 'running' || generation !== this.generation) return
    this.options.bridge.emit(event)
  }

  reportSceneFailure(generation: number, error: unknown): void {
    if (generation !== this.generation) return
    this.fail(error, 'Center runtime failed to start')
  }

  private receiveWorld(snapshot: CenterWorldSnapshot): void {
    this.world = snapshot
    this.deliver(scene => scene.applyWorld(snapshot))
  }

  private receiveView(snapshot: CenterViewSnapshot): void {
    this.view = snapshot
    this.deliver(scene => scene.applyView(snapshot))
  }

  /**
   * ready 之前只保留最新快照（Scene 在 create 里自己来取），
   * Scene 死亡或 session 停止之后一律不再交付。
   */
  private deliver(action: (scene: CenterSceneHandle) => void): void {
    if (this.status !== 'running') return
    const scene = this.scene
    if (!scene || scene.status !== 'live') return
    try {
      action(scene)
    } catch (error) {
      this.fail(error, 'Center runtime failed while applying a snapshot')
    }
  }

  /**
   * runtime 异常不允许冒回 React effect（那会卸载整棵子树导致黑屏），
   * 也不允许被静默吞掉：先记日志，停掉本 session，再走一次 runtime/error。
   */
  private fail(error: unknown, message: string): void {
    const log = this.options.logger ?? ((text: string, cause: unknown) => console.error(text, cause))
    log(message, error)
    this.stop()
    this.options.bridge.emit({
      type: 'runtime/error',
      message: error instanceof Error ? error.message : message,
    })
  }
}
