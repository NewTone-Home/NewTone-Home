import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { CollisionBox } from './sceneGeometry'
import { mainlineReadingWorldHeightPx, mainlineReadingWorldWidthPx, type MainlineReadingProtectionRect } from './mainlineReadingOcclusion'
import { mainlineReadingAlphaCellSize, mainlineReadingAlphaEnterMs, mainlineReadingAlphaExitMs, mainlineReadingAlphaTransitionValue, rasterizeMainlineReadingAlphaField, type MainlineReadingAlphaCell } from './mainlineReadingLocalAlpha'

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

type AlphaCellState = Omit<MainlineReadingAlphaCell, 'target'> & {
  opacity: number
  from: number
  target: number
  startedAt: number
  duration: number
}

type RenderedAlphaCell = Pick<MainlineReadingAlphaCell, 'key' | 'x' | 'y' | 'width' | 'height'>

function ReadingAlphaCell({ cell, register }: { cell: RenderedAlphaCell; register: (key: string, element: SVGRectElement | null) => void }) {
  const ref = useCallback((element: SVGRectElement | null) => register(cell.key, element), [cell.key, register])
  return <rect ref={ref} data-reading-alpha-cell={cell.key} x={cell.x} y={cell.y} width={cell.width} height={cell.height} />
}

/** Stable, object-bounded wrapper. Its child coordinates are local to worldBounds. */
export function MainlineReadingIdentityPlane({ entityId, relatedEntityIds = [], protectedEntityIds, worldBounds, hiddenIdentityKeys = emptyIdentityKeys, active = true, className, identityKey, stageFaded, observationProtectionRects, children }: Props) {
  const protectedTarget = protectedEntityIds.has(entityId) || relatedEntityIds.some(id => protectedEntityIds.has(id))
  const planeRef = useRef<HTMLDivElement>(null)
  const uniqueId = useId().replace(/:/g, '')
  const localMaskId = `reading-local-${uniqueId}`
  const [renderedAlphaCells, setRenderedAlphaCells] = useState<RenderedAlphaCell[]>([])
  const alphaCellsRef = useRef(new Map<string, AlphaCellState>())
  const alphaCellElementsRef = useRef(new Map<string, SVGRectElement>())
  const alphaFrameRef = useRef<number | null>(null)
  const cellSize = mainlineReadingAlphaCellSize(worldBounds)
  const registerAlphaCell = useCallback((key: string, element: SVGRectElement | null) => {
    if (!element) { alphaCellElementsRef.current.delete(key); return }
    alphaCellElementsRef.current.set(key, element)
    element.setAttribute('opacity', String(alphaCellsRef.current.get(key)?.opacity ?? 0))
  }, [])

  const animateAlphaCells = (now: number) => {
    alphaFrameRef.current = null
    let needsAnotherFrame = false
    let removedAny = false
    for (const [key, cell] of alphaCellsRef.current) {
      if (cell.duration <= 0) continue
      const opacity = mainlineReadingAlphaTransitionValue(cell.from, cell.target, cell.startedAt, cell.duration, now)
      cell.opacity = opacity
      alphaCellElementsRef.current.get(key)?.setAttribute('opacity', String(opacity))
      if (now < cell.startedAt + cell.duration) needsAnotherFrame = true
      else if (cell.target <= .005 && opacity <= .005) {
        alphaCellsRef.current.delete(key)
        alphaCellElementsRef.current.delete(key)
        removedAny = true
      } else {
        cell.opacity = cell.target
        cell.from = cell.target
        cell.duration = 0
      }
    }
    if (removedAny) setRenderedAlphaCells([...alphaCellsRef.current.values()].map(({ key, x, y, width, height }) => ({ key, x, y, width, height })))
    if (needsAnotherFrame) alphaFrameRef.current = window.requestAnimationFrame(animateAlphaCells)
  }

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
            return { x, y, width, height }
          })
      : []
    const gridKey = `${cellSize.toFixed(4)}:${worldBounds.width.toFixed(3)}:${worldBounds.height.toFixed(3)}`
    const targets = new Map(rasterizeMainlineReadingAlphaField(worldBounds, protectedRegions, cellSize).map(cell => {
      const stableCell = { ...cell, key: `${gridKey}:${cell.key}` }
      return [stableCell.key, stableCell] as const
    }))
    const currentCells = alphaCellsRef.current
    const nextCells = new Map<string, AlphaCellState>()
    const now = performance.now()
    for (const key of new Set([...currentCells.keys(), ...targets.keys()])) {
      const previous = currentCells.get(key)
      const target = targets.get(key)
      const geometry = target ?? previous!
      const opacity = previous
        ? mainlineReadingAlphaTransitionValue(previous.from, previous.target, previous.startedAt, previous.duration, now)
        : 0
      const nextTarget = target?.target ?? 0
      const duration = Math.abs(nextTarget - opacity) < .005 ? 0 : nextTarget > opacity ? mainlineReadingAlphaEnterMs : mainlineReadingAlphaExitMs
      if (nextTarget <= .005 && opacity <= .005) continue
      nextCells.set(key, {
        key, x: geometry.x, y: geometry.y, size: geometry.size, width: geometry.width, height: geometry.height,
        opacity, from: opacity, target: nextTarget, startedAt: now, duration,
      })
    }
    alphaCellsRef.current = nextCells
    setRenderedAlphaCells([...nextCells.values()].map(({ key, x, y, width, height }) => ({ key, x, y, width, height })))
    if (alphaFrameRef.current === null && [...nextCells.values()].some(cell => Math.abs(cell.target - cell.opacity) >= .005)) {
      alphaFrameRef.current = window.requestAnimationFrame(animateAlphaCells)
    }
  }, [active, observationProtectionRects, protectedTarget, worldBounds.x, worldBounds.y, worldBounds.width, worldBounds.height])
  useEffect(() => () => {
    if (alphaFrameRef.current !== null) window.cancelAnimationFrame(alphaFrameRef.current)
    alphaFrameRef.current = null
    alphaCellsRef.current.clear()
    alphaCellElementsRef.current.clear()
  }, [])
  const hasLocalFadeRegions = renderedAlphaCells.length > 0
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
        <mask id={localMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style={{ maskType: 'luminance' } as CSSProperties}>
          <rect x="0" y="0" width={Math.max(1, planeRef.current?.offsetWidth ?? worldBounds.width)} height={Math.max(1, planeRef.current?.offsetHeight ?? worldBounds.height)} fill="white" />
          <g fill="black">{renderedAlphaCells.map(cell => <ReadingAlphaCell key={cell.key} cell={cell} register={registerAlphaCell} />)}</g>
        </mask>
      </defs>
    </svg>}
    {children}
  </div>
}
