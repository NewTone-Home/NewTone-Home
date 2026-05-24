import type { CSSProperties } from "react"

export const placeholderContainerStyle: CSSProperties = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-bg)",
  gap: 16,
}

export const placeholderLabelStyle: CSSProperties = {
  fontFamily: "var(--font-serif-sc)",
  fontSize: "var(--font-size-lg)",
  color: "var(--color-fg)",
  letterSpacing: "0.08em",
}

export const placeholderHintStyle: CSSProperties = {
  fontFamily: "var(--font-serif-sc)",
  fontSize: "var(--font-size-sm)",
  color: "var(--color-fg-muted)",
  letterSpacing: "0.1em",
}
