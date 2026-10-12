import { resolveDisplayedReaderLanguage } from '../i18n/languages'
import { trackEvent } from './analytics'

export function trackLandingEntry(preferences, browserLanguages, track = trackEvent) {
  const displayedLanguage = resolveDisplayedReaderLanguage({
    language: preferences.language,
    hasInitializedLanguage: preferences.hasInitializedLanguage,
    browserLanguages,
  })
  track('landing_entry', {
    stepId: 'landing',
    language: displayedLanguage.language,
    eventData: { languageSource: displayedLanguage.source },
  })
  return displayedLanguage
}
