import { sharedWorldGeometry } from '../../../data/center/sharedWorldGeometry'
import councilHero from '../../../assets/center/surface-kit-batch1/landmarks/central-council-persistent.png'
import forecourt from '../../../assets/center/surface-kit-batch1/ground/estate-court-floor.png'
import treeLargeB from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-large-b.png'
import treeMediumA from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-medium-a.png'
import treeSmallB from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-small-b.png'
import treeShadowMedium from '../../../assets/center/surface-kit-batch1/shadows/shadow-tree-medium.png'
import treeShadowSmall from '../../../assets/center/surface-kit-batch1/shadows/shadow-tree-small.png'

// Layered scene for 中枢院. The kit has no dome / round-colonnade part and the
// master PNG is already a complete baked complex, so the domed rotunda stays the
// hero layer; the scene depth comes from non-clashing context layers around it:
// a forecourt apron reaching toward the road, background crowns peeking behind
// the dome, and foreground crowns (with shadows) framing the grand stair.
// Position binds only to sharedWorldGeometry.anchors.council; children are placed
// in the scene's own box (percent), never a second map coordinate system.
const [, , VB_W, VB_H] = sharedWorldGeometry.viewBox.split(' ').map(Number)
const { council } = sharedWorldGeometry.anchors

const SCENE_WIDTH_UNITS = 320 // keeps the council the same on-map size as before
const SCENE_ASPECT = 1.7858
const SCENE_ANCHOR_OFFSET_Y = -4

const SRC = {
  forecourt, councilHero, treeLargeB, treeMediumA, treeSmallB, treeShadowMedium, treeShadowSmall,
}

// left/top/width are percentages of this container; solved offline from the tuned
// part composite (see artifacts/council-proto.png). Back-to-front by z.
const LAYERS = [
  { key: 'apron', src: 'forecourt', cls: 'scene-forecourt', z: 0, opacity: 1, blend: 'normal', left: 26.64, top: 61.74, width: 36.55 },
  { key: 'tree-bl', src: 'treeLargeB', cls: 'scene-tree-back', z: 1, opacity: 1, blend: 'normal', left: 26.13, top: 9.41, width: 15.49 },
  { key: 'tree-bm', src: 'treeMediumA', cls: 'scene-tree-back', z: 2, opacity: 1, blend: 'normal', left: 58.23, top: 13.9, width: 16.58 },
  { key: 'hero', src: 'councilHero', cls: 'scene-council-hero', z: 3, opacity: 1, blend: 'normal', left: 0, top: 0, width: 100 },
  { key: 'shadow-l', src: 'treeShadowMedium', cls: 'scene-tree-shadow', z: 4, opacity: 0.5, blend: 'multiply', left: 33.61, top: 70.26, width: 13.57 },
  { key: 'shadow-r', src: 'treeShadowSmall', cls: 'scene-tree-shadow', z: 5, opacity: 0.5, blend: 'multiply', left: 50.75, top: 72.36, width: 12.84 },
  { key: 'tree-fl', src: 'treeMediumA', cls: 'scene-tree-front', z: 6, opacity: 1, blend: 'normal', left: 31.89, top: 66.92, width: 16.99 },
  { key: 'tree-fr', src: 'treeSmallB', cls: 'scene-tree-front', z: 7, opacity: 1, blend: 'normal', left: 49.48, top: 68.98, width: 15.58 },
]

function SurfaceCouncilScene() {
  const containerStyle = {
    left: `${(council.x / VB_W) * 100}%`,
    top: `${((council.y + SCENE_ANCHOR_OFFSET_Y) / VB_H) * 100}%`,
    width: `${(SCENE_WIDTH_UNITS / VB_W) * 100}%`,
    aspectRatio: SCENE_ASPECT,
  }

  return (
    <div
      className="center-council-scene"
      data-anchor-id="council"
      data-derived-from="sharedWorldGeometry.anchors.council"
      style={containerStyle}
      aria-hidden="true"
    >
      {LAYERS.map(layer => (
        <img
          key={layer.key}
          className={`center-scene-layer ${layer.cls}`}
          src={SRC[layer.src]}
          alt=""
          aria-hidden="true"
          draggable="false"
          style={{
            left: `${layer.left}%`,
            top: `${layer.top}%`,
            width: `${layer.width}%`,
            zIndex: layer.z,
            opacity: layer.opacity,
            mixBlendMode: layer.blend === 'multiply' ? 'multiply' : undefined,
          }}
        />
      ))}
    </div>
  )
}

export default SurfaceCouncilScene
