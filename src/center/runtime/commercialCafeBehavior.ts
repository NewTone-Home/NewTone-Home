import type { NpcIntent, NpcRuntimeSnapshot } from './npcCore'
import { npcRoles } from './npcRoles'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { Point } from './sceneGeometry'
import type { SceneLayout } from './sceneLayout'
import type { MainlineNavigationOptions } from './mainlineNavigation'
import { resolveCommercialCafeCoffeeDeliveryIntent, resolveCommercialCafeReturnToCounterIntent, type CommercialCafeStoryStage } from './commercialCafeStory'

export type CommercialCafeServerBehaviorPhase = 'boot' | 'ambient-moving' | 'ambient-waiting' | 'delivering' | 'delivery-arrived' | 'returning' | 'blocked'

/**
 * Small event-driven coordinator.  It selects duties; movement and routing
 * remain in the existing NPC adapter.  No timer, polling or route data lives
 * here.
 */
export function createCommercialCafeServerBehaviorCoordinator() {
  let phase: CommercialCafeServerBehaviorPhase = 'boot'
  let ambientTargetIndex = 0
  let pendingAmbientIntent: NpcIntent | null = null
  const getPhase = () => phase
  const block = () => { phase = 'blocked' }
  const reset = () => {
    phase = 'boot'
    ambientTargetIndex = 0
    pendingAmbientIntent = null
  }

  const ambientIntent = (scene: MainlineSceneDefinition): NpcIntent | null => {
    if (pendingAmbientIntent) return pendingAmbientIntent
    // A service loop is built from existing scene semantics, not patrol
    // waypoints and not a table owned by the server identity. Each selected
    // table is a one-time duty target; the next selection is coordinator state.
    const pointTargets = ['commercial-cafe-prep-station', 'commercial-cafe-counter-service']
      .map((targetId) => scene.npcBehaviorTargets?.find((target) => target.id === targetId))
      .filter((target): target is NonNullable<typeof target> => Boolean(target))
      .map((target) => ({
        dutyId: target.id === 'commercial-cafe-counter-service'
          ? npcRoles.server.duties.counterService.id
          : npcRoles.server.duties.prepare.id,
        targetId: target.id,
        target: { ...target.position },
      } satisfies NpcIntent))
    const publicTables = scene.objects
      .filter((entity) => entity.kind === 'table' && entity.id !== 'commercial-cafe-right-window-upper-group-table')
      .map((entity) => ({
        dutyId: npcRoles.server.duties.tableService.id,
        targetId: entity.id,
        targetEntityId: entity.id,
      } satisfies NpcIntent))
    if (pointTargets.length < 2 || publicTables.length === 0) return null
    // One loop deliberately crosses the service boundary once: prep → one
    // table service → counter. Subsequent loops rotate the table selection,
    // so the server has no permanent public-table assignment or patrol route.
    const step = ambientTargetIndex % 3
    const cycle = Math.floor(ambientTargetIndex / 3)
    const target = step === 0
      ? pointTargets[0]!
      : step === 1
        ? publicTables[cycle % publicTables.length]!
        : pointTargets[1]!
    ambientTargetIndex += 1
    pendingAmbientIntent = target
    return pendingAmbientIntent
  }

  const requestForStage = ({
    scene, stage, from: _from, snapshot, layout: _layout = {}, navigationOptions: _navigationOptions = {},
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
      const intent = resolveCommercialCafeCoffeeDeliveryIntent({ scene, stage })
      if (intent) {
        pendingAmbientIntent = null
        phase = 'delivering'
      }
      return intent
    }
    if (snapshot.phase === 'moving') return null
    if (stage === 'coffee-delivered' && (phase === 'delivering' || phase === 'delivery-arrived')) {
      const intent = resolveCommercialCafeReturnToCounterIntent(scene)
      if (intent) phase = 'returning'
      return intent
    }
    if (phase === 'boot' || phase === 'ambient-waiting' || phase === 'ambient-moving') {
      const intent = ambientIntent(scene)
      if (intent) phase = 'ambient-moving'
      return intent
    }
    return null
  }

  const arrived = () => {
    if (phase === 'ambient-moving') {
      pendingAmbientIntent = null
      phase = 'ambient-waiting'
    }
    else if (phase === 'delivering') phase = 'delivery-arrived'
    else if (phase === 'returning') phase = 'ambient-waiting'
  }

  return { getPhase, requestForStage, arrived, block, reset }
}
