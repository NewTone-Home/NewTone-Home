import type { CSSProperties, ReactNode } from 'react'
import type { CollisionBox } from './sceneGeometry'
import { mainlineReadingLocalMaskBounds, mainlineReadingOcclusionIntersects, mainlineReadingWorldHeightPx, mainlineReadingWorldWidthPx, type MainlineReadingOcclusionRect } from './mainlineReadingOcclusion'

type Props = {
  entityId: string
  relatedEntityIds?: readonly string[]
  protectedEntityIds: ReadonlySet<string>
  worldBounds: CollisionBox
  readingRect?: MainlineReadingOcclusionRect | null
  maskBaseId?: string
  active?: boolean
  className?: string
  identityKey: string
  children: ReactNode
}

function safeId(value: string) {
  return `id-${Array.from(value).map(character => character.codePointAt(0)!.toString(16)).join('_')}`
}

/** Stable, object-bounded wrapper. Its child coordinates are local to worldBounds. */
export function MainlineReadingIdentityPlane({ entityId, relatedEntityIds = [], protectedEntityIds, worldBounds, readingRect, maskBaseId, active = true, className, identityKey, children }: Props) {
  const protectedTarget = protectedEntityIds.has(entityId) || relatedEntityIds.some(id => protectedEntityIds.has(id))
  const overlapsReading = Boolean(readingRect && maskBaseId && !protectedTarget && mainlineReadingOcclusionIntersects(worldBounds, readingRect))
  const localMaskId = overlapsReading ? `${maskBaseId}-${safeId(identityKey)}` : undefined
  const localMask = overlapsReading && localMaskId && readingRect ? mainlineReadingLocalMaskBounds(worldBounds, readingRect) : null
  const style: CSSProperties = {
    position: 'absolute',
    left: `${worldBounds.x / mainlineReadingWorldWidthPx * 100}%`,
    top: `${worldBounds.y / mainlineReadingWorldHeightPx * 100}%`,
    width: `${worldBounds.width / mainlineReadingWorldWidthPx * 100}%`,
    height: `${worldBounds.height / mainlineReadingWorldHeightPx * 100}%`,
    pointerEvents: 'none',
    ...(localMaskId ? { maskImage: `url(#${localMaskId})`, maskRepeat: 'no-repeat', WebkitMaskImage: `url(#${localMaskId})`, WebkitMaskRepeat: 'no-repeat' } : undefined),
  }
  return <div
    className={className ?? 'scene-mainline-reading-identity-plane'}
    data-reading-occlusion-entity-id={entityId}
    data-reading-occlusion-key={identityKey}
    data-reading-occlusion-protected={protectedTarget ? 'true' : undefined}
    data-reading-occlusion-masked={localMaskId ? 'true' : undefined}
    data-reading-world-bounds={`${worldBounds.x},${worldBounds.y},${worldBounds.width},${worldBounds.height}`}
    style={style}
  >
    {localMask && localMaskId && maskBaseId && <svg className="scene-reading-occlusion-defs" width={localMask.width} height={localMask.height} viewBox={`0 0 ${localMask.width} ${localMask.height}`} aria-hidden="true" focusable="false">
      <defs>
        <mask id={localMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="luminance" x="0" y="0" width={localMask.width} height={localMask.height}>
          <rect x="0" y="0" width={localMask.width} height={localMask.height} fill="white" />
          <use href={`#${maskBaseId}-shape`} transform={`translate(${localMask.x} ${localMask.y})`} style={{ opacity: active ? 1 : 0, transition: 'opacity 400ms linear' }} />
        </mask>
      </defs>
    </svg>}
    {children}
  </div>
}
