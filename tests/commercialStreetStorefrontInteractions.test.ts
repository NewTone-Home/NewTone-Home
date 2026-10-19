import { describe, expect, it } from 'vitest'
import { classifyMainlineWorldCommand, findMainlinePath, isWalkableMainlinePoint, mainlinePassageSide, resolveMainlineInteractionCandidates } from '../src/center/runtime/mainlineNavigation'
import { mainlineCanonicalSceneGeometryUnits, mainlineSceneGeometryUnits, mainlineScenes, mainlineStorefrontApproach, mainlineStorefrontInteractionCandidates } from '../src/center/runtime/mainlineScenes'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { boundaryGridStepsFromScreenSpacing } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineCameraOffset, mainlineCameraTarget } from '../src/center/runtime/mainlineViewport'
import {
  commercialStreetStorefrontInteractionDebounceMs,
  commercialStreetStorefrontInteractions,
  commercialStreetStorefrontInteractionFor,
  createCommercialStreetStorefrontExecutionRuntime,
  createCommercialStreetStorefrontInteractionRuntime,
  executeCommercialStreetStorefrontInteraction,
  isCommercialStreetStorefrontInteractionDebounced,
  resolveCommercialStreetStorefrontInteraction,
} from '../src/center/runtime/commercialStreetStorefrontInteractions'

const street = mainlineScenes['commercial-street']

describe('commercial street storefront interactions', () => {
  it('defines exactly the 15 echo-capable storefronts plus the milk-tea order action, never Café', () => {
    const interactions = Object.entries(commercialStreetStorefrontInteractions)
    expect(interactions).toHaveLength(16)
    expect(interactions.filter(([, interaction]) => interaction.kind !== 'action')).toHaveLength(15)
    expect(commercialStreetStorefrontInteractionFor('commercial-south-slot-5')).toEqual({ kind: 'action', action: 'milk-tea-order' })
    expect(commercialStreetStorefrontInteractionFor('commercial-cafe-slot')).toBeUndefined()
  })

  it('selects ordinary storefront text without an immediate repeat and keeps it runtime-only', () => {
    const runtime = createCommercialStreetStorefrontInteractionRuntime()
    const first = resolveCommercialStreetStorefrontInteraction('commercial-north-slot-2', runtime, () => 0)
    const second = resolveCommercialStreetStorefrontInteraction('commercial-north-slot-2', runtime, () => 0)
    expect(first).toMatchObject({ kind: 'echo' })
    expect(second).toMatchObject({ kind: 'echo' })
    expect(second).not.toEqual(first)
    expect(runtime.lastShownByStorefront.get('commercial-north-slot-2')).toBe((second as { text: string }).text)
    expect(Object.keys(runtime)).toEqual(['lastShownByStorefront', 'comingSoonShown'])
  })

  it('shows fruit tea Coming Soon once per scene runtime, then chooses non-repeating local text', () => {
    const runtime = createCommercialStreetStorefrontInteractionRuntime()
    expect(resolveCommercialStreetStorefrontInteraction('commercial-north-slot-1', runtime, () => 0)).toEqual({ kind: 'echo', text: 'Coming Soon' })
    const second = resolveCommercialStreetStorefrontInteraction('commercial-north-slot-1', runtime, () => 0)
    const third = resolveCommercialStreetStorefrontInteraction('commercial-north-slot-1', runtime, () => 0)
    expect(second).toEqual({ kind: 'echo', text: '门边的立牌上画着几种颜色很亮的果饮。' })
    expect(third).toEqual({ kind: 'echo', text: '招牌上的布还没有揭开。' })
    const rebuiltRuntime = createCommercialStreetStorefrontInteractionRuntime()
    expect(resolveCommercialStreetStorefrontInteraction('commercial-north-slot-1', rebuiltRuntime)).toEqual({ kind: 'echo', text: 'Coming Soon' })
  })

  it('uses existing legal navigation to reach representative storefront approaches before interaction', () => {
    ['commercial-north-slot-1', 'commercial-north-slot-2', 'commercial-south-slot-5'].forEach((storefrontId) => {
      const storefront = street.storefronts.find((candidate) => candidate.id === storefrontId)!
      const approach = mainlineStorefrontApproach(street, storefront)
      expect(isWalkableMainlinePoint(approach, street)).toBe(true)
      expect(findMainlinePath(street.initialPlayerPosition, approach, street)).not.toBeNull()
      expect(Math.hypot(street.initialPlayerPosition.x - approach.x, street.initialPlayerPosition.y - approach.y)).toBeGreaterThan(.35)
    })
  })

  it('routes sign, door and behind-facade clicks to the matching locked northern, southern and side shop portals', () => {
    const targets = ['commercial-north-slot-2', 'commercial-south-slot-5', 'commercial-cafe-slot', 'commercial-south-slot-2']
    const canonical = mainlineCanonicalSceneGeometryUnits(street, { width: 1280, height: 720 })
    for (const storefrontId of targets) {
      const storefront = street.storefronts.find((candidate) => candidate.id === storefrontId)!
      const passage = street.passages.find((candidate) => candidate.portalId === storefront.portalId)!
      const door = canonical.flatMap((unit) => unit.visual.cells)
        .find((cell) => cell.storefrontId === storefront.id && cell.storefrontRole === 'door')!
      const sign = canonical.flatMap((unit) => unit.visual.cells)
        .find((cell) => cell.storefrontId === storefront.id && cell.storefrontRole === 'sign')!
      const bounds = street.structures.find((candidate) => candidate.id === storefront.wallId)!.bounds!
      const behind = storefront.edge === 'top'
        ? { x: door.x, y: bounds.y + 3 }
        : storefront.edge === 'bottom'
          ? { x: door.x, y: bounds.y + bounds.height - 3 }
          : storefront.edge === 'left'
            ? { x: bounds.x + 3, y: door.y }
            : { x: bounds.x + bounds.width - 3, y: door.y }

      for (const target of [{ x: sign.x, y: sign.y }, { x: door.x, y: door.y }, behind]) {
        const command = classifyMainlineWorldCommand(street, street.initialPlayerPosition, target)
        expect(command.kind, `${storefrontId} click ${target.x},${target.y}`).toBe('passage')
        if (command.kind !== 'passage') continue
        expect(command.passage.id, `${storefrontId} click ${target.x},${target.y}`).toBe(passage.id)
        expect(command.passage.access).toBe('open')
        expect(command.approachPath).not.toBeNull()
        const approachEnd = command.approachPath!.at(-1)!
        expect(isWalkableMainlinePoint(approachEnd, street)).toBe(true)
        expect(mainlinePassageSide(command.passage, approachEnd)).toBe(0)
      }

      const threshold = passage.thresholds[0]
      const crossing = passage.crossingTargets[0]
      const authoredApproach = mainlineStorefrontApproach(street, storefront)
      expect(threshold.x).toBeCloseTo(authoredApproach.x)
      expect(threshold.y).toBeCloseTo(authoredApproach.y)
      expect(Math.abs(crossing.x - threshold.x) + Math.abs(crossing.y - threshold.y)).toBeGreaterThan(1)
      expect(Math.abs(crossing.x - threshold.x) > Math.abs(crossing.y - threshold.y) ? 'x' : 'y')
        .toBe(storefront.edge === 'left' || storefront.edge === 'right' ? 'x' : 'y')
      if (storefront.edge === 'bottom') expect(crossing.y).toBeLessThan(threshold.y)
      if (storefront.edge === 'top') expect(crossing.y).toBeGreaterThan(threshold.y)
    }
  })

  // This checks six route shapes across all 14 rooms, including new retail barriers.
  it('routes all fourteen storefront shells through the continuous street room and preserves the shared 22-cell depth', () => {
    const steps = boundaryGridStepsFromScreenSpacing()
    const roomSamples = street.storefronts.map((storefront) => {
      const side = storefront.edge === 'bottom' ? 'north' as const : 'south' as const
      const slotNumber = storefront.id.match(/-slot-(\d+)$/)?.[1]
      const roomId = storefront.id === 'commercial-cafe-slot'
        ? 'commercial-north-cafe-interior'
        : `commercial-${side}-${side === 'north' ? 'n' : 's'}${slotNumber}-interior`
      return { storefront, roomId, widthCells: storefront.composition!.fixedCellCount!, side }
    })
    expect(roomSamples).toHaveLength(14)
    expect(street.rooms.filter((room) => room.id.endsWith('-interior'))).toHaveLength(14)
    expect(new Set(roomSamples.map((sample) => sample.roomId)).size).toBe(14)

    for (const { storefront, roomId, widthCells, side } of roomSamples) {
      const storefrontId = storefront.id
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      const entry = street.passages.find((candidate) => candidate.portalId === storefront.portalId)!
      const rear = street.passages.find((candidate) => candidate.id === `${roomId}-rear-door`)!
      const shell = street.structures.find((candidate) => candidate.id === `${roomId}-shell`)!
      const expectedDepth = steps.vertical * 21
      const interior = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
      const approach = mainlineStorefrontApproach(street, storefront)
      const publicLanePath = findMainlinePath(street.initialPlayerPosition, approach, street)
      const entryPath = findMainlinePath(approach, interior, street)
      const rearDoorApproachPath = findMainlinePath(interior, rear.thresholds[0], street)
      const command = classifyMainlineWorldCommand(street, street.initialPlayerPosition, interior)

      expect(room.bounds.width).toBeCloseTo(steps.horizontal * (widthCells - 1))
      expect(room.bounds.height).toBeCloseTo(expectedDepth)
      expect(entry).toMatchObject({ access: 'open', routeThrough: true, fromRoomId: 'commercial-street-public-lane', toRoomId: roomId })
      expect(entry.targetSceneId).toBeUndefined()
      expect(command.kind).toBe('passage')
      if (command.kind === 'passage') expect(command.passage.id).toBe(entry.id)
      expect(rear).toMatchObject({ access: 'locked' })
      expect(rear.targetSceneId).toBeUndefined()
      const rearCommand = classifyMainlineWorldCommand(street, interior, rear.crossingTargets[0])
      expect(rearCommand.kind, `${storefrontId} rear-door approach`).toBe('passage')
      if (rearCommand.kind === 'passage') expect(rearCommand.passage.id).toBe(rear.id)
      expect(shell?.wallEdges).toEqual(side === 'north' ? ['top', 'left', 'right'] : ['bottom', 'left', 'right'])
      expect(isWalkableMainlinePoint(interior, street)).toBe(true)
      expect(publicLanePath, `${storefrontId} street-to-approach path`).not.toBeNull()
      expect(entryPath, `${storefrontId} front-to-room path`).not.toBeNull()
      expect(entryPath?.length).toBeGreaterThan(1)
      expect(rearDoorApproachPath, `${storefrontId} path to locked rear threshold`).not.toBeNull()
      expect(findMainlinePath(entry.crossingTargets[0], interior, street)).not.toBeNull()
      expect(findMainlinePath(interior, entry.thresholds[0], street)).not.toBeNull()
      expect(street.walkBounds.y).toBeLessThan(room.bounds.y)
      expect(street.walkBounds.y + street.walkBounds.height).toBeGreaterThan(room.bounds.y + room.bounds.height)
      expect(storefront.id === 'commercial-cafe-slot' ? roomId : entry.toRoomId).toBe(roomId)
      expect(room.bounds.height / steps.vertical).toBeCloseTo(21)
    }

    const northRoom = street.rooms.find((candidate) => candidate.id === 'commercial-north-n2-interior')!
    const northInterior = { x: northRoom.bounds.x + northRoom.bounds.width / 2, y: northRoom.bounds.y + northRoom.bounds.height / 2 }
    const offset = mainlineCameraOffset(street, northInterior)
    const target = mainlineCameraTarget(street, northInterior, offset)
    expect(offset.y).toBeGreaterThan(0)
    expect(target.y).toBeGreaterThan(0)
  }, 120_000)

  it('compiles fixed shell anchors that align front, rear, and side corners at every supported viewport', () => {
    const metrics = [
      { width: 1280, height: 720 },
      { width: 1180, height: 757 },
      { width: 390, height: 844 },
    ]
    const samples = street.storefronts.map((storefront) => {
      const side = storefront.edge === 'bottom' ? 'north' as const : 'south' as const
      const slotNumber = storefront.id.match(/-slot-(\d+)$/)?.[1]
      const roomId = storefront.id === 'commercial-cafe-slot'
        ? 'commercial-north-cafe-interior'
        : `commercial-${side}-${side === 'north' ? 'n' : 's'}${slotNumber}-interior`
      return {
        storefront,
        roomId,
        characterCount: storefront.composition!.fixedCellCount!,
        rearEdge: side === 'north' ? 'top' as const : 'bottom' as const,
        facadeId: side === 'north' ? 'commercial-north-facade' : 'commercial-south-facade',
        facadeEdge: side === 'north' ? 'bottom' as const : 'top' as const,
      }
    })

    for (const { storefront, roomId, characterCount, rearEdge, facadeId, facadeEdge } of samples) {
      const storefrontId = storefront.id
      const shellId = `${roomId}-shell`
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      const canonicalFacadeXs = mainlineSceneGeometryUnits(
        street,
        street.initialPlayerPosition,
        metrics[0],
        new Map([[storefrontId, 'baseline']]),
      ).flatMap((unit) => unit.visual.cells)
        .filter((cell) => cell.storefrontId === storefrontId)
        .map((cell) => cell.x)
        .sort((left, right) => left - right)
      expect(canonicalFacadeXs).toHaveLength(characterCount)

      const anchorSignatures: string[] = []
      for (const viewport of metrics) {
        const units = mainlineCanonicalSceneGeometryUnits(street, viewport)
        const shellUnits = units.filter((unit) => unit.sourceWallId === shellId)
        const allShellCells = shellUnits.flatMap((unit) => unit.visual.cells).filter((cell) => cell.glyph !== '')
        const cellsByCoordinate = new Map<string, (typeof allShellCells)[number][]>()
        for (const cell of allShellCells) {
          const key = `${cell.x.toFixed(3)}:${cell.y.toFixed(3)}`
          cellsByCoordinate.set(key, [...(cellsByCoordinate.get(key) ?? []), cell])
        }
        const duplicateShellCoordinates = [...cellsByCoordinate.entries()].filter(([, cells]) => cells.length > 1)
        expect(duplicateShellCoordinates.map(([coordinate, cells]) => ({ coordinate, cells: cells.map(cell => ({ glyph: cell.glyph, edge: cell.edge, id: cell.entityId })) })))
          .toEqual([])
        const rearCells = shellUnits.filter((unit) => unit.edge === rearEdge).flatMap((unit) => unit.visual.cells)
        const rearPassage = street.passages.find((candidate) => candidate.id === `${roomId}-rear-door`)!
        const rearDoorPosition = street.objects.find((candidate) => candidate.id === rearPassage.entityId)!.position
        const rearXs = [...new Set(rearCells.map((cell) => Number(cell.x.toFixed(3))))].sort((left, right) => left - right)
        expect(rearXs).toHaveLength(characterCount)
        rearXs.forEach((x, index) => expect(x).toBeCloseTo(canonicalFacadeXs[index]!, 2))
        const rearDoorCell = rearCells.find((cell) => cell.kind === 'door')!
        expect(rearDoorCell.x).toBeCloseTo(rearDoorPosition.x, 2)
        expect(rearDoorCell.y).toBeCloseTo(rearDoorPosition.y, 2)

        const facadeUnits = units.filter((unit) => unit.sourceWallId === facadeId && unit.edge === facadeEdge)
        const facadeCells = facadeUnits.flatMap((unit) => unit.visual.cells)
        const viewportSignature: string[] = []
        const sideEdges = ['left', 'right'] as const
        for (const sideEdge of sideEdges) {
          const sideUnits = shellUnits.filter((unit) => unit.edge === sideEdge)
          const sideCells = sideUnits.flatMap((unit) => unit.visual.cells)
          const sideX = sideEdge === 'left' ? canonicalFacadeXs[0] : canonicalFacadeXs.at(-1)!
          const sideYs = new Set(sideCells.filter((cell) => Math.abs(cell.x - sideX) < .01).map((cell) => Number(cell.y.toFixed(3))))
          const frontCorner = facadeCells.find((cell) => Math.abs(cell.x - sideX) < .01)
          const rearCorner = rearCells.find((cell) => Math.abs(cell.x - sideX) < .01)
          expect(frontCorner, `${viewport.width}x${viewport.height} ${sideEdge} front corner`).toBeDefined()
          expect(rearCorner, `${viewport.width}x${viewport.height} ${sideEdge} rear corner`).toBeDefined()
          expect(sideCells.some((cell) => cell.glyph !== '' && Math.abs(cell.x - frontCorner!.x) < .01 && Math.abs(cell.y - frontCorner!.y) < .01))
            .toBe(false)
          sideYs.add(Number(frontCorner!.y.toFixed(3)))
          sideYs.add(Number(rearCorner!.y.toFixed(3)))
          const continuousSide = [...sideYs].sort((left, right) => left - right)
          expect(continuousSide).toHaveLength(22)
          const pitch = room.bounds.height / 21
          continuousSide.slice(1).forEach((y, index) => expect(y - continuousSide[index]).toBeCloseTo(pitch, 2))
          viewportSignature.push(`${sideEdge}:${continuousSide.join(',')}`)
        }
        viewportSignature.push(`rear:${rearXs.join(',')}`)
        anchorSignatures.push(viewportSignature.join('|'))
        expect(room.bounds.width).toBeCloseTo((characterCount - 1) * (canonicalFacadeXs[1]! - canonicalFacadeXs[0]!))
      }

      expect(anchorSignatures[1]).toBe(anchorSignatures[0])
      expect(anchorSignatures[2]).toBe(anchorSignatures[0])
    }
  })


  it('projects the contact onto the continuous facade span from left, centre, and right approaches', () => {
    const storefront = street.storefronts.find((candidate) => candidate.id === 'commercial-north-slot-2')!
    const approach = mainlineStorefrontApproach(street, storefront)
    const fromPoints = [
      { x: storefront.start + 1, y: approach.y + 8 },
      { x: (storefront.start + storefront.end) / 2, y: approach.y + 8 },
      { x: storefront.end - 1, y: approach.y + 8 },
    ]
    const preferred = fromPoints.map((from) => mainlineStorefrontInteractionCandidates(street, storefront, from)[0]!)
    expect(preferred[0]!.x).toBeLessThan(preferred[1]!.x)
    expect(preferred[1]!.x).toBeLessThan(preferred[2]!.x)
    expect(preferred.every((point) => isWalkableMainlinePoint(point, street))).toBe(true)
  })

  it('keeps the radius-six navigation candidate geometry unchanged', () => {
    const storefront = street.storefronts.find((candidate) => candidate.id === 'commercial-north-slot-2')!
    const approach = mainlineStorefrontApproach(street, storefront)
    const candidates = mainlineStorefrontInteractionCandidates(street, storefront, { x: (storefront.start + storefront.end) / 2, y: approach.y + 8 })
    const anchor = street.objects.find(entity => entity.id === storefront.portalId)!.position
    expect(Math.hypot(candidates[0]!.x - anchor.x, candidates[0]!.y - anchor.y)).toBeCloseTo(6)
    expect(Math.hypot(candidates[18]!.x - anchor.x, candidates[18]!.y - anchor.y)).toBeCloseTo(4.2)
    expect(Math.hypot(candidates[36]!.x - anchor.x, candidates[36]!.y - anchor.y)).toBeCloseTo(2.4)
  })

  it('keeps Café on the separate portal and reveal contract', () => {
    const cafe = street.storefronts.find((candidate) => candidate.id === 'commercial-cafe-slot')!
    expect(cafe.portalId).toBe('street-cafe-entry')
    expect(commercialStreetStorefrontInteractionFor(cafe.id)).toBeUndefined()
  })

  it('uses each shop name as its exact sign width and keeps the facade lattice fixed across viewports', () => {
    const metrics = [
      { width: 2048, height: 788 },
      { width: 1180, height: 757 },
      { width: 390, height: 844 },
    ]
    const expectedRoles = (label: string, wide: boolean) => {
      const sign = Array.from(label, () => 'sign')
      return wide
        ? ['wall', ...sign, 'wall', 'window', 'window', 'window', 'window', 'window', 'wall', 'wall', 'wall', 'window', 'window', 'window', 'window', 'window', 'window', 'window', 'window', 'window', 'wall']
        : ['wall', 'window', 'window', 'wall', ...sign, 'wall', 'window', 'window', 'wall']
    }
    const phases = new Map(street.storefronts.map((storefront) => [storefront.id, 'baseline' as const]))
    const firstGrid = mainlineSceneGeometryUnits(street, { x: 0, y: 0 }, metrics[0], phases)
      .flatMap((unit) => unit.visual.cells)
      .filter((cell) => cell.storefrontId)
      .map((cell) => `${cell.storefrontId}:${cell.x}:${cell.glyph}`)
    for (const viewport of metrics.slice(1)) {
      const projected = mainlineSceneGeometryUnits(street, { x: 0, y: 0 }, viewport, phases)
        .flatMap((unit) => unit.visual.cells)
        .filter((cell) => cell.storefrontId)
        .map((cell) => `${cell.storefrontId}:${cell.x}:${cell.glyph}`)
      expect(projected).toEqual(firstGrid)
    }

    for (const storefront of street.storefronts) {
      const wide = storefront.id === 'commercial-cafe-slot' || storefront.id === 'commercial-south-slot-2'
      const expected = expectedRoles(storefront.label, wide)
      expect(storefront.composition?.baseline).toEqual(expected)
      expect(storefront.composition?.fixedCellCount).toBe(expected.length)
      const active = mainlineSceneGeometryUnits(street, { x: 0, y: 0 }, metrics[0], phases)
        .flatMap((unit) => unit.visual.cells)
        .filter((cell) => cell.storefrontId === storefront.id)
      expect(active).toHaveLength(expected.length)
      expect(new Set(active.map((cell) => cell.x)).size).toBe(expected.length)
      expect(active.filter((cell) => cell.storefrontRole === 'sign').map((cell) => cell.glyph).join('')).toBe(storefront.label)
      expect(active.filter((cell) => cell.storefrontRole === 'window')).toHaveLength(wide ? 14 : 4)

      const near = mainlineSceneGeometryUnits(street, { x: 0, y: 0 }, metrics[0], new Map([[storefront.id, 'revealed']]))
        .flatMap((unit) => unit.visual.cells)
        .filter((cell) => cell.storefrontId === storefront.id)
      expect(near).toHaveLength(expected.length)
      expect(near.filter((cell) => cell.storefrontRole === 'door')).toHaveLength(1)
      expect(near.filter((cell) => cell.storefrontRole === 'sign')).toHaveLength(0)
      expect(near.filter((cell) => cell.storefrontRole === 'window').map((cell) => cell.x))
        .toEqual(active.filter((cell) => cell.storefrontRole === 'window').map((cell) => cell.x))
    }

    for (const edge of ['top', 'bottom'] as const) {
      const row = street.storefronts.filter((storefront) => storefront.edge === edge)
      for (const [index, storefront] of row.slice(0, -1).entries()) {
        const next = row[index + 1]!
        expect(next.start - storefront.end).toBeCloseTo(boundaryGridStepsFromScreenSpacing().horizontal)
        const activeCells = mainlineSceneGeometryUnits(street, { x: 0, y: 0 }, metrics[0], phases)
          .flatMap((unit) => unit.visual.cells)
        const previousCells = activeCells.filter((cell) => cell.storefrontId === storefront.id).sort((a, b) => a.x - b.x)
        const nextCells = activeCells.filter((cell) => cell.storefrontId === next.id).sort((a, b) => a.x - b.x)
        const boundaryGapWalls = activeCells.filter((cell) => (
          !cell.storefrontId && cell.glyph === '墙'
          && cell.x > previousCells.at(-1)!.x && cell.x < nextCells[0]!.x
          && Math.abs(cell.y - previousCells.at(-1)!.y) < .001
        ))
        expect(boundaryGapWalls).toHaveLength(1)
      }
    }
  })

  it('re-resolves a continuous facade when a live actor occupies the nearest projected contact', () => {
    const storefront = street.storefronts.find((candidate) => candidate.id === 'commercial-north-slot-2')!
    const from = { x: (storefront.start + storefront.end) / 2, y: mainlineStorefrontApproach(street, storefront).y + 8 }
    const candidates = mainlineStorefrontInteractionCandidates(street, storefront, from)
    const runtime = createNavigationRuntime()
    const preferredContact = candidates[0]!
    const blockerFootprint = mainlineProtagonistDotFootprint(preferredContact)
    runtime.registerActor('ambient-blocker', preferredContact, blockerFootprint)

    const resolved = resolveMainlineInteractionCandidates(
      street,
      street.initialPlayerPosition,
      candidates,
      .35,
      {},
      { actorId: 'protagonist', navigationRuntime: runtime },
    )

    expect(resolved.path).not.toBeNull()
    expect(resolved.target).not.toEqual(preferredContact)
    expect(isWalkableMainlinePoint(resolved.target, street, {}, { actorId: 'protagonist', navigationRuntime: runtime })).toBe(true)
    expect(candidates).toContainEqual(resolved.target)
  })

  it('guards only rapid already-arrived re-clicks for 300ms', () => {
    expect(commercialStreetStorefrontInteractionDebounceMs).toBe(300)
    expect(isCommercialStreetStorefrontInteractionDebounced(undefined, 1000)).toBe(false)
    expect(isCommercialStreetStorefrontInteractionDebounced(1000, 1299)).toBe(true)
    expect(isCommercialStreetStorefrontInteractionDebounced(1000, 1300)).toBe(false)
  })

  it('guards the final ordinary-storefront execution for direct and movement-arrival routes without consuming text', () => {
    expect(commercialStreetStorefrontInteractionDebounceMs).toBe(300)
    const runtime = createCommercialStreetStorefrontInteractionRuntime()
    const executionRuntime = createCommercialStreetStorefrontExecutionRuntime()
    let randomCalls = 0
    const random = () => {
      randomCalls += 1
      return 0
    }

    const first = executeCommercialStreetStorefrontInteraction('commercial-north-slot-2', runtime, executionRuntime, 1000, random)
    const afterFirst = runtime.lastShownByStorefront.get('commercial-north-slot-2')
    // This represents either an already-at-contact re-click or a short move
    // finishing 140ms later: both share the final execution guard.
    const blocked = executeCommercialStreetStorefrontInteraction('commercial-north-slot-2', runtime, executionRuntime, 1140, random)
    expect(first).toMatchObject({ kind: 'echo' })
    expect(blocked).toBeNull()
    expect(runtime.lastShownByStorefront.get('commercial-north-slot-2')).toBe(afterFirst)
    expect(randomCalls).toBe(1)

    const afterCooldown = executeCommercialStreetStorefrontInteraction('commercial-north-slot-2', runtime, executionRuntime, 1300, random)
    expect(afterCooldown).toMatchObject({ kind: 'echo' })
    expect(afterCooldown).not.toEqual(first)
  })

  it('does not let the cooldown skip fruit-tea Coming Soon or repeat the milk-tea action', () => {
    const fruitRuntime = createCommercialStreetStorefrontInteractionRuntime()
    const fruitExecutionRuntime = createCommercialStreetStorefrontExecutionRuntime()
    let firstChoiceCalls = 0
    const firstChoice = () => {
      firstChoiceCalls += 1
      return 0
    }
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', fruitRuntime, fruitExecutionRuntime, 1000, firstChoice)).toEqual({ kind: 'echo', text: 'Coming Soon' })
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', fruitRuntime, fruitExecutionRuntime, 1140, firstChoice)).toBeNull()
    expect(firstChoiceCalls).toBe(0)
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', fruitRuntime, fruitExecutionRuntime, 1300, firstChoice)).toEqual({ kind: 'echo', text: '门边的立牌上画着几种颜色很亮的果饮。' })
    expect(firstChoiceCalls).toBe(1)
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', fruitRuntime, fruitExecutionRuntime, 1600, firstChoice)).toEqual({ kind: 'echo', text: '招牌上的布还没有揭开。' })

    const secondChoiceRuntime = createCommercialStreetStorefrontInteractionRuntime()
    const secondChoiceExecutionRuntime = createCommercialStreetStorefrontExecutionRuntime()
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', secondChoiceRuntime, secondChoiceExecutionRuntime, 1000, () => .999)).toEqual({ kind: 'echo', text: 'Coming Soon' })
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', secondChoiceRuntime, secondChoiceExecutionRuntime, 1300, () => .999)).toEqual({ kind: 'echo', text: '招牌上的布还没有揭开。' })

    const milkRuntime = createCommercialStreetStorefrontInteractionRuntime()
    const milkExecutionRuntime = createCommercialStreetStorefrontExecutionRuntime()
    expect(executeCommercialStreetStorefrontInteraction('commercial-south-slot-5', milkRuntime, milkExecutionRuntime, 1000)).toEqual({ kind: 'action', action: 'milk-tea-order' })
    expect(executeCommercialStreetStorefrontInteraction('commercial-south-slot-5', milkRuntime, milkExecutionRuntime, 1140)).toBeNull()
    expect(executeCommercialStreetStorefrontInteraction('commercial-south-slot-5', milkRuntime, milkExecutionRuntime, 1300)).toEqual({ kind: 'action', action: 'milk-tea-order' })
  })
})
