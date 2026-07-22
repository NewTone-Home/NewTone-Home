import { sharedWorldGeometry } from '../../../data/center/sharedWorldGeometry'
// Roads (8 assets used: 5 types x 8 total tiles)
import roadSecStraight from '../../../assets/center/surface-kit-batch1/roads/road-secondary-straight.png'
import roadSecCurve from '../../../assets/center/surface-kit-batch1/roads/road-secondary-curve.png'
import roadMainMerge from '../../../assets/center/surface-kit-batch1/roads/road-main-secondary-merge.png'
import roadMainStraight from '../../../assets/center/surface-kit-batch1/roads/road-main-straight.png'
import roadMainTee from '../../../assets/center/surface-kit-batch1/roads/road-main-t-junction.png'
// Ground / shadows
import estateFloor from '../../../assets/center/surface-kit-batch1/ground/estate-court-floor.png'
import shadowLshape from '../../../assets/center/surface-kit-batch1/shadows/shadow-building-lshape.png'
import shadowTreeMed from '../../../assets/center/surface-kit-batch1/shadows/shadow-tree-medium.png'
import shadowTreeLarge from '../../../assets/center/surface-kit-batch1/shadows/shadow-tree-large.png'
// Walls (4 assets: straight×2, corner, gate)
import wallStraightA from '../../../assets/center/surface-kit-batch1/walls/courtyard-wall-straight-a.png'
import wallStraightB from '../../../assets/center/surface-kit-batch1/walls/courtyard-wall-straight-b.png'
import wallCornerA from '../../../assets/center/surface-kit-batch1/walls/courtyard-wall-corner-a.png'
import wallGateA from '../../../assets/center/surface-kit-batch1/walls/courtyard-wall-gate-a.png'
// Trees (6 tree-crown variants)
import treeLargeA from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-large-a.png'
import treeLargeB from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-large-b.png'
import treeMedA from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-medium-a.png'
import treeMedB from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-medium-b.png'
import treeSmallA from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-small-a.png'
import treeSmallB from '../../../assets/center/surface-kit-batch1/vegetation/tree-crown-small-b.png'
// Roofs & corridor
import roofLowA from '../../../assets/center/surface-kit-batch1/roofs/roof-modern-low-a.png'
import roofLowC from '../../../assets/center/surface-kit-batch1/roofs/roof-modern-low-c.png'
import corridorStraightA from '../../../assets/center/surface-kit-batch1/corridors/corridor-straight-a.png'

const [, , VB_W, VB_H] = sharedWorldGeometry.viewBox.split(' ').map(Number)

function vbx(x, y, w, h) {
  return {
    left: `${(x / VB_W) * 100}%`,
    top: `${(y / VB_H) * 100}%`,
    width: `${(w / VB_W) * 100}%`,
    height: h ? `${(h / VB_H) * 100}%` : 'auto',
  }
}

// Road tiles placed along estate-link → main-arterial → council-axis
// All positions in viewBox units (0 0 1000 360), converted to % by vbx()
const ROADS = [
  // R1-R2: estate gate → secondary road (estate-link path ~(260,200)→(290,218))
  { src: roadSecStraight, x: 258, y: 205, w: 50, h: 36, z: 4 },
  { src: roadSecStraight, x: 294, y: 220, w: 50, h: 36, z: 4 },
  // R3: curve approaching arterial junction (~(324,236))
  { src: roadSecCurve, x: 322, y: 233, w: 44, h: 38, z: 4 },
  // R4: secondary → main arterial merge at (342,246)
  { src: roadMainMerge, x: 343, y: 244, w: 56, h: 42, z: 4 },
  // R5-R7: main arterial toward council (three segments)
  { src: roadMainStraight, x: 388, y: 239, w: 58, h: 38, z: 4 },
  { src: roadMainStraight, x: 440, y: 232, w: 58, h: 38, z: 4 },
  { src: roadMainStraight, x: 492, y: 224, w: 58, h: 38, z: 4 },
  // R8: T-junction for council approach at (520,211) → up council-axis
  { src: roadMainTee, x: 522, y: 212, w: 54, h: 44, z: 4 },
]

// Ground patches under road + shadows
const GROUND = [
  { src: estateFloor, x: 228, y: 188, w: 72, h: 50, z: 1 },
  { src: estateFloor, x: 502, y: 214, w: 60, h: 40, z: 1 },
  { src: shadowLshape, x: 268, y: 202, w: 80, h: 56, z: 2, blend: 'multiply', op: 0.35 },
  { src: shadowLshape, x: 342, y: 236, w: 84, h: 58, z: 2, blend: 'multiply', op: 0.35 },
]

// Roadside walls: enclosure and road-edge definition
const WALLS = [
  { src: wallStraightA, x: 232, y: 170, w: 28, h: 42, z: 6 },
  { src: wallStraightB, x: 278, y: 206, w: 26, h: 36, z: 6 },
  { src: wallCornerA, x: 314, y: 232, w: 24, h: 24, z: 6 },
  { src: wallStraightA, x: 368, y: 232, w: 26, h: 36, z: 6 },
  { src: wallStraightB, x: 464, y: 218, w: 26, h: 34, z: 6 },
  { src: wallGateA, x: 250, y: 186, w: 24, h: 22, z: 7 },
]

// Rear vegetation (behind walls, alongside road)
const REAR_TREES = [
  { src: treeLargeA, x: 228, y: 155, w: 32, h: 32, z: 5 },
  { src: treeMedA, x: 262, y: 188, w: 22, h: 22, z: 5 },
  { src: treeMedB, x: 292, y: 214, w: 22, h: 22, z: 5 },
  { src: treeLargeB, x: 350, y: 230, w: 32, h: 32, z: 5 },
  { src: treeMedA, x: 406, y: 226, w: 22, h: 22, z: 5 },
  { src: treeMedB, x: 456, y: 216, w: 22, h: 22, z: 5 },
  { src: treeMedA, x: 510, y: 200, w: 22, h: 22, z: 5 },
]

// Tree shadows (offset for SE light, multiply blend)
const TREE_SHADOWS = [
  { src: shadowTreeLarge, x: 230, y: 158, w: 34, h: 34, z: 3, blend: 'multiply', op: 0.4 },
  { src: shadowTreeMed, x: 264, y: 191, w: 24, h: 24, z: 3, blend: 'multiply', op: 0.4 },
  { src: shadowTreeMed, x: 352, y: 233, w: 34, h: 34, z: 3, blend: 'multiply', op: 0.4 },
  { src: shadowTreeMed, x: 408, y: 229, w: 24, h: 24, z: 3, blend: 'multiply', op: 0.4 },
  { src: shadowTreeMed, x: 512, y: 203, w: 24, h: 24, z: 3, blend: 'multiply', op: 0.4 },
]

// Roadside low buildings
const BUILDINGS = [
  { src: roofLowA, x: 296, y: 205, w: 28, h: 22, z: 6 },
  { src: roofLowC, x: 418, y: 220, w: 28, h: 22, z: 6 },
  { src: roofLowA, x: 476, y: 214, w: 28, h: 22, z: 6 },
]

// Covered corridor (transition along road)
const CORRIDORS = [
  { src: corridorStraightA, x: 360, y: 228, w: 30, h: 20, z: 6 },
]

// Foreground occluders (overlap road + estate/council)
const FORE_TREES = [
  { src: treeSmallA, x: 332, y: 244, w: 20, h: 20, z: 8 },
  { src: treeSmallB, x: 472, y: 226, w: 20, h: 20, z: 8 },
  { src: treeSmallA, x: 530, y: 216, w: 20, h: 20, z: 8 },
]

const BG_LAYERS = [
  ...GROUND.map(d => ({ ...d, cls: 'route-ground' })),
  ...TREE_SHADOWS.map(d => ({ ...d, cls: 'route-shadow' })),
  ...ROADS.map(d => ({ ...d, cls: 'route-road' })),
  ...REAR_TREES.map(d => ({ ...d, cls: 'route-tree-rear' })),
  ...WALLS.map(d => ({ ...d, cls: 'route-wall' })),
  ...BUILDINGS.map(d => ({ ...d, cls: 'route-building' })),
  ...CORRIDORS.map(d => ({ ...d, cls: 'route-corridor' })),
]

const FG_LAYERS = FORE_TREES.map(d => ({ ...d, cls: 'route-tree-fore' }))

function SurfaceEstateCouncilRoute({ pass = 'bg' }) {
  const layers = pass === 'bg' ? BG_LAYERS : FG_LAYERS

  return (
    <div className="center-route-scene" aria-hidden="true">
      {layers.map((d, i) => (
        <img
          key={i}
          className={`center-route-asset ${d.cls}`}
          src={d.src}
          alt=""
          aria-hidden="true"
          draggable="false"
          style={{
            ...vbx(d.x, d.y, d.w, d.h),
            zIndex: d.z,
            opacity: d.op ?? 1,
            mixBlendMode: d.blend === 'multiply' ? 'multiply' : undefined,
          }}
        />
      ))}
    </div>
  )
}

export default SurfaceEstateCouncilRoute
