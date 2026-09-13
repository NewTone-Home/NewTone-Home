import type { SyntheticEvent } from 'react'

function preventSceneDefault(event: SyntheticEvent) {
  event.preventDefault()
}

export const sceneInteractionHandlers = {
  onContextMenu: preventSceneDefault,
  onCopy: preventSceneDefault,
  onCut: preventSceneDefault,
  onPaste: preventSceneDefault,
  onDragStart: preventSceneDefault,
  onSelect: preventSceneDefault,
} as const
