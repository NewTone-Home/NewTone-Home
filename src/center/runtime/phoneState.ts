import type { MainlineSceneId } from './mainlineSceneModel'

/** The device the protagonist is currently carrying. */
export type PhoneDevice = 'surface' | 'inner'

/** A scene's physical layer. The passage is deliberately not owned by either world. */
export type WorldLayer = 'surface' | 'inner' | 'passage'

export type PhoneConnection = 'online' | 'offline'
export type PhoneRideAvailability = 'available' | 'offline' | 'not-open'

export type WorldPhonePhase = 'closed' | 'opening' | 'open' | 'closing' | 'swap-retracting'

/**
 * The game scene owns all empty pixels. The phone only owns the handle while
 * collapsed and its visible panel while expanded.
 */
export function phoneInputOwner(phase: WorldPhonePhase): 'scene' | 'handle' | 'panel' {
  if (phase === 'closed') return 'handle'
  if (phase === 'opening' || phase === 'open') return 'panel'
  return 'scene'
}

/**
 * Scene topology is explicit. In particular, the passage is not inferred to
 * be inner-world merely because it sits between an inner-world office and the
 * ancestral house.
 */
export const mainlineSceneWorldLayers: Record<MainlineSceneId, WorldLayer> = {
  'jijia-ancestral-home': 'surface',
  'jijia-ancestral-interior': 'surface',
  'commercial-street': 'inner',
  'commercial-cafe': 'inner',
  'yonghe-mining-perimeter': 'inner',
  'yonghe-eatery': 'inner',
  'zhongshuyuan-passage': 'passage',
  'zhongshuyuan-office': 'inner',
}

export function worldLayerForScene(sceneId: MainlineSceneId): WorldLayer {
  return mainlineSceneWorldLayers[sceneId]
}

/**
 * Signal belongs to the carried device in a physical layer. A neutral passage
 * cannot serve either phone, even when its neighbouring scenes can.
 */
export function phoneConnectionFor(device: PhoneDevice, layer: WorldLayer): PhoneConnection {
  return layer !== 'passage' && device === layer ? 'online' : 'offline'
}

export function phoneIsOnline(device: PhoneDevice, layer: WorldLayer) {
  return phoneConnectionFor(device, layer) === 'online'
}

/** The ride app can be online before a world has an opened ride service. */
export function phoneRideAvailability(device: PhoneDevice, layer: WorldLayer): PhoneRideAvailability {
  if (!phoneIsOnline(device, layer)) return 'offline'
  return device === 'inner' ? 'available' : 'not-open'
}
