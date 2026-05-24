import type { CSSProperties } from "react"

export const buttonsRowStyle: CSSProperties = {
  display: "flex",
  gap: 32,
}

export const buttonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--color-fg)",
  padding: "12px 28px",
  fontFamily: "var(--font-serif-sc)",
  fontSize: "var(--font-size-md)",
  color: "var(--color-fg)",
  cursor: "pointer",
  letterSpacing: "0.05em",
  transition: "all 0.2s ease",
}
