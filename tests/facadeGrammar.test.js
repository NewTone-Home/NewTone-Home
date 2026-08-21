import { describe, expect, it } from 'vitest'
import { createFacadeGrammar } from '../src/center/geometry/facadeGrammar'
import { DETAIL_PROTOTYPE } from '../src/center/geometry/detailPrototype'

describe('Center facade grammar', () => {
  it('splits an anchor building into repeatable facade modules', () => {
    const building = DETAIL_PROTOTYPE.interactiveBuildings.find(item => item.entityId === 'memory-archive')
    expect(building?.grammar).toBeTruthy()
    expect(building.grammar.floors).toBe(4)
    expect(building.grammar.columns).toBe(5)
    expect(building.grammar.windowPath.split(' M').length).toBeGreaterThan(12)
    expect(building.grammar.framePath).toMatch(/^M/)
    expect(building.grammar.roofPath).toMatch(/^M/)
  })

  it('keeps seeded output stable and leaves unsupported styles opt-in', () => {
    const project = (x, y, z) => [x * 10 - y * 6, y * 4 - z * 8]
    const spec = { x: 0, y: 0, width: 2, depth: 1.5, height: 3, detailStyle: 'archive', seed: 9 }
    const first = createFacadeGrammar(spec, project)
    const second = createFacadeGrammar(spec, project)
    expect(first).toEqual(second)
    expect(createFacadeGrammar({ ...spec, detailStyle: 'unknown' }, project)).toBeNull()
  })
})
