import type { CSSProperties } from "react"

export const devResetButtonStyle: CSSProperties = {
  position: "fixed",
  bottom: 16,
  left: 16,
  background: "rgba(200, 0, 0, 0.08)",
  border: "1px solid rgba(200, 0, 0, 0.25)",
  color: "var(--color-fg-muted)",
  padding: "4px 10px",
  fontSize: 11,
  fontFamily: "monospace",
  cursor: "pointer",
  borderRadius: 4,
  zIndex: 9999,
  letterSpacing: "0.05em",
}
