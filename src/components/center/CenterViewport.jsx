import { useEffect, useRef, useState } from 'react'
import CenterRegion from './CenterRegion'
import SharedWorldMap from './SharedWorldMap'
import { centerMiniLandmarks } from '../../data/center/centerWorld'
import { sharedWorldGeometry } from '../../data/center/sharedWorldGeometry'
import SurfaceTextureLayer from './surface/SurfaceTextureLayer'
import SurfaceDebugOverlay from './surface/SurfaceDebugOverlay'
import SurfaceWorldPhaser from './surface/SurfaceWorldPhaser'
import mainCityArt from '../../assets/center/inner/main-city-v1.png'
import mineOutskirtsArt from '../../assets/center/inner/mine-outskirts-v2.png'
import councilInnerArt from '../../assets/center/inner/central-council-inner-v1.png'
import jijiaResidenceArt from '../../assets/center/surface/jijia-residence-courtyard-v1.png'
import councilSurfaceArt from '../../assets/center/surface/central-council-surface-v2.png'

const REGION_ART = {
  'surface-estate': jijiaResidenceArt,
  'inner-main-city': mainCityArt,
  'inner-mining-outskirts': mineOutskirtsArt,
  'surface-council': councilSurfaceArt,
  'inner-council': councilInnerArt,
}

const [, , VB_W, VB_H] = sharedWorldGeometry.viewBox.split(' ').map(Number)

function bindOverviewNodeToSharedAnchor(node) {
  const anchorId = centerMiniLandmarks[node.id]?.anchorId
  const anchor = anchorId ? sharedWorldGeometry.anchors[anchorId] : null
  if (!anchor) return node
  return {
    ...node,
    x: anchor.x / VB_W * 100,
    y: anchor.y / VB_H * 100,
  }
}

function InnerWorldLayers({ previewNodeId }) {
  return <SharedWorldMap world="inner" previewNodeId={previewNodeId} />
}

function CenterViewport({ navigation, viewportWidth, viewportHeight }) {
  const [layerSeparation, setLayerSeparation] = useState(0)
  const viewportRef = useRef(null)

  const {
    currentNode,
    currentNodeId,
    children,
    focusedNode,
    annotationLeaving,
    detailNode,
    detailClosing,
    selectedContentId,
    hoveringNodeId,
    hoverProgress,
    cursor,
    edgeIntent,
    camera,
    zoom,
    zoomNoticeVisible,
    previewNodeId,
    previewClosing,
    beginHover,
    endHover,
    keepFocus,
    cancelFocus,
    openDetail,
    closeDetail,
    resetViewForLayer,
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
  const innerActive = layerSeparation >= 0.12
  const splitComplete = layerSeparation >= 0.92
  const surfaceFocusedNode = isOverview && focusedNode?.world === 'surface' ? focusedNode : null

  useEffect(() => {
    resetViewForLayer()
  }, [currentNodeId, resetViewForLayer])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || isOverview) return undefined
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      viewport.removeEventListener('wheel', onWheel)
    }
  }, [isOverview, onWheel])

  useEffect(() => {
    resetViewForLayer()
  }, [viewportWidth, viewportHeight, resetViewForLayer])

  const stageStyle = {
    '--stage-width': `${viewportWidth}px`,
    '--stage-height': `${viewportHeight}px`,
    '--layer-separation': layerSeparation,
    '--surface-top': `${50 - layerSeparation * 20}%`,
    '--inner-top': `${50 + layerSeparation * 20}%`,
    '--surface-scale': 1,
    '--inner-scale': 1,
    '--inner-opacity': Math.max(0, (layerSeparation - 0.05) / 0.3),
    pointerEvents: isOverview ? 'none' : undefined,
  }

  const panStyle = {
    '--camera-x': `${isOverview ? 0 : camera.x}px`,
    '--camera-y': `${isOverview ? 0 : camera.y}px`,
  }

  const zoomStyle = {
    '--map-zoom': isOverview ? 1 : zoom,
  }

  const renderNode = node => {
    const positionedNode = isOverview ? bindOverviewNodeToSharedAnchor(node) : node
    return (
      <CenterRegion
        key={node.id}
        node={positionedNode}
        focused={focusedNode?.id === node.id}
        annotationLeaving={focusedNode?.id === node.id && annotationLeaving}
        onHoverStart={beginHover}
        onHoverEnd={endHover}
        onKeepFocus={keepFocus}
        onOpenDetail={nodeId => openDetail(nodeId, viewportRef.current)}
      />
    )
  }

  const annotationLeft = Math.min(
    Math.max(24, cursor.x + 28),
    Math.max(24, viewportWidth - 360),
  )
  const annotationTop = Math.min(
    Math.max(72, cursor.y - 26),
    Math.max(72, viewportHeight - 220),
  )

  return (
    <section
      ref={viewportRef}
      className={`center-viewport${detailNode ? ' has-detail' : ''}${detailClosing ? ' is-detail-closing' : ''}${previewNodeId ? ' has-landmark-preview' : ''}${previewClosing ? ' is-landmark-preview-closing' : ''}${edgeIntent ? ` has-edge-${edgeIntent}` : ''}${splitComplete ? ' is-split-complete' : ''}`}
      aria-label={currentNode.title}
      onPointerDown={isOverview ? undefined : onPointerDown}
      onPointerMove={isOverview ? undefined : onPointerMove}
      onPointerUp={isOverview ? undefined : onPointerUp}
      onPointerCancel={isOverview ? undefined : onPointerUp}
      onContextMenu={event => event.preventDefault()}
      onClick={cancelFocus}
    >
      {isOverview && (
        <SurfaceWorldPhaser
          nodes={surfaceNodes}
          onHoverStart={beginHover}
          onHoverEnd={endHover}
          onOpenDetail={nodeId => openDetail(nodeId, null)}
          onBlankClick={cancelFocus}
        />
      )}

      <div className="center-world-stage" style={stageStyle}>
        <div className="center-world-camera-pan" style={panStyle}>
          <div className="center-world-camera-zoom" style={zoomStyle}>
            {isOverview ? (
              <div className="center-world-model center-world-model--section" aria-label="表里世界分层图谱">
                <div
                  className={`center-map-layer center-map-layer--inner${innerActive ? ' is-interactive' : ''}`}
                  aria-hidden={!innerActive}
                >
                  <span className="center-map-layer-label">里世界</span>
                  <div className="center-map-surface" aria-hidden="true" />
                  <InnerWorldLayers previewNodeId={previewNodeId} />
                  <div className="center-layer-nodes">{innerNodes.map(renderNode)}</div>
                </div>

                <div className="center-map-layer center-map-layer--surface">
                  <span className="center-map-layer-label">表世界</span>
                  <SurfaceTextureLayer />
                </div>
              </div>
            ) : (
              <div className="center-map-layer center-map-layer--current is-interactive">
                <span className="center-map-layer-label">{currentNode.world === 'surface' ? '表世界' : '里世界'}</span>
                <div className="center-map-surface" aria-hidden="true" />
                {REGION_ART[currentNodeId] && (
                  <img
                    className="center-region-art"
                    src={REGION_ART[currentNodeId]}
                    alt=""
                    aria-hidden="true"
                  />
                )}
                <div className="center-layer-nodes">{children.map(renderNode)}</div>
              </div>
            )}
          </div>
        </div>
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
            zIndex: 30,
          }}
          aria-hidden="true"
        ><span /></div>
      )}

      {surfaceFocusedNode && !detailNode && (
        <div
          data-center-annotation
          style={{
            position: 'fixed',
            left: annotationLeft,
            top: annotationTop,
            zIndex: 35,
            pointerEvents: 'auto',
          }}
          onMouseEnter={keepFocus}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
        >
          <button
            type="button"
            className="center-region-annotation-target"
            onClick={event => {
              event.stopPropagation()
              openDetail(surfaceFocusedNode.id, null)
            }}
          >
            <span className="center-region-annotation-title">{surfaceFocusedNode.title}</span>
            <span className="center-region-annotation-copy">
              {surfaceFocusedNode.annotation ?? surfaceFocusedNode.description}
            </span>
            <span className="center-region-annotation-hint">点击细看</span>
          </button>
        </div>
      )}

      {!isOverview && (
        <div className={`center-zoom-notice${zoomNoticeVisible ? ' is-visible' : ''}`} aria-live="polite">
          {Math.round(zoom * 100)}%
        </div>
      )}

      {detailNode && (
        <aside
          className={`center-detail-panel${detailClosing ? ' is-closing' : ''}`}
          data-center-annotation
          onClick={event => event.stopPropagation()}
          onMouseEnter={keepFocus}
          style={{ zIndex: 40 }}
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

      <div className="center-edge center-edge--top" aria-hidden="true"><span>向上滑动 · 返回入口</span></div>
      <div className="center-edge center-edge--bottom" aria-hidden="true"><span>向下滑动 · 继续阅读</span></div>

      <div className="center-layer-caption" aria-live="polite">
        <span>{currentNode.title}</span>
        {!isOverview && (
          <button type="button" onClick={(event) => { event.stopPropagation(); goBack() }}>返回上一层</button>
        )}
      </div>

      <div className="center-gesture-hint" aria-hidden="true">
        {isOverview ? (
          <>
            <span>右键拖动探索固定世界</span>
            <span>滚轮连续缩放 · 缩放锚点保持在当前查看位置</span>
          </>
        ) : (
          <>
            <span>右键拖动查看周围</span>
            <span>上滚放大 · 下滚缩小 · 批注出现后下滑进入</span>
          </>
        )}
      </div>

      {!isOverview && (
        <SurfaceDebugOverlay
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
          cameraZoom={zoom}
          panX={camera.x}
          panY={camera.y}
        />
      )}
    </section>
  )
}

export default CenterViewport
