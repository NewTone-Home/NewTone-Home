import { memo, useMemo } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { MainlineContinuousStructure, MainlineSceneEntity } from './mainlineSceneModel'
import { counterOutlineGeometry } from './counterOutlineGeometry'

type Props = {
  parts: readonly MainlineContinuousStructure[]
  objects: readonly MainlineSceneEntity[]
  onInteract: (id: string) => void
  presentationActive?: boolean
}

function CounterSurface({ parts, onInteract, presentationActive }: Props) {
  const rectangles = useMemo(() => parts.map(part => ({ x: part.x * 19.2, y: part.y * 10.8, width: part.width * 19.2, height: part.height * 10.8 })), [parts])
  const outlineRectangles = useMemo(() => parts.map((part, index) => {
    const box = part.counterSurface!.outlineBounds
    return box ? { x: box.x * 19.2, y: box.y * 10.8, width: box.width * 19.2, height: box.height * 10.8 } : rectangles[index]
  }), [parts, rectangles])
  const geometry = useMemo(() => counterOutlineGeometry(outlineRectangles), [outlineRectangles])
  const { bounds } = geometry
  const activate = (event: { stopPropagation: () => void }, id: string) => { event.stopPropagation(); onInteract(id) }
  const keyboard = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event, id) }
  }
  const group = parts[0].counterSurface!.groupId
  const labelStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 16, fontFamily: 'inherit', fontWeight: 'inherit', letterSpacing: 0, lineHeight: 1, color: 'inherit', background: 'none', border: 0, padding: 0, cursor: 'pointer' }
  const active = presentationActive !== false
  const animatedPresentation = presentationActive !== undefined
  return <svg data-counter-outline-group={group} data-interior-active={animatedPresentation ? active ? 'true' : 'false' : undefined} data-surface-role={parts[0].counterSurface!.role ?? 'counter'} aria-label={parts[0].counterSurface!.label ?? '柜台'} role="group" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="none" style={{ position: 'absolute', left: `${bounds.x / 19.2}%`, top: `${bounds.y / 10.8}%`, width: `${bounds.width / 19.2}%`, height: `${bounds.height / 10.8}%`, overflow: 'visible', pointerEvents: 'none', zIndex: 3, color: 'var(--interaction-normal)', opacity: .9 }}>
    {parts.map((part, index) => {
      const box = rectangles[index], meta = part.counterSurface!, vertical = meta.orientation === 'vertical'
      const label = meta.label ?? '柜台', length = Array.from(label).length
      const labelWidth = vertical ? 16 : length * 16, labelHeight = vertical ? length * 16 : 16
      return <g key={part.id}>
        <rect data-counter-part-id={part.id} data-counter-interaction-id={meta.interactionEntityId} x={box.x - bounds.x} y={box.y - bounds.y} width={box.width} height={box.height} fill="transparent" style={{ pointerEvents: active ? 'all' : 'none', cursor: 'pointer' }} role="button" tabIndex={active ? 0 : -1} aria-label={label} onClick={event => activate(event, meta.interactionEntityId)} onKeyDown={event => keyboard(event, meta.interactionEntityId)} />
        {!meta.hideLabel && <foreignObject x={box.x + box.width / 2 - labelWidth / 2 - bounds.x} y={box.y + box.height / 2 - labelHeight / 2 - bounds.y} width={labelWidth} height={labelHeight} style={{ overflow: 'visible', pointerEvents: active ? 'all' : 'none', opacity: active ? 1 : 0, transition: animatedPresentation ? 'opacity 180ms linear' : undefined }}>
          <button data-counter-label={meta.orientation} data-object-id={meta.labelEntityId} style={labelStyle} onClick={event => activate(event, meta.interactionEntityId)} aria-label={label}><span style={{ writingMode: vertical ? 'vertical-rl' : 'horizontal-tb', textOrientation: 'upright', lineHeight: 1 }}>{label}</span></button>
        </foreignObject>}
      </g>
    })}
    <path data-counter-outline-path={group} d={geometry.path} fill="none" stroke="currentColor" strokeWidth={1} strokeLinejoin="miter" pathLength={animatedPresentation ? 1 : undefined} strokeDasharray={animatedPresentation ? 1 : undefined} strokeDashoffset={animatedPresentation && !active ? 1 : 0} style={{ pointerEvents: 'none', transition: animatedPresentation ? 'stroke-dashoffset 180ms ease-in-out' : undefined }} />
  </svg>
}

export const MainlineCounterSurface = memo(CounterSurface)
