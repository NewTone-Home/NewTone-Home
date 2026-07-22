import { sharedWorldGeometry } from '../../../data/center/sharedWorldGeometry'
import groundFloor from '../../../assets/center/surface-kit-batch1/ground/estate-court-floor.png'
import shadowBuilding from '../../../assets/center/surface-kit-batch1/shadows/shadow-building-lshape.png'
import treeBack from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-large-a.png'
import wallBody from '../../../assets/center/surface-kit-batch1/walls/courtyard-wall-straight-a.png'
import roofMain from '../../../assets/center/surface-kit-batch1/roofs/roof-modern-low-a.png'
import roofSide from '../../../assets/center/surface-kit-batch1/roofs/roof-modern-low-d.png'
import wallFront from '../../../assets/center/surface-kit-batch1/walls/courtyard-wall-corner-a.png'
import gate from '../../../assets/center/surface-kit-batch1/walls/courtyard-wall-gate-a.png'
import treeShadow from '../../../assets/center/surface-kit-batch1/shadows/shadow-tree-medium.png'
import treeFront from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-medium-b.png'

// A layered 2.5D scene unit for 姬家祖宅, assembled from batch-1 parts. Position
// on the map comes solely from sharedWorldGeometry.anchors.jijia; every layer
// below is placed in the scene's OWN local box (percent of this container),
// never in a second map coordinate system. Layer order = back-to-front paint /
// occlusion order (ground < shadow < walls < building base < roofs < front wall
// < gate < foreground tree).
const [, , VB_W, VB_H] = sharedWorldGeometry.viewBox.split(' ').map(Number)
const { jijia } = sharedWorldGeometry.anchors

// Container geometry, tuned against the shared anchor.
const SCENE_WIDTH_UNITS = 408 // container width in viewBox units
const SCENE_ASPECT = 1.1013 // container width / height (keeps parts undistorted)
const SCENE_ANCHOR_OFFSET_Y = -30 // lift so the courtyard ground sits on the anchor

// left/top/width are percentages of this container; solved offline from the
// tuned part composite (see artifacts/estate-proto.png).
const LAYERS = [
  { key: 'ground', src: groundFloor, cls: 'scene-ground', z: 0, opacity: 1, blend: 'normal', left: 23.39, top: 34.66, width: 49.5 },
  { key: 'shadow', src: shadowBuilding, cls: 'scene-shadow', z: 1, opacity: 0.42, blend: 'multiply', left: 9.2, top: 0, width: 90.8 },
  { key: 'tree-back', src: treeBack, cls: 'scene-tree-back', z: 2, opacity: 1, blend: 'normal', left: 24.18, top: 32.71, width: 25.49 },
  { key: 'building-base', src: wallBody, cls: 'scene-building-base', z: 3, opacity: 1, blend: 'normal', left: 22.89, top: 28.08, width: 48.47 },
  { key: 'roof-main', src: roofMain, cls: 'scene-roof-main', z: 4, opacity: 1, blend: 'normal', left: 23.83, top: 12.01, width: 48.65 },
  { key: 'roof-side', src: roofSide, cls: 'scene-roof-side', z: 5, opacity: 1, blend: 'normal', left: 59.37, top: 31.47, width: 22 },
  { key: 'wall-front', src: wallFront, cls: 'scene-wall-front', z: 6, opacity: 1, blend: 'normal', left: 0, top: 16.89, width: 96.4 },
  { key: 'gate', src: gate, cls: 'scene-gate', z: 7, opacity: 1, blend: 'normal', left: 43.8, top: 42.1, width: 38.4 },
  { key: 'tree-shadow', src: treeShadow, cls: 'scene-tree-shadow', z: 8, opacity: 0.5, blend: 'multiply', left: 30.83, top: 56.87, width: 16.17 },
  { key: 'tree-front', src: treeFront, cls: 'scene-tree-front', z: 9, opacity: 1, blend: 'normal', left: 28.69, top: 51.17, width: 19.71 },
]

function SurfaceEstateScene() {
  const containerStyle = {
    left: `${(jijia.x / VB_W) * 100}%`,
    top: `${((jijia.y + SCENE_ANCHOR_OFFSET_Y) / VB_H) * 100}%`,
    width: `${(SCENE_WIDTH_UNITS / VB_W) * 100}%`,
    aspectRatio: SCENE_ASPECT,
  }

  return (
    <div
      className="center-estate-scene"
      data-anchor-id="jijia"
      data-derived-from="sharedWorldGeometry.anchors.jijia"
      style={containerStyle}
      aria-hidden="true"
    >
      {LAYERS.map(layer => (
        <img
          key={layer.key}
          className={`center-scene-layer ${layer.cls}`}
          src={layer.src}
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

export default SurfaceEstateScene
