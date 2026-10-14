import { describe, expect, it } from 'vitest'
import { mainlineEntityUsesBreathing, mainlineEntityUsesContinuousWindBreathing, mainlineObjectClassName } from './MainlineSceneRenderer'
import { mainlineScenes } from './mainlineScenes'

describe('mainline renderer breathing semantics', () => {
  it('keeps the old tree breath but leaves its tree-ring stones static', () => {
    const yard = mainlineScenes['jijia-ancestral-home']
    const tree = yard.objects.find((entity) => entity.id === 'jijia-old-tree')
    const stone = yard.objects.find((entity) => entity.id === 'jijia-old-tree-stone-n')

    expect(tree?.visualProfile).toBe('tree-ring')
    expect(tree && mainlineEntityUsesBreathing(yard, tree)).toBe(true)
    expect(tree && mainlineEntityUsesContinuousWindBreathing(yard, tree)).toBe(true)
    const completedTreeClass = mainlineObjectClassName(yard, tree!, 'is-near', false, true, true, false, false, false, false)
    expect(completedTreeClass).toContain('scene-mainline-yard-tree-ring--wind')
    expect(completedTreeClass).not.toContain('scene-mainline-exploration--breathing')
    expect(stone).toMatchObject({ visualProfile: 'tree-ring', interactive: false })
    expect(stone && mainlineEntityUsesBreathing(yard, stone)).toBe(false)
    expect(stone && mainlineEntityUsesContinuousWindBreathing(yard, stone)).toBe(false)
  })

  it('keeps breathing on the incense burner only, not altar tables, office furniture, or cafe objects', () => {
    const interior = mainlineScenes['jijia-ancestral-interior']
    const incense = interior.objects.find((entity) => entity.id === 'jijia-incense-burner')
    const offeringTable = interior.objects.find((entity) => entity.id === 'jijia-offering-table-north')
    const office = mainlineScenes['zhongshuyuan-office']
    const desk = office.objects.find((entity) => entity.id === 'zhongshuyuan-office-desk')
    const cafe = mainlineScenes['commercial-cafe']

    expect(incense && mainlineEntityUsesBreathing(interior, incense)).toBe(true)
    const unlitIncenseClass = mainlineObjectClassName(interior, incense!, 'is-near', false, false, false, false, false, false, false)
    expect(unlitIncenseClass).toContain('scene-mainline-incense--unlit')
    expect(unlitIncenseClass).not.toContain('scene-mainline-exploration--breathing')
    const burningIncenseClass = mainlineObjectClassName(interior, incense!, 'is-near', false, false, false, false, false, false, true)
    expect(burningIncenseClass).toContain('scene-mainline-incense--burning')
    expect(offeringTable && mainlineEntityUsesBreathing(interior, offeringTable)).toBe(false)
    expect(desk && mainlineEntityUsesBreathing(office, desk)).toBe(false)
    expect(office.objects.filter((entity) => mainlineEntityUsesBreathing(office, entity))).toEqual([])
    expect(cafe.objects.filter((entity) => mainlineEntityUsesBreathing(cafe, entity))).toEqual([])
  })
})
