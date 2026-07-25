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

  start(initialState: CenterRuntimeInitialState): void {
    this.initialState = initialState
  }

  getInitialState(): CenterRuntimeInitialState {
    if (!this.initialState) throw new Error('CenterBridge has not been started')
    return this.initialState
  }

  emit(event: CenterRuntimeEvent): void {
    this.eventListeners.forEach(listener => listener(event))
  }

  pushWorld(snapshot: CenterWorldSnapshot): void {
    this.worldListeners.forEach(listener => listener(snapshot))
  }

  pushView(snapshot: CenterViewSnapshot): void {
    this.viewListeners.forEach(listener => listener(snapshot))
  }

  subscribe(listener: (event: CenterRuntimeEvent) => void): () => void {
    this.eventListeners.add(listener)
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
    this.eventListeners.clear()
    this.worldListeners.clear()
    this.viewListeners.clear()
  }
}
