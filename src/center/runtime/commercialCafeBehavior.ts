import type { NpcIntent, NpcRuntimeSnapshot } from './npcCore'
import { npcRoles } from './npcRoles'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { Point } from './sceneGeometry'
import type { SceneLayout } from './sceneLayout'
import type { MainlineNavigationOptions } from './mainlineNavigation'
import { resolveCommercialCafeCoffeeDeliveryIntent, resolveCommercialCafeReturnToCounterIntent, type CommercialCafeStoryStage } from './commercialCafeStory'

export type CommercialCafeServerBehaviorPhase = 'boot' | 'ambient-moving' | 'ambient-waiting' | 'delivering' | 'delivery-arrived' | 'returning' | 'blocked' | 'complete'

/**
 * Small event-driven coordinator.  It selects duties; movement and routing
 * remain in the existing NPC adapter.  No timer, polling or route data lives
 * here.
 */
export function createCommercialCafeServerBehaviorCoordinator() {
  let phase: CommercialCafeServerBehaviorPhase = 'boot'
  const getPhase = () => phase
  const block = () => { phase = 'blocked' }
  const reset = () => { phase = 'boot' }

  const ambientIntent = (scene: MainlineSceneDefinition): NpcIntent | null => {
    const prep = scene.npcBehaviorTargets?.find((target) => target.id === 'commercial-cafe-prep-station')
    if (!prep) return null
    return { dutyId: npcRoles.server.duties.prepare.id, targetId: prep.id, target: { ...prep.position } }
  }

  const requestForStage = ({
    scene, stage, from, snapshot, layout = {}, navigationOptions = {},
  }: {
    scene: MainlineSceneDefinition
    stage: CommercialCafeStoryStage
    from: Point
    snapshot: NpcRuntimeSnapshot
    layout?: SceneLayout
    navigationOptions?: MainlineNavigationOptions
  }): NpcIntent | null => {
    if (scene.id !== 'commercial-cafe') return null
    // Effects may be replayed during development after the movement hook has
    // been cleaned up. A recorded `delivering` phase is only live while the
    // NPC runtime is actually moving; otherwise request the same semantic
    // intent again through the shared adapter.
    if (stage === 'met-lao-zhou' && phase !== 'delivery-arrived' && (phase !== 'delivering' || snapshot.phase !== 'moving')) {
      const intent = resolveCommercialCafeCoffeeDeliveryIntent({ scene, stage, from, layout, navigationOptions })
      if (intent) phase = 'delivering'
      return intent
    }
    if (snapshot.phase === 'moving') return null
    if (stage === 'coffee-delivered' && (phase === 'delivering' || phase === 'delivery-arrived')) {
      const intent = resolveCommercialCafeReturnToCounterIntent(scene)
      if (intent) phase = 'returning'
      return intent
    }
    if (stage === 'entered' || stage === 'coffee-ordered') {
      // Keep ambient behavior event-driven too: a development effect replay
      // may cancel the movement controller after this coordinator chose a
      // duty. Reissue the same duty only when the runtime is no longer moving.
      if (phase === 'boot' || phase === 'ambient-moving') {
        const intent = ambientIntent(scene)
        if (intent) phase = 'ambient-moving'
        return intent
      }
    }
    return null
  }

  const arrived = () => {
    if (phase === 'ambient-moving') phase = 'ambient-waiting'
    else if (phase === 'delivering') phase = 'delivery-arrived'
    else if (phase === 'returning') phase = 'complete'
  }

  return { getPhase, requestForStage, arrived, block, reset }
}
