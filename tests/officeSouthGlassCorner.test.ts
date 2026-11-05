import { describe, expect, it } from 'vitest'
import { defaultSceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { canActorReachPassageApproach, canTravelAlongMainlineSegment, findMainlinePath, findMainlineRoomPassageSequence } from '../src/center/runtime/mainlineNavigation'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { mainlineWallThickness } from '../src/center/runtime/sceneGeometry'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { officeGrid } from '../src/center/runtime/officeGrid'

const office = mainlineScenes['zhongshuyuan-office']
// QA recorded this actor center in the 1920x1080 authored scene coordinate system.
const qaCrossingPoint = { x: 137.32 / 1920 * 100, y: 684.31 / 1080 * 100 }

function overlaps(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

describe('Zhongshuyuan office south glass corner collision', () => {
  it('blocks the QA-proven 28px corner crossing with the production actor footprint without painting a glyph', () => {
    const snapshot = createMainlineSceneGeometrySnapshot(office, qaCrossingPoint, {}, defaultSceneScreenMetrics)
    const blocker = office.blockers.find(candidate => candidate.id === 'zhongshuyuan-office-south-glass-corner-link')
    const unit = snapshot.units.find(candidate => candidate.id === 'zhongshuyuan-office-south-glass-corner-link')

    expect(blocker).toBeDefined()
    expect(blocker!.x).toBeCloseTo(officeGrid.point(0, 0).x, 8)
    expect(blocker!.x + blocker!.width).toBeCloseTo(officeGrid.point(1, 0).x, 8)
    expect(blocker!.y + blocker!.height).toBeCloseTo(officeGrid.point(0, 21).y + mainlineWallThickness / 2, 8)
    expect(blocker!.width * 1920 / 100).toBeCloseTo(28, 6)
    expect(unit).toMatchObject({ geometryKind: 'blocker', navigation: { blocked: true }, visual: { kind: 'none', cells: [] } })

    const actor = mainlineProtagonistDotFootprint(qaCrossingPoint, defaultSceneScreenMetrics, office.id)
    expect(actor.width * defaultSceneScreenMetrics.width / 100).toBeCloseTo(11, 2)
    expect(actor.height * defaultSceneScreenMetrics.height / 100).toBeCloseTo(11, 2)
    expect(overlaps(actor, blocker!)).toBe(true)
    const outsideFrame = { ...qaCrossingPoint, x: officeGrid.point(-1, 21).x }
    expect(canTravelAlongMainlineSegment(qaCrossingPoint, outsideFrame, office, {}, { screenMetrics: defaultSceneScreenMetrics })).toBe(false)
  })

  it('keeps the legal office door route to the plant and corridor exit reachable', () => {
    const start = office.initialPlayerPosition
    const snapshot = createMainlineSceneGeometrySnapshot(office, start, {}, defaultSceneScreenMetrics)
    const options = { geometrySnapshot: snapshot, screenMetrics: defaultSceneScreenMetrics, openPassageIds: new Set(['zhongshuyuan-office-south-door-1']) }
    const plant = office.objects.find(entity => entity.id === 'zhongshuyuan-office-port-plant-left-bottom')!
    const route = findMainlineRoomPassageSequence(office, start, plant.position, {}, options, true)

    expect(route?.passages[0]?.id).toBe('zhongshuyuan-office-south-door-1')
    expect(canActorReachPassageApproach(office, route!.passages[0]!, start, {}, options)?.path).not.toBeNull()
    expect(findMainlinePath(start, plant.position, office, {}, options)).not.toBeNull()

    const exit = office.externalExits.find(candidate => candidate.id === 'zhongshuyuan-office-left-endpoint')!
    const exitTarget = { x: exit.threshold, y: (exit.triggerSpan.start + exit.triggerSpan.end) / 2 }
    const openedDoorOptions = { screenMetrics: defaultSceneScreenMetrics, openPassageIds: new Set(['zhongshuyuan-office-south-door-1']) }
    expect(findMainlinePath(start, exitTarget, office, {}, openedDoorOptions)).not.toBeNull()
  })
})
