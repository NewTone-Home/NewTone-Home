function CenterRegion({
  node,
  focused,
  onHoverStart,
  onHoverEnd,
  onKeepFocus,
  onOpenDetail,
}) {
  const style = {
    '--node-x': `${node.x}%`,
    '--node-y': `${node.y}%`,
    '--node-width': `${node.width}%`,
    '--node-height': `${node.height}%`,
  }

  return (
    <div
      className={`center-region center-region--${node.type}${focused ? ' is-focused' : ''}`}
      style={style}
      data-world={node.world}
      data-center-node-id={node.id}
      onMouseEnter={event => onHoverStart(node.id, event)}
      onMouseLeave={onHoverEnd}
    >
      <span className="center-region-shape" aria-hidden="true" />
      <span className="center-region-title">{node.title}</span>

      {focused && (
        <button
          type="button"
          className="center-region-annotation"
          data-center-annotation
          onMouseEnter={onKeepFocus}
          onMouseLeave={onHoverEnd}
          onClick={(event) => {
            event.stopPropagation()
            onOpenDetail(node.id)
          }}
        >
          <span className="center-region-annotation-title">{node.title}</span>
          <span>{node.annotation ?? node.description}</span>
          <span className="center-region-annotation-action">下滑进入 · 点击查看</span>
        </button>
      )}
    </div>
  )
}

export default CenterRegion
