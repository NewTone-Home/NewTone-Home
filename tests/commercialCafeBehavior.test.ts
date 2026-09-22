import { describe, expect, it } from 'vitest'
import { createCommercialCafeServerBehaviorCoordinator } from '../src/center/runtime/commercialCafeBehavior'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineNpcStagedPoint } from '../src/center/runtime/mainlineNpcStaging'
import { npcRoles } from '../src/center/runtime/npcRoles'

const cafe = mainlineScenes['commercial-cafe']
const serverStart = mainlineNpcStagedPoint(cafe, 'server')!

describe('commercial cafe server behavior coordinator', () => {
  it('starts one semantic ambient duty instead of assigning server identity a permanent home', () => {
    const coordinator = createCommercialCafeServerBehaviorCoordinator()
    expect(coordinator.requestForStage({ scene: cafe, stage: 'entered', from: serverStart, snapshot: { npcId: 'server', phase: 'idle', retryCount: 0 } })).toMatchObject({
      dutyId: npcRoles.server.duties.prepare.id,
      targetId: 'commercial-cafe-prep-station',
    })
    expect(coordinator.requestForStage({ scene: cafe, stage: 'entered', from: serverStart, snapshot: { npcId: 'server', phase: 'moving', retryCount: 0 } })).toBeNull()
    expect(coordinator.requestForStage({ scene: cafe, stage: 'entered', from: serverStart, snapshot: { npcId: 'server', phase: 'idle', retryCount: 0 } })).toMatchObject({
      dutyId: npcRoles.server.duties.prepare.id,
      targetId: 'commercial-cafe-prep-station',
    })
  })

  it('uses one delivery intent while the server is moving, but recovers the same semantic duty after a cancelled runtime', () => {
    const coordinator = createCommercialCafeServerBehaviorCoordinator()
    const first = coordinator.requestForStage({ scene: cafe, stage: 'met-lao-zhou', from: serverStart, snapshot: { npcId: 'server', phase: 'idle', retryCount: 0 } })
    expect(first).toMatchObject({ dutyId: npcRoles.server.duties.deliverCoffee.id })
    expect(coordinator.requestForStage({ scene: cafe, stage: 'met-lao-zhou', from: serverStart, snapshot: { npcId: 'server', phase: 'moving', retryCount: 0 } })).toBeNull()
    expect(coordinator.requestForStage({ scene: cafe, stage: 'met-lao-zhou', from: serverStart, snapshot: { npcId: 'server', phase: 'idle', retryCount: 0 } })).toEqual(first)
  })

  it('waits for actual delivery arrival before requesting return, then resumes the semantic ambient loop', () => {
    const coordinator = createCommercialCafeServerBehaviorCoordinator()
    coordinator.requestForStage({ scene: cafe, stage: 'met-lao-zhou', from: serverStart, snapshot: { npcId: 'server', phase: 'idle', retryCount: 0 } })
    coordinator.arrived()
    expect(coordinator.getPhase()).toBe('delivery-arrived')
    expect(coordinator.requestForStage({ scene: cafe, stage: 'met-lao-zhou', from: serverStart, snapshot: { npcId: 'server', phase: 'idle', retryCount: 0 } })).toBeNull()
    expect(coordinator.requestForStage({ scene: cafe, stage: 'coffee-delivered', from: serverStart, snapshot: { npcId: 'server', phase: 'idle', retryCount: 0 } })).toMatchObject({
      dutyId: npcRoles.server.duties.returnToCounter.id,
      targetId: 'commercial-cafe-counter-service',
    })
    coordinator.arrived()
    expect(coordinator.getPhase()).toBe('ambient-waiting')
    expect(coordinator.requestForStage({ scene: cafe, stage: 'coffee-delivered', from: serverStart, snapshot: { npcId: 'server', phase: 'idle', retryCount: 0 } })).toMatchObject({
      dutyId: npcRoles.server.duties.prepare.id,
      targetId: 'commercial-cafe-prep-station',
    })
  })

  it('lets a story delivery interrupt an ambient move without retaining the ambient target as identity state', () => {
    const coordinator = createCommercialCafeServerBehaviorCoordinator()
    expect(coordinator.requestForStage({ scene: cafe, stage: 'entered', from: serverStart, snapshot: { npcId: 'server', phase: 'idle', retryCount: 0 } })).toMatchObject({
      dutyId: npcRoles.server.duties.prepare.id,
    })
    expect(coordinator.requestForStage({ scene: cafe, stage: 'met-lao-zhou', from: serverStart, snapshot: { npcId: 'server', phase: 'moving', retryCount: 0 } })).toMatchObject({
      dutyId: npcRoles.server.duties.deliverCoffee.id,
    })
  })
})
