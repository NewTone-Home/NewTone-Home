// Landing may run before a game session exists. Never fall back to physical storage.
import { INTRO_STORAGE_KEY } from '../landing/landingIntro'
export * from '../landing/landingIntro'
let sessionStorage = null
let learnedThisVisit = false
export function setLandingIntroSession(storage) {
  sessionStorage = storage
  if (storage && learnedThisVisit) storage.setItem(INTRO_STORAGE_KEY, 'true')
}
export function readIntroCompleted(storage = sessionStorage) {
  try { return learnedThisVisit || storage?.getItem(INTRO_STORAGE_KEY) === 'true' } catch { return learnedThisVisit }
}
export function writeIntroCompleted(storage = sessionStorage) {
  learnedThisVisit = true
  try { storage?.setItem(INTRO_STORAGE_KEY, 'true') } catch { /* Session owner handles stopped writes. */ }
}
export function clearIntroCompleted(storage = sessionStorage) {
  learnedThisVisit = false
  storage?.removeItem(INTRO_STORAGE_KEY)
}
