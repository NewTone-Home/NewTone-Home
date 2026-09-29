'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import {
  nextStorefrontPresentationPhase,
  storefrontPresentationShouldReveal,
  type StorefrontPresentationEvent,
  type StorefrontPresentationPhase,
} from './storefrontPresentation'

/**
 * Owns only the visual cover over portal storefronts. Passage traversal,
 * navigation, collision, and door lifecycle remain outside this hook.
 */
export function useStorefrontPresentation(scene: MainlineSceneDefinition, position: Point) {
  const [phaseByStorefront, setPhaseByStorefront] = useState<ReadonlyMap<string, StorefrontPresentationPhase>>(new Map())
  const portalStorefronts = useMemo(() => scene.storefronts.filter((storefront) => storefront.portalId), [scene.storefronts])
  const approachSignature = portalStorefronts
    .map((storefront) => `${storefront.id}:${storefrontPresentationShouldReveal(scene, storefront, position) ? 1 : 0}`)
    .join('|')
  const handledApproachSignatureRef = useRef<string | null>(null)

  const transition = useCallback((storefrontId: string, event: StorefrontPresentationEvent) => {
    setPhaseByStorefront((current) => {
      const phase = current.get(storefrontId) ?? 'baseline'
      const nextPhase = nextStorefrontPresentationPhase(phase, event)
      if (nextPhase === phase) return current
      const next = new Map(current)
      next.set(storefrontId, nextPhase)
      return next
    })
  }, [])

  useEffect(() => {
    const signature = `${scene.id}|${approachSignature}`
    if (handledApproachSignatureRef.current === signature) return
    handledApproachSignatureRef.current = signature
    portalStorefronts.forEach((storefront) => {
      const nearApproach = storefrontPresentationShouldReveal(scene, storefront, position)
      if (nearApproach) {
        transition(storefront.id, 'approach')
        return
      }
      transition(storefront.id, 'leave')
    })
  }, [approachSignature, portalStorefronts, scene, transition])

  return {
    phaseByStorefront,
    completeRevealMotion: (storefrontId: string) => transition(storefrontId, 'reveal-motion-complete'),
    completeLingerAnimation: (storefrontId: string) => transition(storefrontId, 'linger-animation-complete'),
    completeRestoreMotion: (storefrontId: string) => transition(storefrontId, 'restore-motion-complete'),
  }
}
