function CenterRegion({
  node,
  focused,
  hovering,
  hoverProgress,
  onHoverStart,
  onHoverEnd,
  onFocus,
}) {
  const style = {
    '--node-x': `${node.x}%`,
    '--node-y': `${node.y}%`,
    '--node-width': `${node.width}%`,
    '--node-height': `${node.height}%`,
    '--hover-progress': hovering ? hoverProgress : 0,
  }

  return (
    <button
      type="button"
      className={`center-region center-region--${node.type}${focused ? ' is-focused' : ''}${hovering ? ' is-hovering' : ''}`}
      style={style}
      data-world={node.world}
      data-center-node-id={node.id}
      onMouseEnter={() => onHoverStart(node.id)}
      onMouseLeave={onHoverEnd}
      onFocus={() => onFocus(node.id, true)}
      onClick={(event) => {
        event.stopPropagation()
        onFocus(node.id, true)
      }}
      aria-pressed={focused}
      aria-label={node.title}
    >
      <span className="center-region-shape" aria-hidden="true" />
      <span className="center-region-title">{node.title}</span>
      {hovering && (
        <span className="center-region-progress" aria-hidden="true">
          <span />
        </span>
      )}
    </button>
  )
}

export default CenterRegion
