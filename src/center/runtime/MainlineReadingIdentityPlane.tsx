import type { CSSProperties, ReactNode } from 'react'
import type { CollisionBox } from './sceneGeometry'
import { mainlineReadingWorldHeightPx, mainlineReadingWorldWidthPx } from './mainlineReadingOcclusion'

type Props = {
  entityId: string
  relatedEntityIds?: readonly string[]
  protectedEntityIds: ReadonlySet<string>
  worldBounds: CollisionBox
  hiddenIdentityKeys?: ReadonlySet<string>
  active?: boolean
  className?: string
  identityKey: string
  children: ReactNode
}

const emptyIdentityKeys: ReadonlySet<string> = new Set()

/** Stable, object-bounded wrapper. Its child coordinates are local to worldBounds. */
export function MainlineReadingIdentityPlane({ entityId, relatedEntityIds = [], protectedEntityIds, worldBounds, hiddenIdentityKeys = emptyIdentityKeys, active = true, className, identityKey, children }: Props) {
  const protectedTarget = protectedEntityIds.has(entityId) || relatedEntityIds.some(id => protectedEntityIds.has(id))
  const hidden = active && !protectedTarget && hiddenIdentityKeys.has(identityKey)
  const style: CSSProperties = {
    position: 'absolute',
    left: `${worldBounds.x / mainlineReadingWorldWidthPx * 100}%`,
    top: `${worldBounds.y / mainlineReadingWorldHeightPx * 100}%`,
    width: `${worldBounds.width / mainlineReadingWorldWidthPx * 100}%`,
    height: `${worldBounds.height / mainlineReadingWorldHeightPx * 100}%`,
    pointerEvents: 'none',
    opacity: hidden ? 0 : 1,
    transition: 'opacity 400ms ease-in-out',
  }
  return <div
    className={className ?? 'scene-mainline-reading-identity-plane'}
    data-reading-occlusion-entity-id={entityId}
    data-reading-occlusion-key={identityKey}
    data-reading-occlusion-protected={protectedTarget ? 'true' : undefined}
    data-reading-occlusion-hidden={hidden ? 'true' : undefined}
    data-reading-world-bounds={`${worldBounds.x},${worldBounds.y},${worldBounds.width},${worldBounds.height}`}
    aria-hidden={hidden ? true : undefined}
    inert={hidden ? true : undefined}
    style={style}
  >
    {children}
  </div>
}
