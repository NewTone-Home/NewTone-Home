import type { CSSProperties, ReactNode } from 'react'

type Props = {
  entityId: string
  relatedEntityIds?: readonly string[]
  protectedEntityIds: ReadonlySet<string>
  maskStyle?: CSSProperties
  className?: string
  stackLevel?: number
  identityKey?: string
  children: ReactNode
}

/** A full-scene plane keeps the shared user-space mask aligned while applying it per visual identity. */
export function MainlineReadingIdentityPlane({ entityId, relatedEntityIds = [], protectedEntityIds, maskStyle, className, stackLevel, identityKey, children }: Props) {
  const protectedTarget = protectedEntityIds.has(entityId) || relatedEntityIds.some(id => protectedEntityIds.has(id))
  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    ...(stackLevel === undefined ? undefined : { zIndex: stackLevel }),
    ...(!protectedTarget ? maskStyle : undefined),
  }
  return <div
    className={className ?? 'scene-mainline-reading-identity-plane'}
    data-reading-occlusion-entity-id={entityId}
    data-reading-occlusion-key={identityKey}
    data-reading-occlusion-stack-level={stackLevel === undefined ? 'auto' : stackLevel}
    data-reading-occlusion-protected={protectedTarget ? 'true' : undefined}
    style={style}
  >{children}</div>
}
