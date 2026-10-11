import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'

/** Typography only. Identity, occupancy and actions belong to the caller. */
export const SceneCharacters = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<'span'>>(
  function SceneCharacters({ children, ...props }, ref) {
    return <span {...props} ref={ref} data-scene-characters="true">{children}</span>
  },
)

/** Two purely visual states in one fixed world cell, sharing the parent's
 * progress. This component adds no timer, input or world object. */
export function SceneCharacterSwitch({ before, after, beforeGroup, afterGroup }: {
  before: string; after: ReactNode; beforeGroup?: string; afterGroup?: string
}) {
  return <span className="scene-character-switch">
    <SceneCharacters className="scene-character-switch__before" data-focus-visual-group={beforeGroup}>{before}</SceneCharacters>
    <SceneCharacters className="scene-character-switch__after" data-focus-visual-group={afterGroup}>{after}</SceneCharacters>
  </span>
}
