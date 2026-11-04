import { describe, it, expect, vi } from 'vitest'
import { createEntryController } from './entryController.mjs'
const inspection = (classification = 'historical-supported') => ({ status: 'ready', classification, snapshotToken: 'opaque', allowedActions: classification === 'empty' ? ['create'] : ['continue', 'request-replace'] })
function fixture(result = inspection()) {
  const handle = { check: vi.fn() }
  const committed = { status: 'committed', ticket: { opaque: true }, snapshot: { values: {} }, receipt: {}, sessionHandle: handle }
  const service = { acknowledgeEntry: vi.fn(async () => ({ status: 'acknowledged' })), inspectSave: vi.fn(async () => result), getRecoveryState: vi.fn(async () => ({ status: 'no-pending-operation' })), prepareEntry: vi.fn(async () => ({ status: 'prepared', ticket: { opaque: true } })), commitEntry: vi.fn(async () => committed), resolveOperation: vi.fn(async () => committed) }
  return { service, controller: createEntryController(service) }
}
describe('entry UI transaction boundary', () => {
  it('recheck resumes a render-failed committed ticket without another prepare or commit', async () => {
    const { controller, service } = fixture(inspection('empty'))
    await controller.start(); await controller.submit('create')
    const original = controller.getState().committed
    const error = { message: 'BOUNDARY_RENDER_SENTINEL' }
    controller.runtimeFailed({ first: error, events: [error] })
    const newHandle = { check: vi.fn() }
    service.getRecoveryState.mockResolvedValueOnce({ status: 'operation-found', ticket: original.ticket, phase: 'committed' })
    service.resolveOperation.mockResolvedValueOnce({ ...original, sessionHandle: newHandle })
    await controller.recheck()
    expect(service.resolveOperation).toHaveBeenCalledWith({ ticket: original.ticket })
    expect(service.prepareEntry).toHaveBeenCalledTimes(1)
    expect(service.commitEntry).toHaveBeenCalledTimes(1)
    expect(controller.getState().phase).toBe('entering')
    expect(controller.getState().committed.sessionHandle).toBe(newHandle)
    expect(controller.getState().committed.ticket).toBe(original.ticket)
    expect(controller.getState().committed.snapshot).toBe(original.snapshot)
    expect(controller.getState().runtimeEvidence).toBeNull()
  })

  it('retains the exact read-only preview without preparing an operation', async () => {
    const preview = { preferences: { themePosition: 1, motionMode: 'reduced' }, landingIntro: { status: 'learned', learned: true } }
    const { controller, service } = fixture({ ...inspection(), preview })
    await controller.start()
    expect(controller.getState().inspection.preview).toBe(preview)
    expect(service.prepareEntry).not.toHaveBeenCalled()
  })
  it('acknowledges only after the UI reports the first scene is ready under its cover, once', async () => {
    const { controller, service } = fixture()
    await controller.start(); await controller.submit('continue')
    expect(service.acknowledgeEntry).not.toHaveBeenCalled()
    await Promise.all([controller.acknowledgeEntered(), controller.acknowledgeEntered()])
    expect(service.acknowledgeEntry).toHaveBeenCalledTimes(1)
  })
  it('pauses the runtime if receipt acknowledgement is uncertain', async () => {
    const { controller, service } = fixture()
    await controller.start(); await controller.submit('continue')
    service.acknowledgeEntry.mockResolvedValueOnce({ status: 'outcome-uncertain' })
    await controller.acknowledgeEntered()
    expect(controller.getState().phase).toBe('uncertain')
    expect(controller.getState().committed).toBeNull()
  })
  it('inspection and cancel never prepare, commit or initialize a game', async () => {
    const { service, controller } = fixture()
    await controller.start(); controller.requestReplace(); controller.cancelReplace()
    expect(controller.getState().phase).toBe('choice-ready')
    expect(controller.getState().focusTarget).toBe('request-replace')
    expect(service.prepareEntry).not.toHaveBeenCalled(); expect(service.commitEntry).not.toHaveBeenCalled()
  })
  it('create and replace are distinct and replace requires confirmation', async () => {
    const { service, controller } = fixture(inspection('empty'))
    await controller.start(); await controller.submit('replace')
    expect(service.prepareEntry).not.toHaveBeenCalled()
    await controller.submit('create')
    expect(service.prepareEntry).toHaveBeenCalledWith({ intent: 'create', snapshotToken: 'opaque', overwriteConfirmed: false })
  })
  it('confirmed replacement passes the service-issued ticket unchanged', async () => {
    const { service, controller } = fixture()
    await controller.start(); controller.requestReplace(); await controller.submit('replace')
    expect(service.prepareEntry.mock.calls[0][0].overwriteConfirmed).toBe(true)
    expect(service.commitEntry).toHaveBeenCalledWith({ ticket: { opaque: true } })
  })
  it('overlapping click and keyboard submissions are accepted only once', async () => {
    const { service, controller } = fixture()
    await controller.start()
    await Promise.all([controller.submit('continue'), controller.submit('continue')])
    expect(service.prepareEntry).toHaveBeenCalledTimes(1); expect(service.commitEntry).toHaveBeenCalledTimes(1)
  })
  it.each(['unknown', 'corrupt', 'conflict'])('never submits %s data', async classification => {
    const { controller, service } = fixture({ status: 'ready', classification, allowedActions: ['back', 'reinspect'] })
    await controller.start(); controller.requestReplace(); await controller.submit('create'); await controller.submit('continue')
    expect(controller.getState().phase).toBe('unknown'); expect(service.prepareEntry).not.toHaveBeenCalled()
  })
  it('recovers response loss using the durable ticket, without another preparation', async () => {
    const { controller, service } = fixture()
    await controller.start()
    service.commitEntry.mockRejectedValueOnce(Error('response lost'))
    service.getRecoveryState.mockResolvedValueOnce({ status: 'operation-found', ticket: { recovered: true } })
    await controller.submit('continue')
    expect(service.resolveOperation).toHaveBeenCalledWith({ ticket: { recovered: true } })
    expect(service.prepareEntry).toHaveBeenCalledTimes(1)
    expect(controller.getState().phase).toBe('entering')
  })
  it('uncertain result blocks further submissions until recovery', async () => {
    const { controller, service } = fixture()
    await controller.start(); service.commitEntry.mockResolvedValueOnce({ status: 'outcome-uncertain', ticket: {} })
    await controller.submit('continue'); await controller.submit('continue')
    expect(controller.getState().phase).toBe('uncertain'); expect(service.prepareEntry).toHaveBeenCalledTimes(1)
  })
  it('StrictMode-style duplicate start performs one recovery inspection', async () => {
    const { controller, service } = fixture()
    await Promise.all([controller.start(), controller.start()])
    expect(service.getRecoveryState).toHaveBeenCalledTimes(1)
  })
  it('resumes only a service-verified prepared request using the same ticket', async () => {
    const { controller, service } = fixture()
    const ticket = { existing: true }
    service.getRecoveryState.mockResolvedValueOnce({ status: 'operation-found', ticket })
    service.resolveOperation.mockResolvedValueOnce({ status: 'not-committed', resumeAllowed: true, ticket })
    await controller.start()
    expect(service.commitEntry).toHaveBeenCalledWith({ ticket })
    expect(service.prepareEntry).not.toHaveBeenCalled()
    expect(controller.getState().phase).toBe('entering')
  })
  it('refresh does not resume without explicit service permission', async () => {
    const { controller, service } = fixture()
    service.getRecoveryState.mockResolvedValueOnce({ status: 'operation-found', ticket: { prepared: true } })
    service.resolveOperation.mockResolvedValueOnce({ status: 'not-committed' })
    await controller.start()
    expect(service.resolveOperation).toHaveBeenCalled(); expect(service.commitEntry).not.toHaveBeenCalled()
    expect(service.prepareEntry).not.toHaveBeenCalled()
  })
  it('storage unavailable is a failure, not a new-game path', async () => {
    const { controller, service } = fixture({ status: 'unavailable', classification: null, allowedActions: ['back', 'reinspect'] })
    await controller.start(); await controller.submit('create')
    expect(controller.getState().phase).toBe('failed'); expect(service.prepareEntry).not.toHaveBeenCalled()
  })
})
