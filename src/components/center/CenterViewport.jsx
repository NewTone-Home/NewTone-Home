import { useState } from 'react'
import CenterRegion from './CenterRegion'

function CenterViewport({ navigation }) {
  const [layerSeparation, setLayerSeparation] = useState(0)
  const {
    currentNode,
    currentNodeId,
    children,
    focusedNode,
    detailNode,
    selectedContentId,
    hoveringNodeId,
    hoverProgress,
    cursor,
    edgeIntent,
    camera,
    beginHover,
    endHover,
    keepFocus,
    cancelFocus,
    openDetail,
    closeDetail,
    setSelectedContentId,
    goBack,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = navigation

  const isOverview = currentNodeId === 'known-country'
  const surfaceNodes = isOverview ? children.filter(node => node.world === 'surface') : []
  const innerNodes = isOverview ? children.filter(node => node.world === 'inner') : children
  const worldStyle = {
    '--camera-x': `${camera.x}px`,
    '--camera-y': `${camera.y}px`,
    '--layer-separation': layerSeparation,
  }

  const renderNode = node => (
    <CenterRegion
      key={node.id}
      node={node}
      focused={focusedNode?.id === node.id}
      onHoverStart={beginHover}
      onHoverEnd={endHover}
      onKeepFocus={keepFocus}
      onOpenDetail={openDetail}
    />
  )

  return (
    <section
      className={`center-viewport${detailNode ? ' has-detail' : ''}${edgeIntent ? ` has-edge-${edgeIntent}` : ''}`}
      aria-label={currentNode.title}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={event => event.preventDefault()}
      onClick={cancelFocus}
    >
      <div className="center-world-stage" style={worldStyle}>
        {isOverview ? (
          <div className="center-world-model" aria-label="表里世界重叠图谱">
            <div className="center-map-layer center-map-layer--inner">
              <span className="center-map-layer-label">里世界</span>
              <div className="center-map-surface" aria-hidden="true" />
              <div className="center-layer-nodes">{innerNodes.map(renderNode)}</div>
            </div>

            <div className="center-world-link" aria-hidden="true">
              <span />
            </div>

            <div className="center-map-layer center-map-layer--surface">
              <span className="center-map-layer-label">表世界</span>
              <div className="center-map-surface" aria-hidden="true" />
              <div className="center-layer-nodes">{surfaceNodes.map(renderNode)}</div>
            </div>
          </div>
        ) : (
          <div className="center-map-layer center-map-layer--current">
            <span className="center-map-layer-label">{currentNode.world === 'surface' ? '表世界' : '里世界'}</span>
            <div className="center-map-surface" aria-hidden="true" />
            <div className="center-layer-nodes">{children.map(renderNode)}</div>
          </div>
        )}
      </div>

      {isOverview && (
        <label className="center-layer-control" onClick={event => event.stopPropagation()}>
          <span>{layerSeparation > 0.55 ? '收拢层级' : '展开层级'}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={layerSeparation}
            onChange={event => setLayerSeparation(Number(event.target.value))}
            aria-label="拉开表里世界层级"
          />
        </label>
      )}

      {cursor.visible && hoveringNodeId && (
        <div
          className="center-cursor-progress"
          style={{
            left: `${cursor.x}px`,
            top: `${cursor.y}px`,
            '--hover-progress': hoverProgress,
          }}
          aria-hidden="true"
        >
          <span />
        </div>
      )}

      {detailNode && (
        <aside
          className="center-detail-panel"
          data-center-annotation
          onClick={event => event.stopPropagation()}
          onMouseEnter={keepFocus}
        >
          <button type="button" className="center-detail-close" onClick={closeDetail}>收起</button>
          <p className="center-detail-world">{detailNode.world === 'surface' ? '表世界' : '里世界'}</p>
          <h2>{detailNode.title}</h2>
          <p className="center-detail-description">{detailNode.description}</p>

          <div className="center-detail-options" role="list">
            {detailNode.contentOptions?.map(option => (
              <button
                key={option.id}
                type="button"
                className={`center-detail-option${selectedContentId === option.id ? ' is-selected' : ''}`}
                disabled={option.locked}
                onClick={() => !option.locked && setSelectedContentId(option.id)}
              >
                <span>{option.title}</span>
                <small>{option.description}</small>
                {option.locked && <em>尚未开放</em>}
              </button>
            ))}
          </div>
          {selectedContentId && <p className="center-detail-action">继续下滑进入所选内容</p>}
        </aside>
      )}

      <div className="center-edge center-edge--top" aria-hidden="true">
        <span>向上滑动 · 返回入口</span>
      </div>
      <div className="center-edge center-edge--bottom" aria-hidden="true">
        <span>向下滑动 · 继续阅读</span>
      </div>

      <div className="center-layer-caption" aria-live="polite">
        <span>{currentNode.title}</span>
        {!isOverview && (
          <button type="button" onClick={(event) => { event.stopPropagation(); goBack() }}>
            返回上一层
          </button>
        )}
      </div>

      <div className="center-gesture-hint" aria-hidden="true">
        <span>右键拖动查看周围</span>
        <span>悬停批注 · 下滑直达 · 点击细看</span>
      </div>
    </section>
  )
}

export default CenterViewport
