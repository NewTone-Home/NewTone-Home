/** Canonical identity shared by page rendering and layout-settle tracking. */
export function mainlineReadingPageKey(input: {
  sessionKey: string
  segmentIndex: number
  overflowIndex: number
  text: string
}) {
  return `${input.sessionKey}:${input.segmentIndex}:${input.overflowIndex}:${input.text}`
}
