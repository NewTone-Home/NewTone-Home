import { describe, expect, it } from 'vitest'
import { frameShouldCollapse, completeFrameTransition, type SceneFrameRuntime, type SceneFrameTarget } from '../src/center/runtime/sceneFrameLifecycle'
const runtime: SceneFrameRuntime = { corner: 'top-left', phase: 'retracting', fullyCollapsed: false, preserveCornerOnResume: false, resumeCorner: null, transitionDirection: 'retracting', transitionStartedAt: 0, initialized: true, hovered: false, locked: false }
describe('frame completion notifications', () => {
  it('completes a policy-driven collapse without introducing another group dependency', () => {
    const target: SceneFrameTarget = { group: 'door:cafe', policy: 'passage', phase: 'open', gateTriggered: false, interactionBusy: false, interactionActive: false, retractRequested: false, suppressed: false }
    const current = { ...runtime }
    expect(frameShouldCollapse(target, current)).toBe(true)
    expect(completeFrameTransition(current, frameShouldCollapse(target, current), 1100, 1100, true)).toBe(true)
    expect(current.fullyCollapsed).toBe(true)
  })
})
