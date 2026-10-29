import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { CollisionBox } from './sceneGeometry'
import { mainlineReadingWorldHeightPx, mainlineReadingWorldWidthPx, type MainlineReadingProtectionRect } from './mainlineReadingOcclusion'

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
  children: ReactNode
}

const emptyIdentityKeys: ReadonlySet<string> = new Set()

/** Stable, object-bounded wrapper. Its child coordinates are local to worldBounds. */
export function MainlineReadingIdentityPlane({ entityId, relatedEntityIds = [], protectedEntityIds, worldBounds, hiddenIdentityKeys = emptyIdentityKeys, active = true, className, identityKey, stageFaded, observationProtectionRects, children }: Props) {
  const protectedTarget = protectedEntityIds.has(entityId) || relatedEntityIds.some(id => protectedEntityIds.has(id))
  const planeRef = useRef<HTMLDivElement>(null)
  const uniqueId = useId().replace(/:/g, '')
  const localMaskId = `reading-local-${uniqueId}`
  const [localFadeRegions, setLocalFadeRegions] = useState<Array<{ key: string; x: number; y: number; width: number; height: number; active: boolean }>>([])
  const retirementTimersRef = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const element = planeRef.current
    const bounds = element?.getBoundingClientRect()
    const scaleX = bounds && element?.offsetWidth ? bounds.width / element.offsetWidth : 1
    const scaleY = bounds && element?.offsetHeight ? bounds.height / element.offsetHeight : 1
    const protectedRegions = active && !protectedTarget && observationProtectionRects?.length && bounds
      ? observationProtectionRects.filter(region => region.width > 0 && region.height > 0
          && region.x < bounds.right + 24 && region.x + region.width > bounds.left - 24
          && region.y < bounds.bottom + 24 && region.y + region.height > bounds.top - 24)
          .map(region => {
            const x = (region.x - bounds.left) / scaleX
            const y = (region.y - bounds.top) / scaleY
            const width = region.width / scaleX
            const height = region.height / scaleY
            const key = [x, y, width, height].map(value => Math.round(value)).join(':')
            return { key, x, y, width, height }
          })
      : []
    const protectedRegionMap = new Map(protectedRegions.map(region => [region.key, region]))
    const uniqueRegions = [...protectedRegionMap.values()]
    const currentKeys = new Set(protectedRegionMap.keys())
    setLocalFadeRegions(current => {
      const next = uniqueRegions.map(region => ({ ...region, active: true }))
      for (const oldRegion of current) {
        if (!currentKeys.has(oldRegion.key)) next.push({ ...oldRegion, active: false })
      }
      if (current.length === next.length && current.every((region, index) => {
        const candidate = next[index]!
        return region.key === candidate.key && region.active === candidate.active
          && Math.abs(region.x - candidate.x) < .25 && Math.abs(region.y - candidate.y) < .25
          && Math.abs(region.width - candidate.width) < .25 && Math.abs(region.height - candidate.height) < .25
      })) return current
      return next
    })
  }, [active, observationProtectionRects, protectedTarget, worldBounds])
  useLayoutEffect(() => {
    const activeKeys = new Set(localFadeRegions.filter(region => region.active).map(region => region.key))
    for (const [key, timer] of retirementTimersRef.current) {
      if (!activeKeys.has(key)) continue
      window.clearTimeout(timer)
      retirementTimersRef.current.delete(key)
    }
    for (const region of localFadeRegions) {
      if (region.active || retirementTimersRef.current.has(region.key)) continue
      const timer = window.setTimeout(() => {
        retirementTimersRef.current.delete(region.key)
        setLocalFadeRegions(current => current.filter(candidate => candidate.active || candidate.key !== region.key))
      }, 180)
      retirementTimersRef.current.set(region.key, timer)
    }
  }, [localFadeRegions])
  useEffect(() => () => {
    for (const timer of retirementTimersRef.current.values()) window.clearTimeout(timer)
    retirementTimersRef.current.clear()
  }, [])
  const hasLocalFadeRegions = localFadeRegions.length > 0
  const hidden = active && !protectedTarget && !hasLocalFadeRegions && hiddenIdentityKeys.has(identityKey)
  const style: CSSProperties = {
    position: 'absolute',
    left: `${worldBounds.x / mainlineReadingWorldWidthPx * 100}%`,
    top: `${worldBounds.y / mainlineReadingWorldHeightPx * 100}%`,
    width: `${worldBounds.width / mainlineReadingWorldWidthPx * 100}%`,
    height: `${worldBounds.height / mainlineReadingWorldHeightPx * 100}%`,
    pointerEvents: 'none',
    opacity: hidden || stageFaded ? 0 : 1,
    transition: `opacity ${stageFaded === undefined ? 400 : 380}ms ease-in-out`,
    ...(hasLocalFadeRegions ? { mask: `url(#${localMaskId})`, WebkitMask: `url(#${localMaskId})` } as CSSProperties : {}),
  }
  return <div
    ref={planeRef}
    className={className ?? 'scene-mainline-reading-identity-plane'}
    data-reading-occlusion-entity-id={entityId}
    data-reading-occlusion-key={identityKey}
    data-reading-occlusion-protected={protectedTarget ? 'true' : undefined}
    data-reading-occlusion-hidden={hidden ? 'true' : undefined}
    data-reading-observation-fade={hasLocalFadeRegions ? 'true' : undefined}
    data-reading-world-bounds={`${worldBounds.x},${worldBounds.y},${worldBounds.width},${worldBounds.height}`}
    aria-hidden={hidden ? true : undefined}
    inert={hidden ? true : undefined}
    style={style}
  >
    {hasLocalFadeRegions && <svg className="scene-reading-local-mask-defs" aria-hidden="true" width="0" height="0" viewBox={`0 0 ${Math.max(1, planeRef.current?.offsetWidth ?? worldBounds.width)} ${Math.max(1, planeRef.current?.offsetHeight ?? worldBounds.height)}`}>
      <defs>
        <filter id={`${localMaskId}-feather`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <mask id={localMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style={{ maskType: 'luminance' } as CSSProperties}>
          <rect x="0" y="0" width={Math.max(1, planeRef.current?.offsetWidth ?? worldBounds.width)} height={Math.max(1, planeRef.current?.offsetHeight ?? worldBounds.height)} fill="white" />
          <g fill="black" filter={`url(#${localMaskId}-feather)`}>
            {localFadeRegions.map(region => <rect key={region.key} className={region.active ? 'scene-reading-local-mask__region is-entering' : 'scene-reading-local-mask__region is-exiting'} x={region.x - 2} y={region.y - 2} width={region.width + 4} height={region.height + 4} rx="2" ry="2" />)}
          </g>
        </mask>
      </defs>
    </svg>}
    {children}
  </div>
}
