import { useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  PlaceLayerSlot,
  PlaceStageDefinition,
  PlaceStageLayerAsset,
} from './placeStageTypes'

/**
 * 地点的视觉表述。
 *
 * 关键约束：**Active 与 Neighbor 是同一个组件、同一份 DOM**。
 *
 * 每个已挂载地点同时挂着剪影表述与多层表述，靠 `--place-unfold` 交叉推进。
 * 因此一个地点从 20% 走到 80% 的全程都不会卸载剪影再挂载完整主体 ——
 * 它只是同一张纸慢慢立起来。剪影到多层的展开由过渡策略控制，不由这里决定。
 *
 * 组件本身不知道 80/20 是什么，也不计算任何构图：
 * 视觉量由控制器写成 CSS 变量，这里只负责把图层摆出来。
 */

/** 渲染顺序恒定：后 → 内 → 主体 → 前。 */
const LAYER_ORDER: PlaceLayerSlot[] = ['rear', 'inner', 'subject', 'foreground']

/** 各组的展开时间差序号。layer-unfold 会用它乘以 unfoldDelay。 */
const UNFOLD_STEP: Record<PlaceLayerSlot, number> = {
  rear: 0,
  inner: 1,
  subject: 2,
  foreground: 3,
}

interface LayerStyle extends CSSProperties {
  '--layer-plx': number
  '--layer-ply': number
  '--layer-depth': number
  '--layer-step': number
  '--layer-opacity': number
}

function layerStyle(asset: PlaceStageLayerAsset, slot: PlaceLayerSlot): LayerStyle {
  return {
    '--layer-plx': asset.parallaxX,
    '--layer-ply': asset.parallaxY,
    '--layer-depth': asset.depth,
    '--layer-step': UNFOLD_STEP[slot],
    '--layer-opacity': asset.opacity ?? 1,
    mixBlendMode: asset.blendMode as CSSProperties['mixBlendMode'],
  }
}

function ShapeArt({ shape }: { shape: NonNullable<PlaceStageLayerAsset['shape']> }) {
  const style: CSSProperties = {
    left: `${shape.xPct}%`,
    top: `${shape.yPct}%`,
    width: `${shape.widthPct}%`,
    height: `${shape.heightPct}%`,
    borderRadius: shape.radius,
    // 纸色深浅由 tone 推导，保持整套舞台同一支纸色
    '--shape-tone': shape.tone,
  } as CSSProperties

  return <span className="pstage-shape" data-form={shape.form} style={style} aria-hidden="true" />
}

function ImageArt({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  // 资产缺位时静默降级：舞台结构不能因为一张图没到就塌掉
  if (failed) return <span className="pstage-shape" data-form="silhouette" aria-hidden="true" />

  return (
    <img
      className="pstage-layer-image"
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}

function PlaceLayer({ asset, slot }: { asset: PlaceStageLayerAsset; slot: PlaceLayerSlot }) {
  return (
    <div className="pstage-layer" data-slot={slot} data-kind={asset.kind} style={layerStyle(asset, slot)}>
      {asset.kind === 'image' && asset.src
        ? <ImageArt src={asset.src} />
        : asset.shape
          ? <ShapeArt shape={asset.shape} />
          : null}
    </div>
  )
}

/** 缺省剪影：地点没给 neighborSilhouette 时，从主体组第一层派生一层。 */
function fallbackSilhouette(definition: PlaceStageDefinition): PlaceStageLayerAsset[] {
  const first = definition.layers.subject[0]
  if (!first) return []
  return [{ ...first, id: `${first.id}-fallback-sil`, kind: 'shape', shape: first.shape && { ...first.shape, form: 'silhouette' } }]
}

interface PlaceVisualLayersProps {
  definition: PlaceStageDefinition
}

export function PlaceVisualLayers({ definition }: PlaceVisualLayersProps) {
  const silhouette = definition.neighborSilhouette?.length
    ? definition.neighborSilhouette
    : fallbackSilhouette(definition)

  return (
    <>
      {/* 剪影表述：unfold 推进时退场，但 DOM 始终在 */}
      <div className="pstage-place-silhouette" aria-hidden="true">
        {silhouette.map(asset => (
          <PlaceLayer key={asset.id} asset={asset} slot="subject" />
        ))}
      </div>

      {/* 多层表述：与剪影同时挂载，靠 unfold 立起来 */}
      <div className="pstage-place-layers" aria-hidden="true">
        {LAYER_ORDER.map(slot => {
          const assets = definition.layers[slot]
          if (!assets?.length) return null
          return (
            <div key={slot} className="pstage-layer-group" data-slot={slot}>
              {assets.map(asset => (
                <PlaceLayer key={asset.id} asset={asset} slot={slot} />
              ))}
            </div>
          )
        })}
      </div>
    </>
  )
}
