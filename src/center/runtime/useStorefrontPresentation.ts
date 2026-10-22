'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { storefrontRoomConnection } from './storefrontRoomConnection'
import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { sceneFrameDefaultMotionMs, sceneFrameMotionMsForRect } from './sceneMotion'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import {
  activeStorefrontPresentationOwner,
  activeStorefrontInteriorOwner,
  nextStorefrontPresentationPhase,
  storefrontPresentationHandoffSource,
  storefrontRestoreDelayMs,
  storefrontEntryRevealDelayMs,
  type StorefrontPresentationEvent,
  type StorefrontPresentationPhase,
} from './storefrontPresentation'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Owns only the visual cover over portal storefronts. Passage traversal,
 * navigation, collision, and door lifecycle remain outside this hook.
 */
export function useStorefrontPresentation(scene: MainlineSceneDefinition, position: Point, presentationReady = true) {
  const [approachReady, setApproachReady] = useState(presentationReady)
  useEffect(() => {
    if (!presentationReady) { setApproachReady(false); return }
    const timer = window.setTimeout(() => setApproachReady(true), storefrontEntryRevealDelayMs)
    return () => window.clearTimeout(timer)
  }, [presentationReady])
  const [phaseByStorefront, setPhaseByStorefront] = useState<ReadonlyMap<string, StorefrontPresentationPhase>>(new Map())
  const switchableStorefronts = useMemo(
    () => scene.storefronts.filter((storefront) => storefront.portalId && storefront.characterSwitch),
    [scene.storefronts],
  )
  const activeStorefrontId = activeStorefrontPresentationOwner(scene, position, presentationReady && approachReady)
  const interiorStorefrontId = activeStorefrontInteriorOwner(scene, position)
  const [retainedInteriorStorefrontIds, setRetainedInteriorStorefrontIds] = useState<string[]>(() => interiorStorefrontId ? [interiorStorefrontId] : [])
  const [paintedInteriorStorefrontId, setPaintedInteriorStorefrontId] = useState<string | null>(null)
  const previousInteriorStorefrontIdRef = useRef<string | null>(interiorStorefrontId)
  const currentInteriorStorefrontIdRef = useRef<string | null>(interiorStorefrontId)
  const interiorRetentionTimersRef = useRef(new Map<string, number>())
  const interiorMotionDuration = (storefrontId: string | null) => {
    if (!storefrontId) return sceneFrameDefaultMotionMs
    const storefront = scene.storefronts.find(candidate => candidate.id === storefrontId)
    const bounds = storefront && storefrontRoomConnection(scene, storefront)?.interiorRoom.bounds
    if (!bounds) return sceneFrameDefaultMotionMs
    // A room-level perimeter is an upper bound for every frame and label
    // contained by it, so the old room stays mounted until its slowest
    // interior animation can finish.
    return sceneFrameMotionMsForRect(
      bounds.width * sceneDesignReferenceMetrics.width / 100,
      bounds.height * sceneDesignReferenceMetrics.height / 100,
    )
  }
  useIsomorphicLayoutEffect(() => {
    currentInteriorStorefrontIdRef.current = interiorStorefrontId
    const previous = previousInteriorStorefrontIdRef.current
    previousInteriorStorefrontIdRef.current = interiorStorefrontId
    if (interiorStorefrontId) {
      const existingTimer = interiorRetentionTimersRef.current.get(interiorStorefrontId)
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer)
        interiorRetentionTimersRef.current.delete(interiorStorefrontId)
      }
    }
    setRetainedInteriorStorefrontIds(current => [...new Set([...current, previous, interiorStorefrontId].filter((id): id is string => Boolean(id)))])
    // Paint the collapsed/new owner state for one frame before changing the
    // owner. That gives CSS a real start point and lets rapid reversals keep
    // animating from the currently painted progress.
    const initialFrame = window.requestAnimationFrame(() => {
      setPaintedInteriorStorefrontId(interiorStorefrontId)
    })
    if (previous && previous !== interiorStorefrontId && !interiorRetentionTimersRef.current.has(previous)) {
      const timer = window.setTimeout(() => {
        interiorRetentionTimersRef.current.delete(previous)
        if (currentInteriorStorefrontIdRef.current !== previous) {
          setRetainedInteriorStorefrontIds(current => current.filter(id => id !== previous))
        }
      }, interiorMotionDuration(previous))
      interiorRetentionTimersRef.current.set(previous, timer)
    }
    return () => {
      if (initialFrame !== undefined) window.cancelAnimationFrame(initialFrame)
    }
  }, [interiorStorefrontId, scene])
  useEffect(() => () => {
    for (const timer of interiorRetentionTimersRef.current.values()) window.clearTimeout(timer)
    interiorRetentionTimersRef.current.clear()
  }, [])
  const visibleInteriorStorefrontIds = [...new Set([...retainedInteriorStorefrontIds, ...(interiorStorefrontId ? [interiorStorefrontId] : [])])]
  const nestedStorefrontIds = useMemo(() => {
    const parent = scene.storefronts.find(slot => slot.id === interiorStorefrontId)
    const room = parent && storefrontRoomConnection(scene, parent)?.interiorRoom
    return new Set(room ? scene.storefronts.filter(slot => storefrontRoomConnection(scene, slot)?.publicRoom.id === room.id).map(slot => slot.id) : [])
  }, [scene, interiorStorefrontId])
  const pinnedStorefrontId = nestedStorefrontIds.size ? interiorStorefrontId : null
  const handledOwnerRef = useRef<string | null | undefined>(undefined)
  const interiorPhaseOwnerRef = useRef<string | null>(null)
  const nearRef = useRef(new Map<string, boolean>())
  const departedAtRef = useRef(new Map<string, number>())
  nearRef.current = new Map(switchableStorefronts.map(storefront => [storefront.id, storefront.id === activeStorefrontId]))

  const transition = useCallback((storefrontId: string, event: StorefrontPresentationEvent) => {
    setPhaseByStorefront((current) => {
      const phase = current.get(storefrontId) ?? 'baseline'
      let nextPhase = nextStorefrontPresentationPhase(phase, event)
      if (event === 'reveal-motion-complete' && !nearRef.current.get(storefrontId)) nextPhase = 'lingering'
      if (event === 'restore-motion-complete' && nearRef.current.get(storefrontId)) nextPhase = 'retracting'
      if (nextPhase === phase) return current
      const next = new Map(current)
      next.set(storefrontId, nextPhase)
      return next
    })
  }, [])

  useEffect(() => {
    if (interiorStorefrontId && !pinnedStorefrontId) {
      interiorPhaseOwnerRef.current = interiorStorefrontId
      handledOwnerRef.current = null
      departedAtRef.current.clear()
      setPhaseByStorefront((current) => current.size === 1 && current.get(interiorStorefrontId) === 'revealed'
        ? current
        : new Map([[interiorStorefrontId, 'revealed']]))
      return
    }
    if (!interiorStorefrontId && interiorPhaseOwnerRef.current) {
      const previousInterior = interiorPhaseOwnerRef.current
      interiorPhaseOwnerRef.current = null
      handledOwnerRef.current = null
      departedAtRef.current.delete(previousInterior)
      transition(previousInterior, 'handoff')
      return
    }
    if (pinnedStorefrontId) {
      // Keep the outer shop revealed while a nested frontage uses the normal
      // approach/linger/restore lifecycle. Never hand the parent's frame off.
      setPhaseByStorefront(current => {
        const next = new Map([...current].filter(([id]) => id === pinnedStorefrontId || nestedStorefrontIds.has(id)))
        next.set(pinnedStorefrontId, 'revealed')
        return next.size === current.size && [...next].every(([id, phase]) => current.get(id) === phase) ? current : next
      })
      if (handledOwnerRef.current && !nestedStorefrontIds.has(handledOwnerRef.current)) handledOwnerRef.current = null
    }
    if (handledOwnerRef.current === activeStorefrontId) return
    const previousOwner = handledOwnerRef.current
    handledOwnerRef.current = activeStorefrontId
    if (previousOwner == null) {
      if (activeStorefrontId) {
        const outgoingOwner = storefrontPresentationHandoffSource(new Map([...phaseByStorefront].filter(([id]) => id !== pinnedStorefrontId)), activeStorefrontId)
        if (outgoingOwner) {
          departedAtRef.current.delete(outgoingOwner)
          transition(outgoingOwner, 'handoff')
        }
        departedAtRef.current.delete(activeStorefrontId)
        transition(activeStorefrontId, 'approach')
      }
      return
    }

    const previousPhase = phaseByStorefront.get(previousOwner) ?? 'baseline'
    departedAtRef.current.delete(previousOwner)
    if (activeStorefrontId) {
      transition(previousOwner, 'handoff')
      departedAtRef.current.delete(activeStorefrontId)
      transition(activeStorefrontId, 'approach')
      return
    }

    if (previousPhase !== 'baseline') departedAtRef.current.set(previousOwner, performance.now())
    transition(previousOwner, 'leave')
  }, [activeStorefrontId, interiorStorefrontId, pinnedStorefrontId, nestedStorefrontIds, phaseByStorefront, transition])

  // Product grace period belongs to presentation, not a CSS animation clock.
  useEffect(() => {
    const timers = [...phaseByStorefront].filter(([, phase]) => phase === 'lingering')
      .map(([id]) => {
        const now = performance.now()
        return window.setTimeout(() => transition(id, 'linger-animation-complete'),
          storefrontRestoreDelayMs(departedAtRef.current.get(id) ?? now, now))
      })
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [phaseByStorefront, transition])

  const completeRestoreMotion = useCallback((storefrontId: string) => {
    transition(storefrontId, 'restore-motion-complete')
  }, [transition])

  return {
    activeStorefrontId,
    phaseByStorefront,
    nearByStorefront: nearRef.current,
    visibleInteriorStorefrontIds,
    paintedInteriorStorefrontId,
    completeFrameRetraction: (storefrontId: string) => transition(storefrontId, 'frame-retracted'),
    completeRevealMotion: (storefrontId: string) => transition(storefrontId, 'reveal-motion-complete'),
    completeRestoreMotion,
  }
}
