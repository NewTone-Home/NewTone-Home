import type { MainlineSceneGeometryUnit, MainlineSceneVisualCell } from './mainlineScenes'
import { mainlineWorldFontSizePx, sceneDesignReferenceMetrics, sharedBoundaryScreenSpacingPx } from './sceneBoundaryGrid'

/** Lay out each complete visual wall run, never clip glyphs by collision-unit
 * endpoints. Doors/features and physical geometry retain their authored values.
 * Only a tail interval may be shorter than the reference pitch. If that tail
 * cannot fit an ordinary glyph, share its remainder with the preceding interval. */
export function fixedMainlineWallGlyphGrid(units: readonly MainlineSceneGeometryUnit[], edges: ReadonlySet<string>): MainlineSceneGeometryUnit[] {
  const replacements = new Map<MainlineSceneGeometryUnit, MainlineSceneVisualCell[]>()
  for (const edge of edges) {
    const members = units.filter(u => `${u.ownerId}:${u.edge}` === edge && u.geometryKind === 'boundary' && !u.storefrontId)
    if (!members.length) continue
    const axis = members[0]!.edge === 'top' || members[0]!.edge === 'bottom' ? 'x' : 'y'
    const pitch = sharedBoundaryScreenSpacingPx / (axis === 'x' ? sceneDesignReferenceMetrics.width : sceneDesignReferenceMetrics.height) * 100
    const nodes = members.flatMap(unit => unit.visual.cells.filter(cell => cell.glyph).map(cell => ({ unit, cell })))
      .sort((a, b) => a.cell[axis] - b.cell[axis])
    const walls = nodes.filter(n => n.cell.kind === 'wall')
    if (!walls.length) continue
    for (const unit of members) replacements.set(unit, unit.visual.cells.filter(c => c.kind !== 'wall' || !c.glyph))
    const runs: typeof walls[] = []
    for (const wall of walls) {
      const run = runs.at(-1), previous = run?.at(-1)
      const separated = previous && (wall.cell[axis] - previous.cell[axis] > pitch * 1.6 || nodes.some(n => n.cell.kind !== 'wall' && n.cell[axis] > previous.cell[axis] && n.cell[axis] < wall.cell[axis]))
      if (!run || separated) runs.push([wall]); else run.push(wall)
    }
    runs.forEach((run, runIndex) => {
      const first = run[0]!, last = run.at(-1)!
      const before = nodes.filter(n => n.cell.kind !== 'wall' && n.cell[axis] < first.cell[axis]).at(-1)
      const after = nodes.find(n => n.cell.kind !== 'wall' && n.cell[axis] > last.cell[axis])
      const startsAtDoor = before?.cell.kind === 'door' && first.cell[axis] - before.cell[axis] < pitch * 1.6
      const endsAtDoor = after?.cell.kind === 'door' && after.cell[axis] - last.cell[axis] < pitch * 1.6
      const start = startsAtDoor ? before.cell[axis] + pitch : first.cell[axis]
      const end = endsAtDoor ? after.cell[axis] - pitch : last.cell[axis]
      if (end < start - .000001) throw new Error(`Wall run cannot fit between immutable anchors: ${edge}`)
      const coordinates: number[] = []
      // With a door at the far end, grow away from that door so its immediate
      // neighbor stays exactly one pitch away; the short cap belongs at the tail.
      if (endsAtDoor && !startsAtDoor) {
        for (let p = end; p > start + .000001; p -= pitch) coordinates.push(p)
        coordinates.push(start)
        coordinates.reverse()
      } else {
        for (let p = start; p < end - .000001; p += pitch) coordinates.push(p)
        coordinates.push(end)
      }
      // Authored coordinates were rounded to .001 percent. A near-zero
      // rounding remainder is one endpoint, not two overlapping glyphs.
      const tolerance = pitch * .02 / sharedBoundaryScreenSpacingPx
      for (let i = coordinates.length - 1; i > 0; i--) {
        if (coordinates[i]! - coordinates[i - 1]! < tolerance) coordinates.splice(i - 1, 1)
      }
      // Never refit the full wall: only the final pair at the short tail moves.
      // A 14px glyph needs at least 14 reference pixels between its centers.
      // Door-neighbor anchors and both visual endpoints stay unchanged.
      const minimumGlyphPitch = pitch * mainlineWorldFontSizePx / sharedBoundaryScreenSpacingPx
      if (coordinates.length >= 3) {
        if (coordinates[1]! - coordinates[0]! < minimumGlyphPitch) {
          coordinates[1] = (coordinates[0]! + coordinates[2]!) / 2
        } else {
          const lastIndex = coordinates.length - 1
          if (coordinates[lastIndex]! - coordinates[lastIndex - 1]! < minimumGlyphPitch) {
            coordinates[lastIndex - 1] = (coordinates[lastIndex - 2]! + coordinates[lastIndex]!) / 2
          }
        }
      }
      coordinates.forEach((coordinate, index) => {
        const nearest = run.reduce((best, n) => Math.abs(n.cell[axis] - coordinate) < Math.abs(best.cell[axis] - coordinate) ? n : best, first)
        const target = members.find(u => coordinate >= u[axis] - .001 && coordinate <= u[axis] + u[axis === 'x' ? 'width' : 'height'] + .001
          && u.visual.cells.some(c => c.kind === 'wall'))
        if (!target) throw new Error(`Wall glyph has no physical wall owner: ${edge} at ${coordinate}`)
        replacements.get(target)!.push({ ...nearest.cell, id: `${edge}-anchored-wall-${runIndex}-${index}`,
          [axis]: coordinate, cellStart: coordinate - pitch / 2, cellEnd: coordinate + pitch / 2 })
      })
    })
  }
  return units.map(unit => replacements.has(unit) ? { ...unit, visual: { ...unit.visual, cells: replacements.get(unit)! } } : unit)
}
