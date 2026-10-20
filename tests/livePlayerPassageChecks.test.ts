import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(new URL('../src/center/runtime/MainlineScenePage.tsx', import.meta.url), 'utf8')
const passageHookSource = readFileSync(new URL('../src/center/runtime/useAutomaticPassages.ts', import.meta.url), 'utf8')

function sourceBlock(start: string, end: string) {
  const startIndex = pageSource.indexOf(start)
  const endIndex = pageSource.indexOf(end, startIndex + start.length)
  expect(startIndex, `missing source marker: ${start}`).toBeGreaterThanOrEqual(0)
  expect(endIndex, `missing source marker: ${end}`).toBeGreaterThan(startIndex)
  return pageSource.slice(startIndex, endIndex)
}

describe('live passage safety wiring', () => {
  it('reads the latest navigation options ref and physical passage set on every predicate call', () => {
    expect(pageSource).toContain('const navigationOptionsRef = useRef(navigationOptions)')
    expect(pageSource).toContain('navigationOptionsRef.current = navigationOptions')
    expect(pageSource).toContain('...navigationOptionsRef.current')
    expect(pageSource).toContain('openPassageIds: getOpenPassageIds()')
  })

  it.each([
    ['door traversal', 'const continuePendingTraversal = useCallback', 'continuePendingTraversalRef.current = continuePendingTraversal'],
    ['generic player movement', 'const moveTo = useCallback', 'const leavePlayerSeat = useCallback'],
    ['seat and ordinary object interaction movement', 'const interact = useCallback', 'resumeInteractionRef.current = (entityId) => interact'],
    ['storefront interaction movement', 'const interactStorefront = useCallback', 'const interactNpc = useCallback'],
    ['player movement to an NPC', 'const interactNpc = useCallback', 'const chooseSceneEchoOption = useCallback'],
  ])('uses live door checks for %s', (_label, start, end) => {
    const block = sourceBlock(start, end)
    expect(block).toContain('canOccupy:')
    expect(block).toContain('canTraverse:')
    expect(block).toContain('getLiveNavigationOptions()')
    expect(block).not.toMatch(/canOccupy:[^\n]*\bnavigationOptions\)/)
    expect(block).not.toMatch(/canTraverse:[^\n]*\bnavigationOptions\)/)
  })

  it('leaves Lao Zhou simulation movement on its existing route options', () => {
    const npcMovement = sourceBlock(
      "const passageOptions = { ...navigationOptions, actorId: 'lao-zhou', actorFootprint: laoZhouFootprint, openPassageIds: getOpenPassageIds(), navigationRuntime }",
      'if (!started) laoZhouExitCrossingStartedRef.current = false',
    )
    expect(npcMovement).toContain('canOccupy: (point) => isWalkableMainlinePoint(point, scene, layout, passageOptions)')
    expect(npcMovement).toContain('canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, scene, layout, passageOptions)')
    expect(npcMovement).not.toContain('getLiveNavigationOptions()')
  })

  it('keeps a passage physically open for an active NPC crossing reservation', () => {
    expect(passageHookSource).toContain('if (!isOpen(passage.id) || hasActivePassage(passage.id) || isDoorwayBusy(passage)) return false')
    expect(passageHookSource).toContain("if (!inDoorway && !hasActivePassage(passage.id)) closeReadyPassage(passage)")
    expect(passageHookSource).toContain('const active = doorPassageActorIsActive(state, actorId)')
  })
})
