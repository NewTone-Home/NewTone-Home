export const PUBLIC_RELEASE_CUTOVER_STORAGE_KEY = 'newtone-public-release-cutover-v1'
export const PUBLIC_RELEASE_CUTOVER_ID = 'center-v1'
export const PUBLIC_RELEASE_VERSION = '0.2.0'

const GAME_STATE_KEYS = Object.freeze([
  'newtone-progress-v1',
  'newtone-progress-v2',
  'newtone-progress-v3',
  'newtone-progress-v4',
  'newtone-reader-exit-tutorial-v1',
  'newtone-narrative-progress-v1',
  'newtone-narrative-progress-v2',
  'newtone-player-save-v1',
  'newtone.mainline.carried-phone.v1',
  'newtone.mainline.carried-phone.v2',
  'newtone.mainline.scene-positions.v2',
  'newtone-landing-intro-v1',
  'newtone-center-feedback-completion-shown-v1',
  'newtone-center-feedback-completion-submitted-v1',
  'newtone-center-feedback-prompt-shown-v1',
])

const GAME_STATE_PREFIXES = Object.freeze([
  'newtone:center:scene-layout:',
  'newtone-layout-',
])

/**
 * @typedef {{
 *   getItem: (key: string) => string | null,
 *   setItem: (key: string, value: string) => void,
 *   removeItem: (key: string) => void,
 *   length?: number,
 *   key?: (index: number) => string | null,
 * }} ReleaseStorage
 */

/** @returns {ReleaseStorage | null} */
function defaultStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function clearPrefixedKeys(storage) {
  if (typeof storage?.length !== 'number' || typeof storage.key !== 'function') return

  const keys = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && GAME_STATE_PREFIXES.some(prefix => key.startsWith(prefix))) keys.push(key)
  }
  keys.forEach(key => storage.removeItem(key))
}

/**
 * Performs the one-time public switch from the old Reader release to Center.
 * Analytics identity and pending analytics events intentionally remain intact.
 */
/** @param {ReleaseStorage | null} [storage] */
export function applyPublicReleaseCutover(storage = defaultStorage()) {
  if (!storage) return { status: 'unavailable' }

  try {
    if (storage.getItem(PUBLIC_RELEASE_CUTOVER_STORAGE_KEY) === PUBLIC_RELEASE_CUTOVER_ID) {
      return { status: 'already-applied' }
    }

    GAME_STATE_KEYS.forEach(key => storage.removeItem(key))
    clearPrefixedKeys(storage)
    storage.setItem(PUBLIC_RELEASE_CUTOVER_STORAGE_KEY, PUBLIC_RELEASE_CUTOVER_ID)
    return { status: 'applied' }
  } catch {
    // Do not mark a partial cleanup as complete; the next load can retry it.
    return { status: 'failed' }
  }
}
