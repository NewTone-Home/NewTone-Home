import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { CollisionBox } from './sceneGeometry'
import { mainlineReadingLocalFadeMask, mainlineReadingWorldHeightPx, mainlineReadingWorldWidthPx, type MainlineReadingProtectionRect } from './mainlineReadingOcclusion'

type Props = {
  entityId: string
  relatedEntityIds?: readonly string[]
  protectedEntityIds: ReadonlySet<string>
  worldBounds: CollisionBox
  hiddenIdentityKeys?: ReadonlySet<string>
  active?: boolean
  className?: string
  identityKey: string
  stageFaded?: boolean
  observationProtectionRects?: readonly MainlineReadingProtectionRect[]
  continuousObservationProtection?: boolean
  children: ReactNode
}

const emptyIdentityKeys: ReadonlySet<string> = new Set()

/** Stable, object-bounded wrapper. Its child coordinates are local to worldBounds. */
export function MainlineReadingIdentityPlane({ entityId, relatedEntityIds = [], protectedEntityIds, worldBounds, hiddenIdentityKeys = emptyIdentityKeys, active = true, className, identityKey, stageFaded, observationProtectionRects, continuousObservationProtection = false, children }: Props) {
  const protectedTarget = protectedEntityIds.has(entityId) || relatedEntityIds.some(id => protectedEntityIds.has(id))
  const planeRef = useRef<HTMLDivElement>(null)
  const [localFadeMask, setLocalFadeMask] = useState<string | null>(null)
  useLayoutEffect(() => {
    const element = planeRef.current
    const bounds = element?.getBoundingClientRect()
    const next = active && !protectedTarget && observationProtectionRects?.length && bounds
      ? mainlineReadingLocalFadeMask(bounds, observationProtectionRects, 8, 8, continuousObservationProtection)
      : null
    setLocalFadeMask(current => current === next ? current : next)
  }, [active, continuousObservationProtection, observationProtectionRects, protectedTarget, worldBounds])
  const hidden = active && !protectedTarget && !localFadeMask && hiddenIdentityKeys.has(identityKey)
  const style: CSSProperties = {
    position: 'absolute',
    left: `${worldBounds.x / mainlineReadingWorldWidthPx * 100}%`,
    top: `${worldBounds.y / mainlineReadingWorldHeightPx * 100}%`,
    width: `${worldBounds.width / mainlineReadingWorldWidthPx * 100}%`,
    height: `${worldBounds.height / mainlineReadingWorldHeightPx * 100}%`,
    pointerEvents: 'none',
    opacity: hidden || stageFaded ? 0 : 1,
    transition: `opacity ${stageFaded === undefined ? 400 : 380}ms ease-in-out`,
    ...(localFadeMask ? {
      maskImage: localFadeMask,
      WebkitMaskImage: localFadeMask,
      maskMode: 'alpha',
      maskComposite: 'intersect',
      WebkitMaskComposite: 'source-in',
    } as CSSProperties : {}),
  }
  return <div
    ref={planeRef}
    className={className ?? 'scene-mainline-reading-identity-plane'}
    data-reading-occlusion-entity-id={entityId}
    data-reading-occlusion-key={identityKey}
    data-reading-occlusion-protected={protectedTarget ? 'true' : undefined}
    data-reading-occlusion-hidden={hidden ? 'true' : undefined}
    data-reading-observation-fade={localFadeMask ? 'true' : undefined}
    data-reading-world-bounds={`${worldBounds.x},${worldBounds.y},${worldBounds.width},${worldBounds.height}`}
    aria-hidden={hidden ? true : undefined}
    inert={hidden ? true : undefined}
    style={style}
  >
    {children}
  </div>
}
