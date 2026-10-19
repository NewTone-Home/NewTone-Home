import { describe, expect, it } from 'vitest'
import { classifyMainlineWorldCommand, findMainlinePath, isWalkableMainlinePoint, mainlinePassageSide, resolveMainlineInteractionCandidates } from '../src/center/runtime/mainlineNavigation'
import { mainlineCanonicalSceneGeometryUnits, mainlineSceneGeometryUnits, mainlineScenes, mainlineStorefrontApproach, mainlineStorefrontInteractionCandidates } from '../src/center/runtime/mainlineScenes'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { boundaryGridStepsFromScreenSpacing } from '../src/center/runtime/sceneBoundaryGrid'
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
        expect(command.passage.access).toBe('locked')
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
        ? ['wall', 'window', 'window', 'wall', ...sign, 'wall', 'window', 'window', 'wall', 'wall', 'wall', 'window', 'window', 'wall', 'window', 'window', 'wall', 'window', 'window', 'wall']
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
      expect(active.filter((cell) => cell.storefrontRole === 'window')).toHaveLength(wide ? 10 : 4)

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
