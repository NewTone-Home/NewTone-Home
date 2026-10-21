import type { MainlineSceneGeometryUnit, MainlineSceneVisualCell } from './mainlineScenes'
import { sceneDesignReferenceMetrics, sharedBoundaryScreenSpacingPx } from './sceneBoundaryGrid'

/** Fixed reference-grid glyphs inside existing solid boundary ranges. Door,
 * feature and collision ranges are immutable; endpoint remainder stays solid
 * and never becomes another opening or an extra compressed glyph. */
export function fixedMainlineWallGlyphGrid(units: readonly MainlineSceneGeometryUnit[], owners: ReadonlySet<string>): MainlineSceneGeometryUnit[] {
  const pitch = { x: sharedBoundaryScreenSpacingPx / sceneDesignReferenceMetrics.width * 100,
    y: sharedBoundaryScreenSpacingPx / sceneDesignReferenceMetrics.height * 100 }
  const seen = new Set<string>()
  return units.map(unit => {
    if (!owners.has(unit.ownerId) || !unit.edge || unit.geometryKind !== 'boundary' || unit.storefrontId) return unit
    const axis = unit.edge === 'top' || unit.edge === 'bottom' ? 'x' : 'y'
    const extent = axis === 'x' ? 'width' : 'height'
    const walls = unit.visual.cells.filter(c => c.kind === 'wall' && c.glyph)
    if (!walls.length) return unit
    const protectedCells = unit.visual.cells.filter(c => c.kind !== 'wall')
    // Keep old endpoint omissions and replacement flanks as reserved ranges.
    const ranges = walls.map(c => ({ start: Math.max(unit[axis],c.cellStart ?? c[axis]-pitch[axis]/2),
      end: Math.min(unit[axis]+unit[extent],c.cellEnd ?? c[axis]+pitch[axis]/2) }))
      .sort((a,b)=>a.start-b.start)
    const runs: {start:number;end:number}[]=[]
    for(const range of ranges){const last=runs.at(-1);if(last && range.start<=last.end+.00001)last.end=Math.max(last.end,range.end);else runs.push({...range})}
    const glyphs: MainlineSceneVisualCell[]=[]
    for(const run of runs){
      const first=Math.ceil((run.start-.000001)/pitch[axis]),last=Math.floor((run.end+.000001)/pitch[axis])
      for(let n=first;n<=last;n++){
        const coordinate=Number((n*pitch[axis]).toFixed(8))
        const point={x:axis==='x'?coordinate:walls[0]!.x,y:axis==='y'?coordinate:walls[0]!.y}
        if(protectedCells.some(c=>coordinate>=(c.cellStart??c[axis]-pitch[axis]/2)-.000001&&coordinate<=(c.cellEnd??c[axis]+pitch[axis]/2)+.000001))continue
        const key=`${unit.ownerId}:${point.x.toFixed(7)}:${point.y.toFixed(7)}`
        if(seen.has(key))continue
        seen.add(key)
        const nearest=walls.reduce((best,c)=>Math.abs(c[axis]-coordinate)<Math.abs(best[axis]-coordinate)?c:best,walls[0]!)
        glyphs.push({...nearest,id:`${unit.id}-fixed-wall-${n}`,...point,
          cellStart:Math.max(run.start,coordinate-pitch[axis]/2),cellEnd:Math.min(run.end,coordinate+pitch[axis]/2)})
      }
    }
    // A sub-cell solid end cap can legitimately have no character center.
    // Keep a non-painted canonical cell so it remains an explicit wall range.
    if(!glyphs.length && !protectedCells.length)glyphs.push({...walls[0]!,glyph:''})
    return {...unit,visual:{...unit.visual,cells:[...protectedCells,...glyphs]}}
  })
}
