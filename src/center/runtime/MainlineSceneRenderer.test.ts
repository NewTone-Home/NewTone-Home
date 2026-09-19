import { describe, expect, it } from 'vitest'
import { mainlineEntityUsesBreathing } from './MainlineSceneRenderer'
import { mainlineScenes } from './mainlineScenes'

describe('mainline renderer breathing semantics', () => {
  it('breathes for the old tree but not its tree-ring stones', () => {
    const yard = mainlineScenes['jijia-ancestral-home']
    const tree = yard.objects.find((entity) => entity.id === 'jijia-old-tree')
    const stone = yard.objects.find((entity) => entity.id === 'jijia-old-tree-stone-n')

    expect(tree?.visualProfile).toBe('tree-ring')
    expect(tree && mainlineEntityUsesBreathing(yard, tree)).toBe(true)
    expect(stone).toMatchObject({ visualProfile: 'tree-ring', interactive: false })
    expect(stone && mainlineEntityUsesBreathing(yard, stone)).toBe(false)
  })

  it('does not change breathing for incense, offering tables, or office furniture', () => {
    const interior = mainlineScenes['jijia-ancestral-interior']
    const incense = interior.objects.find((entity) => entity.id === 'jijia-incense-burner')
    const offeringTable = interior.objects.find((entity) => entity.id === 'jijia-offering-table-north')
    const office = mainlineScenes['zhongshuyuan-office']
    const desk = office.objects.find((entity) => entity.id === 'zhongshuyuan-office-desk')

    expect(incense && mainlineEntityUsesBreathing(interior, incense)).toBe(true)
    expect(offeringTable && mainlineEntityUsesBreathing(interior, offeringTable)).toBe(true)
    expect(desk && mainlineEntityUsesBreathing(office, desk)).toBe(true)
  })
})
