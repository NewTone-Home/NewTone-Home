import { describe, expect, it } from 'vitest'
import { createDoorPassageRuntime, doorPassageActorIsActive, reduceDoorPassageRuntime } from '../src/center/runtime/doorPassageModel'
import type { Point } from '../src/center/runtime/sceneGeometry'

// The reducer does not inspect crossing coordinates; geometry is owned by the
// passage runtime that issues the reservation.
const reducerOnlyTarget = {} as Point

function request(state: ReturnType<typeof createDoorPassageRuntime>, actorId: string) {
  return reduceDoorPassageRuntime(state, {
    type: 'request',
    allowed: true,
    reservation: {
      actorId,
      fromSide: 0,
      targetSide: 1,
      target: reducerOnlyTarget,
      crossed: false,
    },
  })
}

describe('door passage FIFO reservations', () => {
  it('allows only the first reservation to cross and promotes the next actor on release', () => {
    let state = request(createDoorPassageRuntime(), 'protagonist')
    state = request(state, 'ambient-1')

    expect(state.queue).toEqual(['protagonist', 'ambient-1'])
    expect(doorPassageActorIsActive(state, 'protagonist')).toBe(true)
    expect(doorPassageActorIsActive(state, 'ambient-1')).toBe(false)

    expect(reduceDoorPassageRuntime(state, { type: 'crossed', actorId: 'ambient-1' })).toBe(state)
    state = reduceDoorPassageRuntime(state, { type: 'crossed', actorId: 'protagonist' })
    expect(state.reservations.protagonist?.crossed).toBe(true)

    state = reduceDoorPassageRuntime(state, { type: 'release', actorId: 'protagonist' })
    expect(state.queue).toEqual(['ambient-1'])
    expect(doorPassageActorIsActive(state, 'ambient-1')).toBe(true)
  })

  it('does not let an old FIFO owner survive after the last release', () => {
    let state = request(createDoorPassageRuntime(), 'protagonist')
    state = reduceDoorPassageRuntime(state, { type: 'release', actorId: 'protagonist' })

    expect(state.queue).toEqual([])
    expect(state.activeActorId).toBeUndefined()
    expect(doorPassageActorIsActive(state, 'protagonist')).toBe(false)
  })
})
