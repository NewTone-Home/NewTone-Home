'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import {
  activeStorefrontPresentationOwner,
  nextStorefrontPresentationPhase,
  storefrontPresentationHandoffSource,
  storefrontRestoreDelayMs,
  type StorefrontPresentationEvent,
  type StorefrontPresentationPhase,
} from './storefrontPresentation'

/**
 * Owns only the visual cover over portal storefronts. Passage traversal,
 * navigation, collision, and door lifecycle remain outside this hook.
 */
export function useStorefrontPresentation(scene: MainlineSceneDefinition, position: Point) {
  const [phaseByStorefront, setPhaseByStorefront] = useState<ReadonlyMap<string, StorefrontPresentationPhase>>(new Map())
  const switchableStorefronts = useMemo(
    () => scene.storefronts.filter((storefront) => storefront.portalId && storefront.characterSwitch),
    [scene.storefronts],
  )
  const activeStorefrontId = activeStorefrontPresentationOwner(scene, position)
  const handledOwnerRef = useRef<string | null | undefined>(undefined)
  const activeOwnerRef = useRef<string | null>(activeStorefrontId)
  const pendingOwnerRef = useRef<string | null>(null)
  const nearRef = useRef(new Map<string, boolean>())
  const departedAtRef = useRef(new Map<string, number>())
  activeOwnerRef.current = activeStorefrontId
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
    if (handledOwnerRef.current === activeStorefrontId) return
    const previousOwner = handledOwnerRef.current
    handledOwnerRef.current = activeStorefrontId
    if (previousOwner == null) {
      if (activeStorefrontId) {
        const outgoingOwner = storefrontPresentationHandoffSource(phaseByStorefront, activeStorefrontId)
        const outgoingPhase = outgoingOwner ? phaseByStorefront.get(outgoingOwner) ?? 'baseline' : 'baseline'
        if (outgoingOwner) {
          pendingOwnerRef.current = activeStorefrontId
          departedAtRef.current.delete(outgoingOwner)
          transition(outgoingOwner, 'handoff')
          if (outgoingPhase === 'baseline' || outgoingPhase === 'retracting') {
            pendingOwnerRef.current = null
            departedAtRef.current.delete(activeStorefrontId)
            transition(activeStorefrontId, 'approach')
          }
        } else {
          pendingOwnerRef.current = null
          departedAtRef.current.delete(activeStorefrontId)
          transition(activeStorefrontId, 'approach')
        }
      }
      return
    }

    const previousPhase = phaseByStorefront.get(previousOwner) ?? 'baseline'
    departedAtRef.current.delete(previousOwner)
    if (activeStorefrontId) {
      pendingOwnerRef.current = activeStorefrontId
      transition(previousOwner, 'handoff')
      if (previousPhase === 'baseline' || previousPhase === 'retracting') {
        pendingOwnerRef.current = null
        departedAtRef.current.delete(activeStorefrontId)
        transition(activeStorefrontId, 'approach')
      }
      return
    }

    pendingOwnerRef.current = null
    if (previousPhase !== 'baseline') departedAtRef.current.set(previousOwner, performance.now())
    transition(previousOwner, 'leave')
  }, [activeStorefrontId, phaseByStorefront, transition])

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
    const pendingOwner = pendingOwnerRef.current
    if (pendingOwner && pendingOwner !== storefrontId && activeOwnerRef.current === pendingOwner) {
      pendingOwnerRef.current = null
      departedAtRef.current.delete(pendingOwner)
      transition(pendingOwner, 'approach')
    }
  }, [transition])

  return {
    activeStorefrontId,
    phaseByStorefront,
    nearByStorefront: nearRef.current,
    completeFrameRetraction: (storefrontId: string) => transition(storefrontId, 'frame-retracted'),
    completeRevealMotion: (storefrontId: string) => transition(storefrontId, 'reveal-motion-complete'),
    completeRestoreMotion,
  }
}
