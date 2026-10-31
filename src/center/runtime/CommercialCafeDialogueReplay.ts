import { commercialCafeNarrativeDialogue } from './commercialCafeStory'
import type { MainlineConversationDisplayContent, MainlineConversationDisplayHistoryEntry, MainlineSceneDialogueLine, MainlineSceneDialoguePresentation } from './mainlineSceneModel'
import { hasContinuousCafe, isPointInContinuousCafe } from './continuousCafe'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { Point } from './sceneGeometry'

export type CommercialCafeReplayStoryStatus = 'available' | 'ready-to-leave' | 'complete'
export type CommercialCafeReplayMotion = 'typing' | 'static' | 'deleting'
export type CommercialCafeDialogueReplayState = Readonly<{
  runId: number
  phase: 'idle' | 'replaying'
  lineIndex: number
  textMotion: CommercialCafeReplayMotion
}>
export type CommercialCafeDialogueReplayAction =
  | { type: 'start'; previewAllowed: boolean; storyStatus: CommercialCafeReplayStoryStatus }
  | { type: 'advance' }
  | { type: 'motion-complete'; motion: 'typing' | 'deleting' }
  | { type: 'cancel' }
export type CommercialCafeDialogueReplayView = Readonly<{
  sessionId: string
  runId: number
  dialogue: MainlineSceneDialoguePresentation
  lineIndex: number
  line: MainlineSceneDialogueLine
  conversationDisplayContent: Extract<MainlineConversationDisplayContent, { kind: 'text' | 'aside' }>
  textMotion: CommercialCafeReplayMotion
  canAdvance: boolean
}>

export const commercialCafeDialogueReplaySource: MainlineSceneDialoguePresentation = {
  triggerEntityId: commercialCafeNarrativeDialogue.triggerEntityId,
  dialoguePresentation: 'conversation',
  lines: commercialCafeNarrativeDialogue.lines,
}
export const initialCommercialCafeDialogueReplayState: CommercialCafeDialogueReplayState = {
  runId: 0, phase: 'idle', lineIndex: 0, textMotion: 'static',
}
const replayableStoryStatuses = new Set<CommercialCafeReplayStoryStatus>(['ready-to-leave', 'complete'])

export function shouldShowCommercialCafeDialogueReplay(input: {
  scene: MainlineSceneDefinition
  playerPosition: Point
  storyStatus: CommercialCafeReplayStoryStatus
  hostname: string
  search: string
}) {
  const hostname = input.hostname.toLowerCase()
  const allowedHost = hostname.endsWith('-newtone-homes-projects.vercel.app')
    || hostname === 'mon-submissions-cleaner-nav.trycloudflare.com'
    || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
  const isPlayerInsideCafe = hasContinuousCafe(input.scene) && isPointInContinuousCafe(input.scene, input.playerPosition)
  return isPlayerInsideCafe
    && replayableStoryStatuses.has(input.storyStatus)
    && allowedHost
    && new URLSearchParams(input.search).get('qaCafeDialogueReplay') === '1'
}

export function commercialCafeDialogueReplayReducer(state: CommercialCafeDialogueReplayState, action: CommercialCafeDialogueReplayAction): CommercialCafeDialogueReplayState {
  if (action.type === 'start') {
    if (!action.previewAllowed || !replayableStoryStatuses.has(action.storyStatus)) return state
    return { runId: state.runId + 1, phase: 'replaying', lineIndex: 0, textMotion: 'typing' }
  }
  if (action.type === 'cancel') return state.phase === 'replaying' ? { ...state, phase: 'idle', textMotion: 'static' } : state
  if (state.phase !== 'replaying') return state
  if (action.type === 'motion-complete') {
    if (action.motion === 'typing' && state.textMotion === 'typing') return { ...state, textMotion: 'static' }
    if (action.motion === 'deleting' && state.textMotion === 'deleting') return { ...state, phase: 'idle', textMotion: 'static' }
    return state
  }
  if (state.textMotion === 'typing') return { ...state, textMotion: 'static' }
  if (state.textMotion !== 'static') return state
  if (state.lineIndex + 1 < commercialCafeDialogueReplaySource.lines.length) return { ...state, lineIndex: state.lineIndex + 1 }
  return { ...state, textMotion: 'deleting' }
}

export function commercialCafeDialogueReplayView(state: CommercialCafeDialogueReplayState): CommercialCafeDialogueReplayView | null {
  if (state.phase !== 'replaying') return null
  const line = commercialCafeDialogueReplaySource.lines[state.lineIndex]
  if (!line) return null
  const sessionId = `test-replay:commercial-cafe-lao-zhou:${state.runId}`
  const history: readonly MainlineConversationDisplayHistoryEntry[] = commercialCafeDialogueReplaySource.lines.slice(0, state.lineIndex)
    .map(previous => ({ key: previous.id, speaker: previous.speaker, speakerIsNpc: Boolean(previous.speakerNpcId), text: previous.text }))
  return {
    sessionId, runId: state.runId, dialogue: commercialCafeDialogueReplaySource, lineIndex: state.lineIndex, line,
    conversationDisplayContent: { sessionId, kind: 'text', text: line.text, textMotion: state.textMotion, canAdvance: state.textMotion !== 'deleting', history },
    textMotion: state.textMotion, canAdvance: state.textMotion !== 'deleting',
  }
}
