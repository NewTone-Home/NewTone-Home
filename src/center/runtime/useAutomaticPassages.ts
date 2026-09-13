'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Point } from './sceneGeometry'
import { sceneDoorMotion } from './sceneDoorConfig'
import {
  containsDoorRegion,
  createDoorPassageRuntime,
  doorPassageIsOpen,
  doorPassageIsPassable,
  doorRegionSide,
  reduceDoorPassageRuntime,
  type DoorPassagePhase,
  type DoorPassageRegion,
  type DoorPassageRuntime,
  type DoorPassageSide,
} from './doorPassageModel'

export type AutomaticPassageSide = DoorPassageSide

export type AutomaticPassageRuntime = {
  requestPassage: (actorId: string, passageId: string, from: Point, target: Point) => boolean
  cancelPassage: (actorId: string, passageId?: string) => void
  updateActor: (actorId: string, position: Point, visible?: boolean) => void
  completeOpen: (passageId: string) => boolean
  completeClose: (passageId: string) => boolean
  getPassagePhase: (passageId: string) => DoorPassagePhase
  /** Read the current passable set directly from the lifecycle ref. */
  getOpenPassageIds: () => ReadonlySet<string>
  passageStates: ReadonlyMap<string, DoorPassageRuntime>
}

export type AutomaticPassageDefinition = {
  id: string
  region: DoorPassageRegion
}

type DoorActor = { position: Point; visible: boolean }

function lifecycleNow() {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function createPassageStateMap(passages: readonly AutomaticPassageDefinition[]) {
  return new Map(passages.map((passage) => [passage.id, createDoorPassageRuntime()] as const))
}

type PassageStore = {
  getSnapshot: () => ReadonlyMap<string, DoorPassageRuntime>
  get: (passageId: string) => DoorPassageRuntime | undefined
  subscribe: (listener: () => void) => () => void
  update: (passageId: string, state: DoorPassageRuntime) => void
}

function createPassageStore(passages: readonly AutomaticPassageDefinition[]): PassageStore {
  let snapshot: ReadonlyMap<string, DoorPassageRuntime> = createPassageStateMap(passages)
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    get: (passageId) => snapshot.get(passageId),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update: (passageId, state) => {
      if (snapshot.get(passageId) === state) return
      snapshot = new Map(snapshot).set(passageId, state)
      listeners.forEach((listener) => listener())
    },
  }
}

type AutomaticPassageOptions = {
  passages: readonly AutomaticPassageDefinition[]
  /** Permission wrapper checked when an intentional passage reaches the door. */
  canOpen?: (actorId: string, passage: AutomaticPassageDefinition, from: Point) => boolean
  canUse?: (actorId: string, passage: AutomaticPassageDefinition, from: Point, target: Point) => boolean
  onDenied?: (actorId: string, passage: AutomaticPassageDefinition) => void
}

/** Owns intentional passage reservations, door opening, and doorway-clear closing. */
export function useAutomaticPassages({ passages, canOpen, canUse, onDenied }: AutomaticPassageOptions): AutomaticPassageRuntime {
  const [passageStore] = useState(() => createPassageStore(passages))
  const passageStates = useSyncExternalStore(passageStore.subscribe, passageStore.getSnapshot, passageStore.getSnapshot)
  const optionsRef = useRef({ passages, canOpen, canUse, onDenied })
  const actorsRef = useRef(new Map<string, DoorActor>())
  const holdFramesRef = useRef(new Map<string, number>())

  useEffect(() => {
    optionsRef.current = { passages, canOpen, canUse, onDenied }
  }, [canOpen, canUse, onDenied, passages])

  const passageForId = useCallback((passageId: string) => (
    optionsRef.current.passages.find((passage) => passage.id === passageId)
  ), [])

  const stateFor = useCallback((passageId: string) => {
    return passageStore.get(passageId) ?? createDoorPassageRuntime()
  }, [passageStore])

  const updateState = useCallback((passageId: string, action: Parameters<typeof reduceDoorPassageRuntime>[1]) => {
    const previous = stateFor(passageId)
    const next = reduceDoorPassageRuntime(previous, action)
    passageStore.update(passageId, next)
    return next
  }, [passageStore, stateFor])

  const isOpen = useCallback((passageId: string) => doorPassageIsOpen(stateFor(passageId).phase), [stateFor])

  const hasActivePassage = useCallback((passageId: string) => (
    Object.values(stateFor(passageId).reservations).length > 0
  ), [stateFor])

  const isDoorwayBusy = useCallback((passage: AutomaticPassageDefinition) => (
    [...actorsRef.current.values()].some((actor) => actor.visible && containsDoorRegion(actor.position, passage.region.doorway))
  ), [])

  const cancelHoldClock = useCallback((passageId: string) => {
    const frame = holdFramesRef.current.get(passageId)
    if (frame === undefined) return
    if (typeof window !== 'undefined') window.cancelAnimationFrame(frame)
    holdFramesRef.current.delete(passageId)
  }, [])

  const beginClosingPassage = useCallback((passage: AutomaticPassageDefinition) => {
    if (!isOpen(passage.id) || hasActivePassage(passage.id) || isDoorwayBusy(passage)) return false
    const next = updateState(passage.id, { type: 'begin-closing' })
    if (next.phase !== 'closing') return false
    return true
  }, [hasActivePassage, isDoorwayBusy, isOpen, updateState])

  const scheduleHoldCompletion = useCallback((passage: AutomaticPassageDefinition) => {
    cancelHoldClock(passage.id)
    if (typeof window === 'undefined') return
    const advanceHold = (now: number) => {
      const state = stateFor(passage.id)
      if (state.phase !== 'holding' || state.clearHoldUntil === undefined) {
        holdFramesRef.current.delete(passage.id)
        return
      }
      if (now < state.clearHoldUntil) {
        const frame = window.requestAnimationFrame(advanceHold)
        holdFramesRef.current.set(passage.id, frame)
        return
      }
      holdFramesRef.current.delete(passage.id)
      beginClosingPassage(passage)
    }
    const frame = window.requestAnimationFrame(advanceHold)
    holdFramesRef.current.set(passage.id, frame)
  }, [beginClosingPassage, cancelHoldClock, stateFor])

  const closeReadyPassage = useCallback((passage: AutomaticPassageDefinition) => {
    const state = stateFor(passage.id)
    if (!isOpen(passage.id) || hasActivePassage(passage.id) || isDoorwayBusy(passage) || state.phase === 'closing' || state.phase === 'holding') return false
    const next = updateState(passage.id, { type: 'begin-hold', until: lifecycleNow() + sceneDoorMotion.clearHoldMs })
    if (next.phase !== 'holding') return false
    scheduleHoldCompletion(passage)
    return true
  }, [hasActivePassage, isDoorwayBusy, isOpen, scheduleHoldCompletion, stateFor, updateState])

  const openReadyPassage = useCallback((passage: AutomaticPassageDefinition, actorId: string) => {
    const actor = actorsRef.current.get(actorId)
    if (!actor?.visible || !containsDoorRegion(actor.position, passage.region.doorway)) return
    const state = stateFor(passage.id)
    if (state.phase === 'opening' || state.phase === 'open' || state.phase === 'crossing') return
    if (optionsRef.current.canOpen && !optionsRef.current.canOpen(actorId, passage, actor.position)) return
    if (state.phase === 'holding' || state.phase === 'closing') cancelHoldClock(passage.id)
    updateState(passage.id, { type: 'approach' })
  }, [cancelHoldClock, stateFor, updateState])

  const completeOpen = useCallback((passageId: string) => {
    if (stateFor(passageId).phase !== 'opening') return false
    updateState(passageId, { type: 'opened' })
    return true
  }, [stateFor, updateState])

  const completeClose = useCallback((passageId: string) => {
    if (stateFor(passageId).phase !== 'closing') return false
    updateState(passageId, { type: 'closed' })
    return true
  }, [stateFor, updateState])

  const requestPassage = useCallback((actorId: string, passageId: string, from: Point, target: Point) => {
    const passage = passageForId(passageId)
    const allowed = Boolean(passage && (!optionsRef.current.canUse || optionsRef.current.canUse(actorId, passage, from, target)))
    if (!passage || !allowed) {
      if (passage) optionsRef.current.onDenied?.(actorId, passage)
      return false
    }

    const fromSide = doorRegionSide(passage.region, from)
    const targetSide = doorRegionSide(passage.region, target)
    const previous = stateFor(passageId)
    if (previous.phase === 'holding') cancelHoldClock(passageId)
    updateState(passageId, {
      type: 'request',
      allowed: true,
      reservation: { actorId, fromSide, targetSide, target, crossed: false },
    })
    return true
  }, [cancelHoldClock, passageForId, stateFor, updateState])

  const cancelPassage = useCallback((actorId: string, passageId?: string) => {
    const selected = passageId
      ? optionsRef.current.passages.filter((passage) => passage.id === passageId)
      : optionsRef.current.passages
    selected.forEach((passage) => {
      if (stateFor(passage.id).reservations[actorId]) updateState(passage.id, { type: 'release', actorId })
      closeReadyPassage(passage)
    })
  }, [closeReadyPassage, stateFor, updateState])

  const updateActor = useCallback((actorId: string, position: Point, visible = true) => {
    actorsRef.current.set(actorId, { position, visible })
    optionsRef.current.passages.forEach((passage) => {
      const inDoorway = containsDoorRegion(position, passage.region.doorway)
      const state = stateFor(passage.id)
      const active = state.reservations[actorId]
      if (active) {
        const currentSide = doorRegionSide(passage.region, position)
        const crossed = active.crossed || currentSide !== active.fromSide
        if (crossed && currentSide === active.targetSide) {
          updateState(passage.id, { type: 'crossed', actorId })
          updateState(passage.id, { type: 'release', actorId })
        } else if (crossed) {
          updateState(passage.id, { type: 'crossed', actorId })
          openReadyPassage(passage, actorId)
        }
      }

      if (!inDoorway && !hasActivePassage(passage.id)) closeReadyPassage(passage)
    })
  }, [closeReadyPassage, hasActivePassage, openReadyPassage, stateFor, updateState])

  useEffect(() => () => {
    holdFramesRef.current.forEach((frame) => {
      if (typeof window !== 'undefined') window.cancelAnimationFrame(frame)
    })
    holdFramesRef.current.clear()
    actorsRef.current.clear()
  }, [])

  const getPassagePhase = useCallback((passageId: string) => stateFor(passageId).phase, [stateFor])

  const getOpenPassageIds = useCallback(() => new Set(optionsRef.current.passages
    .filter((passage) => doorPassageIsPassable(passageStore.getSnapshot().get(passage.id)?.phase ?? 'closed'))
    .map((passage) => passage.id)), [passageStore])

  return { requestPassage, cancelPassage, updateActor, completeOpen, completeClose, getPassagePhase, getOpenPassageIds, passageStates }
}
