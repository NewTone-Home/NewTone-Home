import { trackLandingEntry } from './landingEntryAnalytics.js'
// One visible Landing visit, not one effect setup or preference render.
export function createLandingEntryObserver(track = trackLandingEntry) {
  let recorded = false
  return {
    observe({ visible, previewReady, preferences, browserLanguages }) {
      if (!visible) { recorded = false; return null }
      if (!previewReady || recorded) return null
      recorded = true
      return track(preferences, browserLanguages)
    },
  }
}
