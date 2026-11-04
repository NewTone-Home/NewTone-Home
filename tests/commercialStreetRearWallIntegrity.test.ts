import { describe, expect, it } from 'vitest'
import { mainlineScenes, mainlineCanonicalSceneGeometryUnits } from '../src/center/runtime/mainlineScenes'
import { classifyMainlineWorldCommand, isWalkableMainlinePoint, mainlinePassageDoorwayForNavigation } from '../src/center/runtime/mainlineNavigation'
import { boundaryGridStepsFromReferenceSpacing, sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import {sceneGridTransform} from '../src/center/runtime/sceneGridRollout'

const scene = mainlineScenes['commercial-street']
const options = { screenMetrics: sceneDesignReferenceMetrics }
const units = mainlineCanonicalSceneGeometryUnits(scene, sceneDesignReferenceMetrics)
const pitch = boundaryGridStepsFromReferenceSpacing().horizontal
// Actual extra door positions captured on cea7f14. These must become walls,
// with no invisible door volume, opening, passage identity or focus target.
const formerExtraDoors: Record<string, number> = {
  'commercial-north-slot-1': 17.834, 'commercial-north-slot-4': 70.333,
  'commercial-north-slot-5': 96.582, 'commercial-north-slot-6': 105.332,
  'commercial-cafe-slot': 140.331, 'commercial-south-slot-1': 17.834,
  'commercial-south-slot-4': 70.333, 'commercial-south-slot-5': 96.582,
  'commercial-south-slot-6': 105.332, 'commercial-south-slot-7': 122.832,
  'commercial-south-slot-8': 149.081,
}

describe('commercial rear walls have one real door and no former extra door', () => {
  const shops = scene.storefronts.filter(slot => /-slot(?:-\d+)?$/.test(slot.id))
  const enterableShopIds = new Set(['commercial-north-slot-1', 'commercial-south-slot-5', 'commercial-cafe-slot'])

  it.each(shops)('$id retains only its legal rear doorway and current front access state', slot => {
    const front = scene.passages.find(p => p.portalId === slot.portalId)!
    const room = scene.rooms.find(r => r.id === front.toRoomId)!
    const rear = scene.passages.find(p => p.id === `${room.id}-rear-door`)!
    const doorway = mainlinePassageDoorwayForNavigation(scene, rear, options)
    const doorCells = units.flatMap(u => u.visual.cells).filter(c => c.kind === 'door' && c.entityId === rear.entityId)
    expect(doorCells).toHaveLength(1)
    expect(rear.access).toBe('locked')
    expect(rear.targetSceneId).toBeUndefined()
    expect(doorway.width).toBeCloseTo(pitch, 2)
    const door = doorCells[0]!, inward = slot.edge === 'bottom' ? 1 : -1
    const actorId=scene.npcs.find(n=>n.roomId===room.id&&scene.actorAccess[n.id]?.includes('staff'))?.id??'protagonist'
    const size=actorId==='protagonist'?11:16
    const rearOptions={...options,actorId,actorFootprint:{width:size/19.2,height:size/10.8}}
    const command = (x: number) => classifyMainlineWorldCommand(scene, { x, y: door.y + inward * 5 }, { x, y: door.y - inward * .9 }, {}, rearOptions)
    expect(command(door.x)).toMatchObject({ kind: 'passage', passage: { id: rear.id, access: 'locked' } })
    // Even the adjacent wall owned by the old door unit is now just a wall.
    expect(command(door.x + pitch).kind).toBe('ordinary')
    expect(command(door.x - pitch).kind).toBe('ordinary')
    expect(isWalkableMainlinePoint({ x: door.x + pitch, y: door.y }, scene, {}, options)).toBe(false)
    const oldFormer = formerExtraDoors[slot.id]
    const former = oldFormer===undefined?undefined:sceneGridTransform('commercial-street')!.snap({x:oldFormer,y:0}).x
    if (former !== undefined) {
      const cellsHere = units.flatMap(u => u.visual.cells.map(cell => ({ unit: u, cell })))
        .filter(({ cell }) => Math.abs(cell.x - former) < .002 && Math.abs(cell.y - door.y) < .002 && cell.glyph)
      expect(cellsHere.length).toBeGreaterThan(0)
      expect(cellsHere.every(({ unit, cell }) => cell.kind === 'wall' && !cell.entityId && !unit.navigation.passageId)).toBe(true)
      expect(isWalkableMainlinePoint({ x: former, y: door.y }, scene, {}, options)).toBe(false)
      expect(command(former).kind).toBe('ordinary')
    }
    expect(front).toMatchObject({ access: enterableShopIds.has(slot.id) ? 'open' : 'locked', routeThrough: true })
  })
  it('keeps all fourteen shop shells, the three approved open fronts, the separate open restroom, and eleven former gaps as walls', () => {
    expect(Object.keys(formerExtraDoors)).toHaveLength(11)
    expect(shops).toHaveLength(14)
    expect(shops.filter(s => enterableShopIds.has(s.id)).map(s => s.id).sort())
      .toEqual([...enterableShopIds].sort())
    const restroom = scene.storefronts.find(s => s.id === 'cafe-restroom-sign')!
    expect(scene.passages.find(p => p.portalId === restroom.portalId)?.access).toBe('open')
    expect(scene.passages.filter(p => p.id.endsWith('-rear-door'))).toHaveLength(14)
  })
})
