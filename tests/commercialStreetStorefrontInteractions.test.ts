import { describe, expect, it } from 'vitest'
import { findMainlinePath, isWalkableMainlinePoint, resolveMainlineInteractionCandidates } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes, mainlineStorefrontApproach, mainlineStorefrontInteractionCandidates, mainlineStorefrontInteractionRegion } from '../src/center/runtime/mainlineScenes'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import {
  commercialStreetStorefrontInteractionDebounceMs,
  commercialStreetStorefrontIds,
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
  it('covers every v5 storefront slot exactly once and reserves the milk-tea action for S5', () => {
    const interactions = Object.entries(commercialStreetStorefrontInteractions)
    expect(interactions).toHaveLength(16)
    expect(interactions.map(([id]) => id).sort()).toEqual([...commercialStreetStorefrontIds].sort())
    expect(interactions.filter(([, interaction]) => interaction.kind === 'ambient')).toHaveLength(15)
    expect(interactions.filter(([, interaction]) => interaction.kind === 'action')).toHaveLength(1)
    expect(commercialStreetStorefrontInteractionFor('commercial-south-slot-5')).toEqual({ kind: 'action', action: 'milk-tea-order' })
    expect(Object.values(commercialStreetStorefrontInteractions).every((interaction) => interaction.kind === 'ambient' || interaction.kind === 'action')).toBe(true)
    expect(commercialStreetStorefrontInteractionFor('commercial-cafe-slot')).toMatchObject({ kind: 'ambient' })
  })

  it('maps all merchant observations to the v5 business layout, including the double-module shops', () => {
    const markerByStorefront: Record<string, string> = {
      'commercial-north-slot-1': '果茶',
      'commercial-north-slot-2': '书',
      'commercial-north-slot-3': '口红',
      'commercial-north-slot-4': '太阳镜',
      'commercial-north-slot-5': '玩偶',
      'commercial-north-slot-6': '香氛',
      'commercial-north-slot-7': '吧台',
      'commercial-north-slot-8': '湖岸',
      'commercial-south-slot-1': '运动鞋',
      'commercial-south-slot-2': '简餐',
      'commercial-south-slot-3': '餐桌',
      'commercial-south-slot-4': '长裙',
      'commercial-south-slot-6': '蛋糕',
      'commercial-south-slot-7': '项链',
      'commercial-south-slot-8': '风衣',
    }

    for (const [storefrontId, marker] of Object.entries(markerByStorefront)) {
      const interaction = commercialStreetStorefrontInteractionFor(storefrontId)
      expect(interaction?.kind, storefrontId).toBe('ambient')
      if (interaction?.kind === 'ambient') {
        expect(interaction.lines.join(' '), storefrontId).toContain(marker)
      }
    }
    expect(commercialStreetStorefrontInteractionFor('commercial-north-slot-7')?.kind).toBe('ambient')
    expect(commercialStreetStorefrontInteractionFor('commercial-north-slot-8')?.kind).toBe('ambient')
    expect(commercialStreetStorefrontInteractionFor('commercial-south-slot-2')?.kind).toBe('ambient')
    expect(commercialStreetStorefrontInteractionFor('commercial-south-slot-3')?.kind).toBe('ambient')
    expect(Object.values(commercialStreetStorefrontInteractions).flatMap((interaction) => interaction.kind === 'ambient' ? interaction.lines : []).join(' ')).not.toContain('Coming Soon')
  })

  it('selects ordinary storefront text without an immediate repeat and keeps it runtime-only', () => {
    const runtime = createCommercialStreetStorefrontInteractionRuntime()
    const first = resolveCommercialStreetStorefrontInteraction('commercial-north-slot-2', runtime, () => 0)
    const second = resolveCommercialStreetStorefrontInteraction('commercial-north-slot-2', runtime, () => 0)
    expect(first).toMatchObject({ kind: 'echo' })
    expect(second).toMatchObject({ kind: 'echo' })
    expect(second).not.toEqual(first)
    expect(runtime.lastShownByStorefront.get('commercial-north-slot-2')).toBe((second as { text: string }).text)
    expect(Object.keys(runtime)).toEqual(['lastShownByStorefront'])
  })

  it('shows fruit-tea observations directly and avoids an immediate repeat', () => {
    const runtime = createCommercialStreetStorefrontInteractionRuntime()
    const first = resolveCommercialStreetStorefrontInteraction('commercial-north-slot-1', runtime, () => 0)
    const second = resolveCommercialStreetStorefrontInteraction('commercial-north-slot-1', runtime, () => 0)
    expect(first).toEqual({ kind: 'echo', text: '窗边立牌上画着几种颜色鲜亮的果茶。' })
    expect(second).toEqual({ kind: 'echo', text: '菜单板列着当季水果的搭配，冷热选项标在旁边。' })
    expect(second).not.toEqual(first)
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

  it('keeps the radius-six navigation candidate geometry unchanged', () => {
    const storefront = street.storefronts.find((candidate) => candidate.id === 'commercial-north-slot-2')!
    const approach = mainlineStorefrontApproach(street, storefront)
    const region = mainlineStorefrontInteractionRegion(street, storefront)
    const candidates = mainlineStorefrontInteractionCandidates(street, storefront, { x: (storefront.start + storefront.end) / 2, y: approach.y + 8 })
    expect(candidates[0]).toEqual({ x: region.center.x + region.outward.x * region.radius, y: region.center.y + region.outward.y * region.radius })
    expect(candidates[18]).toEqual({ x: region.center.x + region.outward.x * region.radius * .7, y: region.center.y + region.outward.y * region.radius * .7 })
    expect(candidates[36]).toEqual({ x: region.center.x + region.outward.x * region.radius * .4, y: region.center.y + region.outward.y * region.radius * .4 })
  })

  it('keeps Café on the separate portal and reveal contract', () => {
    const cafe = street.storefronts.find((candidate) => candidate.id === 'commercial-cafe-slot')!
    expect(cafe.portalId).toBe('street-cafe-entry')
    expect(commercialStreetStorefrontInteractionFor(cafe.id)).toMatchObject({ kind: 'ambient' })
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

  it('debounces fruit-tea observations without suppressing the milk-tea action', () => {
    const fruitRuntime = createCommercialStreetStorefrontInteractionRuntime()
    const fruitExecutionRuntime = createCommercialStreetStorefrontExecutionRuntime()
    let firstChoiceCalls = 0
    const firstChoice = () => {
      firstChoiceCalls += 1
      return firstChoiceCalls === 3 ? .999 : 0
    }
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', fruitRuntime, fruitExecutionRuntime, 1000, firstChoice)).toEqual({ kind: 'echo', text: '窗边立牌上画着几种颜色鲜亮的果茶。' })
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', fruitRuntime, fruitExecutionRuntime, 1140, firstChoice)).toBeNull()
    expect(firstChoiceCalls).toBe(1)
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', fruitRuntime, fruitExecutionRuntime, 1300, firstChoice)).toEqual({ kind: 'echo', text: '菜单板列着当季水果的搭配，冷热选项标在旁边。' })
    expect(firstChoiceCalls).toBe(2)
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', fruitRuntime, fruitExecutionRuntime, 1600, firstChoice)).toEqual({ kind: 'echo', text: '透明壶里的柑橘和莓果浸出淡淡的颜色。' })

    const secondChoiceRuntime = createCommercialStreetStorefrontInteractionRuntime()
    const secondChoiceExecutionRuntime = createCommercialStreetStorefrontExecutionRuntime()
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', secondChoiceRuntime, secondChoiceExecutionRuntime, 1000, () => 0)).toEqual({ kind: 'echo', text: '窗边立牌上画着几种颜色鲜亮的果茶。' })
    expect(executeCommercialStreetStorefrontInteraction('commercial-north-slot-1', secondChoiceRuntime, secondChoiceExecutionRuntime, 1300, () => 0)).toEqual({ kind: 'echo', text: '菜单板列着当季水果的搭配，冷热选项标在旁边。' })

    const milkRuntime = createCommercialStreetStorefrontInteractionRuntime()
    const milkExecutionRuntime = createCommercialStreetStorefrontExecutionRuntime()
    expect(executeCommercialStreetStorefrontInteraction('commercial-south-slot-5', milkRuntime, milkExecutionRuntime, 1000)).toEqual({ kind: 'action', action: 'milk-tea-order' })
    expect(executeCommercialStreetStorefrontInteraction('commercial-south-slot-5', milkRuntime, milkExecutionRuntime, 1140)).toBeNull()
    expect(executeCommercialStreetStorefrontInteraction('commercial-south-slot-5', milkRuntime, milkExecutionRuntime, 1300)).toEqual({ kind: 'action', action: 'milk-tea-order' })
  })
})
