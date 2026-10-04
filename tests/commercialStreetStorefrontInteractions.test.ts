import { describe, expect, it } from 'vitest'
import { findMainlinePath, isWalkableMainlinePoint, resolveMainlineInteractionCandidates, resolveMainlineStorefrontInteraction } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes, mainlineStorefrontApproach, mainlineStorefrontInteractionCandidates } from '../src/center/runtime/mainlineScenes'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
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

  it('accepts any legal point in the outward half-disc without routing to a fixed contact', () => {
    const storefront = street.storefronts.find(s => s.id === 'commercial-south-slot-5')!
    for (const from of [{x:108,y:60.5},{x:110,y:59},{x:114,y:60.5}]) {
      expect(resolveMainlineStorefrontInteraction(street, storefront, from)).toEqual({target:from,path:[from],inRange:true})
    }
    expect(resolveMainlineStorefrontInteraction(street, storefront, {x:110,y:53}).inRange).toBe(false)
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
