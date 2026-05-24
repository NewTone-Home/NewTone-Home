import type { CSSProperties } from "react"
import { DOT_SIZE_PX } from "../../tokens"

export const heartbeatDotStyle: CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  width: DOT_SIZE_PX,
  height: DOT_SIZE_PX,
  borderRadius: "50%",
  background: "var(--color-fg)",
  pointerEvents: "none",
  zIndex: 100,
}
