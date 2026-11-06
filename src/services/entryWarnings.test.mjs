import { describe, it, expect, vi } from 'vitest'
import { createEntryController } from './entryController.mjs'
import { currentEntryWarnings, entryWarningMessages } from './entryPresentation.mjs'
const warning = 'LAO_ZHOU_TRIGGER_UNKNOWN'
function fixture({ inspectionWarnings = [], committedWarnings = [] } = {}) {
  const committed = { status:'committed', ticket:{ opaque:true }, receipt:{}, snapshot:{ values:{} }, sessionHandle:{ check(){} }, warnings:committedWarnings }
  const service = { inspectSave:vi.fn(async()=>({status:'ready',classification:'generation-current',allowedActions:['continue','request-replace'],snapshotToken:'opaque',warnings:inspectionWarnings})), getRecoveryState:vi.fn(async()=>({status:'no-pending-operation'})), prepareEntry:vi.fn(async()=>({status:'prepared',ticket:committed.ticket})), commitEntry:vi.fn(async()=>committed), resolveOperation:vi.fn(async()=>committed) }
  return { service, controller:createEntryController(service) }
}
describe('entry warning evidence and visible copy', () => {
  it('shows prepare warnings when preparation has an uncertain outcome', async () => {
    const { controller, service }=fixture()
    await controller.start()
    service.prepareEntry.mockResolvedValueOnce({status:'outcome-uncertain',ticket:{opaque:true},warnings:[warning]})
    await controller.submit('continue')
    expect(controller.getState().phase).toBe('uncertain')
    expect(currentEntryWarnings(controller.getState())).toEqual([warning])
    expect(service.commitEntry).not.toHaveBeenCalled()
  })
  it('keeps warnings from a recovery ticket while its result remains unresolved', async () => {
    const { controller, service }=fixture()
    service.getRecoveryState.mockResolvedValueOnce({status:'operation-found',ticket:{opaque:true},warnings:[warning]})
    service.resolveOperation.mockResolvedValueOnce({status:'unresolved'})
    await controller.start()
    expect(controller.getState().phase).toBe('uncertain')
    expect(currentEntryWarnings(controller.getState())).toEqual([warning])
  })
  it('keeps inspect warnings visible without blocking continue', async () => {
    const { controller, service }=fixture({inspectionWarnings:[warning],committedWarnings:[warning]})
    await controller.start()
    expect(currentEntryWarnings(controller.getState())).toEqual([warning])
    await controller.submit('continue')
    expect(service.commitEntry).toHaveBeenCalledTimes(1)
    expect(currentEntryWarnings(controller.getState())).toEqual([warning])
    expect(controller.getState().phase).toBe('entering')
  })
  it('uses committed warnings on direct operation recovery without an inspection', async () => {
    const { controller, service }=fixture({committedWarnings:[warning]})
    service.getRecoveryState.mockResolvedValueOnce({status:'operation-found',ticket:{opaque:true}})
    await controller.start()
    expect(service.inspectSave).not.toHaveBeenCalled()
    expect(currentEntryWarnings(controller.getState())).toEqual([warning])
  })
  it('replaces old inspect warnings with new-game results instead of merging them', async () => {
    const { controller }=fixture({inspectionWarnings:[warning]})
    await controller.start();controller.requestReplace();await controller.submit('replace')
    expect(controller.getState().inspectionWarnings).toEqual([warning])
    expect(currentEntryWarnings(controller.getState())).toEqual([])
  })
  it('renders player-facing bilingual explanations and never exposes warning codes', () => {
    for(const language of ['zh','en']) {
      const messages=entryWarningMessages([warning],language)
      expect(messages).toHaveLength(1)
      expect(messages[0]).not.toContain(warning)
    }
    expect(entryWarningMessages(['UNRECOGNIZED_INTERNAL_CODE'],'en')).toEqual([])
  })
})
