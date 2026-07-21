function CenterRegion({ node, focused, onHoverStart, onHoverEnd, onFocus }) {
  const style = {
    '--node-x': `${node.x}%`,
    '--node-y': `${node.y}%`,
    '--node-width': `${node.width}%`,
    '--node-height': `${node.height}%`,
  }

  return (
    <button
      type="button"
      className={`center-region center-region--${node.type}${focused ? ' is-focused' : ''}`}
      style={style}
      data-world={node.world}
      onMouseEnter={() => onHoverStart(node.id)}
      onMouseLeave={onHoverEnd}
      onFocus={() => onFocus(node.id)}
      onClick={(event) => {
        event.stopPropagation()
        onFocus(node.id)
      }}
      aria-pressed={focused}
      aria-label={node.title}
    >
      <span className="center-region-shape" aria-hidden="true" />
      <span className="center-region-title">{node.title}</span>
    </button>
  )
}

export default CenterRegion
