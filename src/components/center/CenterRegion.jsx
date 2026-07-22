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
  )
}

export default CenterRegion
