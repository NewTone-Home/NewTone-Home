import { createReaderPreviewStores } from '../stores/progressStore'
import { createOwnerPreviewTransition } from './ownerPreviewTransition.mjs'
// Root-local context only: no installation of a game storage capability.
export function openOwnerPreviewSession() {
  const stores = createReaderPreviewStores()
  stores.transitionStore = createOwnerPreviewTransition(stores.progressStore)
  return { stores, initialLocation: stores.progressStore.getState().committedLocation,
    release() { stores.transitionStore.getState().reset() } }
}
