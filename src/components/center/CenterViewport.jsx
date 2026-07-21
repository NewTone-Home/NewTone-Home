import CenterRegion from './CenterRegion'

function CenterViewport({ navigation }) {
  const {
    currentNode,
    children,
    focusedNode,
    camera,
    beginHover,
    endHover,
    focusNode,
    cancelFocus,
    enterFocused,
    goBack,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = navigation

  return (
    <section
      className="center-viewport"
      aria-label={currentNode.title}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={event => event.preventDefault()}
      onClick={cancelFocus}
    >
      <div
        className="center-map-plane"
        style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0)` }}
      >
        <div className="center-world-layer center-world-layer--surface" aria-hidden="true">
          <span>表</span>
        </div>
        <div className="center-world-layer center-world-layer--inner" aria-hidden="true">
          <span>里</span>
        </div>

        {children.map(node => (
          <CenterRegion
            key={node.id}
            node={node}
            focused={focusedNode?.id === node.id}
            onHoverStart={beginHover}
            onHoverEnd={endHover}
            onFocus={focusNode}
          />
        ))}
      </div>

      <div className="center-layer-caption" aria-live="polite">
        <span>{currentNode.title}</span>
        {currentNode.id !== 'known-country' && (
          <button type="button" onClick={(event) => { event.stopPropagation(); goBack() }}>
            返回上一层
          </button>
        )}
      </div>

      {focusedNode && (
        <aside className="center-focus-note" onClick={event => event.stopPropagation()}>
          <p className="center-focus-world">{focusedNode.world === 'surface' ? '表世界' : focusedNode.world === 'inner' ? '里世界' : '已知事件'}</p>
          <h2>{focusedNode.title}</h2>
          <p>{focusedNode.description}</p>
          <p className="center-focus-status">
            {focusedNode.type === 'locked'
              ? '已发现 · 尚未开放'
              : focusedNode.nodes.length > 0
                ? '继续下滑进入'
                : '当前没有可深入内容'}
          </p>
          {focusedNode.nodes.length > 0 && focusedNode.type !== 'locked' && (
            <button type="button" onClick={enterFocused}>进入</button>
          )}
        </aside>
      )}

      <div className="center-gesture-hint" aria-hidden="true">
        <span>右键拖动查看周围</span>
        <span>悬停聚焦 · 下滑进入 · 上滑返回</span>
      </div>
    </section>
  )
}

export default CenterViewport
