import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const scene = mainlineScenes['commercial-street']
const cases = [
  { roomId: 'commercial-south-s5-interior', prefix: 'milk-tea-trial', facing: 'near' as const, rear: 'far' as const },
  { roomId: 'commercial-north-n1-interior', prefix: 'fruit-tea-trial', facing: 'far' as const, rear: 'near' as const },
] as const
const localY = (roomY: number, y: number) => (y - roomY) * 10.8

describe('takeaway counter and worktop 5/1/2 clearances', () => {
  it.each(cases)('$roomId keeps exact wall-grid clearances and the staff partition connected', ({ roomId, prefix, facing, rear }) => {
    const room = scene.rooms.find(candidate => candidate.id === roomId)!
    const depth = room.bounds.height * 10.8
    const frontWallInner = facing === 'near' ? 8 : depth - 8
    const rearWallInner = rear === 'near' ? 8 : depth - 8
    const counter = scene.continuousStructures.find(body => body.id === `${prefix}-front-return-body`)!
    const partition = scene.continuousStructures.find(body => body.id === `${prefix}-long-counter-body`)!
    const worktop = scene.continuousStructures.find(body => body.id === `${prefix}-worktop-body`)!
    const counterNear = localY(room.bounds.y, counter.y)
    const counterFar = counterNear + counter.height * 10.8
    const worktopStart = localY(room.bounds.y, worktop.y)
    const worktopEnd = worktopStart + worktop.height * 10.8
    const counterStreetEdge = facing === 'near' ? counterNear : counterFar
    const counterStaffEdge = facing === 'near' ? counterFar : counterNear
    const worktopFrontEdge = facing === 'near' ? worktopStart : worktopEnd
    const worktopRearEdge = rear === 'near' ? worktopStart : worktopEnd

    expect(Math.abs(frontWallInner - counterStreetEdge), 'five wall-grid cells from the inside edge of the front wall').toBeCloseTo(140, 8)
    expect(Math.abs(counterStaffEdge - worktopFrontEdge), 'one wall-grid cell between counter and worktop').toBeCloseTo(28, 8)
    expect(Math.abs(worktopRearEdge - rearWallInner), 'two wall-grid cells between worktop and rear wall').toBeCloseTo(56, 8)

    // The return and long run touch at their authored corner; neither collision body is an air-wall substitute.
    expect(counter.counterSurface?.roomId).toBe(roomId)
    expect(partition.counterSurface?.roomId).toBe(roomId)
    expect(worktop.counterSurface?.roomId).toBe(roomId)
    const localBox = (body: typeof counter) => ({
      x: (body.x - room.bounds.x) * 19.2,
      y: localY(room.bounds.y, body.y),
      width: body.width * 19.2,
      height: body.height * 10.8,
    })
    const partitionBox = localBox(partition), counterBox = localBox(counter)
    const sideTouch = Math.abs(partitionBox.x + partitionBox.width - counterBox.x) < 1e-6
      || Math.abs(counterBox.x + counterBox.width - partitionBox.x) < 1e-6
    const verticalOverlap = Math.min(partitionBox.y + partitionBox.height, counterBox.y + counterBox.height) - Math.max(partitionBox.y, counterBox.y)
    expect(sideTouch && verticalOverlap > 0, 'the two counter runs meet at one real corner').toBe(true)
    expect(scene.passages.find(passage => passage.id === `${roomId}-rear-door`)?.access).toBe('locked')
  })
})
