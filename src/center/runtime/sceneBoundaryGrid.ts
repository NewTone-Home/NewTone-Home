/**
 * Shared boundary lattice primitives.
 *
 * A complete structure frame has one fitted coordinate system. Features,
 * storefront states, and openings replace cells in that frame; they must not
 * create a second local visual or collision grid.
 */
export type BoundaryGridCell = {
  start: number
  end: number
  center: number
}

/**
 * The stage is authored in percentage coordinates, but glyph spacing is a
 * physical screen concern. Keep one spacing source and project it onto the
 * stage's two dimensions instead of authoring independent x/y steps.
 */
export type SceneScreenMetrics = {
  width: number
  height: number
}

export const sharedBoundaryScreenSpacingPx = 28
export const defaultSceneScreenMetrics: SceneScreenMetrics = { width: 1280, height: 720 }

function positiveScreenDimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function boundaryGridStepsFromScreenSpacing(
  screenSpacingPx = sharedBoundaryScreenSpacingPx,
  metrics: SceneScreenMetrics = defaultSceneScreenMetrics,
) {
  const spacing = positiveScreenDimension(screenSpacingPx, sharedBoundaryScreenSpacingPx)
  const width = positiveScreenDimension(metrics.width, defaultSceneScreenMetrics.width)
  const height = positiveScreenDimension(metrics.height, defaultSceneScreenMetrics.height)
  return {
    horizontal: Number(((spacing / width) * 100).toFixed(4)),
    vertical: Number(((spacing / height) * 100).toFixed(4)),
  }
}

/** Convert an authored radial offset into a shared screen-cell distance. */
export function boundaryGridOffsetForScreenCells(
  offset: { x: number; y: number },
  authoredDistance: number,
  cellDistance: number,
  metrics: SceneScreenMetrics = defaultSceneScreenMetrics,
) {
  const sourceDistance = Math.max(Math.abs(authoredDistance), .1)
  const steps = boundaryGridStepsFromScreenSpacing(sharedBoundaryScreenSpacingPx, metrics)
  return {
    x: offset.x * (steps.horizontal * cellDistance / sourceDistance),
    y: offset.y * (steps.vertical * cellDistance / sourceDistance),
  }
}

export function readSceneScreenMetrics(element: { getBoundingClientRect: () => { width: number; height: number } }): SceneScreenMetrics | null {
  const rect = element.getBoundingClientRect()
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  return { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) }
}

export function boundaryGridCoordinates(start: number, end: number, targetStep: number): number[] {
  const intervalCount = Math.max(1, Math.round((end - start) / Math.max(targetStep, .1)))
  const fittedStep = (end - start) / intervalCount
  return Array.from({ length: intervalCount + 1 }, (_, index) => (
    Number((start + fittedStep * index).toFixed(3))
  ))
}

export function fixedBoundaryGridCoordinates(start: number, end: number, cellCount: number): number[] {
  const count = Math.max(2, Math.round(cellCount))
  const step = (end - start) / (count - 1)
  return Array.from({ length: count }, (_, index) => (
    index === 0 ? start : index === count - 1 ? end : Number((start + step * index).toFixed(3))
  ))
}

export function boundaryGridCells(start: number, end: number, targetStep: number): BoundaryGridCell[] {
  const coordinates = boundaryGridCoordinates(start, end, targetStep)
  return coordinates.slice(0, -1).map((cellStart, index) => {
    const cellEnd = coordinates[index + 1]
    return { start: cellStart, end: cellEnd, center: (cellStart + cellEnd) / 2 }
  })
}

/**
 * Return the physical interval owned by one fixed frame coordinate.
 * Coordinates are glyph anchors; their intervals meet at fitted midpoints so
 * adjacent replacements partition the frame without changing anchor spacing.
 */
export function boundaryGridCellRange(coordinates: readonly number[], index: number) {
  const axis = coordinates[index]
  if (axis === undefined) return null
  const previous = coordinates[index - 1]
  const next = coordinates[index + 1]
  return {
    start: index === 0 ? axis : (previous! + axis) / 2,
    end: index === coordinates.length - 1 ? axis : (axis + next!) / 2,
  }
}

/**
 * Pick one contiguous replacement block closest to a feature's authored
 * center. The authored center resolves to one source block; it is never
 * moved to a different block just because another replacement already owns
 * the first choice. Callers must reject that overlap instead.
 */
export function centeredBoundaryGridIndices(
  coordinates: readonly number[],
  center: number,
  cellCount: number,
  occupiedIndices: ReadonlySet<number> = new Set(),
): number[] {
  const requestedCount = Math.max(1, Math.min(cellCount, coordinates.length))
  const maxFirstIndex = coordinates.length - requestedCount
  if (maxFirstIndex < 0) return []
  const candidates = Array.from({ length: maxFirstIndex + 1 }, (_, index) => index)
    .sort((first, second) => {
      const firstCenter = (coordinates[first] + coordinates[first + requestedCount - 1]) / 2
      const secondCenter = (coordinates[second] + coordinates[second + requestedCount - 1]) / 2
      // Resolve an exact half-cell tie toward the later cell. This is still
      // a pure authored-center rule; it does not depend on other replacements
      // already occupying the boundary.
      return Math.abs(firstCenter - center) - Math.abs(secondCenter - center) || second - first
    })
  const firstIndex = candidates[0]
  if (firstIndex === undefined) return []
  const selectedIndices = Array.from({ length: requestedCount }, (_, offset) => firstIndex + offset)
  if (selectedIndices.some((index) => occupiedIndices.has(index))) return []
  return selectedIndices
}

function boundedBoundaryGridIndices(
  coordinates: readonly number[],
  start: number,
  end: number,
  center: number,
  cellCount: number,
) {
  const boundedIndices = coordinates
    .map((coordinate, index) => ({ coordinate, index }))
    .filter(({ coordinate }) => coordinate >= start - .001 && coordinate <= end + .001)
    .map(({ index }) => index)
  if (boundedIndices.length === 0) return []

  // A storefront owns its authored interval. On a narrow viewport the
  // responsive lattice may have fewer cells than the desktop composition;
  // shrink the visual role list to the cells that actually belong to that
  // interval instead of borrowing cells from the neighbouring storefront.
  const requestedCount = Math.max(1, Math.min(cellCount, boundedIndices.length))
  const candidates = Array.from({ length: boundedIndices.length - requestedCount + 1 }, (_, offset) => offset)
    .sort((first, second) => {
      const firstStart = boundedIndices[first]
      const secondStart = boundedIndices[second]
      const firstCenter = (coordinates[firstStart] + coordinates[firstStart + requestedCount - 1]) / 2
      const secondCenter = (coordinates[secondStart] + coordinates[secondStart + requestedCount - 1]) / 2
      return Math.abs(firstCenter - center) - Math.abs(secondCenter - center) || second - first
    })
  const firstOffset = candidates[0]
  if (firstOffset === undefined) return []
  return boundedIndices.slice(firstOffset, firstOffset + requestedCount)
}

export function centeredBoundaryGridPlacement(
  start: number,
  end: number,
  targetStep: number,
  cellCount: number,
  focusCenter = (start + end) / 2,
) {
  const cells = boundaryGridCells(start, end, targetStep)
  const indices = centeredBoundaryGridIndices(cells.map((cell) => cell.center), focusCenter, cellCount)
  if (indices.length === 0) return null
  const selectedCells = indices.map((index) => cells[index])
  return {
    cells: selectedCells,
    start: selectedCells[0].start,
    end: selectedCells[selectedCells.length - 1].end,
  }
}

/**
 * The shared wall compiler. A scene structure owns one complete frame lattice.
 * Doors, labels, and other boundary features replace cells on that lattice;
 * none of them may create a second visual origin or collision line.
 */
export type SharedBoundaryOpening = {
  id: string
  start: number
  end: number
  kind?: 'door' | 'opening' | 'reserved'
  /** Number of fixed frame cells reserved by a non-visual slot. */
  cellCount?: number
  doorFlankCount?: number
  doorId?: string
  /** Keep passage geometry while leaving this boundary visually open. */
  transitionOnly?: boolean
  doorBehavior?: SceneDoorBehavior
  label?: string
  displayLabel?: string
  glyphs?: readonly string[]
  labelLayout?: 'center' | 'split'
  /** Number of fitted boundary cells left between split label glyphs. */
  labelGapCells?: number
  /** Resolve the opening after a feature in this same complete frame. */
  afterFeatureId?: string
  /** Number of frame cells left between that feature and this opening. */
  gapCells?: number
  interactionId?: string
  passageId?: string
  access?: 'open' | 'locked'
  lockedText?: string
}

export type SharedBoundaryFeature = {
  id: string
  center: number
  glyphs: readonly string[]
  layout?: 'inline' | 'content'
  interactionId?: string
}

export type SharedBoundaryFrameEdge = {
  id: string
  orientation: 'horizontal' | 'vertical'
  start: { x: number; y: number }
  length: number
  /** Use each fixed cell's owned interval for geometry instead of anchor spans. */
  geometrySource?: 'anchor' | 'cell-range'
  coordinateCount?: number
  baselineEvery?: number
  visualEndpoints?: { start?: 'omit'; end?: 'omit' }
  openings?: readonly SharedBoundaryOpening[]
  features?: readonly SharedBoundaryFeature[]
}

/**
 * One structure owns one complete wall frame. Edges are inputs to that frame,
 * never independent runtime boundaries. The frame chooses the lattice steps
 * once, allocates all replacement cells together, and exposes one canonical
 * role map to visual and collision projections.
 */
export type SharedBoundaryFrame = {
  id: string
  steps: { horizontal: number; vertical: number }
  edges: readonly SharedBoundaryFrameEdge[]
}

export type SharedBoundaryCell = SpatialLabel & {
  frameId: string
  edgeId: string
  boundaryId: string
  gridIndex: number
  axis: number
  cellStart: number
  cellEnd: number
  featureCellRole?: 'content' | 'flank'
  doorLabelPart?: string
}

export type SharedBoundaryOpeningPlacement = SharedBoundaryOpening & {
  /** Grid indices occupied by the opening label itself. */
  gridIndices: readonly number[]
  /** Grid indices reserved by the complete fixed door unit. */
  structuralGridIndices: readonly number[]
  /** Fitted edge range owned by the opening or its fixed door unit. */
  resolvedStart: number
  resolvedEnd: number
}

export type SharedBoundaryGeometryRange = {
  id: string
  kind: 'wall' | 'replacement'
  start: number
  end: number
  gridIndices: readonly number[]
  replacementId?: string
}

export type SharedBoundaryFrameEdgeCompilation = {
  edge: SharedBoundaryFrameEdge
  coordinates: readonly number[]
  cells: readonly SharedBoundaryCell[]
  labels: readonly SharedBoundaryCell[]
  openings: readonly SharedBoundaryOpeningPlacement[]
  /** Collision ranges projected from the same canonical cell-role map. */
  geometryRanges: readonly SharedBoundaryGeometryRange[]
}

export type SharedBoundaryFrameCompilation = {
  frame: SharedBoundaryFrame
  /** The complete fixed role map for the whole frame, with corners deduped. */
  cells: readonly SharedBoundaryCell[]
  labels: readonly SharedBoundaryCell[]
  edges: readonly SharedBoundaryFrameEdgeCompilation[]
}

function sharedBoundaryAxisStart(edge: SharedBoundaryFrameEdge) {
  return edge.orientation === 'horizontal' ? edge.start.x : edge.start.y
}

function sharedBoundaryPoint(edge: SharedBoundaryFrameEdge, axis: number) {
  return edge.orientation === 'horizontal'
    ? { x: axis, y: edge.start.y }
    : { x: edge.start.x, y: axis }
}

function sharedBoundaryOpeningGlyphs(opening: SharedBoundaryOpening) {
  if (opening.glyphs?.length) return opening.glyphs
  if (opening.label) return Array.from(opening.label)
  return []
}

function sharedBoundaryFeatureSlots(
  edge: SharedBoundaryFrameEdge,
  coordinates: readonly number[],
  initialOccupiedIndices: ReadonlySet<number> = new Set(),
) {
  const slots = new Map<number, { feature: SharedBoundaryFeature; glyph: string; glyphIndex: number; featureCellRole: 'content' | 'flank' }>()
  const occupied = new Set(initialOccupiedIndices)
  ;(edge.features ?? []).forEach((feature) => {
    const flankCount = feature.layout === 'content' ? 2 : 0
    const indices = centeredBoundaryGridIndices(coordinates, feature.center, feature.glyphs.length + flankCount)
    if (indices.length === 0) throw new Error(`Boundary feature ${feature.id} cannot resolve a fixed cell block`)
    if (indices.some((index) => occupied.has(index))) {
      throw new Error(`Boundary feature ${feature.id} overlaps an existing fixed cell replacement`)
    }
    const featureStart = feature.layout === 'content' ? 1 : 0
    feature.glyphs.forEach((glyph, glyphIndex) => {
      const contentIndex = indices[featureStart + glyphIndex]
      if (contentIndex === undefined) return
      occupied.add(contentIndex)
      slots.set(contentIndex, { feature, glyph, glyphIndex, featureCellRole: 'content' })
    })
    if (feature.layout === 'content') {
      ;[indices[0], indices.at(-1)].forEach((index) => {
        if (index === undefined) return
        occupied.add(index)
        slots.set(index, { feature, glyph: '', glyphIndex: -1, featureCellRole: 'flank' })
      })
    }
  })
  return slots
}

function spacedBoundaryGridIndices(coordinates: readonly number[], center: number, glyphCount: number, gap: number) {
  const stride = Math.max(1, Math.floor(gap) + 1)
  const span = Math.max(1, 1 + (Math.max(1, glyphCount) - 1) * stride)
  const maxFirstIndex = coordinates.length - span
  if (maxFirstIndex < 0) return []
  const candidates = Array.from({ length: maxFirstIndex + 1 }, (_, index) => index)
    .sort((first, second) => {
      const firstCenter = (coordinates[first] + coordinates[first + span - 1]) / 2
      const secondCenter = (coordinates[second] + coordinates[second + span - 1]) / 2
      return Math.abs(firstCenter - center) - Math.abs(secondCenter - center) || first - second
    })
  const firstIndex = candidates[0]
  return Array.from({ length: Math.max(1, glyphCount) }, (_, offset) => firstIndex + offset * stride)
}

function contiguousBoundaryGridIndicesAround(coordinates: readonly number[], indices: readonly number[], flankCount: number) {
  if (indices.length === 0) return []
  const firstIndex = Math.min(...indices) - flankCount
  const lastIndex = Math.max(...indices) + flankCount
  return Array.from({ length: lastIndex - firstIndex + 1 }, (_, offset) => firstIndex + offset)
    .filter((index) => index >= 0 && index < coordinates.length)
}

function nearestAvailableDoorGridIndices(
  coordinates: readonly number[],
  center: number,
  flankCount: number,
  occupiedIndices: ReadonlySet<number>,
) {
  const candidates = coordinates
    .map((coordinate, index) => ({ coordinate, index }))
    .sort((first, second) => Math.abs(first.coordinate - center) - Math.abs(second.coordinate - center) || second.index - first.index)
  return candidates
    .map(({ index }) => [index])
    .map((indices) => ({ indices, structural: contiguousBoundaryGridIndicesAround(coordinates, indices, flankCount) }))
    .find(({ structural }) => structural.length > 0 && structural.every((index) => !occupiedIndices.has(index)))?.indices ?? []
}

function sharedBoundaryGeometryRange(
  edge: SharedBoundaryFrameEdge,
  coordinates: readonly number[],
  indices: readonly number[],
) {
  if (indices.length === 0) return null
  const firstIndex = Math.min(...indices)
  const lastIndex = Math.max(...indices)
  if (edge.geometrySource === 'cell-range') {
    const firstRange = boundaryGridCellRange(coordinates, firstIndex)
    const lastRange = boundaryGridCellRange(coordinates, lastIndex)
    if (!firstRange || !lastRange || lastRange.end <= firstRange.start) return null
    return { start: firstRange.start, end: lastRange.end }
  }
  const start = coordinates[firstIndex]
  const end = coordinates[lastIndex]
  if (start === undefined || end === undefined || end <= start) return null
  return { start, end }
}

function sharedBoundaryOpeningSlots(
  edge: SharedBoundaryFrameEdge,
  coordinates: readonly number[],
  openings: readonly SharedBoundaryOpening[],
  featureSlots: ReadonlyMap<number, { feature: SharedBoundaryFeature; featureCellRole: 'content' | 'flank' }> = new Map(),
) {
  const slots = new Map<number, { opening: SharedBoundaryOpening; glyph?: string }>()
  const claimedStructuralIndices = new Set(featureSlots.keys())
  const placements: SharedBoundaryOpeningPlacement[] = []

  openings.forEach((opening) => {
    if (opening.end <= opening.start) return
    if (opening.kind === 'reserved') {
      const center = (opening.start + opening.end) / 2
      const gridIndices = boundedBoundaryGridIndices(
        coordinates,
        opening.start,
        opening.end,
        center,
        opening.cellCount ?? 1,
      )
      if (gridIndices.length === 0) return
      if (gridIndices.some((index) => claimedStructuralIndices.has(index))) {
        throw new Error(`Boundary opening ${opening.id} overlaps an existing fixed cell replacement`)
      }
      gridIndices.forEach((index) => claimedStructuralIndices.add(index))
      const firstRange = boundaryGridCellRange(coordinates, Math.min(...gridIndices))
      const lastRange = boundaryGridCellRange(coordinates, Math.max(...gridIndices))
      if (!firstRange || !lastRange || lastRange.end <= firstRange.start) return
      placements.push({
        ...opening,
        gridIndices,
        structuralGridIndices: gridIndices,
        resolvedStart: firstRange.start,
        resolvedEnd: lastRange.end,
      })
      return
    }
    const center = (opening.start + opening.end) / 2
    const glyphs = sharedBoundaryOpeningGlyphs(opening)
    const anchoredFeatureIndices = opening.afterFeatureId
      ? [...featureSlots.entries()]
        .filter(([, slot]) => slot.feature.id === opening.afterFeatureId && slot.featureCellRole === 'content')
        .map(([index]) => index)
      : []
    if (opening.afterFeatureId && anchoredFeatureIndices.length === 0) {
      throw new Error(`Boundary opening ${opening.id} cannot resolve after feature ${opening.afterFeatureId}`)
    }
    const gridIndices = opening.transitionOnly
      ? coordinates
        .map((coordinate, index) => ({ coordinate, index }))
        .filter(({ coordinate }) => coordinate >= opening.start - .001 && coordinate <= opening.end + .001)
        .map(({ index }) => index)
      : anchoredFeatureIndices.length > 0
      ? [Math.max(...anchoredFeatureIndices) + Math.max(0, Math.floor(opening.gapCells ?? 0)) + 1]
      : opening.labelLayout === 'split'
      ? spacedBoundaryGridIndices(coordinates, center, glyphs.length, opening.labelGapCells ?? 1)
      : opening.doorId
        ? nearestAvailableDoorGridIndices(coordinates, center, opening.doorFlankCount ?? 1, claimedStructuralIndices)
        : centeredBoundaryGridIndices(coordinates, center, glyphs.length)
    if (gridIndices.some((index) => index < 0 || index >= coordinates.length)) {
      throw new Error(`Boundary opening ${opening.id} cannot resolve within frame ${edge.id}`)
    }
    const structuralGridIndices = opening.transitionOnly
      ? gridIndices
      : opening.doorId
      ? contiguousBoundaryGridIndicesAround(coordinates, gridIndices, opening.doorFlankCount ?? 1)
      : gridIndices
    const resolvedIndices = structuralGridIndices.length > 0 ? structuralGridIndices : gridIndices
    const geometryRange = sharedBoundaryGeometryRange(edge, coordinates, resolvedIndices)
    if (!geometryRange) return
    if (structuralGridIndices.some((index) => claimedStructuralIndices.has(index))) {
      throw new Error(`Boundary opening ${opening.id} overlaps an existing fixed cell replacement`)
    }
    structuralGridIndices.forEach((index) => claimedStructuralIndices.add(index))
    placements.push({
      ...opening,
      gridIndices,
      structuralGridIndices,
      resolvedStart: geometryRange.start,
      resolvedEnd: geometryRange.end,
    })
    gridIndices.forEach((index, glyphIndex) => {
      slots.set(index, { opening, glyph: opening.transitionOnly ? '' : opening.doorId && opening.labelLayout !== 'split' ? '门' : glyphs[glyphIndex] })
    })
    if (opening.doorId && !opening.transitionOnly && gridIndices.length > 1) {
      const firstLabelIndex = Math.min(...gridIndices)
      const lastLabelIndex = Math.max(...gridIndices)
      for (let index = firstLabelIndex + 1; index < lastLabelIndex; index += 1) {
        if (!gridIndices.includes(index)) slots.set(index, { opening, glyph: '' })
      }
    }
  })

  return { slots, placements }
}

function sharedBoundaryGeometryRanges(
  edge: SharedBoundaryFrameEdge,
  cells: readonly SharedBoundaryCell[],
  openings: readonly SharedBoundaryOpeningPlacement[],
) {
  const axisStart = sharedBoundaryAxisStart(edge)
  const axisEnd = axisStart + edge.length
  const ranges = openings
    .filter((opening) => opening.end > opening.start)
    .map((opening) => ({
      opening,
      start: Math.max(axisStart, opening.resolvedStart),
      end: Math.min(axisEnd, opening.resolvedEnd),
    }))
    .filter((range) => range.end > range.start)
    .sort((first, second) => first.start - second.start)
  const structuralIndices = new Set(openings.flatMap((opening) => opening.structuralGridIndices))
  const cellIndicesForRange = (start: number, end: number) => cells
    .filter((cell) => !structuralIndices.has(cell.gridIndex) && cell.axis >= start - .001 && cell.axis <= end + .001)
    .map((cell) => cell.gridIndex)
  const geometryRanges: SharedBoundaryGeometryRange[] = []
  let cursor = axisStart
  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      geometryRanges.push({
        id: `${edge.id}-segment-${index}`,
        kind: 'wall',
        start: cursor,
        end: range.start,
        gridIndices: cellIndicesForRange(cursor, range.start),
      })
    }
    geometryRanges.push({
      id: range.opening.id,
      kind: 'replacement',
      start: range.start,
      end: range.end,
      gridIndices: range.opening.structuralGridIndices,
      replacementId: range.opening.id,
    })
    cursor = Math.max(cursor, range.end)
  })
  if (cursor < axisEnd) {
    geometryRanges.push({
      id: `${edge.id}-segment-${geometryRanges.filter((range) => range.kind === 'wall').length}`,
      kind: 'wall',
      start: cursor,
      end: axisEnd,
      gridIndices: cellIndicesForRange(cursor, axisEnd),
    })
  }
  return geometryRanges.length > 0
    ? geometryRanges
    : [{ id: `${edge.id}-segment-0`, kind: 'wall' as const, start: axisStart, end: axisEnd, gridIndices: cells.map((cell) => cell.gridIndex) }]
}

/**
 * A door replacement owns the visual seam immediately around its fixed cell
 * block. Without this whole-edge allocation, a sparse baseline can expose a
 * normal wall cell directly beside the door's structural flank, producing a
 * second visible wall in the continuous boundary run. The cells remain in
 * the canonical role map and retain their collision ownership; only the
 * baseline projection is allocated here, after the complete edge is known.
 */
function sharedBoundaryDoorSeamIndices(
  coordinates: readonly number[],
  placements: readonly SharedBoundaryOpeningPlacement[],
  occupiedIndices: ReadonlySet<number>,
) {
  const suppressed = new Set<number>()
  placements
    .filter((opening) => Boolean(opening.doorId) && !opening.transitionOnly && opening.structuralGridIndices.length > 0)
    .forEach((opening) => {
      const firstIndex = Math.min(...opening.structuralGridIndices)
      const lastIndex = Math.max(...opening.structuralGridIndices)
      ;[firstIndex - 1, lastIndex + 1].forEach((index) => {
        if (index >= 0 && index < coordinates.length && !occupiedIndices.has(index)) suppressed.add(index)
      })
    })
  return suppressed
}

function sharedFrameCellKey(frame: SharedBoundaryFrame, edge: SharedBoundaryFrameEdge, coordinates: readonly number[], index: number) {
  const point = sharedBoundaryPoint(edge, coordinates[index])
  return `${frame.id}:${point.x.toFixed(3)}:${point.y.toFixed(3)}`
}

function claimSharedFrameReplacement(
  frame: SharedBoundaryFrame,
  edge: SharedBoundaryFrameEdge,
  coordinates: readonly number[],
  index: number,
  ownerId: string,
  claims: Map<string, string>,
) {
  const key = sharedFrameCellKey(frame, edge, coordinates, index)
  const existingOwner = claims.get(key)
  if (existingOwner && existingOwner !== ownerId) {
    throw new Error(`Frame ${frame.id} has overlapping fixed cell replacements at ${key}`)
  }
  claims.set(key, ownerId)
}

function compileSharedFrameEdge(
  frame: SharedBoundaryFrame,
  edge: SharedBoundaryFrameEdge,
  replacementClaims: Map<string, string>,
): SharedBoundaryFrameEdgeCompilation {
  const axisStart = sharedBoundaryAxisStart(edge)
  const coordinates = edge.coordinateCount
    ? fixedBoundaryGridCoordinates(axisStart, axisStart + edge.length, edge.coordinateCount)
    : boundaryGridCoordinates(axisStart, axisStart + edge.length, frame.steps[edge.orientation])
  const openings = [...(edge.openings ?? [])]
    .map((opening, index) => ({ ...opening, id: opening.id || `${edge.id}-opening-${index}` }))
    .filter((opening) => opening.end > opening.start)
  const featureSlots = sharedBoundaryFeatureSlots(edge, coordinates)
  const { slots: openingSlots, placements } = sharedBoundaryOpeningSlots(edge, coordinates, openings, featureSlots)
  const occupiedIndices = new Set([
    ...openingSlots.keys(),
    ...featureSlots.keys(),
    ...placements.flatMap((opening) => opening.structuralGridIndices),
  ])
  const doorSeamIndices = sharedBoundaryDoorSeamIndices(coordinates, placements, occupiedIndices)

  placements.forEach((opening) => {
    opening.structuralGridIndices.forEach((index) => claimSharedFrameReplacement(frame, edge, coordinates, index, opening.id, replacementClaims))
  })
  featureSlots.forEach((featureSlot, index) => {
    claimSharedFrameReplacement(frame, edge, coordinates, index, featureSlot.feature.id, replacementClaims)
  })

  const doorStructuralIndices = new Map<string, Set<number>>()
  placements.filter((opening) => opening.doorId).forEach((opening) => {
    doorStructuralIndices.set(opening.id, new Set(opening.structuralGridIndices))
  })
  const visibleIndices = new Set(coordinates.map((_, index) => index).filter((index) => (
    !(index === 0 && edge.visualEndpoints?.start === 'omit')
    && !(index === coordinates.length - 1 && edge.visualEndpoints?.end === 'omit')
  )))
  const baselineEvery = Math.max(1, Math.round(edge.baselineEvery ?? 2))

  // This is the complete role map for this edge inside the already-created
  // frame. Endpoint omission and distance reveal are later projections.
  const cells = coordinates.map((axis, index): SharedBoundaryCell => {
    const point = sharedBoundaryPoint(edge, axis)
    const cellRange = boundaryGridCellRange(coordinates, index)
    if (!cellRange) throw new Error(`Boundary edge ${edge.id} cannot resolve cell range ${index}`)
    const openingSlot = openingSlots.get(index)
    const featureSlot = featureSlots.get(index)
    const structuralOpening = placements.find((opening) => doorStructuralIndices.get(opening.id)?.has(index))
    const baseline = Boolean(featureSlot || openingSlot || structuralOpening) || index % baselineEvery === 0
    const baselineVisible = baseline && !doorSeamIndices.has(index)

    if (openingSlot?.opening.kind !== 'reserved') {
      const opening = openingSlot?.opening
      if (opening) {
        const isDoor = Boolean(opening.doorId && !opening.transitionOnly)
        return {
          id: isDoor ? opening.id : `${opening.id}-${index}`,
          x: point.x,
          y: point.y,
          baseline,
          ...(baselineVisible !== baseline ? { baselineVisible } : {}),
          role: isDoor ? 'door' : 'opening',
          layoutOrientation: edge.orientation,
          glyphOrientation: isDoor ? edge.orientation : 'horizontal',
          glyph: openingSlot.glyph ?? (isDoor ? '门' : ' '),
          ...(isDoor ? { label: opening.label ?? '门' } : {}),
          ...(isDoor && opening.displayLabel ? { displayLabel: opening.displayLabel } : {}),
          ...(isDoor && opening.labelLayout === 'split' ? { doorLabelPart: openingSlot.glyph ?? '门' } : {}),
          frameId: frame.id,
          edgeId: edge.id,
          boundaryId: edge.id,
          gridIndex: index,
          axis,
          cellStart: cellRange.start,
          cellEnd: cellRange.end,
          openingId: opening.id,
          ...(opening.doorId ? { doorId: opening.doorId } : {}),
          ...(opening.doorBehavior ? { doorBehavior: opening.doorBehavior } : {}),
          ...(opening.passageId ? { passageId: opening.passageId } : {}),
          ...(opening.access ? { access: opening.access } : {}),
          ...(opening.lockedText ? { lockedText: opening.lockedText } : {}),
        }
      }
    }

    if (featureSlot) {
      return {
        id: `${featureSlot.feature.id}-${featureSlot.featureCellRole === 'flank' ? `flank-${index}` : featureSlot.glyphIndex}`,
        x: point.x,
        y: point.y,
        baseline,
        ...(baselineVisible !== baseline ? { baselineVisible } : {}),
        role: 'feature',
        layoutOrientation: edge.orientation,
        glyphOrientation: 'horizontal',
        glyph: featureSlot.glyph,
        ...(featureSlot.featureCellRole === 'content' && featureSlot.feature.interactionId
          ? { interactionId: featureSlot.feature.interactionId }
          : {}),
        frameId: frame.id,
        edgeId: edge.id,
        featureId: featureSlot.feature.id,
        featureCellRole: featureSlot.featureCellRole,
        boundaryId: edge.id,
        gridIndex: index,
        axis,
        cellStart: cellRange.start,
        cellEnd: cellRange.end,
      }
    }

    return {
      id: `${edge.id}-${index}`,
      x: point.x,
      y: point.y,
      baseline,
      ...(baselineVisible !== baseline ? { baselineVisible } : {}),
      role: 'wall',
      layoutOrientation: edge.orientation,
      glyphOrientation: 'horizontal',
      glyph: '墙',
      frameId: frame.id,
      edgeId: edge.id,
      boundaryId: edge.id,
      gridIndex: index,
      axis,
      cellStart: cellRange.start,
      cellEnd: cellRange.end,
      ...(structuralOpening ? { structuralOpeningId: structuralOpening.id } : {}),
    }
  })

  return {
    edge,
    coordinates,
    cells,
    labels: cells.filter((_, index) => visibleIndices.has(index)),
    openings: placements,
    geometryRanges: sharedBoundaryGeometryRanges(edge, cells, placements),
  }
}

function dedupeSharedFrameCells(edgeCompilations: readonly SharedBoundaryFrameEdgeCompilation[]) {
  const cellsByPoint = new Map<string, SharedBoundaryCell>()
  edgeCompilations.flatMap((compilation) => compilation.cells).forEach((cell) => {
    const key = `${cell.x.toFixed(3)}:${cell.y.toFixed(3)}`
    const existing = cellsByPoint.get(key)
    if (!existing || (existing.role === 'wall' && cell.role !== 'wall')) cellsByPoint.set(key, cell)
  })
  return [...cellsByPoint.values()]
}

function dedupeSharedFrameLabels(edgeCompilations: readonly SharedBoundaryFrameEdgeCompilation[]) {
  const labelsByPoint = new Map<string, SharedBoundaryCell>()
  edgeCompilations.flatMap((compilation) => compilation.labels).forEach((label) => {
    const key = `${label.x.toFixed(3)}:${label.y.toFixed(3)}`
    const existing = labelsByPoint.get(key)
    if (!existing || (existing.role === 'wall' && label.role !== 'wall')) labelsByPoint.set(key, label)
  })
  return [...labelsByPoint.values()]
}

/** Compile one complete structure frame and all of its edges together. */
export function compileSharedFrame(frame: SharedBoundaryFrame): SharedBoundaryFrameCompilation {
  const replacementClaims = new Map<string, string>()
  const rawEdges = frame.edges.map((edge) => compileSharedFrameEdge(frame, edge, replacementClaims))
  const labels = dedupeSharedFrameLabels(rawEdges)
  const canonicalLabels = new Set(labels)
  const edges = rawEdges.map((edge) => ({
    ...edge,
    // Corners belong to the first visible edge in frame order unless a
    // replacement cell owns that point. This keeps one visual cell per
    // physical frame location while leaving the complete role map intact.
    labels: edge.labels.filter((label) => canonicalLabels.has(label)),
  }))
  return {
    frame,
    cells: dedupeSharedFrameCells(edges),
    labels,
    edges,
  }
}
import type { SpatialLabel } from './sceneSpatialLabels'
import type { SceneDoorBehavior } from './sceneDoorConfig'
