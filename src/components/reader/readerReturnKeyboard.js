export const READER_RETURN_KEYS = new Set(['Enter', ' '])

export function isReaderReturnActivationKey(key) {
  return READER_RETURN_KEYS.has(key)
}
