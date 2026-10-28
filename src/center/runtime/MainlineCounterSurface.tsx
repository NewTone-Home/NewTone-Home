import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, TransitionEvent } from 'react'
import type { MainlineContinuousStructure, MainlineSceneEntity } from './mainlineSceneModel'
import { counterOutlineGeometry } from './counterOutlineGeometry'
import { sceneFrameMotionMsForRect } from './sceneMotion'

type Props = {
  parts: readonly MainlineContinuousStructure[]
  objects: readonly MainlineSceneEntity[]
  onInteract: (id: string) => void
  onCounterInteract?: (serviceId: string, partId: string, point: { x: number; y: number }) => void
  presentationActive?: boolean
  boundedWrapper?: boolean
  coordinateBounds?: { x: number; y: number; width: number; height: number }
}

function CounterSurface({ parts, objects, onInteract, onCounterInteract, presentationActive, boundedWrapper = false, coordinateBounds }: Props) {
  const active = presentationActive !== false
  const animatedPresentation = presentationActive !== undefined
  const enteredInactive = useRef(!active)
  const outlinePathRef = useRef<SVGPathElement | null>(null)
  const [qrRevealReady, setQrRevealReady] = useState(!animatedPresentation)
  useEffect(() => {
    if (!animatedPresentation) { setQrRevealReady(true); return }
    if (!active) {
      enteredInactive.current = true
      setQrRevealReady(false)
      return
    }
    // A refresh or first mount inside the room has no preceding dash-offset
    // transition: the outline is already complete, so begin the QR fade now.
    if (!enteredInactive.current) setQrRevealReady(true)
  }, [active, animatedPresentation])
  useLayoutEffect(() => {
    if (!animatedPresentation || !active) return
    const path = outlinePathRef.current
    if (!path) return
    const style = getComputedStyle(path)
    const durationMs = Math.max(...style.transitionDuration.split(',').map(value => {
      const part = value.trim()
      return part.endsWith('ms') ? Number.parseFloat(part) : Number.parseFloat(part) * 1000
    }))
    const offset = Number.parseFloat(style.strokeDashoffset)
    // Zero-duration transitions emit no transitionend. Reveal only when the
    // computed outline has already reached its actual terminal offset.
    if (durationMs === 0 && offset === 0) {
      enteredInactive.current = false
      setQrRevealReady(true)
    }
  }, [active, animatedPresentation, qrRevealReady])
  const rectangles = useMemo(() => parts.map(part => ({ x: part.x * 19.2, y: part.y * 10.8, width: part.width * 19.2, height: part.height * 10.8 })), [parts])
  const outlineRectangles = useMemo(() => parts.map((part, index) => {
    const box = part.counterSurface!.outlineBounds
    return box ? { x: box.x * 19.2, y: box.y * 10.8, width: box.width * 19.2, height: box.height * 10.8 } : rectangles[index]
  }), [parts, rectangles])
  const geometry = useMemo(() => counterOutlineGeometry(outlineRectangles), [outlineRectangles])
  const { bounds } = geometry
  const frameBounds = coordinateBounds ?? bounds
  const presentationDurationMs = sceneFrameMotionMsForRect(bounds.width, bounds.height)
  const activate = (event: { stopPropagation: () => void }, id: string) => { event.stopPropagation(); onInteract(id) }
  const activatePart = (event: MouseEvent<SVGElement | HTMLButtonElement>, serviceId: string, partId: string) => {
    event.stopPropagation()
    const svg = event.currentTarget.closest('svg')
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix || !onCounterInteract || event.detail === 0) { onInteract(serviceId); return }
    const point = svg.createSVGPoint()
    point.x = event.clientX; point.y = event.clientY
    const local = point.matrixTransform(matrix.inverse())
    onCounterInteract(serviceId, partId, { x: (bounds.x + local.x) / 19.2, y: (bounds.y + local.y) / 10.8 })
  }
  const keyboard = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event, id) }
  }
  const group = parts[0].counterSurface!.groupId
  const labelStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 16, fontFamily: 'inherit', fontWeight: 'inherit', letterSpacing: 0, lineHeight: 1, color: 'inherit', background: 'none', border: 0, padding: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }
  const finishCounterDraw = (event: TransitionEvent<SVGPathElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'stroke-dashoffset' || !active) return
    enteredInactive.current = false
    setQrRevealReady(true)
  }
  const finishCanceledCounterDraw = (event: TransitionEvent<SVGPathElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'stroke-dashoffset' || !active) return
    const offset = Number.parseFloat(getComputedStyle(event.currentTarget).strokeDashoffset)
    if (Number.isFinite(offset) && offset === 0) finishCounterDraw(event)
  }
  return <svg data-counter-outline-group={group} data-interior-active={animatedPresentation ? active ? 'true' : 'false' : undefined} data-surface-role={parts[0].counterSurface!.role ?? 'counter'} aria-label={parts[0].counterSurface!.label ?? '柜台'} role="group" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="none" style={{ position: 'absolute', left: boundedWrapper ? `${(bounds.x - frameBounds.x) / frameBounds.width * 100}%` : `${bounds.x / 19.2}%`, top: boundedWrapper ? `${(bounds.y - frameBounds.y) / frameBounds.height * 100}%` : `${bounds.y / 10.8}%`, width: boundedWrapper ? `${bounds.width / frameBounds.width * 100}%` : `${bounds.width / 19.2}%`, height: boundedWrapper ? `${bounds.height / frameBounds.height * 100}%` : `${bounds.height / 10.8}%`, overflow: 'visible', pointerEvents: 'none', zIndex: 3, color: 'var(--interaction-normal)', opacity: .9 }}>
    {parts.map((part, index) => {
      const box = rectangles[index], hitBox = outlineRectangles[index], meta = part.counterSurface!, vertical = meta.orientation === 'vertical'
      const interactionId = objects.find(object => object.id === meta.interactionEntityId)?.interactionAliasId ?? meta.interactionEntityId
      const label = meta.label ?? '柜台', length = Array.from(label).length
      const labelWidth = vertical ? 16 : length * 16, labelHeight = vertical ? length * 16 : 16
      return <g key={part.id}>
        <rect data-counter-part-id={part.id} data-counter-interaction-id={interactionId} x={hitBox.x - bounds.x} y={hitBox.y - bounds.y} width={hitBox.width} height={hitBox.height} fill="transparent" style={{ pointerEvents: active ? 'all' : 'none', cursor: 'pointer' }} role="button" tabIndex={active ? 0 : -1} aria-label={label} onClick={event => activatePart(event, interactionId, meta.interactionEntityId)} onKeyDown={event => keyboard(event, interactionId)} />
        {!meta.hideLabel && <foreignObject x={box.x + box.width / 2 - labelWidth / 2 - bounds.x} y={box.y + box.height / 2 - labelHeight / 2 - bounds.y} width={labelWidth} height={labelHeight} style={{ overflow: 'visible', pointerEvents: active ? 'all' : 'none', opacity: active ? 1 : 0, transition: animatedPresentation ? `opacity ${presentationDurationMs}ms ease-in-out` : undefined }}>
          <button className="scene-counter-label" data-counter-label={meta.orientation} data-object-id={meta.labelEntityId} style={labelStyle} onClick={event => activatePart(event, interactionId, meta.interactionEntityId)} aria-label={label}><span style={{ writingMode: vertical ? 'vertical-rl' : 'horizontal-tb', textOrientation: 'upright', lineHeight: 1 }}>{label}</span></button>
        </foreignObject>}
      </g>
    })}
    {parts.flatMap(part => (part.counterSurface!.services ?? []).filter(service => service.visual === 'app-square').map(service => (
      <foreignObject key={service.id} data-counter-service-box={service.id} x={service.position.x * 19.2 - bounds.x - (service.visual === 'app-square' ? 9 : 30)} y={service.position.y * 10.8 - bounds.y - (service.visual === 'app-square' ? 9 : 14)} width={service.visual === 'app-square' ? 18 : 60} height={service.visual === 'app-square' ? 18 : 28}>
        <button
          type="button"
          className="scene-counter-service"
          data-counter-service-id={service.id}
          data-counter-app-square={service.visual === 'app-square' ? 'true' : undefined}
          data-object-id={service.id}
          aria-label={service.label}
          aria-hidden={!qrRevealReady || undefined}
          tabIndex={active && qrRevealReady ? 0 : -1}
          onClick={event => activate(event, service.id)}
          style={{ ...labelStyle, opacity: active && qrRevealReady ? 1 : 0, transition: animatedPresentation ? 'opacity 350ms ease-in-out' : undefined, pointerEvents: active && qrRevealReady ? 'all' : 'none', border: '1px solid currentColor', background: 'rgba(18, 16, 13, .88)', fontSize: service.visual === 'app-square' ? 0 : 13, whiteSpace: 'nowrap' }}
        >{service.visual === 'app-square' ? <span aria-hidden="true" className="scene-counter-app-square" style={{ display: 'block', width: 10, height: 10, border: '1px solid currentColor', background: 'repeating-linear-gradient(0deg, transparent 0 2px, currentColor 2px 3px)' }} /> : service.label}</button>
      </foreignObject>
    )))}
    <path ref={outlinePathRef} data-counter-outline-path={group} d={geometry.path} fill="none" stroke="currentColor" strokeWidth={1} strokeLinejoin="miter" pathLength={animatedPresentation ? 1 : undefined} strokeDasharray={animatedPresentation ? 1 : undefined} strokeDashoffset={animatedPresentation && !active ? 1 : 0} onTransitionEnd={finishCounterDraw} onTransitionCancel={finishCanceledCounterDraw} style={{ pointerEvents: 'none', transition: animatedPresentation ? `stroke-dashoffset ${presentationDurationMs}ms ease-in-out` : undefined }} />
  </svg>
}

export const MainlineCounterSurface = memo(CounterSurface)
