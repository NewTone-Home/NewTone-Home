'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { findMainlinePath, isWalkableMainlinePoint, type MainlineNavigationOptions } from './mainlineNavigation'
import type { SceneLayout } from './sceneLayout'
import { createNpcRuntime, type NpcIntent, type NpcRuntime, type NpcRuntimeSnapshot } from './npcCore'
import type { NavigationRuntime } from './navigationCore'
import { useFreeRoamMovement, type FreeRoamMovement, type MovementComplete, type MovementOptions } from './useFreeRoamMovement'

type NpcLocomotion = Pick<FreeRoamMovement, 'moveAlong' | 'stopMovement' | 'resetMovement' | 'getCurrentPosition'>

export type NpcMovementAdapter = {
  getPosition: () => Point
  getSnapshot: () => NpcRuntimeSnapshot
  requestMove: (
    intent: NpcIntent,
    scene: MainlineSceneDefinition,
    layout: SceneLayout,
    navigationOptions?: MainlineNavigationOptions,
    movementOptions?: MovementOptions,
    onArrive?: MovementComplete,
  ) => boolean
  reset: (position: Point) => void
}

type CreateNpcMovementAdapterOptions = {
  npcId: string
  initialPosition: Point
  movement: NpcLocomotion
  navigationRuntime: NavigationRuntime
  onChange?: () => void
}

/**
 * Small bridge between NPC intent state and the already-shared locomotion
 * controller. It owns neither a route system nor a second position store:
 * every live point is mirrored into npcCore and NavigationRuntime together.
 */
export function createNpcMovementAdapter({ npcId, initialPosition, movement, navigationRuntime, onChange }: CreateNpcMovementAdapterOptions): NpcMovementAdapter {
  const runtime: NpcRuntime = createNpcRuntime(npcId, initialPosition)

  const notify = () => onChange?.()
  const syncPosition = (position: Point) => {
    runtime.setPosition(position)
    navigationRuntime.updateActor(npcId, position)
    notify()
  }

  return {
    getPosition: () => runtime.getPosition(),
    getSnapshot: () => runtime.getSnapshot(),
    requestMove: (intent, scene, layout, navigationOptions = {}, movementOptions = {}, onArrive) => {
      const start = movement.getCurrentPosition()
      syncPosition(start)
      runtime.beginIntent(intent)
      notify()

      const options: MainlineNavigationOptions = {
        ...navigationOptions,
        actorId: npcId,
        navigationRuntime,
      }
      const path = findMainlinePath(start, intent.target, scene, layout, options)
      if (!path) {
        runtime.blocked()
        notify()
        return false
      }

      const canOccupy = (point: Point) => isWalkableMainlinePoint(point, scene, layout, options)

      movement.moveAlong(path, (position) => {
        syncPosition(position)
        runtime.arrive()
        notify()
        onArrive?.(position)
      }, {
        ...movementOptions,
        canOccupy,
        // Keep the planner's last turn when entering an access-controlled
        // staging point. Otherwise generic same-direction compression can
        // straighten a valid route around a protected static body.
        finalCanOccupy: canOccupy,
        onMove: (position) => {
          syncPosition(position)
          movementOptions.onMove?.(position)
        },
        onBlocked: (position) => {
          syncPosition(position)
          runtime.blocked()
          notify()
          movementOptions.onBlocked?.(position)
        },
      })
      return true
    },
    reset: (position) => {
      movement.resetMovement(position)
      runtime.reset()
      syncPosition(position)
    },
  }
}

type UseNpcMovementOptions = {
  enabled: boolean
  npcId: string
  initialPosition: Point
  navigationRuntime: NavigationRuntime
}

/**
 * React projection of one NPC's intent/locomotion bridge. The scene
 * placement provides the initial point only; after mounting, this hook's
 * live position is the single source passed to rendering and navigation.
 */
export function useNpcMovement({ enabled, npcId, initialPosition, navigationRuntime }: UseNpcMovementOptions) {
  const movement = useFreeRoamMovement(initialPosition)
  const [revision, setRevision] = useState(0)
  const movementRef = useRef(movement)
  movementRef.current = movement
  const adapterRef = useRef<NpcMovementAdapter | null>(null)
  if (!adapterRef.current) {
    adapterRef.current = createNpcMovementAdapter({
      npcId,
      initialPosition,
      movement: {
        moveAlong: (...args) => movementRef.current.moveAlong(...args),
        stopMovement: () => movementRef.current.stopMovement(),
        resetMovement: (position) => movementRef.current.resetMovement(position),
        getCurrentPosition: () => movementRef.current.getCurrentPosition(),
      },
      navigationRuntime,
      onChange: () => setRevision((revision) => revision + 1),
    })
  }
  const adapter = adapterRef.current
  const resetKey = `${enabled}:${npcId}:${initialPosition.x}:${initialPosition.y}`

  useEffect(() => {
    if (!enabled) {
      movement.stopMovement()
      return
    }
    adapter.reset(initialPosition)
  }, [adapter, enabled, resetKey])

  const requestMove = useCallback((intent: NpcIntent, scene: MainlineSceneDefinition, layout: SceneLayout, navigationOptions?: MainlineNavigationOptions, movementOptions?: MovementOptions, onArrive?: MovementComplete) => (
    enabled && adapter.requestMove(intent, scene, layout, navigationOptions, movementOptions, onArrive)
  ), [adapter, enabled])

  const snapshot = useMemo(() => adapter.getSnapshot(), [adapter, movement.position, revision])
  return {
    position: enabled ? movement.position : null,
    snapshot,
    requestMove,
  }
}
