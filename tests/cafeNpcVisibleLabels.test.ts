import { describe, expect, it } from 'vitest'
import { mainlineNpcStagedSeatId } from '../src/center/runtime/mainlineNpcStaging'
import { resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityCollision, mainlineNpcLabelFootprint } from '../src/center/runtime/sceneLayout'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { laoZhouCafeSeatPairs, withLaoZhouCafeSeat } from '../src/center/runtime/commercialCafeSeatSelection'

describe('Cafe trial preserves visible NPC role names', () => {
  it('renders each NPC’s source label and keeps its identity, seat behavior, and two-character footprint', () => {
    const cafe = mainlineScenes['commercial-street']
    const expected = new Map([
      ['lao-zhou', '老周'],
      ['cafe-coffee-owner', '店员'],
      ['cafe-floor-server', '店员'],
    ])

    for (const [npcId, visibleName] of expected) {
      const npc = cafe.npcs.find((candidate) => candidate.id === npcId)!
      expect(npc.label).toBe(visibleName)
      const position = resolveMainlineNpcPosition(cafe, npcId)
      const footprint = mainlineNpcLabelFootprint(cafe, npcId, position, sceneDesignReferenceMetrics)
      expect(footprint.width * 19.2).toBeCloseTo(32, 2)
      expect(footprint.height * 10.8).toBeCloseTo(16, 2)
    }

    expect(mainlineNpcStagedSeatId(cafe, 'lao-zhou')).toBe('commercial-cafe-right-window-upper-group-chair-top')
    expect(cafe.npcs.map((npc) => npc.id)).toEqual(expect.arrayContaining([...expected.keys()]))
  })

  it('keeps restored two-character Lao Zhou text clear of every table and non-occupied chair across all seat choices', () => {
    const base = mainlineScenes['commercial-street']
    const furniture = base.objects.filter((entity) => entity.kind === 'table' || entity.kind === 'seat')
    const overlaps = (first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) =>
      first.x < second.x + second.width && first.x + first.width > second.x
      && first.y < second.y + second.height && first.y + first.height > second.y

    for (const pair of laoZhouCafeSeatPairs()) {
      for (const laoZhouSeat of pair) {
        const scene = withLaoZhouCafeSeat(base, laoZhouSeat.id)
        const position = resolveMainlineNpcPosition(scene, 'lao-zhou')
        const label = mainlineNpcLabelFootprint(scene, 'lao-zhou', position, sceneDesignReferenceMetrics)
        for (const entity of furniture) {
          if (entity.kind === 'seat' && entity.id === laoZhouSeat.id) continue
          const collision = mainlineEntityCollision(scene, entity, {}, sceneDesignReferenceMetrics)
          if (collision) expect(overlaps(label, collision), `${laoZhouSeat.id} against ${entity.id}`).toBe(false)
        }
      }
    }
  })
})
