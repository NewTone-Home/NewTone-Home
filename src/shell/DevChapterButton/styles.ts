import type { CSSProperties } from "react"

export const devChapterButtonStyle: CSSProperties = {
  position: "fixed",
  left: 12,
  bottom: 48,
  padding: "4px 10px",
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
  color: "var(--color-muted)",
  background: "transparent",
  border: "1px solid var(--color-line)",
  borderRadius: 3,
  cursor: "pointer",
  zIndex: 9999,
  opacity: 0.5,
}
