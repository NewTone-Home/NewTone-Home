import { forwardRef, type ComponentPropsWithoutRef } from 'react'

/** Typography only. Identity, occupancy and actions belong to the caller. */
export const SceneCharacters = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<'span'>>(
  function SceneCharacters({ children, ...props }, ref) {
    return <span {...props} ref={ref} data-scene-characters="true">{children}</span>
  },
)

