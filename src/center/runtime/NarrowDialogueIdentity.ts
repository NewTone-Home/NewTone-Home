export type NarrowDialogueKind = 'conversation' | 'aside'
export type NarrowDialogueContent = 'text' | 'options'

/** Stable presentation identity; pageKey must identify a fitted page, not a motion frame. */
export type NarrowDialogueIdentity = Readonly<{
  sessionKey: string
  kind: NarrowDialogueKind
  lineKey: string
  pageKey: string
  pageIndex: number
  content: NarrowDialogueContent
  optionSetKey?: string
  speakerKey?: string
}>

export type NarrowDialogueTransition =
  | 'conversation-start'
  | 'aside-start'
  | 'aside-enter'
  | 'aside-return'
  | 'options-enter'
  | 'options-return'
  | 'line-change'
  | 'capacity-page'
  | 'same'

export function narrowDialogueIdentityKey(identity: NarrowDialogueIdentity) {
  return JSON.stringify([
    identity.sessionKey,
    identity.kind,
    identity.lineKey,
    identity.pageKey,
    identity.pageIndex,
    identity.content,
    identity.optionSetKey ?? '',
    identity.speakerKey ?? '',
  ])
}

/**
 * Classify content changes without treating a speaker change or capacity page
 * as a new conversation. The caller owns authored dialogue advancement.
 */
export function narrowDialogueTransition(
  previous: NarrowDialogueIdentity | null,
  next: NarrowDialogueIdentity,
): NarrowDialogueTransition {
  if (!previous || previous.sessionKey !== next.sessionKey) {
    return next.kind === 'aside' ? 'aside-start' : next.content === 'options' ? 'options-enter' : 'conversation-start'
  }
  if (previous.kind !== next.kind) return next.kind === 'aside' ? 'aside-enter' : 'aside-return'
  if (previous.content !== next.content) return next.content === 'options' ? 'options-enter' : 'options-return'
  if (previous.lineKey === next.lineKey && previous.pageIndex !== next.pageIndex) return 'capacity-page'
  if (previous.pageKey !== next.pageKey) return 'line-change'
  if (previous.lineKey !== next.lineKey) return 'line-change'
  return 'same'
}

export function narrowDialogueStartsTypewriter(transition: NarrowDialogueTransition, kind: NarrowDialogueKind, content: NarrowDialogueContent) {
  return transition === 'conversation-start' && kind === 'conversation' && content === 'text'
}

export function narrowDialogueEndsConversation(closing: 'none' | 'aside' | 'conversation') {
  return closing === 'conversation'
}
