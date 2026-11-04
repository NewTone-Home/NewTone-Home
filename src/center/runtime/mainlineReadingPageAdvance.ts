/** Safety timeout only for a page change whose animation component never mounts. */
export const mainlineReadingPageAdvanceStartupWatchdogMs = 5000

/** Let the resumed animation frame complete before the fallback may unlock. */
export const mainlineReadingPageAdvanceResumeGraceMs = 320

/** Late completion/timer callbacks must never release a newer page's lock. */
export function mainlineReadingPageAdvanceTokenIsCurrent(currentToken: number, callbackToken: number) {
  return currentToken === callbackToken
}

/** The watchdog may release only if the matching roll never actually started. */
export function mainlineReadingPageAdvanceWatchdogMayRelease(currentToken: number, callbackToken: number, startedToken: number | null) {
  return mainlineReadingPageAdvanceTokenIsCurrent(currentToken, callbackToken) && startedToken !== callbackToken
}
