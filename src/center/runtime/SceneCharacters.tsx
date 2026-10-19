import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'

/** Typography only. Identity, occupancy and actions belong to the caller. */
export const SceneCharacters = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<'span'>>(
  function SceneCharacters({ children, ...props }, ref) {
    return <span {...props} ref={ref} data-scene-characters="true">{children}</span>
  },
)

/** Two purely visual states in one fixed world cell, sharing the parent's
 * progress. This component adds no timer, input or world object. */
export function SceneCharacterSwitch({ before, after, beforeGroup, afterGroup, beforeOffsetPx }: {
  before: string; after: ReactNode; beforeGroup?: string; afterGroup?: string; beforeOffsetPx?: { x: number; y: number }
}) {
  return <span className="scene-character-switch">
    <SceneCharacters className="scene-character-switch__before" data-focus-visual-group={beforeGroup} style={beforeOffsetPx ? { left: `calc(50% + ${beforeOffsetPx.x}px)`, top: `calc(50% + ${beforeOffsetPx.y}px)` } : undefined}>{before}</SceneCharacters>
    <SceneCharacters className="scene-character-switch__after" data-focus-visual-group={afterGroup}>{after}</SceneCharacters>
  </span>
}
