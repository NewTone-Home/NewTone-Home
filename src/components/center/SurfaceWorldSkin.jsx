import { sharedWorldGeometry } from '../../data/center/sharedWorldGeometry'
import SurfaceEstateScene from './scenes/SurfaceEstateScene'
import SurfaceCouncilScene from './scenes/SurfaceCouncilScene'
import SurfaceEstateCouncilRoute from './scenes/SurfaceEstateCouncilRoute'
import councilMini from '../../assets/center/surface-kit-batch1/landmarks/central-council-mini.png'
/* TEMP_HIDDEN import continuousPreview from '../../assets/center/surface/surface-estate-council-continuous-v1.png' */

// Surface-world art skin. 姬家祖宅 and 中枢院 are both layered scene units now.
// The council keeps its domed master as a hero layer (the kit has no dome part),
// wrapped in a layered context. Everything binds to sharedWorldGeometry.anchors.
const [, , VB_W, VB_H] = sharedWorldGeometry.viewBox.split(' ').map(Number)
const { council } = sharedWorldGeometry.anchors

function place({ x, y, w }) {
  return {
    left: `${(x / VB_W) * 100}%`,
    top: `${(y / VB_H) * 100}%`,
    width: `${(w / VB_W) * 100}%`,
  }
}

function SurfaceWorldSkin({ world, previewNodeId = null }) {
  if (world !== 'surface') return null

  const councilFocused = previewNodeId === 'surface-council'

  return (
    <div className="center-surface-skin" data-derived-from="sharedWorldGeometry.anchors" aria-hidden="true">
      <SurfaceEstateCouncilRoute pass="bg" />
      <SurfaceEstateScene />
      <SurfaceCouncilScene />
      {/* TEMP_HIDDEN <img className="center-route-preview" src={continuousPreview} alt="" draggable="false" style={place({ x: 500, y: 180, w: 1000 })} /> */}
      <SurfaceEstateCouncilRoute pass="fg" />

      {councilFocused && (
        <img
          className="center-skin-mini center-skin-mini--council"
          src={councilMini}
          alt="中枢院"
          draggable="false"
          style={place({ x: council.x, y: council.y - 6, w: 348 })}
        />
      )}
    </div>
  )
}

export default SurfaceWorldSkin
