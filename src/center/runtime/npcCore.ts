import type { Point } from './sceneGeometry'

export type NpcPhase = 'idle' | 'waiting' | 'moving' | 'blocked'

export type NpcIntent = {
  dutyId: string
  targetId: string
  /** A semantic scene entity. The movement adapter resolves its live contact. */
  targetEntityId?: string
  /** Named point targets stay valid for staging and staff work surfaces. */
  target?: Point
}

export type ResolvedNpcIntent = NpcIntent & { target: Point }

export type NpcRuntimeSnapshot = {
  npcId: string
  phase: NpcPhase
  dutyId: string | null
  targetId: string | null
  target: Point | null
  retryCount: number
}

export type NpcRuntime = {
  setPosition: (position: Point) => void
  getPosition: () => Point
  getSnapshot: () => NpcRuntimeSnapshot
  beginIntent: (intent: ResolvedNpcIntent) => void
  wait: () => void
  arrive: () => void
  blocked: () => void
  reset: () => void
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y }
}

/**
 * Renderer-independent NPC state. Duties decide what an NPC wants to do;
 * this core keeps the current intent, phase and replan count consistent.
 */
export function createNpcRuntime(npcId: string, initialPosition: Point = { x: 0, y: 0 }): NpcRuntime {
  let position = copyPoint(initialPosition)
  let snapshot: NpcRuntimeSnapshot = {
    npcId,
    phase: 'idle',
    dutyId: null,
    targetId: null,
    target: null,
    retryCount: 0,
  }

  return {
    setPosition: (nextPosition) => { position = copyPoint(nextPosition) },
    getPosition: () => copyPoint(position),
    getSnapshot: () => ({ ...snapshot, target: snapshot.target ? copyPoint(snapshot.target) : null }),
    beginIntent: (intent) => {
      snapshot = {
        ...snapshot,
        phase: 'moving',
        dutyId: intent.dutyId,
        targetId: intent.targetId,
        target: copyPoint(intent.target),
      }
    },
    wait: () => { snapshot = { ...snapshot, phase: 'waiting' } },
    arrive: () => { snapshot = { ...snapshot, phase: 'idle', retryCount: 0 } },
    blocked: () => { snapshot = { ...snapshot, phase: 'blocked', retryCount: snapshot.retryCount + 1 } },
    reset: () => {
      snapshot = { npcId, phase: 'idle', dutyId: null, targetId: null, target: null, retryCount: 0 }
    },
  }
}

export function npcRetryDelay(baseDelayMs: number, retryCount: number, maxDelayMs = 3600) {
  return Math.min(maxDelayMs, baseDelayMs + Math.max(0, retryCount - 1) * 400)
}
