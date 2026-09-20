import { describe, expect, it } from 'vitest'
import { mainlineEntityUsesBreathing, sceneEchoFrameShouldRetract } from './MainlineSceneRenderer'
import { frameShouldCollapse, type SceneFrameRuntime, type SceneFrameTarget } from './sceneFrameLifecycle'
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

describe('scene echo frame retraction semantics', () => {
  it('retracts only temporary exploration source frames when an echo leaves', () => {
    expect(sceneEchoFrameShouldRetract('source', 'interactive', true, true)).toBe(false)
    expect(sceneEchoFrameShouldRetract('source', 'exploration', true, true)).toBe(true)
    expect(sceneEchoFrameShouldRetract('source', 'exploration', true, false)).toBe(false)
    expect(sceneEchoFrameShouldRetract('source', 'exploration', false, true)).toBe(false)
  })

  it('keeps the echo frame and explicit scene-exit retractions intact', () => {
    expect(sceneEchoFrameShouldRetract('echo', 'exploration', true)).toBe(true)

    const runtime: SceneFrameRuntime = {
      corner: 'top-left',
      phase: 'visible',
      fullyCollapsed: false,
      initialized: true,
      hovered: false,
      locked: false,
    }
    const sceneExitTarget: SceneFrameTarget = {
      group: 'door:example',
      policy: 'passage',
      phase: 'closed',
      gateTriggered: false,
      interactionBusy: false,
      interactionActive: false,
      retractRequested: true,
      suppressed: false,
    }

    expect(frameShouldCollapse(sceneExitTarget, runtime)).toBe(true)
  })
})
