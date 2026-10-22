import { mainlineWorldScale } from '../src/center/runtime/mainlineViewport'
import { currentCafeStart, currentCafeOptions } from './helpers/currentCafe'
import { describe, expect, it } from 'vitest'
import { defaultSceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineEntityTextFootprint, mainlineLabelFootprint } from '../src/center/runtime/sceneLayout'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { canActorReachPassageApproach, classifyMainlineWorldCommand, findMainlinePathToEntity, findMainlinePathToNpc, findMainlineRoomPassageSequence, mainlineInteractionTarget, mainlineNpcInteractionTarget, resolveMainlineEntityInteraction, resolveMainlineNpcInteraction, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'

describe('mainline visual footprint contract', () => {
  it('derives ordinary labels from the same font, orientation, line-height and scale used by the renderer', () => {
    const tree = mainlineScenes['jijia-ancestral-home'].objects.find((entity) => entity.id === 'jijia-old-tree')!
    expect(mainlineEntityTextFootprint(tree, tree.position, defaultSceneScreenMetrics)).toEqual(
      mainlineLabelFootprint(tree.label, tree.position, defaultSceneScreenMetrics, {
        visualScale: tree.visualScale,
        lineHeight: 1.2,
      }),
    )
  })

  it('keeps the approved object focus frames visual-only', () => {
    const tree = mainlineScenes['jijia-ancestral-home'].objects.find((entity) => entity.id === 'jijia-old-tree')!
    const interior = mainlineScenes['jijia-ancestral-interior']
    const burner = interior.objects.find((entity) => entity.id === 'jijia-incense-burner')!
    const plant = mainlineScenes['zhongshuyuan-office'].objects.find((entity) => entity.id === 'zhongshuyuan-office-plant')!

    expect([tree, burner, plant].every((entity) => entity.focusFrame === 'interactive')).toBe(true)
    expect(tree.visualBounds).toEqual({ x: tree.position.x - 4.5, y: tree.position.y - 4.5, width: 9, height: 9 })
    expect(burner.visualBounds).toEqual(burner.collision)
    expect(plant.visualBounds).toEqual({ x: plant.position.x - 1.7, y: plant.position.y - 2.15, width: 3.4, height: 4.3 })
    expect(plant.visualBounds).not.toEqual(plant.collision)
  })

  it('measures the actual 人 NPC label at the shared 16px world base rather than retaining the retired two-character footprint',()=>{
 const cafe=mainlineScenes['commercial-street'],npc=cafe.npcs.find(n=>n.id==='lao-zhou')!
 expect(npc.label).toBe('人')
 const footprint=mainlineLabelFootprint(npc.label,resolveMainlineNpcPosition(cafe,npc.id),currentCafeOptions.screenMetrics,{lineHeight:1})
 expect(footprint.width*19.2).toBeCloseTo(16,2);expect(footprint.height*10.8).toBeCloseTo(16,2)
})

  it('uses one selected contact for entity and NPC proximity as well as their route destination', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const from = cafe.initialPlayerPosition
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, from, {}, defaultSceneScreenMetrics)
    const options = { geometrySnapshot: snapshot, screenMetrics: defaultSceneScreenMetrics }
    const counter = resolveMainlineEntityInteraction(cafe, 'commercial-cafe-counter-8', from, {}, options)
    expect(mainlineInteractionTarget(cafe, 'commercial-cafe-counter-8', from, {}, undefined, options)).toEqual(counter.target)
    expect(findMainlinePathToEntity(cafe, 'commercial-cafe-counter-8', from, {}, options).target).toEqual(counter.target)

    const laoZhou = resolveMainlineNpcInteraction(cafe, 'lao-zhou', from, {}, options)
    expect(mainlineNpcInteractionTarget(cafe, 'lao-zhou', from, {}, undefined, options)).toEqual(laoZhou.target)
    expect(findMainlinePathToNpc(cafe, 'lao-zhou', from, {}, options).target).toEqual(laoZhou.target)
  })

  it('keeps all four Office corridor plant contacts reachable from the current lower-left office', () => {
    const office = mainlineScenes['zhongshuyuan-office']
    const from = office.initialPlayerPosition
    const snapshot = createMainlineSceneGeometrySnapshot(office, from, {}, defaultSceneScreenMetrics)
    const options = { geometrySnapshot: snapshot, screenMetrics: defaultSceneScreenMetrics }
    const corridorPlants = office.objects.filter((entity) => entity.id.startsWith('zhongshuyuan-office-port-plant-'))

    expect(corridorPlants).toHaveLength(4)
    corridorPlants.forEach((plant) => {
      const interaction = resolveMainlineEntityInteraction(office, plant.id, from, {}, options)
      const command = classifyMainlineWorldCommand(office, from, interaction.target, {}, options)

      expect(findMainlineRoomPassageSequence(office, from, plant.position, {}, options, true)?.passages[0]?.id).toBe('zhongshuyuan-office-south-door-1')
      expect(command.kind, plant.id).toBe('passage')
      if (command.kind !== 'passage') throw new Error(`${plant.id} must route through its legal Office passage`)
      expect(canActorReachPassageApproach(office, command.passage, from, {}, options)?.path).not.toBeNull()
      expect(command.kind === 'passage' ? command.requestedTarget : null, plant.id).toEqual(interaction.target)
    })
  })

  it('keeps all three visible Cafe counter runs as immutable world bodies and retains the public coffee-order contact',()=>{
 const cafe=mainlineScenes['commercial-street'],bodies=cafe.continuousStructures.filter(b=>b.id.startsWith('cafe-trial-counter-'))
 expect(bodies).toHaveLength(3)
 const viewports=[{width:390,height:844},{width:1280,height:800}]
 const snapshots=viewports.map(()=>createMainlineSceneGeometrySnapshot(cafe,currentCafeStart,{},currentCafeOptions.screenMetrics))
 for(const body of bodies){
  const cells=cafe.objects.filter(o=>o.interactionStructureId===body.id)
  expect(cells.length).toBeGreaterThan(1)
  for(const [index,snapshot] of snapshots.entries()){expect(snapshot.units.find(u=>u.id===body.id)).toMatchObject(body);for(const cell of cells)expect(snapshot.objects.get(cell.id)!.collision).toBeNull();const scale=mainlineWorldScale(viewports[index]);expect(body.width*19.2*scale).toBeCloseTo((Math.max(...cells.map(c=>c.position.x))-Math.min(...cells.map(c=>c.position.x))+16/19.2)*19.2*scale,2)}
 }
 const body=bodies.find(b=>b.id==='cafe-trial-counter-long-body')!,target=mainlineInteractionTarget(cafe,'commercial-cafe-counter',currentCafeStart,{},undefined,currentCafeOptions)
 expect(target.x).toBeGreaterThan(body.x+body.width)
 expect(findMainlinePathToEntity(cafe,'commercial-cafe-counter',currentCafeStart,{},currentCafeOptions).path).not.toBeNull()
})
})
