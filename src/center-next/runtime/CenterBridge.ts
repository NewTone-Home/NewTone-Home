import type {
  CenterRuntimeEvent,
  CenterRuntimeInitialState,
  CenterRuntimePort,
} from './types'
import type { CenterViewSnapshot, CenterWorldSnapshot } from '../domain/contracts'

export class CenterBridge implements CenterRuntimePort {
  private eventListeners = new Set<(event: CenterRuntimeEvent) => void>()
  private worldListeners = new Set<(snapshot: CenterWorldSnapshot) => void>()
  private viewListeners = new Set<(snapshot: CenterViewSnapshot) => void>()
  private initialState: CenterRuntimeInitialState | null = null
  private lifecycleEvent: Extract<CenterRuntimeEvent, { type: 'runtime/ready' | 'runtime/error' }> | null = null

  start(initialState: CenterRuntimeInitialState): void {
    this.initialState = initialState
    this.lifecycleEvent = null
  }

  getInitialState(): CenterRuntimeInitialState {
    if (!this.initialState) throw new Error('CenterBridge has not been started')
    return this.initialState
  }

  emit(event: CenterRuntimeEvent): void {
    if (event.type === 'runtime/ready' || event.type === 'runtime/error') {
      this.lifecycleEvent = event
    }
    // 遍历副本：派发过程中退订不会漏掉后面的监听者。
    for (const listener of [...this.eventListeners]) listener(event)
  }

  pushWorld(snapshot: CenterWorldSnapshot): void {
    for (const listener of [...this.worldListeners]) listener(snapshot)
  }

  pushView(snapshot: CenterViewSnapshot): void {
    for (const listener of [...this.viewListeners]) listener(snapshot)
  }

  subscribe(listener: (event: CenterRuntimeEvent) => void): () => void {
    this.eventListeners.add(listener)
    if (this.lifecycleEvent) listener(this.lifecycleEvent)
    return () => this.eventListeners.delete(listener)
  }

  subscribeWorld(listener: (snapshot: CenterWorldSnapshot) => void): () => void {
    this.worldListeners.add(listener)
    return () => this.worldListeners.delete(listener)
  }

  subscribeView(listener: (snapshot: CenterViewSnapshot) => void): () => void {
    this.viewListeners.add(listener)
    return () => this.viewListeners.delete(listener)
  }

  destroy(): void {
    this.initialState = null
    this.lifecycleEvent = null
    this.eventListeners.clear()
    this.worldListeners.clear()
    this.viewListeners.clear()
  }
}
