const SURFACE_OVERVIEW_HIT_AREAS = {
  'surface-estate': {
    x: 13.4,
    y: 15.6,
    width: 17.5,
    height: 17.2,
  },
  'surface-council': {
    x: 57.5,
    y: 42.5,
    width: 16.0,
    height: 17.6,
  },
}

const SURFACE_OUTLINE_STYLES = `
  .center-region--surface-dot .center-region-title,
  .center-region--surface-dot .center-region-shape {
    opacity: 0;
  }

  .center-region--surface-dot .center-region-surface-outline {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border: 1px solid rgba(111, 79, 51, 0);
    border-radius: 4px 7px 5px 6px;
    opacity: 0;
    pointer-events: none;
    transform: scale(0.985) rotate(-0.18deg);
    transition:
      opacity 360ms ease,
      border-color 360ms ease,
      box-shadow 420ms ease,
      transform 420ms ease,
      background-color 420ms ease;
  }

  .center-region--surface-dot .center-region-surface-outline::after {
    content: '';
    position: absolute;
    inset: 2px -1px -1px 2px;
    border: 1px solid rgba(125, 91, 59, 0);
    border-radius: 6px 4px 7px 5px;
    transform: rotate(0.32deg);
    transition: border-color 360ms ease;
  }

  .center-region--surface-dot:hover .center-region-surface-outline,
  .center-region--surface-dot.is-focused .center-region-surface-outline {
    opacity: 1;
    border-color: rgba(137, 91, 52, 0.72);
    background-color: rgba(255, 245, 222, 0.055);
    box-shadow:
      0 0 0 1px rgba(255, 247, 225, 0.36),
      0 0 14px rgba(188, 126, 72, 0.34),
      inset 0 0 16px rgba(255, 238, 201, 0.12);
    transform: scale(1) rotate(-0.18deg);
  }

  .center-region--surface-dot:hover .center-region-surface-outline::after,
  .center-region--surface-dot.is-focused .center-region-surface-outline::after {
    border-color: rgba(112, 76, 47, 0.38);
  }

  .center-region--surface-dot[data-center-node-id='surface-estate'] .center-region-surface-outline {
    animation: surface-landmark-intro 1300ms ease 520ms both;
  }

  .center-region--surface-dot[data-center-node-id='surface-council'] .center-region-surface-outline {
    animation: surface-landmark-intro 1300ms ease 1120ms both;
  }

  .center-region--surface-dot:hover .center-region-surface-outline,
  .center-region--surface-dot.is-focused .center-region-surface-outline {
    animation: none;
  }

  @keyframes surface-landmark-intro {
    0%, 100% {
      opacity: 0;
      border-color: rgba(137, 91, 52, 0);
      box-shadow: none;
      transform: scale(0.985) rotate(-0.18deg);
    }
    38%, 66% {
      opacity: 0.82;
      border-color: rgba(137, 91, 52, 0.54);
      box-shadow:
        0 0 0 1px rgba(255, 247, 225, 0.22),
        0 0 12px rgba(188, 126, 72, 0.25),
        inset 0 0 14px rgba(255, 238, 201, 0.08);
      transform: scale(1) rotate(-0.18deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .center-region--surface-dot .center-region-surface-outline {
      animation: none !important;
      transition-duration: 0ms;
    }
  }
`

function CenterRegion({
  node,
  focused,
  annotationLeaving,
  onHoverStart,
  onHoverEnd,
  onKeepFocus,
  onOpenDetail,
  className = '',
}) {
  const nodeState = node.state ?? 'sensed'
  const revealState = node.reveal ?? 'sensed'
  const isSurfaceOverviewNode = className.includes('center-region--surface-dot')
  const hitArea = isSurfaceOverviewNode ? SURFACE_OVERVIEW_HIT_AREAS[node.id] : null
  const style = {
    '--node-x': `${hitArea?.x ?? node.x}%`,
    '--node-y': `${hitArea?.y ?? node.y}%`,
    '--node-width': `${hitArea?.width ?? node.width}%`,
    '--node-height': `${hitArea?.height ?? node.height}%`,
  }

  return (
    <>
      {isSurfaceOverviewNode && <style>{SURFACE_OUTLINE_STYLES}</style>}
      <div
        className={`center-region center-region--${node.type} center-region--state-${nodeState}${focused ? ' is-focused' : ''}${annotationLeaving ? ' is-annotation-leaving' : ''} ${className}`}
        style={style}
        data-world={node.world}
        data-state={nodeState}
        data-reveal={revealState}
        data-center-node-id={node.id}
        onMouseEnter={event => onHoverStart(node.id, event)}
        onMouseLeave={onHoverEnd}
      >
        <span className="center-region-shape" aria-hidden="true" />
        {isSurfaceOverviewNode && <span className="center-region-surface-outline" aria-hidden="true" />}
        <span className="center-region-title">{node.title}</span>

        {focused && (
          <div className="center-region-annotation" data-center-annotation>
            <span className="center-region-annotation-stroke" aria-hidden="true" />
            <button
              type="button"
              className="center-region-annotation-target"
              onMouseEnter={onKeepFocus}
              onClick={(event) => {
                event.stopPropagation()
                onOpenDetail(node.id)
              }}
            >
              <span className="center-region-annotation-title">{node.title}</span>
              <span className="center-region-annotation-copy">{node.annotation ?? node.description}</span>
              <span className="center-region-annotation-hint">点击细看</span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default CenterRegion
