import type { MainlineSceneId } from './mainlineSceneModel'
import type { PhoneDevice } from './phoneState'

/** One paired starting state. Saved journeys and explicit test scene URLs
 * remain separate from the new-game default. */
export const initialMainlineSceneId: MainlineSceneId = 'commercial-street'
export const initialMainlinePhoneDevice: PhoneDevice = 'inner'
